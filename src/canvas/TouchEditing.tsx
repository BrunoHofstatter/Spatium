import { useEffect, useState } from 'react';
import { useStore } from '../model/store';
import { zoomAt } from '../model/geometry';
import type { Viewport } from '../model/types';

function activeEditor() {
  return document.activeElement instanceof HTMLElement &&
    document.activeElement.matches('.textEditor')
    ? (document.activeElement as HTMLInputElement | HTMLTextAreaElement)
    : null;
}
function caretRect(editor: HTMLInputElement | HTMLTextAreaElement) {
  const rect = editor.getBoundingClientRect();
  if (!(editor instanceof HTMLTextAreaElement))
    return { x: rect.left, y: rect.top, h: rect.height };
  const style = getComputedStyle(editor),
    mirror = document.createElement('div');
  Object.assign(mirror.style, {
    position: 'fixed',
    visibility: 'hidden',
    left: '0',
    top: '0',
    width: `${editor.clientWidth}px`,
    whiteSpace: 'pre-wrap',
    overflowWrap: 'anywhere',
    boxSizing: 'border-box',
    font: style.font,
    lineHeight: style.lineHeight,
    letterSpacing: style.letterSpacing,
    padding: style.padding,
  });
  mirror.textContent = editor.value.slice(0, editor.selectionStart);
  const marker = document.createElement('span');
  marker.textContent = '\u200b';
  mirror.append(marker);
  document.body.append(mirror);
  const scale = rect.width / Math.max(1, editor.offsetWidth);
  const caret = {
    x: rect.left + (marker.offsetLeft - editor.scrollLeft) * scale,
    y: rect.top + (marker.offsetTop - editor.scrollTop) * scale,
    h: (parseFloat(style.lineHeight) || 24) * scale,
  };
  mirror.remove();
  return caret;
}
const equalView = (a: Viewport, b: Viewport) =>
  a.x === b.x && a.y === b.y && a.zoom === b.zoom;

export function TouchEditing() {
  const [editor, setEditor] = useState<
    HTMLInputElement | HTMLTextAreaElement | null
  >(null);
  useEffect(() => {
    const update = () => {
      const viewport = window.visualViewport;
      document.documentElement.style.setProperty(
        '--touch-visible-top',
        `${viewport?.offsetTop ?? 0}px`,
      );
      document.documentElement.style.setProperty(
        '--touch-visible-height',
        `${viewport?.height ?? window.innerHeight}px`,
      );
      document.documentElement.style.setProperty(
        '--keyboard-inset',
        `${Math.max(0, window.innerHeight - (viewport?.height ?? window.innerHeight) - (viewport?.offsetTop ?? 0))}px`,
      );
    };
    const focus = () => {
      if (window.matchMedia('(pointer: coarse)').matches)
        setEditor(activeEditor());
    };
    const blur = () => queueMicrotask(focus);
    update();
    focus();
    document.addEventListener('focusin', focus);
    document.addEventListener('focusout', blur);
    window.visualViewport?.addEventListener('resize', update);
    window.visualViewport?.addEventListener('scroll', update);
    window.addEventListener('resize', update);
    return () => {
      document.removeEventListener('focusin', focus);
      document.removeEventListener('focusout', blur);
      window.visualViewport?.removeEventListener('resize', update);
      window.visualViewport?.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);
  useEffect(() => {
    if (!editor) return;
    document.documentElement.dataset.touchEditing = 'true';
    const canvas = editor.closest<HTMLElement>('.canvas');
    const id = editor.closest<HTMLElement>('[data-item-id]')?.dataset.itemId;
    const panelId = id ? useStore.getState().doc.items[id]?.panelId : undefined;
    const initial = panelId
      ? useStore.getState().doc.panels[panelId]?.viewport
      : undefined;
    let automatic: Viewport | undefined,
      navigated = false,
      framed = false,
      frame = 0;
    const update = () => {
      frame = 0;
      if (
        !canvas ||
        !panelId ||
        !initial ||
        !editor.isConnected ||
        document.activeElement !== editor
      )
        return;
      const state = useStore.getState(),
        view = state.doc.panels[panelId]?.viewport;
      if (!view) return;
      if (!equalView(view, automatic ?? initial)) navigated = true;
      const bounds = canvas.getBoundingClientRect(),
        viewport = window.visualViewport;
      if (!framed) {
        framed = true;
        const rect = editor.getBoundingClientRect();
        const screenFont =
          (parseFloat(getComputedStyle(editor).fontSize) * rect.width) /
          Math.max(1, editor.offsetWidth);
        if (screenFont > 0 && screenFont < 16) {
          automatic = zoomAt(
            view,
            {
              x: rect.left + rect.width / 2 - bounds.left,
              y: rect.top - bounds.top,
            },
            Math.min(3, (view.zoom * 16) / screenFont),
          );
          state.setViewport(panelId, automatic);
          schedule();
          return;
        }
      }
      const caret = caretRect(editor);
      const top = Math.max(bounds.top, viewport?.offsetTop ?? 0) + 18;
      const bottom =
        Math.min(
          bounds.bottom,
          (viewport?.offsetTop ?? 0) + (viewport?.height ?? window.innerHeight),
        ) - 80;
      const left = Math.max(bounds.left, viewport?.offsetLeft ?? 0) + 16;
      const right =
        Math.min(
          bounds.right,
          (viewport?.offsetLeft ?? 0) + (viewport?.width ?? window.innerWidth),
        ) - 16;
      const dx =
        caret.x < left ? left - caret.x : caret.x > right ? right - caret.x : 0;
      const dy =
        caret.y < top
          ? top - caret.y
          : caret.y + caret.h > bottom
            ? bottom - caret.y - caret.h
            : 0;
      if (Math.abs(dx) > 1 || Math.abs(dy) > 1) {
        automatic = { ...view, x: view.x + dx, y: view.y + dy };
        state.setViewport(panelId, automatic);
      }
    };
    const schedule = () => {
      if (!frame) frame = requestAnimationFrame(update);
    };
    const interact = (event: PointerEvent) => {
      if (
        canvas?.contains(event.target as Node) &&
        !editor.contains(event.target as Node)
      )
        navigated = true;
    };
    schedule();
    document.addEventListener('pointerdown', interact, true);
    editor.addEventListener('input', schedule);
    document.addEventListener('selectionchange', schedule);
    window.visualViewport?.addEventListener('resize', schedule);
    window.visualViewport?.addEventListener('scroll', schedule);
    const unsubscribe = useStore.subscribe(schedule);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('pointerdown', interact, true);
      unsubscribe();
      editor.removeEventListener('input', schedule);
      document.removeEventListener('selectionchange', schedule);
      window.visualViewport?.removeEventListener('resize', schedule);
      window.visualViewport?.removeEventListener('scroll', schedule);
      delete document.documentElement.dataset.touchEditing;
      const state = useStore.getState(),
        current = panelId ? state.doc.panels[panelId]?.viewport : undefined;
      if (
        panelId &&
        initial &&
        automatic &&
        current &&
        !navigated &&
        equalView(current, automatic)
      )
        state.setViewport(panelId, initial);
    };
  }, [editor]);
  return editor ? (
    <button
      className="editingDone"
      onPointerDown={(event) => event.preventDefault()}
      onClick={() => editor.blur()}
    >
      Done editing
    </button>
  ) : null;
}
