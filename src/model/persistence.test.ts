import { afterEach, expect, it, vi } from 'vitest';
import {
  SaveConflictError,
  startPersistence,
  type Repository,
} from './persistence';
import { createDocument, useStore } from './store';
import type { Doc } from './types';
afterEach(() => {
  vi.unstubAllGlobals();
  vi.useRealTimers();
});
function environment() {
  vi.useFakeTimers();
  const docEvents = new EventTarget(),
    windowEvents = new EventTarget();
  vi.stubGlobal('document', docEvents);
  vi.stubGlobal('window', windowEvents);
  vi.stubGlobal('navigator', { storage: { persist: async () => true } });
  return { docEvents, windowEvents };
}
it('debounces changes, serializes writes, and flushes on pagehide', async () => {
  const { windowEvents } = environment();
  const saved: Doc[] = [];
  const repo: Repository = {
    load: async () => createDocument(),
    save: async (d) => {
      saved.push(d);
    },
  };
  const stop = await startPersistence(repo);
  await vi.advanceTimersByTimeAsync(0);
  const id = useStore.getState().doc.panelOrder[0];
  useStore.getState().renamePanel(id, 'One');
  await vi.advanceTimersByTimeAsync(200);
  useStore.getState().renamePanel(id, 'Two');
  await vi.advanceTimersByTimeAsync(200);
  expect(saved).toHaveLength(1);
  await vi.advanceTimersByTimeAsync(100);
  expect(saved.at(-1)?.panels[id].title).toBe('Two');
  useStore.getState().renamePanel(id, 'Three');
  windowEvents.dispatchEvent(new Event('pagehide'));
  await vi.advanceTimersByTimeAsync(0);
  expect(saved.at(-1)?.panels[id].title).toBe('Three');
  stop();
});
it('does not save over unreadable data and retries failed saves', async () => {
  environment();
  const save = vi.fn(async () => {});
  await expect(
    startPersistence({
      load: async () => {
        throw new Error('Unsupported');
      },
      save,
    }),
  ).rejects.toThrow('Unsupported');
  expect(save).not.toHaveBeenCalled();
  save.mockRejectedValueOnce(new Error('Quota'));
  const stop = await startPersistence({
    load: async () => createDocument(),
    save,
  });
  await vi.advanceTimersByTimeAsync(0);
  expect(useStore.getState().error).toContain('could not be saved');
  await vi.advanceTimersByTimeAsync(300);
  expect(useStore.getState().error).toBeNull();
  expect(save).toHaveBeenCalledTimes(2);
  stop();
});
it('drains a pending lifecycle save immediately after an in-flight write', async () => {
  const { windowEvents } = environment();
  const saved: Doc[] = [];
  let release: (() => void) | undefined;
  const stop = await startPersistence({
    load: async () => createDocument(),
    save: async (doc) => {
      saved.push(doc);
      if (saved.length === 1)
        await new Promise<void>((resolve) => {
          release = resolve;
        });
    },
  });
  const id = useStore.getState().doc.panelOrder[0];
  useStore.getState().renamePanel(id, 'Newest');
  windowEvents.dispatchEvent(new Event('pagehide'));
  release!();
  await Promise.resolve();
  await Promise.resolve();
  await Promise.resolve();
  expect(saved).toHaveLength(2);
  expect(saved[1].panels[id].title).toBe('Newest');
  stop();
});
it('stops automatic writes after a stale-tab conflict', async () => {
  environment();
  const save = vi.fn(async () => {
    throw new SaveConflictError();
  });
  const stop = await startPersistence({
    load: async () => createDocument(),
    save,
  });
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(1);
  expect(useStore.getState().error).toContain('Another tab');
  useStore
    .getState()
    .renamePanel(useStore.getState().doc.panelOrder[0], 'Unsaved edit');
  await vi.advanceTimersByTimeAsync(1000);
  expect(save).toHaveBeenCalledTimes(1);
  stop();
});
