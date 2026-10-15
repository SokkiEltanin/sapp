import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

export type HabitCalendarStyle = 'water' | 'year';
export type FlameCorner = 'tl' | 'tr' | 'bl' | 'br';
export type ContentAlign = 'left' | 'center';

export interface StreakTileStyle {
  cornerRadius: number;
  aspectRatio: number;
  gradientMode: 'gradient' | 'flat';
  showProgressBar: boolean;
  showFlame: boolean;
  numberScale: number;
  // Pozycja i warstwy (2026-10-15, Kreator Faza 5, §331) — user: "edycje graficzne
  // justowanie skalowanie zaokrąglenie cornerów, warstwy itp". `flameCorner` = w którym rogu
  // siedzi watermark płomienia (dziś zaszyte na sztywno: prawy-dolny). `flameOnTop` = czy
  // płomień rysuje się NAD tekstem (efektowne, ale może zasłonić liczbę przy dużym rozmiarze)
  // czy POD nim jak dziś (tekst zawsze czytelny). `contentAlign` = wyrównanie liczby/etykiety
  // w poziomie wewnątrz kafla.
  flameCorner: FlameCorner;
  flameOnTop: boolean;
  contentAlign: ContentAlign;
  // Przepinanie nawigacji (2026-10-15, Kreator Faza 4, §330) — user: "kafelek po kliknięciu
  // przenosi TUTAJ". ŚWIADOMIE nie "dowolny ekran z appki" (złamałoby nawigację — kafelek
  // Wody prowadzący do Pracy nie ma sensu i user by się zgubił), tylko wybór między DWOMA
  // widokami, które appka JUŻ uznaje za poprawne dla kafelka nawyku (`h:` w onTile niżej) —
  // bogaty kalendarz wody vs generyczny kalendarz roku. Dziś wybierane automatycznie po
  // `kind==='water'`; to pozwala to nadpisać per-nawyk (klucz = goły id nawyku, BEZ `h:`
  // prefiksu). Brak wpisu = zachowanie domyślne (jak dotąd).
  habitCalendarOverrides: Record<string, HabitCalendarStyle>;
}

// Wartości dokładnie odtwarzające TERAŹNIEJSZY, zaszyty na sztywno wygląd StreakWallCard
// (radius.lg=16, aspectRatio=1.7 z komentarza "kafelki są za długie", gradient+pasek+płomień
// zawsze włączone, zero nadpisań nawigacji) — więc dopóki nikt nic nie wdroży z kreatora,
// `live` renderuje się BIT-W-BIT tak samo jak przed tą zmianą.
export const DEFAULT_STREAK_TILE_STYLE: StreakTileStyle = {
  cornerRadius: 16,
  aspectRatio: 1.7,
  gradientMode: 'gradient',
  showProgressBar: true,
  showFlame: true,
  numberScale: 1,
  habitCalendarOverrides: {},
  flameCorner: 'br',
  flameOnTop: false,
  contentAlign: 'left',
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
  // `null` usuwa nadpisanie (wraca do zachowania domyślnego dla tego nawyku).
  setDraftHabitCalendar: (habitId: string, style: HabitCalendarStyle | null) => void;
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
      setDraftHabitCalendar: (habitId, style) => set((s) => {
        const next = { ...s.draft.habitCalendarOverrides };
        if (style) next[habitId] = style; else delete next[habitId];
        return { draft: { ...s.draft, habitCalendarOverrides: next } };
      }),
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
