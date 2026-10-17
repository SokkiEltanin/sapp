import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { router } from 'expo-router';
import { Pencil, Check, Plus, LayoutGrid, Flame, CalendarClock, Group, X } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';
import { useAllStreakItems } from '@/hooks/useAllStreakItems';
import { useAllCountdownItems } from '@/hooks/useAllCountdownItems';
import { daysUntil, isDuringEvent } from '@/store/countersStore';
import { StreakTile, navigateForStreakItem } from '@/components/dashboard/StreakTile';
import { CountdownTile, DEFAULT_COUNTDOWN_TILE_STYLE, CountdownTileStyle } from '@/components/dashboard/CountdownTile';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { useCanvasComponentsStore, CanvasComponentType } from '@/store/canvasComponentsStore';
import { DEFAULT_STREAK_TILE_STYLE, StreakTileStyle } from '@/store/streakTileStyleStore';
import CanvasPlacedItem from './CanvasPlacedItem';
import MetricPickerModal, { PickerOption } from './MetricPickerModal';
import CanvasStreakStyleModal from './CanvasStreakStyleModal';
import CanvasCountdownStyleModal from './CanvasCountdownStyleModal';

const MIN_CANVAS_HEIGHT = 140;
const EDIT_BOTTOM_PAD = 76; // miejsce na przyciski "Dodaj" pod najniższą instancją

