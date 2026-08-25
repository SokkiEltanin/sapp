import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { throttledAsyncStorage } from '@/utils/throttledStorage';

// „Zamrożenie serii" (streak freeze) — jak w Duolingo. Masz zapas zamrożeń (kupujesz za
// monety pupila). Gdy pominiesz dzień nawyku z serią, apka AUTOMATYCZNIE zużywa jedno
// zamrożenie na ten dzień, więc seria NIE pada. Zamrożone dni liczą się jako „zaliczone"
// przy liczeniu serii. Trzyma się osobno od pet-store, ale kupno idzie przez petStore.spendCoins.

const keyFor = (habitId: string, date: string) => `${habitId}|${date}`;

interface StreakFreezeState {
  freezes: number;                       // zapas zamrożeń
  frozen: Record<string, true>;          // `${habitId}|${date}` → dzień ochroniony zamrożeniem
  _hydrated: boolean;
  addFreezes: (n: number) => void;
  applyFreeze: (habitId: string, date: string) => boolean;   // zużyj 1 → oznacz dzień; false gdy brak
  isFrozen: (habitId: string, date: string) => boolean;
}

export const useStreakFreezeStore = create<StreakFreezeState>()(
  persist(
    (set, get) => ({
      freezes: 0,
      frozen: {},
      _hydrated: false,
      addFreezes: (n) => set((s) => ({ freezes: Math.max(0, s.freezes + n) })),
      applyFreeze: (habitId, date) => {
        const s = get();
        if (!s._hydrated) return false;      // nie zużywaj zanim się wczyta (anty-clobber jak w petStore)
        if (s.freezes <= 0) return false;
        const k = keyFor(habitId, date);
        if (s.frozen[k]) return true;        // już zamrożony — nic nie zużywaj
        set({ freezes: s.freezes - 1, frozen: { ...s.frozen, [k]: true } });
        return true;
      },
      isFrozen: (habitId, date) => !!get().frozen[keyFor(habitId, date)],
    }),
    {
      name: 'streak-freeze-v1',
      storage: createJSONStorage(() => throttledAsyncStorage()),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
