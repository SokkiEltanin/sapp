import { useRef, useState } from 'react';
import { View, StyleSheet, LayoutChangeEvent } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Gesture, GestureDetector, GestureHandlerRootView } from 'react-native-gesture-handler';
import { runOnJS } from 'react-native-reanimated';
import { Hsv, hexToHsv, hsvToHex } from '@/utils/color';
import { radius } from '@/theme';

// Wizualny piker koloru — panel nasycenie/jasność + pasek odcienia, jak w Figmie/Canvie (Faza
// §388, user: "jak wybieram customowy kolor... żebym miał paletę taką a nie wpisywał tylko
// HEX xd i żeby wybrany kolor się pokazywał"). Dotąd `ColorSwatchPicker.tsx` miało TYLKO goły
// `TextInput` na hex (+ mały podgląd-kółko) — ten panel renderuje się NAD nim, jako dodatkowy,
// szybszy sposób wyboru; `TextInput` zostaje (precyzyjne wpisanie znanej wartości).
//
// `onChange` woła się NA ŻYWO na każdym kroku przeciągania (nie dopiero na `onEnd`, w
// przeciwieństwie do przeciągania itemów na płótnie w `CanvasPlacedItem.tsx`) — tam batching na
// `onEnd` chroni przed zalewem Zustand store'u przy przeliczaniu POZYCJI WSZYSTKICH sąsiadów co
// klatkę; tu `onChange` to pojedyncze ustawienie jednego stringa w stylu JEDNEGO itemu, więc
// żywy feedback na docelowym elemencie (dokładnie to, o co user prosił) jest tani i pożądany.
//
// Matematyka HSV↔HEX żyje w `color.ts` (pure, testowalne) — gesty tutaj liczą TYLKO surowe h/s/v
// (arytmetyka, bez wywołań zaimportowanych funkcji w workletcie, ta sama ostrożność co
// `clampItemX`/snap w `CanvasPlacedItem.tsx`) i oddają je przez `runOnJS` do `commit()` (zwykła
// funkcja JS w tym komponencie), która dopiero tam woła `hsvToHex`.
//
// `GestureHandlerRootView` WEWNĄTRZ tego komponentu (nie tylko w `app/_layout.tsx`) — ten panel
// żyje ZAWSZE wewnątrz jakiegoś natywnego `Modal` (wszystkie modale stylu płótna), a `Modal`
// portuje swoją treść do OSOBNEJ natywnej hierarchii, poza zasięgiem jedynego roota w
// `_layout.tsx` (udokumentowany bug/fix, ARCHITECTURE.md §162 — `MoodCheckInModal.tsx` ten sam
// wzorzec). Własny root tutaj = działa poprawnie niezależnie od tego, w którym Modalu wyląduje.
const SQUARE_SIZE = 150;
const HUE_HEIGHT = 22;
const THUMB = 18;

const HUE_STOPS = ['#FF0000', '#FFFF00', '#00FF00', '#00FFFF', '#0000FF', '#FF00FF', '#FF0000'];

