import type { Doc, Settings, TaskItem } from './types';
export const MIN_TASK_FONT = 12;
export const MAX_TASK_FONT = 32;
export const DESCRIPTION_FONT = 16;
export const DESCRIPTION_LINE = 24;
export function taskFont(
  item: TaskItem,
  settings: Pick<Settings, 'taskTitleSize'>,
) {
  return item.titleFontSize ?? settings.taskTitleSize;
}
export function taskRowHeight(
  item: Pick<TaskItem, 'titleFontSize'>,
  defaultSize = 16,
) {
  return Math.max(
    40,
    Math.ceil((item.titleFontSize ?? defaultSize) * 1.4) + 16,
  );
}
const heights = new Map<string, number>();
let measure: HTMLDivElement | undefined;
function descriptionHeight(text: string, width: number): number {
  const key = `${width}:${text}`;
  const cached = heights.get(key);
  if (cached !== undefined) return cached;
  let height: number;
  if (typeof document !== 'undefined' && document.body) {
    if (!measure?.isConnected) {
      measure = document.createElement('div');
      Object.assign(measure.style, {
        position: 'fixed',
        left: '-100000px',
        top: '0',
        visibility: 'hidden',
        pointerEvents: 'none',
        whiteSpace: 'pre-wrap',
        overflowWrap: 'anywhere',
        padding: '0',
        border: '0',
        fontFamily: getComputedStyle(document.documentElement).fontFamily,
        fontSize: `${DESCRIPTION_FONT}px`,
        lineHeight: `${DESCRIPTION_LINE}px`,
      });
      document.body.appendChild(measure);
    }
    measure.style.width = `${Math.max(1, width)}px`;
    measure.textContent = `${text || 'Add a description…'}\u200b`;
    height = Math.max(DESCRIPTION_LINE, measure.getBoundingClientRect().height);
  } else {
    height =
      (text || 'Add a description…')
        .split('\n')
        .reduce(
          (lines, p) =>
            lines +
            Math.max(
              1,
              Math.ceil(
                (p.length * DESCRIPTION_FONT * 0.53) / Math.max(1, width),
              ),
            ),
          0,
        ) * DESCRIPTION_LINE;
  }
  if (heights.size >= 1000) heights.clear();
  heights.set(key, height);
  return height;
}
export function taskMainHeight(item: TaskItem, settings: Settings) {
  return Math.ceil(
    24 +
      Math.max(22, taskFont(item, settings) * 1.4) +
      10 +
      descriptionHeight(item.description, item.w - 45) +
      10 +
      16,
  );
}
export function taskHeight(item: TaskItem, settings: Settings) {
  return item.collapsed
    ? taskRowHeight(item, settings.taskTitleSize)
    : item.h +
        (item.subtasksExpanded
          ? 40 +
            item.subtasks.filter((s) => settings.showDone || s.state !== 'done')
              .length *
              36
          : 0);
}
export function sameColumn(a: TaskItem, b: TaskItem) {
  return (
    a.panelId === b.panelId &&
    a.parentId === b.parentId &&
    [
      Math.abs(a.x - b.x),
      Math.abs(a.x + a.w / 2 - b.x - b.w / 2),
      Math.abs(a.x + a.w - b.x - b.w),
    ].some((d) => d <= 12)
  );
}
// Size changes and all following tasks are recorded in the same document action.
export function layoutTasks(
  doc: Doc,
  previous: Doc,
  after: Doc,
  force = false,
): string[] {
  const tasks = Object.values(doc.items).filter(
    (i): i is TaskItem => i.type === 'task',
  );
  const positions = new Map(tasks.map((t) => [t.id, { ...t }]));
  const changed: { id: string; oldHeight: number; delta: number }[] = [];
  const touched = new Set<string>();
  for (const task of tasks) {
    const old = previous.items[task.id];
    const now = after.items[task.id] as TaskItem;
    if (
      !force &&
      old?.type === 'task' &&
      old.w === now.w &&
      old.description === now.description &&
      old.collapsed === now.collapsed &&
      old.subtasksExpanded === now.subtasksExpanded &&
      old.titleFontSize === now.titleFontSize &&
      old.subtasks === now.subtasks &&
      (now.titleFontSize !== null ||
        previous.settings.taskTitleSize === after.settings.taskTitleSize)
    )
      continue;
    const height = taskMainHeight(task, doc.settings);
    if (task.h !== height) {
      task.h = height;
      task.updatedAt = Date.now();
      touched.add(task.id);
    }
    if (old?.type === 'task') {
      const oldHeight = taskHeight(old, previous.settings),
        delta = taskHeight(task, doc.settings) - oldHeight;
      if (delta) {
        changed.push({ id: task.id, oldHeight, delta });
        touched.add(task.id);
      }
    }
  }
  changed.sort(
    (a, b) =>
      positions.get(a.id)!.y - positions.get(b.id)!.y ||
      a.id.localeCompare(b.id),
  );
  for (const change of changed) {
    const source = positions.get(change.id)!;
    for (const target of positions.values())
      if (
        target.id !== source.id &&
        sameColumn(source, target) &&
        target.y >= source.y + change.oldHeight - 0.5
      ) {
        const item = doc.items[target.id];
        item.y += change.delta;
        item.updatedAt = Date.now();
        touched.add(target.id);
      }
  }
  return [...touched];
}
