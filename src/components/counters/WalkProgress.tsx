import { useEffect, useRef, useState } from 'react';
import { View, Text, Animated, StyleSheet, Easing } from 'react-native';
import { PersonStanding, Car } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';

// A progress bar with a little figure moving along it as the fraction `progress`
// (0..1) grows — used for event countdowns. mode 'walk' = a person bobbing like
// steps (counting down to an event); mode 'drive' = a car (the event is underway).
// `emoji` (until-countdowns) replaces the walker with a chosen emoji that HOPS
// along the bar (e.g. 🎂 for a birthday); the trip car still takes over once the
// event is underway.
export default function WalkProgress({ progress, color, height = 10, mode = 'walk', emoji }: {
  progress: number; color: string; height?: number; mode?: 'walk' | 'drive'; emoji?: string;
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

  const drive = mode === 'drive';
  const useEmoji = !!emoji && !drive;
  const Fig = drive ? Car : PersonStanding;
  const FIG = 24;
  const translateX = x.interpolate({ inputRange: [0, 1], outputRange: [0, Math.max(0, w - FIG)] });
  // walker bobs + tilts like steps; the emoji hops higher without tilt; the car
  // just jiggles a touch over bumps.
  const translateY = bob.interpolate({ inputRange: [0, 1], outputRange: [0, useEmoji ? -9 : drive ? -1.5 : -3] });
  const rotate = bob.interpolate({ inputRange: [0, 1], outputRange: (drive || useEmoji) ? ['0deg', '0deg'] : ['-7deg', '7deg'] });

  return (
    <View style={[st.wrap, { height: FIG + height + 4 }]}>
      <View
        style={[st.track, { height, borderRadius: height / 2, backgroundColor: c.fill.subtle }]}
        onLayout={e => setW(e.nativeEvent.layout.width)}
      >
        <View style={{ width: `${p * 100}%`, height: '100%', borderRadius: height / 2, backgroundColor: color }} />
      </View>
      <Animated.View style={[st.figure, { bottom: height - 2, transform: [{ translateX }, { translateY }, { rotate }] }]}>
        {useEmoji
          ? <Text style={{ fontSize: FIG - 3 }}>{emoji}</Text>
          : <Fig size={FIG} color={color} strokeWidth={2.5} />}
      </Animated.View>
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { justifyContent: 'flex-end' },
  track: { width: '100%', overflow: 'hidden' },
  figure: { position: 'absolute', left: 0 },
});