export default function ColorPickerPanel({ value, onChange }: {
  value: string;
  onChange: (hex: string) => void;
}) {
  const lastEmitted = useRef<string | null>(null);
  const [hsv, setHsv] = useState<Hsv>(() => hexToHsv(value));
  // Zewnętrzna zmiana `value` (np. user wybrał preset/kolor z biblioteki/wpisał hex ręcznie) —
  // przelicz. Pomijamy, gdy `value` to dokładnie to, co SAMI ostatnio wyemitowaliśmy (inaczej
  // przeciąganie samego panelu resetowałoby `h` przy s=0, bo hex->hsv dla szarości/bieli/czerni
  // nie ma zdefiniowanego odcienia — patrz `hexToHsv` w `color.ts`).
  if (value !== lastEmitted.current && hsvToHex(hsv.h, hsv.s, hsv.v) !== value) {
    setHsv(hexToHsv(value));
  }

  const [sqW, setSqW] = useState(0);
  const [hueW, setHueW] = useState(0);

  const commit = (patch: Partial<Hsv>) => {
    const next = { ...hsv, ...patch };
    setHsv(next);
    const hex = hsvToHex(next.h, next.s, next.v);
    lastEmitted.current = hex;
    onChange(hex);
  };

  const onSqLayout = (e: LayoutChangeEvent) => setSqW(e.nativeEvent.layout.width);
  const onHueLayout = (e: LayoutChangeEvent) => setHueW(e.nativeEvent.layout.width);

  const sqGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      if (sqW <= 0) return;
      const ns = Math.max(0, Math.min(1, e.x / sqW));
      const nv = 1 - Math.max(0, Math.min(1, e.y / SQUARE_SIZE));
      runOnJS(commit)({ s: ns, v: nv });
    })
    .onUpdate((e) => {
      if (sqW <= 0) return;
      const ns = Math.max(0, Math.min(1, e.x / sqW));
      const nv = 1 - Math.max(0, Math.min(1, e.y / SQUARE_SIZE));
      runOnJS(commit)({ s: ns, v: nv });
    });

  const hueGesture = Gesture.Pan()
    .minDistance(0)
    .onBegin((e) => {
      if (hueW <= 0) return;
      const nh = Math.max(0, Math.min(1, e.x / hueW)) * 360;
      runOnJS(commit)({ h: nh });
    })
    .onUpdate((e) => {
      if (hueW <= 0) return;
      const nh = Math.max(0, Math.min(1, e.x / hueW)) * 360;
      runOnJS(commit)({ h: nh });
    });

  const pureHue = hsvToHex(hsv.h, 1, 1);
  const thumbX = hsv.s * sqW;
  const thumbY = (1 - hsv.v) * SQUARE_SIZE;
  const hueThumbX = (hsv.h / 360) * hueW;

  return (
    <GestureHandlerRootView style={s.root}>
      <View style={[s.square, { backgroundColor: pureHue }]} onLayout={onSqLayout}>
        <LinearGradient colors={['#FFFFFF', '#FFFFFF00']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <LinearGradient colors={['#00000000', '#000000']} start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }} style={StyleSheet.absoluteFill} />
        <GestureDetector gesture={sqGesture}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
        {sqW > 0 && (
          <View pointerEvents="none" style={[s.thumb, { left: thumbX - THUMB / 2, top: thumbY - THUMB / 2, backgroundColor: hsvToHex(hsv.h, hsv.s, hsv.v) }]} />
        )}
      </View>

      <View style={s.hueBar} onLayout={onHueLayout}>
        <LinearGradient colors={HUE_STOPS as unknown as [string, string, ...string[]]} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
        <GestureDetector gesture={hueGesture}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>
        {hueW > 0 && (
          <View pointerEvents="none" style={[s.hueThumb, { left: hueThumbX - THUMB / 2, backgroundColor: pureHue }]} />
        )}
      </View>
    </GestureHandlerRootView>
  );
}

const s = StyleSheet.create({
  root: { gap: 8 },
  square: { height: SQUARE_SIZE, borderRadius: radius.lg, overflow: 'hidden' },
  thumb: {
    position: 'absolute', width: THUMB, height: THUMB, borderRadius: THUMB / 2,
    borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
  hueBar: { height: HUE_HEIGHT, borderRadius: HUE_HEIGHT / 2, overflow: 'hidden' },
  hueThumb: {
    position: 'absolute', top: 2, width: THUMB, height: HUE_HEIGHT - 4, borderRadius: (HUE_HEIGHT - 4) / 2,
    borderWidth: 3, borderColor: '#fff', shadowColor: '#000', shadowOpacity: 0.4, shadowRadius: 3, shadowOffset: { width: 0, height: 1 }, elevation: 3,
  },
});
