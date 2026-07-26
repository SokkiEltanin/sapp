import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions, View } from 'react-native';
import CatArt from '@/components/pet/CatArt';
import { CatPalette, markFor } from '@/utils/catPalettes';

// Loading screen = our vector cat (CatArt) in a VIBRANT, high-contrast coat (amber on
// deep navy — complementary colours, so the cat really pops, Duolingo-style) with a row
// of pulsing dots below. Same navy as the native splash → seamless handoff; only the
// fade-OUT animates, revealing the dashboard mounting behind.

const NAVY = '#083A64';   // matches app.json native splash backgroundColor → seamless
const DOT = '#FFC24B';

// Bright amber coat — deliberately NOT one of the shop coats; this is splash-only punch.
const SPLASH_CAT: CatPalette = {
  id: 'splash', name: 'Splash',
  coat: '#FFB43C', shade: '#F2A62E', ear: '#E0951F', ink: '#3A2410',
  mark: markFor('#FFB43C'), cost: 0,
};

export default function AnimatedSplash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width, height) * 0.9;
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
      <CatArt size={size} palette={SPLASH_CAT} stripes animate lively expression="happy" />
      <View style={[styles.dots, { bottom: height * 0.18 }]}>
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
  dot: { width: 10, height: 10, borderRadius: 5, backgroundColor: DOT },
});
