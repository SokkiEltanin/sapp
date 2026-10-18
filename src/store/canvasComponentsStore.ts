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
import { DataFieldTileStyle, DEFAULT_DATA_FIELD_TILE_STYLE } from '@/store/dataFieldTileStyleDefaults';
import { IconTileStyle, DEFAULT_ICON_TILE_STYLE } from '@/store/iconTileStyleDefaults';

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
// metryka z apki). `isShapeType()` (tam) odróżnia je od "widgetów z danymi" wszędzie, gdzie to
// jest istotne (ScreenCanvas.tsx: brak metric-pickera, brak nawigacji po tapnięciu).
// Faza 27 (2026-10-17, §358) — piąty typ, `'dataField'` — generyczny data-binding, user: "...
// potem podpisanie danych itp itd". W PRZECIWIEŃSTWIE do kształtów, `dataField` UŻYWA
// `bindingKey` (klucz z `useDataFieldRegistry()`, np. `'pet.level'`) — ten sam mechanizm
// podpięcia (metric-picker, placeholder "Wybierz pole danych") co streakTile/countdownTile/
// notesTile, tylko inny rejestr opcji. Dowód że render-prop/generic-picker architektura (§341)
// generalizuje się na CZWARTY kształt danych bez zmiany samego mechanizmu podpięcia.
// Faza 33 (2026-10-18, §371) — szósty typ, `'iconTile'` — user: "możesz też do edytora
// pododawać IKONKI... moge je dodawac wtedy bezposrednio skalować justować". Jak kształty
// (Faza 26): `bindingKey` ZOSTAJE `null` na zawsze (same SĄ swoją treścią — wybrana ikona z
// curated puli, patrz `iconTileStyleDefaults.ts` — nie metryka z apki), ale NIE wchodzi do
// `ShapeComponentType`/`isShapeType()` (inny, niezależny modal stylu — picker ikony/kolor/
// rozmiar/wyrównanie, nie fill/stroke/cornerRadius kształtów) — własna, jawna obsługa w
// `ScreenCanvas.tsx` wszędzie, gdzie "brak podpięcia" jest istotne.
export type CanvasComponentType = 'streakTile' | 'countdownTile' | 'notesTile' | 'dataField' | 'rectShape' | 'ellipseShape' | 'lineShape' | 'textShape' | 'iconTile';

// Minimalny rozmiar itemu (Faza 28, 2026-10-17, §359) — PRZENIESIONE z `CanvasPlacedItem.tsx`
// (gdzie żyły jako prywatne consty tego komponentu) — `resizeGroupBy` niżej potrzebuje TYCH
// SAMYCH limitów do klamrowania resize całej grupy, więc jedno źródło prawdy zamiast dwóch
// osobnych liczb, które mogłyby się rozjechać. `CanvasPlacedItem.tsx` importuje stąd.
export const MIN_ITEM_WIDTH = 90;
export const MIN_ITEM_HEIGHT = 64;

