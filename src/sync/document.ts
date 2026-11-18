import type { Doc } from '../model/types';
import { DEFAULT_SETTINGS } from '../model/types';
export function cloudDocument(doc: Doc): Doc {
  return {
    ...doc,
    panels: Object.fromEntries(
      Object.entries(doc.panels).map(([id, panel]) => [
        id,
        { ...panel, viewport: { x: 80, y: 80, zoom: 1 } },
      ]),
    ),
  };
}
function sorted(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(sorted);
  if (value && typeof value === 'object')
    return Object.fromEntries(
      Object.entries(value)
        .sort(([a], [b]) => a.localeCompare(b))
        .map(([key, v]) => [key, sorted(v)]),
    );
  return value;
}
export function fingerprint(doc: Doc): string {
  return JSON.stringify(sorted(cloudDocument(doc)));
}
export function deviceDocument(cloud: Doc, local: Doc): Doc {
  return {
    ...cloud,
    panels: Object.fromEntries(
      Object.entries(cloud.panels).map(([id, panel]) => [
        id,
        {
          ...panel,
          viewport: local.panels[id]?.viewport ?? { x: 80, y: 80, zoom: 1 },
        },
      ]),
    ),
  };
}
export function hasWork(doc: Doc): boolean {
  return (
    Object.keys(doc.items).length > 0 ||
    doc.panelOrder.length !== 1 ||
    doc.panels[doc.panelOrder[0]]?.title !== 'Personal' ||
    Object.keys(doc.agenda?.entries ?? {}).length > 0 ||
    (doc.agenda?.title ?? 'Agenda') !== 'Agenda' ||
    JSON.stringify(sorted(doc.settings)) !==
      JSON.stringify(sorted(DEFAULT_SETTINGS))
  );
}
