import { beforeEach, expect, it } from 'vitest';
import { createDocument, useStore } from './store';
import { creationPoint } from './creation';
import { absolutePosition, INSET, TOP } from './geometry';
import { snapMovement } from './snapping';

beforeEach(() => useStore.getState().hydrate(createDocument()));
it('creates inside the visible part of a selected area and avoids an occupied location', () => {
  const s = useStore.getState(),
    panel = s.doc.panelOrder[0];
  const area = s.createItem('area', panel, { x: 0, y: 0 }, null);
  useStore.getState().resizeItem(area, { x: 0, y: 0, w: 2000, h: 2000 });
  const visible = { x: 900, y: 700, w: 360, h: 500 };
  const first = creationPoint(
    useStore.getState().doc,
    'task',
    panel,
    visible,
    area,
  );
  const a = useStore.getState().createItem('task', panel, first, area);
  const second = creationPoint(
    useStore.getState().doc,
    'task',
    panel,
    visible,
    area,
  );
  expect(first.x).toBeGreaterThanOrEqual(visible.x);
  expect(first.y).toBeGreaterThanOrEqual(visible.y);
  expect(second.y).toBeGreaterThanOrEqual(first.y + 40 + 16);
  expect(second.y + 40).toBeLessThanOrEqual(visible.y + visible.h);
  expect(absolutePosition(useStore.getState().doc.items, a)).toEqual(first);
});
it('keeps creation inside an offscreen selected parent so it can be revealed without losing membership', () => {
  const s = useStore.getState(),
    panel = s.doc.panelOrder[0];
  const area = s.createItem('area', panel, { x: 1000, y: 1000 }, null);
  const point = creationPoint(
    useStore.getState().doc,
    'task',
    panel,
    { x: 0, y: 0, w: 350, h: 600 },
    area,
  );
  expect(point.x).toBeGreaterThanOrEqual(1000 + INSET);
  expect(point.y).toBeGreaterThanOrEqual(1000 + TOP);
});
it('uses the same explicit touch tolerance at preview and commit without changing mouse snapping', () => {
  const s = useStore.getState(),
    panel = s.doc.panelOrder[0];
  const a = s.createItem('task', panel, { x: 0, y: 0 }, null);
  const b = useStore
    .getState()
    .createItem('task', panel, { x: 400, y: 300 }, null);
  const doc = useStore.getState().doc;
  expect(snapMovement(doc, [a], { x: 392, y: 0 }, 1).delta.x).toBe(392);
  expect(snapMovement(doc, [a], { x: 392, y: 0 }, 1, 9).delta.x).toBe(400);
  useStore.getState().moveItems([a], { x: 392, y: 0 }, { x: 400, y: 0 }, 9);
  expect(useStore.getState().doc.items[a].x).toBe(
    useStore.getState().doc.items[b].x,
  );
});
it('inserts subtasks before or after the indicated row as one undoable change', () => {
  const s = useStore.getState(),
    panel = s.doc.panelOrder[0];
  const task = s.createItem('task', panel, { x: 0, y: 0 }, null);
  const a = useStore.getState().addSubtask(task),
    b = useStore.getState().addSubtask(task),
    c = useStore.getState().addSubtask(task);
  const order = () => {
    const item = useStore.getState().doc.items[task];
    return item.type === 'task' ? item.subtasks.map((s) => s.id) : [];
  };
  useStore.getState().reorderSubtasks(task, a, b, true);
  expect(order()).toEqual([b, a, c]);
  useStore.getState().undo();
  expect(order()).toEqual([a, b, c]);
  useStore.getState().reorderSubtasks(task, c, a, false);
  expect(order()).toEqual([c, a, b]);
});
