import {
  useEffect,
  useRef,
  type PointerEvent as ReactPointerEvent,
} from 'react';
import { useStore } from '../model/store';
import { visibleCanvas } from '../canvas/visibleCanvas';

export function useTouchReorder(options: {
  rows: () => HTMLElement[];
  attribute: string;
  drop: (from: string, to: string, after: boolean) => void;
  panelId?: string;
}) {
  const latest = useRef(options);
  latest.current = options;
  const finish = useRef<() => void>(() => {});
  useEffect(() => () => finish.current(), []);
  return (event: ReactPointerEvent<HTMLElement>, id: string) => {
    if (event.pointerType !== 'touch' || useStore.getState().selectionMode)
      return;
    finish.current();
    const grip = event.currentTarget,
      pointerId = event.pointerId;
    const source = latest.current
      .rows()
      .find((row) => row.getAttribute(latest.current.attribute) === id);
    if (!source) return;
    const start = { x: event.clientX, y: event.clientY },
      rect = source.getBoundingClientRect();
    const scale = rect.width / Math.max(1, source.offsetWidth);
    let point = start,
      moved = false,
      frame = 0,
      lastTime = 0;
    let ghost: HTMLElement | undefined,
      line: HTMLElement | undefined,
      destination: { id: string; after: boolean } | undefined;
    const target = () => {
      let row = document
        .elementFromPoint(point.x, point.y)
        ?.closest<HTMLElement>(`[${latest.current.attribute}]`);
      const rows = latest.current.rows();
      if (!row || !rows.includes(row)) {
        row = rows
          .filter((candidate) => {
            const r = candidate.getBoundingClientRect();
            return (
              candidate !== source &&
              point.x >= r.left &&
              point.x <= r.right &&
              r.bottom >= 0 &&
              r.top <= window.innerHeight
            );
          })
          .sort((a, b) => {
            const distance = (el: HTMLElement) => {
              const r = el.getBoundingClientRect();
              return Math.max(r.top - point.y, point.y - r.bottom, 0);
            };
            return distance(a) - distance(b);
          })[0];
      }
      if (!row || row === source || !latest.current.rows().includes(row)) {
        destination = undefined;
        if (line) line.hidden = true;
        return;
      }
      const bounds = row.getBoundingClientRect(),
        after = point.y >= bounds.top + bounds.height / 2;
      destination = { id: row.getAttribute(latest.current.attribute)!, after };
      if (line) {
        line.hidden = false;
        Object.assign(line.style, {
          left: `${bounds.left}px`,
          top: `${after ? bounds.bottom : bounds.top}px`,
          width: `${bounds.width}px`,
        });
      }
    };
    const animate = (time: number) => {
      if (!moved) return;
      const canvas = latest.current.panelId
        ? document.querySelector<HTMLElement>('.canvas')
        : null;
      const bounds = canvas?.getBoundingClientRect(),
        size = canvas ? visibleCanvas(canvas) : null;
      const top = bounds && size ? bounds.top + size.y : 0;
      const bottom =
        bounds && size ? bounds.top + size.y + size.h : window.innerHeight;
      const direction =
        point.y < top + 60
          ? -Math.min(1, (top + 60 - point.y) / 60)
          : point.y > bottom - 60
            ? Math.min(1, (point.y - bottom + 60) / 60)
            : 0;
      const amount =
        direction * Math.min(32, lastTime ? time - lastTime : 16) * 0.6;
      lastTime = time;
      if (amount && latest.current.panelId) {
        const s = useStore.getState(),
          view = s.doc.panels[latest.current.panelId]?.viewport;
        if (view)
          s.setViewport(latest.current.panelId, {
            ...view,
            y: view.y - amount,
          });
      } else if (amount) window.scrollBy(0, amount);
      target();
      frame = requestAnimationFrame(animate);
    };
    const move = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      point = { x: e.clientX, y: e.clientY };
      if (!moved && Math.hypot(point.x - start.x, point.y - start.y) < 8)
        return;
      if (!moved) {
        moved = true;
        ghost = source.cloneNode(true) as HTMLElement;
        ghost.removeAttribute(latest.current.attribute);
        ghost.removeAttribute('id');
        for (const child of ghost.querySelectorAll(
          '[id], [data-item-id], [data-panel-id], [data-subtask-id]',
        )) {
          child.removeAttribute('id');
          child.removeAttribute('data-item-id');
          child.removeAttribute('data-panel-id');
          child.removeAttribute('data-subtask-id');
        }
        ghost.classList.add('touchDragGhost');
        ghost.setAttribute('aria-hidden', 'true');
        ghost.inert = true;
        Object.assign(ghost.style, {
          position: 'fixed',
          width: `${rect.width / scale}px`,
          height: `${rect.height / scale}px`,
          transformOrigin: 'top left',
          margin: '0',
          left: `${rect.left}px`,
          top: `${rect.top}px`,
        });
        line = document.createElement('div');
        line.className = 'reorderInsertion';
        line.setAttribute('aria-hidden', 'true');
        document.body.append(ghost, line);
        source.classList.add('reorderSource');
        frame = requestAnimationFrame(animate);
      }
      if (ghost)
        ghost.style.transform = `translate(${point.x - start.x}px, ${point.y - start.y}px) scale(${scale})`;
      target();
    };
    const stop = () => {
      cancelAnimationFrame(frame);
      ghost?.remove();
      line?.remove();
      source.classList.remove('reorderSource');
      window.removeEventListener('pointermove', move);
      window.removeEventListener('touchmove', preventScroll);
      window.removeEventListener('pointerup', up);
      window.removeEventListener('pointercancel', cancel);
      window.removeEventListener('pointerdown', second, true);
      window.removeEventListener('blur', stop);
      grip.removeEventListener('lostpointercapture', stop);
      finish.current = () => {};
    };
    const up = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) return;
      point = { x: e.clientX, y: e.clientY };
      target();
      const drop = moved ? destination : undefined;
      stop();
      // Let the browser finish the touch release before moving its capture target.
      if (drop)
        requestAnimationFrame(() =>
          latest.current.drop(id, drop.id, drop.after),
        );
    };
    const cancel = (e: PointerEvent) => {
      if (e.pointerId === pointerId) stop();
    };
    const second = (e: PointerEvent) => {
      if (e.pointerId !== pointerId) stop();
    };
    // Reordering owns this touch; native fling scrolling can otherwise consume the next tap.
    const preventScroll = (e: TouchEvent) => {
      if (e.touches.length === 1) e.preventDefault();
    };
    finish.current = stop;
    window.addEventListener('pointermove', move, { passive: false });
    window.addEventListener('touchmove', preventScroll, { passive: false });
    window.addEventListener('pointerup', up);
    window.addEventListener('pointercancel', cancel);
    window.addEventListener('pointerdown', second, true);
    window.addEventListener('blur', stop);
    grip.addEventListener('lostpointercapture', stop);
  };
}
