import type { Doc, Item, Point, Viewport } from './types';
import { taskRowHeight } from './taskLayout';
export const INSET = 12;
export const HEADER = 40;
export const TOP = 44;
export const COLLAPSED_TASK_HEIGHT = 40;
export const MIN_AREA_FONT = 14;
export const MAX_AREA_FONT = 72;
export const MIN_SIZE = {
  task: { w: 160, h: 56 },
  note: { w: 80, h: 32 },
  area: { w: 200, h: 120 },
};

export function absolutePosition(items: Doc['items'], id: string): Point {
  const item = items[id];
  if (!item) return { x: 0, y: 0 };
  let { x, y } = item;
  let parent = item.parentId;
  const seen = new Set([id]);
  while (parent && items[parent] && !seen.has(parent)) {
    seen.add(parent);
    const p = items[parent];
    x += p.x + INSET;
    y += p.y + TOP;
    parent = p.parentId;
  }
  return { x, y };
}
export function descendants(items: Doc['items'], id: string): string[] {
  const result: string[] = [];
  const queue = [id];
  const seen = new Set(queue);
  const children = new Map<string, string[]>();
  for (const item of Object.values(items))
    if (item.parentId)
      children.set(item.parentId, [
        ...(children.get(item.parentId) ?? []),
        item.id,
      ]);
  for (let i = 0; i < queue.length; i++)
    for (const child of children.get(queue[i]) ?? []) {
      if (!seen.has(child)) {
        seen.add(child);
        result.push(child);
        queue.push(child);
      }
    }
  return result;
}
export function rootsOfSelection(items: Doc['items'], ids: string[]): string[] {
  const selected = new Set(ids);
  return ids.filter((id) => {
    let p = items[id]?.parentId;
    while (p) {
      if (selected.has(p)) return false;
      p = items[p]?.parentId;
    }
    return !!items[id];
  });
}
export function displayHeight(
  item: Item,
  showDone = true,
  defaultSize = 16,
): number {
  if (item.type === 'area' && item.collapsed) return 0;
  if (item.type === 'task' && item.collapsed)
    return taskRowHeight(item, defaultSize);
  if (item.type === 'task' && item.subtasksExpanded)
    return (
      item.h +
      40 +
      item.subtasks.filter((s) => showDone || s.state !== 'done').length * 36
    );
  return item.h;
}
export function isVisible(doc: Doc, item: Item): boolean {
  if (item.type === 'task' && item.state === 'done' && !doc.settings.showDone)
    return false;
  let parent = item.parentId;
  while (parent) {
    const p = doc.items[parent];
    if (!p || (p.type === 'area' && p.collapsed)) return false;
    parent = p.parentId;
  }
  return true;
}
export function areaAt(
  doc: Doc,
  panelId: string,
  point: Point,
  excluded = new Set<string>(),
): string | null {
  const candidates = Object.values(doc.items).filter((i) => {
    if (
      i.panelId !== panelId ||
      i.type !== 'area' ||
      i.collapsed ||
      excluded.has(i.id) ||
      !isVisible(doc, i)
    )
      return false;
    const p = absolutePosition(doc.items, i.id);
    return (
      point.x >= p.x &&
      point.x <= p.x + i.w &&
      point.y >= p.y &&
      point.y <= p.y + i.h
    );
  });
  const path = (item: Item): number[] => {
    const parts = [item.z];
    let p = item.parentId;
    while (p) {
      parts.unshift(doc.items[p].z);
      p = doc.items[p].parentId;
    }
    return parts;
  };
  candidates.sort((a, b) => {
    const aa = path(a),
      bb = path(b);
    if (aa.length !== bb.length) return bb.length - aa.length;
    for (let i = 0; i < aa.length; i++)
      if (aa[i] !== bb[i]) return bb[i] - aa[i];
    return 0;
  });
  return candidates[0]?.id ?? null;
}
export function reparent(doc: Doc, id: string, parentId: string | null): void {
  const item = doc.items[id];
  if (!item) return;
  if (parentId) {
    const parent = doc.items[parentId];
    if (
      !parent ||
      parent.type !== 'area' ||
      parent.panelId !== item.panelId ||
      parent.collapsed ||
      parentId === id ||
      descendants(doc.items, id).includes(parentId)
    )
      return;
  }
  const world = absolutePosition(doc.items, id);
  const origin = parentId
    ? absolutePosition(doc.items, parentId)
    : { x: -INSET, y: -TOP };
  item.parentId = parentId;
  item.x = world.x - origin.x - INSET;
  item.y = world.y - origin.y - TOP;
  item.z =
    Math.max(
      0,
      ...Object.values(doc.items)
        .filter((i) => i.panelId === item.panelId && i.parentId === parentId)
        .map((i) => i.z),
    ) + 1;
  item.updatedAt = Date.now();
}
// Mutates an Immer draft. Shifting an area's origin preserves every child's world position.
export function growAncestors(doc: Doc, id: string): void {
  let child = doc.items[id];
  while (child?.parentId) {
    const parent = doc.items[child.parentId];
    if (!parent || parent.type !== 'area') break;
    const left = Math.min(0, child.x),
      top = Math.min(0, child.y);
    if (left || top) {
      parent.x += left;
      parent.y += top;
      parent.w -= left;
      parent.h -= top;
      for (const sibling of Object.values(doc.items))
        if (sibling.parentId === parent.id) {
          sibling.x -= left;
          sibling.y -= top;
          sibling.updatedAt = Date.now();
        }
    }
    parent.w = Math.max(parent.w, child.x + child.w + 2 * INSET);
    parent.h = Math.max(
      parent.h,
      child.y +
        displayHeight(
          child,
          doc.settings.showDone,
          doc.settings.taskTitleSize,
        ) +
        TOP +
        INSET,
    );
    parent.updatedAt = Date.now();
    child = parent;
  }
}
export function screenToWorld(point: Point, view: Viewport): Point {
  return {
    x: (point.x - view.x) / view.zoom,
    y: (point.y - view.y) / view.zoom,
  };
}
export function zoomAt(view: Viewport, point: Point, zoom: number): Viewport {
  const next = Math.max(0.1, Math.min(3, zoom));
  const world = screenToWorld(point, view);
  return {
    x: point.x - world.x * next,
    y: point.y - world.y * next,
    zoom: next,
  };
}