// Wolne płótno (system kopiowania komponentów, Faza 15, §341) — user: "chce dosłownie tam od
// zera zbudować z przesunięciem podpięcia itp", doprecyzowane: Figma/Canva-style (swobodna
// pozycja/rozmiar, nakładanie dozwolone), tapnięcie na kafel otwiera picker podpięcia. Jeden
// ekran = jeden `screenKey` (np. `'food'`) — każdy ekran dostaje WŁASNĄ, niezależną listę
// instancji; kopiowanie "między ekranami" (user: "woda z dashboardu → słodycze w Jedzeniu")
// nie przenosi literalnie obiektu z dashboardu (dashboard nie ma tu swoich instancji — jego
// "Twoje serie" to wciąż osobny, sztywny `StreakWallCard`), tylko daje TEN SAM komponent i TĘ
// SAMĄ listę do wyboru — efekt dla usera identyczny, bez potrzeby osobnego mechanizmu
// "wklejania" skopiowanego node'a.
//
// Faza 17 (2026-10-17) — drugi `componentType` (`'countdownTile'`, po `'streakTile'`), dowód
// że mechanizm faktycznie generalizuje. `CanvasPlacedItem` nie wie NIC o konkretnych typach
// kafli (render-prop, §341 komentarz tam) — CAŁA logika "co to za typ, jak go wyświetlić, gdzie
// szukać podpięcia" żyje TUTAJ, w jednym miejscu, żeby dodanie TRZECIEGO typu w przyszłości
// było jedną kolejną gałęzią tych samych kilku `if`ów, nie rozrzuconą zmianą w wielu plikach.
export default function ScreenCanvas({ screenKey, title }: { screenKey: string; title?: string }) {
  const c = useColors();
  const s = makeS(c);
  const [editing, setEditing] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(320);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [styleForId, setStyleForId] = useState<string | null>(null);
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
  const myItems = useMemo(() => allItems.filter(i => i.screenKey === screenKey), [allItems, screenKey]);

  const allStreakItems = useAllStreakItems();
  const allCountdownItems = useAllCountdownItems();
  const { color: timeAccentColor } = useTimeAccent();
  const pickerItem = myItems.find(i => i.id === pickerForId) ?? null;
  const styleItem = myItems.find(i => i.id === styleForId) ?? null;

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

  const canvasHeight = Math.max(
    MIN_CANVAS_HEIGHT,
    ...myItems.map(i => i.y + i.height),
  ) + (editing ? EDIT_BOTTOM_PAD : spacing[4]);

  const onLayout = (e: LayoutChangeEvent) => setCanvasWidth(e.nativeEvent.layout.width);

  const onAdd = (type: CanvasComponentType) => {
    haptic.tap();
    const id = addItem(screenKey, type);
    setPickerForId(id);
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
        {myItems.map(item => {
          const isStreak = item.componentType === 'streakTile';
          const boundStreak = isStreak && item.bindingKey ? allStreakItems.find(x => x.key === item.bindingKey) ?? null : null;
          const boundCountdown = !isStreak && item.bindingKey ? allCountdownItems.find(x => x.id === item.bindingKey) ?? null : null;

          const onTap = () => {
            if (editing) { setPickerForId(item.id); return; }
            if (isStreak) {
              if (boundStreak) navigateForStreakItem(boundStreak, item.style as StreakTileStyle);
              else setPickerForId(item.id);
            } else {
              if (boundCountdown) { haptic.tap(); router.push(`/counters/${boundCountdown.id}` as any); }
              else setPickerForId(item.id);
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
              onResize={(width, height) => updateItem(item.id, { width, height })}
              onStyle={() => setStyleForId(item.id)}
              selectMode={selectMode}
              selected={selectedIds.includes(item.id)}
              onToggleSelect={() => toggleSelect(item.id)}
              grouped={item.groupId != null}
              onUngroup={() => { if (item.groupId) { haptic.tap(); ungroupItems(item.groupId); } }}
              renderTile={(sizeStyle, onPress) => isStreak ? (
                <StreakTile
                  item={boundStreak ?? { key: item.id, name: 'Wybierz metrykę', days: 0 }}
                  tileStyle={item.style as StreakTileStyle}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                />
              ) : (
                <CountdownTile
                  item={boundCountdown}
                  tileStyle={item.style as CountdownTileStyle}
                  accentColor={timeAccentColor}
                  onPress={onPress}
                  sizeStyle={sizeStyle}
                  boxed
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
          <View style={{ flexDirection: 'row', gap: spacing[2] }}>
            <TouchableOpacity onPress={() => onAdd('streakTile')} style={[s.addBtn, { flex: 1, backgroundColor: c.accent.blue }]} activeOpacity={0.85}>
              <Plus size={15} color="#fff" />
              <Text style={s.addTxt}>Kafel serii</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={() => onAdd('countdownTile')} style={[s.addBtn, { flex: 1, backgroundColor: c.accent.blue }]} activeOpacity={0.85}>
              <Plus size={15} color="#fff" />
              <Text style={s.addTxt}>Odliczanie</Text>
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
            Przeciągnij kafel, żeby go przesunąć · uchwyt w rogu zmienia rozmiar · tapnięcie
            wybiera podpięcie · 🎨 styl, 🗑 usuń{myItems.length >= 2 ? ' · 🔗 rozgrupuj' : ''}.
          </Text>
        </>
      )}

      <MetricPickerModal
        visible={!!pickerItem}
        title={pickerItem?.componentType === 'countdownTile' ? 'Wybierz odliczanie' : 'Wybierz metrykę'}
        icon={pickerItem?.componentType === 'countdownTile' ? CalendarClock : Flame}
        options={pickerItem?.componentType === 'countdownTile' ? countdownOptions : streakOptions}
        currentKey={pickerItem?.bindingKey ?? null}
        emptyHint={pickerItem?.componentType === 'countdownTile'
          ? 'Brak aktywnych odliczań na koncie — dodaj jedno w Licznikach.'
          : 'Brak nawyków/liczników/ćwiczeń z serią na koncie — dodaj jeden w Nawykach albo Licznikach.'}
        onSelect={(key) => { if (pickerItem) updateItem(pickerItem.id, { bindingKey: key }); setPickerForId(null); }}
        onClose={() => setPickerForId(null)}
      />

      <CanvasStreakStyleModal
        visible={!!styleItem && styleItem.componentType === 'streakTile'}
        style={(styleItem && styleItem.componentType === 'streakTile' ? styleItem.style : DEFAULT_STREAK_TILE_STYLE) as StreakTileStyle}
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...styleItem.style, ...patch } }); }}
        onSetTierColor={(i, color) => {
          if (!styleItem || styleItem.componentType !== 'streakTile') return;
          const next = { ...(styleItem.style as StreakTileStyle).tierColorOverrides };
          if (color) next[i] = color; else delete next[i];
          updateItem(styleItem.id, { style: { ...styleItem.style, tierColorOverrides: next } });
        }}
        onClose={() => setStyleForId(null)}
      />

      <CanvasCountdownStyleModal
        visible={!!styleItem && styleItem.componentType === 'countdownTile'}
        style={(styleItem && styleItem.componentType === 'countdownTile' ? styleItem.style : DEFAULT_COUNTDOWN_TILE_STYLE) as CountdownTileStyle}
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...styleItem.style, ...patch } }); }}
        onClose={() => setStyleForId(null)}
      />
    </View>
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
}));
