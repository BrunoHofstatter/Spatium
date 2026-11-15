import type { Doc } from './types';
export const HISTORY_LIMIT = 200;
export function preserveView(snapshot: Doc, current: Doc): Doc {
  return {
    ...snapshot,
    settings: { ...snapshot.settings, showDone: current.settings.showDone },
    panels: Object.fromEntries(
      Object.entries(snapshot.panels).map(([id, p]) => [
        id,
        { ...p, viewport: current.panels[id]?.viewport ?? p.viewport },
      ]),
    ),
  };
}
