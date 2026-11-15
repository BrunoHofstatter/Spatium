import { absolutePosition, displayHeight, INSET, TOP } from './geometry';
import { taskRowHeight } from './taskLayout';
import type { Doc, Item, Point } from './types';

export function creationPoint(
  doc: Doc,
  type: Item['type'],
  panelId: string,
  visible: { x: number; y: number; w: number; h: number },
  parentId: string | null,
): Point {
  const w = type === 'area' ? 420 : type === 'task' ? 260 : 220;
  const h =
    type === 'area'
      ? 280
      : type === 'task'
        ? taskRowHeight({ titleFontSize: null }, doc.settings.taskTitleSize)
        : 100;
  let left = visible.x,
    top = visible.y,
    right = visible.x + visible.w,
    bottom = visible.y + visible.h;
  const parent = parentId ? doc.items[parentId] : undefined;
  if (parent?.type === 'area') {
    const origin = absolutePosition(doc.items, parent.id);
    const px = origin.x + INSET,
      py = origin.y + TOP;
    left = Math.max(left, px);
    top = Math.max(top, py);
    right = Math.min(right, origin.x + parent.w - INSET);
    bottom = Math.min(bottom, origin.y + parent.h - INSET);
    if (right - left < w) {
      left = Math.max(px, Math.min(visible.x, origin.x + parent.w - INSET - w));
      right = Math.max(left + w, origin.x + parent.w - INSET);
    }
    if (bottom - top < h) {
      top = Math.max(py, Math.min(visible.y, origin.y + parent.h - INSET - h));
      bottom = Math.max(top + h, origin.y + parent.h - INSET);
    }
  }
  const clamp = (p: Point) => ({
    x: Math.max(left, Math.min(right - w, p.x)),
    y: Math.max(top, Math.min(bottom - h, p.y)),
  });
  const desired = clamp({
    x: visible.x + (visible.w - w) / 2,
    y: visible.y + (visible.h - h) / 2,
  });
  const occupied = Object.values(doc.items)
    .filter((i) => i.panelId === panelId && i.parentId === parentId)
    .map((i) => ({
      ...absolutePosition(doc.items, i.id),
      w: i.w,
      h: displayHeight(i, doc.settings.showDone, doc.settings.taskTitleSize),
    }));
  const candidates = [
    desired,
    ...occupied.flatMap((r) => [
      clamp({ x: desired.x, y: r.y + r.h + 16 }),
      clamp({ x: r.x + r.w + 16, y: desired.y }),
    ]),
  ];
  const overlap = (p: Point) =>
    occupied.reduce(
      (total, r) =>
        total +
        Math.max(0, Math.min(p.x + w, r.x + r.w + 8) - Math.max(p.x, r.x - 8)) *
          Math.max(
            0,
            Math.min(p.y + h, r.y + r.h + 8) - Math.max(p.y, r.y - 8),
          ),
      0,
    );
  return candidates.reduce(
    (best, p) => (overlap(p) < overlap(best) ? p : best),
    desired,
  );
}
