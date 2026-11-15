import { useState } from 'react';
import { useStore } from '../model/store';
import { FontSizeControl } from '../ui/FontSizeControl';
export function TaskFontMenu({
  ids,
  close,
}: {
  ids: string[];
  close: () => void;
}) {
  const doc = useStore((s) => s.doc);
  const sizes = ids
    .map((id) => doc.items[id])
    .filter((i) => i?.type === 'task')
    .map((i) => i.titleFontSize ?? doc.settings.taskTitleSize);
  const [value, setValue] = useState(
    sizes.every((s) => s === sizes[0]) ? String(sizes[0]) : '',
  );
  const apply = () => {
    const size = Number(value);
    if (!value || !Number.isFinite(size)) return;
    useStore.getState().setTaskFonts(ids, size);
    close();
  };
  return (
    <div className="taskFontMenu" data-no-gesture>
      <label>
        Task title size
        <FontSizeControl
          autoFocus={!window.matchMedia('(pointer: coarse)').matches}
          label="Selected task title size"
          value={value}
          onChange={setValue}
          onEnter={apply}
        />
      </label>
      <button
        onClick={apply}
        disabled={!value || !Number.isFinite(Number(value))}
      >
        Apply
      </button>
      <button
        onClick={() => {
          useStore.getState().setTaskFonts(ids, null);
          close();
        }}
      >
        Use default size
      </button>
    </div>
  );
}
