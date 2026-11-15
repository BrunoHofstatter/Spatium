import { create } from 'zustand';
import { produce } from 'immer';
import { nanoid } from 'nanoid';
import {
  DEFAULT_SETTINGS,
  type Doc,
  type Highlight,
  type Item,
  type Point,
  type Settings,
  type Subtask,
  type Viewport,
} from './types';
import {
  absolutePosition,
  areaAt,
  descendants,
  growAncestors,
  INSET,
  isVisible,
  MIN_SIZE,
  MIN_AREA_FONT,
  MAX_AREA_FONT,
  reparent,
  rootsOfSelection,
  TOP,
} from './geometry';
import { HISTORY_LIMIT, preserveView } from './history';
import { layoutTasks, MIN_TASK_FONT, MAX_TASK_FONT } from './taskLayout';
import { snapMovement } from './snapping';

export function createDocument(): Doc {
  const id = nanoid();
  const now = Date.now();
  return {
    schemaVersion: 3,
    panels: {
      [id]: {
        id,
        title: 'Personal',
        viewport: { x: 80, y: 80, zoom: 1 },
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
  beginHistoryGroup(key: string): void;
  endHistoryGroup(key: string): void;
  hydrate(doc: Doc): void;
  transact(edit: (doc: Doc) => void, record?: boolean): void;
  undo(): void;
  redo(): void;
  select(ids: string[]): void;
  setSelectionMode(enabled: boolean): void;
  setEditing(id: string | null): void;
  toggleHighlight(value: Highlight): void;
  createPanel(title: string): string;
  renamePanel(id: string, title: string): void;
  deletePanel(id: string): void;
  reorderPanels(ids: string[]): void;
  setViewport(id: string, view: Viewport): void;
  setSettings(settings: Partial<Settings>, record?: boolean): void;
  createItem(
    type: Item['type'],
    panelId: string,
    point: Point,
    parentId?: string | null,
  ): string;
  updateItem(id: string, patch: Partial<Item>): void;
  setTaskFonts(ids: string[], fontSize: number | null): void;
  moveItems(
    ids: string[],
    delta: Point,
    pointer: Point,
    snapTolerance?: number,
  ): void;
  resizeItem(
    id: string,
    rect: { x: number; y: number; w: number; h: number },
  ): void;
  deleteItems(ids: string[]): void;
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
  beginHistoryGroup: (key) => set({ historyGroup: { key, recorded: false } }),
  endHistoryGroup: (key) => {
    if (get().historyGroup?.key === key) set({ historyGroup: null });
  },
  hydrate: (doc) =>
    set({
      doc,
      ready: true,
      past: [],
      future: [],
      selection: [],
      selectionMode: false,
      editingId: null,
      historyGroup: null,
      error: null,
    }),
  transact: (edit, record = true) => {
    const current = get();
    let next = produce(current.doc, edit);
    if (
      record &&
      (next.items !== current.doc.items ||
        next.settings.taskTitleSize !== current.doc.settings.taskTitleSize)
    ) {
      const edited = next;
      next = produce(edited, (draft) => {
        for (const id of layoutTasks(draft, current.doc, edited))
          growAncestors(draft, id);
      });
    }
    if (next.items !== current.doc.items) {
      const changedPanels = new Set<string>();
      for (const id of new Set([
        ...Object.keys(current.doc.items),
        ...Object.keys(next.items),
      ])) {
        if (next.items[id] !== current.doc.items[id])
          changedPanels.add((next.items[id] ?? current.doc.items[id]).panelId);
      }
      next = produce(next, (draft) => {
        for (const id of changedPanels)
          if (draft.panels[id]) draft.panels[id].updatedAt = Date.now();
      });
    }
    if (next === current.doc) return;
    set({
      doc: next,
      ...(next.items !== current.doc.items ||
      next.settings !== current.doc.settings
        ? {
            selection: current.selection.filter(
              (id) => next.items[id] && isVisible(next, next.items[id]),
            ),
            editingId:
              current.editingId &&
              next.items[current.editingId] &&
              isVisible(next, next.items[current.editingId])
                ? current.editingId
                : null,
          }
        : {}),
      ...(record
        ? {
            past: current.historyGroup?.recorded
              ? current.past
              : [...current.past, current.doc].slice(-HISTORY_LIMIT),
            future: [],
            historyGroup: current.historyGroup
              ? { ...current.historyGroup, recorded: true }
              : null,
          }
        : {}),
    });
  },
  undo: () => {
    const s = get(),
      previous = s.past.at(-1);
    if (previous)
      set({
        doc: preserveView(previous, s.doc),
        past: s.past.slice(0, -1),
        future: [...s.future, s.doc],
        selection: [],
        editingId: null,
        historyGroup: null,
      });
  },
  redo: () => {
    const s = get(),
      next = s.future.at(-1);
    if (next)
      set({
        doc: preserveView(next, s.doc),
        past: [...s.past, s.doc],
        future: s.future.slice(0, -1),
        selection: [],
        editingId: null,
        historyGroup: null,
      });
  },
  select: (ids) => {
    set({ selection: ids });
    get().transact((doc) => {
      for (const id of rootsOfSelection(doc.items, ids)) {
        const item = doc.items[id];
        const max = Math.max(
          0,
          ...Object.values(doc.items)
            .filter(
              (i) => i.parentId === item.parentId && i.panelId === item.panelId,
            )
            .map((i) => i.z),
        );
        if (item.z < max) {
          item.z = max + 1;
          item.updatedAt = Date.now();
        }
      }
    }, false);
  },
  setEditing: (editingId) => set({ editingId }),
  setSelectionMode: (selectionMode) => set({ selectionMode, editingId: null }),
  toggleHighlight: (value) =>
    set((s) => ({
      highlights: s.highlights.includes(value)
        ? s.highlights.filter((h) => h !== value)
        : [...s.highlights, value],
    })),
  createPanel: (title) => {
    const id = nanoid();
    get().transact((doc) => {
      const now = Date.now();
      doc.panels[id] = {
        id,
        title: title.trim() || 'Untitled panel',
        viewport: { x: 80, y: 80, zoom: 1 },
        createdAt: now,
        updatedAt: now,
      };
      doc.panelOrder.push(id);
    });
    return id;
  },
  renamePanel: (id, title) =>
    get().transact((doc) => {
      if (
        doc.panels[id] &&
        title.trim() &&
        doc.panels[id].title !== title.trim()
      ) {
        doc.panels[id].title = title.trim();
        doc.panels[id].updatedAt = Date.now();
      }
    }),
  deletePanel: (id) =>
    get().transact((doc) => {
      delete doc.panels[id];
      doc.panelOrder = doc.panelOrder.filter((p) => p !== id);
      for (const item of Object.values(doc.items))
        if (item.panelId === id) delete doc.items[item.id];
    }),
  reorderPanels: (ids) =>
    get().transact((doc) => {
      if (
        ids.length === doc.panelOrder.length &&
        new Set(ids).size === ids.length &&
        ids.every((id) => doc.panels[id])
      )
        doc.panelOrder = ids;
    }),
  setViewport: (id, view) =>
    get().transact((doc) => {
      if (doc.panels[id]) doc.panels[id].viewport = view;
    }, false),
  setSettings: (settings, record = true) => {
    get().transact((doc) => {
      Object.assign(doc.settings, settings);
      doc.settings.taskTitleSize = Math.max(
        MIN_TASK_FONT,
        Math.min(MAX_TASK_FONT, doc.settings.taskTitleSize),
      );
    }, record);
    if (settings.showDone === false)
      set((s) => ({
        highlights: s.highlights.filter((h) => h !== 'done'),
        selection: s.selection.filter((id) => {
          const i = s.doc.items[id];
          return i && (i.type !== 'task' || i.state !== 'done');
        }),
      }));
  },
  createItem: (type, panelId, point, parentId) => {
    const id = nanoid();
    get().transact((doc) => {
      if (!doc.panels[panelId]) return;
      const parent =
        parentId === undefined ? areaAt(doc, panelId, point) : parentId;
      const origin = parent
        ? absolutePosition(doc.items, parent)
        : { x: -INSET, y: -TOP };
      const now = Date.now();
      const base = {
        id,
        panelId,
        parentId: parent,
        x: point.x - origin.x - INSET,
        y: point.y - origin.y - TOP,
        w: type === 'area' ? 420 : type === 'task' ? 260 : 220,
        h: type === 'area' ? 280 : type === 'task' ? 140 : 100,
        z:
          Math.max(
            0,
            ...Object.values(doc.items)
              .filter((i) => i.panelId === panelId && i.parentId === parent)
              .map((i) => i.z),
          ) + 1,
        createdAt: now,
        updatedAt: now,
      };
      doc.items[id] =
        type === 'task'
          ? {
              ...base,
              type,
              title: 'Untitled task',
              description: '',
              state: 'blank',
              important: false,
              subtasks: [],
              subtasksExpanded: false,
              collapsed: true,
              titleFontSize: null,
            }
          : type === 'area'
            ? {
                ...base,
                type,
                title: 'Untitled area',
                color: null,
                collapsed: false,
                fontSize: 24,
              }
            : { ...base, type, text: '' };
      growAncestors(doc, id);
    });
    set({ selection: [id], editingId: id });
    return id;
  },
  updateItem: (id, patch) =>
    get().transact((doc) => {
      const item = doc.items[id];
      if (!item) return;
      // Identity and geometry are updated only by their dedicated actions.
      const allowed =
        item.type === 'task'
          ? [
              'title',
              'description',
              'state',
              'important',
              'subtasksExpanded',
              'collapsed',
              'titleFontSize',
            ]
          : item.type === 'area'
            ? ['title', 'color', 'collapsed', 'fontSize']
            : ['text'];
      const updates = Object.fromEntries(
        Object.entries(patch).filter(
          ([key, value]) =>
            allowed.includes(key) &&
            value !== (item as unknown as Record<string, unknown>)[key],
        ),
      );
      if (!Object.keys(updates).length) return;
      Object.assign(item, updates, { updatedAt: Date.now() });
      if (item.type === 'area')
        item.fontSize = Math.max(
          MIN_AREA_FONT,
          Math.min(MAX_AREA_FONT, item.fontSize),
        );
      growAncestors(doc, id);
    }),
  setTaskFonts: (ids, fontSize) =>
    get().transact((doc) => {
      for (const id of ids) {
        const item = doc.items[id];
        if (item?.type === 'task') {
          item.titleFontSize =
            fontSize === null
              ? null
              : Math.max(MIN_TASK_FONT, Math.min(MAX_TASK_FONT, fontSize));
          item.updatedAt = Date.now();
        }
      }
    }),
  moveItems: (ids, delta, pointer, snapTolerance = 6) =>
    get().transact((doc) => {
      const roots = rootsOfSelection(doc.items, ids);
      if (!roots.length) return;
      const snapped = snapMovement(
        doc,
        roots,
        delta,
        doc.panels[doc.items[roots[0]].panelId].viewport.zoom,
        snapTolerance,
      );
      const dx = snapped.delta.x,
        dy = snapped.delta.y;
      const excluded = new Set(
        roots.flatMap((id) => [id, ...descendants(doc.items, id)]),
      );
      for (const id of roots) {
        const i = doc.items[id];
        i.x += dx;
        i.y += dy;
        i.updatedAt = Date.now();
      }
      // Choose all destinations before growing or reparenting changes any hit-test geometry.
      const anchor = absolutePosition(doc.items, roots[0]);
      const parents = roots.map((id) => {
        const position = absolutePosition(doc.items, id);
        return areaAt(
          doc,
          doc.items[id].panelId,
          {
            x: pointer.x + position.x - anchor.x,
            y: pointer.y + position.y - anchor.y,
          },
          excluded,
        );
      });
      roots.forEach((id, i) => reparent(doc, id, parents[i]));
      roots.forEach((id) => growAncestors(doc, id));
    }),
  resizeItem: (id, rect) =>
    get().transact((doc) => {
      const item = doc.items[id];
      if (!item) return;
      const previous = { x: item.x, y: item.y };
      item.x = rect.x;
      item.y = rect.y;
      item.w = Math.max(MIN_SIZE[item.type].w, rect.w);
      if (item.type !== 'task')
        item.h = Math.max(MIN_SIZE[item.type].h, rect.h);
      item.updatedAt = Date.now();
      if (item.type === 'area') {
        for (const child of Object.values(doc.items))
          if (child.parentId === id) {
            child.x += previous.x - item.x;
            child.y += previous.y - item.y;
            child.updatedAt = Date.now();
          }
        for (const child of Object.values(doc.items))
          if (child.parentId === id) growAncestors(doc, child.id);
      }
      growAncestors(doc, id);
    }),
  deleteItems: (ids) => {
    get().transact((doc) => {
      for (const id of rootsOfSelection(doc.items, ids))
        for (const child of [id, ...descendants(doc.items, id)])
          delete doc.items[child];
    });
    set({ selection: [], editingId: null });
  },
  addSubtask: (id) => {
    const subId = nanoid();
    get().transact((doc) => {
      const item = doc.items[id];
      if (item?.type === 'task') {
        item.subtasks.push({ id: subId, title: '', state: 'blank' });
        item.subtasksExpanded = true;
        item.collapsed = false;
        item.updatedAt = Date.now();
        growAncestors(doc, id);
      }
    });
    return subId;
  },
  updateSubtask: (id, subId, patch) =>
    get().transact((doc) => {
      const item = doc.items[id];
      if (item?.type !== 'task') return;
      const sub = item.subtasks.find((s) => s.id === subId);
      if (
        sub &&
        ((patch.title !== undefined && sub.title !== patch.title) ||
          (patch.state !== undefined && sub.state !== patch.state))
      ) {
        if (patch.title !== undefined) sub.title = patch.title;
        if (patch.state !== undefined) sub.state = patch.state;
        item.updatedAt = Date.now();
        growAncestors(doc, id);
      }
    }),
  deleteSubtask: (id, subId) =>
    get().transact((doc) => {
      const item = doc.items[id];
      if (item?.type === 'task') {
        item.subtasks = item.subtasks.filter((s) => s.id !== subId);
        item.updatedAt = Date.now();
      }
    }),
  reorderSubtasks: (id, from, to, after) =>
    get().transact((doc) => {
      const item = doc.items[id];
      if (item?.type !== 'task' || from === to) return;
      const a = item.subtasks.findIndex((s) => s.id === from),
        b = item.subtasks.findIndex((s) => s.id === to);
      if (a >= 0 && b >= 0) {
        const [sub] = item.subtasks.splice(a, 1);
        const index =
          after === undefined
            ? b
            : item.subtasks.findIndex((s) => s.id === to) + Number(after);
        item.subtasks.splice(index, 0, sub);
        item.updatedAt = Date.now();
      }
    }),
}));
