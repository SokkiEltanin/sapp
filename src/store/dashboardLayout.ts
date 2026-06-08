import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Lets the user reorder, hide/show and add custom tiles to the dashboard. The
// hero/briefing card + the "in progress" lifebar stay fixed at the top; every
// other section below is reorderable and identified by a stable id here.

export const DEFAULT_DASHBOARD_SECTIONS = [
  'weekly-insights',
  'tag-limits',
  'budget-warning',
  'pinned-notes',
  'tasks-work-row',
  'today-tasks',
  'tools-row',
  'habits-nudge',
  'habits-today',
  'stats-scope',
  'finances',
  'sweets-vs-food',
  'spend-by-day',
  'work-hours',
  'top-products',
  'fun-facts',
  'mood-cal',
  'mood-wave',
  'month-tasks',
  'gcal',
] as const;

export type SectionId = typeof DEFAULT_DASHBOARD_SECTIONS[number];

// Human labels shown in the "Edytuj dashboard" editor.
export const SECTION_TITLES: Record<string, string> = {
  'weekly-insights': 'Przegląd tygodnia',
  'tag-limits':     'Limity tagów (#słodycze…)',
  'budget-warning': 'Ostrzeżenie o budżecie',
  'pinned-notes':   'Przypięte notatki',
  'tasks-work-row': 'Zadania + praca (kafelki)',
  'today-tasks':    'Zadania na dziś / zaległe',
  'tools-row':      'Narzędzia (Humor, Nawyki…)',
  'habits-nudge':   'Przypomnienie o nawykach',
  'habits-today':   'Nawyki dziś',
  'stats-scope':    'Przełącznik statystyk',
  'finances':       'Finanse (tydzień / miesiąc)',
  'sweets-vs-food': 'Słodycze vs jedzenie (8 tyg.)',
  'spend-by-day':   'Wydatki wg dnia tygodnia',
  'work-hours':     'Godziny pracy',
  'top-products':   'Top 3 kupowane',
  'fun-facts':      'Ciekawostki',
  'mood-cal':       'Nastrój — kalendarz',
  'mood-wave':      'Nastrój — 8 tygodni',
  'month-tasks':    'Statystyki zadań (miesiąc)',
  'gcal':           'Kalendarz Google',
};

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
  metric2?: string;      // second metric id (viz 'compare')
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
