import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing, useWindowDimensions } from 'react-native';
import { ChevronsUp } from 'lucide-react-native';
import Confetti from '@/components/achievements/Confetti';
import { usePetLevelUp } from '@/store/petLevelUpStore';
import { usePetStore, GrowthStage, levelFromXp } from '@/store/petStore';
import { haptic } from '@/utils/haptics';

const STAGE_LABEL: Record<GrowthStage, string> = {
  baby: 'kociak', kid: 'dzieciak', teen: 'nastolatek', adult: 'dorosły kot',
};
// Levels where a new growth stage actually begins (patrz growthStage() w petStore.ts) —
// jeśli TEN level-up trafia na taki próg, kotek nie tylko dostał poziom, ale i realnie
// urósł (CatArt renderuje go inaczej od tego levelu), więc celebracja to podkreśla.
const STAGE_START_LEVEL: Record<number, GrowthStage> = { 3: 'kid', 6: 'teen', 12: 'adult' };

// Wydłużone 3200→4200ms (2026-08-20, patrz komentarz przy `title`/`kicker` niżej — jest
// teraz więcej do przeczytania, sam numer poziomu i confetti "znikały zanim się połapałeś
// o co chodzi").
const AUTO_DISMISS_MS = 4200;

// Baner level-upu (2026-08-19, user: "musimy dodac info o levelup pupila... powiadomienie
// z confetti albo fajna animacja XP") — celowo LŻEJSZY niż BadgeCelebration.tsx (osiągnięcia
// dostają pełnoekranowy Modal blokujący, level-up dostaje baner spadający z góry + auto-znika
// po chwili) — user sam nie był pewien jak dużo chce ("nie wiem chyba powiadomienie
// wystarczy"), więc coś bliżej toastu niż blokującego ekranu. Wykrywanie w app/_layout.tsx,
// tu tylko odbiór kolejki + odznaczenie (ackPetLevel) PO faktycznym pokazaniu/zamknięciu —
// jeśli apka padnie w trakcie animacji, level-up wróci przy następnym starcie zamiast
// zniknąć bezpowrotnie.
//
// PRZEBUDOWANE (2026-08-20, user: "ten toast powiadomienie levelupu pupila zrob lepiej teraz
// jest tylko emotka i confetii i nie wiadomo o co chodzi xd") — sam 🎉 + confetti niosło mało
// informacji, confetti wizualnie przyciągało wzrok BARDZIEJ niż mały numer poziomu obok niego.
// Zamiast emoji: kolorowa "odznaka" z ikoną `ChevronsUp` (jednoznaczny motyw "poszedłeś w
// górę", nie ozdobnik) + kicker "AWANS POZIOMU" NAD numerem poziomu (ten sam wzorzec co
// `vKicker` w victory modalu bossów — duży, jednoznaczny nagłówek zamiast pojedynczej ikonki)
// + nowy mini pasek XP pod spodem pokazujący konkretne "X/Y XP" w nowym poziomie, żeby liczba
// "Poziom N!" miała namacalny kontekst zamiast suchej cyfry.
export default function LevelUpCelebration() {
  const queue = usePetLevelUp(s => s.queue);
  const dismissTop = usePetLevelUp(s => s.dismissTop);
  const ackPetLevel = usePetStore(s => s.ackPetLevel);
  const xp = usePetStore(s => s.xp);
  const level = queue[0] ?? null;
  // Fix (2026-08-22, user: "jak dostaje lewel to nic oprócz [ikonki] nie jest napisane") —
  // `card` miał tylko `maxWidth: 360`, nigdy realny `width`. `wrap` centruje przez
  // `alignItems:'center'`, więc Animated.View/Pressable dostają szerokość "po zawartości"
  // (hug-content), nie stałą. Wewnątrz `card`-a kolumna tekstu ma `flex:1` — a `flex:1` w RN
  // to `flexBasis:'0%'`, czyli "zacznij od zera i rośnij w dostępną przestrzeń". Bez
  // DEFINITYWNEJ szerokości rodzica nie ma w co rosnąć, więc kolumna tekstu zapadała się do
  // 0px — widoczna zostawała tylko sztywna 44px odznaka z ikoną, cały tekst (kicker/tytuł/
  // pasek XP) był realnie wyrenderowany, ale o szerokości zero. Fix: policz REALNĄ szerokość
  // karty z ekranu (`useWindowDimensions`), nie samą górną granicę — to daje wewnętrznemu
  // `flex:1` coś, w co może faktycznie urosnąć.
  const { width: screenW } = useWindowDimensions();
  const cardWidth = Math.min(screenW - 40, 360);

  const y = useRef(new Animated.Value(-160)).current;
  const opacity = useRef(new Animated.Value(0)).current;
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    if (level == null) return;
    haptic.success();
    y.setValue(-160); opacity.setValue(0);
    Animated.parallel([
      Animated.spring(y, { toValue: 0, friction: 8, tension: 60, useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 1, duration: 220, useNativeDriver: true }),
    ]).start();
    timer.current = setTimeout(dismiss, AUTO_DISMISS_MS);
    return () => { if (timer.current) clearTimeout(timer.current); };
  }, [level]);

  const dismiss = () => {
    if (timer.current) { clearTimeout(timer.current); timer.current = null; }
    const shown = level;
    Animated.parallel([
      Animated.timing(y, { toValue: -160, duration: 220, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }),
    ]).start(() => {
      if (shown != null) ackPetLevel(shown);
      dismissTop();
    });
  };

  if (level == null) return null;
  const newStage = STAGE_START_LEVEL[level];
  // Żywy postęp w NOWYM poziomie — konkretna liczba ("X/Y XP") zamiast suchego "Poziom N!"
  // bez kontekstu. Liczone z aktualnego `xp` w store (nie z `level` samego w sobie), więc
  // jeśli w międzyczasie doszło jeszcze więcej XP, pasek pokazuje PRAWDZIWY, aktualny stan.
  const lvl = levelFromXp(xp);

  return (
    <View style={st.wrap} pointerEvents="box-none">
      <Confetti colors={['#FBBF24', '#2AC68F', '#38BDF8', '#F472B6', '#A78BFA']} />
      <Animated.View style={{ transform: [{ translateY: y }], opacity }}>
        <Pressable style={[st.card, { width: cardWidth }]} onPress={dismiss}>
          <View style={st.badge}><ChevronsUp size={24} color="#0B0E1A" strokeWidth={3} /></View>
          <View style={{ flex: 1 }}>
            <Text style={st.kicker}>AWANS POZIOMU</Text>
            <Text style={st.title}>Poziom {level}!</Text>
            <Text style={st.sub}>
              {newStage ? `Pupil urósł — teraz to ${STAGE_LABEL[newStage]}!` : 'Twój pupil jest coraz silniejszy.'}
            </Text>
            <View style={st.xpRow}>
              <View style={st.xpTrack}><View style={[st.xpFill, { width: `${Math.round(lvl.progress * 100)}%` }]} /></View>
              <Text style={st.xpTxt}>{lvl.inLevel}/{lvl.needed} XP</Text>
            </View>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 56, zIndex: 1000 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12,
    backgroundColor: '#161A1A', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#FBBF2455',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  badge: {
    width: 44, height: 44, borderRadius: 22, backgroundColor: '#FBBF24',
    alignItems: 'center', justifyContent: 'center',
    shadowColor: '#FBBF24', shadowOpacity: 0.5, shadowRadius: 8, shadowOffset: { width: 0, height: 0 },
  },
  kicker: { fontSize: 10.5, fontWeight: '900', color: '#FBBF24', letterSpacing: 1.4 },
  title: { fontSize: 18, fontWeight: '900', color: '#fff', letterSpacing: -0.2, marginTop: 1 },
  sub: { fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 2, lineHeight: 17 },
  xpRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 6 },
  xpTrack: { flex: 1, height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.12)', overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 3, backgroundColor: '#FBBF24' },
  xpTxt: { fontSize: 10.5, fontWeight: '700', color: 'rgba(255,255,255,0.6)' },
});
