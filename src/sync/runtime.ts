import type {
  IndexedDbRepository,
  PersistenceHandle,
} from '../model/persistence';
import { useStore } from '../model/store';
import { supabase, SupabaseRepository } from './supabase';
import { SyncEngine } from './engine';
import { useSync } from './state';
export let syncEngine: SyncEngine | undefined;
export function startCloudSync(
  device: IndexedDbRepository,
  persistence: PersistenceHandle,
) {
  let contacts = 0;
  syncEngine = new SyncEngine(
    device,
    persistence,
    new SupabaseRepository(),
    () =>
      contacts === 0 &&
      !useStore.getState().editingId &&
      !document.activeElement?.matches(
        'input,textarea,[contenteditable="true"]',
      ),
  );
  const engine = syncEngine;
  // Auth callbacks must return immediately; Supabase auth work runs outside their lock.
  supabase.auth.onAuthStateChange((_event, session) => {
    setTimeout(() => {
      if (session?.user)
        void engine.connect(session.user.id, session.user.email ?? 'Signed in');
      else engine.disconnect();
    }, 0);
  });
  device.onSaved = () => engine.changed();
  useStore.subscribe((state, previous) => {
    const a = state.doc,
      b = previous.doc;
    if (
      a.items !== b.items ||
      a.settings !== b.settings ||
      a.panelOrder !== b.panelOrder ||
      Object.entries(a.panels).some(
        ([id, p]) =>
          !b.panels[id] ||
          p.title !== b.panels[id].title ||
          p.updatedAt !== b.panels[id].updatedAt,
      )
    )
      engine.changed();
  });
  window.addEventListener(
    'pointerdown',
    () => {
      ++contacts;
    },
    true,
  );
  const release = () => {
    contacts = Math.max(0, contacts - 1);
  };
  window.addEventListener('pointerup', release, true);
  window.addEventListener('pointercancel', release, true);
  window.addEventListener('blur', () => {
    contacts = 0;
  });
  window.addEventListener('focus', () => void engine.run());
  window.addEventListener('online', () => void engine.run());
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'visible') void engine.run();
  });
  setInterval(() => {
    if (document.visibilityState === 'visible' && !useSync.getState().locked)
      void engine.run();
  }, 15000);
}
