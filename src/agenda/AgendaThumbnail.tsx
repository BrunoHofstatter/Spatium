import { useStore } from '../model/store';
import { agendaOf, dayMonth, sortedEntries } from '../model/agenda';
import { useToday } from './useToday';

/** Home preview: the next few upcoming entries. */
export function AgendaThumbnail() {
  const entries = useStore((s) => agendaOf(s.doc).entries),
    today = useToday();
  const upcoming = sortedEntries(entries)
    .filter((e) => e.date >= today)
    .slice(0, 6);
  return (
    <div className="agendaThumbnail" role="img" aria-label="Upcoming entries">
      {upcoming.length ? (
        <ul>
          {upcoming.map((entry) => (
            <li key={entry.id}>
              <span className="agendaThumbDate">{dayMonth(entry.date)}</span>
              <span className="agendaThumbTitle">{entry.title}</span>
            </li>
          ))}
        </ul>
      ) : (
        <p>Nothing upcoming</p>
      )}
    </div>
  );
}
