import { useEffect, useRef, useState } from 'react';
import { useStore } from '../model/store';
export function Editable({
  value,
  onCommit,
  label,
  multiline = false,
  editing = false,
  onFinish,
  placeholder,
  className = '',
  onEnter,
  onLiveChange,
  onEditStart,
  onEditEnd,
}: {
  value: string;
  onCommit: (value: string) => void;
  label: string;
  multiline?: boolean;
  editing?: boolean;
  onFinish?: () => void;
  placeholder?: string;
  className?: string;
  onEnter?: () => void;
  onLiveChange?: (value: string) => void;
  onEditStart?: () => void;
  onEditEnd?: () => void;
}) {
  const [active, setActive] = useState(editing);
  const [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null);
  const selectedBeforeTap = useRef(false);
  const sessions = useRef({ onEditStart, onEditEnd });
  sessions.current = { onEditStart, onEditEnd };
  useEffect(() => {
    if (!active) return;
    sessions.current.onEditStart?.();
    return () => sessions.current.onEditEnd?.();
  }, [active]);
  useEffect(() => {
    if (editing) {
      setActive(true);
      setDraft(value);
    }
  }, [editing, value]);
  useEffect(() => {
    if (active) {
      input.current?.focus();
      if (!multiline) input.current?.select();
    }
  }, [active, multiline]);
  const finish = () => {
    if (draft !== value) onCommit(draft);
    sessions.current.onEditEnd?.();
    setActive(false);
    onFinish?.();
  };
  if (!active)
    return (
      <div
        className={`editable ${className} ${!value ? 'placeholder' : ''}`}
        onPointerDownCapture={(e) => {
          const id =
            e.currentTarget.closest<HTMLElement>('[data-item-id]')?.dataset
              .itemId;
          selectedBeforeTap.current =
            !id || useStore.getState().selection.includes(id);
        }}
        onDoubleClick={(e) => {
          e.stopPropagation();
          if (
            window.matchMedia('(pointer: coarse)').matches ||
            useStore.getState().selectionMode
          )
            return;
          setDraft(value);
          setActive(true);
        }}
        onClick={(e) => {
          const s = useStore.getState();
          if (s.selectionMode) return;
          const touch = window.matchMedia('(pointer: coarse)').matches;
          const id =
            e.currentTarget.closest<HTMLElement>('[data-item-id]')?.dataset
              .itemId;
          if (touch && id && !selectedBeforeTap.current) {
            s.select([id]);
            return;
          }
          if (touch || label === 'Description') {
            setDraft(value);
            setActive(true);
          }
        }}
        title={
          window.matchMedia('(pointer: coarse)').matches
            ? `Select, then tap to edit ${label.toLowerCase()}`
            : `Double-click to edit ${label.toLowerCase()}`
        }
      >
        {value || placeholder || label}
      </div>
    );
  const props = {
    ref: input,
    value: draft,
    'aria-label': label,
    className: `textEditor ${className}`,
    onChange: (
      e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>,
    ) => {
      setDraft(e.target.value);
      onLiveChange?.(e.target.value);
    },
    onBlur: finish,
    onKeyDown: (e: React.KeyboardEvent) => {
      e.stopPropagation();
      if (e.key === 'Escape') {
        input.current?.blur();
      }
      if (e.key === 'Enter' && !multiline && !e.nativeEvent.isComposing) {
        input.current?.blur();
        onEnter?.();
      }
    },
  };
  return multiline ? <textarea {...props} rows={5} /> : <input {...props} />;
}
