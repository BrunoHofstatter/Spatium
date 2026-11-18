import { useEffect, useState } from 'react';
import { todayKey } from '../model/agenda';

/** Today's local date key, refreshed when the day changes. */
export function useToday() {
  const [today, setToday] = useState(todayKey);
  useEffect(() => {
    const tick = () => setToday(todayKey());
    const timer = setInterval(tick, 60_000);
    document.addEventListener('visibilitychange', tick);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', tick);
    };
  }, []);
  return today;
}
