import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { mergeTileStyleState } from './tileStyleMerge';
import { CountdownLayoutPreset } from './countdownTileStyleDefaults';

export interface CountdownsTileStyle {
  layoutPreset: CountdownLayoutPreset;
  cornerRadius: number;
  ringSize: number;
  ringStrokeWidth: number;
  numberScale: number;
  maxVisible: number;
}

// Odtwarza dzisiejszy zaszyty na sztywno wygląd CountdownsCard (radius.xl=24 na karcie —
// INNY token niż radius.lg=16 używany przez StreakWallCard/PersonalRecordsCard, więc default
// TU jest inny, nie kopiowany 1:1 z poprzednich stores), `RingCountdown` domyślne
// `size=64`/`strokeWidth=6`, zawsze 3 widoczne pozycje (`.slice(0,3)` w oryginalnym kodzie).
export const DEFAULT_COUNTDOWNS_TILE_STYLE: CountdownsTileStyle = {
  layoutPreset: 'ring',
  cornerRadius: 24,
  ringSize: 64,
  ringStrokeWidth: 6,
  numberScale: 1,
  maxVisible: 3,
};

// Kreator dashboardu — Faza 3 (2026-10-15, ARCHITECTURE.md §329), trzecia karta po
// `streakTileStyleStore` (§327) i `recordsTileStyleStore` (§328). `CountdownsCard` ma INNY
// kształt niż poprzednie dwie (lista wierszy z pierścieniem, nie siatka kafelków) — stąd
// własne, dopasowane pola zamiast kopiowania cornerRadius/aspectRatio/numberScale 1:1.
interface CountdownsTileStyleState {
  live: CountdownsTileStyle;
  draft: CountdownsTileStyle;
  _hydrated: boolean;
  setDraft: (patch: Partial<CountdownsTileStyle>) => void;
  publish: () => void;
  discardDraft: () => void;
  resetDraftToDefault: () => void;
}

export const useCountdownsTileStyleStore = create<CountdownsTileStyleState>()(
  persist(
    (set, get) => ({
      live: DEFAULT_COUNTDOWNS_TILE_STYLE,
      draft: DEFAULT_COUNTDOWNS_TILE_STYLE,
      _hydrated: false,
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      publish: () => set((s) => ({ live: s.draft })),
      discardDraft: () => set((s) => ({ draft: s.live })),
      resetDraftToDefault: () => set({ draft: DEFAULT_COUNTDOWNS_TILE_STYLE }),
    }),
    {
      name: 'countdowns-tile-style-v1',
      storage: throttledPersistStorage(),
      merge: mergeTileStyleState,
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
