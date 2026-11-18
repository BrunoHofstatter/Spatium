import { afterEach, beforeEach, expect, it, vi } from 'vitest';
import { createDocument, useStore } from './store';
import {
  agendaOf,
  calendarWeeks,
  dayMonth,
  fullDate,
  groupEntries,
  homeOrder,
  isDateKey,
  sortedEntries,
} from './agenda';
import { migrate, validateGrid } from './migration';
import { AGENDA_ID, type Doc } from './types';
import { hasWork, fingerprint } from '../sync/document';
import { settingsHref, settingsReturn } from './navigation';
const s = () => useStore.getState();
beforeEach(() => s().hydrate(createDocument()));
afterEach(() => vi.restoreAllMocks());

it('keeps documents without an agenda unchanged and valid', () => {
  const doc = createDocument();
  expect(doc.agenda).toBeUndefined();
  expect(migrate(structuredClone(doc))).toEqual(doc);
  expect(agendaOf(doc)).toMatchObject({
    title: 'Agenda',
    position: 0,
    hidePast: false,
  });
  expect(hasWork(doc)).toBe(false);
});

it('validates dates as real calendar days', () => {
  expect(isDateKey('2026-11-17')).toBe(true);
  expect(isDateKey('2028-02-29')).toBe(true);
  expect(isDateKey('2026-02-29')).toBe(false);
  expect(isDateKey('2026-13-01')).toBe(false);
  expect(isDateKey('17/11/2026')).toBe(false);
  expect(isDateKey('0099-01-01')).toBe(false);
  expect(dayMonth('2026-03-07')).toBe('07/03');
  expect(fullDate('2026-03-07')).toBe('07/03/2026');
});

it('builds Sunday-first calendar weeks', () => {
  // 1 November 2026 is a Sunday; 1 December 2026 is a Tuesday.
  expect(calendarWeeks(2026, 10)[0][0]).toBe('2026-11-01');
  const december = calendarWeeks(2026, 11);
  expect(december[0].slice(0, 3)).toEqual([null, null, '2026-12-01']);
  expect(december.flat().filter(Boolean)).toHaveLength(31);
  expect(december.every((week) => week.length === 7)).toBe(true);
});

it('adds, edits, deletes and undoes entries, sorted by date then creation', () => {
  let clock = 1000;
  vi.spyOn(Date, 'now').mockImplementation(() => clock++);
  expect(s().addAgendaEntry('   ', '2026-11-20')).toBeNull();
  expect(s().addAgendaEntry('Bad', '2026-02-30')).toBeNull();
  expect(s().doc.agenda).toBeUndefined();
  const trip = s().addAgendaEntry(' Trip ', '2026-12-05')!;
  const dentist = s().addAgendaEntry('Dentist', '2026-11-17')!;
  const essay = s().addAgendaEntry('Essay', '2026-11-17')!;
  expect(s().doc.agenda!.entries[trip].title).toBe('Trip');
  expect(sortedEntries(s().doc.agenda!.entries).map((e) => e.id)).toEqual([
    dentist,
    essay,
    trip,
  ]);
  const months = groupEntries(Object.values(s().doc.agenda!.entries));
  expect(months.map((m) => m.label)).toEqual([
    'November 2026',
    'December 2026',
  ]);
  expect(months[0].days).toHaveLength(1);
  expect(months[0].days[0].entries.map((e) => e.id)).toEqual([dentist, essay]);

  s().updateAgendaEntry(essay, { title: 'Essay due', date: '2026-11-30' });
  expect(s().doc.agenda!.entries[essay]).toMatchObject({
    title: 'Essay due',
    date: '2026-11-30',
  });
  s().undo();
  expect(s().doc.agenda!.entries[essay]).toMatchObject({
    title: 'Essay',
    date: '2026-11-17',
  });
  s().updateAgendaEntry(essay, { title: '  ', date: 'nope' });
  expect(s().doc.agenda!.entries[essay].title).toBe('Essay');
  s().deleteAgendaEntry(trip);
  expect(s().doc.agenda!.entries[trip]).toBeUndefined();
  s().undo();
  expect(s().doc.agenda!.entries[trip].title).toBe('Trip');
  expect(validateGrid(structuredClone(s().doc))).toEqual(s().doc);
  expect(hasWork(s().doc)).toBe(true);
});

it('keeps hide past out of undo history', () => {
  s().addAgendaEntry('Old', '2020-01-01');
  s().setAgendaHidePast(true);
  expect(s().past).toHaveLength(1);
  s().undo();
  expect(s().doc.agenda?.entries ?? {}).toEqual({});
  expect(agendaOf(s().doc).hidePast).toBe(true);
  s().redo();
  expect(agendaOf(s().doc).hidePast).toBe(true);
});

it('renames and reorders the Agenda among panels, keeping its place on delete', () => {
  const first = s().doc.panelOrder[0];
  const second = s().createPanel('Second');
  expect(homeOrder(s().doc.panelOrder, agendaOf(s().doc).position)).toEqual([
    AGENDA_ID,
    first,
    second,
  ]);
  s().reorderHome([first, AGENDA_ID, second]);
  expect(s().doc.panelOrder).toEqual([first, second]);
  expect(s().doc.agenda!.position).toBe(1);
  s().reorderHome([second, AGENDA_ID, first]);
  expect(s().doc.panelOrder).toEqual([second, first]);
  s().reorderHome([second, first]);
  s().reorderHome([second, AGENDA_ID, AGENDA_ID]);
  expect(s().doc.panelOrder).toEqual([second, first]);
  s().deletePanel(second);
  expect(homeOrder(s().doc.panelOrder, agendaOf(s().doc).position)).toEqual([
    AGENDA_ID,
    first,
  ]);
  s().renameAgenda('  Dates  ');
  expect(agendaOf(s().doc).title).toBe('Dates');
  s().renameAgenda(' ');
  expect(agendaOf(s().doc).title).toBe('Dates');
  // A stale position from another client is clamped.
  expect(homeOrder([first], 9)).toEqual([first, AGENDA_ID]);
});

it('rejects malformed agendas', () => {
  const base = () => {
    s().addAgendaEntry('Entry', '2026-11-17');
    return structuredClone(s().doc);
  };
  const broken: ((d: Doc) => void)[] = [
    (d) => (d.agenda!.position = -1),
    (d) => (d.agenda!.position = 1.5),
    (d) => ((d.agenda as unknown as { hidePast: string }).hidePast = 'no'),
    (d) => (Object.values(d.agenda!.entries)[0].date = '2026-02-31'),
    (d) => (Object.values(d.agenda!.entries)[0].id = 'other'),
    (d) => ((d as unknown as { agenda: null }).agenda = null),
  ];
  for (const breakIt of broken) {
    const doc = base();
    breakIt(doc);
    expect(() => validateGrid(doc)).toThrow();
  }
});

it('syncs the agenda as document content', () => {
  const before = fingerprint(s().doc);
  s().addAgendaEntry('Entry', '2026-11-17');
  expect(fingerprint(s().doc)).not.toBe(before);
});

it('returns from Settings to the Agenda', () => {
  expect(settingsHref('#/agenda')).toBe('#/settings?from=%23%2Fagenda');
  s().renameAgenda('Dates');
  expect(settingsReturn('#/settings?from=%23%2Fagenda', s().doc)).toEqual({
    hash: '#/agenda',
    title: 'Dates',
  });
});
