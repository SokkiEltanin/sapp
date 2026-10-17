import { useEffect, ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Move, Trash2, Palette, Link2Off, CircleCheck } from 'lucide-react-native';
import { CanvasItem } from '@/store/canvasComponentsStore';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

const MIN_WIDTH = 90;
const MIN_HEIGHT = 64;

// Przeciąganie/zmiana rozmiaru na wolnym płótnie (system kopiowania komponentów, Faza 15,
// §341) — ten sam wzorzec gestów co `DashEditRow.tsx` (`Gesture.Pan()` + `useSharedValue` +
// `runOnJS` commitujący pozycję do store'u TYLKO na `onEnd`, nie na każdej ramce — unika
// zalewu renderów Zustand podczas przeciągania). Różnica od `DashEditRow`: tam ruch jest
// 1-wymiarowy i snapuje do siatki wierszy (reorder listy); tutaj ruch jest WOLNY 2D (user:
// "wolne płótno jak Figma/Canva" — żadnego snapowania, elementy mogą się nakładać).
//
// `renderTile` (Faza 17, 2026-10-17, drugi `componentType`) — TEN komponent nie wie NIC o
// `StreakTile`/`CountdownTile`/przyszłych typach, tylko o geście/pozycji/rozmiarze/chrome
// (uchwyty, przyciski). Caller (`ScreenCanvas.tsx`) decyduje CO narysować w środku, w zależności
// od `item.componentType` — dokładnie ten sam powód co `onPress`/`sizeStyle` jako propy w
// `StreakTile` samym (§340): jeden komponent gestów/chrome, wymienna treść.
//
// Dwie gałęzie renderu: `editing=false` to zwykły, statyczny `View` (zero Reanimated/gestów —
// taniej na ekranie, który user odwiedza głównie żeby PATRZEĆ, nie edytować). `editing=true`
// dokłada: uchwyt przeciągania (CAŁY obszar kafla — tapnięcie bez ruchu otwiera picker metryki,
// patrz `Gesture.Race` niżej), uchwyt zmiany rozmiaru (róg), przyciski styl/usuń.
export default function CanvasPlacedItem({
  item, editing, canvasWidth, onTap, onDelete, onMove, onResize, onStyle, renderTile,
  selectMode = false, selected = false, onToggleSelect, grouped = false, onUngroup,
}: {
  item: CanvasItem;
  editing: boolean;
  canvasWidth: number;
  onTap: () => void;
  onDelete: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onStyle: () => void;
  renderTile: (sizeStyle: StyleProp<ViewStyle>, onPress: () => void) => ReactNode;
  // Grupowanie (§349) — `selectMode` zamienia CAŁY tryb edycji na "tapnij żeby zaznaczyć do
  // grupy" (zero przeciągania/resize/stylu/usuwania — zapobiega przypadkowej edycji podczas
  // zaznaczania wielu itemów naraz). `grouped`/`onUngroup` — normalny tryb edycji, ale item
  // należy do grupy: inny kolor ramki + trzeci mały przycisk "Rozgrupuj".
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  grouped?: boolean;
  onUngroup?: () => void;
}) {
  const c = useColors();
  const tx = useSharedValue(item.x);
  const ty = useSharedValue(item.y);
  const w = useSharedValue(item.width);
  const h = useSharedValue(item.height);
  // Store może się zmienić spod nas (np. "Domyślne"/cofnij w przyszłości, albo hydracja z
  // AsyncStorage po montażu) — trzymaj shared values zsynchronizowane z prawdą ze store'u.
  useEffect(() => { tx.value = item.x; ty.value = item.y; }, [item.x, item.y]);
  useEffect(() => { w.value = item.width; h.value = item.height; }, [item.width, item.height]);

  const dragStart = useSharedValue({ x: 0, y: 0 });
  const dragGesture = Gesture.Pan()
    .minDistance(4)
    .onStart(() => { dragStart.value = { x: tx.value, y: ty.value }; })
    .onUpdate((e) => {
      tx.value = Math.max(0, Math.min(Math.max(0, canvasWidth - w.value), dragStart.value.x + e.translationX));
      ty.value = Math.max(0, dragStart.value.y + e.translationY);
    })
    .onEnd(() => { runOnJS(onMove)(tx.value, ty.value); });

  const tapGesture = Gesture.Tap().onEnd(() => { runOnJS(onTap)(); });
  const moveOrTap = Gesture.Race(dragGesture, tapGesture);
  const selectTapGesture = Gesture.Tap().onEnd(() => { if (onToggleSelect) runOnJS(onToggleSelect)(); });

  const resizeStart = useSharedValue({ w: 0, h: 0 });
  const resizeGesture = Gesture.Pan()
    .onStart(() => { resizeStart.value = { w: w.value, h: h.value }; })
    .onUpdate((e) => {
      w.value = Math.max(MIN_WIDTH, Math.min(canvasWidth - tx.value, resizeStart.value.w + e.translationX));
      h.value = Math.max(MIN_HEIGHT, resizeStart.value.h + e.translationY);
    })
    .onEnd(() => { runOnJS(onResize)(w.value, h.value); });

  const boxStyle = useAnimatedStyle(() => ({
    position: 'absolute', left: tx.value, top: ty.value, width: w.value, height: h.value,
  }));

  if (!editing) {
    return (
      <View style={{ position: 'absolute', left: item.x, top: item.y, width: item.width, height: item.height }}>
        {renderTile({ width: '100%', height: '100%' }, onTap)}
      </View>
    );
  }

  // Tryb zaznaczania do grupy (§349) — ZUPEŁNIE osobna, uproszczona gałąź renderu: bez
  // przeciągania/resize/stylu/usuwania (user zaznacza WIELE itemów szybko po sobie, żadna z
  // tych akcji nie ma tu sensu i tylko ryzykowałaby przypadkowe wywołanie). Sam tap przełącza
  // zaznaczenie — kropka z checkiem w rogu pokazuje stan.
  if (selectMode) {
    return (
      <Reanimated.View style={[boxStyle, s.editingWrap, { borderColor: selected ? c.accent.purple : c.border.default, borderStyle: selected ? 'solid' : 'dashed' }]}>
        <View pointerEvents="none" style={[{ flex: 1 }, selected && { opacity: 0.55 }]}>
          {renderTile({ width: '100%', height: '100%' }, () => {})}
        </View>
        <GestureDetector gesture={selectTapGesture}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
        <View pointerEvents="none" style={[s.selectBadge, selected && { backgroundColor: c.accent.purple }]}>
          {selected && <CircleCheck size={14} color="#fff" />}
        </View>
      </Reanimated.View>
    );
  }

  // `pointerEvents="none"` na kaflu (2026-10-16) — w trybie edycji treść jest TYLKO wizualna,
  // cały dotyk łapie przezroczysty overlay z `GestureDetector` poniżej. Bez tego wewnętrzny
  // `TouchableOpacity` kafla (własny responder dotyku RN) konkurowałby z `Gesture.Race` o to
  // samo dotknięcie — dwa niezależne systemy obsługi gestów na tym samym elemencie, realne
  // źródło "czasem łapie, czasem nie" na urządzeniu.
  return (
    <Reanimated.View style={[boxStyle, s.editingWrap, { borderColor: grouped ? c.accent.purple : c.accent.blue }]}>
      <View pointerEvents="none" style={{ flex: 1 }}>
        {renderTile({ width: '100%', height: '100%' }, () => {})}
      </View>
      <GestureDetector gesture={moveOrTap}>
        <View style={StyleSheet.absoluteFill} />
      </GestureDetector>
      <View pointerEvents="none" style={[s.dragHint, { backgroundColor: grouped ? c.accent.purple : c.accent.blue }]}>
        <Move size={10} color="#fff" />
      </View>
      <View style={s.topBtns}>
        {grouped && (
          <TouchableOpacity onPress={() => { haptic.tap(); onUngroup?.(); }} style={[s.smallBtn, { backgroundColor: c.accent.purple }]} hitSlop={8}>
            <Link2Off size={12} color="#fff" />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => { haptic.tap(); onStyle(); }} style={[s.smallBtn, { backgroundColor: c.accent.blue }]} hitSlop={8}>
          <Palette size={12} color="#fff" />
        </TouchableOpacity>
        <TouchableOpacity onPress={() => { haptic.medium(); onDelete(); }} style={[s.smallBtn, { backgroundColor: c.accent.red }]} hitSlop={8}>
          <Trash2 size={12} color="#fff" />
        </TouchableOpacity>
      </View>
      <GestureDetector gesture={resizeGesture}>
        <View style={[s.resizeHandle, { backgroundColor: grouped ? c.accent.purple : c.accent.blue }]} />
      </GestureDetector>
    </Reanimated.View>
  );
}

const s = StyleSheet.create({
  editingWrap: { borderWidth: 2, borderStyle: 'dashed', borderRadius: 10 },
  dragHint: { position: 'absolute', left: 4, top: 4, width: 18, height: 18, borderRadius: 9, alignItems: 'center', justifyContent: 'center' },
  selectBadge: {
    position: 'absolute', right: 6, top: 6, width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#fff', backgroundColor: 'rgba(0,0,0,0.35)',
    alignItems: 'center', justifyContent: 'center',
  },
  topBtns: { position: 'absolute', right: 4, top: 4, flexDirection: 'row', gap: 4 },
  smallBtn: { width: 22, height: 22, borderRadius: 11, alignItems: 'center', justifyContent: 'center' },
  resizeHandle: {
    position: 'absolute', right: -6, bottom: -6, width: 22, height: 22, borderRadius: 11,
    borderWidth: 2, borderColor: '#fff',
  },
});
