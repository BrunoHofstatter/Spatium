import type { Doc, Highlight, TaskItem, TaskState } from './types';
import { descendants } from './geometry';
const indexCache = new WeakMap<Doc['items'], Map<string | null, string[]>>();
export function childrenIndex(items: Doc['items']) {
  let index = indexCache.get(items);
  if (!index) {
    index = new Map();
    for (const item of Object.values(items))
      index.set(item.parentId, [...(index.get(item.parentId) ?? []), item.id]);
    // CSS z-index handles stacking; stable DOM order preserves text clicks.
    indexCache.set(items, index);
  }
  return index;
}
export function matches(task: TaskItem, highlights: Highlight[]) {
  return highlights.some((h) =>
    h === 'important' ? task.important : task.state === h,
  );
}
export function areaSummary(
  doc: Pick<Doc, 'items' | 'settings'>,
  id: string,
  highlights: Highlight[],
) {
  const counts: Record<TaskState, number> = {
    blank: 0,
    delayed: 0,
    inProgress: 0,
    done: 0,
  };
  let highlighted = false;
  for (const child of descendants(doc.items, id)) {
    const item = doc.items[child];
    if (item.type !== 'task') continue;
    counts[item.state]++;
    if (
      (doc.settings.showDone || item.state !== 'done') &&
      matches(item, highlights)
    )
      highlighted = true;
  }
  return { counts, highlighted };
}
