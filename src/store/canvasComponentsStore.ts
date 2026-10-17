import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { StreakTileStyle, DEFAULT_STREAK_TILE_STYLE } from '@/store/streakTileStyleStore';
import { CountdownTileStyle, DEFAULT_COUNTDOWN_TILE_STYLE } from '@/store/countdownTileStyleDefaults';
import { NotesTileStyle, DEFAULT_NOTES_TILE_STYLE } from '@/store/notesTileStyleDefaults';
import {
  RectShapeStyle, EllipseShapeStyle, LineShapeStyle, TextShapeStyle,
  DEFAULT_RECT_SHAPE_STYLE, DEFAULT_ELLIPSE_SHAPE_STYLE, DEFAULT_LINE_SHAPE_STYLE, DEFAULT_TEXT_SHAPE_STYLE,
} from '@/store/shapeStyleDefaults';

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
// Faza 21 (2026-10-17, §350) — trzeci `componentType` (`'notesTile'`), pierwszy który wiąże
// się z czymś BEZ świeżo wyliczonej metryki (dni/data) — notatka to statyczny tekst po `id`
// z AsyncStorage (`notesStorage.ts`), nie Zustand store. `useAllNotesItems()` (nowy hook)
// odwzorowuje to na TĘ SAMĄ `PickerOption[]` abstrakcję co `useAllStreakItems()`/
// `useAllCountdownItems()` — generyczność pickera (§341 komentarz w `MetricPickerModal.tsx`)
// faktycznie wytrzymała TRZECI, strukturalnie inny kształt danych bez zmian.
// Faza 26 (2026-10-17, §357) — cztery nowe typy BEZ podpięcia danych (`rectShape`/`ellipseShape`/
// `lineShape`/`textShape`, patrz `shapeStyleDefaults.ts`) — gołe kształty-primitywy, user: "na
// pewno pełny edytor z dodawaniem kształtów od zera... jak Figma". `bindingKey` dla nich ZOSTAJE
// `null` na zawsze — nie mają z czym się podpiąć, same SĄ swoją treścią (kolor/obrys/tekst, nie
// metryka z apki). `isShapeType()` (tam) odróżnia je od trzech "widgetów z danymi" wszędzie, gdzie
// to jest istotne (ScreenCanvas.tsx: brak metric-pickera, brak nawigacji po tapnięciu).
export type CanvasComponentType = 'streakTile' | 'countdownTile' | 'notesTile' | 'rectShape' | 'ellipseShape' | 'lineShape' | 'textShape';

export interface CanvasItem {
  id: string;              // 'canvas:<timestamp>'
  screenKey: string;       // np. 'food' — które miejsce w appce renderuje tę instancję
  componentType: CanvasComponentType;
  x: number; y: number;
  width: number; height: number;
  // Klucz z `useAllStreakItems()`/`useAllCountdownItems()` (zależnie od `componentType`) — TEN
  // SAM format co klucze używane już w odpowiadających kartach dashboardu/kreatorze, zero
  // nowego słownika identyfikatorów. `null` = jeszcze nieprzepięty (dla 4 typów kształtów: ZAWSZE
  // `null`, patrz komentarz wyżej).
  bindingKey: string | null;
  style: StreakTileStyle | CountdownTileStyle | NotesTileStyle | RectShapeStyle | EllipseShapeStyle | LineShapeStyle | TextShapeStyle;  // per-instancja, kopia
  // Grupowanie (Faza 20, 2026-10-17, §349) — user, dużo wcześniej w §333: "grupowanie
  // komponentów". `null` = nie w grupie. Dzielony losowy string = "ta sama grupa" — NIE osobna
  // encja/tabela (prościej: żaden grupowy byt do utrzymania w synchronizacji z członkami, grupa
  // usuwa się SAMA gdy ostatni member traci `groupId`/zostaje skasowany). Grupa wpływa TYLKO
  // na WSPÓLNE przesuwanie (patrz `moveGroupBy` niżej) — rozmiar/styl/podpięcie zostają w pełni
  // per-instancja nawet wewnątrz grupy (świadomie uproszczone na v1, patrz NEXT_STEPS.md).
  groupId: string | null;
}

