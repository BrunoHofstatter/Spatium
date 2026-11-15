import { fitAreaViewport, itemBounds } from '../model/geometry';
import { useStore } from '../model/store';
import { visibleCanvas } from './visibleCanvas';
export function focusArea(id: string) {
  const s = useStore.getState(),
    item = s.doc.items[id];
  const canvas = document.querySelector<HTMLElement>('.canvas');
  if (!canvas || item?.type !== 'area') return;
  const size = visibleCanvas(canvas);
  const view = fitAreaViewport(s.doc, id, size);
  s.setViewport(item.panelId, {
    ...view,
    x: view.x + size.x,
    y: view.y + size.y,
  });
}
export function focusTask(id: string) {
  const s = useStore.getState(),
    item = s.doc.items[id];
  const canvas = document.querySelector<HTMLElement>('.canvas');
  if (!canvas || item?.type !== 'task') return;
  const size = visibleCanvas(canvas),
    bounds = itemBounds(s.doc, item);
  const zoom = Math.max(0.1, Math.min(1.25, (size.w - 48) / bounds.w));
  s.setViewport(item.panelId, {
    zoom,
    x: size.x + size.w / 2 - (bounds.x + bounds.w / 2) * zoom,
    y: size.y + 24 - bounds.y * zoom,
  });
}
export function revealItem(id: string) {
  const s = useStore.getState(),
    item = s.doc.items[id];
  const canvas = document.querySelector<HTMLElement>('.canvas');
  if (!canvas || !item) return;
  const size = visibleCanvas(canvas),
    view = s.doc.panels[item.panelId].viewport;
  const bounds = itemBounds(s.doc, item, view.zoom);
  const zoom = Math.min(view.zoom, Math.max(0.1, (size.w - 32) / bounds.w));
  let x = view.x,
    y = view.y;
  if (x + bounds.x * zoom < size.x + 16) x = size.x + 16 - bounds.x * zoom;
  if (x + (bounds.x + bounds.w) * zoom > size.x + size.w - 16)
    x = size.x + size.w - 16 - (bounds.x + bounds.w) * zoom;
  // Reveal the heading, without shrinking long descriptions to fit their full height.
  const height = Math.min(bounds.h * zoom, 80);
  if (y + bounds.y * zoom < size.y + 16) y = size.y + 16 - bounds.y * zoom;
  if (y + bounds.y * zoom + height > size.y + size.h - 16)
    y = size.y + size.h - 16 - height - bounds.y * zoom;
  s.setViewport(item.panelId, { x, y, zoom });
}
