import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ScrollView, LayoutChangeEvent } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle } from 'react-native-reanimated';
import { router } from 'expo-router';
import { Check, Plus, LayoutGrid, Flame, CalendarClock, FileText, Group, X, Square, Circle, Minus, Type, Database, Layers, Smile, BarChart2, Compass, AlignStartHorizontal, AlignStartVertical } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';
import { useAllStreakItems } from '@/hooks/useAllStreakItems';
import { useAllCountdownItems } from '@/hooks/useAllCountdownItems';
import { useAllNotesItems } from '@/hooks/useAllNotesItems';
import { StreakItem } from '@/components/dashboard/StreakWallCard';
import { Counter, daysUntil, isDuringEvent } from '@/store/countersStore';
import { Note } from '@/utils/notesStorage';
import { StreakTile, navigateForStreakItem } from '@/components/dashboard/StreakTile';
import { CountdownTile, DEFAULT_COUNTDOWN_TILE_STYLE, CountdownTileStyle } from '@/components/dashboard/CountdownTile';
import { NotesTile, DEFAULT_NOTES_TILE_STYLE, NotesTileStyle } from '@/components/dashboard/NotesTile';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { useCanvasComponentsStore, CanvasComponentType, MIN_ITEM_WIDTH, MIN_ITEM_HEIGHT, clampItemX } from '@/store/canvasComponentsStore';
import { DEFAULT_STREAK_TILE_STYLE, StreakTileStyle } from '@/store/streakTileStyleStore';
import {
  ShapeComponentType, ShapeStyle, isShapeType,
  DEFAULT_RECT_SHAPE_STYLE, DEFAULT_ELLIPSE_SHAPE_STYLE, DEFAULT_LINE_SHAPE_STYLE, DEFAULT_TEXT_SHAPE_STYLE,
} from '@/store/shapeStyleDefaults';
import CanvasPlacedItem from './CanvasPlacedItem';
import MetricPickerModal, { PickerOption } from './MetricPickerModal';
import CanvasStreakStyleModal from './CanvasStreakStyleModal';
import CanvasCountdownStyleModal from './CanvasCountdownStyleModal';
import CanvasNotesStyleModal from './CanvasNotesStyleModal';
import { ShapeTile } from './ShapeTile';
import CanvasShapeStyleModal from './CanvasShapeStyleModal';
import { useDataFieldRegistry, DataFieldValue } from '@/hooks/useDataFieldRegistry';
import { DataFieldTile } from './DataFieldTile';
import CanvasDataFieldStyleModal from './CanvasDataFieldStyleModal';
import { DataFieldTileStyle, DEFAULT_DATA_FIELD_TILE_STYLE } from '@/store/dataFieldTileStyleDefaults';
import CanvasPropertiesModal from './CanvasPropertiesModal';
import CanvasPopupModal from './CanvasPopupModal';
import CanvasLayersModal, { LayerRow } from './CanvasLayersModal';
import { usePressGuard } from '@/hooks/usePressGuard';
import { IconTile } from './IconTile';
import CanvasIconStyleModal from './CanvasIconStyleModal';
import { IconTileStyle, DEFAULT_ICON_TILE_STYLE } from '@/store/iconTileStyleDefaults';
import { StatCanvasTile } from './StatCanvasTile';
import CanvasStatStyleModal from './CanvasStatStyleModal';
import { StatTileCanvasStyle, DEFAULT_STAT_TILE_STYLE } from '@/store/statTileStyleDefaults';
import { WIDGET_METRICS, StatCtx } from '@/utils/statWidgets';
import { NavTabTile } from './NavTabTile';
import { PUPIL_NAV_TABS } from '@/data/pupilNavTabs';
import { ProgressBarTile } from './ProgressBarTile';
import CanvasProgressBarStyleModal from './CanvasProgressBarStyleModal';
import { ProgressBarStyle, DEFAULT_PROGRESS_BAR_STYLE } from '@/store/progressBarStyleDefaults';

// Domyślny styl per typ kształtu (Faza 26, §357) — fallback dla modala stylu kiedy
// `styleItem` jeszcze nie jest kształtem (modal musi dostać JAKIŚ `style`, nawet gdy
// `visible={false}`, bo React renderuje drzewo niezależnie od `visible` w `<Modal>`).
const SHAPE_DEFAULT_BY_KIND: Record<ShapeComponentType, ShapeStyle> = {
  rectShape: DEFAULT_RECT_SHAPE_STYLE,
  ellipseShape: DEFAULT_ELLIPSE_SHAPE_STYLE,
  lineShape: DEFAULT_LINE_SHAPE_STYLE,
  textShape: DEFAULT_TEXT_SHAPE_STYLE,
};

// Smart guides / snapowanie (Faza 34, 2026-10-18, §372) — user: "dodaj właśnie SNAPOWANIE do
// centrum obiektu... z na bieżąco pokazującymi się na chwilkę linijkami żeby było widać że
// jest równo... jak w Figmie". `GuideState` to WSPÓLNA shared value (JEDNA instancja, stworzona
// TU, przekazana do WSZYSTKICH `CanvasPlacedItem` na tym ekranie jako ten sam obiekt-referencja)
// — tylko AKTUALNIE przeciągany item zapisuje do niej ze swojego gesture-workletu (viz. tam),
// reszta tylko dostaje tę samą referencję bez pisania. Dwie linie (pionowa = snap po X, pozioma
// = snap po Y), każda albo widoczna (gdy aktywny snap) albo offscreen+opacity 0 — ten sam
// "fixed slot, warunkowa widoczność" wzorzec co linie-pointerEvents="none" gdzie indziej w tym
// pliku (np. `groupFrame`), zamiast dynamicznej listy (prostsze, bezpieczniejsze dla workletu).
type GuideState = { vx: number | null; vy1: number; vy2: number; hy: number | null; hx1: number; hx2: number };
const HIDDEN_GUIDES: GuideState = { vx: null, vy1: 0, vy2: 0, hy: null, hx1: 0, hx2: 0 };

const MIN_CANVAS_HEIGHT = 140;
const EDIT_BOTTOM_PAD = 76; // miejsce na przyciski "Dodaj" pod najniższą instancją

