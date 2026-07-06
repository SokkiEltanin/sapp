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
  'gablota-card',
  'habits-nudge',
  'habits-today',
  'stats-scope',
  'finances',
  'fixed-variable',
  'sweets-vs-food',
  'who-ate',
  'spend-by-day',
  'work-hours',
  'top-products',
  'fun-facts',
  'correlations',
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
  'gablota-card':   'Gablota osiągnięć (postęp)',
  'habits-nudge':   'Przypomnienie o nawykach',
  'habits-today':   'Nawyki dziś',
  'stats-scope':    'Przełącznik statystyk',
  'finances':       'Finanse (tydzień / miesiąc)',
  'fixed-variable': 'Stałe vs zmienne (4 mies.)',
  'sweets-vs-food': 'Słodycze vs jedzenie (8 tyg.)',
  'who-ate':        'Kto zjadł słodycze (podział)',
  'spend-by-day':   'Wydatki wg dnia tygodnia',
  'work-hours':     'Praca (zarobek + godziny)',
  'top-products':   'Top 3 kupowane',
  'fun-facts':      'Ciekawostki',
  'correlations':   'Zależności (sen/kroki/nastrój/wydatki)',
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
  'gablota-card':   'Postęp w gablocie osiągnięć',
  'habits-nudge':   'Wieczorne przypomnienie o nawykach',
  'habits-today':   'Nawyki do odhaczenia dziś',
  'stats-scope':    'Przełącznik: ja / wszyscy',
  'finances':       'Saldo, wydatki i przychody (tydzień/miesiąc)',
  'fixed-variable': 'Koszty stałe vs zmienne (4 mies.)',
  'sweets-vs-food': 'Słodycze vs jedzenie (8 tygodni)',
  'who-ate':        'Kto zjadł słodycze — podział Ty vs domownicy',
  'spend-by-day':   'Wydatki wg dnia tygodnia',
  'work-hours':     'Zarobek + godziny pracy w miesiącu',
  'top-products':   'Top 3 najczęściej kupowane',
  'fun-facts':      'Ciekawostki z Twoich danych',
  'correlations':   'Zależności: sen / kroki / nastrój / wydatki',
  'mood-cal':       'Kalendarz nastroju',
  'mood-wave':      'Nastrój — fala 8 tygodni',
  'month-tasks':    'Statystyki ukończonych zadań (miesiąc)',
  'gcal':           'Nadchodzące wydarzenia z Google Calendar',
};

// Category for grouping the "add section" pool in the editor.
export const SECTION_GROUP: Record<string, string> = {
  'payday-prompt': 'Przypomnienia', 'debt-prompt': 'Przypomnienia', 'bill-suggest': 'Przypomnienia',
  'bank-queue': 'Przypomnienia', 'maintenance-reminders': 'Przypomnienia', 'budget-warning': 'Przypomnienia',
  'tag-limits': 'Przypomnienia', 'habits-nudge': 'Przypomnienia',
  'tasks-work-row': 'Zadania i nawyki', 'today-tasks': 'Zadania i nawyki', 'month-tasks': 'Zadania i nawyki',
  'habits-today': 'Zadania i nawyki',
  'finances': 'Finanse', 'fixed-variable': 'Finanse', 'sweets-vs-food': 'Finanse',
  'spend-by-day': 'Finanse', 'top-products': 'Finanse', 'work-hours': 'Finanse', 'who-ate': 'Finanse',
  'weekly-insights': 'Przegląd i statystyki', 'stats-scope': 'Przegląd i statystyki',
  'fun-facts': 'Przegląd i statystyki', 'correlations': 'Przegląd i statystyki',
  'mood-cal': 'Nastrój i liczniki', 'mood-wave': 'Nastrój i liczniki', 'countdowns': 'Nastrój i liczniki',
  'counters-since': 'Nastrój i liczniki', 'gablota-card': 'Nastrój i liczniki',
  'pinned-notes': 'Inne', 'gcal': 'Inne', 'daily-rings': 'Zadania i nawyki', 'month-summary': 'Przegląd i statystyki',
};
export const SECTION_GROUP_ORDER = ['Przypomnienia', 'Zadania i nawyki', 'Finanse', 'Przegląd i statystyki', 'Nastrój i liczniki', 'Inne'];

export type CustomTileType = 'note' | 'link' | 'stat' | 'weather';
export type WidgetViz = 'number' | 'wave' | 'list' | 'compare' | 'donut';

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
  const customIds = new Set(customTiles.map(t => t.id));
  const known = (id: string) =>
    (DEFAULT_DASHBOARD_SECTIONS as readonly string[]).includes(id) || customIds.has(id);
  const kept = order.filter(known);
  // append default sections missing from the stored order (new in an update)
  for (const id of DEFAULT_DASHBOARD_SECTIONS) if (!kept.includes(id)) kept.push(id);
  // append custom tiles missing from the order (safety)
  for (const id of customIds) if (!kept.includes(id)) kept.unshift(id);
  return kept;
}
