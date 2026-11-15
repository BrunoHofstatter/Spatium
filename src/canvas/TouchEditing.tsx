import { useEffect, useState } from 'react';
function caret(editor: HTMLInputElement | HTMLTextAreaElement) {
  const r = editor.getBoundingClientRect();
  if (!(editor instanceof HTMLTextAreaElement))
    return { top: r.top, bottom: r.bottom };
  const style = getComputedStyle(editor),
    mirror = document.createElement('div');
  Object.assign(mirror.style, {
    position: 'fixed',
    visibility: 'hidden',
    width: `${editor.clientWidth}px`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    font: style.font,
    lineHeight: style.lineHeight,
    padding: style.padding,
    boxSizing: 'border-box',
  });
  mirror.textContent = editor.value.slice(0, editor.selectionStart);
  const mark = document.createElement('span');
  mark.textContent = '\u200b';
  mirror.append(mark);
  document.body.append(mirror);
  const top = r.top + mark.offsetTop - editor.scrollTop;
  mirror.remove();
  return { top, bottom: top + (parseFloat(style.lineHeight) || 24) };
}
export function TouchEditing() {
  const [editor, setEditor] = useState<
    HTMLInputElement | HTMLTextAreaElement | null
  >(null);
  useEffect(() => {
    let frame = 0;
    const update = () => {
      frame = 0;
      const v = window.visualViewport;
      document.documentElement.style.setProperty(
        '--touch-visible-top',
        `${v?.offsetTop ?? 0}px`,
      );
      document.documentElement.style.setProperty(
        '--touch-visible-height',
        `${v?.height ?? innerHeight}px`,
      );
      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${Math.max(0, innerHeight - (v?.offsetTop ?? 0) - (v?.height ?? innerHeight))}px`,
      );
      const input = document.activeElement;
      if (
        !(
          input instanceof HTMLInputElement ||
          input instanceof HTMLTextAreaElement
        ) ||
        !input.classList.contains('textEditor')
      )
        return;
      const root = input.closest<HTMLElement>('.areaScroll');
      if (!root) return;
      const box = caret(input),
        rect = root.getBoundingClientRect(),
        top = Math.max(rect.top, v?.offsetTop ?? 0) + 12,
        bottom =
          Math.min(
            rect.bottom,
            (v?.offsetTop ?? 0) + (v?.height ?? innerHeight),
          ) - 76;
      if (box.bottom > bottom) root.scrollTop += box.bottom - bottom;
      else if (box.top < top) root.scrollTop -= top - box.top;
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const focus = () => {
      const el = document.activeElement;
      setEditor(
        window.matchMedia('(pointer: coarse)').matches &&
          el instanceof HTMLElement &&
          el.matches('.textEditor')
          ? (el as HTMLInputElement | HTMLTextAreaElement)
          : null,
      );
      schedule();
    };
    const blur = () => queueMicrotask(focus);
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    document.addEventListener('input', schedule);
    document.addEventListener('selectionchange', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    window.addEventListener('resize', schedule);
    focus();
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
      document.removeEventListener('input', schedule);
      document.removeEventListener('selectionchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      window.removeEventListener('resize', schedule);
    };
  }, []);
  useEffect(() => {
    if (editor) document.documentElement.dataset.touchEditing = 'true';
    else delete document.documentElement.dataset.touchEditing;
    return () => {
      delete document.documentElement.dataset.touchEditing;
    };
  }, [editor]);
  return editor ? (
    <button
      className="editingDone"
      onPointerDown={(e) => e.preventDefault()}
      onClick={() => editor.blur()}
    >
      Done editing
    </button>
  ) : null;
}