// Klamrowanie X do granic płótna (Faza 29, 2026-10-17, §360) — WSPÓLNA formuła wydzielona z
// `moveGroupBy`/`resizeGroupBy` niżej (dotąd liczyły to samo osobno) + nowy fix w panelu
// właściwości (`ScreenCanvas.tsx` — tam BRAKOWAŁO tego klamrowania całkowicie: zwiększenie
// Szerokości suwakiem mogło wypchnąć item poza prawą krawędź, bo panel był JEDYNYM miejscem
// zmiany x/width, które nie klamrowało). Świadomie NIE użyte w geście przeciągania/resize
// (`CanvasPlacedItem.tsx`) — tam klamrowanie liczy się WEWNĄTRZ Reanimated workletu na UI
// threadzie, a wywołanie zaimportowanej funkcji z innego modułu wymagałoby poprawnego
// "workletyzowania" przez babel plugin Reanimated (niesprawdzone, realne ryzyko cichej regresji
// widocznej TYLKO na urządzeniu) — zero korzyści za tym ryzykiem, inline formuła tam zostaje.
export function clampItemX(x: number, width: number, canvasWidth: number): number {
  return Math.max(0, Math.min(Math.max(0, canvasWidth - width), x));
}

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
  style: StreakTileStyle | CountdownTileStyle | NotesTileStyle | DataFieldTileStyle | RectShapeStyle | EllipseShapeStyle | LineShapeStyle | TextShapeStyle | IconTileStyle;  // per-instancja, kopia
  // Grupowanie (Faza 20, 2026-10-17, §349) — user, dużo wcześniej w §333: "grupowanie
  // komponentów". `null` = nie w grupie. Dzielony losowy string = "ta sama grupa" — NIE osobna
  // encja/tabela (prościej: żaden grupowy byt do utrzymania w synchronizacji z członkami, grupa
  // usuwa się SAMA gdy ostatni member traci `groupId`/zostaje skasowany). Grupa wpływa TYLKO
  // na WSPÓLNE przesuwanie (patrz `moveGroupBy` niżej) — rozmiar/styl/podpięcie zostają w pełni
  // per-instancja nawet wewnątrz grupy (świadomie uproszczone na v1, patrz NEXT_STEPS.md).
  groupId: string | null;
  // Warstwy (Faza 28, 2026-10-17, §359) — user, po AskUserQuestion o zakres "pełnego edytora":
  // "...grupowanie i wgle potem podpisanie danych itp itd" + wcześniej zbadane "panel
  // właściwości + warstwy". Wyższy `zIndex` = renderowany PÓŹNIEJ = wizualnie NA WIERCHU (ten
  // sam sens co CSS/Figma). Domyślnie = kolejność dodania (patrz `addItem` niżej) — bez dotykania
  // panelu właściwości stosy wyglądają TAK JAK DOTĄD (dodane później = na wierzchu, jak w całej
  // appce zanim ten mechanizm istniał). `?? 0` na KAŻDYM miejscu odczytu (sort w `ScreenCanvas.
  // tsx`, `bringToFront`/`sendToBack` niżej) — stare, persystowane itemy sprzed tej fazy nie mają
  // tego pola wcale (shallow `persist` merge nie dogania pól WEWNĄTRZ elementów tablicy).
  zIndex: number;
}

const DEFAULT_SIZE: Record<CanvasComponentType, { width: number; height: number }> = {
  streakTile: { width: 150, height: 92 },
  countdownTile: { width: 230, height: 76 },
  notesTile: { width: 220, height: 80 },
  dataField: { width: 160, height: 60 },
  rectShape: { width: 140, height: 90 },
  ellipseShape: { width: 120, height: 120 },
  // Linia (Faza 26) domyślnie blisko-pozioma (wysokość 4) — rysowana PO PRZEKĄTNEJ swojego boxa
  // (patrz `ShapeTile.tsx`), więc "pozioma" to po prostu bardzo płaski box. Resize uchwytu w
  // rogu zmienia KĄT linii (pionowa = bardzo wąski box, ukośna = box o zbliżonych w/h) — to samo
  // zachowanie co zmiana rozmiaru linii w Figmie (ciągnięcie za punkt końcowy).
  lineShape: { width: 160, height: 4 },
  textShape: { width: 160, height: 40 },
  // Kwadrat (Faza 33, §371) — ikona jest z natury symetryczna, kwadratowy box domyślnie
  // wyśrodkowuje ją bez marginesów po jednej stronie.
  iconTile: { width: 90, height: 90 },
};
const DEFAULT_STYLE: Record<CanvasComponentType, StreakTileStyle | CountdownTileStyle | NotesTileStyle | DataFieldTileStyle | RectShapeStyle | EllipseShapeStyle | LineShapeStyle | TextShapeStyle | IconTileStyle> = {
  streakTile: DEFAULT_STREAK_TILE_STYLE,
  countdownTile: DEFAULT_COUNTDOWN_TILE_STYLE,
  notesTile: DEFAULT_NOTES_TILE_STYLE,
  dataField: DEFAULT_DATA_FIELD_TILE_STYLE,
  rectShape: DEFAULT_RECT_SHAPE_STYLE,
  ellipseShape: DEFAULT_ELLIPSE_SHAPE_STYLE,
  lineShape: DEFAULT_LINE_SHAPE_STYLE,
  textShape: DEFAULT_TEXT_SHAPE_STYLE,
  iconTile: DEFAULT_ICON_TILE_STYLE,
};

