import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import Svg, { Defs, LinearGradient, Stop, Circle } from 'react-native-svg';
import { fonts } from '@/theme';
import { useColors } from '@/theme/useColors';

const AnimatedCircle = Animated.createAnimatedComponent(Circle);

// Pierścień odliczania (2026-09-24, user: "ten pasek za gruby, tanio, przerób na highend" —
// zaproponowałem 3 kierunki w mockupie, user wybrał "B — Pierścień"). Zastępuje DonationBar
// (gruby, tekst wpisany w pasek) — kołowy progress + liczba dni w środku, kompaktowy,
// zostawia miejsce na nazwę/status OBOK, nie NA WIERZCHU paska. `strokeDashoffset` nie
// wspiera native driver (nie jest transform/opacity), stąd `useNativeDriver: false` — ten
// sam kompromis co DonationBar wcześniej.
export default function RingCountdown({ progress, color, days, size = 64, strokeWidth = 6 }: {
  progress: number; color: string; days: number; size?: number; strokeWidth?: number;
}) {
  const c = useColors();
  const p = Math.min(1, Math.max(0, progress));
  const r = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * r;
  const anim = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(anim, { toValue: p, duration: 900, easing: Easing.out(Easing.cubic), useNativeDriver: false }).start();
  }, [p]);

  const dashoffset = anim.interpolate({ inputRange: [0, 1], outputRange: [circumference, 0] });
  const gradId = `ringGrad-${color.replace('#', '')}`;

  return (
    <View style={{ width: size, height: size }}>
      <Svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        <Defs>
          <LinearGradient id={gradId} x1="0" y1="0" x2="1" y2="1">
            <Stop offset="0%" stopColor={color} stopOpacity={0.65} />
            <Stop offset="100%" stopColor={color} stopOpacity={1} />
          </LinearGradient>
        </Defs>
        <Circle cx={size / 2} cy={size / 2} r={r} stroke={c.fill.medium} strokeWidth={strokeWidth} fill="none" />
        <AnimatedCircle
          cx={size / 2} cy={size / 2} r={r} stroke={`url(#${gradId})`} strokeWidth={strokeWidth}
          strokeLinecap="round" fill="none"
          strokeDasharray={`${circumference} ${circumference}`}
          strokeDashoffset={dashoffset}
          rotation="-90" originX={size / 2} originY={size / 2}
        />
      </Svg>
      <View style={StyleSheet.absoluteFillObject as any}>
        <View style={st.center}>
          <Text style={[st.num, { fontSize: size * 0.3, color: c.text.primary }]} numberOfLines={1}>{days}</Text>
        </View>
      </View>
    </View>
  );
}

const st = StyleSheet.create({
  center: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  num: { fontFamily: fonts.display, letterSpacing: -0.5 },
});
