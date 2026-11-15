import { beforeEach, describe, expect, it } from 'vitest';
import { createDocument, useStore } from './store';
import {
  absolutePosition,
  descendants,
  growAncestors,
  reparent,
  screenToWorld,
  zoomAt,
} from './geometry';
import { migrate } from './persistence';
import { childrenIndex, areaSummary } from './selectors';
const store = () => useStore.getState();
const panel = () => store().doc.panelOrder[0];
const add = (
  type: 'area' | 'task' | 'note',
  x = 0,
  y = 0,
  parent: string | null = null,
) => store().createItem(type, panel(), { x, y }, parent);
beforeEach(() => store().hydrate(createDocument()));
describe('document and geometry', () => {
  it('keeps world coordinates on reparent and rejects cycles', () => {
    const area = add('area', 100, 100),
      nested = add('area', 130, 160, area),
      task = add('task', -200, 300);
    const doc = structuredClone(store().doc);
    const before = absolutePosition(doc.items, task);
    reparent(doc, task, nested);
    expect(absolutePosition(doc.items, task)).toEqual(before);
    reparent(doc, area, nested);
    expect(doc.items[area].parentId).toBeNull();
  });
  it('grows through every ancestor, preserving positions on left/top growth', () => {
    const area = add('area', 100, 100),
      nested = add('area', 150, 160, area),
      task = add('task', 200, 220, nested),
      sibling = add('note', 170, 190, nested);
    const doc = structuredClone(store().doc);
    doc.items[task].x = -100;
    doc.items[task].y = -200;
    doc.items[task].w = 1000;
    const before = [task, sibling].map((id) => absolutePosition(doc.items, id));
    growAncestors(doc, task);
    expect(
      [task, sibling].map((id) => absolutePosition(doc.items, id)),
    ).toEqual(before);
    expect(doc.items[nested].w).toBeGreaterThan(1000);
    expect(doc.items[area].w).toBeGreaterThan(1000);
    expect(doc.items[task].x).toBe(0);
    expect(doc.items[task].y).toBe(0);
  });
  it('deletes descendants together and restores them in one undo', () => {
    const a = add('area'),
      b = add('area', 20, 60, a),
      c = add('task', 40, 120, b);
    const before = store().past.length;
    store().deleteItems([a, c]);
    expect(store().doc.items).toEqual({});
    expect(store().past.length).toBe(before + 1);
    store().undo();
    expect(descendants(store().doc.items, a).sort()).toEqual([b, c].sort());
    store().redo();
    expect(store().doc.items).toEqual({});
  });
  it('moves a selected ancestor once and commits a gesture as one history entry', () => {
    const a = add('area'),
      b = add('task', 30, 60, a);
    const before = absolutePosition(store().doc.items, b),
      count = store().past.length;
    store().moveItems([a, b], { x: 120, y: 30 }, { x: 120, y: 30 });
    expect(absolutePosition(store().doc.items, b)).toEqual({
      x: before.x + 120,
      y: before.y + 30,
    });
    expect(store().past.length).toBe(count + 1);
    store().undo();
    expect(absolutePosition(store().doc.items, b)).toEqual(before);
  });
  it('keeps navigation and Done visibility out of undo', () => {
    const t = add('task');
    store().updateItem(t, { title: 'Changed' });
    store().setViewport(panel(), { x: 400, y: 200, zoom: 2 });
    store().setSettings({ showDone: false }, false);
    store().undo();
    expect(store().doc.panels[panel()].viewport.zoom).toBe(2);
    expect(store().doc.settings.showDone).toBe(false);
  });
  it('round trips the document and rejects unsupported data without resetting it', () => {
    add('task');
    expect(migrate(structuredClone(store().doc))).toEqual(store().doc);
    expect(() => migrate({ ...store().doc, schemaVersion: 99 })).toThrow(
      'unsupported',
    );
  });
  it('zooms at a fixed screen anchor and clamps zoom', () => {
    const view = { x: 120, y: -90, zoom: 1.2 },
      anchor = { x: 300, y: 200 };
    const next = zoomAt(view, anchor, 6);
    expect(next.zoom).toBe(3);
    expect(screenToWorld(anchor, next).x).toBeCloseTo(
      screenToWorld(anchor, view).x,
    );
    expect(screenToWorld(anchor, next).y).toBeCloseTo(
      screenToWorld(anchor, view).y,
    );
  });
  it('keeps parent state independent and preserves ordered subtasks', () => {
    const t = add('task'),
      a = store().addSubtask(t),
      b = store().addSubtask(t);
    store().updateSubtask(t, a, { title: 'First', state: 'done' });
    store().reorderSubtasks(t, a, b);
    const task = store().doc.items[t];
    if (task.type !== 'task') throw new Error();
    expect(task.state).toBe('blank');
    expect(task.subtasks.map((s) => s.id)).toEqual([b, a]);
    store().undo();
    expect((store().doc.items[t] as typeof task).subtasks[0].id).toBe(a);
  });
  it('handles a 500-item document without losing ordering, counts or history', () => {
    const area = add('area');
    const sample = add('task', 20, 60, area);
    const start = performance.now();
    store().transact((doc) => {
      const task = doc.items[sample];
      if (task.type !== 'task') throw new Error();
      for (let n = 0; n < 500; n++) {
        const id = `load-${n}`;
        doc.items[id] = {
          ...task,
          id,
          x: (n % 25) * 280,
          y: Math.floor(n / 25) * 170,
          z: n + 2,
          state: n % 2 ? 'done' : 'blank',
        };
      }
      growAncestors(doc, 'load-499');
    });
    const doc = store().doc;
    expect(childrenIndex(doc.items).get(area)).toHaveLength(501);
    expect(areaSummary(doc, area, ['done']).counts.done).toBe(250);
    store().moveItems(['load-250'], { x: 30, y: 10 }, { x: 100, y: 100 });
    store().undo();
    expect(store().doc).toEqual(doc);
    expect(performance.now() - start).toBeLessThan(2000);
  });
  it('moves freely while preserving group offsets without a grid', () => {
    const a = add('task', 13, 17),
      b = add('task', 321, 59);
    store().moveItems([a, b], { x: 20, y: 20 }, { x: 33, y: 37 });
    expect(absolutePosition(store().doc.items, a)).toEqual({ x: 33, y: 37 });
    expect(absolutePosition(store().doc.items, b)).toEqual({ x: 341, y: 79 });
  });
  it('removes newly hidden selections and editors on state changes and collapse', () => {
    const area = add('area'),
      a = add('task', 20, 60, area),
      b = add('task', 300, 60, area);
    store().setSettings({ showDone: false }, false);
    store().select([a, b]);
    store().setEditing(a);
    store().updateItem(a, { state: 'done' });
    expect(store().selection).toEqual([b]);
    expect(store().editingId).toBeNull();
    store().setEditing(b);
    store().updateItem(area, { collapsed: true });
    expect(store().selection).toEqual([]);
    expect(store().editingId).toBeNull();
  });
  it('keeps descendants fixed in world space when resizing an area from its north/west edges', () => {
    const area = add('area', 100, 100),
      nested = add('area', 150, 180, area),
      task = add('task', 170, 240, nested);
    const before = absolutePosition(store().doc.items, task);
    const old = store().doc.items[area];
    store().resizeItem(area, {
      x: old.x - 50,
      y: old.y - 50,
      w: old.w + 50,
      h: old.h + 50,
    });
    expect(absolutePosition(store().doc.items, task)).toEqual(before);
  });
  it('preserves free coordinates for nested creation and resizing', () => {
    const area = add('area', 13, 17);
    const task = add('task', 66, 103, area);
    expect(absolutePosition(store().doc.items, task)).toEqual({
      x: 66,
      y: 103,
    });
    const item = store().doc.items[task];
    store().resizeItem(task, { x: item.x, y: item.y, w: 301, h: 141 });
    expect(absolutePosition(store().doc.items, task)).toEqual({
      x: 66,
      y: 103,
    });
  });
});
