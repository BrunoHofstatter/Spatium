export function visibleCanvas(canvas: HTMLElement) {
  const rect = canvas.getBoundingClientRect(),
    viewport = window.visualViewport;
  const left = Math.max(rect.left, viewport?.offsetLeft ?? 0);
  const top = Math.max(rect.top, viewport?.offsetTop ?? 0);
  const right = Math.min(
    rect.right,
    (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth),
  );
  let bottom = Math.min(
    rect.bottom,
    (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight),
  );
  const dock = document.querySelector<HTMLElement>('.selectionToolbar');
  if (dock && getComputedStyle(dock).display !== 'none') {
    const bar = dock.getBoundingClientRect();
    if (bar.width >= rect.width * 0.8 && bar.top > top)
      bottom = Math.min(bottom, bar.top - 12);
  }
  if (window.matchMedia('(pointer: coarse), (max-width: 600px)').matches) {
    const add = document.querySelector<HTMLElement>(
      '.createControls > .addButton',
    );
    if (add?.getClientRects().length)
      bottom = Math.min(bottom, add.getBoundingClientRect().top - 12);
  }
  return {
    x: left - rect.left,
    y: top - rect.top,
    w: Math.max(80, right - left),
    h: Math.max(80, bottom - top),
  };
}
