import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { throttledAsyncStorage } from '@/utils/throttledStorage';

// "Whose data" the statistics show. The user's own money (balance, spending sum)
// always counts only THEIR transactions; this scope additionally lets the
// consumption stats (food, sweets, charts) switch between the whole household
// ("all") and only what the user themselves bought ("mine").

export type StatsScope = 'all' | 'mine';

// The primary identity = the app owner. Expenses paid by them, or legacy entries
// with no payer set, are considered "mine".
export const MY_PAYER = 'Ja';

export function isMine(e: { payer?: string }): boolean {
  return !e.payer || e.payer === MY_PAYER;
}

// Does this expense belong in the current scope? "all" = everyone; "mine" = only me.
export function inScope(e: { payer?: string }, scope: StatsScope): boolean {
  return scope === 'all' ? true : isMine(e);
}

// Does this receipt item count toward MY consumption stats (sweets bar, favourite
// products, kg-per-group)? Deposits and items flagged "not mine" (gift / for
// someone else) still count as money spent but are out of consumption analytics.
export function countsForConsumption(it: { excluded?: boolean; kind?: string }): boolean {
  return !it.excluded && it.kind !== 'deposit';
}

// Item-level scope by WHO ATE IT (eaters), independent of who PAID (payer). Under
// "mine" only items I ate count: untagged/shared items (no eaters set) count as
// mine by default, an item tagged for someone else (e.g. eaters ['Partnerka'])
// does not. This is what makes the Ja/Wszyscy toggle actually split consumption
// even when I pay for everything.
export function itemInScope(it: { eaters?: string[] }, scope: StatsScope): boolean {
  if (scope === 'all') return true;
  const eaters = it.eaters ?? [];
  return eaters.length === 0 || eaters.includes(MY_PAYER);
}

// Consumption-eligible AND in the current eater scope — the predicate every
// consumption stat should use so the Ja/Wszyscy toggle behaves consistently.
export function consumesInScope(it: { excluded?: boolean; kind?: string; eaters?: string[] }, scope: StatsScope): boolean {
  return countsForConsumption(it) && itemInScope(it, scope);
}

interface StatsScopeState {
  scope: StatsScope;
  setScope: (s: StatsScope) => void;
  toggle: () => void;
}

export const useStatsScope = create<StatsScopeState>()(
  persist(
    (set) => ({
      scope: 'all',
      setScope: (scope) => set({ scope }),
      toggle: () => set((s) => ({ scope: s.scope === 'all' ? 'mine' : 'all' })),
    }),
    {
      name: 'stats-scope-v1',
      storage: createJSONStorage(() => throttledAsyncStorage()),
    },
  ),
);
