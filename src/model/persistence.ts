import { createStore, get } from 'idb-keyval';
import { createDocument, useStore } from './store';
import { STATES, type Doc, type Item } from './types';
import { flushPendingStateChanges } from './clickPattern';
import { layoutTasks } from './taskLayout';
import { growAncestors } from './geometry';
export interface Repository {
  load(): Promise<Doc>;
  save(doc: Doc): Promise<void>;
  onSaved?: (doc: Doc) => void;
}
const localStore = createStore('keyval-store', 'keyval');
export class SaveConflictError extends Error {
  constructor() {
    super(
      'Another tab saved newer changes. This tab has stopped saving to protect them. Keep it open to retain any unsaved edits.',
    );
  }
}
export class IndexedDbRepository implements Repository {
  private baseline: string | undefined;
  private loaded = false;
  private queue: Promise<void> = Promise.resolve();
  onSaved?: (doc: Doc) => void;
  async load() {
    const raw: unknown = await get('spatium-document');
    const doc = raw === undefined ? createDocument() : migrate(raw);
    this.baseline = JSON.stringify(raw);
    this.loaded = true;
    return doc;
  }
  async save(doc: Doc) {
    await this.write(doc);
  }
  async readMetadata<T>(key: string): Promise<T | undefined> {
    return get(key, localStore);
  }
  async writeMetadata(key: string, value: unknown) {
    await this.write(undefined, { key, value });
  }
  async replace(doc: Doc, key: string, value: unknown) {
    await this.write(doc, { key, value });
  }
  private write(
    doc?: Doc,
    metadata?: { key: string; value: unknown },
  ): Promise<void> {
    if (!this.loaded)
      return Promise.reject(
        new Error('Load the saved document before writing it.'),
      );
    const operation = this.queue.then(async () => {
      const snapshot = doc && JSON.stringify(doc);
      await localStore(
        'readwrite',
        (store) =>
          new Promise<void>((resolve, reject) => {
            const tx = store.transaction,
              request = store.get('spatium-document');
            let conflict: Error | undefined;
            request.onsuccess = () => {
              const stored = JSON.stringify(request.result);
              if (stored !== this.baseline && (!doc || stored !== snapshot)) {
                conflict = new SaveConflictError();
                tx.abort();
                return;
              }
              if (doc) store.put(doc, 'spatium-document');
              if (metadata) store.put(metadata.value, metadata.key);
            };
            tx.oncomplete = () => resolve();
            tx.onabort = tx.onerror = () =>
              reject(conflict ?? tx.error ?? new Error('Local save failed.'));
          }),
      );
      if (doc) this.baseline = snapshot;
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
}
// No destructive recovery: an unsupported or invalid document is left intact.
export function migrate(raw: unknown): Doc {
  if (!raw || typeof raw !== 'object')
    throw new Error('The saved document could not be read.');
  const d = structuredClone(raw) as Doc;
  const needsAutoSize = d.schemaVersion !== 3;
  if (![1, 2, 3].includes(d.schemaVersion))
    throw new Error('This saved document uses an unsupported version.');
  const finite = (...numbers: number[]) => numbers.every(Number.isFinite);
  if (
    !d.panels ||
    !d.items ||
    !Array.isArray(d.panelOrder) ||
    !d.settings ||
    !d.settings.stateColors
  )
    throw new Error('The saved document is incomplete.');
  if (d.schemaVersion === 1) {
    for (const item of Object.values(d.items)) {
      if (item.type === 'area') item.fontSize = 24;
      if (item.type === 'task') item.collapsed = false;
    }
    const settings = d.settings as unknown as Record<string, unknown>;
    delete settings.gridSnap;
    delete settings.gridSize;
    d.settings.stateControl = 'clickPattern';
    d.schemaVersion = 2;
  }
  if (d.schemaVersion === 2) {
    d.settings.taskTitleSize = 16;
    for (const item of Object.values(d.items))
      if (item.type === 'task') item.titleFontSize = null;
    d.schemaVersion = 3;
  }
  if (
    new Set(d.panelOrder).size !== d.panelOrder.length ||
    d.panelOrder.length !== Object.keys(d.panels).length ||
    d.panelOrder.some((id) => !d.panels[id])
  )
    throw new Error('Invalid panel order.');
  for (const [id, p] of Object.entries(d.panels))
    if (
      p.id !== id ||
      typeof p.title !== 'string' ||
      !p.viewport ||
      !finite(
        p.viewport.x,
        p.viewport.y,
        p.viewport.zoom,
        p.createdAt,
        p.updatedAt,
      ) ||
      p.viewport.zoom < 0.1 ||
      p.viewport.zoom > 3
    )
      throw new Error('Invalid saved panel.');
  for (const [id, item] of Object.entries(d.items)) {
    if (
      item.id !== id ||
      !d.panels[item.panelId] ||
      !['task', 'area', 'note'].includes(item.type) ||
      !finite(
        item.x,
        item.y,
        item.w,
        item.h,
        item.z,
        item.createdAt,
        item.updatedAt,
      ) ||
      item.w <= 0 ||
      item.h <= 0
    )
      throw new Error('Invalid saved item.');
    const seen = new Set([id]);
    let child: Item = item;
    while (child.parentId !== null) {
      const p = d.items[child.parentId];
      if (
        !p ||
        p.type !== 'area' ||
        p.panelId !== item.panelId ||
        seen.has(p.id)
      )
        throw new Error('Invalid area nesting.');
      seen.add(p.id);
      child = p;
    }
    if (
      item.type === 'task' &&
      (typeof item.title !== 'string' ||
        typeof item.description !== 'string' ||
        !STATES.includes(item.state) ||
        typeof item.important !== 'boolean' ||
        typeof item.subtasksExpanded !== 'boolean' ||
        typeof item.collapsed !== 'boolean' ||
        (item.titleFontSize !== null &&
          (!finite(item.titleFontSize) ||
            item.titleFontSize < 12 ||
            item.titleFontSize > 32)) ||
        !Array.isArray(item.subtasks) ||
        new Set(item.subtasks.map((s) => s.id)).size !== item.subtasks.length ||
        item.subtasks.some(
          (s) =>
            typeof s.id !== 'string' ||
            typeof s.title !== 'string' ||
            !STATES.includes(s.state),
        ))
    )
      throw new Error('Invalid saved task.');
    if (
      item.type === 'area' &&
      (typeof item.title !== 'string' ||
        typeof item.collapsed !== 'boolean' ||
        !finite(item.fontSize) ||
        item.fontSize < 14 ||
        item.fontSize > 72 ||
        (item.color !== null && !/^#[\da-f]{6}$/i.test(item.color)))
    )
      throw new Error('Invalid saved area.');
    if (item.type === 'note' && typeof item.text !== 'string')
      throw new Error('Invalid saved note.');
  }
  if (
    STATES.some((s) => !/^#[\da-f]{6}$/i.test(d.settings.stateColors[s])) ||
    !/^#[\da-f]{6}$/i.test(d.settings.importantColor) ||
    typeof d.settings.showDone !== 'boolean' ||
    !finite(d.settings.taskTitleSize) ||
    d.settings.taskTitleSize < 12 ||
    d.settings.taskTitleSize > 32 ||
    !['clickPattern', 'choices'].includes(d.settings.stateControl)
  )
    throw new Error('Invalid saved settings.');
  if (needsAutoSize) {
    const previous = structuredClone(d);
    for (const id of layoutTasks(d, previous, d, true)) growAncestors(d, id);
  }
  return d;
}
export type PersistenceHandle = (() => void) & { flush(): Promise<void> };
export async function startPersistence(
  repository: Repository,
): Promise<PersistenceHandle> {
  const doc = await repository.load();
  useStore.getState().hydrate(doc);
  let latest = doc,
    saved: Doc | undefined,
    timer: ReturnType<typeof setTimeout> | undefined;
  let writing = false,
    disposed = false,
    urgent = false,
    conflicted = false;
  const idle = new Set<() => void>();
  const flush = async () => {
    if (writing || saved === latest || conflicted) return;
    urgent = false;
    writing = true;
    let failed = false;
    const snapshot = latest;
    try {
      await repository.save(snapshot);
      saved = snapshot;
      useStore.setState({ error: null });
      repository.onSaved?.(snapshot);
    } catch (error) {
      failed = true;
      conflicted = error instanceof SaveConflictError;
      useStore.setState({
        error:
          error instanceof SaveConflictError
            ? error.message
            : 'Changes could not be saved. Keep this page open and free some device storage. Saving will retry.',
      });
    } finally {
      writing = false;
      for (const resolve of idle) resolve();
      idle.clear();
      if (!disposed && !conflicted && saved !== latest) {
        if (urgent && !failed) void flush();
        else timer = setTimeout(() => void flush(), 300);
      }
    }
  };
  const unsubscribe = useStore.subscribe((state) => {
    if (latest === state.doc) return;
    latest = state.doc;
    clearTimeout(timer);
    timer = setTimeout(() => void flush(), 300);
  });
  const onHide = () => {
    // Commit the active editing session before taking the lifecycle snapshot.
    const active = document.activeElement;
    if (active && 'blur' in active && typeof active.blur === 'function')
      active.blur();
    flushPendingStateChanges();
    urgent = true;
    clearTimeout(timer);
    void flush();
  };
  document.addEventListener('visibilitychange', onHide);
  window.addEventListener('pagehide', onHide);
  void flush();
  // Best effort: some browsers reject persistence requests outside a user gesture.
  void navigator.storage?.persist?.().catch(() => false);
  const stop = () => {
    disposed = true;
    unsubscribe();
    clearTimeout(timer);
    document.removeEventListener('visibilitychange', onHide);
    window.removeEventListener('pagehide', onHide);
  };
  return Object.assign(stop, {
    flush: async () => {
      clearTimeout(timer);
      await flush();
      while (writing) await new Promise<void>((resolve) => idle.add(resolve));
      if (saved !== latest) {
        await flush();
        if (saved !== latest)
          throw new Error(
            useStore.getState().error ?? 'Local save is still pending.',
          );
      }
    },
  });
}