const DEFAULT_SIZE: Record<CanvasComponentType, { width: number; height: number }> = {
  streakTile: { width: 150, height: 92 },
  countdownTile: { width: 230, height: 76 },
  notesTile: { width: 220, height: 80 },
  rectShape: { width: 140, height: 90 },
  ellipseShape: { width: 120, height: 120 },
  // Linia (Faza 26) domyślnie blisko-pozioma (wysokość 4) — rysowana PO PRZEKĄTNEJ swojego boxa
  // (patrz `ShapeTile.tsx`), więc "pozioma" to po prostu bardzo płaski box. Resize uchwytu w
  // rogu zmienia KĄT linii (pionowa = bardzo wąski box, ukośna = box o zbliżonych w/h) — to samo
  // zachowanie co zmiana rozmiaru linii w Figmie (ciągnięcie za punkt końcowy).
  lineShape: { width: 160, height: 4 },
  textShape: { width: 160, height: 40 },
};
const DEFAULT_STYLE: Record<CanvasComponentType, StreakTileStyle | CountdownTileStyle | NotesTileStyle | RectShapeStyle | EllipseShapeStyle | LineShapeStyle | TextShapeStyle> = {
  streakTile: DEFAULT_STREAK_TILE_STYLE,
  countdownTile: DEFAULT_COUNTDOWN_TILE_STYLE,
  notesTile: DEFAULT_NOTES_TILE_STYLE,
  rectShape: DEFAULT_RECT_SHAPE_STYLE,
  ellipseShape: DEFAULT_ELLIPSE_SHAPE_STYLE,
  lineShape: DEFAULT_LINE_SHAPE_STYLE,
  textShape: DEFAULT_TEXT_SHAPE_STYLE,
};

interface CanvasComponentsState {
  items: CanvasItem[];
  _hydrated: boolean;
  addItem: (screenKey: string, componentType: CanvasComponentType) => string;
  updateItem: (id: string, patch: Partial<Pick<CanvasItem, 'x' | 'y' | 'width' | 'height' | 'bindingKey' | 'style'>>) => void;
  removeItem: (id: string) => void;
  // Grupowanie (§349) — `groupItems` ignoruje id'ki spoza `screenKey` (obrona przed pomyłką
  // wołającego, nie powinno się zdarzyć bo `ScreenCanvas` zaznacza tylko WŁASNE itemy) i
  // zwraca nowy `groupId`, żeby wołający mógł np. od razu wyczyścić zaznaczenie. Grupa z <2
  // członkami nie ma sensu (nic by nie synchronizowała) — `groupItems` wymaga co najmniej 2 id.
  groupItems: (screenKey: string, ids: string[]) => string | null;
  ungroupItems: (groupId: string) => void;
  // Przesuwa WSZYSTKICH członków grupy o ten sam delta (wywoływane z `onMove` jednego
  // przeciąganego itemu w `ScreenCanvas.tsx`) — każdy member klamrowany OSOBNO do granic płótna
  // (ten sam wzorzec klamrowania co pojedynczy drag w `CanvasPlacedItem.tsx`), więc grupa blisko
  // krawędzi nie "rozjeżdża się" nierówno, tylko człon przy krawędzi po prostu przestaje się
  // dalej przesuwać w tym kierunku.
  moveGroupBy: (screenKey: string, groupId: string, dx: number, dy: number, canvasWidth: number) => void;
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
        // Losowy suffix (nie tylko `Date.now()`) — dwa `addItem()` w tej samej milisekundzie
        // (np. szybkie dwa tapnięcia "Dodaj", wykryte przy pisaniu testu grupowania §349, gdzie
        // trzy wywołania pod rząd w jednej pętli realnie kolidowały) dawały identyczne id, co po
        // cichu myliło dwie RÓŻNE instancje w każdym miejscu liczącym po `id` (w tym `groupItems`
        // niżej).
        const id = `canvas:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        const existing = get().items.filter(i => i.screenKey === screenKey);
        const maxBottom = existing.reduce((m, i) => Math.max(m, i.y + i.height), 0);
        const y = existing.length === 0 ? 12 : maxBottom + 12;
        const { width, height } = DEFAULT_SIZE[componentType];
        const item: CanvasItem = {
          id, screenKey, componentType, x: 12, y, width, height,
          bindingKey: null,
          style: DEFAULT_STYLE[componentType],
          groupId: null,
        };
        set((s) => ({ items: [...s.items, item] }));
        return id;
      },

      updateItem: (id, patch) => set((s) => ({
        items: s.items.map(i => i.id === id ? { ...i, ...patch } : i),
      })),

      removeItem: (id) => set((s) => ({ items: s.items.filter(i => i.id !== id) })),

      groupItems: (screenKey, ids) => {
        const idSet = new Set(get().items.filter(i => i.screenKey === screenKey && ids.includes(i.id)).map(i => i.id));
        if (idSet.size < 2) return null;
        const groupId = `group:${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
        set((s) => ({ items: s.items.map(i => idSet.has(i.id) ? { ...i, groupId } : i) }));
        return groupId;
      },

      ungroupItems: (groupId) => set((s) => ({
        items: s.items.map(i => i.groupId === groupId ? { ...i, groupId: null } : i),
      })),

      moveGroupBy: (screenKey, groupId, dx, dy, canvasWidth) => set((s) => ({
        items: s.items.map(i => {
          if (i.screenKey !== screenKey || i.groupId !== groupId) return i;
          const x = Math.max(0, Math.min(Math.max(0, canvasWidth - i.width), i.x + dx));
          const y = Math.max(0, i.y + dy);
          return { ...i, x, y };
        }),
      })),
    }),
    {
      name: 'canvas-components-v1',
      storage: throttledPersistStorage(),
      partialize: (s) => ({ items: s.items }),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
