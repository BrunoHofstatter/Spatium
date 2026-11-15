import { createStore, get } from 'idb-keyval';
import { createDocument, useStore } from './store';
import type { Doc } from './types';
import { migrate, GRID_BACKUP_KEY } from './migration';
export { migrate } from './migration';
import { flushPendingStateChanges } from './clickPattern';
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
  private legacy: unknown;
  private queue: Promise<void> = Promise.resolve();
  onSaved?: (doc: Doc) => void;
  async load() {
    const raw: unknown = await get('spatium-document');
    const doc = raw === undefined ? createDocument() : migrate(raw);
    this.legacy =
      raw &&
      typeof raw === 'object' &&
      'schemaVersion' in raw &&
      raw.schemaVersion !== 4
        ? structuredClone(raw)
        : undefined;
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
              if (doc && this.legacy) {
                const backup = store.get(GRID_BACKUP_KEY);
                backup.onsuccess = () => {
                  if (backup.result === undefined)
                    store.put(this.legacy, GRID_BACKUP_KEY);
                };
              }
              if (doc) store.put(doc, 'spatium-document');
              if (metadata) store.put(metadata.value, metadata.key);
            };
            tx.oncomplete = () => resolve();
            tx.onabort = tx.onerror = () =>
              reject(conflict ?? tx.error ?? new Error('Local save failed.'));
          }),
      );
      if (doc) {
        this.baseline = snapshot;
        this.legacy = undefined;
      }
    });
    this.queue = operation.catch(() => {});
    return operation;
  }
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
