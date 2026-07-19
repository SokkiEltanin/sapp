import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, Text } from 'react-native';

// Animated loading screen shown over the app while it boots. Our pet (the blue cat)
// breathes + bobs like it's alive, with a row of pulsing dots, on the same navy as the
// native splash image — so the static launch image appears to "come alive", then this
// fades out to reveal the dashboard (which mounts behind it, hiding the first-frame jank).
//
// The cat art is the LOGONOWEpupildoapki.png asset (same one used for the app icon +
// native splash), so there's no visual jump handing off from the OS splash.

const NAVY = '#083A64';
const CAT = require('../../assets/LOGONOWEpupildoapki.png');

export default function AnimatedSplash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const { width } = useWindowDimensions();
  const catSize = Math.min(260, width * 0.56);

  const fade = useRef(new Animated.Value(0)).current;    // 0 → 1 (in), → 0 (out)
  const breathe = useRef(new Animated.Value(0)).current; // idle breathing loop
  const d0 = useRef(new Animated.Value(0)).current;
  const d1 = useRef(new Animated.Value(0)).current;
  const d2 = useRef(new Animated.Value(0)).current;

  // Fade in on mount.
  useEffect(() => {
    Animated.timing(fade, { toValue: 1, duration: 280, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
  }, [fade]);

  // Breathing + bob loop (the "small animation" — the cat feels alive).
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: 1500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [breathe]);

  // Three dots pulsing in sequence.
  useEffect(() => {
    const mk = (v: Animated.Value, delay: number) => Animated.loop(Animated.sequence([
      Animated.delay(delay),
      Animated.timing(v, { toValue: 1, duration: 300, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 300, easing: Easing.in(Easing.quad), useNativeDriver: true }),
      Animated.delay(540 - delay),
    ]));
    const a = Animated.parallel([mk(d0, 0), mk(d1, 160), mk(d2, 320)]);
    a.start();
    return () => a.stop();
  }, [d0, d1, d2]);

  // Fade out once the app is ready, then tell the parent to unmount us.
  useEffect(() => {
    if (visible) return;
    Animated.timing(fade, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onHidden(); });
  }, [visible, fade, onHidden]);

  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1, 1.05] });
  const ty = breathe.interpolate({ inputRange: [0, 1], outputRange: [0, -10] });
  const dotStyle = (v: Animated.Value) => ({
    opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.3, 1] }),
    transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.75, 1.25] }) }],
  });

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents={visible ? 'auto' : 'none'}>
      <Animated.Image
        source={CAT}
        resizeMode="contain"
        style={{ width: catSize, height: catSize, transform: [{ translateY: ty }, { scale }] }}
      />
      <Text style={styles.brand}>Sapp</Text>
      <Animated.View style={styles.dots}>
        <Animated.View style={[styles.dot, dotStyle(d0)]} />
        <Animated.View style={[styles.dot, dotStyle(d1)]} />
        <Animated.View style={[styles.dot, dotStyle(d2)]} />
      </Animated.View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', gap: 6, zIndex: 100 },
  brand: { color: 'rgba(255,255,255,0.92)', fontSize: 26, fontWeight: '900', letterSpacing: 2, marginTop: 4 },
  dots: { flexDirection: 'row', gap: 9, marginTop: 16 },
  dot: { width: 9, height: 9, borderRadius: 5, backgroundColor: '#7FB2F0' },
});
