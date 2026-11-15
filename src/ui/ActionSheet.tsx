import { useEffect, useRef, type ReactNode } from 'react';
import { createPortal } from 'react-dom';

export function ActionSheet({
  title,
  close,
  children,
}: {
  title: string;
  close: () => void;
  children: ReactNode;
}) {
  const dialog = useRef<HTMLDivElement>(null);
  const onClose = useRef(close);
  onClose.current = close;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    dialog.current?.querySelector<HTMLButtonElement>('button')?.focus();
    const key = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopImmediatePropagation();
        onClose.current();
      }
      if (event.key !== 'Tab') return;
      const buttons = [
        ...(dialog.current?.querySelectorAll<HTMLElement>(
          'button:not(:disabled),input,select',
        ) ?? []),
      ];
      const first = buttons[0],
        last = buttons.at(-1);
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last?.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first?.focus();
      }
    };
    window.addEventListener('keydown', key, true);
    return () => {
      window.removeEventListener('keydown', key, true);
      if (previous?.isConnected) previous.focus({ preventScroll: true });
    };
  }, []);
  return createPortal(
    <div className="actionSheetLayer">
      <button
        className="sheetBackdrop"
        aria-label={`Close ${title.toLowerCase()}`}
        tabIndex={-1}
        onClick={close}
      />
      <div
        className="actionSheet"
        ref={dialog}
        role="dialog"
        aria-modal="true"
        aria-label={title}
      >
        <header>
          <h2>{title}</h2>
          <button onClick={close} aria-label="Close actions">
            Close
          </button>
        </header>
        {children}
      </div>
    </div>,
    document.body,
  );
}