interface CanvasComponentsState {
  items: CanvasItem[];
  // Tryb pełnoekranowy (2026-10-18, §381) — user: "chcę od zera budować design... i móc go
  // wdrożyć jako jakiś ekran zamiast np. zdrowia". Dotąd płótno było WYŁĄCZNIE dokładką na
  // KOŃCU wbudowanej treści ekranu (§341+) — ten przełącznik, per `screenKey`, mówi
  // hostującemu ekranowi "schowaj swoją wbudowaną treść, pokaż TYLKO płótno na cały ekran".
  // Domyślnie wyłączony wszędzie (`undefined`/`false` = normalne zachowanie, zero zmiany dla
  // nikogo kto tego nie włączy) — odwracalne w każdej chwili (sam toggle, bez utraty danych:
  // itemy zostają w `items`, tylko przestają być jedynym widokiem ekranu).
  fullScreenScreens: Record<string, boolean>;
  setFullScreen: (screenKey: string, on: boolean) => void;
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
  // Warstwy (§359) — przenosi JEDEN item na wierzch/spód stosu NA JEGO WŁASNYM ekranie (`zIndex`
  // nie jest porównywalny między ekranami — każdy `screenKey` ma własną, niezależną przestrzeń,
  // ten sam zakres izolacji co reszta tego store'u). Liczone względem `?? 0` (patrz komentarz w
  // `CanvasItem`), więc działa poprawnie nawet gdy inne itemy na ekranie nie mają jeszcze pola.
  bringToFront: (id: string) => void;
  sendToBack: (id: string) => void;
  // Resize całej grupy jako JEDNEJ jednostki (§359, NEXT_STEPS.md: "rozszerzone grupowanie") —
  // wołane z `onResize` PRZECIĄGANEGO członka (patrz `ScreenCanvas.tsx`) ze współczynnikiem
  // skali policzonym z JEGO WŁASNEGO starego/nowego rozmiaru. Skaluje x/y/width/height KAŻDEGO
  // członka WZGLĘDEM WSPÓLNEGO bounding-boxa grupy (lewy-górny róg jako kotwica) — przeciągnięty
  // member wychodzi z tego PRECYZYJNIE na rozmiar, na który user go realnie przeciągnął (sam
  // matematycznie się zgadza: `width * (nowa/stara) = nowa`), reszta skaluje się proporcjonalnie
  // wokół niego. Każdy member klamrowany OSOBNO do granic płótna i `MIN_ITEM_WIDTH/HEIGHT` — ten
  // sam wzorzec co `moveGroupBy`.
  resizeGroupBy: (screenKey: string, groupId: string, scaleX: number, scaleY: number, canvasWidth: number) => void;
  // Lista warstw z krokowym reorderem (Faza 33, 2026-10-17, §365) — NEXT_STEPS.md/§359 flagowało
  // "lista warstw z drag-to-reorder" jako świadomie odłożone ("na wierzch"/"na spód" wystarcza
  // na v1). `moveLayer` to krok pomiędzy — zamiana z NAJBLIŻSZYM sąsiadem w stosie (nie skok na
  // sam szczyt/spód jak `bringToFront`/`sendToBack`), bez budowania nowego systemu gestów
  // drag-and-drop (ryzyko identyczne jak przy `CanvasPlacedItem`'s gestach — niepotrzebne dla
  // tego, co faktycznie rozwiązuje problem: "lista + do góry/do dołu" pokazuje PEŁNY porządek
  // warstw, czego "na wierzch"/"na spód" nie dawało).
  moveLayer: (id: string, direction: 'up' | 'down') => void;
}

