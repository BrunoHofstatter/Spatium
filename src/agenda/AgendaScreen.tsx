import { useEffect, useMemo, useRef, useState } from 'react';
import { useStore } from '../model/store';
import {
  WEEKDAYS,
  agendaOf,
  dayMonth,
  groupEntries,
  sortedEntries,
  spokenDate,
  weekday,
} from '../model/agenda';
import type { AgendaEntry } from '../model/types';
import { Editable } from '../canvas/Editable';
import { HistoryButtons } from '../panel/TopBar';
import { SyncStatus } from '../sync/SyncStatus';
import { settingsHref } from '../model/navigation';
import { Calendar, DatePicker } from './Calendar';
import { useToday } from './useToday';

export function AgendaScreen() {
  const agenda = useStore((s) => agendaOf(s.doc)),
    today = useToday();
  const [title, setTitle] = useState(''),
    [date, setDate] = useState(today),
    [editing, setEditing] = useState<string | null>(null),
    [flash, setFlash] = useState<string | null>(null);
  const scroller = useRef<HTMLDivElement>(null),
    input = useRef<HTMLInputElement>(null);
  const all = useMemo(() => sortedEntries(agenda.entries), [agenda.entries]);
  const marked = useMemo(() => new Set(all.map((e) => e.date)), [all]);
  const visible = agenda.hidePast ? all.filter((e) => e.date >= today) : all;
  const hiddenCount = all.length - visible.length;
  const months = groupEntries(visible);

  useEffect(() => {
    if (!flash) return;
    const timer = setTimeout(() => setFlash(null), 1400);
    return () => clearTimeout(timer);
  }, [flash]);

  // Scroll to the first shown day on or after `day`.
  const reveal = (day: string, entryId?: string) =>
    requestAnimationFrame(() => {
      const target =
        (entryId &&
          scroller.current?.querySelector<HTMLElement>(
            `[data-entry-id="${entryId}"]`,
          )) ||
        [
          ...(scroller.current?.querySelectorAll<HTMLElement>(
            '.agendaDay[data-date]',
          ) ?? []),
        ].find((el) => el.dataset.date! >= day);
      if (!target) return;
      target.scrollIntoView({
        block: entryId ? 'nearest' : 'start',
        behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches
          ? 'auto'
          : 'smooth',
      });
      setFlash(target.closest<HTMLElement>('.agendaDay')?.dataset.date ?? null);
    });

  const add = () => {
    const id = useStore.getState().addAgendaEntry(title, date);
    if (!id) return;
    setTitle('');
    input.current?.focus();
    reveal(date, id);
  };

  return (
    <main className="agendaScreen">
      <header className="topBar">
        <a className="homeButton" href="#/" title="Home" aria-label="Home">
          ⊞<span>Home</span>
        </a>
        <span className="separator" />
        <Editable
          className="panelTitle"
          value={agenda.title}
          label="Agenda title"
          onCommit={(value) => useStore.getState().renameAgenda(value)}
        />
        <div className="topActions">
          <button
            className={`chip hidePast ${agenda.hidePast ? 'active' : ''}`}
            aria-pressed={agenda.hidePast}
            aria-label="Hide past entries"
            onClick={() =>
              useStore.getState().setAgendaHidePast(!agenda.hidePast)
            }
          >
            Hide past<span>entries</span>
          </button>
          <SyncStatus />
          <HistoryButtons />
          <a
            className="iconButton"
            href={settingsHref()}
            title="Settings"
            aria-label="Settings"
          >
            ⚙
          </a>
        </div>
      </header>
      <div className="agendaScroll" ref={scroller}>
        <div className="agendaBody">
          <section className="agendaMain" aria-label="Entries">
            <form
              className="agendaAdd"
              onSubmit={(e) => {
                e.preventDefault();
                add();
              }}
            >
              <input
                ref={input}
                value={title}
                aria-label="New entry title"
                placeholder="New entry"
                enterKeyHint="done"
                onChange={(e) => setTitle(e.target.value)}
              />
              <DatePicker
                value={date}
                onChange={setDate}
                label="Entry date"
                today={today}
                marked={marked}
              />
              <button
                type="submit"
                className="agendaAddButton"
                disabled={!title.trim()}
              >
                Add
              </button>
            </form>
            {months.length ? (
              <ol className="agendaList">
                {months.map((month) => (
                  <li key={month.key} className="agendaMonth">
                    <h2>{month.label}</h2>
                    <ol>
                      {month.days.map((day) => (
                        <li
                          key={day.date}
                          data-date={day.date}
                          className={[
                            'agendaDay',
                            day.date < today && 'past',
                            day.date === today && 'today',
                            flash === day.date && 'flash',
                          ]
                            .filter(Boolean)
                            .join(' ')}
                        >
                          <div
                            className="agendaDate"
                            aria-label={spokenDate(day.date)}
                          >
                            <span>{WEEKDAYS[weekday(day.date)]}</span>
                            <strong>{dayMonth(day.date)}</strong>
                          </div>
                          <ul>
                            {day.entries.map((entry) => (
                              <EntryRow
                                key={entry.id}
                                entry={entry}
                                today={today}
                                marked={marked}
                                editing={editing === entry.id}
                                onEdit={() => setEditing(entry.id)}
                                onClose={() => setEditing(null)}
                                onMoved={(next) => reveal(next, entry.id)}
                              />
                            ))}
                          </ul>
                        </li>
                      ))}
                    </ol>
                  </li>
                ))}
              </ol>
            ) : (
              <p className="agendaEmpty">
                {hiddenCount
                  ? `Nothing upcoming. ${hiddenCount} past ${hiddenCount === 1 ? 'entry is' : 'entries are'} hidden.`
                  : 'No entries yet. Add one above.'}
              </p>
            )}
          </section>
          <aside className="agendaCalendar">
            <Calendar
              label="Agenda calendar"
              selected={date}
              today={today}
              marked={marked}
              onPick={(day) => {
                setDate(day);
                reveal(day);
              }}
            />
          </aside>
        </div>
      </div>
    </main>
  );
}

