import { afterEach, expect, it, vi } from 'vitest';
import { CLICK_DELAY, StateClickPattern } from './clickPattern';
import { createDocument, useStore } from './store';
import {
  displayHeight,
  fitAreaViewport,
  headingScale,
  itemBounds,
  selectionHits,
} from './geometry';
import { migrate } from './persistence';
afterEach(() => vi.useRealTimers());
it('distinguishes all four click patterns without an intermediate state', () => {
  vi.useFakeTimers();
  const change = vi.fn();
  const pattern = new StateClickPattern(change);
  pattern.click(0);
  expect(change).not.toHaveBeenCalled();
  vi.advanceTimersByTime(CLICK_DELAY);
  expect(change).toHaveBeenLastCalledWith('done');
  change.mockClear();
  pattern.click(0);
  vi.advanceTimersByTime(80);
  pattern.click(0);
  vi.advanceTimersByTime(CLICK_DELAY);
  expect(change.mock.calls).toEqual([['inProgress']]);
  pattern.click(2);
  vi.advanceTimersByTime(CLICK_DELAY);
  expect(change).toHaveBeenLastCalledWith('blank');
  change.mockClear();
  pattern.click(2);
  pattern.click(2);
  vi.advanceTimersByTime(CLICK_DELAY);
  expect(change.mock.calls).toEqual([['delayed']]);
  change.mockClear();
  pattern.click(0);
  pattern.dispose();
  vi.advanceTimersByTime(CLICK_DELAY);
  expect(change).not.toHaveBeenCalled();
  pattern.click(2);
  pattern.flush();
  expect(change).toHaveBeenLastCalledWith('blank');
  const calls = change.mock.calls.length;
  vi.advanceTimersByTime(CLICK_DELAY);
  expect(change).toHaveBeenCalledTimes(calls);
});
it('migrates old documents without changing content, placement or the source', () => {
  useStore.getState().hydrate(createDocument());
  const s = useStore.getState(),
    panel = s.doc.panelOrder[0];
  const a = s.createItem('area', panel, { x: 120, y: 140 }, null);
  const t = useStore
    .getState()
    .createItem('task', panel, { x: 180, y: 240 }, a);
  const old = JSON.parse(JSON.stringify(useStore.getState().doc));
  old.schemaVersion = 1;
  delete old.items[a].fontSize;
  delete old.items[t].collapsed;
  delete old.settings.stateControl;
  old.settings.gridSnap = true;
  old.settings.gridSize = 20;
  const original = structuredClone(old);
  const migrated = migrate(old);
  expect(migrated.schemaVersion).toBe(3);
  expect(migrated.items[t]).toEqual({ ...old.items[t], collapsed: false });
  expect(migrated.items[a]).toEqual({ ...old.items[a], fontSize: 24 });
  expect(migrated.settings).not.toHaveProperty('gridSize');
  expect(old).toEqual(original);
  expect(migrate(migrated)).toEqual(migrated);
});
it('collapses tasks without losing their size or subtask expansion and supports undo', () => {
  useStore.getState().hydrate(createDocument());
  const s = useStore.getState();
  const id = s.createItem('task', s.doc.panelOrder[0], { x: 0, y: 0 }, null);
  useStore.getState().addSubtask(id);
  useStore.getState().updateItem(id, { collapsed: false });
  const before = useStore.getState().doc.items[id];
  useStore.getState().updateItem(id, { collapsed: true });
  const collapsed = useStore.getState().doc.items[id];
  expect(displayHeight(collapsed)).toBe(40);
  expect(collapsed.h).toBe(before.h);
  useStore.getState().undo();
  expect(useStore.getState().doc.items[id]).toEqual(before);
});
it('uses containment left-to-right and intersection right-to-left', () => {
  const item = { x: 10, y: 10, w: 100, h: 80 },
    box = { x: 20, y: 20, w: 10, h: 10 };
  expect(selectionHits(item, box, false)).toBe(false);
  expect(selectionHits(item, box, true)).toBe(true);
  expect(selectionHits(item, { x: 0, y: 0, w: 120, h: 100 }, false)).toBe(true);
});
it('fits an area including its external, partially scaled heading', () => {
  const doc = createDocument();
  useStore.getState().hydrate(doc);
  const id = useStore
    .getState()
    .createItem('area', doc.panelOrder[0], { x: 400, y: 500 }, null);
  const current = useStore.getState().doc,
    size = { w: 900, h: 600 },
    view = fitAreaViewport(current, id, size),
    bounds = itemBounds(current, current.items[id], view.zoom);
  expect(view.x + bounds.x * view.zoom).toBeGreaterThanOrEqual(25);
  expect(view.y + bounds.y * view.zoom).toBeGreaterThanOrEqual(25);
  expect(view.y + (bounds.y + bounds.h) * view.zoom).toBeLessThanOrEqual(
    size.h - 25,
  );
  expect(headingScale(0.25) * 0.25).toBeGreaterThan(0.25);
  expect(headingScale(3)).toBeLessThan(1);
});
