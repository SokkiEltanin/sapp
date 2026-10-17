import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { mergeTileStyleState } from './tileStyleMerge';

// Kreator dashboardu, Faza 11 (2026-10-15, §337) — czwarta karta w kreatorze, pierwsza od
// Fazy 3 rozszerzająca mechanizm na NOWY komponent (nie nowy preset na istniejącym). Kandydat
// wskazany w NEXT_STEPS.md: `SinceCountersCard` ("Liczniki" — "ile dni temu X") ma kształt
// listy wierszy (duża liczba + poświata + nazwa/meta), bliski `CountdownsCard`, więc własne
// pola odpowiadają TEMU kształtowi — nie kopiuję aspectRatio/gradientMode z kafelków serii
// (ta karta nie ma siatki kafelków, tylko jedną kolumnę wierszy).
//
// Warianty kształtu (Faza 30, 2026-10-17, §362) — NEXT_STEPS.md flagowało od §355: "Rekordy/
// Liczniki/Notatki dalej mają TYLKO suwaki liczbowe". `SinceCountersCard` NIE ma odpowiednika
// na wolnym płótnie (żaden `CanvasComponentType` dla liczników nie istnieje) — typ żyje więc
// WYŁĄCZNIE tutaj, bez ekstrakcji do osobnego pure-TS pliku jak `CountdownLayoutPreset` (ten
// plik już jest pure TS, zero importu `'react-native'`, zero problemu testowalności). 4 WŁASNE
// warianty dopasowane do treści licznika — próg SERII (nie data/postęp jak w odliczaniach,
// świadomie NIE kopiowane 1:1): `'row'` = dokładny dotychczasowy wygląd (default). `'bar'` =
// pasek postępu DO NASTĘPNEGO PROGU serii (unikalna treść tego typu — odliczania mają postęp do
// daty, serie nie mają nic takiego, licznik ma próg). `'compact'` = jedna linijka. `'minimal'` =
// goła duża liczba + nazwa, bez poświaty/meta (najbardziej wyciszony wariant).
export type SinceCounterLayoutPreset = 'row' | 'bar' | 'compact' | 'minimal';

export interface SinceCountersTileStyle {
  layoutPreset: SinceCounterLayoutPreset;
  rowRadius: number;
  numberScale: number;
  maxVisible: number;
  showGlow: boolean;
}

export const DEFAULT_SINCE_COUNTERS_TILE_STYLE: SinceCountersTileStyle = {
  layoutPreset: 'row',
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
      merge: mergeTileStyleState,
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
