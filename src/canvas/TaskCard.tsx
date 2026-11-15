import { useState } from 'react';
import { useStore } from '../model/store';
import type { TaskItem } from '../model/types';
import { Editable } from './Editable';
import { StatePicker } from './StatePicker';
import { taskFont, taskRowHeight } from '../model/taskLayout';
import { useTouchReorder } from '../ui/useTouchReorder';
import { revealItem } from './focusArea';
export function TaskCard({ item }: { item: TaskItem }) {
  const editing = useStore((s) => s.editingId === item.id),
    showDone = useStore((s) => s.doc.settings.showDone);
  const [newSub, setNewSub] = useState<string | null>(null);
  const settings = useStore((s) => s.doc.settings);
  const beginReorder = useTouchReorder({
    rows: () => [
      ...document.querySelectorAll<HTMLElement>(
        `[data-item-id="${item.id}"] .subtask[data-subtask-id]`,
      ),
    ],
    attribute: 'data-subtask-id',
    panelId: item.panelId,
    drop: (from, to, after) =>
      useStore.getState().reorderSubtasks(item.id, from, to, after),
  });
  const update = (patch: Partial<TaskItem>) =>
    useStore.getState().updateItem(item.id, patch);
  const add = () => setNewSub(useStore.getState().addSubtask(item.id));
  const done = item.subtasks.filter((s) => s.state === 'done').length;
  return (
    <>
      <div
        className={`taskMain ${item.collapsed ? 'collapsedTask' : ''}`}
        style={
          {
            height: item.collapsed
              ? taskRowHeight(item, settings.taskTitleSize)
              : item.h,
            '--task-title-size': `${taskFont(item, settings)}px`,
          } as React.CSSProperties
        }
      >
        <div className="taskHeading">
          <StatePicker
            interaction
            state={item.state}
            onChange={(state) => update({ state })}
          />
          {item.collapsed && item.subtasks.length > 0 && (
            <span
              className="taskProgress"
              role="img"
              aria-label={`${done} of ${item.subtasks.length} subtasks done`}
              title={`${done} of ${item.subtasks.length} subtasks done`}
              style={
                {
                  '--progress': `${(done / item.subtasks.length) * 100}%`,
                } as React.CSSProperties
              }
            >
              {done === item.subtasks.length ? '✓' : ''}
            </span>
          )}
          <Editable
            className="taskTitle"
            label="Task title"
            value={item.title}
            editing={editing}
            onFinish={() => useStore.getState().setEditing(null)}
            onCommit={(title) => update({ title })}
          />
          <button
            className={`star ${item.important ? 'starOn' : ''}`}
            aria-label="Important"
            aria-pressed={item.important}
            onClick={() => update({ important: !item.important })}
          >
            {item.important ? '★' : '☆'}
          </button>
          <button
            className="taskCollapse"
            aria-label={item.collapsed ? 'Expand task' : 'Collapse task'}
            aria-expanded={!item.collapsed}
            onClick={() => {
              update({ collapsed: !item.collapsed });
              if (
                item.collapsed &&
                window.matchMedia('(pointer: coarse)').matches
              )
                requestAnimationFrame(() => revealItem(item.id));
            }}
          >
            {item.collapsed ? '▸' : '▾'}
          </button>
        </div>
        {!item.collapsed && (
          <div className="description">
            <Editable
              label="Description"
              value={item.description}
              placeholder="Add a description…"
              multiline
              onCommit={(description) => update({ description })}
              onLiveChange={(description) => update({ description })}
              onEditStart={() =>
                useStore.getState().beginHistoryGroup(`description:${item.id}`)
              }
              onEditEnd={() =>
                useStore.getState().endHistoryGroup(`description:${item.id}`)
              }
            />
          </div>
        )}
        {!item.collapsed && (
          <button
            className="subtaskToggle"
            onClick={() => update({ subtasksExpanded: !item.subtasksExpanded })}
            aria-expanded={item.subtasksExpanded}
          >
            {item.subtasksExpanded ? '▾' : '▸'}{' '}
            <span>
              {item.subtasks.length
                ? `${done}/${item.subtasks.length}`
                : 'Subtasks'}
            </span>
          </button>
        )}
      </div>
      {!item.collapsed && item.subtasksExpanded && (
        <div className="subtasks" data-no-gesture>
          {item.subtasks
            .filter((s) => showDone || s.state !== 'done')
            .map((sub) => (
              <div
                key={sub.id}
                className={`subtask ${sub.state === 'done' ? 'subtaskDone' : ''}`}
                data-subtask-id={sub.id}
                onDragOver={(e) => e.preventDefault()}
                onDrop={(e) => {
                  e.preventDefault();
                  const from = e.dataTransfer.getData('spatium-subtask');
                  if (from)
                    useStore.getState().reorderSubtasks(item.id, from, sub.id);
                }}
              >
                <span
                  className="subtaskGrip"
                  aria-label="Drag to reorder subtask"
                  title="Drag to reorder"
                  draggable={!window.matchMedia('(pointer: coarse)').matches}
                  onDragStart={(e) => {
                    e.dataTransfer.setData('spatium-subtask', sub.id);
                  }}
                  onPointerDown={(e) => beginReorder(e, sub.id)}
                >
                  ⠿
                </span>
                <StatePicker
                  interaction
                  state={sub.state}
                  label="Subtask state"
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
                  editing={newSub === sub.id}
                  onFinish={() => setNewSub(null)}
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
  );
}
