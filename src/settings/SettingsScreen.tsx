import { ColorInput } from './ColorInput';
import { useStore } from '../model/store';
import {
  DEFAULT_COLORS,
  DEFAULT_SETTINGS,
  STATES,
  STATE_LABELS,
} from '../model/types';
import { HistoryButtons } from '../panel/TopBar';
import { useEffect, useState } from 'react';
import { settingsReturn } from '../model/navigation';
import { FontSizeControl } from '../ui/FontSizeControl';
import { SyncSettings } from '../sync/SyncSettings';
export function SettingsScreen() {
  const settings = useStore((s) => s.doc.settings);
  const doc = useStore((s) => s.doc);
  const back = settingsReturn(window.location.hash, doc);
  const [size, setSize] = useState(String(settings.taskTitleSize));
  useEffect(
    () => setSize(String(settings.taskTitleSize)),
    [settings.taskTitleSize],
  );
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.key !== 'Escape' || e.defaultPrevented) return;
      const input = (e.target as HTMLElement).closest<HTMLElement>(
        'input,textarea,select',
      );
      if (input) {
        input.blur();
        e.stopPropagation();
        return;
      }
      window.location.hash = back.hash;
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [back.hash]);
  return (
    <main className="settingsScreen">
      <header className="settingsHeader">
        <a
          href={back.hash}
          className="backLink"
          aria-label={back.title ? `Back to panel ${back.title}` : 'Home'}
        >
          {back.title ? `← Back to ${back.title}` : '← Home'}
        </a>
        <HistoryButtons />
      </header>
      <h1>Settings</h1>
      <div className="settingsGrid">
        <SyncSettings />
        <section className="settingsSection">
          <h2>Task titles</h2>
          <p>Applies to existing and new tasks using the default size.</p>
          <label className="settingRow">
            <span>Default font size</span>
            <FontSizeControl
              label="Default task title size"
              value={size}
              onChange={setSize}
              onStep={(value) =>
                useStore
                  .getState()
                  .setSettings({ taskTitleSize: Number(value) })
              }
              onBlur={() => {
                const value = Number(size);
                if (size && Number.isFinite(value))
                  useStore.getState().setSettings({ taskTitleSize: value });
                setSize(String(useStore.getState().doc.settings.taskTitleSize));
              }}
              onEnter={() => (document.activeElement as HTMLElement)?.blur()}
            />
          </label>
          <p>
            Use Title size in the selection actions on touch, or right-click
            selected tasks, to set their size together or restore the default.
          </p>
        </section>
        <section className="settingsSection">
          <h2>State colors</h2>
          <p>Each task gets a soft tint of its state color.</p>
          {STATES.map((state) => (
            <label className="settingRow" key={state}>
              <span>{STATE_LABELS[state]}</span>
              <ColorInput
                label={`${STATE_LABELS[state]} color`}
                value={settings.stateColors[state]}
                onChange={(color) =>
                  useStore.getState().setSettings({
                    stateColors: {
                      ...settings.stateColors,
                      [state]: color,
                    },
                  })
                }
              />
            </label>
          ))}
          <label className="settingRow">
            <span>★ Important</span>
            <ColorInput
              label="Important color"
              value={settings.importantColor}
              onChange={(color) =>
                useStore.getState().setSettings({ importantColor: color })
              }
            />
          </label>
          <button
            className="secondaryButton"
            onClick={() =>
              useStore.getState().setSettings({
                stateColors: { ...DEFAULT_COLORS },
                importantColor: DEFAULT_SETTINGS.importantColor,
              })
            }
          >
            Reset colors
          </button>
        </section>
        <section className="settingsSection">
          <h2>Task state control</h2>
          <label className="settingRow">
            <span>Desktop interaction</span>
            <select
              aria-label="Task state control"
              value={settings.stateControl}
              onChange={(e) =>
                useStore.getState().setSettings({
                  stateControl: e.target.value as 'clickPattern' | 'choices',
                })
              }
            >
              <option value="clickPattern">Four click patterns</option>
              <option value="choices">Four visible choices</option>
            </select>
          </label>
          <p className="controlLegend">
            Left click: Done · Double-left: In Progress
            <br />
            Right click: Blank · Double-right: Delayed
          </p>
          <p>Single clicks wait briefly for a possible double-click.</p>
          <p>
            Visible choices appear when a task is selected or its state is
            hovered. Touch and keyboard users can always open the state picker.
          </p>
        </section>
      </div>
      <p className="localNote">
        Your work is saved automatically in this browser on this device. Add
        Spatium to your Home Screen for easy access, even offline.
      </p>
    </main>
  );
}
