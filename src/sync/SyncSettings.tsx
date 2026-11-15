import { useState, type FormEvent } from 'react';
import { supabase } from './supabase';
import { SYNC_LABELS, useSync } from './state';
import { syncEngine } from './runtime';
import { useStore } from '../model/store';
export function SyncSettings() {
  const state = useSync();
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState(''),
    [busy, setBusy] = useState(false),
    [error, setError] = useState<string | null>(null),
    [recovery, setRecovery] = useState('');
  const panels = useStore((s) => s.doc.panelOrder.length),
    items = useStore((s) => Object.keys(s.doc.items).length);
  const login = async (event: FormEvent) => {
    event.preventDefault();
    setBusy(true);
    setError(null);
    try {
      const result = await supabase.auth.signInWithPassword({
        email: email.trim(),
        password,
      });
      if (result.error) throw result.error;
      setPassword('');
      (document.activeElement as HTMLElement)?.blur();
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign in failed.');
    } finally {
      setBusy(false);
    }
  };
  const logout = async () => {
    setBusy(true);
    setError(null);
    try {
      const { error } = await supabase.auth.signOut({ scope: 'local' });
      if (error) throw error;
    } catch (error) {
      setError(error instanceof Error ? error.message : 'Sign out failed.');
    } finally {
      setBusy(false);
    }
  };
  const choosing = state.status === 'choose' || state.status === 'conflict';
  return (
    <section className="settingsSection syncSettings" aria-label="Cloud sync">
      <h2>Cloud sync</h2>
      <p className={`syncSummary sync-${state.status}`} role="status">
        {SYNC_LABELS[state.status]}
      </p>
      {!state.email ? (
        <>
          <p>
            Sign in with your Spatium account to share your work between
            devices. Your existing local work stays here until you choose a
            starting copy.
          </p>
          <form className="syncForm" onSubmit={(e) => void login(e)}>
            <label>
              Email
              <input
                type="email"
                autoComplete="username"
                required
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </label>
            <label>
              Password
              <input
                type="password"
                autoComplete="current-password"
                required
                value={password}
                onChange={(e) => setPassword(e.target.value)}
              />
            </label>
            <button className="secondaryButton" type="submit" disabled={busy}>
              {busy ? 'Signing in…' : 'Sign in'}
            </button>
          </form>
          <p>
            Use the account created in your Supabase project. Public sign-up is
            disabled.
          </p>
        </>
      ) : (
        <>
          <p>
            Signed in as <strong>{state.email}</strong>
          </p>
          <p>
            Changes save on this device first. Cloud changes are checked when
            you return and while the app is open. Pan and zoom stay on this
            device.
          </p>
          {(state.message || error) && (
            <p className="syncError" role="alert">
              {error || state.message}
            </p>
          )}
          {choosing && (
            <div
              className="syncChoice"
              role="group"
              aria-label="Choose a saved copy"
            >
              <h3>
                {state.status === 'choose'
                  ? 'Choose your starting copy'
                  : 'Both copies have changed'}
              </h3>
              <p>
                {state.remote
                  ? 'Choose the whole copy you want to continue with. Copies are kept in recent recovery before either version is replaced.'
                  : 'There is no cloud copy yet. Start with the work currently on this device.'}
              </p>
              <p>
                This device: {panels} panels · {items} items
                {state.remote && (
                  <>
                    <br />
                    Cloud: {state.remote.document.panelOrder.length} panels ·{' '}
                    {Object.keys(state.remote.document.items).length} items
                  </>
                )}
              </p>
              <div className="syncButtons">
                <button
                  disabled={state.working}
                  className="secondaryButton"
                  onClick={() => void syncEngine?.choose('local')}
                >
                  {state.remote
                    ? 'Keep this device’s copy'
                    : 'Start with this device'}
                </button>
                {state.remote && (
                  <button
                    disabled={state.working}
                    className="secondaryButton"
                    onClick={() => void syncEngine?.choose('cloud')}
                  >
                    Use cloud copy
                  </button>
                )}
              </div>
            </div>
          )}
          <div className="syncButtons">
            <button
              className="secondaryButton"
              disabled={state.working}
              onClick={() => void syncEngine?.run()}
            >
              Sync now
            </button>
            <button
              className="secondaryButton"
              disabled={busy || state.working}
              onClick={() => void logout()}
            >
              Sign out
            </button>
          </div>
          {state.hasRecovery && (
            <div className="syncRecovery">
              <h3>Recent recovery copies</h3>
              <p>
                Stored only on this device. Restoring pauses automatic sync
                until you choose which copy to keep.
              </p>
              <select
                aria-label="Recovery copy"
                value={recovery}
                onChange={(e) => setRecovery(e.target.value)}
              >
                <option value="">Choose a copy…</option>
                {syncEngine?.recovery().map((copy) => (
                  <option value={copy.id} key={copy.id}>
                    {new Date(copy.at).toLocaleString()} · {copy.label}
                  </option>
                ))}
              </select>
              <button
                className="secondaryButton"
                disabled={!recovery || state.working}
                onClick={() => {
                  if (
                    confirm(
                      'Restore this recovery copy on this device? Your current copy will be kept in recovery too.',
                    )
                  ) {
                    void syncEngine?.restore(recovery);
                    setRecovery('');
                  }
                }}
              >
                Restore on this device
              </button>
            </div>
          )}
        </>
      )}
      {!state.email && error && (
        <p className="syncError" role="alert">
          {error}
        </p>
      )}
    </section>
  );
}
