import { useEffect, ReactNode } from 'react';
import { View, StyleSheet, TouchableOpacity, StyleProp, ViewStyle } from 'react-native';
import Reanimated, { useSharedValue, useAnimatedStyle, runOnJS, SharedValue } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { Move, Trash2, Palette, SlidersHorizontal, CircleCheck } from 'lucide-react-native';
import { CanvasItem, MIN_ITEM_WIDTH, MIN_ITEM_HEIGHT } from '@/store/canvasComponentsStore';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

const MIN_WIDTH = MIN_ITEM_WIDTH;
const MIN_HEIGHT = MIN_ITEM_HEIGHT;

// Przeciąganie/zmiana rozmiaru na wolnym płótnie (system kopiowania komponentów, Faza 15,
// §341) — ten sam wzorzec gestów co `DashEditRow.tsx` (`Gesture.Pan()` + `useSharedValue` +
// `runOnJS` commitujący pozycję do store'u TYLKO na `onEnd`, nie na każdej ramce — unika
// zalewu renderów Zustand podczas przeciągania). Różnica od `DashEditRow`: tam ruch jest
// 1-wymiarowy i snapuje do siatki wierszy (reorder listy); tutaj ruch jest WOLNY 2D (user:
// "wolne płótno jak Figma/Canva" — elementy mogą się nakładać, pozycja NIE jest ograniczona do
// siatki). Smart guides (§372, niżej w `dragGesture.onUpdate`) dodają MIĘKKIE snapowanie do
// krawędzi/centrum sąsiadów podczas przeciągania — user wciąż może przeciągnąć gdziekolwiek
// (nakładanie zostaje możliwe), snap tylko "przyciąga" w promieniu kilku pikseli, jak w Figmie.
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
  item, editing, canvasWidth, allRects, guides, onTap, onDelete, onMove, onResize, onStyle, onProperties, renderTile,
  selectMode = false, selected = false, onToggleSelect, grouped = false,
}: {
  item: CanvasItem;
  editing: boolean;
  canvasWidth: number;
  // Smart guides (§372) — geometria WSZYSTKICH itemów tego ekranu (siebie samego filtrujemy
  // niżej po `id`) + WSPÓLNA shared value z `ScreenCanvas.tsx`, do której TYLKO ten item pisze
  // PODCZAS WŁASNEGO przeciągania (patrz `dragGesture.onUpdate` niżej) — reszta instancji
  // dostaje TĘ SAMĄ referencję, ale nigdy do niej nie pisze, kiedy to nie ONA jest przeciągana.
  allRects: { id: string; x: number; y: number; width: number; height: number }[];
  guides: SharedValue<{ vx: number | null; vy1: number; vy2: number; hy: number | null; hx1: number; hx2: number }>;
  onTap: () => void;
  onDelete: () => void;
  onMove: (x: number, y: number) => void;
  onResize: (width: number, height: number) => void;
  onStyle: () => void;
  // Panel właściwości (Faza 28, §359, przeniesione z dedykowanego przycisku "Rozgrupuj" —
  // rozgrupowanie teraz żyje WEWNĄTRZ tego panelu, patrz `CanvasPropertiesModal.tsx`) —
  // X/Y/W/H numerycznie + warstwy (na wierzch/spód) + rozgrupuj, jeden wspólny panel dla
  // WSZYSTKICH typów (w przeciwieństwie do 🎨 stylu, który jest per-typ).
  onProperties: () => void;
  renderTile: (sizeStyle: StyleProp<ViewStyle>, onPress: () => void) => ReactNode;
  // Grupowanie (§349) — `selectMode` zamienia CAŁY tryb edycji na "tapnij żeby zaznaczyć do
  // grupy" (zero przeciągania/resize/stylu/usuwania — zapobiega przypadkowej edycji podczas
  // zaznaczania wielu itemów naraz). `grouped` — normalny tryb edycji, ale item należy do grupy:
  // inny kolor ramki (akcja rozgrupuj przeniesiona do panelu właściwości, §359).
  selectMode?: boolean;
  selected?: boolean;
  onToggleSelect?: () => void;
  grouped?: boolean;
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

  // Smart guides (§372) — geometria sąsiadów jako shared value (nie prop bezpośrednio — gesty
  // Reanimated czytają TYLKO ze shared values, nigdy z propsów/closure JS na UI thread), ten
  // sam wzorzec synchronizacji co `tx`/`ty`/`w`/`h` wyżej.
  const rectsShared = useSharedValue(allRects);
  useEffect(() => { rectsShared.value = allRects; }, [allRects]);

  const dragStart = useSharedValue({ x: 0, y: 0 });
  const dragGesture = Gesture.Pan()
    .minDistance(4)
    .onStart(() => { dragStart.value = { x: tx.value, y: ty.value }; })
    .onUpdate((e) => {
      const rawX = Math.max(0, Math.min(Math.max(0, canvasWidth - w.value), dragStart.value.x + e.translationX));
      const rawY = Math.max(0, dragStart.value.y + e.translationY);

      // Snapowanie do krawędzi/centrum sąsiadów (§372, user: "SNAPOWANIE do centrum
      // obiektu... jak w Figmie") — INLINE w tym workletcie (NIE importowana funkcja — ta
      // sama, świadoma ostrożność co przy `clampItemX` niżej w tym pliku/`canvasComponentsStore.
      // ts`: wywołanie zaimportowanej funkcji z workletu wymagałoby poprawnego "workletyzowania"
      // przez babel, niesprawdzone na tym etapie Reanimated 4/New Architecture w tym projekcie —
      // patrz identyczny komentarz przy `clampItemX`). PIERWSZY dopasowany próg (lewa/środek/
      // prawa, góra/środek/dół) WYGRYWA, nie najbliższy — prosta, przewidywalna reguła.
      const THRESH = 6;
      const myW = w.value, myH = h.value;
      const sibs = rectsShared.value.filter((r) => r.id !== item.id);

      let vx: number | null = null, vy1 = 0, vy2 = 0;
      let snapDX = 0;
      for (let i = 0; i < sibs.length; i++) {
        const r = sibs[i];
        const myLeft = rawX, myRight = rawX + myW, myCenter = rawX + myW / 2;
        const sLeft = r.x, sRight = r.x + r.width, sCenter = r.x + r.width / 2;
        let at: number | null = null, dx = 0;
        if (Math.abs(myLeft - sLeft) < THRESH) { at = sLeft; dx = sLeft - myLeft; }
        else if (Math.abs(myCenter - sCenter) < THRESH) { at = sCenter; dx = sCenter - myCenter; }
        else if (Math.abs(myRight - sRight) < THRESH) { at = sRight; dx = sRight - myRight; }
        if (at != null) {
          vx = at; snapDX = dx;
          vy1 = Math.min(rawY, r.y); vy2 = Math.max(rawY + myH, r.y + r.height);
          break;
        }
      }

      let hy: number | null = null, hx1 = 0, hx2 = 0;
      let snapDY = 0;
      for (let i = 0; i < sibs.length; i++) {
        const r = sibs[i];
        const myTop = rawY, myBottom = rawY + myH, myCenter = rawY + myH / 2;
        const sTop = r.y, sBottom = r.y + r.height, sCenter = r.y + r.height / 2;
        let at: number | null = null, dy = 0;
        if (Math.abs(myTop - sTop) < THRESH) { at = sTop; dy = sTop - myTop; }
        else if (Math.abs(myCenter - sCenter) < THRESH) { at = sCenter; dy = sCenter - myCenter; }
        else if (Math.abs(myBottom - sBottom) < THRESH) { at = sBottom; dy = sBottom - myBottom; }
        if (at != null) {
          hy = at; snapDY = dy;
          hx1 = Math.min(rawX, r.x); hx2 = Math.max(rawX + myW, r.x + r.width);
          break;
        }
      }

      // Re-klamrowanie PO snapie (bezpiecznik) — snap do centrum/krawędzi sąsiada w teorii
      // mógłby przesunąć o kilka px poza granicę płótna (np. sąsiad szerszy/węższy niż
      // przeciągany item, snap na centrum) — ten sam zakres co `rawX`/`rawY` wyżej.
      const snappedX = vx != null ? rawX + snapDX : rawX;
      const snappedY = hy != null ? rawY + snapDY : rawY;
      tx.value = Math.max(0, Math.min(Math.max(0, canvasWidth - myW), snappedX));
      ty.value = Math.max(0, snappedY);
      guides.value = { vx, vy1, vy2, hy, hx1, hx2 };
    })
    .onEnd(() => {
      guides.value = { vx: null, vy1: 0, vy2: 0, hy: null, hx1: 0, hx2: 0 };
      runOnJS(onMove)(tx.value, ty.value);
    });

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
        <TouchableOpacity onPress={() => { haptic.tap(); onProperties(); }} style={[s.smallBtn, { backgroundColor: grouped ? c.accent.purple : c.bg.elevated, borderWidth: grouped ? 0 : 1, borderColor: c.border.default }]} hitSlop={8}>
          <SlidersHorizontal size={12} color={grouped ? '#fff' : c.text.secondary} />
        </TouchableOpacity>
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
