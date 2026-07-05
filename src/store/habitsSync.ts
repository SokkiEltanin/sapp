import { create } from 'zustand';

// useHabits is a per-component hook with its own local state, so a change on the
// Habits screen didn't reach the dashboard tile or the live pill — a deleted habit
// kept showing there as "not done". Every mutation bumps this shared version; each
// useHabits instance watches it and re-reads, so all copies stay in sync.
export const useHabitsSync = create<{ version: number; bump: () => void }>((set) => ({
  version: 0,
  bump: () => set((s) => ({ version: s.version + 1 })),
}));
