import { STATES, type Doc, type Item } from './legacyTypes';
export function validateLegacy(raw: unknown): Doc {
  if (!raw || typeof raw !== 'object')
    throw new Error('The saved document could not be read.');
  const d = structuredClone(raw) as Doc;
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
  return d;
}
