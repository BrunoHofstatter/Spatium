import type { Doc } from './types';
import { agendaOf } from './agenda';
const PANEL_ROUTE = /^#\/panel\/([\w-]+)(?:\/area\/[\w-]+)?$/;
export function settingsHref(origin = window.location.hash) {
  return `#/settings?from=${encodeURIComponent(PANEL_ROUTE.test(origin) || origin === '#/agenda' ? origin : '#/')}`;
}
export function settingsReturn(hash: string, doc: Doc) {
  const from =
    new URLSearchParams(hash.split('?')[1] ?? '').get('from') ?? '#/';
  if (from === '#/agenda') return { hash: from, title: agendaOf(doc).title };
  const match = PANEL_ROUTE.exec(from);
  return match && doc.panels[match[1]]
    ? { hash: from, title: doc.panels[match[1]].title }
    : { hash: '#/', title: null };
}
