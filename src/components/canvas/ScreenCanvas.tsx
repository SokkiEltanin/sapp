import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, LayoutChangeEvent } from 'react-native';
import { Pencil, Check, Plus, LayoutGrid } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';
import { useAllStreakItems } from '@/hooks/useAllStreakItems';
import { StreakItem } from '@/components/dashboard/StreakWallCard';
import { navigateForStreakItem } from '@/components/dashboard/StreakTile';
import { useCanvasComponentsStore } from '@/store/canvasComponentsStore';
import { DEFAULT_STREAK_TILE_STYLE } from '@/store/streakTileStyleStore';
import CanvasPlacedItem from './CanvasPlacedItem';
import MetricPickerModal from './MetricPickerModal';
import CanvasStreakStyleModal from './CanvasStreakStyleModal';

const MIN_CANVAS_HEIGHT = 140;
const EDIT_BOTTOM_PAD = 76; // miejsce na przycisk "Dodaj" pod najniższą instancją

// Wolne płótno (system kopiowania komponentów, Faza 15, §341) — user: "chce dosłownie tam od
// zera zbudować z przesunięciem podpięcia itp", doprecyzowane: Figma/Canva-style (swobodna
// pozycja/rozmiar, nakładanie dozwolone), tapnięcie na kafel otwiera picker metryki. Jeden
// ekran = jeden `screenKey` (np. `'food'`) — każdy ekran dostaje WŁASNĄ, niezależną listę
// instancji; kopiowanie "między ekranami" (user: "woda z dashboardu → słodycze w Jedzeniu")
// nie przenosi literalnie obiektu z dashboardu (dashboard nie ma tu swoich instancji — jego
// "Twoje serie" to wciąż osobny, sztywny `StreakWallCard`), tylko daje TEN SAM komponent
// (`StreakTile`) i TĘ SAMĄ listę metryk do wyboru — efekt dla usera identyczny (kafel wody
// wygląda i działa tak samo gdziekolwiek go postawi), bez potrzeby osobnego mechanizmu
// "wklejania" skopiowanego node'a.
//
// Tryb podglądu (editing=false): statyczne kafle, tapnięcie nawiguje jak na dashboardzie
// (`navigateForStreakItem`, współdzielone z `StreakWallCard`). Tryb edycji: przeciąganie/
// zmiana rozmiaru/usuwanie (`CanvasPlacedItem`), przycisk "Dodaj", tapnięcie otwiera picker
// metryki. Jeden typ komponentu na razie (`'streakTile'`) — patrz `canvasComponentsStore.ts`.
export default function ScreenCanvas({ screenKey, title }: { screenKey: string; title?: string }) {
  const c = useColors();
  const s = makeS(c);
  const [editing, setEditing] = useState(false);
  const [canvasWidth, setCanvasWidth] = useState(320);
  const [pickerForId, setPickerForId] = useState<string | null>(null);
  const [styleForId, setStyleForId] = useState<string | null>(null);

  const allItems = useCanvasComponentsStore(st => st.items);
  const addItem = useCanvasComponentsStore(st => st.addItem);
  const updateItem = useCanvasComponentsStore(st => st.updateItem);
  const removeItem = useCanvasComponentsStore(st => st.removeItem);
  const myItems = useMemo(() => allItems.filter(i => i.screenKey === screenKey), [allItems, screenKey]);

  const allStreakItems = useAllStreakItems();
  const pickerItem = myItems.find(i => i.id === pickerForId) ?? null;
  const styleItem = myItems.find(i => i.id === styleForId) ?? null;

  const canvasHeight = Math.max(
    MIN_CANVAS_HEIGHT,
    ...myItems.map(i => i.y + i.height),
  ) + (editing ? EDIT_BOTTOM_PAD : spacing[4]);

  const onLayout = (e: LayoutChangeEvent) => setCanvasWidth(e.nativeEvent.layout.width);

  const onAdd = () => {
    haptic.tap();
    const id = addItem(screenKey, 'streakTile');
    setPickerForId(id);
  };

  return (
    <View style={s.wrap}>
      <View style={s.header}>
        <LayoutGrid size={13} color={c.text.secondary} />
        <Text style={s.title}>{title ?? 'Twoje komponenty'}</Text>
        <View style={{ flex: 1 }} />
        <TouchableOpacity onPress={() => { haptic.tap(); setEditing(v => !v); }}
          style={[s.editBtn, editing && { borderColor: c.accent.blue, backgroundColor: c.accent.blue + '18' }]}>
          {editing ? <Check size={13} color={c.accent.blue} /> : <Pencil size={13} color={c.text.secondary} />}
          <Text style={[s.editTxt, editing && { color: c.accent.blue }]}>{editing ? 'Gotowe' : 'Edytuj'}</Text>
        </TouchableOpacity>
      </View>

      {myItems.length === 0 && !editing && (
        <Text style={s.hintText}>
          Brak własnych komponentów tutaj. Włącz edycję, żeby dodać kafel serii z inną metryką —
          np. ten sam kafel co na dashboardzie, przepięty na inny nawyk albo licznik.
        </Text>
      )}

      <View onLayout={onLayout} style={[s.canvas, { height: canvasHeight, borderColor: editing ? c.accent.blue + '55' : c.border.subtle }]}>
        {myItems.map(item => {
          const bound = item.bindingKey ? allStreakItems.find(x => x.key === item.bindingKey) ?? null : null;
          const displayItem: StreakItem = bound ?? { key: item.id, name: 'Wybierz metrykę', days: 0 };
          return (
            <CanvasPlacedItem
              key={item.id}
              item={item}
              displayItem={displayItem}
              tileStyle={item.style}
              editing={editing}
              canvasWidth={canvasWidth}
              onTap={() => {
                if (editing) { setPickerForId(item.id); return; }
                if (bound) navigateForStreakItem(bound, item.style);
                else setPickerForId(item.id);
              }}
              onDelete={() => removeItem(item.id)}
              onMove={(x, y) => updateItem(item.id, { x, y })}
              onResize={(width, height) => updateItem(item.id, { width, height })}
              onStyle={() => setStyleForId(item.id)}
            />
          );
        })}
      </View>

      {editing && (
        <>
          <TouchableOpacity onPress={onAdd} style={[s.addBtn, { backgroundColor: c.accent.blue }]} activeOpacity={0.85}>
            <Plus size={15} color="#fff" />
            <Text style={s.addTxt}>Dodaj kafel serii</Text>
          </TouchableOpacity>
          {/* Podpowiedź (2026-10-16, Faza 16) — mechanizm (przeciąganie/zmiana rozmiaru w rogu/
              tapnięcie/dwa małe przyciski) jest zupełnie nowy w appce, bez tego user nie ma
              żadnego sposobu się domyślić co robić z kaflem po jego dodaniu. */}
          <Text style={s.hintText}>
            Przeciągnij kafel, żeby go przesunąć · uchwyt w rogu zmienia rozmiar · tapnięcie
            wybiera metrykę · 🎨 styl, 🗑 usuń.
          </Text>
        </>
      )}

      <MetricPickerModal
        visible={!!pickerItem}
        options={allStreakItems}
        currentKey={pickerItem?.bindingKey ?? null}
        onSelect={(key) => { if (pickerItem) updateItem(pickerItem.id, { bindingKey: key }); setPickerForId(null); }}
        onClose={() => setPickerForId(null)}
      />

      <CanvasStreakStyleModal
        visible={!!styleItem}
        style={styleItem?.style ?? DEFAULT_STREAK_TILE_STYLE}
        onChange={(patch) => { if (styleItem) updateItem(styleItem.id, { style: { ...styleItem.style, ...patch } }); }}
        onSetTierColor={(i, color) => {
          if (!styleItem) return;
          const next = { ...styleItem.style.tierColorOverrides };
          if (color) next[i] = color; else delete next[i];
          updateItem(styleItem.id, { style: { ...styleItem.style, tierColorOverrides: next } });
        }}
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
