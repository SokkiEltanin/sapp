import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { Flame } from 'lucide-react-native';

// Progi serii — wspólny język kolorów dla całej apki (płomienie + kafelki „Twoje serie").
// Im dłuższa seria, tym rzadszy „rarity" kolor kafelka: bordo → czerwień → pomarańcz →
// róż → błękit → fiolet (legenda). Przekroczenie progu = celebracja (StreakWallCard).
export interface StreakTier { i: number; color: string; name: string; min: number; next: number | null }
const STREAK_TIERS: { min: number; color: string; name: string }[] = [
  { min: 1,   color: '#9A3444', name: 'Bordo' },
  { min: 7,   color: '#DC2626', name: 'Czerwień' },
  { min: 14,  color: '#F97316', name: 'Pomarańcz' },
  { min: 30,  color: '#EC4899', name: 'Róż' },
  { min: 60,  color: '#3B82F6', name: 'Błękit' },
  { min: 100, color: '#8B5CF6', name: 'Legenda' },
];
export function streakTier(days: number): StreakTier {
  let i = 0;
  for (let k = 0; k < STREAK_TIERS.length; k++) if (days >= STREAK_TIERS[k].min) i = k;
  const t = STREAK_TIERS[i];
  return { i, color: t.color, name: t.name, min: t.min, next: i + 1 < STREAK_TIERS.length ? STREAK_TIERS[i + 1].min : null };
}

// Duolingo-style streak flame: the day count sits inside a flickering flame whose
// colour "heats up" with the streak length (via the shared tier scheme above).
export function streakColor(days: number): string {
  if (days < 1) return '#8A93A8'; // cold grey (0 days)
  return streakTier(days).color;
}

export default function StreakFlame({ days, size = 48 }: { days: number; size?: number }) {
  const flick = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (days < 1) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(flick, { toValue: 1, duration: 560, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(flick, { toValue: 0, duration: 620, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [days]);

  const color = streakColor(days);
  const alive = days >= 1;
  const scaleY = flick.interpolate({ inputRange: [0, 1], outputRange: [1, 1.1] });
  const opacity = flick.interpolate({ inputRange: [0, 1], outputRange: [0.94, 1] }); // subtle flicker, stays fully lit
  const fSize = size * 1.1; // flame ~10% bigger than the box

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Flame sits behind; FULL solid fill so it reads as a lit, opaque flame. */}
      <Animated.View style={{ position: 'absolute', transform: [{ scaleY }], opacity: alive ? opacity : 0.5 }}>
        <Flame size={fSize} color={color} fill={alive ? color : 'transparent'} strokeWidth={2} />
      </Animated.View>
      {/* Number on TOP of the flame — white + shadow so it never gets buried. */}
      <Text style={[st.count, { fontSize: size * 0.36, top: size * 0.34, color: alive ? '#FFFFFF' : '#8A93A8' }]}>{days}</Text>
    </View>
  );
}

const st = StyleSheet.create({
  count: {
    position: 'absolute', left: 0, right: 0, textAlign: 'center',
    fontWeight: '900', letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
