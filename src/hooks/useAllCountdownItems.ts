import { useMemo } from 'react';
import { useCounters, Counter, isOver, daysUntil, isDuringEvent } from '@/store/countersStore';
import { useDayKey } from '@/hooks/useDayKey';

// Lista "do czego da się przypiąć kafel odliczania" (system kopiowania komponentów, Faza 17,
// 2026-10-17) — drugi typ komponentu po `useAllStreakItems()`. ŚWIADOMIE bez filtra
// `onDashboard !== false` (ten filtr na dashboardzie istnieje żeby user mógł schować licznik Z
// DASHBOARDU bez usuwania go — ale płótno jest OSOBNYM miejscem umieszczenia, schowanie z
// dashboardu nie powinno automatycznie chować licznika z listy wyboru tutaj). `useCounters()`
// jest store'em Zustand (współdzielony singleton), nie hookiem z własnym fetchem jak
// `useHabits()` — bezpieczne wołanie z DOWOLNEGO miejsca appki, zero ryzyka podwójnej pracy.
export function useAllCountdownItems(): Counter[] {
  const counters = useCounters(st => st.counters);
  const dayKey = useDayKey();
  return useMemo(
    () => counters
      .filter(cn => cn.kind === 'until' && !isOver(cn) && (daysUntil(cn) >= 0 || isDuringEvent(cn)))
      .sort((a, b) => a.date.localeCompare(b.date)),
    [counters, dayKey],
  );
}
