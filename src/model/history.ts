import type { Doc } from './types';
import { agendaOf } from './agenda';
export const HISTORY_LIMIT = 200;
export function preserveView(snapshot: Doc, current: Doc): Doc {
  const hidePast = agendaOf(current).hidePast;
  return {
    ...snapshot,
    settings: { ...snapshot.settings, showDone: current.settings.showDone },
    panels: Object.fromEntries(
      Object.entries(snapshot.panels).map(([id, p]) => [
        id,
        { ...p, viewport: current.panels[id]?.viewport ?? p.viewport },
      ]),
    ),
    ...(agendaOf(snapshot).hidePast !== hidePast
      ? { agenda: { ...structuredClone(agendaOf(snapshot)), hidePast } }
      : {}),
  };
}
