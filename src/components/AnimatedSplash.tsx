import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, Text, useWindowDimensions, View } from 'react-native';

// Loading screen — deliberately minimal: no cat, no SVG, no splash-art (the user asked
// for "just a nice loading bar / dots"). A wordmark over an indeterminate progress bar
// (a highlight sweeping across a track) plus three pulsing dots, on the brand navy.
// Starts fully shown (seamless with the native splash's navy) — only the fade-OUT
// animates, revealing the dashboard mounting behind.

const NAVY = '#083A64';
const ACCENT = '#7FB2F0';

export default function AnimatedSplash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const { width, height } = useWindowDimensions();
  const barW = Math.min(width * 0.56, 240);
  const hiliteW = barW * 0.42;

  const fade = useRef(new Animated.Value(1)).current;   // START shown — seamless with native splash
  const slide = useRef(new Animated.Value(0)).current;
  const d0 = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;

  // indeterminate bar highlight sweep + three pulsing dots
  useEffect(() => {
    const sweep = Animated.loop(Animated.timing(slide, {
      toValue: 1, duration: 1150, easing: Easing.inOut(Easing.cubic), useNativeDriver: true,
    }));
    const mk = (v: Animated.Value, delay: number) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(520 - delay),
    ]));
    const dots = Animated.parallel([mk(d0, 0), mk(d1, 160), mk(d2, 320)]);
    sweep.start(); dots.start();
    return () => { sweep.stop(); dots.stop(); };
  }, [slide, d0, d1, d2]);

  // fade out once ready, then unmount
  useEffect(() => {
    if (visible) return;
    Animated.timing(fade, { toValue: 0, duration: 440, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onHidden(); });
  }, [visible, fade, onHidden]);

  const tx = slide.interpolate({ inputRange: [0, 1], outputRange: [-hiliteW, barW] });
  const dotStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.2] }) }],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents={visible ? 'auto' : 'none'}>
      <Text style={styles.wordmark}>Sapp</Text>
      <View style={[styles.track, { width: barW }]}>
        <Animated.View style={[styles.hilite, { width: hiliteW, transform: [{ translateX: tx }] }]} />
      </View>
      <View style={styles.dots}>
        <Animated.View style={[styles.dot, dotStyle(d0)]} />
        <Animated.View style={[styles.dot, dotStyle(d1)]} />
        <Animated.View style={[styles.dot, dotStyle(d2)]} />
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  wordmark: { fontSize: 40, fontWeight: '900', letterSpacing: 1, color: '#EAF2FB', marginBottom: 34 },
  track: { height: 5, borderRadius: 3, backgroundColor: 'rgba(255,255,255,0.14)', overflow: 'hidden' },
  hilite: { height: 5, borderRadius: 3, backgroundColor: ACCENT },
  dots: { flexDirection: 'row', gap: 10, alignItems: 'center', justifyContent: 'center', marginTop: 22 },
  dot: { width: 8, height: 8, borderRadius: 4, backgroundColor: ACCENT },
});
