import { useEffect, useRef, useState } from 'react';
import { View, Animated, StyleSheet, Easing } from 'react-native';
import { PersonStanding } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';

// A progress bar with a little figure that walks along it (bobbing like steps) as
// the fraction `progress` (0..1) grows — used for event countdowns.
export default function WalkProgress({ progress, color, height = 10 }: {
  progress: number; color: string; height?: number;
}) {
  const c = useColors();
  const p = Math.min(1, Math.max(0, progress));
  const [w, setW] = useState(0);
  const x = useRef(new Animated.Value(p)).current;
  const bob = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(x, { toValue: p, duration: 800, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [p]);
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(bob, { toValue: 1, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(bob, { toValue: 0, duration: 360, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, []);

  const FIG = 24;
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, w - FIG)] });
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, -3] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: ['-7deg', '7deg'] });

  return (
    <View style={[st.wrap, { height: FIG + height + 4 }]}>
      <View
        style={[st.track, { height, borderRadius: height / 2, backgroundColor: c.fill.subtle }]}
        onLayout={e => setW(e.nativeEvent.layout.width)}
      >
        <View style={{ width: `${p * 100}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
      </View>
      <Animated.View style={[st.figure, { bottom: height - 2, transform: [{ translateX }, { translateY }, { rotate }] }]}>
        <PersonStanding size={FIG} color={color} strokeWidth={2.5} />
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { justifyContent: 'flex-end' },
  track: { width: '100%', overflow: 'hidden' },
  figure: { position: 'absolute', left: 0 },
});
