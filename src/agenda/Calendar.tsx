import { useState } from 'react';
import {
  WEEKDAYS,
  calendarWeeks,
  fullDate,
  monthLabel,
  parseDateKey,
  spokenDate,
} from '../model/agenda';

/** Month calendar with weeks starting on Sunday. */
export function Calendar({
  selected,
  today,
  marked,
  onPick,
  label,
}: {
  selected?: string;
  today: string;
  marked?: Set<string>;
  onPick: (date: string) => void;
  label: string;
}) {
  const start = parseDateKey(selected ?? today);
  const [view, setView] = useState({ year: start.year, month: start.month });
  const shift = (delta: number) =>
    setView(({ year, month }) => {
      const next = new Date(Date.UTC(year, month + delta, 1));
      return { year: next.getUTCFullYear(), month: next.getUTCMonth() };
    });
  return (
    <div className="calendar" role="group" aria-label={label}>
      <div className="calendarHeader">
        <button
          type="button"
          aria-label="Previous month"
          onClick={() => shift(-1)}
        >
          ‹
        </button>
        <span aria-live="polite">{monthLabel(view.year, view.month)}</span>
        <button type="button" aria-label="Next month" onClick={() => shift(1)}>
          ›
        </button>
      </div>
      <div className="calendarGrid">
        <div className="calendarRow">
          {WEEKDAYS.map((day) => (
            <span key={day} aria-hidden="true">
              {day[0]}
            </span>
          ))}
        </div>
        {calendarWeeks(view.year, view.month).map((week, i) => (
          <div className="calendarRow" key={i}>
            {week.map((date, j) =>
              date ? (
                <button
                  key={date}
                  type="button"

                  className={[
                    'calendarDay',
                    date === today && 'today',
                    date === selected && 'selected',
                    marked?.has(date) && 'marked',
                  ]
                    .filter(Boolean)
                    .join(' ')}
                  aria-label={`${spokenDate(date)}${marked?.has(date) ? ', has entries' : ''}`}
                  aria-pressed={date === selected}
                  title={fullDate(date)}
                  onClick={() => onPick(date)}
                >
                  {parseDateKey(date).day}
                </button>
              ) : (
                <span key={`blank-${j}`} />
              ),
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

/** A button showing DD/MM/YYYY that opens a calendar for picking a day. */
export function DatePicker({
  value,
  onChange,
  label,
  today,
  marked,
  align = 'right',
}: {
  value: string;
  onChange: (date: string) => void;
  label: string;
  today: string;
  marked?: Set<string>;
  align?: 'left' | 'right';
}) {
  return (
    <details className={`datePicker ${align}`}>
      <summary
        className="dateButton"
        aria-label={`${label}: ${spokenDate(value)}`}
      >
        <span aria-hidden="true">▦</span>
        {fullDate(value)}
      </summary>
      <div className="datePopover">
        <Calendar
          key={value}
          label={label}
          selected={value}
          today={today}
          marked={marked}
          onPick={(date) => {
            onChange(date);
            document
              .querySelectorAll<HTMLDetailsElement>('.datePicker[open]')
              .forEach((d) => (d.open = false));
          }}
        />
      </div>
    </details>
  );
}
