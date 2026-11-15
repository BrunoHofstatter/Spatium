export function FontSizeControl({
  value,
  onChange,
  label,
  min = 12,
  max = 32,
  autoFocus = false,
  onBlur,
  onEnter,
  onStep,
}: {
  value: string;
  onChange: (value: string) => void;
  label: string;
  min?: number;
  max?: number;
  autoFocus?: boolean;
  onBlur?: () => void;
  onEnter?: () => void;
  onStep?: (value: string) => void;
}) {
  const step = (delta: number) => {
    const next = String(
      Math.max(min, Math.min(max, (Number(value) || 16) + delta)),
    );
    onChange(next);
    onStep?.(next);
  };
  return (
    <span className="fontSizeControl">
      <button
        type="button"
        aria-label={`Decrease ${label.toLowerCase()}`}
        disabled={!!value && Number(value) <= min}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => step(-1)}
      >
        −
      </button>
      <input
        type="number"
        inputMode="numeric"
        aria-label={label}
        placeholder="Mixed"
        min={min}
        max={max}
        value={value}
        autoFocus={autoFocus}
        onChange={(e) => onChange(e.target.value)}
        onBlur={onBlur}
        onKeyDown={(e) => {
          if (e.key === 'Enter') onEnter?.();
        }}
      />
      <button
        type="button"
        aria-label={`Increase ${label.toLowerCase()}`}
        disabled={!!value && Number(value) >= max}
        onPointerDown={(e) => e.preventDefault()}
        onClick={() => step(1)}
      >
        +
      </button>
    </span>
  );
}
