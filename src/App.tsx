import { useEffect, useState, type CSSProperties } from 'react';
import { useStore } from './model/store';
import { IndexedDbRepository, startPersistence } from './model/persistence';
import { HomeScreen } from './home/HomeScreen';
import { PanelScreen } from './panel/PanelScreen';
import { SettingsScreen } from './settings/SettingsScreen';
import { deleteSelection } from './canvas/SelectionToolbar';
import styles from './styles/App.module.css';
import { TouchEditing } from './canvas/TouchEditing';
import { startCloudSync } from './sync/runtime';
import { useSync } from './sync/state';
let boot: Promise<() => void> | undefined;
export function App() {
  const [hash, setHash] = useState(window.location.hash),
    [loadError, setLoadError] = useState<string | null>(null);
  const ready = useStore((s) => s.ready),
    error = useStore((s) => s.error),
    importantColor = useStore((s) => s.doc.settings.importantColor),
    panels = useStore((s) => s.doc.panels);
  const locked = useSync((s) => s.locked);
  useEffect(() => {
    boot ??= (async () => {
      const device = new IndexedDbRepository();
      const persistence = await startPersistence(device);
      startCloudSync(device, persistence);
      return persistence;
    })();
    void boot.catch((error) =>
      setLoadError(
        error instanceof Error
          ? error.message
          : 'The saved document could not be loaded.',
      ),
    );
    const change = () => {
      useStore.getState().select([]);
      useStore.getState().setEditing(null);
      useStore.getState().setSelectionMode(false);
      setHash(window.location.hash);
    };
    window.addEventListener('hashchange', change);
    return () => window.removeEventListener('hashchange', change);
  }, []);
  useEffect(() => {
    const dismiss = (event: PointerEvent) => {
      for (const menu of document.querySelectorAll<HTMLDetailsElement>(
        'details[open]',
      ))
        if (!menu.contains(event.target as Node)) menu.open = false;
    };
    document.addEventListener('pointerdown', dismiss, true);
    return () => document.removeEventListener('pointerdown', dismiss, true);
  }, []);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (useSync.getState().locked) {
        e.preventDefault();
        return;
      }
      if (
        (e.target as HTMLElement).closest(
          'input,textarea,select,[contenteditable="true"]',
        )
      )
        return;
      const s = useStore.getState();
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'z') {
        e.preventDefault();
        if (e.shiftKey) s.redo();
        else s.undo();
      } else if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'y') {
        e.preventDefault();
        s.redo();
      } else if (e.key === 'Delete' || e.key === 'Backspace') {
        if (s.selection.length) {
          e.preventDefault();
          deleteSelection();
        }
      } else if (e.key === 'Escape') {
        s.setSelectionMode(false);
        s.select([]);
        s.setEditing(null);
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  if (loadError)
    return (
      <main className="bootScreen">
        <h1>Your saved work needs attention</h1>
        <p>{loadError}</p>
        <p>Your stored data has been left intact.</p>
        <button onClick={() => window.location.reload()}>Try again</button>
      </main>
    );
  if (!ready)
    return (
      <main className="bootScreen">
        <span className="brandMark">▥</span>
        <p>Opening your space…</p>
      </main>
    );
  const match = /^#\/panel\/([^/]+)$/.exec(hash);
  const id = match?.[1];
  return (
    <div
      className={`${styles.surface} app`}
      style={{ '--important': importantColor } as CSSProperties}
    >
      {error && (
        <div className="saveError" role="alert">
          {error}
        </div>
      )}
      {locked && (
        <div className="syncLock" role="status" aria-live="polite">
          Updating your saved work…
        </div>
      )}
      <div className="appContents" inert={locked}>
        <TouchEditing />
        {hash.split('?')[0] === '#/settings' ? (
          <SettingsScreen />
        ) : id && panels[id] ? (
          <PanelScreen panelId={id} />
        ) : (
          <HomeScreen />
        )}
      </div>
    </div>
  );
}