// Wolne płótno (system kopiowania komponentów, Faza 15, §341) — user: "chce dosłownie tam od
// zera zbudować z przesunięciem podpięcia itp", doprecyzowane: Figma/Canva-style (swobodna
// pozycja/rozmiar, nakładanie dozwolone), tapnięcie na kafel otwiera picker podpięcia. Jeden
// ekran = jeden `screenKey` (np. `'food'`) — każdy ekran dostaje WŁASNĄ, niezależną listę
// instancji.
//
// Faza 17 (2026-10-17) — drugi `componentType` (`'countdownTile'`, po `'streakTile'`), dowód
// że mechanizm faktycznie generalizuje. `CanvasPlacedItem` nie wie NIC o konkretnych typach
// kafli (render-prop, §341 komentarz tam) — CAŁA logika "co to za typ, jak go wyświetlić, gdzie
// szukać podpięcia" żyje TUTAJ, w jednym miejscu, żeby dodanie TRZECIEGO typu w przyszłości
// było jedną kolejną gałęzią tych samych kilku `if`ów, nie rozrzuconą zmianą w wielu plikach.
//
// `ScreenCanvasBase`/`ScreenCanvas` (Faza 25, 2026-10-17, §356) — user potwierdził wprost
// (AskUserQuestion): "projektowanie całego ekranu" = zastosowanie TEGO płótna do PRAWDZIWEGO
// dashboardu, nie tylko lżejsza zmiana kolejności kart. Przeszkoda: dashboard JUŻ montuje
// `useHabits()` dla swojej stałej treści (`streakWall` itd.) — gdyby `ScreenCanvas` jak dotąd
// wołał `useAllStreakItems()` SAM (co wewnętrznie też woła `useHabits()`), dashboard dostałby
// DRUGI, zbędny fetch na najbardziej czułym na wydajność ekranie appki (ta sama pułapka co
// opisana w `useAllStreakItems.ts`). Rozwiązanie: `ScreenCanvasBase` (eksport NAZWANY, nie
// domyślny) jest CZYSTO props-driven — przyjmuje `allStreakItems`/`allCountdownItems`/
// `allNotesItems` jako propsy, ŻADNYCH własnych hooków fetchujących dane, więc wołający w pełni
// kontroluje skąd te dane przychodzą. `ScreenCanvas` (eksport DOMYŚLNY, jak dotąd) to cienki
// wrapper wołający 3 hooki i przekazujący wynik do `ScreenCanvasBase` — Jedzenie/Ćwiczenia/
// Finanse dalej importują `ScreenCanvas` BEZ ŻADNEJ zmiany. `index.tsx` importuje
// `ScreenCanvasBase` BEZPOŚREDNIO i przekazuje SWOJE już wyliczone dane (`streakWall` 1:1 jako
// `allStreakItems` — zero dodatkowego kodu, `counters`/`allNotes` już w pamięci dla pozostałych
// dwóch — tani dodatkowy `.filter()`, NIE drugi fetch).
export function ScreenCanvasBase({ screenKey, title, allStreakItems, allCountdownItems, allNotesItems, dataFieldRegistry, accentColor, statCtx, viewOnly }: {
  screenKey: string;
  title?: string;
  allStreakItems: StreakItem[];
  allCountdownItems: Counter[];
  allNotesItems: Note[];
  dataFieldRegistry: DataFieldValue[];
  accentColor: string;
  // Typ "Wykres" (§386) — TYLKO dashboard dostarcza to dziś (ma już policzone, droższe dane:
  // wydatki/nastrój/pracę/zadania/itd., patrz `index.tsx`'s `statCtx`). Pozostałe ekrany nie
  // przekazują tego propa wcale (`undefined`) — świadomie: fetchowanie TYCH danych na KAŻDYM
  // ekranie z płótnem byłoby drogie i w większości niepotrzebne. Brak = przycisk "Wykres" w
  // ogóle się nie pokazuje w trybie edycji (patrz niżej), więc user nie trafia na martwy,
  // niedziałający przycisk.
  statCtx?: StatCtx;
  // Tryb "Dane"/popup (§391) — `CanvasPopupModal.tsx` renderuje TĘ SAMĄ `ScreenCanvasBase` dla
  // podglądu popupu na żywym ekranie. `true` = czysta treść, BEZ chrome (nagłówek/odznaki
  // pełnego ekranu/edycji w ogóle się nie renderują, `pendingAutoEdit` jest ignorowane) —
  // `editing` nie ma jak zostać włączone (jedyne dwa miejsca, które to robią, są wyłączone),
  // więc cała reszta komponentu (render itemów) automatycznie zostaje w gałęzi `editing=false`,
  // zero duplikacji logiki renderowania per-typ. `undefined`/`false` = dotychczasowe zachowanie.
  viewOnly?: boolean;
}) {
  const c = useColors();
  const s = makeS(c);
  const [editing, setEditing] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(320);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [styleForId, setStyleForId] = useState<string | null>(null);
  // Panel właściwości (§359) — X/Y/W/H + warstwy + rozgrupuj, osobny od `styleForId` (który
  // steruje modalami stylu PER-TYP) — ten panel jest UNIWERSALNY dla wszystkich typów.
  const [propsForId, setPropsForId] = useState<string | null>(null);
  // Tryb "Dane"/popup (§391) — `mode: 'view'` (tap na żywym ekranie, czysta treść bez chrome)
  // vs `'edit'` (przycisk "Edytuj zawartość popupu" z panelu właściwości, pełny edytor).
  const [popup, setPopup] = useState<{ id: string; mode: 'view' | 'edit' } | null>(null);
  // Lista warstw (§365) — osobny panel od reszty (nie wiąże się z JEDNYM itemem jak style/
  // properties, tylko z CAŁYM ekranem naraz).
  const [layersOpen, setLayersOpen] = useState(false);
  // Grupowanie (Faza 20, 2026-10-17, §349) — user, wcześniej w §333: "grupowanie komponentów".
  // `selectMode` zamienia CAŁE płótno w tryb "tapnij żeby zaznaczyć" (osobna gałąź renderu w
  // `CanvasPlacedItem`, patrz komentarz tam) — oddzielny od normalnej edycji, nie da się
  // jednocześnie przeciągać/zaznaczać (user by się pogubił które tapnięcie co robi).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  // Tryb pełnoekranowy (§381) — czytany TU, nie przekazany jako prop: hostujący ekran
  // (np. health.tsx) czyta TEN SAM store'owy klucz niezależnie, żeby zdecydować czy w ogóle
  // montować swoją wbudowaną treść. Dwa niezależne odczyty tego samego Zustand selektora, nie
  // prop-drilling — oba re-renderują się razem, Zustand gwarantuje spójność.
  // Przełącznik pełnego ekranu żyje TERAZ wyłącznie w Ustawieniach (§396) — tu tylko ODCZYT,
  // żeby zdecydować jak renderować (branch `if (fullScreenOn)` niżej w pliku).
  const fullScreenOn = useCanvasComponentsStore(st => st.fullScreenScreens[screenKey] ?? false);
  // Wejście do edytora z Ustawień (§390) — jednorazowy sygnał, patrz komentarz w
  // `canvasComponentsStore.ts`. Sprawdzamy TYLKO raz, przy zmianie `pendingAutoEdit` (nie na
  // każdy render) — jeśli dotyczy WŁASNEGO ekranu, włącz edycję i natychmiast wyczyść flagę
  // (żeby np. nawigacja z powrotem na ten sam ekran później nie znowu-włączyła edycji).
  const pendingAutoEdit = useCanvasComponentsStore(st => st.pendingAutoEdit);
  const setPendingAutoEdit = useCanvasComponentsStore(st => st.setPendingAutoEdit);
  useEffect(() => {
    if (!viewOnly && pendingAutoEdit === screenKey) { setEditing(true); setPendingAutoEdit(null); }
  }, [pendingAutoEdit, screenKey, viewOnly]);

  const allItems = useCanvasComponentsStore(st => st.items);
  const addItem = useCanvasComponentsStore(st => st.addItem);
  const updateItem = useCanvasComponentsStore(st => st.updateItem);
  const removeItem = useCanvasComponentsStore(st => st.removeItem);
  const groupItems = useCanvasComponentsStore(st => st.groupItems);
  const ungroupItems = useCanvasComponentsStore(st => st.ungroupItems);
  const moveGroupBy = useCanvasComponentsStore(st => st.moveGroupBy);
  const bringToFront = useCanvasComponentsStore(st => st.bringToFront);
  const sendToBack = useCanvasComponentsStore(st => st.sendToBack);
  const resizeGroupBy = useCanvasComponentsStore(st => st.resizeGroupBy);
  const moveLayer = useCanvasComponentsStore(st => st.moveLayer);
  // Wyśrodkuj/duplikuj/wyrównaj (§400) — user: "nie mam allign to center albo snapa... nie
  // mam jak ustawić np 2 kafelków na tym samym poziomie lub nie mam opcji kopiuj".
  const duplicateItem = useCanvasComponentsStore(st => st.duplicateItem);
  const centerItemX = useCanvasComponentsStore(st => st.centerItemX);
  const alignItemsY = useCanvasComponentsStore(st => st.alignItemsY);
  const alignItemsX = useCanvasComponentsStore(st => st.alignItemsX);
  const myItems = useMemo(() => allItems.filter(i => i.screenKey === screenKey), [allItems, screenKey]);
  // Warstwy (§359) — porządek RENDEROWANIA (który decyduje co jest "na wierzchu" wizualnie w
  // RN) sortowany po `zIndex`, NIE po kolejności w tablicy `items` (ta odzwierciedla kolejność
  // DODANIA, nie bieżącą warstwę po ewentualnym "na wierzch"/"na spód"). `?? 0` — patrz komentarz
  // przy `CanvasItem.zIndex` w `canvasComponentsStore.ts`.
  const orderedItems = useMemo(() => [...myItems].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)), [myItems]);

  // Smart guides (§372) — płaska lista geometrii WSZYSTKICH itemów tego ekranu (siebie
  // samego filtruje `CanvasPlacedItem` po `id`, patrz tam) — JEDNA tablica, nie per-item kopia,
  // żeby nie tworzyć N nowych tablic na każdy render `ScreenCanvas`.
  const itemRects = useMemo(
    () => myItems.map(i => ({ id: i.id, x: i.x, y: i.y, width: i.width, height: i.height })),
    [myItems],
  );
  const guides = useSharedValue<GuideState>(HIDDEN_GUIDES);
  const vGuideStyle = useAnimatedStyle(() => ({
    position: 'absolute', left: guides.value.vx ?? -9999, top: guides.value.vy1,
    width: 1.5, height: Math.max(0, guides.value.vy2 - guides.value.vy1),
    opacity: guides.value.vx != null ? 1 : 0,
  }));
  const hGuideStyle = useAnimatedStyle(() => ({
    position: 'absolute', top: guides.value.hy ?? -9999, left: guides.value.hx1,
    height: 1.5, width: Math.max(0, guides.value.hx2 - guides.value.hx1),
    opacity: guides.value.hy != null ? 1 : 0,
  }));

  // Opisowa etykieta itemu (§365) — WSPÓLNA dla listy warstw, jedno miejsce rozwiązywania
  // podpięcia-na-nazwę zamiast powtarzania per-wiersz logiki z głównej pętli renderu niżej.
  const describeItem = (item: typeof myItems[number]): string => {
    if (item.componentType === 'streakTile') return item.bindingKey ? (allStreakItems.find(x => x.key === item.bindingKey)?.name ?? 'Seria') : 'Seria (brak podpięcia)';
    if (item.componentType === 'countdownTile') return item.bindingKey ? (allCountdownItems.find(x => x.id === item.bindingKey)?.name ?? 'Odliczanie') : 'Odliczanie (brak podpięcia)';
    if (item.componentType === 'notesTile') return item.bindingKey ? (allNotesItems.find(x => x.id === item.bindingKey)?.title || 'Notatka') : 'Notatka (brak podpięcia)';
    if (item.componentType === 'dataField') return item.bindingKey ? (dataFieldRegistry.find(f => f.id === item.bindingKey)?.label ?? 'Pole danych') : 'Pole danych (brak podpięcia)';
    if (item.componentType === 'rectShape') return 'Prostokąt';
    if (item.componentType === 'ellipseShape') return 'Elipsa';
    if (item.componentType === 'lineShape') return 'Linia';
    if (item.componentType === 'textShape') return 'Tekst';
    if (item.componentType === 'statTile') return item.bindingKey ? (WIDGET_METRICS.find(m => m.id === item.bindingKey)?.label ?? 'Wykres') : 'Wykres (brak podpięcia)';
    if (item.componentType === 'navTab') return item.bindingKey ? (PUPIL_NAV_TABS.find(t => t.key === item.bindingKey)?.label ?? 'Przycisk nawigacji') : 'Przycisk nawigacji (brak podpięcia)';
    if (item.componentType === 'progressBar') return item.bindingKey ? (allCountdownItems.find(x => x.id === item.bindingKey)?.name ?? 'Pasek progresu') : 'Pasek progresu (brak podpięcia)';
    return 'Ikona';
  };
  // TOP-FIRST (odwrotność `orderedItems` — user intuicyjnie myśli "co jest na wierzchu" jako
  // GÓRA listy, nie dół).
  const layerRows: LayerRow[] = useMemo(
    () => [...orderedItems].reverse().map(i => ({ id: i.id, label: describeItem(i), grouped: i.groupId != null })),
    [orderedItems, allStreakItems, allCountdownItems, allNotesItems, dataFieldRegistry],
  );
  // Ramka grupy (§365) — bounding-boxy WSZYSTKICH grup obecnych na ekranie, do narysowania
  // wspólnej, wizualnej ramki wokół całej grupy w trybie edycji (patrz render niżej). Jeden
  // `Map<groupId, box>` zamiast liczenia per-item w pętli renderu.
  const groupBoxes = useMemo(() => {
    const map = new Map<string, { x: number; y: number; width: number; height: number }>();
    const byGroup = new Map<string, typeof myItems>();
    for (const i of myItems) {
      if (!i.groupId) continue;
      const arr = byGroup.get(i.groupId) ?? [];
      arr.push(i);
      byGroup.set(i.groupId, arr);
    }
    for (const [gid, members] of byGroup) {
      const minX = Math.min(...members.map(i => i.x));
      const minY = Math.min(...members.map(i => i.y));
      const maxX = Math.max(...members.map(i => i.x + i.width));
      const maxY = Math.max(...members.map(i => i.y + i.height));
      map.set(gid, { x: minX, y: minY, width: maxX - minX, height: maxY - minY });
    }
    return map;
  }, [myItems]);

  const timeAccentColor = accentColor;
  const pickerItem = myItems.find(i => i.id === pickerForId) ?? null;
  const styleItem = myItems.find(i => i.id === styleForId) ?? null;
  const propsItem = myItems.find(i => i.id === propsForId) ?? null;
  // "Cel po kliknięciu" (§351) — tylko `CanvasStreakStyleModal` go potrzebuje, tylko żeby
  // wiedzieć KTÓRY nawyk (jeśli w ogóle) jest aktualnie podpięty pod edytowaną instancję.
  const styleBoundStreak = styleItem?.componentType === 'streakTile' && styleItem.bindingKey
    ? allStreakItems.find(x => x.key === styleItem.bindingKey) ?? null
    : null;

  const streakOptions: PickerOption[] = useMemo(
    () => allStreakItems.map(i => ({ key: i.key, label: i.name, meta: `${i.days} ${i.days === 1 ? 'dzień' : 'dni'}` })),
    [allStreakItems],
  );
  const countdownOptions: PickerOption[] = useMemo(
    () => allCountdownItems.map(cn => ({
      key: cn.id, label: cn.name,
      meta: isDuringEvent(cn) ? 'w trakcie' : `za ${daysUntil(cn)} ${daysUntil(cn) === 1 ? 'dzień' : 'dni'}`,
    })),
    [allCountdownItems],
  );
  // Trzeci typ (§350) — `meta` tu to podgląd treści (nie liczba jak serie/odliczania), skrócony
  // do jednej linijki; brak treści → liczba tagów jako zamiennik, zupełnie pusta notatka →
  // "bez treści" (pusty string wyglądałby jak błąd renderu pickera, nie jak świadomy stan).
  const notesOptions: PickerOption[] = useMemo(
    () => allNotesItems.map(n => ({
      key: n.id, label: n.title || 'Bez tytułu',
      meta: n.body?.trim() ? n.body.trim().slice(0, 40) : ((n.tags ?? []).length > 0 ? `${n.tags.length} ${n.tags.length === 1 ? 'tag' : 'tagi'}` : 'bez treści'),
    })),
    [allNotesItems],
  );
  // Czwarty "widget z danymi" (§358) — ten sam mechanizm podpięcia co powyżej, inny rejestr.
  // `meta` to już wyliczona wartość pola (podgląd na żywo w liście pickera, np. "7" dla
  // "Poziom pupila") — rejestr i tak zwraca gotowe stringi, zero dodatkowego formatowania tutaj.
  const dataFieldOptions: PickerOption[] = useMemo(
    () => dataFieldRegistry.map(f => ({ key: f.id, label: f.label, meta: f.value })),
    [dataFieldRegistry],
  );
  // Piąty "widget z danymi" (§386) — rejestr z `statWidgets.ts` (29 metryk, 4 grupy, TEN SAM
  // rejestr co dashboardowe "Dodaj widget") — `meta` pokazuje grupę, żeby długa, płaska lista
  // dała się choć trochę ogarnąć wzrokiem bez budowania osobnego, sekcjonowanego pickera.
  const statOptions: PickerOption[] = useMemo(
    () => WIDGET_METRICS.map(m => ({ key: m.id, label: m.label, meta: m.group })),
    [],
  );

  // Szósty "widget z danymi" (§392) — ALE lista opcji to WYŁĄCZNIE 4 stałe taby Navbaru Pupila
  // (`PUPIL_NAV_TABS`, ta sama tablica co w `PupilNavbar.tsx` — jedno źródło prawdy), nie
  // dowolna trasa. Celowo zamknięta lista: nie da się skonfigurować przycisku prowadzącego do
  // nieistniejącej strony.
  const navTabOptions: PickerOption[] = useMemo(
    () => PUPIL_NAV_TABS.map(t => ({ key: t.key, label: t.label, meta: t.path })),
    [],
  );

  const canvasHeight = Math.max(
    MIN_CANVAS_HEIGHT,
    ...myItems.map(i => i.y + i.height),
  ) + (editing ? EDIT_BOTTOM_PAD : spacing[4]);

  const onLayout = (e: LayoutChangeEvent) => setCanvasWidth(e.nativeEvent.layout.width);

  // Zabezpieczenie przed podwójnym tapnięciem (§375, audyt — user: "otwiera się dwa razy") —
  // `onAdd` nie miał ŻADNEGO guardu, więc szybkie podwójne tapnięcie "Dodaj kafel serii" itd.
  // wołało `addItem()` dwa razy, dodając dwa identyczne itemy zamiast jednego. JEDEN guard dla
  // wszystkich 9 przycisków "Dodaj" (nie osobny per przycisk) — świadomy kompromis, patrz
  // komentarz w `pressGuard.ts`.
  const addGuard = usePressGuard();
  const onAdd = (type: CanvasComponentType) => {
    if (!addGuard.allow()) return;
    haptic.tap();
    const id = addItem(screenKey, type);
    // Kształty (§357) i Ikona (§371) nie mają podpięcia danych — nie otwieraj metric-pickera
    // po dodaniu, item od razu widoczny ze stylem domyślnym, gotowy do przeciągania/stylowania.
    if (!isShapeType(type) && type !== 'iconTile') setPickerForId(id);
  };

  const toggleSelect = (id: string) => {
    haptic.tap();
    setSelectedIds((prev) => prev.includes(id) ? prev.filter(x => x !== id) : [...prev, id]);
  };
  const cancelSelect = () => { haptic.tap(); setSelectMode(false); setSelectedIds([]); };
  const doGroup = () => {
    if (selectedIds.length < 2) return;
    haptic.success();
    groupItems(screenKey, selectedIds);
    setSelectMode(false);
    setSelectedIds([]);
  };
  // Wyrównaj zaznaczone (§400) — user: "nie mam jak ustawić np 2 kafelków na tym samym
  // poziomie". JEDNORAZOWE przesunięcie (NIE trwały link jak grupa) — zaznaczenie ZOSTAJE
  // aktywne po wyrównaniu (świadomie `setSelectMode`/`setSelectedIds` NIE są tu czyszczone,
  // w przeciwieństwie do `doGroup`), żeby można było zrobić oba wyrównania pod rząd albo
  // dociągnąć ręcznie i dopiero potem zgrupować.
  const doAlignY = () => { if (selectedIds.length < 2) return; haptic.success(); alignItemsY(screenKey, selectedIds); };
  const doAlignX = () => { if (selectedIds.length < 2) return; haptic.success(); alignItemsX(screenKey, selectedIds, canvasWidth); };

  const content = (
    <View style={s.wrap}>
      {/* Odznaki "Edytuj"/pełny ekran USUNIĘTE z żywych ekranów (Faza §396, 2026-10-19) — user:
          "wywal tamto było hujowe chcę mieć wszystko w ustawieniach". Wejście w edycję/pełny
          ekran idzie TERAZ WYŁĄCZNIE z Ustawień → "Edytor płótna" → "Projekty" (§390/§396) —
          żywy ekran nie pokazuje już ŻADNEGO przycisku, gdy nie edytujesz (zero stałego
          "zaśmiecenia" nagłówka). `editing`/`fullScreenOn` same w sobie ZOSTAJĄ nietknięte (ten
          sam mechanizm, `pendingAutoEdit` wciąż włącza `editing` zdalnie) — usunięty jest
          TYLKO lokalny przycisk-wejście na samym ekranie. Gdy już edytujesz, nagłówek nadal się
          pokazuje (tytuł + Warstwy + "Gotowe", żeby można było WYJŚĆ z edycji na tym samym
          ekranie, na którym ją zaczęto) — asymetria "wejście z Ustawień, wyjście tu" jest
          świadoma: Ustawienia to dobre miejsce na start, ale user kończy edycję W KONTEKŚCIE
          tego, co właśnie zbudował, nie chce w tym celu wracać do Ustawień. */}
      {!viewOnly && editing && (
      <View style={s.header}>
        <LayoutGrid size={13} color={c.text.secondary} />
        <Text style={s.title}>{title ?? 'Twoje komponenty'}</Text>
        <View style={{ flex: 1 }} />
        {myItems.length >= 2 && (
          <TouchableOpacity onPress={() => { haptic.tap(); setLayersOpen(true); }} style={s.layersBtn}>
            <Layers size={13} color={c.text.secondary} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => { haptic.tap(); setEditing(false); setSelectMode(false); setSelectedIds([]); }}
          style={[s.editBtn, { borderColor: c.accent.blue, backgroundColor: c.accent.blue + '18' }]}>
          <Check size={13} color={c.accent.blue} />
          <Text style={[s.editTxt, { color: c.accent.blue }]}>Gotowe</Text>
        </TouchableOpacity>
      </View>
      )}

      {myItems.length === 0 && !editing && !viewOnly && (
        <Text style={s.hintText}>
          Brak własnych komponentów tutaj. Dodaj je z Ustawień → "Edytor płótna" → "Projekty".
        </Text>
      )}

      <View onLayout={onLayout} style={[s.canvas, { height: canvasHeight, borderColor: editing ? c.accent.blue + '55' : c.border.subtle }]}>
        {orderedItems.map(item => {
          const isStreak = item.componentType === 'streakTile';
          const isCountdown = item.componentType === 'countdownTile';
          const isNote = item.componentType === 'notesTile';
          const isDataField = item.componentType === 'dataField';
          // Kształty-primitywy (§357) i Ikona (§371) — BEZ podpięcia danych, tapnięcie nie robi
          // nic (ani metric-picker, ani nawigacja) — interakcja idzie WYŁĄCZNIE przez chrome
          // `CanvasPlacedItem` (przeciąganie/resize/przycisk 🎨 stylu).
          const isShape = isShapeType(item.componentType);
          const isIcon = item.componentType === 'iconTile';
          const isStat = item.componentType === 'statTile';
          // Przycisk nawigacji dla Navbaru Pupila (Faza §392) — podpięcie do JEDNEGO z 4
          // STAŁYCH, predefiniowanych tabów (`PUPIL_NAV_TABS`), NIE dowolnej trasy — niemożliwe
          // skonfigurować "zepsuty" przycisk, bo lista opcji jest zamknięta.
          const isNavTab = item.componentType === 'navTab';
          const boundNavTab = isNavTab && item.bindingKey ? PUPIL_NAV_TABS.find(t => t.key === item.bindingKey) ?? null : null;
          // Pasek progresu (§393) — TEN SAM rejestr co countdownTile (`allCountdownItems`),
          // więc tapnięcie/opcje pickera też się reużywają.
          const isProgressBar = item.componentType === 'progressBar';
          const boundProgressCounter = isProgressBar && item.bindingKey ? allCountdownItems.find(x => x.id === item.bindingKey) ?? null : null;
          const boundStreak = isStreak && item.bindingKey ? allStreakItems.find(x => x.key === item.bindingKey) ?? null : null;
          const boundCountdown = isCountdown && item.bindingKey ? allCountdownItems.find(x => x.id === item.bindingKey) ?? null : null;
          const boundNote = isNote && item.bindingKey ? allNotesItems.find(x => x.id === item.bindingKey) ?? null : null;
          const boundDataField = isDataField && item.bindingKey ? dataFieldRegistry.find(f => f.id === item.bindingKey) ?? null : null;

          const onTap = () => {
            // Tryb "Dane"/popup (§391) — PRIORYTET nad wszystkim innym poniżej (działa dla
            // WSZYSTKICH typów, łącznie z kształtami/ikonami, które inaczej ignorują tap).
            // TYLKO poza edycją — w edycji tap zawsze służy do konfiguracji (picker/brak akcji
            // na kształtach), zgodnie z dotychczasowym zachowaniem.
            if (!editing && item.onTapAction === 'openPopup') { haptic.tap(); setPopup({ id: item.id, mode: 'view' }); return; }
            if (isShape || isIcon) return;
            if (editing) { setPickerForId(item.id); return; }
            if (isStreak) {
              if (boundStreak) navigateForStreakItem(boundStreak, item.style as StreakTileStyle);
              else setPickerForId(item.id);
            } else if (isCountdown || isProgressBar) {
              const bound = isProgressBar ? boundProgressCounter : boundCountdown;
              if (bound) { haptic.tap(); router.push(`/counters/${bound.id}` as any); }
              else setPickerForId(item.id);
            } else if (isNote) {
              if (boundNote) { haptic.tap(); router.navigate(`/notes?noteId=${boundNote.id}` as any); }
              else setPickerForId(item.id);
            } else {
              // dataField (§358)/statTile (§386) — statyczna wartość, nie strona: brak miejsca
              // nawigacji. Tapnięcie ZAWSZE otwiera picker (zmiana podpięcia), podpięte czy nie.
              setPickerForId(item.id);
            }
          };

          return (
            <CanvasPlacedItem
              key={item.id}
              item={item}
              editing={editing}
              canvasWidth={canvasWidth}
              allRects={itemRects}
              guides={guides}
              onTap={onTap}
              onDelete={() => removeItem(item.id)}
              onMove={(x, y) => {
                // Grupa (§349) — przesuwa WSZYSTKICH członków o ten sam delta (jeden przeciągany
                // item komunikuje tylko swoją własną, finalną pozycję, patrz `onEnd` w
                // `CanvasPlacedItem`), nie tylko siebie.
                if (item.groupId) moveGroupBy(screenKey, item.groupId, x - item.x, y - item.y, canvasWidth);
                else updateItem(item.id, { x, y });
              }}
              onResize={(width, height) => {
                // Resize całej grupy jako jednej jednostki (§359) — współczynnik skali z
                // WŁASNEGO starego/nowego rozmiaru PRZECIĄGANEGO itemu (matematycznie: jego
                // własny rozmiar po przeskalowaniu wychodzi DOKŁADNIE na `width`/`height`, patrz
                // komentarz w `resizeGroupBy`).
                if (item.groupId) {
                  const scaleX = width / item.width;
                  const scaleY = height / item.height;
                  resizeGroupBy(screenKey, item.groupId, scaleX, scaleY, canvasWidth);
                } else {
                  updateItem(item.id, { width, height });
                }
              }}
              onStyle={() => setStyleForId(item.id)}
              onProperties={() => setPropsForId(item.id)}
              selectMode={selectMode}
              selected={selectedIds.includes(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              grouped={item.groupId != null}
              renderTile={(sizeStyle, onPress) => isStreak ? (
                <StreakTile
                  item={boundStreak ?? { key: item.id, name: 'Wybierz metrykę', days: 0 }}
                  tileStyle={item.style as StreakTileStyle}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                />
              ) : isCountdown ? (
                <CountdownTile
                  item={boundCountdown}
                  tileStyle={item.style as CountdownTileStyle}
                  accentColor={timeAccentColor}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                  boxed
                />
              ) : isNote ? (
                <NotesTile
                  note={boundNote}
                  tileStyle={item.style as NotesTileStyle}
                  accentColor={timeAccentColor}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                  boxed
                />
              ) : isDataField ? (
                <DataFieldTile
                  field={boundDataField}
                  tileStyle={item.style as DataFieldTileStyle}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                  boxed
                />
              ) : isIcon ? (
                <IconTile
                  style={item.style as IconTileStyle}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                />
              ) : isStat ? (
                <StatCanvasTile
                  metric={item.bindingKey}
                  style={item.style as StatTileCanvasStyle}
                  statCtx={statCtx}
                  accentColor={timeAccentColor}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                />
              ) : isNavTab ? (
                <NavTabTile
                  tab={boundNavTab}
                  active={false}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                />
              ) : isProgressBar ? (
                <ProgressBarTile
                  counter={boundProgressCounter}
                  style={item.style as ProgressBarStyle}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                />
              ) : (
                <ShapeTile
                  kind={item.componentType as ShapeComponentType}
                  style={item.style as ShapeStyle}
                  width={item.width}
                  height={item.height}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                />
              )}
            />
          );
        })}
        {/* Wizualna ramka grupy (§365) — JEDNA wspólna ramka wokół bounding-boxa CAŁEJ grupy,
            widoczna TYLKO w trybie edycji (poza select-mode, gdzie i tak nic nie jest
            "pogrupowane" wizualnie w ten sposób) — per-member ramki (fioletowy border w
            `CanvasPlacedItem`) ZOSTAJĄ, to DODATKOWA, nie zastępująca wizualizacja. `pointerEvents
            ="none"` — czysto dekoracyjna, nie przechwytuje żadnego dotyku. */}
        {editing && !selectMode && Array.from(groupBoxes.entries()).map(([gid, box]) => (
          <View key={gid} pointerEvents="none" style={[s.groupFrame, {
            left: box.x - 8, top: box.y - 8, width: box.width + 16, height: box.height + 16,
          }]} />
        ))}
        {/* Smart guides (§372) — dwie linie o stałej pozycji w drzewie (ten sam fixed-slot
            wzorzec co ramka grupy wyżej), widoczność/pozycja czytane z `guides` shared value
            wypisywanej przez AKTUALNIE przeciągany `CanvasPlacedItem`. Różowy akcent (nie
            fioletowy jak ramka grupy/niebieski jak reszta chrome) — wizualnie odróżnialny
            "trzeci język" UI, ten sam kolor co Figma/Sketch/XD używają do linii wyrównania. */}
        {editing && !selectMode && (
          <>
            <Reanimated.View pointerEvents="none" style={[vGuideStyle, { backgroundColor: '#EC4899' }]} />
            <Reanimated.View pointerEvents="none" style={[hGuideStyle, { backgroundColor: '#EC4899' }]} />
          </>
        )}
      </View>

      {editing && selectMode && (
        <>
          {/* Wyrównaj zaznaczone (§400) — osobny rząd od Anuluj/Grupuj niżej: to JEDNORAZOWE
              przesunięcie (nie trwały link), więc wizualnie inna kategoria akcji nad tym samym
              zaznaczeniem — ten sam niebiesko-obrysowy, "akcja narzędziowa" styl co kształty/
              ikony niżej w pliku, nie fioletowy "grupowanie". */}
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <TouchableOpacity onPress={doAlignY} disabled={selectedIds.length < 2}
              style={[s.addBtn, s.shapeAddBtn, { flex: 1, opacity: selectedIds.length < 2 ? 0.4 : 1 }]} activeOpacity={0.85}>
              <AlignStartHorizontal size={15} color={c.text.secondary} />
              <Text style={[s.addTxt, { color: c.text.secondary }]}>Ten sam poziom</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={doAlignX} disabled={selectedIds.length < 2}
              style={[s.addBtn, s.shapeAddBtn, { flex: 1, opacity: selectedIds.length < 2 ? 0.4 : 1 }]} activeOpacity={0.85}>
              <AlignStartVertical size={15} color={c.text.secondary} />
              <Text style={[s.addTxt, { color: c.text.secondary }]}>Ta sama kolumna</Text>
            </TouchableOpacity>
          </View>
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <TouchableOpacity onPress={cancelSelect} style={[s.addBtn, { flex: 1, backgroundColor: c.bg.elevated }]} activeOpacity={0.85}>
              <X size={15} color={c.text.secondary} />
              <Text style={[s.addTxt, { color: c.text.secondary }]}>Anuluj</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={doGroup} disabled={selectedIds.length < 2}
              style={[s.addBtn, { flex: 1, backgroundColor: c.accent.purple, opacity: selectedIds.length < 2 ? 0.4 : 1 }]} activeOpacity={0.85}>
              <Group size={15} color="#fff" />
              <Text style={s.addTxt}>Grupuj ({selectedIds.length})</Text>
            </TouchableOpacity>
          </View>
          <Text style={s.hintText}>Zaznacz co najmniej 2 komponenty — "Ten sam poziom"/"Ta sama kolumna" wyrównuje je raz (bez trwałego powiązania), "Grupuj" sprawia że poruszają się razem na stałe.</Text>
        </>
      )}

      {editing && !selectMode && (
        <>
          {/* `flexWrap` (§350, trzeci przycisk "Notatka") — trzy `flex:1` kafle z ikoną+tekstem
              są ciasne na wąskich telefonach, zawijanie do dwóch rzędów bezpieczniejsze niż
              ścieśnianie tekstu do nieczytelności. */}
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            <TouchableOpacity onPress={() => onAdd('streakTile')} style={[s.addBtn, { flex: 1, minWidth: 100, backgroundColor: c.accent.blue }]} activeOpacity={0.85}>
              <Plus size={15} color="#fff" />
              <Text style={s.addTxt}>Kafel serii</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onAdd('countdownTile')} style={[s.addBtn, { flex: 1, minWidth: 100, backgroundColor: c.accent.blue }]} activeOpacity={0.85}>
              <Plus size={15} color="#fff" />
              <Text style={s.addTxt}>Odliczanie</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onAdd('progressBar')} style={[s.addBtn, { flex: 1, minWidth: 100, backgroundColor: c.accent.blue }]} activeOpacity={0.85}>
              <Plus size={15} color="#fff" />
              <Text style={s.addTxt}>Pasek progresu</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onAdd('notesTile')} style={[s.addBtn, { flex: 1, minWidth: 100, backgroundColor: c.accent.blue }]} activeOpacity={0.85}>
              <Plus size={15} color="#fff" />
              <Text style={s.addTxt}>Notatka</Text>
            </TouchableOpacity>
            {/* Generyczny data-binding (§358) — czwarty "widget z danymi", ten sam niebieski
                kolor co trzy powyżej (TA SAMA kategoria: podpięcie danych, nie goły kształt). */}
            <TouchableOpacity onPress={() => onAdd('dataField')} style={[s.addBtn, { flex: 1, minWidth: 100, backgroundColor: c.accent.blue }]} activeOpacity={0.85}>
              <Plus size={15} color="#fff" />
              <Text style={s.addTxt}>Pole danych</Text>
            </TouchableOpacity>
            {/* Wykres (§386) — piąty "widget z danymi", TYLKO gdy host dostarczył `statCtx`
                (dziś: wyłącznie dashboard) — nie pokazuj przycisku, który i tak nic by nie
                zrobił sensownie na ekranie bez tych danych (CLAUDE.md #7, nie zostawiaj
                martwych przycisków). */}
            {!!statCtx && (
              <TouchableOpacity onPress={() => onAdd('statTile')} style={[s.addBtn, { flex: 1, minWidth: 100, backgroundColor: c.accent.blue }]} activeOpacity={0.85}>
                <Plus size={15} color="#fff" />
                <Text style={s.addTxt}>Wykres</Text>
              </TouchableOpacity>
            )}
            {/* Przycisk nawigacji (§392) — WYŁĄCZNIE na `screenKey='navbar'` (edytor Navbaru
                Pupila, `app/navbar-editor.tsx`) — na innych ekranach nie miałby sensu (CLAUDE.md
                #7, nie zostawiaj martwego przycisku). */}
            {screenKey === 'navbar' && (
              <TouchableOpacity onPress={() => onAdd('navTab')} style={[s.addBtn, { flex: 1, minWidth: 100, backgroundColor: c.accent.blue }]} activeOpacity={0.85}>
                <Plus size={15} color="#fff" />
                <Text style={s.addTxt}>Przycisk nawigacji</Text>
              </TouchableOpacity>
            )}
          </View>
          {/* Kształty-primitywy (§357) i Ikona (§371) — osobny, wizualnie oddzielony wiersz
              (szary, nie niebieski jak "komponenty z danymi" wyżej) — inna kategoria: BEZ
              podpięcia, czysto wizualne elementy do budowania własnego układu. */}
          <Text style={[s.sectionLabel, { marginTop: 2 }]}>Kształty i ikony</Text>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] }}>
            <TouchableOpacity onPress={() => onAdd('rectShape')} style={[s.addBtn, s.shapeAddBtn, { flex: 1, minWidth: 80 }]} activeOpacity={0.85}>
              <Square size={15} color={c.text.secondary} />
              <Text style={[s.addTxt, { color: c.text.secondary }]}>Prostokąt</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onAdd('ellipseShape')} style={[s.addBtn, s.shapeAddBtn, { flex: 1, minWidth: 80 }]} activeOpacity={0.85}>
              <Circle size={15} color={c.text.secondary} />
              <Text style={[s.addTxt, { color: c.text.secondary }]}>Elipsa</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onAdd('lineShape')} style={[s.addBtn, s.shapeAddBtn, { flex: 1, minWidth: 80 }]} activeOpacity={0.85}>
              <Minus size={15} color={c.text.secondary} />
              <Text style={[s.addTxt, { color: c.text.secondary }]}>Linia</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onAdd('textShape')} style={[s.addBtn, s.shapeAddBtn, { flex: 1, minWidth: 80 }]} activeOpacity={0.85}>
              <Type size={15} color={c.text.secondary} />
              <Text style={[s.addTxt, { color: c.text.secondary }]}>Tekst</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onAdd('iconTile')} style={[s.addBtn, s.shapeAddBtn, { flex: 1, minWidth: 80 }]} activeOpacity={0.85}>
              <Smile size={15} color={c.text.secondary} />
              <Text style={[s.addTxt, { color: c.text.secondary }]}>Ikona</Text>
            </TouchableOpacity>
          </View>
          {/* Grupowanie (§349) — osobny przycisk, nie trzeci "Dodaj" (to nie dodaje nowej
              instancji, tylko zmienia tryb interakcji z istniejącymi) — tylko gdy jest co
              grupować (2+ itemy na tym ekranie), zero sensu pokazywać przy jednym/zero kaflach. */}
          {myItems.length >= 2 && (
            <TouchableOpacity onPress={() => { haptic.tap(); setSelectMode(true); }} style={[s.addBtn, { backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default }]} activeOpacity={0.85}>
              <Group size={15} color={c.text.secondary} />
              <Text style={[s.addTxt, { color: c.text.secondary }]}>Grupuj komponenty</Text>
            </TouchableOpacity>
          )}
          {/* Podpowiedź (2026-10-16, Faza 16) — mechanizm (przeciąganie/zmiana rozmiaru w rogu/
              tapnięcie/dwa małe przyciski) jest zupełnie nowy w appce, bez tego user nie ma
              żadnego sposobu się domyślić co robić z kaflem po jego dodaniu. */}
          <Text style={s.hintText}>
            Przeciągnij kafel, żeby go przesunąć · uchwyt w rogu zmienia rozmiar (w grupie:
            skaluje WSZYSTKICH razem) · tapnięcie wybiera podpięcie (kształty nie mają podpięcia
            — od razu gotowe) · ⚙ właściwości (pozycja/rozmiar/warstwa/rozgrupuj), 🎨 styl, 🗑
            usuń{myItems.length >= 2 ? ' · 📚 lista warstw w nagłówku' : ''}.
          </Text>
        </>
      )}

      <MetricPickerModal
        visible={!!pickerItem}
        title={pickerItem?.componentType === 'countdownTile' ? 'Wybierz odliczanie' : pickerItem?.componentType === 'notesTile' ? 'Wybierz notatkę' : pickerItem?.componentType === 'dataField' ? 'Wybierz pole danych' : pickerItem?.componentType === 'statTile' ? 'Wybierz metrykę wykresu' : pickerItem?.componentType === 'navTab' ? 'Wybierz zakładkę' : pickerItem?.componentType === 'progressBar' ? 'Wybierz licznik' : 'Wybierz metrykę'}
        icon={pickerItem?.componentType === 'countdownTile' ? CalendarClock : pickerItem?.componentType === 'notesTile' ? FileText : pickerItem?.componentType === 'dataField' ? Database : pickerItem?.componentType === 'statTile' ? BarChart2 : pickerItem?.componentType === 'navTab' ? Compass : pickerItem?.componentType === 'progressBar' ? CalendarClock : Flame}
        options={pickerItem?.componentType === 'countdownTile' ? countdownOptions : pickerItem?.componentType === 'notesTile' ? notesOptions : pickerItem?.componentType === 'dataField' ? dataFieldOptions : pickerItem?.componentType === 'statTile' ? statOptions : pickerItem?.componentType === 'navTab' ? navTabOptions : pickerItem?.componentType === 'progressBar' ? countdownOptions : streakOptions}
        currentKey={pickerItem?.bindingKey ?? null}
        emptyHint={pickerItem?.componentType === 'countdownTile' || pickerItem?.componentType === 'progressBar'
          ? 'Brak aktywnych odliczań na koncie — dodaj jedno w Licznikach.'
          : pickerItem?.componentType === 'notesTile'
          ? 'Brak notatek na koncie — dodaj jedną w Notatkach.'
          : pickerItem?.componentType === 'dataField'
          ? 'Rejestr pól danych jest pusty — to nie powinno się zdarzyć.'
          : pickerItem?.componentType === 'statTile'
          ? 'Rejestr metryk jest pusty — to nie powinno się zdarzyć.'
          : pickerItem?.componentType === 'navTab'
          ? 'Lista zakładek jest pusta — to nie powinno się zdarzyć.'
          : 'Brak nawyków/liczników/ćwiczeń z serią na koncie — dodaj jeden w Nawykach albo Licznikach.'}
        onSelect={(key) => { if (pickerItem) updateItem(pickerItem.id, { bindingKey: key }); setPickerForId(null); }}
        onClose={() => setPickerForId(null)}
      />

      <CanvasStreakStyleModal
        visible={!!styleItem && styleItem.componentType === 'streakTile'}
        style={(styleItem && styleItem.componentType === 'streakTile' ? styleItem.style : DEFAULT_STREAK_TILE_STYLE) as StreakTileStyle}
        boundItem={styleBoundStreak}
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...(styleItem.style as StreakTileStyle), ...patch } }); }}
        onSetTierColor={(i, color) => {
          if (!styleItem || styleItem.componentType !== 'streakTile') return;
          const next = { ...(styleItem.style as StreakTileStyle).tierColorOverrides };
          if (color) next[i] = color; else delete next[i];
          updateItem(styleItem.id, { style: { ...styleItem.style, tierColorOverrides: next } });
        }}
        onSetHabitCalendar={(habitId, navStyle) => {
          if (!styleItem || styleItem.componentType !== 'streakTile') return;
          const next = { ...(styleItem.style as StreakTileStyle).habitCalendarOverrides, [habitId]: navStyle };
          updateItem(styleItem.id, { style: { ...styleItem.style, habitCalendarOverrides: next } });
        }}
        onClose={() => setStyleForId(null)}
      />

      <CanvasCountdownStyleModal
        visible={!!styleItem && styleItem.componentType === 'countdownTile'}
        style={(styleItem && styleItem.componentType === 'countdownTile' ? styleItem.style : DEFAULT_COUNTDOWN_TILE_STYLE) as CountdownTileStyle}
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...(styleItem.style as CountdownTileStyle), ...patch } }); }}
        onClose={() => setStyleForId(null)}
      />

      <CanvasNotesStyleModal
        visible={!!styleItem && styleItem.componentType === 'notesTile'}
        style={(styleItem && styleItem.componentType === 'notesTile' ? styleItem.style : DEFAULT_NOTES_TILE_STYLE) as NotesTileStyle}
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...(styleItem.style as NotesTileStyle), ...patch } }); }}
        onClose={() => setStyleForId(null)}
      />

      <CanvasShapeStyleModal
        visible={!!styleItem && isShapeType(styleItem.componentType)}
        kind={(styleItem && isShapeType(styleItem.componentType) ? styleItem.componentType : 'rectShape') as ShapeComponentType}
        style={styleItem && isShapeType(styleItem.componentType) ? (styleItem.style as ShapeStyle) : SHAPE_DEFAULT_BY_KIND.rectShape}
        // `as any` (dokumentowana pułapka, §355) — `patch` jest generycznie typowany
        // (`Record<string, unknown>`) w `CanvasShapeStyleModal`, bo pola różnią się MIĘDZY 4
        // typami kształtu (np. `cornerRadius` istnieje tylko w `RectShapeStyle`) — spread nad
        // `ShapeStyle` (unia 4 różnych interfejsów) z takim patchem dystrybuuje się źle w TS.
        // Bezpieczeństwo typów żyje w samym modalu (branch wg `kind` PRZED użyciem pól).
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...(styleItem.style as any), ...patch } }); }}
        onClose={() => setStyleForId(null)}
      />

      <CanvasDataFieldStyleModal
        visible={!!styleItem && styleItem.componentType === 'dataField'}
        style={(styleItem && styleItem.componentType === 'dataField' ? styleItem.style : DEFAULT_DATA_FIELD_TILE_STYLE) as DataFieldTileStyle}
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...(styleItem.style as DataFieldTileStyle), ...patch } }); }}
        onClose={() => setStyleForId(null)}
      />

      <CanvasIconStyleModal
        visible={!!styleItem && styleItem.componentType === 'iconTile'}
        style={(styleItem && styleItem.componentType === 'iconTile' ? styleItem.style : DEFAULT_ICON_TILE_STYLE) as IconTileStyle}
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...(styleItem.style as IconTileStyle), ...patch } }); }}
        onClose={() => setStyleForId(null)}
      />

      <CanvasStatStyleModal
        visible={!!styleItem && styleItem.componentType === 'statTile'}
        style={(styleItem && styleItem.componentType === 'statTile' ? styleItem.style : DEFAULT_STAT_TILE_STYLE) as StatTileCanvasStyle}
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...(styleItem.style as StatTileCanvasStyle), ...patch } }); }}
        onClose={() => setStyleForId(null)}
      />

      <CanvasProgressBarStyleModal
        visible={!!styleItem && styleItem.componentType === 'progressBar'}
        style={(styleItem && styleItem.componentType === 'progressBar' ? styleItem.style : DEFAULT_PROGRESS_BAR_STYLE) as ProgressBarStyle}
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...(styleItem.style as ProgressBarStyle), ...patch } }); }}
        onClose={() => setStyleForId(null)}
      />

      <CanvasPropertiesModal
        visible={!!propsItem}
        x={propsItem?.x ?? 0}
        y={propsItem?.y ?? 0}
        width={propsItem?.width ?? MIN_ITEM_WIDTH}
        height={propsItem?.height ?? MIN_ITEM_HEIGHT}
        canvasWidth={canvasWidth}
        grouped={propsItem?.groupId != null}
        onChange={(patch) => {
          if (!propsItem) return;
          // Klamrowanie (§360, fix) — `patch` z panelu to JEDNO pole na raz (Stepper woła
          // `onChange` per pole), ale X i Szerokość są WSPÓŁZALEŻNE: zwiększenie Szerokości bez
          // ruszania X mogło wypchnąć prawą krawędź poza płótno (gest drag/resize zawsze klamruje
          // razem, patrz `CanvasPlacedItem.tsx`/`moveGroupBy`/`resizeGroupBy` — panel właściwości
          // był JEDYNYM miejscem, które tego nie robiło). Przeliczone z WYNIKOWEGO stanu (po
          // merge patcha), nie tylko z pojedynczego pola, żeby działało identycznie czy user
          // zmienia X czy Szerokość.
          const nextWidth = Math.min('width' in patch ? patch.width! : propsItem.width, canvasWidth);
          const nextX = clampItemX('x' in patch ? patch.x! : propsItem.x, nextWidth, canvasWidth);
          updateItem(propsItem.id, { ...patch, x: nextX, width: nextWidth });
        }}
        onBringToFront={() => { if (propsItem) bringToFront(propsItem.id); }}
        onSendToBack={() => { if (propsItem) sendToBack(propsItem.id); }}
        onCenterHorizontal={() => { if (propsItem) centerItemX(propsItem.id, canvasWidth); }}
        onDuplicate={() => { if (propsItem) duplicateItem(propsItem.id, canvasWidth); }}
        onUngroup={() => { if (propsItem?.groupId) ungroupItems(propsItem.groupId); }}
        onTapAction={propsItem?.onTapAction === 'openPopup' ? 'openPopup' : 'none'}
        onChangeTapAction={(v) => { if (propsItem) updateItem(propsItem.id, { onTapAction: v }); }}
        onEditPopup={() => { if (propsItem) { const id = propsItem.id; setPropsForId(null); setPopup({ id, mode: 'edit' }); } }}
        onClose={() => setPropsForId(null)}
      />

      <CanvasPopupModal
        visible={!!popup}
        itemId={popup?.id ?? null}
        mode={popup?.mode ?? 'view'}
        onClose={() => setPopup(null)}
      />

      <CanvasLayersModal
        visible={layersOpen}
        rows={layerRows}
        onMoveUp={(id) => moveLayer(id, 'up')}
        onMoveDown={(id) => moveLayer(id, 'down')}
        onClose={() => setLayersOpen(false)}
      />

    </View>
  );

  // Tryb pełnoekranowy (§381) — gdy włączony, CAŁOŚĆ powyższego (identyczna, niezmieniona
  // treść/logika — dalej te same itemy/edycja/modale) dostaje WŁASNY, pełnoekranowy,
  // przewijany kontener zamiast być osadzona na końcu scrolla hostującego ekranu. Hostujący
  // ekran (np. health.tsx) robi wczesny `return` gdy ten sam flag jest włączony, więc TA
  // ścieżka jest w praktyce jedynym, co się renderuje — ale `ScreenCanvasBase` sama o tym nie
  // wie (świadomie, patrz komentarz przy `fullScreenOn` wyżej), więc i tak musi umieć
  // wypełnić cały ekran samodzielnie, bez polegania na hoście.
  if (fullScreenOn) {
    return (
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.fullScreenScroll} showsVerticalScrollIndicator={false}>
        {content}
      </ScrollView>
    );
  }
  return content;
}

