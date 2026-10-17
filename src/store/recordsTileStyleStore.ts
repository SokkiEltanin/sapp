import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { mergeTileStyleState } from './tileStyleMerge';

export interface RecordsTileStyle {
  cornerRadius: number;
  aspectRatio: number;
  numberScale: number;
  showBgIcon: boolean;
  accentColor: string;
}

// Odtwarza DOKŁADNIE dzisiejszy zaszyty na sztywno wygląd PersonalRecordsCard (radius.lg=16,
// aspectRatio=1.5 z grid-tile, złoty akcent `GOLD='#FBBF24'`, ikona-tło zawsze widoczna) —
// bez `publish()` nic się wizualnie nie zmienia.
export const DEFAULT_RECORDS_TILE_STYLE: RecordsTileStyle = {
  cornerRadius: 16,
  aspectRatio: 1.5,
  numberScale: 1,
  showBgIcon: true,
  accentColor: '#FBBF24',
};

// Kreator dashboardu — Faza 2 (2026-10-15, ARCHITECTURE.md §328), druga karta po
// `streakTileStyleStore` (§327). Ten sam draft/live split: `live` renderuje się naprawdę na
// dashboardzie, `draft` to plac zabaw kreatora, `publish()` kopiuje jedno w drugie.
interface RecordsTileStyleState {
  live: RecordsTileStyle;
  draft: RecordsTileStyle;
  _hydrated: boolean;
  setDraft: (patch: Partial<RecordsTileStyle>) => void;
  publish: () => void;
  discardDraft: () => void;
  resetDraftToDefault: () => void;
}

export const useRecordsTileStyleStore = create<RecordsTileStyleState>()(
  persist(
    (set, get) => ({
      live: DEFAULT_RECORDS_TILE_STYLE,
      draft: DEFAULT_RECORDS_TILE_STYLE,
      _hydrated: false,
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      publish: () => set((s) => ({ live: s.draft })),
      discardDraft: () => set((s) => ({ draft: s.live })),
      resetDraftToDefault: () => set({ draft: DEFAULT_RECORDS_TILE_STYLE }),
    }),
    {
      name: 'records-tile-style-v1',
      storage: throttledPersistStorage(),
      merge: mergeTileStyleState,
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
