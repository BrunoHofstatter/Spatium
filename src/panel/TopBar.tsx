import { useStore } from '../model/store';
import { STATES, STATE_LABELS } from '../model/types';
import { Editable } from '../canvas/Editable';
import { settingsHref } from '../model/navigation';
import { SyncStatus } from '../sync/SyncStatus';
export function HistoryButtons() {
  const undo = useStore((s) => s.undo),
    redo = useStore((s) => s.redo),
    canUndo = useStore((s) => s.past.length > 0),
    canRedo = useStore((s) => s.future.length > 0);
  return (
    <div className="historyButtons">
      <button
        aria-label="Undo"
        title="Undo (Ctrl+Z)"
        disabled={!canUndo}
        onClick={undo}
      >
        ↶
      </button>
      <button
        aria-label="Redo"
        title="Redo (Ctrl+Shift+Z)"
        disabled={!canRedo}
        onClick={redo}
      >
        ↷
      </button>
    </div>
  );
}
function Filters() {
  const highlights = useStore((s) => s.highlights),
    showDone = useStore((s) => s.doc.settings.showDone),
    colors = useStore((s) => s.doc.settings.stateColors);
  return (
    <>
      <div className="filterChips">
        <span className="filterLabel">Highlight</span>
        {STATES.map((state) => (
          <button
            className={`chip ${highlights.includes(state) ? 'active' : ''}`}
            key={state}
            disabled={state === 'done' && !showDone}
            aria-pressed={highlights.includes(state)}
            onClick={() => useStore.getState().toggleHighlight(state)}
          >
            <i style={{ backgroundColor: colors[state] }} />
            {STATE_LABELS[state]}
          </button>
        ))}
        <button
          className={`chip ${highlights.includes('important') ? 'active' : ''}`}
          aria-pressed={highlights.includes('important')}
          onClick={() => useStore.getState().toggleHighlight('important')}
        >
          <span className="starOn">★</span>Important
        </button>
      </div>
      <label className="doneSwitch">
        <input
          type="checkbox"
          checked={!showDone}
          onChange={(e) =>
            useStore
              .getState()
              .setSettings({ showDone: !e.target.checked }, false)
          }
        />
        Hide Done
      </label>
    </>
  );
}
export function TopBar({ panelId }: { panelId: string }) {
  const title = useStore((s) => s.doc.panels[panelId].title);
  return (
    <>
      <header className="topBar">
        <a className="homeButton" href="#/" title="Home" aria-label="Home">
          ⊞<span>Home</span>
        </a>
        <span className="separator" />
        <Editable
          className="panelTitle"
          value={title}
          label="Panel title"
          onCommit={(value) => useStore.getState().renamePanel(panelId, value)}
        />
        <div className="desktopFilters">
          <Filters />
        </div>
        <div className="topActions">
          <SyncStatus />
          <HistoryButtons />
          <a
            className="iconButton settingsLink"
            href={settingsHref()}
            title="Settings"
            aria-label="Settings"
          >
            ⚙
          </a>
          <details className="mobileFilters">
            <summary aria-label="Filters and options">☷</summary>
            <div className="filterPopover">
              <Filters />
              <a href={settingsHref()}>Settings</a>
            </div>
          </details>
        </div>
      </header>
    </>
  );
}
