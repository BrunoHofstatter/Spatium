export type ID = string;
export const STATES = ['blank', 'delayed', 'inProgress', 'done'] as const;
export const STATE_LABELS = {
  blank: 'Blank',
  delayed: 'Delayed',
  inProgress: 'In Progress',
  done: 'Done',
};
export type TaskState = (typeof STATES)[number];
export type Highlight = TaskState | 'important';
export interface Point {
  x: number;
  y: number;
}
// Device-local board scroll, retained under this name for existing sync checkpoints.
export interface Viewport extends Point {
  zoom: number;
}
export interface Panel {
  id: ID;
  title: string;
  columns: string[];
  viewport: Viewport;
  createdAt: number;
  updatedAt: number;
}
interface ItemBase {
  id: ID;
  panelId: ID;
  order: number;
  createdAt: number;
  updatedAt: number;
}
export interface Subtask {
  id: ID;
  title: string;
  state: TaskState;
}
export interface TaskItem extends ItemBase {
  type: 'task';
  parentId: ID;
  column: 0 | 1;
  title: string;
  description: string;
  state: TaskState;
  important: boolean;
  subtasks: Subtask[];
  subtasksExpanded: boolean;
  collapsed: boolean;
  titleFontSize: number | null;
}
export interface AreaItem extends ItemBase {
  type: 'area';
  parentId: null;
  columnId: string;
  taskColumns: 1 | 2;
  title: string;
  color: string | null;
  fontSize: number;
}
export type Item = TaskItem | AreaItem;
export interface Settings {
  stateColors: Record<TaskState, string>;
  importantColor: string;
  showDone: boolean;
  stateControl: 'clickPattern' | 'choices';
  taskTitleSize: number;
}
export interface Doc {
  schemaVersion: number;
  panels: Record<ID, Panel>;
  panelOrder: ID[];
  items: Record<ID, Item>;
  settings: Settings;
  // Optional so version-4 documents without an agenda stay valid for every client.
  agenda?: Agenda;
}
// A dated agenda entry. `date` is a local calendar day written as YYYY-MM-DD.
export interface AgendaEntry {
  id: ID;
  title: string;
  date: string;
  createdAt: number;
  updatedAt: number;
}
export interface Agenda {
  title: string;
  // Index of the Agenda card among the Home panels.
  position: number;
  hidePast: boolean;
  entries: Record<ID, AgendaEntry>;
}
export const AGENDA_ID = 'agenda';
export const EMPTY_AGENDA: Readonly<Agenda> = Object.freeze({
  title: 'Agenda',
  position: 0,
  hidePast: false,
  entries: Object.freeze({}) as Record<ID, AgendaEntry>,
});
export const DEFAULT_COLORS = {
  blank: '#8b93a6',
  delayed: '#d49a2a',
  inProgress: '#5085db',
  done: '#49a77c',
};
export const DEFAULT_SETTINGS: Settings = {
  stateColors: DEFAULT_COLORS,
  importantColor: '#d35b7b',
  showDone: true,
  stateControl: 'clickPattern',
  taskTitleSize: 16,
};
