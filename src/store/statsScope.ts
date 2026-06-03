import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
      storage: createJSONStorage(() => AsyncStorage),
    },
  ),
);
