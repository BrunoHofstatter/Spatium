import { create } from 'zustand';
import { produce } from 'immer';
import { nanoid } from 'nanoid';
import {
  AGENDA_ID,
  DEFAULT_SETTINGS,
  type AgendaEntry,
  type Doc,
  type Highlight,
  type Item,
  type Settings,
  type Subtask,
  type TaskItem,
  type Viewport,
} from './types';
import { HISTORY_LIMIT, preserveView } from './history';
import { agendaOf, homeOrder, isDateKey } from './agenda';
const agendaDraft = (d: Doc) =>
  (d.agenda ??= structuredClone({ ...agendaOf(d) }));
export const ordered = <T extends { order: number; id: string }>(items: T[]) =>
  items.sort(
    (a, b) => a.order - b.order || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0),
  );
export const areaTasks = (doc: Doc, id: string, visible = false) =>
  ordered(
    Object.values(doc.items).filter(
      (i): i is TaskItem =>
        i.type === 'task' &&
        i.parentId === id &&
        (!visible || doc.settings.showDone || i.state !== 'done'),
    ),
  );
export function createDocument(): Doc {
  const id = nanoid(),
    now = Date.now();
  return {
    schemaVersion: 4,
    panels: {
      [id]: {
        id,
        title: 'Personal',
        columns: [`${id}-column-0`, `${id}-column-1`],
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: now,
        updatedAt: now,
      },
    },
    panelOrder: [id],
    items: {},
    settings: structuredClone(DEFAULT_SETTINGS),
  };
}
interface Store {
  doc: Doc;
  ready: boolean;
  error: string | null;
  selection: string[];
  selectionMode: boolean;
  highlights: Highlight[];
  editingId: string | null;
  past: Doc[];
  future: Doc[];
  historyGroup: { key: string; recorded: boolean } | null;
  hydrate(doc: Doc): void;
  transact(edit: (doc: Doc) => void, record?: boolean): void;
  beginHistoryGroup(key: string): void;
  endHistoryGroup(key: string): void;
  undo(): void;
  redo(): void;
  select(ids: string[]): void;
  setSelectionMode(value: boolean): void;
  setEditing(id: string | null): void;
  toggleHighlight(value: Highlight): void;
  createPanel(title: string): string;
  renamePanel(id: string, title: string): void;
  deletePanel(id: string): void;
  reorderPanels(ids: string[]): void;
  reorderHome(ids: string[]): void;
  renameAgenda(title: string): void;
  setAgendaHidePast(value: boolean): void;
  addAgendaEntry(title: string, date: string): string | null;
  updateAgendaEntry(
    id: string,
    patch: Partial<Pick<AgendaEntry, 'title' | 'date'>>,
  ): void;
  deleteAgendaEntry(id: string): void;
  setViewport(id: string, view: Viewport): void;
  setSettings(settings: Partial<Settings>, record?: boolean): void;
  createArea(panelId: string, columnId?: string): string;
  createTask(areaId: string, column?: 0 | 1): string;
  updateItem(id: string, patch: Partial<Item>): void;
  setTaskFonts(ids: string[], size: number | null): void;
  deleteItems(ids: string[]): void;
  moveArea(id: string, columnId: string | 'new', before?: string): void;
  removeColumn(panelId: string, columnId: string): void;
  moveTasks(
    ids: string[],
    areaId: string,
    column?: 0 | 1,
    before?: string,
  ): void;
  addSubtask(id: string): string;
  updateSubtask(id: string, subId: string, patch: Partial<Subtask>): void;
  deleteSubtask(id: string, subId: string): void;
  reorderSubtasks(id: string, from: string, to: string, after?: boolean): void;
}
export const useStore = create<Store>((set, get) => ({
  doc: createDocument(),
  ready: false,
  error: null,
  selection: [],
  selectionMode: false,
  highlights: [],
  editingId: null,
  past: [],
  future: [],
  historyGroup: null,
  hydrate: (doc) =>
    set({
      doc,
      ready: true,
      error: null,
      selection: [],
      selectionMode: false,
      editingId: null,
      past: [],
      future: [],
      historyGroup: null,
    }),
  beginHistoryGroup: (key) => set({ historyGroup: { key, recorded: false } }),
  endHistoryGroup: (key) => {
    if (get().historyGroup?.key === key) set({ historyGroup: null });
  },
  transact: (edit, record = true) => {
    const s = get();
    let next = produce(s.doc, edit);
    if (next === s.doc) return;
    if (next.items !== s.doc.items) {
      const panels = new Set(
        Object.keys({ ...s.doc.items, ...next.items })
          .filter((id) => s.doc.items[id] !== next.items[id])
          .map((id) => (next.items[id] ?? s.doc.items[id]).panelId),
      );
      next = produce(next, (d) => {
        for (const id of panels)
          if (d.panels[id]) d.panels[id].updatedAt = Date.now();
      });
    }
    const visible = (id: string) =>
      next.items[id] &&
      (next.items[id].type !== 'task' ||
        next.settings.showDone ||
        next.items[id].state !== 'done');
    set({
      doc: next,
      selection: s.selection.filter(visible),
      editingId: s.editingId && visible(s.editingId) ? s.editingId : null,
      ...(record
        ? {
            past: s.historyGroup?.recorded
              ? s.past
              : [...s.past, s.doc].slice(-HISTORY_LIMIT),
            future: [],
            historyGroup: s.historyGroup
              ? { ...s.historyGroup, recorded: true }
              : null,
          }
        : {}),
    });
  },
  undo: () => {
    const s = get(),
      doc = s.past.at(-1);
    if (doc)
      set({
        doc: preserveView(doc, s.doc),
        past: s.past.slice(0, -1),
        future: [...s.future, s.doc],
        selection: [],
        editingId: null,
        historyGroup: null,
      });
  },
  redo: () => {
    const s = get(),
      doc = s.future.at(-1);
    if (doc)
      set({
        doc: preserveView(doc, s.doc),
        past: [...s.past, s.doc],
        future: s.future.slice(0, -1),
        selection: [],
        editingId: null,
        historyGroup: null,
      });
  },
  select: (selection) =>
    set({ selection: selection.filter((id) => !!get().doc.items[id]) }),
  setSelectionMode: (selectionMode) => set({ selectionMode, editingId: null }),
  setEditing: (editingId) => set({ editingId }),
  toggleHighlight: (h) =>
    set((s) => ({
      highlights: s.highlights.includes(h)
        ? s.highlights.filter((i) => i !== h)
        : [...s.highlights, h],
    })),
  createPanel: (title) => {
    const id = nanoid(),
      now = Date.now();
    get().transact((d) => {
      d.panels[id] = {
        id,
        title,
        columns: [`${id}-column-0`, `${id}-column-1`],
        viewport: { x: 0, y: 0, zoom: 1 },
        createdAt: now,
        updatedAt: now,
      };
      d.panelOrder.push(id);
    });
    return id;
  },
  renamePanel: (id, title) =>
    get().transact((d) => {
      if (d.panels[id] && title.trim() && d.panels[id].title !== title.trim()) {
        d.panels[id].title = title.trim();
        d.panels[id].updatedAt = Date.now();
      }
    }),
  deletePanel: (id) =>
    get().transact((d) => {
      const index = d.panelOrder.indexOf(id);
      // Keep the Agenda card in the same place relative to the remaining panels.
      if (d.agenda && index >= 0 && index < d.agenda.position)
        d.agenda.position--;
      delete d.panels[id];
      d.panelOrder = d.panelOrder.filter((p) => p !== id);
      for (const item of Object.values(d.items))
        if (item.panelId === id) delete d.items[item.id];
    }),
  reorderPanels: (ids) =>
    get().transact((d) => {
      if (
        ids.length === d.panelOrder.length &&
        new Set(ids).size === ids.length &&
        ids.every((id) => d.panels[id])
      )
        d.panelOrder = ids;
    }),
  reorderHome: (ids) =>
    get().transact((d) => {
      const current = homeOrder(d.panelOrder, agendaOf(d).position);
      if (
        ids.length !== current.length ||
        new Set(ids).size !== ids.length ||
        !ids.every((id) => current.includes(id)) ||
        ids.every((id, i) => id === current[i])
      )
        return;
      const panels = ids.filter((id) => id !== AGENDA_ID);
      if (panels.some((id, i) => id !== d.panelOrder[i])) d.panelOrder = panels;
      agendaDraft(d).position = ids.indexOf(AGENDA_ID);
    }),
  renameAgenda: (title) =>
    get().transact((d) => {
      if (title.trim() && agendaOf(d).title !== title.trim())
        agendaDraft(d).title = title.trim();
    }),
  setAgendaHidePast: (value) =>
    get().transact((d) => {
      if (agendaOf(d).hidePast !== value) agendaDraft(d).hidePast = value;
    }, false),
  addAgendaEntry: (title, date) => {
    if (!title.trim() || !isDateKey(date)) return null;
    const id = nanoid(),
      now = Date.now();
    get().transact((d) => {
      agendaDraft(d).entries[id] = {
        id,
        title: title.trim(),
        date,
        createdAt: now,
        updatedAt: now,
      };
    });
    return id;
  },
  updateAgendaEntry: (id, patch) =>
    get().transact((d) => {
      const entry = d.agenda?.entries[id];
      if (!entry) return;
      let changed = false;
      const title = patch.title?.trim();
      if (title && title !== entry.title) {
        entry.title = title;
        changed = true;
      }
      if (patch.date && isDateKey(patch.date) && patch.date !== entry.date) {
        entry.date = patch.date;
        changed = true;
      }
      if (changed) entry.updatedAt = Date.now();
    }),
  deleteAgendaEntry: (id) =>
    get().transact((d) => {
      if (d.agenda?.entries[id]) delete d.agenda.entries[id];
    }),
  setViewport: (id, viewport) => {
    const previous = get().doc.panels[id]?.viewport;
    if (
      previous &&
      previous.x === viewport.x &&
      previous.y === viewport.y &&
      previous.zoom === viewport.zoom
    )
      return;
    get().transact((d) => {
      if (d.panels[id]) d.panels[id].viewport = viewport;
    }, false);
  },
  setSettings: (settings, record = true) =>
    get().transact((d) => {
      Object.assign(d.settings, settings);
      d.settings.taskTitleSize = Math.max(
        12,
        Math.min(32, d.settings.taskTitleSize),
      );
    }, record),
  createArea: (panelId, columnId) => {
    const id = nanoid(),
      now = Date.now(),
      s = get(),
      panel = s.doc.panels[panelId];
    if (!panel) throw new Error('Panel does not exist.');
    const column =
      columnId && panel.columns.includes(columnId)
        ? columnId
        : panel.columns[0];
    get().transact((d) => {
      d.items[id] = {
        id,
        type: 'area',
        parentId: null,
        panelId,
        title: 'Untitled area',
        columnId: column,
        order:
          Math.max(
            -1,
            ...Object.values(d.items)
              .filter(
                (i) =>
                  i.type === 'area' &&
                  i.panelId === panelId &&
                  i.columnId === column,
              )
              .map((i) => i.order),
          ) + 1,
        taskColumns: 2,
        color: null,
        fontSize: 24,
        createdAt: now,
        updatedAt: now,
      };
    });
    set({ editingId: id });
    return id;
  },
  createTask: (areaId, column) => {
    const s = get(),
      area = s.doc.items[areaId];
    if (area?.type !== 'area') throw new Error('Choose an area first.');
    const tasks = areaTasks(s.doc, areaId),
      id = nanoid(),
      now = Date.now();
    const side =
      column ??
      (area.taskColumns === 1
        ? 0
        : tasks.filter((t) => t.column === 0).length <=
            tasks.filter((t) => t.column === 1).length
          ? 0
          : 1);
    get().transact((d) => {
      d.items[id] = {
        id,
        type: 'task',
        panelId: area.panelId,
        parentId: areaId,
        column: side,
        order: Math.max(-1, ...tasks.map((t) => t.order)) + 1,
        title: 'Untitled task',
        description: '',
        state: 'blank',
        important: false,
        subtasks: [],
        subtasksExpanded: false,
        collapsed: true,
        titleFontSize: null,
        createdAt: now,
        updatedAt: now,
      };
    });
    set({ selection: [id], editingId: id });
    return id;
  },
  updateItem: (id, patch) =>
    get().transact((d) => {
      const item = d.items[id];
      if (!item) return;
      const allowed =
        item.type === 'area'
          ? ['title', 'color', 'fontSize', 'taskColumns']
          : [
              'title',
              'description',
              'state',
              'important',
              'collapsed',
              'subtasksExpanded',
              'titleFontSize',
            ];
      let changed = false;
      for (const key of allowed) {
        if (
          key in patch &&
          (item as unknown as Record<string, unknown>)[key] !==
            (patch as Record<string, unknown>)[key]
        ) {
          (item as unknown as Record<string, unknown>)[key] = (
            patch as Record<string, unknown>
          )[key];
          changed = true;
        }
      }
      if (item.type === 'area')
        item.fontSize = Math.max(14, Math.min(72, item.fontSize));
      if (changed) item.updatedAt = Date.now();
    }),
  setTaskFonts: (ids, size) =>
    get().transact((d) => {
      for (const id of ids) {
        const item = d.items[id];
        if (item?.type === 'task') {
          item.titleFontSize =
            size === null ? null : Math.max(12, Math.min(32, size));
          item.updatedAt = Date.now();
        }
      }
    }),
  deleteItems: (ids) =>
    get().transact((d) => {
      const all = new Set(ids);
      for (const item of Object.values(d.items))
        if (item.type === 'task' && all.has(item.parentId)) all.add(item.id);
      for (const id of all) delete d.items[id];
    }),
  moveArea: (id, destination, before) =>
    get().transact((d) => {
      const item = d.items[id];
      if (item?.type !== 'area' || before === id) return;
      const panel = d.panels[item.panelId];
      let columnId = destination;
      if (destination === 'new') {
        columnId = nanoid();
        panel.columns.push(columnId);
      }
      if (!panel.columns.includes(columnId)) return;
      const list = ordered(
        Object.values(d.items).filter(
          (i) =>
            i.type === 'area' &&
            i.panelId === item.panelId &&
            i.columnId === columnId &&
            i.id !== id,
        ),
      );
      const at = before ? list.findIndex((i) => i.id === before) : -1;
      list.splice(at < 0 ? list.length : at, 0, item);
      item.columnId = columnId;
      list.forEach((i, n) => {
        i.order = n;
        i.updatedAt = Date.now();
      });
    }),
  removeColumn: (panelId, columnId) =>
    get().transact((d) => {
      const p = d.panels[panelId];
      if (
        p &&
        p.columns.length > 1 &&
        !Object.values(d.items).some(
          (i) =>
            i.type === 'area' &&
            i.panelId === panelId &&
            i.columnId === columnId,
        )
      ) {
        p.columns = p.columns.filter((c) => c !== columnId);
        p.updatedAt = Date.now();
      }
    }),
  moveTasks: (ids, areaId, column, before) =>
    get().transact((d) => {
      const area = d.items[areaId];
      if (area?.type !== 'area' || (before && ids.includes(before))) return;
      const moved = ids
        .map((id) => d.items[id])
        .filter((i): i is TaskItem => i?.type === 'task');
      const list = areaTasks(d, areaId).filter((t) => !ids.includes(t.id));
      const at = before ? list.findIndex((t) => t.id === before) : -1;
      list.splice(at < 0 ? list.length : at, 0, ...moved);
      for (const t of moved) {
        t.parentId = areaId;
        t.panelId = area.panelId;
        if (column !== undefined) t.column = column;
        t.updatedAt = Date.now();
      }
      list.forEach((t, i) => (t.order = i));
    }),
  addSubtask: (id) => {
    const subId = nanoid();
    get().transact((d) => {
      const item = d.items[id];
      if (item?.type === 'task') {
        item.collapsed = false;
        item.subtasksExpanded = true;
        item.subtasks.push({ id: subId, title: '', state: 'blank' });
        item.updatedAt = Date.now();
      }
    });
    return subId;
  },
  updateSubtask: (id, subId, patch) =>
    get().transact((d) => {
      const item = d.items[id];
      if (item?.type === 'task') {
        const sub = item.subtasks.find((s) => s.id === subId);
        if (sub) {
          if (patch.title !== undefined) sub.title = patch.title;
          if (patch.state !== undefined) sub.state = patch.state;
          item.updatedAt = Date.now();
        }
      }
    }),
  deleteSubtask: (id, subId) =>
    get().transact((d) => {
      const item = d.items[id];
      if (item?.type === 'task') {
        item.subtasks = item.subtasks.filter((s) => s.id !== subId);
        item.updatedAt = Date.now();
      }
    }),
  reorderSubtasks: (id, from, to, after = false) =>
    get().transact((d) => {
      const item = d.items[id];
      if (item?.type !== 'task' || from === to) return;
      const a = item.subtasks.findIndex((s) => s.id === from);
      if (a < 0 || !item.subtasks.some((s) => s.id === to)) return;
      const [sub] = item.subtasks.splice(a, 1);
      item.subtasks.splice(
        item.subtasks.findIndex((s) => s.id === to) + Number(after),
        0,
        sub,
      );
      item.updatedAt = Date.now();
    }),
}));