function EntryRow({
  entry,
  today,
  marked,
  editing,
  onEdit,
  onClose,
  onMoved,
}: {
  entry: AgendaEntry;
  today: string;
  marked: Set<string>;
  editing: boolean;
  onEdit: () => void;
  onClose: () => void;
  onMoved: (date: string) => void;
}) {
  const [draft, setDraft] = useState(entry.title);
  const row = useRef<HTMLLIElement>(null),
    field = useRef<HTMLInputElement>(null);
  const latest = useRef({ draft, onClose });
  latest.current = { draft, onClose };
  const commit = () => {
    if (latest.current.draft.trim())
      useStore
        .getState()
        .updateAgendaEntry(entry.id, { title: latest.current.draft });
    latest.current.onClose();
  };
  const commitRef = useRef(commit);
  commitRef.current = commit;
  useEffect(() => {
    if (!editing) return;
    setDraft(entry.title);
    field.current?.focus();
    field.current?.select();
    // Clicking anywhere outside the row finishes the edit.
    const outside = (e: PointerEvent) => {
      if (!row.current?.contains(e.target as Node)) commitRef.current();
    };
    document.addEventListener('pointerdown', outside, true);
    return () => document.removeEventListener('pointerdown', outside, true);
    // Only restart the session when editing begins.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editing]);
  if (!editing)
    return (
      <li className="agendaEntry" data-entry-id={entry.id}>
        <button
          className="agendaEntryTitle"
          aria-label={`Edit ${entry.title}`}
          onClick={onEdit}
        >
          {entry.title}
        </button>
      </li>
    );
  return (
    <li className="agendaEntry editing" data-entry-id={entry.id} ref={row}>
      <input
        ref={field}
        value={draft}
        aria-label="Entry title"
        enterKeyHint="done"
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (
            e.key === 'Escape' ||
            (e.key === 'Enter' && !e.nativeEvent.isComposing)
          ) {
            e.preventDefault();
            commit();
          }
        }}
      />
      <div className="agendaEditActions">
        <DatePicker
          value={entry.date}
          align="left"
          label="Change date"
          today={today}
          marked={marked}
          onChange={(date) => {
            useStore
              .getState()
              .updateAgendaEntry(entry.id, { date, title: draft });
            onMoved(date);
          }}
        />
        <button
          type="button"
          className="danger"
          onClick={() => {
            useStore.getState().deleteAgendaEntry(entry.id);
            onClose();
          }}
        >
          Delete
        </button>
        <button type="button" className="agendaDone" onClick={commit}>
          Done
        </button>
      </div>
    </li>
  );
}
