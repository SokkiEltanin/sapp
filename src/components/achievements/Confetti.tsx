import { useRef, useEffect } from 'react';
import { View, Animated, useWindowDimensions, Easing, StyleSheet } from 'react-native';

const COUNT = 30;

// Lightweight confetti — no extra deps. Each particle loops top→bottom with drift +
// spin, driven by its own native-driver timing.
export default function Confetti({ colors }: { colors: string[] }) {
  const { width: W, height: H } = useWindowDimensions(); // reactive → correct after a resize
  const parts = useRef(
    Array.from({ length: COUNT }).map((_, i) => ({
      x: Math.random() * W,
      size: 6 + Math.random() * 9,
      color: colors[i % colors.length],
      delay: Math.random() * 700,
      dur: 2200 + Math.random() * 1500,
      drift: (Math.random() - 0.5) * 140,
      rot: (Math.random() > 0.5 ? 1 : -1) * (360 + Math.random() * 540),
      round: Math.random() > 0.5,
      v: new Animated.Value(0),
    })),
  ).current;

  useEffect(() => {
    const anims = parts.map(p =>
      Animated.loop(Animated.timing(p.v, { toValue: 1, duration: p.dur, delay: p.delay, easing: Easing.linear, useNativeDriver: true })),
    );
    anims.forEach(a => a.start());
    return () => anims.forEach(a => a.stop());
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {parts.map((p, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', left: p.x, top: 0, width: p.size, height: p.size,
            borderRadius: p.round ? p.size / 2 : 2, backgroundColor: p.color,
            opacity: p.v.interpolate({ inputRange: [0, 0.1, 0.85, 1], outputRange: [0, 1, 1, 0] }),
            transform: [
              { translateY: p.v.interpolate({ inputRange: [0, 1], outputRange: [-40, H + 40] }) },
              { translateX: p.v.interpolate({ inputRange: [0, 1], outputRange: [0, p.drift] }) },
              { rotate: p.v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', `${p.rot}deg`] }) },
            ],
          }}
        />
      ))}
    </View>
  );
}
