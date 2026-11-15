import { settingsHref } from '../model/navigation';
import { SYNC_LABELS, useSync } from './state';
export function SyncStatus() {
  const status = useSync((s) => s.status);
  return (
    <a
      className={`syncStatus sync-${status}`}
      href={settingsHref()}
      aria-label={`Sync: ${SYNC_LABELS[status]}`}
      title={SYNC_LABELS[status]}
    >
      <i />
      <span>{SYNC_LABELS[status]}</span>
    </a>
  );
}
