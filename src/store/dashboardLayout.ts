import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lets the user reorder, hide/show and add custom tiles to the dashboard. The
// hero/briefing card + the "in progress" lifebar stay fixed at the top; every
// other section below is reorderable and identified by a stable id here.

export const DEFAULT_DASHBOARD_SECTIONS = [
  'payday-prompt',
  'debt-prompt',
  'bank-queue',
  'bill-suggest',
  'sub-confirm',
  'pet',
  'month-summary',
  'weekly-insights',
  'maintenance-reminders',
  'tag-limits',
  'budget-warning',
  'pinned-notes',
  'daily-rings',
  'tasks-work-row',
  'today-tasks',
  'countdowns',
  'counters-since',
  'streak-wall',
  'personal-records',
  'trivia',
  'time-capsule',
  'gablota-card',
  'habits-nudge',
  'habits-today',
  'stats-scope',
  'finances',
  'fixed-variable',
  'food-breakdown',
  'spend-bubbles',
  'sweets-vs-food',
  'who-ate',
  'spend-by-day',
  'work-hours',
  'top-products',
  'shops-collection',
  'fun-facts',
  'correlations',
  'year-ago',
  'mood-cal',
  'mood-wave',
  'month-tasks',
  'gcal',
] as const;

export type SectionId = typeof DEFAULT_DASHBOARD_SECTIONS[number];

// Human labels shown in the "Edytuj dashboard" editor.
export const SECTION_TITLES: Record<string, string> = {
  'payday-prompt':  'Pytanie o wypłatę',
  'debt-prompt':    'Pytanie o dług (zwrot)',
  'bill-suggest':   'Propozycja stałego rachunku',
  'sub-confirm':    'Potwierdź subskrypcję z banku',
  'pet':            'Pupil (blob)',
  'month-summary':  'Karta miesiąca (Wrapped)',
  'bank-queue':     'Płatności z banku (do zatwierdzenia)',
  'weekly-insights': 'Przegląd (kafelki + miesiące)',
  'maintenance-reminders': 'Serwis i przypomnienia',
  'tag-limits':     'Limity tagów (#słodycze…)',
  'budget-warning': 'Ostrzeżenie o budżecie',
  'pinned-notes':   'Przypięte notatki',
  'daily-rings':    'Pierścienie celów dnia',
  'tasks-work-row': 'Zadania + praca (kafelki)',
  'today-tasks':    'Zadania na dziś / zaległe',
  'countdowns':     'Odliczania do wydarzeń',
  'counters-since': 'Liczniki (dni bez / temu)',
  'streak-wall':    'Twoje serie (ściana serii)',
  'personal-records': 'Rekordy życiowe',
  'trivia':         'Ciekawostka dnia',
  'time-capsule':   'List do przyszłego siebie',
  'gablota-card':   'Gablota osiągnięć (postęp)',
  'habits-nudge':   'Przypomnienie o nawykach',
  'habits-today':   'Nawyki dziś',
  'stats-scope':    'Przełącznik statystyk',
  'finances':       'Finanse (tydzień / miesiąc)',
  'fixed-variable': 'Na co idą pieniądze (stałe/zmienne/jedzenie)',
  'food-breakdown': 'Jedzenie — rozkład',
  'spend-bubbles':  'Bąbelki wydatków',
  'sweets-vs-food': 'Słodycze vs jedzenie (8 tyg.)',
  'who-ate':        'Kto zjadł słodycze (podział)',
  'spend-by-day':   'Wydatki wg dnia tygodnia',
  'work-hours':     'Praca (zarobek + godziny)',
  'top-products':   'Top 3 kupowane',
  'shops-collection': 'Kolekcja sklepów',
  'fun-facts':      'Ciekawostki',
  'correlations':   'Zależności (sen/kroki/nastrój/wydatki)',
  'year-ago':       'Rok temu tego dnia',
  'mood-cal':       'Nastrój — kalendarz',
  'mood-wave':      'Nastrój — 8 tygodni',
  'month-tasks':    'Statystyki zadań (miesiąc)',
  'gcal':           'Kalendarz Google',
};

