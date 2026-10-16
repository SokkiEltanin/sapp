import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { StreakTileStyle, DEFAULT_STREAK_TILE_STYLE } from '@/store/streakTileStyleStore';

// System kopiowania komponentów, Faza 15 (2026-10-16, §341) — user: "chce dosłownie tam od
// zera zbudować z przesunięciem podpięcia itp", doprecyzowane: WOLNE PŁÓTNO (Figma/Canva-style
// — swobodna pozycja/rozmiar, elementy mogą się nakładać), nie kolejny ekran-ustawień. Każda
// `CanvasItem` to JEDNA instancja komponentu na JEDNYM ekranie (`screenKey`, np. `'food'`),
// z własną pozycją/rozmiarem/podpięciem/stylem — niezależna od wszystkich innych instancji
// (łącznie z tym samym `componentType` gdzie indziej), i niezależna od globalnych store'ów
// Kreatora (`streakTileStyleStore` itd.) — kopia naprawdę jest kopią, nie linkiem.
//
// `componentType` tylko `'streakTile'` na razie — kafel serii jest najbogatszy stylistycznie
// (4 layoutPresety, Fazy 8-10) i to dokładnie przykład usera (woda z dashboardu → słodycze w
// Jedzeniu). Więcej typów (Rekordy/Odliczania/Notatki/Kalendarz jako kopiowalne) to kolejna,
// osobna faza — typ jest już discriminated union żeby dojście tam nie wymagało migracji.
export type CanvasComponentType = 'streakTile';

export interface CanvasItem {
  id: string;              // 'canvas:<timestamp>'
  screenKey: string;       // np. 'food' — które miejsce w appce renderuje tę instancję
  componentType: CanvasComponentType;
  x: number; y: number;
  width: number; height: number;
  // Klucz z `useAllStreakItems()` (`h:<habitId>` | `c:<counterId>` | `ex:exercises`) — TEN SAM
  // format co `StreakItem.key` używany już w StreakWallCard/kreatorze, zero nowego słownika
  // identyfikatorów. `null` = jeszcze nieprzepięty (nowo dodany, czeka na wybór w pickerze).
  bindingKey: string | null;
  style: StreakTileStyle;  // per-instancja, kopia — edycja jednej instancji NIE dotyka innych
}

const DEFAULT_WIDTH = 150;
const DEFAULT_HEIGHT = 92;

interface CanvasComponentsState {
  items: CanvasItem[];
  _hydrated: boolean;
  addItem: (screenKey: string, componentType: CanvasComponentType) => string;
  updateItem: (id: string, patch: Partial<Omit<CanvasItem, 'id' | 'screenKey' | 'componentType'>>) => void;
  removeItem: (id: string) => void;
}

export const useCanvasComponentsStore = create<CanvasComponentsState>()(
  persist(
    (set, get) => ({
      items: [],
      _hydrated: false,

      // Nowa instancja ląduje POD najniżej leżącym elementem na TYM ekranie (nie w (0,0) na
      // oślep) — żeby domyślnie NIE nakładała się na istniejące, mimo że nakładanie jest
      // dozwolone, jeśli user sam tak przeciągnie. Pierwsza instancja na ekranie: (12, 12).
      addItem: (screenKey, componentType) => {
        const id = `canvas:${Date.now()}`;
        const existing = get().items.filter(i => i.screenKey === screenKey);
        const maxBottom = existing.reduce((m, i) => Math.max(m, i.y + i.height), 0);
        const y = existing.length === 0 ? 12 : maxBottom + 12;
        const item: CanvasItem = {
          id, screenKey, componentType, x: 12, y,
          width: DEFAULT_WIDTH, height: DEFAULT_HEIGHT,
          bindingKey: null,
          style: DEFAULT_STREAK_TILE_STYLE,
        };
        set((s) => ({ items: [...s.items, item] }));
        return id;
      },

      updateItem: (id, patch) => set((s) => ({
        items: s.items.map(i => i.id === id ? { ...i, ...patch } : i),
      })),

      removeItem: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),
    }),
    {
      name: 'canvas-components-v1',
      storage: throttledPersistStorage(),
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
