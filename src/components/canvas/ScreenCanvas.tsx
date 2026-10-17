import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { Pencil, Check, Plus, LayoutGrid, Flame, CalendarClock, FileText, Group, X, Square, Circle, Minus, Type, Database } from 'lucide-react-native';
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

// Domyślny styl per typ kształtu (Faza 26, §357) — fallback dla modala stylu kiedy
// `styleItem` jeszcze nie jest kształtem (modal musi dostać JAKIŚ `style`, nawet gdy
// `visible={false}`, bo React renderuje drzewo niezależnie od `visible` w `<Modal>`).
const SHAPE_DEFAULT_BY_KIND: Record<ShapeComponentType, ShapeStyle> = {
  rectShape: DEFAULT_RECT_SHAPE_STYLE,
  ellipseShape: DEFAULT_ELLIPSE_SHAPE_STYLE,
  lineShape: DEFAULT_LINE_SHAPE_STYLE,
  textShape: DEFAULT_TEXT_SHAPE_STYLE,
};

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
export function ScreenCanvasBase({ screenKey, title, allStreakItems, allCountdownItems, allNotesItems, dataFieldRegistry, accentColor }: {
  screenKey: string;
  title?: string;
  allStreakItems: StreakItem[];
  allCountdownItems: Counter[];
  allNotesItems: Note[];
  dataFieldRegistry: DataFieldValue[];
  accentColor: string;
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
  // Grupowanie (Faza 20, 2026-10-17, §349) — user, wcześniej w §333: "grupowanie komponentów".
  // `selectMode` zamienia CAŁE płótno w tryb "tapnij żeby zaznaczyć" (osobna gałąź renderu w
  // `CanvasPlacedItem`, patrz komentarz tam) — oddzielny od normalnej edycji, nie da się
  // jednocześnie przeciągać/zaznaczać (user by się pogubił które tapnięcie co robi).
  const [selectMode, setSelectMode] = useState(false);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);

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
  const myItems = useMemo(() => allItems.filter(i => i.screenKey === screenKey), [allItems, screenKey]);
  // Warstwy (§359) — porządek RENDEROWANIA (który decyduje co jest "na wierzchu" wizualnie w
  // RN) sortowany po `zIndex`, NIE po kolejności w tablicy `items` (ta odzwierciedla kolejność
  // DODANIA, nie bieżącą warstwę po ewentualnym "na wierzch"/"na spód"). `?? 0` — patrz komentarz
  // przy `CanvasItem.zIndex` w `canvasComponentsStore.ts`.
  const orderedItems = useMemo(() => [...myItems].sort((a, b) => (a.zIndex ?? 0) - (b.zIndex ?? 0)), [myItems]);

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

  const canvasHeight = Math.max(
    MIN_CANVAS_HEIGHT,
    ...myItems.map(i => i.y + i.height),
  ) + (editing ? EDIT_BOTTOM_PAD : spacing[4]);

  const onLayout = (e: LayoutChangeEvent) => setCanvasWidth(e.nativeEvent.layout.width);

  const onAdd = (type: CanvasComponentType) => {
    haptic.tap();
    const id = addItem(screenKey, type);
    // Kształty (§357) nie mają podpięcia danych — nie otwieraj metric-pickera po dodaniu, item
    // od razu widoczny ze stylem domyślnym, gotowy do przeciągania/stylowania.
    if (!isShapeType(type)) setPickerForId(id);
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

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <LayoutGrid size={13} color={c.text.secondary} />
        <Text style={s.title}>{title ?? 'Twoje komponenty'}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => { haptic.tap(); setEditing(v => !v); setSelectMode(false); setSelectedIds([]); }}
          style={[s.editBtn, editing && { borderColor: c.accent.blue, backgroundColor: c.accent.blue + '18' }]}>
          {editing ? <Check size={13} color={c.accent.blue} /> : <Pencil size={13} color={c.text.secondary} />}
          <Text style={[s.editTxt, editing && { color: c.accent.blue }]}>{editing ? 'Gotowe' : 'Edytuj'}</Text>
        </TouchableOpacity>
      </View>

      {myItems.length === 0 && !editing && (
        <Text style={s.hintText}>
          Brak własnych komponentów tutaj. Włącz edycję, żeby dodać kafel serii albo odliczania
          z inną metryką — np. ten sam kafel co na dashboardzie, przepięty na inny nawyk/licznik.
        </Text>
      )}

      <View onLayout={onLayout} style={[s.canvas, { height: canvasHeight, borderColor: editing ? c.accent.blue + '55' : c.border.subtle }]}>
        {orderedItems.map(item => {
          const isStreak = item.componentType === 'streakTile';
          const isCountdown = item.componentType === 'countdownTile';
          const isNote = item.componentType === 'notesTile';
          const isDataField = item.componentType === 'dataField';
          // Kształty-primitywy (§357) — BEZ podpięcia danych, tapnięcie nie robi nic (ani
          // metric-picker, ani nawigacja) — interakcja idzie WYŁĄCZNIE przez chrome
          // `CanvasPlacedItem` (przeciąganie/resize/przycisk 🎨 stylu).
          const isShape = isShapeType(item.componentType);
          const boundStreak = isStreak && item.bindingKey ? allStreakItems.find(x => x.key === item.bindingKey) ?? null : null;
          const boundCountdown = isCountdown && item.bindingKey ? allCountdownItems.find(x => x.id === item.bindingKey) ?? null : null;
          const boundNote = isNote && item.bindingKey ? allNotesItems.find(x => x.id === item.bindingKey) ?? null : null;
          const boundDataField = isDataField && item.bindingKey ? dataFieldRegistry.find(f => f.id === item.bindingKey) ?? null : null;

          const onTap = () => {
            if (isShape) return;
            if (editing) { setPickerForId(item.id); return; }
            if (isStreak) {
              if (boundStreak) navigateForStreakItem(boundStreak, item.style as StreakTileStyle);
              else setPickerForId(item.id);
            } else if (isCountdown) {
              if (boundCountdown) { haptic.tap(); router.push(`/counters/${boundCountdown.id}` as any); }
              else setPickerForId(item.id);
            } else if (isNote) {
              if (boundNote) { haptic.tap(); router.navigate(`/notes?noteId=${boundNote.id}` as any); }
              else setPickerForId(item.id);
            } else {
              // dataField (§358) — statyczna wartość, nie strona: brak miejsca nawigacji.
              // Tapnięcie ZAWSZE otwiera picker (zmiana podpięcia), podpięte czy nie.
              setPickerForId(item.id);
            }
          };

          return (
            <CanvasPlacedItem
              key={item.id}
              item={item}
              editing={editing}
              canvasWidth={canvasWidth}
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
              ) : (
                <ShapeTile
                  kind={item.componentType as ShapeComponentType}
                  style={item.style as ShapeStyle}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                />
              )}
            />
          );
        })}
      </View>

      {editing && selectMode && (
        <>
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
          <Text style={s.hintText}>Zaznacz co najmniej 2 komponenty, które mają poruszać się razem.</Text>
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
          </View>
          {/* Kształty-primitywy (§357) — osobny, wizualnie oddzielony wiersz (szary, nie
              niebieski jak "komponenty z danymi" wyżej) — inna kategoria: BEZ podpięcia,
              czysto wizualne elementy do budowania własnego układu. */}
          <Text style={[s.sectionLabel, { marginTop: 2 }]}>Kształty</Text>
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
            usuń.
          </Text>
        </>
      )}

      <MetricPickerModal
        visible={!!pickerItem}
        title={pickerItem?.componentType === 'countdownTile' ? 'Wybierz odliczanie' : pickerItem?.componentType === 'notesTile' ? 'Wybierz notatkę' : pickerItem?.componentType === 'dataField' ? 'Wybierz pole danych' : 'Wybierz metrykę'}
        icon={pickerItem?.componentType === 'countdownTile' ? CalendarClock : pickerItem?.componentType === 'notesTile' ? FileText : pickerItem?.componentType === 'dataField' ? Database : Flame}
        options={pickerItem?.componentType === 'countdownTile' ? countdownOptions : pickerItem?.componentType === 'notesTile' ? notesOptions : pickerItem?.componentType === 'dataField' ? dataFieldOptions : streakOptions}
        currentKey={pickerItem?.bindingKey ?? null}
        emptyHint={pickerItem?.componentType === 'countdownTile'
          ? 'Brak aktywnych odliczań na koncie — dodaj jedno w Licznikach.'
          : pickerItem?.componentType === 'notesTile'
          ? 'Brak notatek na koncie — dodaj jedną w Notatkach.'
          : pickerItem?.componentType === 'dataField'
          ? 'Rejestr pól danych jest pusty — to nie powinno się zdarzyć.'
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
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...styleItem.style, ...patch } }); }}
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
        onUngroup={() => { if (propsItem?.groupId) ungroupItems(propsItem.groupId); }}
        onClose={() => setPropsForId(null)}
      />
    </View>
  );
}

// Cienki wrapper (§356) — wołający 3 hooki (AsyncStorage/Zustand) SAM, jak `ScreenCanvasBase`
// robiło dotąd wprost. Jedzenie/Ćwiczenia/Finanse importują TEN komponent (domyślny eksport),
// bez żadnej zmiany w ich własnym kodzie — ta sama nazwa, te same propsy `screenKey`/`title`.
export default function ScreenCanvas({ screenKey, title }: { screenKey: string; title?: string }) {
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
    />
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  wrap: { gap: spacing[2] },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  title: { fontFamily: fonts.label, fontSize: 11, color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.9 },
  editBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: 10, paddingVertical: 6,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
  },
  editTxt: { fontSize: 11.5, fontWeight: '700', color: c.text.secondary },
  hintText: { fontSize: 11.5, color: c.text.muted, lineHeight: 16 },
  canvas: { borderRadius: radius.lg, borderWidth: 1, borderStyle: 'dashed', position: 'relative', overflow: 'visible' },
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
