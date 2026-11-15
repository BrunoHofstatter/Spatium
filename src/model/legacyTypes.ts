export type ID = string;
export const STATES = ['blank', 'delayed', 'inProgress', 'done'] as const;
export type TaskState = (typeof STATES)[number];
export const STATE_LABELS: Record<TaskState, string> = {
  blank: 'Blank',
  delayed: 'Delayed',
  inProgress: 'In Progress',
  done: 'Done',
};
export type Highlight = TaskState | 'important';
export interface Point {
  x: number;
  y: number;
}
export interface Viewport extends Point {
  zoom: number;
}
export interface Panel {
  id: ID;
  title: string;
  viewport: Viewport;
  createdAt: number;
  updatedAt: number;
}
export interface ItemBase extends Point {
  id: ID;
  panelId: ID;
  parentId: ID | null;
  w: number;
  h: number;
  z: number;
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
  title: string;
  color: string | null;
  collapsed: boolean;
  fontSize: number;
}
export interface NoteItem extends ItemBase {
  type: 'note';
  text: string;
}
export type Item = TaskItem | AreaItem | NoteItem;
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
}
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
