import { beforeEach, expect, it } from 'vitest';
import { createDocument, useStore } from './store';
import { displayHeight } from './geometry';
import { snapMovement } from './snapping';
import { settingsReturn } from './navigation';
import { migrate } from './persistence';
const s = () => useStore.getState();
const add = (x: number, y: number, parent: string | null = null) =>
  s().createItem('task', s().doc.panelOrder[0], { x, y }, parent);
beforeEach(() => s().hydrate(createDocument()));
it('starts collapsed and preserves column gaps through expansion and collapse in one undo step', () => {
  const a = add(0, 0),
    b = add(0, 50),
    c = add(0, 110),
    side = add(400, 50);
  const count = s().past.length;
  s().updateItem(a, { collapsed: false });
  const grown = displayHeight(s().doc.items[a]) - 40;
  expect(grown).toBeGreaterThan(0);
  expect(s().doc.items[b].y).toBe(50 + grown);
  expect(s().doc.items[c].y).toBe(110 + grown);
  expect(s().doc.items[side].y).toBe(50);
  expect(s().past.length).toBe(count + 1);
  s().undo();
  expect(s().doc.items[b].y).toBe(50);
  s().redo();
  expect(s().doc.items[b].y).toBe(50 + grown);
  s().updateItem(a, { collapsed: true });
  expect(s().doc.items[b].y).toBe(50);
  expect(s().doc.items[c].y).toBe(110);
});
it('pulls up a task added beneath an already expanded task while preserving its gap', () => {
  const a = add(0, 0);
  s().updateItem(a, { collapsed: false });
  const height = displayHeight(s().doc.items[a]);
  const b = add(0, height + 15);
  s().updateItem(a, { collapsed: true });
  expect(s().doc.items[b].y).toBe(55);
});
it('fits descriptions, responds to width changes, and merges text plus flow into one editing history step', () => {
  const a = add(0, 0),
    b = add(0, 50);
  s().updateItem(a, { collapsed: false });
  const before = s().doc;
  s().beginHistoryGroup('description');
  for (const description of [
    'One\nTwo',
    'One\nTwo\nThree',
    'One\nTwo\nThree\nFour',
  ])
    s().updateItem(a, { description });
  s().endHistoryGroup('description');
  expect(s().doc.items[a].h).toBeGreaterThan(before.items[a].h);
  expect(s().doc.items[b].y - before.items[b].y).toBe(
    s().doc.items[a].h - before.items[a].h,
  );
  s().undo();
  expect(s().doc).toEqual(before);
  s().updateItem(a, {
    description:
      'A description that is long enough to wrap across several narrow lines and grow when the card becomes narrower.',
  });
  const wide = s().doc.items[a];
  s().resizeItem(a, { x: 0, y: 0, w: 160, h: 900 });
  expect(s().doc.items[a].h).toBeGreaterThan(wide.h);
  expect(s().doc.items[a].h).not.toBe(900);
});
it('keeps stack flow within the same parent and updates inherited typography without changing overrides', () => {
  const a = add(0, 0),
    b = add(0, 55),
    side = add(400, 55);
  s().setTaskFonts([b], 24);
  const overrideHeight = displayHeight(
    s().doc.items[b],
    true,
    s().doc.settings.taskTitleSize,
  );
  s().setSettings({ taskTitleSize: 32 });
  expect(displayHeight(s().doc.items[a], true, 32)).toBe(61);
  expect(displayHeight(s().doc.items[b], true, 32)).toBe(overrideHeight);
  expect(
    (s().doc.items[b] as { titleFontSize: number | null }).titleFontSize,
  ).toBe(24);
  expect(s().doc.items[side].y).toBe(55);
  const area = s().createItem(
      'area',
      s().doc.panelOrder[0],
      { x: 800, y: 100 },
      null,
    ),
    nested = add(812, 144, area);
  const position = s().doc.items[nested].y;
  s().updateItem(a, { collapsed: false });
  expect(s().doc.items[nested].y).toBe(position);
});
it('snaps task edges and centers with screen-space tolerance and excludes the selection', () => {
  const a = add(20, 20),
    b = add(400, 200);
  const result = snapMovement(s().doc, [a], { x: 377, y: 177 }, 1);
  expect(result.delta).toEqual({ x: 380, y: 180 });
  expect(result.guides).toEqual([
    { axis: 'x', value: 400 },
    { axis: 'y', value: 200 },
  ]);
  expect(snapMovement(s().doc, [a, b], { x: 13, y: 17 }, 1).guides).toEqual([]);
  const far = snapMovement(s().doc, [a], { x: 365, y: 150 }, 1);
  expect(far.guides).toEqual([]);
});
it('allows only valid settings return destinations', () => {
  const panel = s().doc.panelOrder[0],
    hash = `#/panel/${panel}`;
  expect(
    settingsReturn(
      `#/settings?from=${encodeURIComponent(hash)}`,
      s().doc.panels,
    ).hash,
  ).toBe(hash);
  expect(
    settingsReturn('#/settings?from=https://example.com', s().doc.panels).hash,
  ).toBe('#/');
});
it('fits legacy expanded descriptions during migration while preserving following stack gaps', () => {
  const a = add(0, 0);
  s().updateItem(a, { collapsed: false, description: 'A\nB\nC\nD\nE' });
  const h = s().doc.items[a].h;
  const b = add(0, h + 20);
  const old = JSON.parse(JSON.stringify(s().doc));
  old.schemaVersion = 2;
  delete old.settings.taskTitleSize;
  for (const item of Object.values(old.items) as {
    titleFontSize?: number | null;
  }[])
    delete item.titleFontSize;
  old.items[a].h = 70;
  old.items[b].y = 90;
  const migrated = migrate(old);
  expect(migrated.items[a].h).toBe(h);
  expect(migrated.items[b].y).toBe(h + 20);
  expect(old.items[a].h).toBe(70);
});
