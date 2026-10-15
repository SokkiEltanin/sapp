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
  // Paleta progów + odstępy (2026-10-15, Kreator Faza 7, §333) — user: "chce mieć inne palety
  // kolorów modyfikacje streku każdego progu... ustawienia spacowania między kafelkami".
  // `tierColorOverrides` — klucz = indeks progu (0-7, patrz `STREAK_TIERS` w streakTiers.ts),
  // wartość = nadpisany kolor TEGO kafla. ŚWIADOMIE nie modyfikuje `streakColor()`/
  // `STREAK_TIERS` bezpośrednio — ta funkcja jest importowana w ~5 miejscach appki (kalendarz
  // roku, płomień licznika itd.), zmiana tam zmieniłaby wygląd rzeczy NIEZWIĄZANYCH z tym
  // kreatorem. Nadpisanie działa TYLKO wewnątrz `StreakWallCard`, reszta appki zostaje jak
  // była. Progi (minimalna liczba dni) NIE są tu edytowalne — to zmieniłoby tempo motywacyjne
  // całej appki (patrz obszerny komentarz przy STREAK_TIERS o celowym rozstawieniu progów),
  // zbyt ryzykowne żeby wystawiać jako prosty suwak bez osobnej decyzji projektowej.
  tierColorOverrides: Record<number, string>;
  tileGap: number;
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
  tierColorOverrides: {},
  tileGap: 8,
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
  // `null` usuwa nadpisanie koloru tego progu (wraca do domyślnego `STREAK_TIERS[i].color`).
  setDraftTierColor: (tierIndex: number, color: string | null) => void;
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
      setDraftTierColor: (tierIndex, color) => set((s) => {
        const next = { ...s.draft.tierColorOverrides };
        if (color) next[tierIndex] = color; else delete next[tierIndex];
        return { draft: { ...s.draft, tierColorOverrides: next } };
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
