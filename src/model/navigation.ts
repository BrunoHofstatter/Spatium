import type { Doc } from './types';
export function settingsHref(origin = window.location.hash) {
  return `#/settings?from=${encodeURIComponent(/^#\/panel\/[\w-]+(?:\/area\/[\w-]+)?$/.test(origin) ? origin : '#/')}`;
}
export function settingsReturn(hash: string, panels: Doc['panels']) {
  const from =
    new URLSearchParams(hash.split('?')[1] ?? '').get('from') ?? '#/';
  const match = /^#\/panel\/([\w-]+)(?:\/area\/[\w-]+)?$/.exec(from);
  return match && panels[match[1]]
    ? { hash: from, title: panels[match[1]].title }
    : { hash: '#/', title: null };
}
