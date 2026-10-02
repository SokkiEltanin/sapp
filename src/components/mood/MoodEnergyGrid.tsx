import { useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, Animated, useWindowDimensions } from 'react-native';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { runOnJS, useSharedValue } from 'react-native-reanimated';
import { LinearGradient } from 'expo-linear-gradient';
import { MoodLevel, MOOD_LABELS, MOOD_COLORS, ENERGY_LABELS, ENERGY_COLORS } from '@/types';
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
  const lastKey = useSharedValue(-1);
  // Szerokość liczona WPROST z okna (2026-09-30, user DALEJ zgłaszał wąską siatkę mimo
  // wcześniejszego fixu przez `width:'100%'` + `marginHorizontal: -spacing[5]` — ten trik
  // MATEMATYCZNIE jest poprawny/standardowy ("full-bleed przez ujemny margines"), ale
  // zależy od tego, że KAŻDY rodzic w łańcuchu faktycznie ma dokładnie `spacing[5]`
  // paddingu i nic go nie psuje po drodze (np. zaokrąglenia procentów w zagnieżdżonym
  // ScrollView na Androidzie) — trudne do zweryfikowania bez urządzenia, więc zamiast
  // dalej zgadywać, liczone jest WPROST z `useWindowDimensions()`, niezależnie od
  // jakiejkolwiek szerokości rodzica. `-2` za obramowanie arkusza (`sheet`'s
  // `borderLeftWidth`/`borderRightWidth: 1` w MoodCheckInModal.tsx), żeby siatka nie
  // wystawała POZA zaokrąglony arkusz.
  const { width: winWidth } = useWindowDimensions();
  const gridBleedWidth = winWidth - 2;
  // `gridHeight` POLICZONY WPROST (2026-10-02, user zrzutem: cała siatka pusta/martwa —
  // ani kropka, ani przeciąganie). Poprzednia wersja trzymała rozmiar w stanie
  // ustawianym TYLKO przez `onLayout` natywnego widoku — ale ten widok żyje wewnątrz
  // natywnego `Modal`-a, portowanego do OSOBNEJ natywnej hierarchii (patrz komentarz w
  // MoodCheckInModal.tsx przy `GestureHandlerRootView`); `onLayout` w takim oknie bywa
  // spóźniony albo w ogóle nie dochodzi na czas, więc stan zostawał na `0` na stałe — a
  // zarówno render kropki jak i gest Pana są bramkowane tym warunkiem: efekt to martwa,
  // niewidoczna siatka. Skoro `gridBleedWidth` jest już znane SYNCHRONICZNIE z tego
  // samego hooka co szerokość widoku, wysokość liczy się wprost z niego — bez żadnego
  // pośredniego stanu/callbacku, zero ryzyka wyścigu z layoutem.
  const gridHeight = Math.min(260, gridBleedWidth);
  // Siatka NIE JEST kwadratem gdy `gridBleedWidth > 260` (typowy telefon: ~360-410dp
  // szerokości, więc szerokość > wysokość) — DRUGI bug tego samego pochodzenia: wcześniej
  // jeden wspólny `cell = gridSize/5` liczony z WYSOKOŚCI był błędnie stosowany też do osi
  // X (`evt.x / cell`), więc mapowanie dotyku na kolumnę nastroju było ściśnięte/przesunięte
  // względem realnej szerokości pudełka — osobne `cellX`/`cellY` dla każdej osi.
  const cellX = gridBleedWidth / 5;
  const cellY = gridHeight / 5;

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
      const col = Math.min(4, Math.max(0, Math.floor(evt.x / cellX)));
      const row = Math.min(4, Math.max(0, Math.floor(evt.y / cellY)));
      const key = row * 5 + col;
      if (key !== lastKey.value) {
        lastKey.value = key;
        runOnJS(commit)((col + 1) as MoodLevel, (5 - row) as MoodLevel);
      }
    }),
  [cellX, cellY]);

  // Kropka-wskaźnik animowana w PIKSELACH (nie indeksach) — prościej i spójniej ze stylem
  // reszty pliku (`Animated` z 'react-native', jak w MoodPicker.tsx), bez węzłów `multiply`
  // tworzonych na nowo przy każdym renderze.
  const dotX = useRef(new Animated.Value(0)).current;
  const dotY = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const col = mood ? mood - 1 : 2;
    const row = energy ? 5 - energy : 2;
    Animated.spring(dotX, { toValue: col * cellX, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
    Animated.spring(dotY, { toValue: row * cellY, useNativeDriver: true, damping: 16, stiffness: 220 }).start();
  }, [mood, energy, cellX, cellY]);

  const hasValue = !!mood && !!energy;
  // Otoczka = energia, emotka w środku = nastrój (2026-10-02, user: kolor samego kółka
  // mylił się z emotką — obie niosły informację o nastroju, energia nigdzie nie była
  // widoczna wizualnie mimo że `ENERGY_COLORS` już istniało w types/index.ts, nieużywane).
  const ringColor = energy ? ENERGY_COLORS[energy] : c.text.muted;

  return (
    <View style={styles.container}>
      <Text style={[styles.sectionLabel, styles.inset]}>Nastrój i energia</Text>
      <Text style={[styles.hint, styles.inset]}>przeciągnij lub tapnij — w prawo lepszy nastrój, w górę więcej energii</Text>

      {/* Siatka na całą szerokość ekranu (2026-09-30, user: "ta siatka humoru mnie
          denerwuje że jest taka niewpasowana w ten telefon... damy po prostu na całej
          szerokości żeby było wygodniej" — dotąd dziedziczyła 20px padding rodzica
          (`MoodCheckInModal`'s `styles.scroll`), tak jak reszta sekcji. Tu jedyny box z
          gestem przeciągania — większy = wygodniejszy cel dotyku, więc bleeduje przez
          ujemny margines TYLKO ten box, nie całą sekcję (etykieta/hint/odczyt zostają
          wyrównane z resztą treści przez `.inset`, inaczej ich lewy brzeg nie zgadzałby
          się z "Co czujesz?" pod spodem). */}
      <View style={[styles.gridWrap, { width: gridBleedWidth, height: gridHeight }]}>
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

        <Animated.View
          pointerEvents="none"
          style={[
            styles.dot,
            { width: cellX, height: cellY, transform: [{ translateX: dotX }, { translateY: dotY }] },
          ]}
        >
          <View style={[
            styles.dotInner,
            { borderColor: ringColor, backgroundColor: hasValue ? ringColor + '33' : c.bg.card },
          ]}>
            <Text style={styles.dotEmoji}>{mood ? MOOD_EMOJIS[mood] : '·'}</Text>
          </View>
        </Animated.View>
      </View>

      <Text style={[styles.readout, styles.inset, { color: hasValue ? ringColor : c.text.muted }]} numberOfLines={1}>
        {hasValue
          ? `${MOOD_EMOJIS[mood!]} ${MOOD_LABELS[mood!]}  ·  ${ENERGY_EMOJIS[energy!]} ${ENERGY_LABELS[energy!]}`
          : 'Jeszcze nie zaznaczono'}
      </Text>
    </View>
  );
}

const makeStyles = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { gap: spacing[2] },
  // Wyrównanie z resztą sekcji modala mimo że `gridWrap` niżej bleeduje poza ten padding
  // (patrz komentarz przy `<View style={styles.gridWrap}>`).
  inset: { paddingHorizontal: spacing[5] },
  sectionLabel: {
    ...typography.label, color: c.text.muted,
    textTransform: 'uppercase', letterSpacing: 1, fontSize: 10,
  },
  hint: { ...typography.caption, color: c.text.muted, fontSize: 11, marginTop: -4 },

  // `width`/`height` NIE tu — liczone wprost z `useWindowDimensions()` w komponencie
  // (patrz komentarz przy `gridBleedWidth`), dopisywane inline. Tu tylko wygląd + margines
  // przesuwający box w lewo, żeby zniwelować 20px wcięcia odziedziczone z `container`'s
  // rodzica (`MoodCheckInModal`'s `styles.scroll`, padding `spacing[5]`).
  gridWrap: {
    marginHorizontal: -spacing[5],
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
