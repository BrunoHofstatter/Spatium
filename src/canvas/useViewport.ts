import type { Point } from '../model/types';
import { screenToWorld } from '../model/geometry';
import { useStore } from '../model/store';
export function localPoint(element: HTMLElement, x: number, y: number): Point {
  const rect = element.getBoundingClientRect();
  return { x: x - rect.left, y: y - rect.top };
}
export function worldPoint(
  element: HTMLElement,
  panelId: string,
  x: number,
  y: number,
) {
  return screenToWorld(
    localPoint(element, x, y),
    useStore.getState().doc.panels[panelId].viewport,
  );
}
