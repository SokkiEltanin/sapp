import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { fonts } from '@/theme';
import { useColors } from '@/theme/useColors';

// Gruby pasek odliczania, styl celu-donacji na Twitch (2026-09-23, user: "będzie gruby napis
// w pasku wypełniając się jak donate na twitch... ikonki wywalamy") — zastępuje WalkProgress
// (cienki 10px pasek + chodzik/samochodzik/emoji skaczące nad nim). Tekst ZAWSZE na wierzchu,
// biały + cień (ten sam trik czytelności co StreakFlame.tsx's liczba na płomieniu) — czytelny
// niezależnie ile paska jest wypełnione, bez potrzeby dwóch kolorów tekstu na dwóch stronach
// granicy wypełnienia. Brak figurki/emoji — cały ruch niesie sam pasek.
export default function DonationBar({ progress, color, label, height = 44 }: {
  progress: number; color: string; label: string; height?: number;
}) {
  const c = useColors();
  const p = Math.min(1, Math.max(0, progress));
  const w = useRef(new Animated.Value(p)).current;

  useEffect(() => {
    Animated.timing(w, { toValue: p, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [p]);
  const width = w.interpolate({ inputRange: [0, 1], outputRange: ['0%', '100%'] });

  return (
    <View style={[st.track, { height, borderRadius: height / 2, backgroundColor: c.fill.subtle }]}>
      <Animated.View style={[st.fill, { width, borderRadius: height / 2, backgroundColor: color }]} />
      <View style={st.labelWrap} pointerEvents="none">
        <Text style={[st.label, { fontSize: height * 0.38 }]} numberOfLines={1}>{label}</Text>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  track: { width: '100%', overflow: 'hidden', justifyContent: 'center' },
  fill: { position: 'absolute', left: 0, top: 0, bottom: 0 },
  labelWrap: { position: 'absolute', left: 8, right: 8, alignItems: 'center', justifyContent: 'center' },
  label: {
    fontFamily: fonts.display, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.3,
    textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3,
  },
});
