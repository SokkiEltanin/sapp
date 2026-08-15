import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { Flame } from 'lucide-react-native';
import { fonts } from '@/theme';

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

// Three-tone palette for the BIG decorative flame on dashboard streak tiles (StreakWallCard) —
// a richer flame shade than the tile's own background (STREAK_TIERS.color), a light tint for
// the sticker-style outline "halo", and a lighter tint for the inner glow. Hand-picked per
// tier (not derived) to match the exact palette approved in the design comparison artifact —
// indices line up with STREAK_TIERS.
interface FlameTone { flame: string; halo: string; core: string }
const FLAME_PALETTE: FlameTone[] = [
  { flame: '#7A2836', halo: '#C39EA5', core: '#E39AA6' }, // Bordo
  { flame: '#B91C1C', halo: '#E09999', core: '#FCA5A5' }, // Czerwień
  { flame: '#E8630A', halo: '#F5B991', core: '#FFC466' }, // Pomarańcz
  { flame: '#D63384', halo: '#EDA3C8', core: '#FFB3D6' }, // Róż
  { flame: '#2563EB', halo: '#9DB9F6', core: '#BFDBFE' }, // Błękit
  { flame: '#7C3AED', halo: '#C4A6F7', core: '#DDD6FE' }, // Legenda (fiolet)
];
const ZERO_FLAME_TONE: FlameTone = { flame: '#3A3F52', halo: '#54596D', core: '#4E5468' };

function flameToneFor(days: number): FlameTone {
  if (days < 1) return ZERO_FLAME_TONE;
  return FLAME_PALETTE[streakTier(days).i];
}

// Big "sticker" flame for the bold dashboard tiles — three flat layers of the SAME lucide
// Flame silhouette (halo behind, solid flame, lighter core on top), no stroke and no number.
// A `stroke` outline was tried first and rejected (2026-08-12): it straddles the path edge,
// so half its width bleeds INTO the fill and washes out the color, and looks uneven around
// the flame's tighter curves. Layering full shapes gives a clean edge instead. Positioning
// mirrors the approved HTML mockup exactly (halo scale 1.13 centered, core scale 0.62 shifted
// down ~12.5% of the full size) — same View-wrapper-per-layer pattern StreakFlame uses above
// for its own flicker animation, not a `style` prop on the icon itself.
export function StreakFlameGlow({ days, size = 100 }: { days: number; size?: number }) {
  const t = flameToneFor(days);
  const haloSize = size * 1.13;
  const coreSize = size * 0.62;
  // 2026-08-15 (user): cały płomień +30% — CENTRALNE powiększenie, bez zmiany pozycji.
  // `transform: scale` na wrapperze o tych samych wymiarach co outer box skaluje wokół
  // jego środka (RN default transform-origin), więc kotwica kafelka (tileFlame:
  // right/bottom w StreakWallCard) zostaje dokładnie tam gdzie była — rośnie tylko
  // renderowany kształt, layout/pozycja nie drgają.
  const GROUP_SCALE = 1.3;
  // Zduplikowana OSTATNIA warstwa (core, najjaśniejsza, rysowana na wierzchu) jako
  // osobna poświata MIĘDZY kafelkiem a całym (już przeskalowanym) płomieniem — większa
  // (+45%, środek 40–50%) i dużo bardziej przezroczysta, żeby czytała się jako miękka
  // otoczka światła ("smooth detail"), nie kolejny kontrastowy kształt. Poza grupą
  // GROUP_SCALE — jej powiększenie jest OSOBNE, niezależne od skalowania całości.
  const glowSize = coreSize * 1.45;
  const glowLeft = (size - glowSize) / 2;
  const glowTop = size * 0.315 - (glowSize - coreSize) / 2;
  return (
    <View style={{ width: size, height: size, opacity: days < 1 ? 0.6 : 1 }}>
      <View style={{ position: 'absolute', left: glowLeft, top: glowTop, opacity: 0.35 }}>
        <Flame size={glowSize} color={t.core} fill={t.core} strokeWidth={0} />
      </View>
      <View style={{ width: size, height: size, transform: [{ scale: GROUP_SCALE }] }}>
        <View style={{ position: 'absolute', left: -(haloSize - size) / 2, top: -(haloSize - size) / 2 }}>
          <Flame size={haloSize} color={t.halo} fill={t.halo} strokeWidth={0} />
        </View>
        <View style={{ position: 'absolute', left: 0, top: 0 }}>
          <Flame size={size} color={t.flame} fill={t.flame} strokeWidth={0} />
        </View>
        <View style={{ position: 'absolute', left: (size - coreSize) / 2, top: size * 0.315 }}>
          <Flame size={coreSize} color={t.core} fill={t.core} strokeWidth={0} />
        </View>
      </View>
    </View>
  );
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
    fontFamily: fonts.display, letterSpacing: -0.5,
    textShadowColor: 'rgba(0,0,0,0.55)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
