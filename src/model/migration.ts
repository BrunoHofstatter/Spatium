import { validateLegacy } from './legacy';
import { isDateKey } from './agenda';
import { STATES, type Doc, type Item } from './types';
export const GRID_BACKUP_KEY = 'spatium-before-grid-v4';
export const CLOUD_GRID_BACKUP_KEY = 'spatium-cloud-before-grid-v4';
const compare = (a: string, b: string) => (a < b ? -1 : a > b ? 1 : 0);
const finite = (...values: number[]) => values.every(Number.isFinite);
const record = (value: unknown) =>
  !!value && typeof value === 'object' && !Array.isArray(value);
export function migrate(raw: unknown): Doc {
  if (!raw || typeof raw !== 'object')
    throw new Error('The saved document could not be read.');
  if (
    !('schemaVersion' in raw) ||
    ![1, 2, 3, 4].includes(Number(raw.schemaVersion))
  )
    throw new Error('This saved document uses an unsupported version.');
  if (raw.schemaVersion === 4) return validateGrid(structuredClone(raw) as Doc);
  const old = validateLegacy(raw);
  const doc: Doc = {
    schemaVersion: 4,
    panels: {},
    panelOrder: [...old.panelOrder],
    settings: structuredClone(old.settings),
    items: {},
  };
  const position = (id: string) => {
    let item = old.items[id],
      x = item.x,
      y = item.y;
    while (item.parentId) {
      item = old.items[item.parentId];
      x += item.x + 12;
      y += item.y + 44;
    }
    return { x, y };
  };
  const reading = (a: string, b: string) =>
    position(a).y - position(b).y ||
    position(a).x - position(b).x ||
    compare(a, b);
  for (const panelId of old.panelOrder) {
    const panel = old.panels[panelId];
    const areas = Object.values(old.items)
      .filter((i) => i.panelId === panelId && i.type === 'area')
      .sort(
        (a, b) => position(a.id).x - position(b.id).x || reading(a.id, b.id),
      );
    const origins: number[] = [];
    for (const area of areas)
      if (!origins.length || position(area.id).x - origins.at(-1)! > 160)
        origins.push(position(area.id).x);
    const columns = Array.from(
      { length: Math.max(2, origins.length) },
      (_, i) => `${panelId}-column-${i}`,
    );
    doc.panels[panelId] = {
      ...panel,
      viewport: { x: 0, y: 0, zoom: 1 },
      columns,
    };
    for (const area of areas) {
      if (area.type !== 'area') continue;
      const titles = [area.title];
      let parent = area.parentId;
      while (parent) {
        const p = old.items[parent];
        if (p.type === 'area') titles.unshift(p.title);
        parent = p.parentId;
      }
      const column = origins.reduce(
        (found, x, i) => (position(area.id).x >= x ? i : found),
        0,
      );
      doc.items[area.id] = {
        id: area.id,
        type: 'area',
        parentId: null,
        panelId,
        title: titles.join(' › '),
        columnId: columns[column],
        order: 0,
        taskColumns: 2,
        color: area.color,
        fontSize: area.fontSize,
        createdAt: area.createdAt,
        updatedAt: area.updatedAt,
      };
    }
    for (const columnId of columns)
      Object.values(doc.items)
        .filter(
          (i) =>
            i.type === 'area' &&
            i.panelId === panelId &&
            i.columnId === columnId,
        )
        .sort((a, b) => reading(a.id, b.id))
        .forEach((item, order) => (item.order = order));
    const loose = Object.values(old.items).filter(
      (i) => i.panelId === panelId && i.type === 'task' && !i.parentId,
    );
    let unsorted = `grid-unsorted-${panelId}`;
    while (old.items[unsorted] || doc.items[unsorted]) unsorted += '_';
    if (loose.length)
      doc.items[unsorted] = {
        id: unsorted,
        type: 'area',
        parentId: null,
        panelId,
        title: 'Unsorted',
        columnId: columns[0],
        order: areas.length,
        taskColumns: 2,
        color: null,
        fontSize: 24,
        createdAt: panel.createdAt,
        updatedAt: panel.updatedAt,
      };
    const tasks = Object.values(old.items)
      .filter((i) => i.panelId === panelId && i.type === 'task')
      .sort((a, b) => reading(a.id, b.id));
    for (const task of tasks) {
      if (task.type !== 'task') continue;
      const parentId = task.parentId ?? unsorted;
      const siblings = tasks.filter(
        (t) => (t.parentId ?? unsorted) === parentId,
      );
      const xs = siblings.map((t) => position(t.id).x).sort((a, b) => a - b);
      const split = xs.findIndex((x, i) => i > 0 && x - xs[i - 1] > 80);
      const order = siblings.findIndex((t) => t.id === task.id);
      const column =
        split > 0 ? Number(position(task.id).x >= xs[split]) : order % 2;
      doc.items[task.id] = {
        id: task.id,
        type: 'task',
        parentId,
        panelId,
        order,
        column: column as 0 | 1,
        title: task.title,
        description: task.description,
        state: task.state,
        important: task.important,
        subtasks: structuredClone(task.subtasks),
        subtasksExpanded: task.subtasksExpanded,
        collapsed: task.collapsed,
        titleFontSize: task.titleFontSize,
        createdAt: task.createdAt,
        updatedAt: task.updatedAt,
      };
    }
  }
  return validateGrid(doc);
}
export function validateGrid(d: Doc): Doc {
  if (
    d.schemaVersion !== 4 ||
    !record(d.panels) ||
    !record(d.items) ||
    !record(d.settings) ||
    !Array.isArray(d.panelOrder) ||
    d.panelOrder.length !== Object.keys(d.panels).length ||
    new Set(d.panelOrder).size !== d.panelOrder.length ||
    d.panelOrder.some((id) => !d.panels[id])
  )
    throw new Error('Invalid saved grid document.');
  for (const [id, p] of Object.entries(d.panels))
    if (
      !p ||
      p.id !== id ||
      typeof p.title !== 'string' ||
      !Array.isArray(p.columns) ||
      !p.columns.length ||
      new Set(p.columns).size !== p.columns.length ||
      p.columns.some((c) => typeof c !== 'string' || !c) ||
      !p.viewport ||
      !finite(
        p.createdAt,
        p.updatedAt,
        p.viewport.x,
        p.viewport.y,
        p.viewport.zoom,
      )
    )
      throw new Error('Invalid saved panel.');
  for (const [id, item] of Object.entries(d.items)) {
    if (
      !item ||
      item.id !== id ||
      !d.panels[item.panelId] ||
      !finite(item.order, item.createdAt, item.updatedAt) ||
      item.order < 0 ||
      typeof item.title !== 'string'
    )
      throw new Error('Invalid saved grid item.');
    if (item.type === 'area') {
      if (
        item.parentId !== null ||
        !d.panels[item.panelId].columns.includes(item.columnId) ||
        ![1, 2].includes(item.taskColumns) ||
        !finite(item.fontSize) ||
        item.fontSize < 14 ||
        item.fontSize > 72 ||
        (item.color !== null && !/^#[\da-f]{6}$/i.test(item.color))
      )
        throw new Error('Invalid saved area.');
    } else if (item.type === 'task') {
      const parent: Item | undefined = d.items[item.parentId];
      if (
        parent?.type !== 'area' ||
        parent.panelId !== item.panelId ||
        ![0, 1].includes(item.column) ||
        typeof item.description !== 'string' ||
        !STATES.includes(item.state) ||
        typeof item.important !== 'boolean' ||
        typeof item.collapsed !== 'boolean' ||
        typeof item.subtasksExpanded !== 'boolean' ||
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
        )
      )
        throw new Error('Invalid saved task.');
    } else throw new Error('Invalid saved item type.');
  }
  const s = d.settings;
  if (
    !s.stateColors ||
    STATES.some((state) => !/^#[\da-f]{6}$/i.test(s.stateColors[state])) ||
    !/^#[\da-f]{6}$/i.test(s.importantColor) ||
    typeof s.showDone !== 'boolean' ||
    !finite(s.taskTitleSize) ||
    s.taskTitleSize < 12 ||
    s.taskTitleSize > 32 ||
    !['clickPattern', 'choices'].includes(s.stateControl)
  )
    throw new Error('Invalid saved settings.');
  if (d.agenda !== undefined) {
    const a = d.agenda;
    if (
      !record(a) ||
      typeof a.title !== 'string' ||
      !Number.isInteger(a.position) ||
      a.position < 0 ||
      typeof a.hidePast !== 'boolean' ||
      !record(a.entries)
    )
      throw new Error('Invalid saved agenda.');
    for (const [id, entry] of Object.entries(a.entries))
      if (
        !record(entry) ||
        entry.id !== id ||
        typeof entry.title !== 'string' ||
        !isDateKey(entry.date) ||
        !finite(entry.createdAt, entry.updatedAt)
      )
        throw new Error('Invalid saved agenda entry.');
  }
  return d;
}