// Short "what it shows" line per section — surfaced in the dashboard editor so you
// know what each toggle does without enabling it.
export const SECTION_DESC: Record<string, string> = {
  'payday-prompt':  'Pyta o wypłatę w dniu wypłaty',
  'debt-prompt':    'Pyta o zwrot pożyczonych pieniędzy',
  'bill-suggest':   'Wykrywa powtarzalny wydatek → stały rachunek',
  'sub-confirm':    'Płatność z banku pasuje do subskrypcji (inna waluta) — potwierdź',
  'pet':            'Twój pupil — nastrój zależny od tego, jak dbasz o siebie',
  'month-summary':  'Kolekcjonerska karta miesiąca (Wrapped)',
  'bank-queue':     'Płatności z banku do zatwierdzenia',
  'weekly-insights':'Kafelki tygodnia + porównanie miesięcy',
  'maintenance-reminders': 'Serwis pojazdów i przypomnienia',
  'tag-limits':     'Ile zostało z limitów #tagów',
  'budget-warning': 'Ostrzeżenie gdy budżet na wyczerpaniu',
  'pinned-notes':   'Przypięte notatki na wierzchu',
  'daily-rings':    'Pierścienie na dziś: kroki, woda, budżet, nawyki',
  'tasks-work-row': 'Kafelki: zadania na dziś + praca',
  'today-tasks':    'Lista zadań na dziś i zaległych',
  'countdowns':     'Odliczanie dni do wydarzeń',
  'counters-since': 'Ile dni bez / od czegoś',
  'streak-wall':    'Wszystkie aktywne serie (nawyki + dni bez) w rankingu',
  'personal-records': 'Twoje all-time rekordy: kroki, sen, bez słodyczy, nastrój',
  'trivia':         'Ciekawostka dnia — nauka, książki, rozwój, świat (stuknij po nową)',
  'time-capsule':   'Napisz wiadomość, która odblokuje się za jakiś czas',
  'gablota-card':   'Postęp w gablocie osiągnięć',
  'habits-nudge':   'Wieczorne przypomnienie o nawykach',
  'habits-today':   'Nawyki do odhaczenia dziś',
  'stats-scope':    'Przełącznik: ja / wszyscy',
  'finances':       'Saldo, wydatki i przychody (tydzień/miesiąc)',
  'fixed-variable': 'Stałe (z nazwami) vs zmienne vs jedzenie + trend 4 mies.',
  'food-breakdown': 'Jedzenie: miesiąc, tygodnie/dni i podkategorie (mięso, nabiał…)',
  'spend-bubbles':  'Kategorie tego miesiąca jako bąbelki (wielkość = kwota)',
  'sweets-vs-food': 'Słodycze vs jedzenie (8 tygodni)',
  'who-ate':        'Kto zjadł słodycze — podział Ty vs domownicy',
  'spend-by-day':   'Wydatki wg dnia tygodnia',
  'work-hours':     'Zarobek + godziny pracy w miesiącu',
  'top-products':   'Top 3 najczęściej kupowane',
  'shops-collection': 'Ile sklepów odwiedziłeś — ulubiony, ostatnio nowy',
  'fun-facts':      'Ciekawostki z Twoich danych',
  'correlations':   'Zależności: sen / kroki / nastrój / wydatki',
  'year-ago':       'Nastrój, wydatki i kroki sprzed dokładnie roku',
  'mood-cal':       'Kalendarz nastroju',
  'mood-wave':      'Nastrój — fala 8 tygodni',
  'month-tasks':    'Statystyki ukończonych zadań (miesiąc)',
  'gcal':           'Nadchodzące wydarzenia z Google Calendar',
};

