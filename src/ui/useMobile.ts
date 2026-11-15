import { useSyncExternalStore } from 'react';

const media = window.matchMedia('(pointer: coarse), (max-width: 600px)');
const subscribe = (callback: () => void) => {
  media.addEventListener('change', callback);
  return () => media.removeEventListener('change', callback);
};
export function useMobile() {
  return useSyncExternalStore(subscribe, () => media.matches);
}
