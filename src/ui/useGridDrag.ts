import { useEffect, useRef, type RefObject } from 'react';
import { useStore } from '../model/store';
export function useGridDrag(
  ref: RefObject<HTMLElement | null>,
  kind: 'area' | 'task',
  drop: (id: string, column: string, before?: string) => void,
) {
  const callback = useRef(drop);
  callback.current = drop;
  useEffect(() => {
    const root = ref.current;
    if (!root) return;
    let clear = () => {},
      suppressed = false;
    const down = (e: PointerEvent) => {
      if (e.button !== 0 || useStore.getState().selectionMode) return;
      suppressed = false;
      const target = e.target as HTMLElement;
      if (target.closest('button,input,textarea,select,a,[data-no-drag]'))
        return;
      const source = target.closest<HTMLElement>(`[data-grid-${kind}]`);
      if (!source || !root.contains(source)) return;
      clear();
      const id = source.dataset.gridArea ?? source.dataset.gridTask!;
      const start = { x: e.clientX, y: e.clientY };
      let point = start,
        active = false,
        moved = false,
        frame = 0,
        last = 0;
      let destination: { column: string; before?: string } | undefined,
        ghost: HTMLElement | undefined,
        line: HTMLElement | undefined;
      const locate = () => {
        const zone = [
          ...root.querySelectorAll<HTMLElement>('[data-drop-column]'),
        ].find((el) => {
          const r = el.getBoundingClientRect();
          return point.x >= r.left && point.x <= r.right;
        });
        if (!zone) {
          destination = undefined;
          if (line) line.hidden = true;
          return;
        }
        const rows = [
          ...zone.querySelectorAll<HTMLElement>(`[data-grid-${kind}]`),
        ].filter((el) => el !== source);
        const before = rows.find(
          (el) =>
            point.y <
            el.getBoundingClientRect().top +
              el.getBoundingClientRect().height / 2,
        );
        destination = {
          column: zone.dataset.dropColumn!,
          before: before?.dataset.gridArea ?? before?.dataset.gridTask,
        };
        const zr = zone.getBoundingClientRect(),
          lastRow = rows.at(-1)?.getBoundingClientRect();
        if (line) {
          line.hidden = false;
          Object.assign(line.style, {
            left: `${zr.left}px`,
            width: `${zr.width}px`,
            top: `${before?.getBoundingClientRect().top ?? (lastRow ? lastRow.bottom + 8 : zr.top + 32)}px`,
          });
        }
      };
      const animate = (time: number) => {
        if (!active) return;
        const r = root.getBoundingClientRect(),
          dt = Math.min(32, last ? time - last : 16);
        last = time;
        const speed = (v: number, min: number, max: number) =>
          v < min + 48
            ? -Math.min(1, (min + 48 - v) / 48)
            : v > max - 48
              ? Math.min(1, (v - max + 48) / 48)
              : 0;
        root.scrollBy(
          kind === 'area' ? speed(point.x, r.left, r.right) * dt * 0.65 : 0,
          speed(point.y, r.top, r.bottom) * dt * 0.65,
        );
        locate();
        frame = requestAnimationFrame(animate);
      };
      const activate = () => {
        active = true;
        suppressed = true;
        root.classList.add('gridDragging');
        source.classList.add('reorderSource');
        ghost = document.createElement('div');
        ghost.className = 'gridDragGhost';
        const selected = useStore.getState().selection;
        ghost.textContent =
          kind === 'task' && selected.includes(id) && selected.length > 1
            ? `${selected.length} tasks`
            : (source.dataset.dragTitle ?? 'Moving');
        ghost.setAttribute('aria-hidden', 'true');
        line = document.createElement('div');
        line.className = 'reorderInsertion';
        line.setAttribute('aria-hidden', 'true');
        document.body.append(ghost, line);
        position();
        locate();
        frame = requestAnimationFrame(animate);
        try {
          root.setPointerCapture(e.pointerId);
        } catch {
          /* Contact may have ended during the hold. */
        }
      };
      const position = () => {
        if (ghost) {
          ghost.style.left = `${point.x + 12}px`;
          ghost.style.top = `${point.y + 12}px`;
        }
      };
      const timer =
        e.pointerType === 'touch' ? setTimeout(activate, 420) : undefined;
      const move = (event: PointerEvent) => {
        if (event.pointerId !== e.pointerId) return;
        point = { x: event.clientX, y: event.clientY };
        if (Math.hypot(point.x - start.x, point.y - start.y) > 8) {
          moved = true;
          if (!active) {
            if (e.pointerType === 'touch') {
              stop();
              return;
            }
            activate();
          }
        }
        if (active) {
          event.preventDefault();
          position();
          locate();
        }
      };
      const prevent = (event: TouchEvent) => {
        if (active) event.preventDefault();
      };
      const stop = () => {
        clearTimeout(timer);
        cancelAnimationFrame(frame);
        ghost?.remove();
        line?.remove();
        source.classList.remove('reorderSource');
        root.classList.remove('gridDragging');
        window.removeEventListener('pointermove', move);
        window.removeEventListener('pointerup', up);
        window.removeEventListener('pointercancel', cancel);
        window.removeEventListener('pointerdown', second, true);
        window.removeEventListener('touchmove', prevent);
        window.removeEventListener('blur', stop);
        clear = () => {};
      };
      const up = (event: PointerEvent) => {
        if (event.pointerId !== e.pointerId) return;
        const result = active && moved ? destination : undefined;
        stop();
        if (result)
          requestAnimationFrame(() =>
            callback.current(id, result.column, result.before),
          );
      };
      const cancel = (event: PointerEvent) => {
        if (event.pointerId === e.pointerId) stop();
      };
      const second = (event: PointerEvent) => {
        if (event.pointerId !== e.pointerId) stop();
      };
      clear = stop;
      window.addEventListener('pointermove', move, { passive: false });
      window.addEventListener('pointerup', up);
      window.addEventListener('pointercancel', cancel);
      window.addEventListener('pointerdown', second, true);
      window.addEventListener('touchmove', prevent, { passive: false });
      window.addEventListener('blur', stop);
    };
    const click = (e: MouseEvent) => {
      if (suppressed) {
        e.preventDefault();
        e.stopPropagation();
        suppressed = false;
      }
    };
    const context = (e: MouseEvent) => {
      if ((e.target as HTMLElement).closest(`[data-grid-${kind}]`))
        e.preventDefault();
    };
    root.addEventListener('pointerdown', down);
    root.addEventListener('click', click, true);
    root.addEventListener('contextmenu', context);
    return () => {
      clear();
      root.removeEventListener('pointerdown', down);
      root.removeEventListener('click', click, true);
      root.removeEventListener('contextmenu', context);
    };
  }, [ref, kind]);
}
