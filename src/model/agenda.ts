import { AGENDA_ID, EMPTY_AGENDA, type AgendaEntry, type Doc } from './types';

export const agendaOf = (doc: Doc) => doc.agenda ?? EMPTY_AGENDA;

// Panels plus the Agenda card, in Home order.
export function homeOrder(panelOrder: string[], position = 0): string[] {
  const at = Math.max(0, Math.min(panelOrder.length, Math.floor(position)));
  return [...panelOrder.slice(0, at), AGENDA_ID, ...panelOrder.slice(at)];
}

const pad = (n: number) => String(n).padStart(2, '0');
export const dateKey = (year: number, month: number, day: number) =>
  `${year}-${pad(month + 1)}-${pad(day)}`;
export const todayKey = (now = new Date()) =>
  dateKey(now.getFullYear(), now.getMonth(), now.getDate());
export function parseDateKey(key: string) {
  const [year, month, day] = key.split('-').map(Number);
  return { year, month: month - 1, day };
}
export function isDateKey(value: unknown): value is string {
  if (typeof value !== 'string' || !/^\d{4}-\d{2}-\d{2}$/.test(value))
    return false;
  const { year, month, day } = parseDateKey(value),
    date = new Date(Date.UTC(year, month, day));
  return (
    year >= 1000 &&
    date.getUTCFullYear() === year &&
    date.getUTCMonth() === month &&
    date.getUTCDate() === day
  );
}
export const WEEKDAYS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
export const WEEKDAY_NAMES = [
  'Sunday',
  'Monday',
  'Tuesday',
  'Wednesday',
  'Thursday',
  'Friday',
  'Saturday',
];
export const MONTHS = [
  'January',
  'February',
  'March',
  'April',
  'May',
  'June',
  'July',
  'August',
  'September',
  'October',
  'November',
  'December',
];
export function weekday(key: string) {
  const { year, month, day } = parseDateKey(key);
  return new Date(Date.UTC(year, month, day)).getUTCDay();
}
/** DD/MM */
export function dayMonth(key: string) {
  const { month, day } = parseDateKey(key);
  return `${pad(day)}/${pad(month + 1)}`;
}
/** DD/MM/YYYY */
export function fullDate(key: string) {
  return `${dayMonth(key)}/${parseDateKey(key).year}`;
}
export function spokenDate(key: string) {
  const { year, month, day } = parseDateKey(key);
  return `${WEEKDAY_NAMES[weekday(key)]} ${day} ${MONTHS[month]} ${year}`;
}
export const monthLabel = (year: number, month: number) =>
  `${MONTHS[month]} ${year}`;

/** Weeks of a month starting on Sunday; days outside the month are null. */
export function calendarWeeks(year: number, month: number) {
  const first = new Date(Date.UTC(year, month, 1)).getUTCDay(),
    days = new Date(Date.UTC(year, month + 1, 0)).getUTCDate();
  const cells: (string | null)[] = Array.from({ length: first }, () => null);
  for (let day = 1; day <= days; day++) cells.push(dateKey(year, month, day));
  while (cells.length % 7) cells.push(null);
  return Array.from({ length: cells.length / 7 }, (_, i) =>
    cells.slice(i * 7, i * 7 + 7),
  );
}

export const compareEntries = (a: AgendaEntry, b: AgendaEntry) =>
  (a.date < b.date ? -1 : a.date > b.date ? 1 : 0) ||
  a.createdAt - b.createdAt ||
  (a.id < b.id ? -1 : a.id > b.id ? 1 : 0);
export const sortedEntries = (entries: Record<string, AgendaEntry>) =>
  Object.values(entries).sort(compareEntries);

export interface AgendaDay {
  date: string;
  entries: AgendaEntry[];
}
export interface AgendaMonth {
  key: string;
  label: string;
  days: AgendaDay[];
}
/** Sorted entries grouped by month, then by day. */
export function groupEntries(entries: AgendaEntry[]): AgendaMonth[] {
  const months: AgendaMonth[] = [];
  for (const entry of [...entries].sort(compareEntries)) {
    const { year, month } = parseDateKey(entry.date),
      key = entry.date.slice(0, 7);
    let group = months.at(-1);
    if (group?.key !== key) {
      group = { key, label: monthLabel(year, month), days: [] };
      months.push(group);
    }
    let day = group.days.at(-1);
    if (day?.date !== entry.date) {
      day = { date: entry.date, entries: [] };
      group.days.push(day);
    }
    day.entries.push(entry);
  }
  return months;
}