// Cienki wrapper (§356) — wołający 3 hooki (AsyncStorage/Zustand) SAM, jak `ScreenCanvasBase`
// robiło dotąd wprost. Jedzenie/Ćwiczenia/Finanse importują TEN komponent (domyślny eksport),
// bez żadnej zmiany w ich własnym kodzie — ta sama nazwa, te same propsy `screenKey`/`title`.
export default function ScreenCanvas({ screenKey, title, viewOnly }: { screenKey: string; title?: string; viewOnly?: boolean }) {
  const allStreakItems = useAllStreakItems();
  const allCountdownItems = useAllCountdownItems();
  const allNotesItems = useAllNotesItems();
  const dataFieldRegistry = useDataFieldRegistry();
  const { color: accentColor } = useTimeAccent();
  return (
    <ScreenCanvasBase
      screenKey={screenKey}
      title={title}
      allStreakItems={allStreakItems}
      allCountdownItems={allCountdownItems}
      allNotesItems={allNotesItems}
      dataFieldRegistry={dataFieldRegistry}
      accentColor={accentColor}
      viewOnly={viewOnly}
    />
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  wrap: { gap: spacing[2] },
  // Tryb pełnoekranowy (§381) — padding boczny/górny bo ten `ScrollView` nie jest już
  // osadzony w scrollu hosta (który dotąd dawał te marginesy); `paddingBottom: 180` to ta
  // sama, ustalona w całej appce rezerwa pod pływający `TabBar`/`PupilNavbar` (patrz np.
  // `health.tsx`'s `styles.scroll` — identyczna wartość, żeby nie zgadywać nowej).
  fullScreenScroll: { padding: spacing[4], paddingBottom: 180, flexGrow: 1 },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontFamily: fonts.label, fontSize: 11, color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.9 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
  },
  editTxt: { fontSize: 11.5, fontWeight: '700', color: c.text.secondary },
  layersBtn: {
    width: 28, height: 28, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  hintText: { fontSize: 11.5, color: c.text.muted, lineHeight: 16 },
  canvas: { borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', position: 'relative', overflow: 'visible' },
  groupFrame: {
    position: 'absolute', borderWidth: 2, borderStyle: 'dashed', borderColor: c.accent.purple + '90',
    borderRadius: radius.lg,
  },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 10, borderRadius: radius.md,
  },
  addTxt: { fontSize: 12.5, fontWeight: '700', color: '#fff' },
  // Kształty-primitywy (§357) — szary/obrysowy, nie pełny niebieski jak "komponenty z danymi",
  // żeby wizualnie od razu było widać inną kategorię bez czytania etykiet.
  shapeAddBtn: { backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
}));
