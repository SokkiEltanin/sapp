import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MoodLevel, MOOD_LABELS, MOOD_COLORS, ENERGY_LABELS } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// Siatka nastrój×energia (2026-09-19, redesign check-inu humoru) — user: "za bardzo nie
// zawsze da się szybko kliknąć potem jeszcze tag" → wybrał zamianę DWÓCH osobnych rzędów
// przycisków (MoodPicker×2, po 5 tapnięć każdy z osobna) na JEDNĄ siatkę 5×5, gdzie jedno
// tapnięcie/przeciągnięcie ustawia OBA wymiary naraz. Oś X = nastrój (lewo=gorzej, prawo=
// lepiej), oś Y = energia (dół=mniej, góra=więcej) — układ jak "circumplex model of affect"
// z psychologii (walencja pozioma, pobudzenie pionowe), nie wymyślony od zera.
//
// Statyczne podpisy PRZY KAŻDEJ komórce user ocenił jako "słabe" (mniej ważne niż samo
// zbicie liczby kroków) — zamiast tego jest JEDEN, żywy odczyt pod siatką
// ("{emoji} {etykieta} · {emoji} {etykieta}"), który aktualizuje się na bieżąco podczas
// przeciągania — to i tak mocniej odpowiada na "nie wiadomo co zaznaczam" niż 25 małych
// podpisów naraz (więcej wizualnego szumu, nie mniej).
//
// Gest: pojedynczy `Gesture.Pan()` z `minDistance(0)` obsługuje ZARÓWNO zwykły tap (pan bez
// ruchu) JAK I przeciągnięcie po siatce jednym ruchem palca — nie trzeba osobnego Tap+Pan.
// `lastKey` (reanimated shared value) pilnuje żeby `runOnJS`/haptyka odpaliły się tylko przy
// FAKTYCZNEJ zmianie komórki, nie na każdą klatkę ruchu palca (~60/s).

const MOOD_EMOJIS: Record<MoodLevel, string> = { 1: '😩', 2: '😕', 3: '😐', 4: '😊', 5: '🤩' };
const ENERGY_EMOJIS: Record<MoodLevel, string> = { 1: '😴', 2: '😌', 3: '⚡', 4: '✨', 5: '🚀' };
const LEVELS: MoodLevel[] = [1, 2, 3, 4, 5];

interface Props {
  mood?: MoodLevel;
  energy?: MoodLevel;
  onChange: (mood: MoodLevel, energy: MoodLevel) => void;
}

