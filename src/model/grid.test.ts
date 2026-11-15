import { beforeEach, expect, it, vi } from 'vitest';
import { createDocument, areaTasks, ordered, useStore } from './store';
import { migrate, validateGrid } from './migration';
import { legacyFixture } from './legacy.fixture';
import { StateClickPattern, CLICK_DELAY } from './clickPattern';
const s = () => useStore.getState();
beforeEach(() => s().hydrate(createDocument()));
it('preserves all task content, settings, IDs and timestamps while flattening areas and dropping notes', () => {
  const old = legacyFixture(),
    original = structuredClone(old),
    next = migrate(old);
  expect(old).toEqual(original);
  expect(next.schemaVersion).toBe(4);
  expect(next.items.child).toMatchObject({
    title: 'Parent › Child',
    parentId: null,
    color: null,
    fontSize: 24,
  });
  expect(next.items.task).toMatchObject({
    id: 'task',
    parentId: 'child',
    title: old.items.task.type === 'task' ? old.items.task.title : '',
    description: 'First line\nSecond line',
    state: 'delayed',
    important: true,
    subtasks: [{ id: 'sub', title: 'Keep subtask', state: 'done' }],
    titleFontSize: 22,
    collapsed: false,
    createdAt: 10,
    updatedAt: 20,
  });
  expect(next.items.note).toBeUndefined();
  const loose = next.items.loose;
  expect(loose.type).toBe('task');
  expect(next.items[loose.parentId!]).toMatchObject({
    title: 'Unsorted',
    type: 'area',
  });
  expect(next.settings).toEqual(old.settings);
  expect(validateGrid(next)).toEqual(next);
});
it('converts deterministically across devices, insertion orders and repeated migrations', () => {
  const old = legacyFixture(),
    other = structuredClone(old);
  other.items = Object.fromEntries(Object.entries(other.items).reverse());
  other.panels.panel.viewport = { x: 999, y: -100, zoom: 2 };
  expect(migrate(old)).toEqual(migrate(other));
  expect(migrate(migrate(old))).toEqual(migrate(old));
});
it('retains version 1 and 2 compatibility and refuses malformed/newer documents', () => {
  for (const version of [1, 2, 3]) {
    const raw = legacyFixture();
    raw.schemaVersion = version;
    expect(migrate(raw).items.task.title).toBe('Keep this title');
  }
  const bad = legacyFixture();
  bad.items.child.parentId = 'child';
  expect(() => migrate(bad)).toThrow();
  expect(() => migrate({ ...legacyFixture(), schemaVersion: 99 })).toThrow(
    /unsupported/,
  );
  const grid = createDocument();
  grid.panels[grid.panelOrder[0]].columns = [];
  expect(() => migrate(grid)).toThrow();
});
it('new tasks are collapsed and independently keep column membership while toggling column count', () => {
  const panel = s().doc.panelOrder[0],
    area = s().createArea(panel),
    a = s().createTask(area, 0),
    b = s().createTask(area, 1),
    c = s().createTask(area, 0);
  s().setEditing(null);
  expect(s().doc.items[a]).toMatchObject({ collapsed: true, column: 0 });
  s().updateItem(area, { taskColumns: 1 });
  s().moveTasks([c], area, undefined, a);
  expect(areaTasks(s().doc, area).map((t) => t.id)).toEqual([c, a, b]);
  s().updateItem(area, { taskColumns: 2 });
  expect(
    areaTasks(s().doc, area)
      .filter((t) => t.column === 0)
      .map((t) => t.id),
  ).toEqual([c, a]);
  expect(s().doc.items[b]).toMatchObject({ column: 1 });
  s().updateItem(a, { collapsed: false, description: 'Long text' });
  expect(s().doc.items[b]).toMatchObject({ column: 1, order: 2 });
});
it('moves areas explicitly into a new column, keeps empty columns, and undoes the whole action', () => {
  const panel = s().doc.panelOrder[0],
    a = s().createArea(panel),
    b = s().createArea(panel),
    columns = [...s().doc.panels[panel].columns];
  s().moveArea(a, 'new');
  expect(s().doc.panels[panel].columns).toHaveLength(3);
  expect(s().doc.items[b]).toMatchObject({ columnId: columns[0] });
  s().undo();
  expect(s().doc.panels[panel].columns).toEqual(columns);
  expect(s().doc.items[a]).toMatchObject({ columnId: columns[0] });
  s().removeColumn(panel, columns[0]);
  expect(s().doc.panels[panel].columns).toEqual(columns);
  s().removeColumn(panel, columns[1]);
  expect(s().doc.panels[panel].columns).toHaveLength(1);
});
it('moves and bulk-edits tasks without losing content, and deletes an area with its tasks undoably', () => {
  const p = s().doc.panelOrder[0],
    a = s().createArea(p),
    b = s().createArea(p),
    t = s().createTask(a),
    sub = s().addSubtask(t);
  s().updateSubtask(t, sub, { title: 'Keep me' });
  s().updateItem(t, { description: 'Keep description' });
  s().moveTasks([t], b, 1);
  expect(s().doc.items[t]).toMatchObject({
    parentId: b,
    column: 1,
    description: 'Keep description',
  });
  s().setTaskFonts([t], 28);
  expect(s().doc.items[t]).toMatchObject({ titleFontSize: 28 });
  s().deleteItems([b]);
  expect(s().doc.items[t]).toBeUndefined();
  s().undo();
  expect(s().doc.items[t]).toMatchObject({
    parentId: b,
    subtasks: [{ id: sub, title: 'Keep me', state: 'blank' }],
  });
});
it('groups live description edits into one undo entry and keeps navigation out of history and undo', () => {
  const p = s().doc.panelOrder[0],
    a = s().createArea(p),
    t = s().createTask(a),
    before = s().past.length;
  s().beginHistoryGroup('edit');
  s().updateItem(t, { description: 'A' });
  s().updateItem(t, { description: 'AB' });
  s().setViewport(p, { x: 250, y: 700, zoom: 1 });
  s().endHistoryGroup('edit');
  expect(s().past).toHaveLength(before + 1);
  s().undo();
  expect(s().doc.items[t]).toMatchObject({ description: '' });
  expect(s().doc.panels[p].viewport.y).toBe(700);
});
it('appends after deletes without duplicate order values', () => {
  const p = s().doc.panelOrder[0],
    a = s().createArea(p),
    b = s().createArea(p);
  s().deleteItems([a]);
  const c = s().createArea(p);
  expect(
    ordered([s().doc.items[b], s().doc.items[c]]).map((i) => i.id),
  ).toEqual([b, c]);
  const t = s().createTask(b),
    u = s().createTask(b);
  s().deleteItems([t]);
  const v = s().createTask(b);
  expect(areaTasks(s().doc, b).map((i) => i.id)).toEqual([u, v]);
});
it('retains all four desktop state patterns with no intermediate state', () => {
  vi.useFakeTimers();
  try {
    const apply = vi.fn(),
      click = new StateClickPattern(apply);
    click.click(0);
    vi.advanceTimersByTime(CLICK_DELAY);
    expect(apply).toHaveBeenLastCalledWith('done');
    click.click(0);
    click.click(0);
    expect(apply).toHaveBeenLastCalledWith('inProgress');
    click.click(2);
    vi.advanceTimersByTime(CLICK_DELAY);
    expect(apply).toHaveBeenLastCalledWith('blank');
    click.click(2);
    click.click(2);
    expect(apply).toHaveBeenLastCalledWith('delayed');
    click.dispose();
  } finally {
    vi.useRealTimers();
  }
});
