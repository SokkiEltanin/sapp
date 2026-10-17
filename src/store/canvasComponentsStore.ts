import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { StreakTileStyle, DEFAULT_STREAK_TILE_STYLE } from '@/store/streakTileStyleStore';
import { CountdownTileStyle, DEFAULT_COUNTDOWN_TILE_STYLE } from '@/components/dashboard/CountdownTile';

// System kopiowania komponentów, Faza 15 (2026-10-16, §341) — user: "chce dosłownie tam od
// zera zbudować z przesunięciem podpięcia itp", doprecyzowane: WOLNE PŁÓTNO (Figma/Canva-style
// — swobodna pozycja/rozmiar, elementy mogą się nakładać), nie kolejny ekran-ustawień. Każda
// `CanvasItem` to JEDNA instancja komponentu na JEDNYM ekranie (`screenKey`, np. `'food'`),
// z własną pozycją/rozmiarem/podpięciem/stylem — niezależna od wszystkich innych instancji
// (łącznie z tym samym `componentType` gdzie indziej), i niezależna od globalnych store'ów
// Kreatora (`streakTileStyleStore` itd.) — kopia naprawdę jest kopią, nie linkiem.
//
// Faza 17 (2026-10-17) — drugi `componentType` (`'countdownTile'`, po `'streakTile'`),
// dowód że mechanizm faktycznie generalizuje się, nie jest zaszyty pod jeden kształt treści.
// `style: StreakTileStyle | CountdownTileStyle` (nie discriminated union z osobnym polem per
// wariant) — ŚWIADOMIE uproszczone: TS-owe `Omit`/`Partial` nad discriminated union z różnym
// `style` per wariant dystrybuują się źle (`keyof` unii dają tylko WSPÓLNE klucze), a jedyni
// konsumenci tego pola (`ScreenCanvas.tsx`/`CanvasPlacedItem.tsx`/modale stylu) i tak zawężają
// przez `item.componentType` PRZED użyciem `style`, więc realne bezpieczeństwo typów żyje tam,
// nie w samym store'cie.
export type CanvasComponentType = 'streakTile' | 'countdownTile';

export interface CanvasItem {
  id: string;              // 'canvas:<timestamp>'
  screenKey: string;       // np. 'food' — które miejsce w appce renderuje tę instancję
  componentType: CanvasComponentType;
  x: number; y: number;
  width: number; height: number;
  // Klucz z `useAllStreakItems()`/`useAllCountdownItems()` (zależnie od `componentType`) — TEN
  // SAM format co klucze używane już w odpowiadających kartach dashboardu/kreatorze, zero
  // nowego słownika identyfikatorów. `null` = jeszcze nieprzepięty.
  bindingKey: string | null;
  style: StreakTileStyle | CountdownTileStyle;  // per-instancja, kopia
}

const DEFAULT_SIZE: Record<CanvasComponentType, { width: number; height: number }> = {
  streakTile: { width: 150, height: 92 },
  countdownTile: { width: 230, height: 76 },
};
const DEFAULT_STYLE: Record<CanvasComponentType, StreakTileStyle | CountdownTileStyle> = {
  streakTile: DEFAULT_STREAK_TILE_STYLE,
  countdownTile: DEFAULT_COUNTDOWN_TILE_STYLE,
};

interface CanvasComponentsState {
  items: CanvasItem[];
  _hydrated: boolean;
  addItem: (screenKey: string, componentType: CanvasComponentType) => string;
  updateItem: (id: string, patch: Partial<Pick<CanvasItem, 'x' | 'y' | 'width' | 'height' | 'bindingKey' | 'style'>>) => void;
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
        const { width, height } = DEFAULT_SIZE[componentType];
        const item: CanvasItem = {
          id, screenKey, componentType, x: 12, y, width, height,
          bindingKey: null,
          style: DEFAULT_STYLE[componentType],
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
