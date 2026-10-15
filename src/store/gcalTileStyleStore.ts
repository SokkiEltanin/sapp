import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Kreator dashboardu, Faza 13 (2026-10-15, §339) — szósta i OSTATNIA karta z pierwotnej listy
// kandydatów w §327 (StreakWall/Records/Countdowns/SinceCounters/PinnedNotes/GCal). `GCalCard`
// ma jeszcze inny kształt niż wszystkie pięć poprzednich — lista eventów w DWÓCH sekcjach
// (Dziś/Jutro), kolor PER-EVENT (`e.color ?? c.brand.gcal`, nie jeden kolor karty jak
// `accentColor` w "Rekordach") — więc ŚWIADOMIE bez pola koloru, ten sam powód co brak
// akcentu w "Licznikach" (§337): kolor jest POCHODNĄ danych (kalendarza eventu), nie stałą
// wartością karty do nadpisania.
export interface GCalTileStyle {
  maxVisible: number;
  showTime: boolean;
  showDot: boolean;
}

export const DEFAULT_GCAL_TILE_STYLE: GCalTileStyle = {
  maxVisible: 5,
  showTime: true,
  showDot: true,
};

interface GCalTileStyleState {
  live: GCalTileStyle;
  draft: GCalTileStyle;
  _hydrated: boolean;
  setDraft: (patch: Partial<GCalTileStyle>) => void;
  publish: () => void;
  discardDraft: () => void;
  resetDraftToDefault: () => void;
}

export const useGCalTileStyleStore = create<GCalTileStyleState>()(
  persist(
    (set, get) => ({
      live: DEFAULT_GCAL_TILE_STYLE,
      draft: DEFAULT_GCAL_TILE_STYLE,
      _hydrated: false,
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      publish: () => set((s) => ({ live: s.draft })),
      discardDraft: () => set((s) => ({ draft: s.live })),
      resetDraftToDefault: () => set({ draft: DEFAULT_GCAL_TILE_STYLE }),
    }),
    {
      name: 'gcal-tile-style-v1',
      storage: throttledPersistStorage(),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
