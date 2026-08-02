import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

// Loading screen — deliberately LIGHTWEIGHT. The old version animated the full vector cat
// (CatArt) on the JS thread while stores hydrate → jank. Now: wordmark + an indeterminate
// progress bar + three pulsing dots, all on the native driver (translateX/opacity/scale) →
// zero JS-thread work, so it stays smooth even while the app is booting behind it.
// Same navy as app.json native splash → seamless handoff; only the fade-OUT animates.
//
// Future: a user-supplied animation (Lottie / pre-rendered image or GIF) would ALSO be
// jank-free because it plays on the UI thread, not recomputed in JS like the SVG cat —
// this is where "customowe startupy za monety" can swap the mark per owned cosmetic.

const NAVY = '#083A64';   // matches native splash backgroundColor → seamless
const AMBER = '#FFC24B';

export default function AnimatedSplash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const { width, height } = useWindowDimensions();
  const barW = Math.min(width * 0.55, 260);
  const fade = useRef(new Animated.Value(1)).current;   // START shown — seamless with native splash
  const slide = useRef(new Animated.Value(0)).current;  // indeterminate bar sweep
  const d0 = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;

  // Indeterminate progress: a highlight sweeps left→right forever.
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(slide, {
      toValue: 1, duration: 1100, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
    }));
    loop.start();
    return () => loop.stop();
  }, [slide]);

  // Three loading dots pulsing in sequence.
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

  // Fade out once ready, then unmount.
  useEffect(() => {
    if (visible) return;
    Animated.timing(fade, { toValue: 0, duration: 440, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onHidden(); });
  }, [visible, fade, onHidden]);

  const dotStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.25] }) }],
  });
  const highlightW = barW * 0.4;
  const sweepX = slide.interpolate({ inputRange: [0, 1], outputRange: [-highlightW, barW] });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={styles.center}>
        <Text style={styles.mark}>Sapp</Text>
        <View style={[styles.track, { width: barW }]}>
          <Animated.View style={[styles.highlight, { width: highlightW, transform: [{ translateX: sweepX }] }]} />
        </View>
        <View style={styles.dots}>
          <Animated.View style={[styles.dot, dotStyle(d0)]} />
          <Animated.View style={[styles.dot, dotStyle(d1)]} />
          <Animated.View style={[styles.dot, dotStyle(d2)]} />
        </View>
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  center: { alignItems: 'center', gap: 26 },
  mark: { fontSize: 46, fontWeight: '900', letterSpacing: 1, color: '#FFFFFF' },
  track: { height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  highlight: { height: 4, borderRadius: 2, backgroundColor: AMBER },
  dots: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center' },
  dot: { width: 9, height: 9, borderRadius: 4.5, backgroundColor: AMBER },
});
