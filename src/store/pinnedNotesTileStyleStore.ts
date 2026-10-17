import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { mergeTileStyleState } from './tileStyleMerge';

// Kreator dashboardu, Faza 12 (2026-10-15, §338) — piąta karta, drugi komponent od Fazy 3 z
// zupełnie nowym kształtem treści (tekst+tagi, nie liczba+próg jak dotychczasowe cztery karty).
// `PinnedNotesCard` nie ma koloru/gradientu/progu do nadpisywania — jedyne, co realnie różni
// wygląd tej karty, to ILE notatek pokazać i CZY pokazywać podgląd treści/tagi (notatka sama w
// sobie ma swój tekst, nie ma tu nic do "stylowania" w sensie kolorów jak w innych kartach).
export interface PinnedNotesTileStyle {
  maxVisible: number;
  showBody: boolean;
  showTags: boolean;
}

export const DEFAULT_PINNED_NOTES_TILE_STYLE: PinnedNotesTileStyle = {
  maxVisible: 4,
  showBody: true,
  showTags: true,
};

interface PinnedNotesTileStyleState {
  live: PinnedNotesTileStyle;
  draft: PinnedNotesTileStyle;
  _hydrated: boolean;
  setDraft: (patch: Partial<PinnedNotesTileStyle>) => void;
  publish: () => void;
  discardDraft: () => void;
  resetDraftToDefault: () => void;
}

export const usePinnedNotesTileStyleStore = create<PinnedNotesTileStyleState>()(
  persist(
    (set, get) => ({
      live: DEFAULT_PINNED_NOTES_TILE_STYLE,
      draft: DEFAULT_PINNED_NOTES_TILE_STYLE,
      _hydrated: false,
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      publish: () => set((s) => ({ live: s.draft })),
      discardDraft: () => set((s) => ({ draft: s.live })),
      resetDraftToDefault: () => set({ draft: DEFAULT_PINNED_NOTES_TILE_STYLE }),
    }),
    {
      name: 'pinned-notes-tile-style-v1',
      storage: throttledPersistStorage(),
      merge: mergeTileStyleState,
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
