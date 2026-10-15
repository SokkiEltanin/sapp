import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

export interface StreakTileStyle {
  cornerRadius: number;
  aspectRatio: number;
  gradientMode: 'gradient' | 'flat';
  showProgressBar: boolean;
  showFlame: boolean;
  numberScale: number;
}

// Wartości dokładnie odtwarzające TERAŹNIEJSZY, zaszyty na sztywno wygląd StreakWallCard
// (radius.lg=16, aspectRatio=1.7 z komentarza "kafelki są za długie", gradient+pasek+płomień
// zawsze włączone) — więc dopóki nikt nic nie wdroży z kreatora, `live` renderuje się
// BIT-W-BIT tak samo jak przed tą zmianą.
export const DEFAULT_STREAK_TILE_STYLE: StreakTileStyle = {
  cornerRadius: 16,
  aspectRatio: 1.7,
  gradientMode: 'gradient',
  showProgressBar: true,
  showFlame: true,
  numberScale: 1,
};

// Kreator dashboardu, Faza 1 (2026-10-15, user: "zrobisz mi prawdziwy kreator w ustawieniach
// ze wszystkim w aplikacji... ja będę sobie robił edytował kreował poprawiał w opisie
// kafelków i wtedy eksportował" — po tym jak makiety HTML w Artifact okazały się za wolną
// pętlą iteracji). `live` = to, co REALNIE renderuje się na dashboardzie (StreakWallCard
// czyta stąd, patrz jej `tileStyle` tam gdzie `styleOverride` nie jest podane). `draft` =
// to, co user kręci w kreatorze — osobne pole, żeby bawienie się suwakami NIE zmieniało
// prawdziwego dashboardu, dopóki nie kliknie "Wdróż". Brak jawnego "eksportu" — draft→live
// to już cały eksport, appka od razu jest tym co widać w podglądzie (prawdziwy WYSIWYG, nie
// HTML-owa makieta do przepisania ręcznie).
interface StreakTileStyleState {
  live: StreakTileStyle;
  draft: StreakTileStyle;
  _hydrated: boolean;
  setDraft: (patch: Partial<StreakTileStyle>) => void;
  publish: () => void;
  discardDraft: () => void;
  resetDraftToDefault: () => void;
}

export const useStreakTileStyleStore = create<StreakTileStyleState>()(
  persist(
    (set, get) => ({
      live: DEFAULT_STREAK_TILE_STYLE,
      draft: DEFAULT_STREAK_TILE_STYLE,
      _hydrated: false,
      setDraft: (patch) => set((s) => ({ draft: { ...s.draft, ...patch } })),
      publish: () => set((s) => ({ live: s.draft })),
      discardDraft: () => set((s) => ({ draft: s.live })),
      resetDraftToDefault: () => set({ draft: DEFAULT_STREAK_TILE_STYLE }),
    }),
    {
      name: 'streak-tile-style-v1',
      storage: throttledPersistStorage(),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
