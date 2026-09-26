import { useEffect, useState } from 'react';
import { AppState } from 'react-native';

function todayStr(): string {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// A day-key that changes when the calendar day rolls over (checked every minute and on every
// foreground). Feed it into a `useMemo`'s deps whenever the memo derives "today"/"this
// week"/"this month" boundaries from `new Date()` internally — otherwise a screen/hook that
// stays mounted across a day boundary keeps stale results until something UNRELATED forces a
// recompute (setDayKey only fires a real re-render when the string actually changes, so this
// is cheap). Lifted out of `app/(tabs)/index.tsx`'s local `dayKey` (2026-08-26) into a shared
// hook so other screens/hooks stop reinventing it (2026-09-26, agent-audyt logiki — found the
// same missing-rollover bug independently in `useExpenses.ts`, `habits.tsx`, `finances.tsx`,
// `mood.tsx`).
export function useDayKey(): string {
  const [dayKey, setDayKey] = useState(todayStr());
  useEffect(() => {
    const tick = () => setDayKey(todayStr());
    const id = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') tick(); });
    return () => { clearInterval(id); sub.remove(); };
  }, []);
  return dayKey;
}
