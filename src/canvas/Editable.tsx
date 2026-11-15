import { useEffect, useLayoutEffect, useRef, useState } from 'react';
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
  activation = 'click',
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
  activation?: 'click' | 'none';
}) {
  const [active, setActive] = useState(editing),
    [draft, setDraft] = useState(value);
  const input = useRef<HTMLInputElement & HTMLTextAreaElement>(null),
    session = useRef({ onEditStart, onEditEnd });
  session.current = { onEditStart, onEditEnd };
  useEffect(() => {
    if (active) {
      session.current.onEditStart?.();
      return () => session.current.onEditEnd?.();
    }
  }, [active]);
  useEffect(() => {
    if (editing) {
      setDraft(value);
      setActive(true);
    }
  }, [editing, value]);
  useEffect(() => {
    if (active) {
      input.current?.focus();
      if (!multiline) input.current?.select();
    }
  }, [active, multiline]);
  useLayoutEffect(() => {
    if (active && multiline && input.current) {
      input.current.style.height = '0px';
      input.current.style.height = `${input.current.scrollHeight}px`;
    }
  }, [active, multiline, draft]);
  const finish = () => {
    if (draft !== value) onCommit(draft);
    session.current.onEditEnd?.();
    setActive(false);
    onFinish?.();
  };
  if (!active)
    return (
      <div
        className={`editable ${className} ${!value ? 'placeholder' : ''}`}
        title={
          activation === 'none' ? undefined : `Edit ${label.toLowerCase()}`
        }
        onClick={(e) => {
          if (activation === 'none' || useStore.getState().selectionMode)
            return;
          e.stopPropagation();
          setDraft(value);
          setActive(true);
        }}
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
      if (
        e.key === 'Escape' ||
        (e.key === 'Enter' && !multiline && !e.nativeEvent.isComposing)
      ) {
        input.current?.blur();
        if (e.key === 'Enter') onEnter?.();
      }
    },
  };
  return multiline ? <textarea {...props} rows={1} /> : <input {...props} />;
}
