import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Kreator dashboardu, Faza 11 (2026-10-15, §337) — czwarta karta w kreatorze, pierwsza od
// Fazy 3 rozszerzająca mechanizm na NOWY komponent (nie nowy preset na istniejącym). Kandydat
// wskazany w NEXT_STEPS.md: `SinceCountersCard` ("Liczniki" — "ile dni temu X") ma kształt
// listy wierszy (duża liczba + poświata + nazwa/meta), bliski `CountdownsCard`, więc własne
// pola odpowiadają TEMU kształtowi — nie kopiuję aspectRatio/gradientMode z kafelków serii
// (ta karta nie ma siatki kafelków, tylko jedną kolumnę wierszy).
export interface SinceCountersTileStyle {
  rowRadius: number;
  numberScale: number;
  maxVisible: number;
  showGlow: boolean;
}

export const DEFAULT_SINCE_COUNTERS_TILE_STYLE: SinceCountersTileStyle = {
  rowRadius: 16,
  numberScale: 1,
  maxVisible: 7,
  showGlow: true,
};

interface SinceCountersTileStyleState {
  live: SinceCountersTileStyle;
  draft: SinceCountersTileStyle;
  _hydrated: boolean;
  setDraft: (patch: Partial<SinceCountersTileStyle>) => void;
  publish: () => void;
  discardDraft: () => void;
  resetDraftToDefault: () => void;
}

export const useSinceCountersTileStyleStore = create<SinceCountersTileStyleState>()(
  persist(
    (set, get) => ({
      live: DEFAULT_SINCE_COUNTERS_TILE_STYLE,
      draft: DEFAULT_SINCE_COUNTERS_TILE_STYLE,
      _hydrated: false,
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      publish: () => set((s) => ({ live: s.draft })),
      discardDraft: () => set((s) => ({ draft: s.live })),
      resetDraftToDefault: () => set({ draft: DEFAULT_SINCE_COUNTERS_TILE_STYLE }),
    }),
    {
      name: 'since-counters-tile-style-v1',
      storage: throttledPersistStorage(),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
