import type { Doc, Point } from './types';
import { itemBounds, isVisible, rootsOfSelection } from './geometry';
export interface AlignmentGuide {
  axis: 'x' | 'y';
  value: number;
}
export function snapMovement(
  doc: Doc,
  ids: string[],
  delta: Point,
  zoom: number,
  tolerance = 6,
): { delta: Point; guides: AlignmentGuide[] } {
  const roots = rootsOfSelection(doc.items, ids);
  if (!roots.length || roots.some((id) => doc.items[id].type !== 'task'))
    return { delta, guides: [] };
  const moving = roots.map((id) => itemBounds(doc, doc.items[id]));
  const x = Math.min(...moving.map((b) => b.x)),
    y = Math.min(...moving.map((b) => b.y));
  const w = Math.max(...moving.map((b) => b.x + b.w)) - x,
    h = Math.max(...moving.map((b) => b.y + b.h)) - y;
  const excluded = new Set(ids),
    panelId = doc.items[roots[0]].panelId;
  let sx: { distance: number; value: number } | undefined, sy: typeof sx;
  for (const item of Object.values(doc.items)) {
    if (
      item.type !== 'task' ||
      excluded.has(item.id) ||
      item.panelId !== panelId ||
      !isVisible(doc, item)
    )
      continue;
    const b = itemBounds(doc, item);
    for (const target of [b.x, b.x + b.w / 2, b.x + b.w])
      for (const source of [
        x + delta.x,
        x + w / 2 + delta.x,
        x + w + delta.x,
      ]) {
        const distance = target - source;
        if (
          Math.abs(distance) <= tolerance / zoom &&
          (!sx || Math.abs(distance) < Math.abs(sx.distance))
        )
          sx = { distance, value: target };
      }
    for (const target of [b.y, b.y + b.h / 2, b.y + b.h])
      for (const source of [
        y + delta.y,
        y + h / 2 + delta.y,
        y + h + delta.y,
      ]) {
        const distance = target - source;
        if (
          Math.abs(distance) <= tolerance / zoom &&
          (!sy || Math.abs(distance) < Math.abs(sy.distance))
        )
          sy = { distance, value: target };
      }
  }
  return {
    delta: {
      x: delta.x + (sx?.distance ?? 0),
      y: delta.y + (sy?.distance ?? 0),
    },
    guides: [
      ...(sx ? [{ axis: 'x' as const, value: sx.value }] : []),
      ...(sy ? [{ axis: 'y' as const, value: sy.value }] : []),
    ],
  };
}
