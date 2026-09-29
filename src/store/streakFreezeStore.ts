import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// „Zamrożenie serii" (streak freeze) — jak w Duolingo. Masz zapas zamrożeń (kupujesz za
// monety pupila). Gdy pominiesz dzień nawyku z serią, apka AUTOMATYCZNIE zużywa jedno
// zamrożenie na ten dzień, więc seria NIE pada. Zamrożone dni liczą się jako „zaliczone"
// przy liczeniu serii. Trzyma się osobno od pet-store, ale kupno idzie przez petStore.spendCoins.

const keyFor = (habitId: string, date: string) => `${habitId}|${date}`;

interface StreakFreezeState {
  freezes: number;                       // zapas zamrożeń
  frozen: Record<string, true>;          // `${habitId}|${date}` → dzień ochroniony zamrożeniem
  // Auto-przyznane zamrożenia na kamieniach milowych (2026-09-29, user zaakceptował pomysł
  // z researchu: Duolingo przyznaje freeze'y AUTOMATYCZNIE na kamieniach milowych, zanim są
  // potrzebne — "już w kieszeni", nie nagroda do kupienia w panice gdy seria już pęka).
  // `${habitId}` → NAJWYŻSZY już nagrodzony próg (wielokrotność 7) — trzyma się TU, nie w
  // `useHabits.ts`, żeby przeżyło re-mount hooka (montowany dwa razy naraz — dashboard +
  // ekran Nawyków, patrz komentarz przy tym efekcie) i restart appki.
  grantedMilestones: Record<string, number>;
  _hydrated: boolean;
  addFreezes: (n: number) => void;
  applyFreeze: (habitId: string, date: string) => boolean;   // zużyj 1 → oznacz dzień; false gdy brak
  isFrozen: (habitId: string, date: string) => boolean;
  grantMilestone: (habitId: string, streak: number) => boolean; // +1 freeze gdy nowy próg 7/14/21…
}

export const useStreakFreezeStore = create<StreakFreezeState>()(
  persist(
    (set, get) => ({
      freezes: 0,
      frozen: {},
      grantedMilestones: {},
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
      grantMilestone: (habitId, streak) => {
        const s = get();
        if (!s._hydrated) return false;
        const milestone = Math.floor(streak / 7) * 7;
        if (milestone <= 0) return false;
        const prev = s.grantedMilestones[habitId] ?? 0;
        if (milestone <= prev) return false;   // ten próg (albo wyższy) już nagrodzony
        set({ freezes: s.freezes + 1, grantedMilestones: { ...s.grantedMilestones, [habitId]: milestone } });
        return true;
      },
    }),
    {
      name: 'streak-freeze-v1',
      storage: throttledPersistStorage(),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
