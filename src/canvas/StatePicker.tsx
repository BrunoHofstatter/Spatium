import { useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { useStore } from '../model/store';
import { STATES, STATE_LABELS, type TaskState } from '../model/types';
import { StateClickPattern } from '../model/clickPattern';
export function StatePicker({
  state,
  onChange,
  label = 'Task state',
  interaction = false,
  labelled = false,
}: {
  state: TaskState;
  onChange: (state: TaskState) => void;
  label?: string;
  interaction?: boolean;
  labelled?: boolean;
}) {
  const [position, setPosition] = useState<{ x: number; y: number } | null>(
    null,
  );
  const button = useRef<HTMLButtonElement>(null);
  const popover = useRef<HTMLDivElement>(null);
  const colors = useStore((s) => s.doc.settings.stateColors);
  const mode = useStore((s) => s.doc.settings.stateControl);
  const coarse = window.matchMedia('(pointer: coarse)').matches;
  const callback = useRef(onChange);
  callback.current = onChange;
  const pointer = useRef('mouse');
  const pattern = useRef<StateClickPattern | null>(null);
  if (!pattern.current)
    pattern.current = new StateClickPattern((state) => callback.current(state));
  useEffect(() => () => pattern.current?.flush(), [mode]);
  const [choicesOpen, setChoicesOpen] = useState(false);
  useEffect(() => {
    if (!position) return;
    const close = (e: PointerEvent) => {
      if (
        !popover.current?.contains(e.target as Node) &&
        !button.current?.contains(e.target as Node)
      )
        setPosition(null);
    };
    const key = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setPosition(null);
    };
    window.addEventListener('pointerdown', close);
    window.addEventListener('keydown', key);
    return () => {
      window.removeEventListener('pointerdown', close);
      window.removeEventListener('keydown', key);
    };
  }, [position]);
  return (
    <span className="stateControl" data-state-control>
      <button
        ref={button}
        className={labelled ? 'stateButton' : 'stateDot'}
        aria-label={`${label}: ${STATE_LABELS[state]}`}
        aria-expanded={!!position}
        style={labelled ? undefined : { backgroundColor: colors[state] }}
        title={
          interaction && mode === 'clickPattern' && !coarse
            ? 'Left: Done · Double left: In Progress · Right: Blank · Double right: Delayed'
            : 'Choose state'
        }
        onPointerDown={(e) => {
          pointer.current = e.pointerType;
        }}
        onPointerUp={(e) => {
          if (
            interaction &&
            !coarse &&
            mode === 'clickPattern' &&
            e.pointerType === 'mouse' &&
            (e.button === 0 || e.button === 2)
          )
            pattern.current?.click(e.button);
        }}
        onContextMenu={(e) => {
          e.preventDefault();
          e.stopPropagation();
        }}
        onClick={(e) => {
          if (
            interaction &&
            !coarse &&
            pointer.current !== 'touch' &&
            e.detail !== 0
          ) {
            if (mode === 'choices') setChoicesOpen(!choicesOpen);
            return;
          }
          pattern.current?.dispose();
          const r = button.current!.getBoundingClientRect();
          setPosition(
            position
              ? null
              : {
                  x: Math.max(8, Math.min(r.left, window.innerWidth - 184)),
                  y: Math.max(
                    8,
                    Math.min(r.bottom + 8, window.innerHeight - 196),
                  ),
                },
          );
        }}
      >
        {labelled && (
          <>
            <i style={{ backgroundColor: colors[state] }} />
            State
          </>
        )}
      </button>
      {interaction && mode === 'choices' && !coarse && (
        <span
          className={`stateChoices ${choicesOpen ? 'choicesOpen' : ''}`}
          role="group"
          aria-label={`${label} choices`}
        >
          {STATES.map((s) => (
            <button
              key={s}
              aria-label={`Set ${label.toLowerCase()} to ${STATE_LABELS[s]}`}
              aria-pressed={s === state}
              title={STATE_LABELS[s]}
              style={{ '--choice-color': colors[s] } as React.CSSProperties}
              onClick={() => {
                onChange(s);
                setChoicesOpen(false);
              }}
            >
              <span />
            </button>
          ))}
        </span>
      )}
      {position &&
        createPortal(
          <div
            ref={popover}
            className="stateMenu"
            role="group"
            aria-label="Choose state"
            style={{ left: position.x, top: position.y }}
          >
            {STATES.map((s) => (
              <button
                key={s}
                onClick={() => {
                  onChange(s);
                  setPosition(null);
                  button.current?.focus();
                }}
                aria-pressed={s === state}
              >
                <span style={{ backgroundColor: colors[s] }} />
                {STATE_LABELS[s]}
                {s === state && <b>✓</b>}
              </button>
            ))}
          </div>,
          document.body,
        )}
    </span>
  );
}
