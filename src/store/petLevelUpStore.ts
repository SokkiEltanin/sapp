import { create } from 'zustand';

// Kolejka poziomów oczekujących na celebrację (2026-08-19, user: "musimy dodac info o
// levelup pupila... powiadomienie z confetti"). Ten sam wzorzec co celebrationStore.ts
// (osiągnięcia), tylko na liczbach zamiast id odznak — osobny store bo kształt danych i
// komponent celebracji są inne (LevelUpCelebration.tsx, nie BadgeCelebration.tsx).
// Wykrywanie żyje w app/_layout.tsx — patrz komentarz przy `lastSeenLevel` w petStore.ts.
interface PetLevelUpState {
  queue: number[];
  celebrate: (level: number) => void;
  dismissTop: () => void;
}

export const usePetLevelUp = create<PetLevelUpState>((set) => ({
  queue: [],
  celebrate: (level) => set((s) => (s.queue.includes(level) ? s : { queue: [...s.queue, level] })),
  dismissTop: () => set((s) => ({ queue: s.queue.slice(1) })),
}));
