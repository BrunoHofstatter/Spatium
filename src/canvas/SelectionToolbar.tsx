import { useState } from 'react';
import { ColorInput } from '../settings/ColorInput';
import { useStore } from '../model/store';
import {
  itemBounds,
  descendants,
  MIN_AREA_FONT,
  MAX_AREA_FONT,
} from '../model/geometry';
import { focusArea, focusTask, revealItem } from './focusArea';
import { StatePicker } from './StatePicker';
import { TaskFontMenu } from './TaskFontMenu';
import { useMobile } from '../ui/useMobile';
import { ActionSheet } from '../ui/ActionSheet';
import { FontSizeControl } from '../ui/FontSizeControl';

export function deleteSelection() {
  const s = useStore.getState(),
    ids = s.selection;
  if (
    ids.some(
      (id) =>
        s.doc.items[id]?.type === 'area' && descendants(s.doc.items, id).length,
    ) &&
    !window.confirm(
      'Delete this area and everything inside? You can undo this.',
    )
  )
    return;
  s.deleteItems(ids);
}
export function SelectionToolbar() {
  const ids = useStore((s) => s.selection);
  return <SelectionActions key={ids.join(':')} />;
}
function SelectionActions() {
  const ids = useStore((s) => s.selection),
    items = useStore((s) => s.doc.items),
    panels = useStore((s) => s.doc.panels);
  const selectionMode = useStore((s) => s.selectionMode);
  const mobile = useMobile();
  const [sheet, setSheet] = useState<'more' | 'size' | null>(null);
  const selected = ids.map((id) => items[id]).filter(Boolean);
  const item = selected.length === 1 ? selected[0] : null;
  const allTasks =
    selected.length > 0 && selected.every((i) => i.type === 'task');
  if (selectionMode)
    return (
      <div
        className="selectionToolbar selectionModeBar"
        aria-label="Selection actions"
      >
        <span role="status">{selected.length} selected</span>
        <span className="selectInstructions">Tap items to select</span>
        <button onClick={() => useStore.getState().setSelectionMode(false)}>
          Finish selection
        </button>
      </div>
    );
  if (!selected.length) return null;
  const first = selected[0],
    view = panels[first.panelId].viewport;
  const point = itemBounds(useStore.getState().doc, first, view.zoom);
  const canvasTop =
    document.querySelector('.canvas')?.getBoundingClientRect().top ?? 64;
  const secondary = (
    <>
      {item?.type === 'task' && (
        <>
          <button
            className={item.important ? 'starOn' : ''}
            aria-label="Toggle Important"
            aria-pressed={item.important}
            onClick={() =>
              useStore
                .getState()
                .updateItem(item.id, { important: !item.important })
            }
          >
            {mobile ? '★ Important' : '★'}
          </button>
          <button
            onClick={() =>
              useStore.getState().updateItem(item.id, {
                collapsed: false,
                subtasksExpanded: item.collapsed || !item.subtasksExpanded,
              })
            }
          >
            Subtasks
          </button>
          {mobile && (
            <button
              onClick={() => {
                setSheet(null);
                focusTask(item.id);
              }}
            >
              Focus task
            </button>
          )}
        </>
      )}
      {item?.type === 'area' && (
        <>
          <label className="areaColor">
            <span>Color</span>
            <ColorInput
              label="Area accent color"
              value={item.color ?? '#8c92a4'}
              onChange={(color) =>
                useStore.getState().updateItem(item.id, { color })
              }
            />
          </label>
          <button
            title="Remove accent color"
            onClick={() =>
              useStore.getState().updateItem(item.id, { color: null })
            }
          >
            Reset color
          </button>
        </>
      )}
      {mobile && (allTasks || item?.type === 'area') && (
        <button onClick={() => setSheet('size')}>Title size</button>
      )}
      {mobile && (
        <button
          onClick={() => {
            setSheet(null);
            useStore.getState().setSelectionMode(true);
          }}
        >
          Select more
        </button>
      )}
      <button
        className="danger"
        onClick={() => {
          setSheet(null);
          deleteSelection();
        }}
        aria-label="Delete selection"
      >
        Delete
      </button>
    </>
  );
  return (
    <>
      <div
        className={`selectionToolbar ${mobile ? 'touchToolbar' : ''}`}
        aria-label="Selection actions"
        style={{
          left: Math.max(
            220,
            Math.min(
              window.innerWidth - 220,
              view.x + (point.x + first.w / 2) * view.zoom,
            ),
          ),
          top: Math.max(
            canvasTop + 8,
            view.y + point.y * view.zoom + canvasTop - 56,
          ),
          bottom: 'auto',
        }}
      >
        <span className="selectionLabel">
          {item ? item.type : `${selected.length} selected`}
        </span>
        {allTasks && (
          <StatePicker
            labelled={mobile}
            state={first.type === 'task' ? first.state : 'blank'}
            onChange={(state) =>
              useStore.getState().transact((doc) => {
                for (const i of selected) {
                  const t = doc.items[i.id];
                  if (t.type === 'task') {
                    t.state = state;
                    t.updatedAt = Date.now();
                  }
                }
              })
            }
          />
        )}
        {item && (
          <button onClick={() => useStore.getState().setEditing(item.id)}>
            Edit
          </button>
        )}
        {item?.type === 'area' && (
          <button onClick={() => focusArea(item.id)}>Focus</button>
        )}
        {item && item.type !== 'note' && (
          <button
            onClick={() => {
              useStore
                .getState()
                .updateItem(item.id, { collapsed: !item.collapsed });
              if (mobile && item.collapsed)
                requestAnimationFrame(() => revealItem(item.id));
            }}
          >
            {item.collapsed ? 'Expand' : 'Collapse'}
          </button>
        )}
        {mobile ? (
          <button aria-expanded={!!sheet} onClick={() => setSheet('more')}>
            More
          </button>
        ) : (
          secondary
        )}
      </div>
      {mobile && sheet && (
        <ActionSheet
          title={
            sheet === 'size'
              ? 'Title size'
              : item
                ? `${item.type[0].toUpperCase()}${item.type.slice(1)} actions`
                : `${selected.length} selected`
          }
          close={() => setSheet(null)}
        >
          {sheet === 'more' ? (
            <div className="sheetActions">{secondary}</div>
          ) : allTasks ? (
            <TaskFontMenu ids={ids} close={() => setSheet(null)} />
          ) : item?.type === 'area' ? (
            <AreaTitleSize
              id={item.id}
              size={item.fontSize}
              close={() => setSheet(null)}
            />
          ) : null}
        </ActionSheet>
      )}
    </>
  );
}
function AreaTitleSize({
  id,
  size,
  close,
}: {
  id: string;
  size: number;
  close: () => void;
}) {
  const [value, setValue] = useState(String(size));
  const apply = () => {
    if (!value || !Number.isFinite(Number(value))) return;
    useStore.getState().updateItem(id, { fontSize: Number(value) });
    close();
  };
  return (
    <div className="taskFontMenu">
      <label>
        Area title size
        <FontSizeControl
          label="Area title size"
          min={MIN_AREA_FONT}
          max={MAX_AREA_FONT}
          value={value}
          onChange={setValue}
          onEnter={apply}
        />
      </label>
      <button
        disabled={!value || !Number.isFinite(Number(value))}
        onClick={apply}
      >
        Apply
      </button>
    </div>
  );
}