// Category for grouping the "add section" pool in the editor.
export const SECTION_GROUP: Record<string, string> = {
  'payday-prompt': 'Przypomnienia', 'debt-prompt': 'Przypomnienia', 'bill-suggest': 'Przypomnienia', 'sub-confirm': 'Przypomnienia',
  'bank-queue': 'Przypomnienia', 'maintenance-reminders': 'Przypomnienia', 'budget-warning': 'Przypomnienia',
  'tag-limits': 'Przypomnienia', 'habits-nudge': 'Przypomnienia',
  'tasks-work-row': 'Zadania i nawyki', 'today-tasks': 'Zadania i nawyki', 'month-tasks': 'Zadania i nawyki',
  'habits-today': 'Zadania i nawyki',
  'finances': 'Finanse', 'fixed-variable': 'Finanse', 'sweets-vs-food': 'Finanse',
  'spend-by-day': 'Finanse', 'top-products': 'Finanse', 'work-hours': 'Finanse', 'who-ate': 'Finanse',
  'spend-bubbles': 'Finanse', 'shops-collection': 'Finanse', 'food-breakdown': 'Finanse',
  'weekly-insights': 'Przegląd i statystyki', 'stats-scope': 'Przegląd i statystyki',
  'fun-facts': 'Przegląd i statystyki', 'correlations': 'Przegląd i statystyki', 'year-ago': 'Przegląd i statystyki',
  'mood-cal': 'Nastrój i liczniki', 'mood-wave': 'Nastrój i liczniki', 'countdowns': 'Nastrój i liczniki',
  'counters-since': 'Nastrój i liczniki', 'gablota-card': 'Nastrój i liczniki',
  'streak-wall': 'Nastrój i liczniki', 'personal-records': 'Nastrój i liczniki', 'trivia': 'Inne',
  'time-capsule': 'Inne',
  'pinned-notes': 'Inne', 'gcal': 'Inne', 'daily-rings': 'Zadania i nawyki', 'month-summary': 'Przegląd i statystyki',
  'pet': 'Inne',
};
export const SECTION_GROUP_ORDER = ['Zadania i nawyki', 'Finanse', 'Przegląd i statystyki', 'Nastrój i liczniki', 'Inne'];

// AUTO sections — contextual alerts that appear only when there's something to say
// (you got paid, a bank payment is waiting, a budget is nearly spent, a bill is due).
// They are NOT arrangeable content, so the editor hides them entirely: showing them as
// "brak danych" rows you can drag around was pure confusion. They still render in the
// dashboard whenever they're relevant; the user just doesn't manage them by hand.
export const AUTO_SECTIONS = new Set<string>([
  'payday-prompt', 'debt-prompt', 'bill-suggest', 'sub-confirm', 'bank-queue',
  'budget-warning', 'habits-nudge',
]);
export const isAutoSection = (id: string) => AUTO_SECTIONS.has(id);

export type CustomTileType = 'note' | 'link' | 'stat' | 'weather';
export type WidgetViz = 'number' | 'wave' | 'list' | 'compare' | 'donut' | 'pixels';

export interface CustomTile {
  id: string;            // 'custom:<timestamp>'
  type: CustomTileType;
  title: string;
  noteId?: string;       // type 'note'
  route?: string;        // type 'link'
  icon?: string;         // lucide icon name (type 'link')
  // type 'stat':
  metric?: string;       // metric id from statWidgets registry
  metric2?: string;      // second metric id (viz 'compare'); '__self__' = same metric, earlier period
  compareOffset?: number;// periods back for a self comparison (1 = previous, 12 = a year ago)
  viz?: WidgetViz;
  period?: 'week' | 'month';
  target?: number;       // optional goal — drawn as a line / progress on number & wave
  tag?: string;          // for tag-based metrics (e.g. spend / count / kg on #tag)
}

