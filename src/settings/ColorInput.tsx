import { useEffect, useId } from 'react';
import { useStore } from '../model/store';
export function ColorInput({
  value,
  label,
  onChange,
}: {
  value: string;
  label: string;
  onChange: (color: string) => void;
}) {
  const key = useId();
  useEffect(() => () => useStore.getState().endHistoryGroup(key), [key]);
  return (
    <input
      type="color"
      aria-label={label}
      value={value}
      onFocus={() => useStore.getState().beginHistoryGroup(key)}
      onBlur={() => useStore.getState().endHistoryGroup(key)}
      onChange={(e) => onChange(e.target.value)}
    />
  );
}
