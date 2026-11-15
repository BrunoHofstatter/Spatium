import { useState } from 'react';
import { useStore } from '../model/store';
import { ActionSheet } from '../ui/ActionSheet';
import { TaskFontMenu } from './TaskFontMenu';
import { StatePicker } from './StatePicker';
export function deleteSelection() {
  useStore.getState().deleteItems(useStore.getState().selection);
}
export function SelectionToolbar({ areaId }: { areaId: string }) {
  const ids = useStore((s) => s.selection),
    mode = useStore((s) => s.selectionMode);
  const [menu, setMenu] = useState(false);
  if (!mode && !ids.length) return null;
  return (
    <div className="selectionToolbar" aria-label="Selection actions">
      <span role="status">{ids.length} selected</span>
      {mode ? (
        <button onClick={() => useStore.getState().setSelectionMode(false)}>
          Finish selection
        </button>
      ) : (
        <>
          <button onClick={() => setMenu(true)}>Actions</button>
          <button
            onClick={() => {
              useStore.getState().select([]);
              useStore.getState().setSelectionMode(false);
            }}
          >
            Clear
          </button>
        </>
      )}
      {menu && (
        <TaskActions
          key={ids.join(':')}
          ids={ids}
          close={() => setMenu(false)}
          areaId={areaId}
        />
      )}
    </div>
  );
}
export function TaskActions({
  ids,
  close,
  onAdd,
  areaId,
}: {
  ids: string[];
  close: () => void;
  onAdd?: () => void;
  areaId?: string;
}) {
  const doc = useStore((s) => s.doc),
    [view, setView] = useState<'actions' | 'size' | 'move'>('actions');
  const tasks = ids
    .map((id) => doc.items[id])
    .filter((i) => i?.type === 'task');
  if (!tasks.length) return null;
  const first = tasks[0],
    one = tasks.length === 1 ? first : null;
  return (
    <ActionSheet
      title={
        view === 'size'
          ? 'Title size'
          : view === 'move'
            ? 'Move to area'
            : `${tasks.length === 1 ? 'Task' : `${tasks.length} tasks`} actions`
      }
      close={close}
    >
      {view === 'size' ? (
        <TaskFontMenu ids={ids} close={close} />
      ) : view === 'move' ? (
        <div className="sheetActions">
          {Object.values(doc.items)
            .filter(
              (i) =>
                i.type === 'area' &&
                i.panelId === first.panelId &&
                i.id !== (areaId ?? first.parentId),
            )
            .map((area) => (
              <button
                key={area.id}
                onClick={() => {
                  useStore.getState().moveTasks(ids, area.id);
                  useStore.getState().select([]);
                  close();
                }}
              >
                {area.title}
              </button>
            ))}
        </div>
      ) : (
        <div className="sheetActions">
          <StatePicker
            labelled
            state={first.state}
            onChange={(state) => {
              useStore.getState().transact((d) => {
                for (const id of ids) {
                  const t = d.items[id];
                  if (t?.type === 'task') {
                    t.state = state;
                    t.updatedAt = Date.now();
                  }
                }
              });
            }}
          />
          {one && (
            <button
              onClick={() => {
                useStore.getState().updateItem(one.id, { collapsed: false });
                useStore.getState().setEditing(one.id);
                close();
              }}
            >
              Edit title
            </button>
          )}
          {one && (
            <button
              aria-pressed={one.important}
              onClick={() =>
                useStore
                  .getState()
                  .updateItem(one.id, { important: !one.important })
              }
            >
              ★ Important
            </button>
          )}
          {one && (
            <button
              onClick={() => {
                if (onAdd) onAdd();
                else {
                  const id = useStore.getState().addSubtask(one.id);
                  useStore.getState().setEditing(id);
                }
                close();
              }}
            >
              Add subtask
            </button>
          )}
          <button onClick={() => setView('size')}>Title size</button>
          <button onClick={() => setView('move')}>Move to…</button>
          <button
            onClick={() => {
              useStore.getState().select(ids);
              useStore.getState().setSelectionMode(true);
              close();
            }}
          >
            Select more
          </button>
          <button
            className="danger"
            onClick={() => {
              useStore.getState().deleteItems(ids);
              close();
            }}
          >
            Delete tasks
          </button>
        </div>
      )}
    </ActionSheet>
  );
}