export function headingScale(zoom: number): number {
  return Math.max(0.5, Math.min(6, Math.pow(zoom, -0.65)));
}
export interface Rect extends Point {
  w: number;
  h: number;
}
export function itemBounds(doc: Doc, item: Item, zoom = 1): Rect {
  const p = absolutePosition(doc.items, item.id);
  if (item.type !== 'area')
    return {
      ...p,
      w: item.w,
      h: displayHeight(item, doc.settings.showDone, doc.settings.taskTitleSize),
    };
  const scale = headingScale(zoom),
    above = (item.fontSize * 1.2 + 20) * scale + 10;
  return {
    x: p.x,
    y: p.y - above,
    w: Math.max(item.w, 240 * scale),
    h: displayHeight(item) + above,
  };
}
export function selectionHits(
  rect: Rect,
  selection: Rect,
  crossing: boolean,
): boolean {
  return crossing
    ? rect.x <= selection.x + selection.w &&
        rect.x + rect.w >= selection.x &&
        rect.y <= selection.y + selection.h &&
        rect.y + rect.h >= selection.y
    : rect.x >= selection.x &&
        rect.y >= selection.y &&
        rect.x + rect.w <= selection.x + selection.w &&
        rect.y + rect.h <= selection.y + selection.h;
}
export function fitAreaViewport(
  doc: Doc,
  id: string,
  size: { w: number; h: number },
): Viewport {
  const area = doc.items[id];
  if (area?.type !== 'area') throw new Error('Focus requires an area.');
  let view = doc.panels[area.panelId].viewport;
  const items = [id, ...descendants(doc.items, id)]
    .map((key) => doc.items[key])
    .filter((i) => isVisible(doc, i));
  for (let n = 0; n < 5; n++) {
    const bounds = items.map((item) => itemBounds(doc, item, view.zoom));
    const x = Math.min(...bounds.map((b) => b.x)),
      y = Math.min(...bounds.map((b) => b.y));
    const w = Math.max(...bounds.map((b) => b.x + b.w)) - x,
      h = Math.max(...bounds.map((b) => b.y + b.h)) - y;
    const zoom = Math.max(
      0.1,
      Math.min(
        3,
        (size.w - 64) / Math.max(1, w),
        (size.h - 64) / Math.max(1, h),
      ),
    );
    view = {
      zoom,
      x: size.w / 2 - (x + w / 2) * zoom,
      y: size.h / 2 - (y + h / 2) * zoom,
    };
  }
  return view;
}