export const useCanvasComponentsStore = create<CanvasComponentsState>()(
  persist(
    (set, get) => ({
      items: [],
      fullScreenScreens: {},
      setFullScreen: (screenKey, on) => set((s) => ({
        fullScreenScreens: { ...s.fullScreenScreens, [screenKey]: on },
      })),
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
        // Nowy item na wierzchu stosu (§359) — ta sama intuicja co dotychczasowe zachowanie BEZ
        // jawnego `zIndex` (później dodane = później w tablicy = renderowane na wierzchu).
        const maxZ = existing.reduce((m, i) => Math.max(m, i.zIndex ?? 0), 0);
        const item: CanvasItem = {
          id, screenKey, componentType, x: 12, y, width, height,
          bindingKey: null,
          style: DEFAULT_STYLE[componentType],
          groupId: null,
          zIndex: existing.length === 0 ? 0 : maxZ + 1,
        };
        set((s) => ({ items: [...s.items, item] }));
        return id;
      },

      updateItem: (id, patch) => set((s) => ({
        items: s.items.map(i => i.id === id ? { ...i, ...patch } : i),
      })),

      // Fix (§360, znalezione przy audycie) — komentarz przy `CanvasItem.groupId` deklarował
      // "grupa usuwa się SAMA gdy ostatni member traci groupId/zostaje skasowany", ale kod tego
      // NIE robił: usunięcie jednego z dwóch członków grupy zostawiało drugiego jako "grupę z
      // 1 osobą" — `grouped=true` (fioletowa ramka, "Rozgrupuj" w panelu właściwości), mimo że
      // nic już nie ma z czym synchronizować. Teraz: jeśli po usunięciu w grupie zostało <2
      // członków, czyści `groupId` na tych co zostali — dogania zachowanie, które komentarz już
      // deklarował.
      removeItem: (id) => set((s) => {
        const target = s.items.find(i => i.id === id);
        let items = s.items.filter(i => i.id !== id);
        if (target?.groupId) {
          const remaining = items.filter(i => i.groupId === target.groupId);
          if (remaining.length < 2) {
            items = items.map(i => i.groupId === target.groupId ? { ...i, groupId: null } : i);
          }
        }
        return { items };
      }),

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
          const x = clampItemX(i.x + dx, i.width, canvasWidth);
          const y = Math.max(0, i.y + dy);
          return { ...i, x, y };
        }),
      })),

      bringToFront: (id) => set((s) => {
        const target = s.items.find(i => i.id === id);
        if (!target) return s;
        const siblings = s.items.filter(i => i.screenKey === target.screenKey);
        const maxZ = siblings.reduce((m, i) => Math.max(m, i.zIndex ?? 0), 0);
        return { items: s.items.map(i => i.id === id ? { ...i, zIndex: maxZ + 1 } : i) };
      }),

      sendToBack: (id) => set((s) => {
        const target = s.items.find(i => i.id === id);
        if (!target) return s;
        const siblings = s.items.filter(i => i.screenKey === target.screenKey);
        const minZ = siblings.reduce((m, i) => Math.min(m, i.zIndex ?? 0), 0);
        return { items: s.items.map(i => i.id === id ? { ...i, zIndex: minZ - 1 } : i) };
      }),

      resizeGroupBy: (screenKey, groupId, scaleX, scaleY, canvasWidth) => set((s) => {
        const members = s.items.filter(i => i.screenKey === screenKey && i.groupId === groupId);
        if (members.length === 0) return s;
        const minX = Math.min(...members.map(i => i.x));
        const minY = Math.min(...members.map(i => i.y));
        return {
          items: s.items.map(i => {
            if (i.screenKey !== screenKey || i.groupId !== groupId) return i;
            const width = Math.max(MIN_ITEM_WIDTH, Math.round(i.width * scaleX));
            const height = Math.max(MIN_ITEM_HEIGHT, Math.round(i.height * scaleY));
            const relX = i.x - minX;
            const relY = i.y - minY;
            const x = clampItemX(Math.round(minX + relX * scaleX), width, canvasWidth);
            const y = Math.max(0, Math.round(minY + relY * scaleY));
            return { ...i, x, y, width, height };
          }),
        };
      }),

      moveLayer: (id, direction) => set((s) => {
        const target = s.items.find(i => i.id === id);
        if (!target) return s;
        // Posortowani wg zIndex (`?? 0`, ten sam powód co gdzie indziej) — "sąsiad" to
        // dosłownie następny/poprzedni element w TYM porządku, nie w tablicy `items`.
        const siblings = [...s.items.filter(i => i.screenKey === target.screenKey)].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0));
        const idx = siblings.findIndex(i => i.id === id);
        const otherIdx = direction === 'up' ? idx + 1 : idx - 1;
        if (otherIdx < 0 || otherIdx >= siblings.length) return s; // już na szczycie/spodzie
        // Normalizuj WSZYSTKICH siblingów na TYM screenKey do kolejnych, unikalnych zIndex
        // (0,1,2,…) w ICH BIEŻĄCYM porządku PRZED zamianą — stare, migrowane itemy mogą dzielić
        // ten sam fallback `?? 0` (kilka naraz), więc zamiana dwóch RÓWNYCH wartości byłaby
        // no-opem (swap(5,5) nic nie zmienia). Normalizacja zachowuje względny porządek
        // (stabilne sortowanie wyżej), więc nie psuje nic poza dwiema zamienianymi pozycjami.
        const zById = new Map(siblings.map((it, i2) => [it.id, i2]));
        const targetZ = zById.get(target.id)!;
        const otherId = siblings[otherIdx].id;
        const otherZ = zById.get(otherId)!;
        zById.set(target.id, otherZ);
        zById.set(otherId, targetZ);
        return { items: s.items.map(i => zById.has(i.id) ? { ...i, zIndex: zById.get(i.id)! } : i) };
      }),
    }),
    {
      name: 'canvas-components-v1',
      storage: throttledPersistStorage(),
      partialize: (s) => ({ items: s.items, fullScreenScreens: s.fullScreenScreens }),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
