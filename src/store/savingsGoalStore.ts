import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// A "Skarbonka" — a motivational savings jar toward one named reward (a trip, a gadget).
// Deliberately NOT tied to the real finance ledger: it's aspirational, a thing you drop
// into when you set money aside, and it fills a progress bar toward the goal. The user
// asked for "cel oszczędności → impreza"; this is the collectible/playful version of it.
//
// One goal at a time keeps it simple; the model is an array so more can be added later.

export interface SavingsGoal {
  id: string;
  name: string;       // "Wyjazd nad morze"
  target: number;     // zł
  saved: number;      // zł set aside so far
  createdAt: string;  // ISO
  reachedAt?: string; // ISO when it first hit the target (so the party only fires once)
}

interface SavingsGoalState {
  goals: SavingsGoal[];
  _hydrated: boolean;
  addGoal: (name: string, target: number) => void;
  editGoal: (id: string, patch: Partial<Pick<SavingsGoal, 'name' | 'target'>>) => void;
  deposit: (id: string, amount: number) => boolean;   // true if this deposit reached the goal
  withdraw: (id: string, amount: number) => void;
  removeGoal: (id: string) => void;
}

export const useSavingsGoals = create<SavingsGoalState>()(
  persist(
    (set, get) => ({
      goals: [],
      _hydrated: false,

      addGoal: (name, target) => set((s) => ({
        goals: [...s.goals, {
          id: `sg_${Date.now()}`, name: name.trim(), target: Math.max(1, Math.round(target)),
          saved: 0, createdAt: new Date().toISOString(),
        }],
      })),

      editGoal: (id, patch) => set((s) => ({
        goals: s.goals.map(g => g.id === id ? {
          ...g,
          ...(patch.name != null ? { name: patch.name.trim() } : {}),
          ...(patch.target != null ? { target: Math.max(1, Math.round(patch.target)) } : {}),
        } : g),
      })),

      deposit: (id, amount) => {
        const g = get().goals.find(x => x.id === id);
        if (!g || !(amount > 0)) return false;
        const saved = Math.round((g.saved + amount) * 100) / 100;
        const justReached = !g.reachedAt && saved >= g.target;
        set((s) => ({
          goals: s.goals.map(x => x.id === id
            ? { ...x, saved, ...(justReached ? { reachedAt: new Date().toISOString() } : {}) }
            : x),
        }));
        return justReached;
      },

      withdraw: (id, amount) => set((s) => ({
        goals: s.goals.map(x => x.id === id
          ? { ...x, saved: Math.max(0, Math.round((x.saved - amount) * 100) / 100) }
          : x),
      })),

      removeGoal: (id) => set((s) => ({ goals: s.goals.filter(g => g.id !== id) })),
    }),
    {
      name: 'savings-goals-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ goals: s.goals }),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
