import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, View } from 'react-native';

// Loading screen — MINIMAL and lag-proof by design. ONE element (the "Sapp" wordmark),
// ONE idea of motion (a soft wave of light rippling across the letters). Each letter is
// its own node so the ripple lands on the GLYPHS, not on a rectangle over them — which
// is why it looks intentional without a masked-view. Everything runs on the native
// driver (opacity + translateY), so it never touches the JS thread while the stores
// hydrate behind it. Pure MONO black-and-white — matches the app.
//
// The old version stacked a wordmark + progress bar + three dots ("za dużo tego") in
// navy/amber. Gone. Background = the app's own near-black + app.json's native splash bg
// → seamless handoff; only the fade-OUT animates.
//
// Future: swap the mark for an owned cosmetic ("customowe startupy za monety"); a
// pre-rendered image / Lottie plays on the UI thread and stays jank-free the same way.

const BG = '#1A1C1C';    // = app background + app.json splash bg → seamless handoff
const INK = '#F2F3F3';   // MONO near-white
const LETTERS = ['S', 'a', 'p', 'p'];
const STEP = 150;        // stagger between letters (ms) → the wave's speed

export default function AnimatedSplash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const fade = useRef(new Animated.Value(1)).current;                 // START shown — seamless with native splash
  const vals = useRef(LETTERS.map(() => new Animated.Value(0))).current;

  // The ripple: each letter brightens+rises in turn, then the wave repeats. Every
  // letter's cycle is the SAME length (STEP*N + hold), just phase-shifted, so the loop
  // stays perfectly in sync forever.
  useEffect(() => {
    const N = LETTERS.length;
    const anims = vals.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * STEP),
      Animated.timing(v, { toValue: 1, duration: 460, easing: Easing.out(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 460, easing: Easing.in(Easing.sin), useNativeDriver: true }),
      Animated.delay((N - i) * STEP + 360),
    ])));
    const group = Animated.parallel(anims);
    group.start();
    return () => group.stop();
  }, [vals]);

  // Fade out once ready, then unmount.
  useEffect(() => {
    if (visible) return;
    Animated.timing(fade, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onHidden(); });
  }, [visible, fade, onHidden]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents={visible ? 'auto' : 'none'}>
      <View style={styles.row}>
        {LETTERS.map((ch, i) => (
          <Animated.Text
            key={i}
            style={[styles.mark, {
              opacity: vals[i].interpolate({ inputRange: [0, 1], outputRange: [0.34, 1] }),
              transform: [{ translateY: vals[i].interpolate({ inputRange: [0, 1], outputRange: [2.5, -2.5] }) }],
            }]}
          >
            {ch}
          </Animated.Text>
        ))}
      </View>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: BG, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
  row: { flexDirection: 'row', alignItems: 'center' },
  mark: { fontSize: 58, fontWeight: '900', letterSpacing: 1, color: INK, marginHorizontal: 1 },
});
