import { useEffect, useRef } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { Flame } from 'lucide-react-native';

// Duolingo-style streak flame: the day count sits inside a flickering flame whose
// colour "heats up" with the streak length.
export function streakColor(days: number): string {
  if (days >= 100) return '#A855F7'; // legendary purple
  if (days >= 30) return '#FFC83D';  // gold
  if (days >= 7) return '#FF6A00';   // hot orange
  if (days >= 1) return '#FF9F43';   // orange
  return '#8A93A8';                  // cold grey (0 days)
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
  const opacity = flick.interpolate({ inputRange: [0, 1], outputRange: [0.85, 1] });
  const fSize = size * 1.1; // flame ~10% bigger than the box

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      {/* Flame sits behind; a fuller fill so it reads as lit. */}
      <Animated.View style={{ position: 'absolute', transform: [{ scaleY }], opacity: alive ? opacity : 0.5 }}>
        <Flame size={fSize} color={color} fill={alive ? color + '66' : 'transparent'} strokeWidth={2} />
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
