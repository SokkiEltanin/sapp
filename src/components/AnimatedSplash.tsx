import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import CatArt from '@/components/pet/CatArt';
import { DEFAULT_PALETTE } from '@/utils/catPalettes';

// Animated loading screen = our actual vector pet (CatArt) in `lively` mode: it glances
// around and flutters its ears almost immediately (the normal idle intervals are
// multi-second, so on a ~1.5 s splash the cat looked static — the user's "SVG się nie
// rusza"). A row of pulsing "ładowanie" dots sits lower on the screen and the cat keeps
// glancing DOWN toward them, so it reads as the pet watching the app load, not twitching
// in a void. Same art/size/navy as the native splash → seamless handoff, no fade-in;
// only the fade-OUT animates, revealing the dashboard (which mounts behind).

const NAVY = '#083A64';

export default function AnimatedSplash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width, height);
  const fade = useRef(new Animated.Value(1)).current;   // START shown — seamless with native splash
  const d0 = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;

  // three loading dots pulsing in sequence
  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(540 - delay),
    ]));
    const a = Animated.parallel([mk(d0, 0), mk(d1, 170), mk(d2, 340)]);
    a.start();
    return () => a.stop();
  }, [d0, d1, d2]);

  // fade out once ready, then unmount
  useEffect(() => {
    if (visible) return;
    Animated.timing(fade, { toValue: 0, duration: 440, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onHidden(); });
  }, [visible, fade, onHidden]);

  const dotStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] }) }],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents={visible ? 'auto' : 'none'}>
      <CatArt size={size} palette={DEFAULT_PALETTE} stripes animate lively expression="happy" />
      <View style={[styles.dots, { bottom: height * 0.20 }]}>
        <Animated.View style={[styles.dot, dotStyle(d0)]} />
        <Animated.View style={[styles.dot, dotStyle(d1)]} />
        <Animated.View style={[styles.dot, dotStyle(d2)]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  dots: { position: 'absolute', left: 0, right: 0, flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#7FB2F0' },
});