interface DashboardLayoutState {
  order: string[];          // section + custom-tile ids in display order
  hidden: string[];         // hidden ids
  customTiles: CustomTile[];
  _hydrated: boolean;

  editRequested: boolean;   // set from Settings to open the dashboard in edit mode

  requestEdit: () => void;
  clearEditRequest: () => void;
  setOrder: (order: string[]) => void;
  move: (id: string, dir: -1 | 1) => void;
  toggleHidden: (id: string) => void;
  addCustomTile: (tile: Omit<CustomTile, 'id'>) => void;
  updateCustomTile: (id: string, patch: Partial<Omit<CustomTile, 'id' | 'type'>>) => void;
  removeCustomTile: (id: string) => void;
  reset: () => void;
}

export const useDashboardLayout = create<DashboardLayoutState>()(
  persist(
    (set) => ({
      order: [...DEFAULT_DASHBOARD_SECTIONS],
      hidden: [],
      customTiles: [],
      _hydrated: false,
      editRequested: false,

      requestEdit: () => set({ editRequested: true }),
      clearEditRequest: () => set({ editRequested: false }),
      setOrder: (order) => set({ order }),

      move: (id, dir) => set((s) => {
        const idx = s.order.indexOf(id);
        const j = idx + dir;
        if (idx < 0 || j < 0 || j >= s.order.length) return s;
        const order = [...s.order];
        [order[idx], order[j]] = [order[j], order[idx]];
        return { order };
      }),

      toggleHidden: (id) => set((s) => ({
        hidden: s.hidden.includes(id) ? s.hidden.filter(h => h !== id) : [...s.hidden, id],
      })),

      addCustomTile: (tile) => set((s) => {
        const id = `custom:${Date.now()}`;
        return {
          customTiles: [...s.customTiles, { ...tile, id }],
          order: [id, ...s.order],   // new tiles land at the top so they're easy to find
        };
      }),

      updateCustomTile: (id, patch) => set((s) => ({
        customTiles: s.customTiles.map(t => t.id === id ? { ...t, ...patch } : t),
      })),

      removeCustomTile: (id) => set((s) => ({
        customTiles: s.customTiles.filter(t => t.id !== id),
        order: s.order.filter(o => o !== id),
        hidden: s.hidden.filter(h => h !== id),
      })),

      reset: () => set({ order: [...DEFAULT_DASHBOARD_SECTIONS], hidden: [], customTiles: [] }),
    }),
    {
      name: 'dashboard-layout-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({ order: s.order, hidden: s.hidden, customTiles: s.customTiles }),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);

// Merge a stored order with the current section catalog: keep stored order,
// append any newly-added default sections, keep valid custom-tile ids, and drop
// ids that no longer exist. This keeps old layouts working across app updates.
export function effectiveOrder(order: string[], customTiles: CustomTile[]): string[] {
  const DEFAULTS = DEFAULT_DASHBOARD_SECTIONS as readonly string[];
  const customIds = new Set(customTiles.map(t => t.id));
  const known = (id: string) => DEFAULTS.includes(id) || customIds.has(id);
  const kept = order.filter(known);
  // Insert default sections missing from the stored order (new in an app update)
  // at their NATURAL position — right after the nearest earlier default that's
  // present — instead of dumping them at the bottom (that buried e.g. the payday
  // prompt for layouts saved before it existed). User-arranged sections don't move.
  const defIdx = (id: string) => DEFAULTS.indexOf(id);
  for (const id of DEFAULTS) {
    if (kept.includes(id)) continue;
    const di = defIdx(id);
    let pos = 0;
    for (let k = 0; k < kept.length; k++) {
      const kd = defIdx(kept[k]);
      if (kd !== -1 && kd < di) pos = k + 1;
    }
    kept.splice(pos, 0, id);
  }
  // prepend custom tiles missing from the order (safety)
  for (const id of customIds) if (!kept.includes(id)) kept.unshift(id);
  return kept;
}
