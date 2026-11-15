import { useEffect, type RefObject } from 'react';
import { useStore } from '../model/store';
import {
  areaAt,
  descendants,
  displayHeight,
  headingScale,
  itemBounds,
  selectionHits,
  MIN_AREA_FONT,
  MAX_AREA_FONT,
  isVisible,
  MIN_SIZE,
  rootsOfSelection,
  screenToWorld,
  zoomAt,
} from '../model/geometry';
import type { Point, Viewport } from '../model/types';
import { localPoint, worldPoint } from './useViewport';
import { focusArea } from './focusArea';
import { snapMovement, type AlignmentGuide } from '../model/snapping';
import { taskMainHeight } from '../model/taskLayout';

type Gesture = {
  type: 'pan' | 'box' | 'move' | 'resize' | 'title' | 'select';
  start: Point;
  last: Point;
  view: Viewport;
  ids: string[];
  moved: boolean;
  threshold: number;
  shift: boolean;
  snapTolerance: number;
  target?: string;
  edge?: string;
  fontSize?: number;
  rect?: { x: number; y: number; w: number; h: number };
};
export function useGestures(
  ref: RefObject<HTMLDivElement | null>,
  panelId: string,
  onBox: (
    rect: {
      x: number;
      y: number;
      w: number;
      h: number;
      crossing: boolean;
    } | null,
  ) => void,
  onContext: (point: Point, screen: Point, taskIds?: string[]) => void,
  onGuides: (guides: AlignmentGuide[]) => void,
) {
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const pointers = new Map<number, Point>();
    let gesture: Gesture | null = null;
    let pinch: { distance: number; center: Point; view: Viewport } | null =
      null;
    let suppressClick = false;
    let lastMiddle: { id: string; time: number; point: Point } | null = null;
    const element = (id: string) =>
      canvas.querySelector<HTMLElement>(`[data-item-id="${id}"]`);
    const cleanup = () => {
      for (const el of canvas.querySelectorAll<HTMLElement>('[data-item-id]')) {
        el.style.transform = '';
        el.style.removeProperty('will-change');
        const content = el.querySelector<HTMLElement>(':scope > .areaContent');
        if (content) content.style.transform = '';
        const item = useStore.getState().doc.items[el.dataset.itemId!];
        if (item) {
          if (item.type === 'area')
            el.style.setProperty('--area-font-size', `${item.fontSize}px`);
          el.style.left = `${item.x}px`;
          el.style.top = `${item.y}px`;
          el.style.width = `${item.w}px`;
          el.style.height = `${displayHeight(item, useStore.getState().doc.settings.showDone, useStore.getState().doc.settings.taskTitleSize)}px`;
        }
      }
      onBox(null);
      onGuides([]);
      canvas.classList.remove('interacting');
      for (const el of canvas.querySelectorAll('.dropTarget'))
        el.classList.remove('dropTarget');
    };
    const centerAndDistance = () => {
      const [a, b] = [...pointers.values()];
      return {
        center: { x: (a.x + b.x) / 2, y: (a.y + b.y) / 2 },
        distance: Math.max(1, Math.hypot(a.x - b.x, a.y - b.y)),
      };
    };
    const down = (e: PointerEvent) => {
      if (e.button !== 0 && e.button !== 1) return;
      const target = e.target as HTMLElement;
      const active = document.activeElement;
      if (
        !target.closest('input,textarea,select') &&
        active instanceof HTMLElement &&
        canvas.contains(active) &&
        active.matches('input,textarea')
      )
        active.blur();
      const p = localPoint(canvas, e.clientX, e.clientY);
      const s = useStore.getState(),
        view = s.doc.panels[panelId].viewport;
      if (!pointers.size) suppressClick = false;
      if (e.pointerType === 'touch') {
        pointers.set(e.pointerId, p);
        if (pointers.size >= 2) {
          e.preventDefault();
          e.stopPropagation();
          cleanup();
          gesture = null;
          suppressClick = true;
          pinch = { ...centerAndDistance(), view };
          for (const pointerId of pointers.keys())
            canvas.setPointerCapture(pointerId);
          return;
        }
      }
      if (s.selectionMode && e.button === 0) {
        const wrapper = target.closest<HTMLElement>('[data-item-id]');
        const item = wrapper ? s.doc.items[wrapper.dataset.itemId!] : undefined;
        const selectable =
          item &&
          (item.type !== 'area' || target.closest('[data-area-header]'));
        e.preventDefault();
        suppressClick = true;
        pointers.set(e.pointerId, p);
        gesture = {
          type: 'select',
          start: p,
          last: p,
          view,
          ids: s.selection,
          target: selectable ? item.id : undefined,
          moved: false,
          threshold: 8,
          shift: false,
          snapTolerance: 9,
        };
        return;
      }
      if (
        e.button !== 1 &&
        target.closest('input, textarea, button, select, [data-no-gesture]')
      )
        return;
      e.preventDefault();
      pointers.set(e.pointerId, p);
      const wrapper = target.closest<HTMLElement>('[data-item-id]');
      const item = wrapper ? s.doc.items[wrapper.dataset.itemId!] : undefined;
      const handle = target.closest<HTMLElement>('[data-resize]');
      const titleHandle = target.closest('[data-title-resize]');
      const canMove =
        item &&
        (item.type !== 'area' ||
          target.closest('[data-area-header]')?.closest('[data-item-id]') ===
            wrapper);
      let type: Gesture['type'] =
        e.button === 1 || (e.pointerType === 'touch' && !canMove && !handle)
          ? 'pan'
          : 'box';
      let ids = s.selection;
      if (e.button !== 1 && titleHandle && item?.type === 'area') {
        type = 'title';
        s.select([item.id]);
      } else if (e.button !== 1 && handle && item) type = 'resize';
      else if (e.button !== 1 && canMove && item) {
        type = 'move';
        if (e.shiftKey)
          ids = ids.includes(item.id)
            ? ids.filter((id) => id !== item.id)
            : [...ids, item.id];
        else if (!ids.includes(item.id)) ids = [item.id];
        s.select(ids);
      }
      gesture = {
        type,
        start: p,
        last: p,
        view,
        ids:
          type === 'move'
            ? rootsOfSelection(s.doc.items, ids).sort(
                (a, b) => Number(b === item?.id) - Number(a === item?.id),
              )
            : ids,
        moved: false,
        threshold: e.pointerType === 'touch' ? 8 : 4,
        shift: e.shiftKey,
        snapTolerance: e.pointerType === 'touch' ? 9 : 6,
        target: item?.id,
        edge: handle?.dataset.resize,
        fontSize: item?.type === 'area' ? item.fontSize : undefined,
        rect: item ? { x: item.x, y: item.y, w: item.w, h: item.h } : undefined,
      };
    };
    const resizedFont = (g: Gesture) =>
      Math.max(
        MIN_AREA_FONT,
        Math.min(
          MAX_AREA_FONT,
          g.fontSize! +
            ((g.last.x - g.start.x + (g.last.y - g.start.y)) * 0.35) /
              (g.view.zoom * headingScale(g.view.zoom)),
        ),
      );
    const resized = (g: Gesture, delta: Point) => {
      const r = g.rect!,
        edge = g.edge!,
        item = useStore.getState().doc.items[g.target!],
        min = MIN_SIZE[item.type];
      const dx = edge.includes('w') ? Math.min(delta.x, r.w - min.w) : delta.x;
      const dy = edge.includes('n') ? Math.min(delta.y, r.h - min.h) : delta.y;
      const rect = {
        x: r.x + (edge.includes('w') ? dx : 0),
        y: r.y + (edge.includes('n') ? dy : 0),
        w: edge.includes('w')
          ? r.w - dx
          : edge.includes('e')
            ? Math.max(min.w, r.w + dx)
            : r.w,
        h: edge.includes('n')
          ? r.h - dy
          : edge.includes('s')
            ? Math.max(min.h, r.h + dy)
            : r.h,
      };
      if (item.type === 'task') {
        rect.y = r.y;
        rect.h = taskMainHeight(
          { ...item, w: rect.w },
          useStore.getState().doc.settings,
        );
      }
      return rect;
    };
    const move = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      if (e.pointerType === 'mouse' && e.buttons === 0) {
        pointers.clear();
        gesture = null;
        pinch = null;
        cleanup();
        return;
      }
      const p = localPoint(canvas, e.clientX, e.clientY);
      pointers.set(e.pointerId, p);
      if (pinch && pointers.size >= 2) {
        e.preventDefault();
        const current = centerAndDistance();
        const anchor = screenToWorld(pinch.center, pinch.view);
        const zoom = Math.max(
          0.1,
          Math.min(3, (pinch.view.zoom * current.distance) / pinch.distance),
        );
        useStore.getState().setViewport(panelId, {
          x: current.center.x - anchor.x * zoom,
          y: current.center.y - anchor.y * zoom,
          zoom,
        });
        return;
      }
      const g = gesture;
      if (!g) return;
      g.last = p;
      if (
        !g.moved &&
        Math.hypot(p.x - g.start.x, p.y - g.start.y) < g.threshold
      )
        return;
      g.moved = true;
      if (g.type === 'move' || g.type === 'resize')
        canvas.classList.add('interacting');
      if (!canvas.hasPointerCapture(e.pointerId))
        canvas.setPointerCapture(e.pointerId);
      let delta = {
        x: (p.x - g.start.x) / g.view.zoom,
        y: (p.y - g.start.y) / g.view.zoom,
      };
      if (g.type === 'pan' || g.type === 'select')
        useStore.getState().setViewport(panelId, {
          ...g.view,
          x: g.view.x + p.x - g.start.x,
          y: g.view.y + p.y - g.start.y,
        });
      if (g.type === 'box')
        onBox({
          x: Math.min(p.x, g.start.x),
          y: Math.min(p.y, g.start.y),
          w: Math.abs(p.x - g.start.x),
          h: Math.abs(p.y - g.start.y),
          crossing: p.x < g.start.x,
        });
      if (g.type === 'title')
        element(g.target!)?.style.setProperty(
          '--area-font-size',
          `${resizedFont(g)}px`,
        );
      if (g.type === 'move') {
        const s = useStore.getState();
        const alignment = snapMovement(
          s.doc,
          g.ids,
          delta,
          g.view.zoom,
          g.snapTolerance,
        );
        delta = alignment.delta;
        onGuides(alignment.guides);
        const excluded = new Set(
          g.ids.flatMap((id) => [id, ...descendants(s.doc.items, id)]),
        );
        const destination = areaAt(
          s.doc,
          panelId,
          screenToWorld(p, g.view),
          excluded,
        );
        for (const el of canvas.querySelectorAll('.dropTarget'))
          el.classList.remove('dropTarget');
        if (destination) element(destination)?.classList.add('dropTarget');
      }
      if (g.type === 'move')
        for (const id of g.ids) {
          const el = element(id);
          if (el) {
            el.style.transform = `translate(${delta.x}px, ${delta.y}px)`;
            el.style.willChange = 'transform';
          }
        }
      if (g.type === 'resize') {
        const rect = resized(g, delta),
          el = element(g.target!);
        if (el) {
          el.style.left = `${rect.x}px`;
          el.style.top = `${rect.y}px`;
          el.style.width = `${rect.w}px`;
          const s = useStore.getState(),
            item = s.doc.items[g.target!];
          const preview = { ...item, w: rect.w, h: rect.h };
          el.style.height = `${displayHeight(preview, s.doc.settings.showDone, s.doc.settings.taskTitleSize)}px`;
          const content = el.querySelector<HTMLElement>(
            ':scope > .areaContent',
          );
          if (item.type === 'area' && content)
            content.style.transform = `translate(${g.rect!.x - rect.x}px, ${g.rect!.y - rect.y}px)`;
        }
      }
    };
    const up = (e: PointerEvent) => {
      if (!pointers.has(e.pointerId)) return;
      pointers.delete(e.pointerId);
      if (pinch) {
        if (pointers.size < 2) {
          pinch = null;
          gesture = null;
        }
        return;
      }
      const g = gesture;
      gesture = null;
      if (!g) return;
      if (g.moved) suppressClick = true;
      const s = useStore.getState();
      if (e.type !== 'pointercancel') {
        const delta = {
          x: (g.last.x - g.start.x) / g.view.zoom,
          y: (g.last.y - g.start.y) / g.view.zoom,
        };
        if (g.moved && g.type === 'move')
          s.moveItems(
            g.ids,
            delta,
            screenToWorld(g.last, g.view),
            g.snapTolerance,
          );
        if (g.type === 'select' && !g.moved && g.target)
          s.select(
            s.selection.includes(g.target)
              ? s.selection.filter((id) => id !== g.target)
              : [...s.selection, g.target],
          );
        if (g.moved && g.type === 'resize')
          s.resizeItem(g.target!, resized(g, delta));
        if (g.moved && g.type === 'title')
          s.updateItem(g.target!, { fontSize: resizedFont(g) });
        if (g.type === 'box') {
          if (!g.moved) s.select([]);
          else {
            const a = screenToWorld(g.start, g.view),
              b = screenToWorld(g.last, g.view);
            const ids = Object.values(s.doc.items)
              .filter((item) => {
                if (item.panelId !== panelId || !isVisible(s.doc, item))
                  return false;
                const bounds = itemBounds(s.doc, item, g.view.zoom);
                const crossing = b.x < a.x;
                if (crossing && item.type === 'area')
                  bounds.h -= displayHeight(item);
                return selectionHits(
                  bounds,
                  {
                    x: Math.min(a.x, b.x),
                    y: Math.min(a.y, b.y),
                    w: Math.abs(b.x - a.x),
                    h: Math.abs(b.y - a.y),
                  },
                  crossing,
                );
              })
              .map((i) => i.id);
            s.select(g.shift ? [...new Set([...g.ids, ...ids])] : ids);
          }
        }
        if (g.type === 'move' && !g.moved && !g.shift && g.target)
          s.select([g.target]);
        if (g.type === 'pan' && !g.moved && e.pointerType === 'touch')
          s.select([]);
        if (g.type === 'pan' && e.button === 1) {
          const item = g.target ? s.doc.items[g.target] : undefined;
          if (!g.moved && item?.type === 'area') {
            const now = performance.now();
            if (
              lastMiddle?.id === item.id &&
              now - lastMiddle.time < 400 &&
              Math.hypot(
                g.last.x - lastMiddle.point.x,
                g.last.y - lastMiddle.point.y,
              ) < 8
            ) {
              focusArea(item.id);
              lastMiddle = null;
            } else lastMiddle = { id: item.id, time: now, point: g.last };
          } else lastMiddle = null;
        }
      }
      cleanup();
    };
    const wheel = (e: WheelEvent) => {
      if ((e.target as HTMLElement).closest('input,textarea,select')) return;
      e.preventDefault();
      const s = useStore.getState(),
        view = s.doc.panels[panelId].viewport;
      s.setViewport(
        panelId,
        zoomAt(
          view,
          localPoint(canvas, e.clientX, e.clientY),
          view.zoom * Math.exp(-e.deltaY * 0.0015),
        ),
      );
    };
    const doubleClick = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (useStore.getState().selectionMode) return;
      if (target.closest('input,textarea,button,[data-no-gesture]')) return;
      const itemEl = target.closest<HTMLElement>('[data-item-id]'),
        item = itemEl && useStore.getState().doc.items[itemEl.dataset.itemId!];
      if (
        !item ||
        (item.type === 'area' && !target.closest('[data-area-header]'))
      )
        useStore
          .getState()
          .createItem(
            'task',
            panelId,
            worldPoint(canvas, panelId, e.clientX, e.clientY),
          );
    };
    const safariGesture = (e: Event) => e.preventDefault();
    const touchMove = (e: TouchEvent) => {
      if (gesture || pinch) e.preventDefault();
    };
    const click = (e: MouseEvent) => {
      if (suppressClick) {
        e.preventDefault();
        e.stopPropagation();
      }
    };
    const cancel = () => {
      pointers.clear();
      gesture = null;
      pinch = null;
      cleanup();
    };
    const context = (e: MouseEvent) => {
      if (useStore.getState().selectionMode) {
        e.preventDefault();
        return;
      }
      const target = e.target as HTMLElement;
      if (target.closest('input,textarea,[data-state-control]')) return;
      e.preventDefault();
      const wrapper = target.closest<HTMLElement>('[data-item-id]');
      if (wrapper?.dataset.itemType === 'task') {
        const s = useStore.getState(),
          id = wrapper.dataset.itemId!;
        if (!s.selection.includes(id)) s.select([id]);
        const ids = useStore
          .getState()
          .selection.filter((key) => s.doc.items[key]?.type === 'task');
        onContext(
          worldPoint(canvas, panelId, e.clientX, e.clientY),
          { x: e.clientX, y: e.clientY },
          ids,
        );
        return;
      }
      if (
        wrapper &&
        (wrapper.dataset.itemType !== 'area' ||
          target.closest('[data-area-header]'))
      )
        return;
      onContext(worldPoint(canvas, panelId, e.clientX, e.clientY), {
        x: e.clientX,
        y: e.clientY,
      });
    };
    canvas.addEventListener('pointerdown', down);
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', up);
    window.addEventListener('blur', cancel);
    canvas.addEventListener('click', click, true);
    canvas.addEventListener('wheel', wheel, { passive: false });
    canvas.addEventListener('dblclick', doubleClick);
    canvas.addEventListener('gesturestart', safariGesture);
    canvas.addEventListener('touchmove', touchMove, { passive: false });
    canvas.addEventListener('contextmenu', context);
    return () => {
      canvas.removeEventListener('pointerdown', down);
      window.removeEventListener('pointermove', move);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', up);
      window.removeEventListener('blur', cancel);
      canvas.removeEventListener('click', click, true);
      canvas.removeEventListener('wheel', wheel);
      canvas.removeEventListener('dblclick', doubleClick);
      canvas.removeEventListener('gesturestart', safariGesture);
      canvas.removeEventListener('touchmove', touchMove);
      canvas.removeEventListener('contextmenu', context);
    };
  }, [ref, panelId, onBox, onContext, onGuides]);
}
