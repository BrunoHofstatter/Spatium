import { useState, type CSSProperties } from 'react';
import { useStore } from '../model/store';
import type { TaskItem } from '../model/types';
import { StatePicker } from './StatePicker';
import { Editable } from './Editable';
import { TaskActions } from './SelectionToolbar';
import { useTouchReorder } from '../ui/useTouchReorder';
export function TaskCard({ item }: { item: TaskItem }) {
  const settings = useStore((s) => s.doc.settings),
    mode = useStore((s) => s.selectionMode),
    selected = useStore((s) => s.selection.includes(item.id)),
    editingId = useStore((s) => s.editingId),
    highlights = useStore((s) => s.highlights);
  const [menu, setMenu] = useState(false);
  const update = (patch: Partial<TaskItem>) =>
    useStore.getState().updateItem(item.id, patch);
  const add = () => {
    const id = useStore.getState().addSubtask(item.id);
    useStore.getState().setEditing(id);
  };
  const reorder = useTouchReorder({
    rows: () => [
      ...document.querySelectorAll<HTMLElement>(
        `[data-grid-task="${item.id}"] .subtask[data-subtask-id]`,
      ),
    ],
    attribute: 'data-subtask-id',
    scrollElement: () => document.querySelector('.areaScroll'),
    drop: (from, to, after) =>
      useStore.getState().reorderSubtasks(item.id, from, to, after),
  });
  const matches =
    highlights.includes(item.state) ||
    (item.important && highlights.includes('important'));
  const toggle = () => {
    const s = useStore.getState();
    s.select(
      s.selection.includes(item.id)
        ? s.selection.filter((id) => id !== item.id)
        : [...s.selection, item.id],
    );
  };
  const done = item.subtasks.filter((s) => s.state === 'done').length;
  return (
    <>
      <article
        className={`gridTask ${item.collapsed ? 'collapsedTask' : ''} ${selected ? 'selected' : ''} ${item.state === 'done' ? 'done' : ''} ${highlights.length ? (matches ? 'matched' : 'dimmed') : ''}`}
        data-grid-task={item.id}
        data-drag-title={item.title}
        aria-label={`Task ${item.title}`}
        tabIndex={0}
        style={
          {
            '--item-color': settings.stateColors[item.state],
            '--task-title-size': `${item.titleFontSize ?? settings.taskTitleSize}px`,
          } as CSSProperties
        }
        onClickCapture={(e) => {
          if (mode) {
            e.preventDefault();
            e.stopPropagation();
            toggle();
          }
        }}
        onClick={(e) => {
          if (
            item.collapsed &&
            !(e.target as HTMLElement).closest('button,input,textarea')
          )
            update({ collapsed: false });
        }}
        onKeyDown={(e) => {
          if (
            e.target === e.currentTarget &&
            (e.key === 'Enter' || e.key === ' ')
          ) {
            e.preventDefault();
            if (mode) toggle();
            else update({ collapsed: !item.collapsed });
          }
        }}
      >
        <div className="taskHeading">
          <StatePicker
            interaction
            state={item.state}
            onChange={(state) => update({ state })}
          />
          <Editable
            label="Task title"
            className="taskTitle"
            activation={item.collapsed ? 'none' : 'click'}
            value={item.title}
            editing={editingId === item.id}
            onFinish={() => useStore.getState().setEditing(null)}
            onCommit={(title) => update({ title })}
          />
          {item.important && (
            <span className="importantMarker" aria-label="Important">
              ★
            </span>
          )}
          {item.collapsed && item.subtasks.length > 0 && (
            <span
              className="taskProgress"
              role="img"
              aria-label={`${done} of ${item.subtasks.length} subtasks done`}
              style={
                {
                  '--progress': `${(done / item.subtasks.length) * 100}%`,
                } as CSSProperties
              }
            />
          )}
          <button
            className="taskCollapse"
            aria-label={item.collapsed ? 'Expand task' : 'Collapse task'}
            aria-expanded={!item.collapsed}
            onClick={() => update({ collapsed: !item.collapsed })}
          >
            {item.collapsed ? '▸' : '▾'}
          </button>
          <button
            className="taskMore"
            aria-label={`Actions for task ${item.title}`}
            onClick={() => setMenu(true)}
          >
            ⋯
          </button>
        </div>
        {!item.collapsed && (
          <>
            <div className="description">
              <Editable
                label="Description"
                multiline
                value={item.description}
                placeholder="Add a description…"
                onCommit={(description) => update({ description })}
                onLiveChange={(description) => update({ description })}
                onEditStart={() =>
                  useStore
                    .getState()
                    .beginHistoryGroup(`description:${item.id}`)
                }
                onEditEnd={() =>
                  useStore.getState().endHistoryGroup(`description:${item.id}`)
                }
              />
            </div>
            <button
              className="subtaskToggle"
              aria-expanded={item.subtasksExpanded}
              onClick={() =>
                update({ subtasksExpanded: !item.subtasksExpanded })
              }
            >
              {item.subtasksExpanded ? '▾' : '▸'}{' '}
              {item.subtasks.length
                ? `${done}/${item.subtasks.length} subtasks`
                : 'Subtasks'}
            </button>
            {item.subtasksExpanded && (
              <div className="subtasks" data-no-drag>
                {item.subtasks
                  .filter((s) => settings.showDone || s.state !== 'done')
                  .map((sub) => (
                    <div
                      key={sub.id}
                      className={`subtask ${sub.state === 'done' ? 'subtaskDone' : ''}`}
                      data-subtask-id={sub.id}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={(e) => {
                        e.preventDefault();
                        useStore
                          .getState()
                          .reorderSubtasks(
                            item.id,
                            e.dataTransfer.getData('spatium-subtask'),
                            sub.id,
                          );
                      }}
                    >
                      <span
                        className="subtaskGrip"
                        aria-label="Drag to reorder subtask"
                        draggable={
                          !window.matchMedia('(pointer: coarse)').matches
                        }
                        onDragStart={(e) =>
                          e.dataTransfer.setData('spatium-subtask', sub.id)
                        }
                        onPointerDown={(e) => reorder(e, sub.id)}
                      >
                        ⠿
                      </span>
                      <StatePicker
                        interaction
                        label="Subtask state"
                        state={sub.state}
                        onChange={(state) =>
                          useStore
                            .getState()
                            .updateSubtask(item.id, sub.id, { state })
                        }
                      />
                      <Editable
                        label="Subtask title"
                        value={sub.title}
                        placeholder="Subtask"
                        editing={editingId === sub.id}
                        onFinish={() => useStore.getState().setEditing(null)}
                        onCommit={(title) =>
                          useStore
                            .getState()
                            .updateSubtask(item.id, sub.id, { title })
                        }
                        onEnter={add}
                      />
                      <button
                        className="subtaskDelete"
                        aria-label="Delete subtask"
                        onClick={() =>
                          useStore.getState().deleteSubtask(item.id, sub.id)
                        }
                      >
                        ×
                      </button>
                    </div>
                  ))}
                <button className="addSubtask" onClick={add}>
                  + Add subtask
                </button>
              </div>
            )}
          </>
        )}
      </article>
      {menu && (
        <TaskActions ids={[item.id]} close={() => setMenu(false)} onAdd={add} />
      )}
    </>
  );
}