export default function MoodEnergyGrid({ mood, energy, onChange }: Props) {
  const c = useColors();
  const styles = useMemo(() => makeStyles(c), [c]);
  const [gridSize, setGridSize] = useState(0);
  const lastKey = useSharedValue(-1);

  const commit = (m: MoodLevel, e: MoodLevel) => {
    haptic.medium();
    onChange(m, e);
  };

  // POTWIERDZONY BUG na urządziu (2026-09-22 → nadal "Nie dziala" po pierwszym fixie,
  // 2026-09-23): DWIE osobne przyczyny nałożone na siebie.
  // (1) siatka siedziała wewnątrz zwykłego `ScrollView` z 'react-native' w
  //     MoodCheckInModal.tsx, który wygrywał odpowiedź na dotyk zanim `Gesture.Pan()` tej
  //     siatki zdążył się odpalić — naprawione, `ScrollView` tam przełączony na import z
  //     'react-native-gesture-handler'.
  // (2) TA sama siatka żyje wewnątrz natywnego `Modal` z 'react-native', który portuje swoją
  //     zawartość do OSOBNEJ natywnej hierarchii (nowe okno na Androidzie / osobny kontroler
  //     na iOS) — poza drzewem, które jedyny `GestureHandlerRootView` (app/_layout.tsx)
  //     opakowuje. Bez WŁASNEGO roota wewnątrz Modala `Gesture.Pan()` nigdy nie dostawał
  //     poprawnie routowanych dotknięć niezależnie od (1) — naprawione w
  //     MoodCheckInModal.tsx dodaniem zagnieżdżonego `GestureHandlerRootView` tuż wewnątrz
  //     `<Modal>`.
  const pan = useMemo(() => Gesture.Pan()
    .minDistance(0)
    .onUpdate(evt => {
      'worklet';
      if (gridSize <= 0) return;
      const cell = gridSize / 5;
      const col = Math.min(4, Math.max(0, Math.floor(evt.x / cell)));
      const row = Math.min(4, Math.max(0, Math.floor(evt.y / cell)));
      const key = row * 5 + col;
      if (key !== lastKey.value) {
        lastKey.value = key;
        runOnJS(commit)((col + 1) as MoodLevel, (5 - row) as MoodLevel);
      }
    }),
  [gridSize]);

  // Kropka-wskaźnik animowana w PIKSELACH (nie indeksach) — prościej i spójniej ze stylem
  // reszty pliku (`Animated` z 'react-native', jak w MoodPicker.tsx), bez węzłów `multiply`
  // tworzonych na nowo przy każdym renderze.
  const dotX = useRef(new Animated.Value(0)).current;
  const dotY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (gridSize <= 0) return;
    const cell = gridSize / 5;
    const col = mood ? mood - 1 : 2;
    const row = energy ? 5 - energy : 2;
    Animated.spring(dotX, { toValue: col * cell, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
    Animated.spring(dotY, { toValue: row * cell, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
  }, [mood, energy, gridSize]);

  const hasValue = !!mood && !!energy;
  const dotColor = mood ? MOOD_COLORS[mood] : c.text.muted;
  const cell = gridSize / 5;

  return (
    <View style={styles.container}>
      <Text style={styles.sectionLabel}>Nastrój i energia</Text>
      <Text style={styles.hint}>przeciągnij lub tapnij — w prawo lepszy nastrój, w górę więcej energii</Text>

      <View style={styles.gridWrap} onLayout={e => setGridSize(e.nativeEvent.layout.width)}>
        <LinearGradient
          colors={[c.bg.elevated, MOOD_COLORS[5] + '22']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={StyleSheet.absoluteFill}
        />
        <View style={StyleSheet.absoluteFill} pointerEvents="none">
          {LEVELS.slice(1).map(i => (
            <View key={`v${i}`} style={[styles.vLine, { left: `${(i - 1) * 20 + 20}%` }]} />
          ))}
          {LEVELS.slice(1).map(i => (
            <View key={`h${i}`} style={[styles.hLine, { top: `${(i - 1) * 20 + 20}%` }]} />
          ))}
        </View>

        <GestureDetector gesture={pan}>
          <View style={StyleSheet.absoluteFill} />
        </GestureDetector>

        {gridSize > 0 && (
          <Animated.View
            pointerEvents="none"
            style={[
              styles.dot,
              { width: cell, height: cell, transform: [{ translateX: dotX }, { translateY: dotY }] },
            ]}
          >
            <View style={[
              styles.dotInner,
              { borderColor: dotColor, backgroundColor: hasValue ? dotColor + '33' : c.bg.card },
            ]}>
              <Text style={styles.dotEmoji}>{mood ? MOOD_EMOJIS[mood] : '·'}</Text>
            </View>
          </Animated.View>
        )}
      </View>

      <Text style={[styles.readout, { color: hasValue ? dotColor : c.text.muted }]} numberOfLines={1}>
        {hasValue
          ? `${MOOD_EMOJIS[mood!]} ${MOOD_LABELS[mood!]}  ·  ${ENERGY_EMOJIS[energy!]} ${ENERGY_LABELS[energy!]}`
          : 'Jeszcze nie zaznaczono'}
      </Text>
    </View>
  );
}

const makeStyles = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { gap: spacing[2] },
  sectionLabel: {
    ...typography.label, color: c.text.muted,
    textTransform: 'uppercase', letterSpacing: 1, fontSize: 10,
  },
  hint: { ...typography.caption, color: c.text.muted, fontSize: 11, marginTop: -4 },

  gridWrap: {
    width: '100%', aspectRatio: 1, maxHeight: 260,
    borderRadius: radius.lg, overflow: 'hidden',
    borderWidth: 1, borderColor: c.border.default,
  },
  vLine: { position: 'absolute', top: 0, bottom: 0, width: StyleSheet.hairlineWidth, backgroundColor: c.border.subtle },
  hLine: { position: 'absolute', left: 0, right: 0, height: StyleSheet.hairlineWidth, backgroundColor: c.border.subtle },

  dot: { position: 'absolute', top: 0, left: 0, alignItems: 'center', justifyContent: 'center' },
  dotInner: {
    width: '78%', height: '78%', borderRadius: radius.full,
    borderWidth: 2, alignItems: 'center', justifyContent: 'center',
  },
  dotEmoji: { fontSize: 22 },

  readout: { ...typography.label, fontWeight: '700', textAlign: 'center', fontSize: 14 },
}));
