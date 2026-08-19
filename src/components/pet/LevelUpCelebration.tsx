import { useEffect, useRef } from 'react';
import { View, Text, StyleSheet, Pressable, Animated, Easing } from 'react-native';
import Confetti from '@/components/achievements/Confetti';
import { usePetLevelUp } from '@/store/petLevelUpStore';
import { usePetStore, GrowthStage } from '@/store/petStore';
import { haptic } from '@/utils/haptics';

const STAGE_LABEL: Record<GrowthStage, string> = {
  baby: 'kociak', kid: 'dzieciak', teen: 'nastolatek', adult: 'dorosły kot',
};
// Levels where a new growth stage actually begins (patrz growthStage() w petStore.ts) —
// jeśli TEN level-up trafia na taki próg, kotek nie tylko dostał poziom, ale i realnie
// urósł (CatArt renderuje go inaczej od tego levelu), więc celebracja to podkreśla.
const STAGE_START_LEVEL: Record<number, GrowthStage> = { 3: 'kid', 6: 'teen', 12: 'adult' };

const AUTO_DISMISS_MS = 3200;

// Baner level-upu (2026-08-19, user: "musimy dodac info o levelup pupila... powiadomienie
// z confetti albo fajna animacja XP") — celowo LŻEJSZY niż BadgeCelebration.tsx (osiągnięcia
// dostają pełnoekranowy Modal blokujący, level-up dostaje baner spadający z góry + auto-znika
// po chwili) — user sam nie był pewien jak dużo chce ("nie wiem chyba powiadomienie
// wystarczy"), więc coś bliżej toastu niż blokującego ekranu. Wykrywanie w app/_layout.tsx,
// tu tylko odbiór kolejki + odznaczenie (ackPetLevel) PO faktycznym pokazaniu/zamknięciu —
// jeśli apka padnie w trakcie animacji, level-up wróci przy następnym starcie zamiast
// zniknąć bezpowrotnie.
export default function LevelUpCelebration() {
  const queue = usePetLevelUp(s => s.queue);
  const dismissTop = usePetLevelUp(s => s.dismissTop);
  const ackPetLevel = usePetStore(s => s.ackPetLevel);
  const level = queue[0] ?? null;

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

  return (
    <View style={st.wrap} pointerEvents="box-none">
      <Confetti colors={['#FBBF24', '#2AC68F', '#38BDF8', '#F472B6', '#A78BFA']} />
      <Animated.View style={{ transform: [{ translateY: y }], opacity }}>
        <Pressable style={st.card} onPress={dismiss}>
          <Text style={st.emoji}>🎉</Text>
          <View style={{ flex: 1 }}>
            <Text style={st.title}>Poziom {level}!</Text>
            <Text style={st.sub}>
              {newStage ? `Pupil urósł — teraz to ${STAGE_LABEL[newStage]}!` : 'Twój pupil jest coraz silniejszy.'}
            </Text>
          </View>
        </Pressable>
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { position: 'absolute', top: 0, left: 0, right: 0, alignItems: 'center', paddingTop: 56, zIndex: 1000 },
  card: {
    flexDirection: 'row', alignItems: 'center', gap: 12, maxWidth: 340, marginHorizontal: 20,
    backgroundColor: '#161A1A', borderRadius: 18, paddingVertical: 14, paddingHorizontal: 16,
    borderWidth: 1, borderColor: '#FBBF2455',
    shadowColor: '#000', shadowOpacity: 0.35, shadowRadius: 14, shadowOffset: { width: 0, height: 6 }, elevation: 8,
  },
  emoji: { fontSize: 30 },
  title: { fontSize: 17, fontWeight: '900', color: '#FBBF24', letterSpacing: -0.2 },
  sub: { fontSize: 12.5, color: 'rgba(255,255,255,0.75)', marginTop: 2, lineHeight: 17 },
});
