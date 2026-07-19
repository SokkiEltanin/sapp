import { useEffect, useRef } from 'react';
import { Animated, Easing, StyleSheet, useWindowDimensions } from 'react-native';
import CatArt from '@/components/pet/CatArt';
import { DEFAULT_PALETTE } from '@/utils/catPalettes';

// Animated loading screen = our actual vector pet (CatArt, the RN port of the cat-lab)
// idle-animating: breathing, blinking, glancing, tail swaying. It renders the SAME art
// as the native-splash image (the blue coat is DEFAULT_PALETTE + tail stripes, and the
// PNG was exported from exactly this), at the SAME size (viewBox 0 0 2000 2000 rendered
// at screen-width, matching the native splash's `contain`), on the SAME navy.
//
// Critically it starts at FULL opacity — NO fade-in. The old version faded in over the
// native splash, so you saw the static cat, then a loader "flew in" (the jump the user
// hit). Now the static launch image just seamlessly starts moving; only the fade-OUT at
// the end animates, revealing the dashboard (which mounts behind, hiding first-frame jank).

const NAVY = '#083A64';

export default function AnimatedSplash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const { width, height } = useWindowDimensions();
  const size = Math.min(width, height);   // native splash contains by the short side (width on portrait)
  const fade = useRef(new Animated.Value(1)).current;   // START shown — seamless with the native splash

  useEffect(() => {
    if (visible) return;
    Animated.timing(fade, { toValue: 0, duration: 440, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onHidden(); });
  }, [visible, fade, onHidden]);

  return (
    <Animated.View
      style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]}
      pointerEvents={visible ? 'auto' : 'none'}
    >
      <CatArt size={size} palette={DEFAULT_PALETTE} stripes animate expression="happy" />
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: NAVY, alignItems: 'center', justifyContent: 'center', zIndex: 100 },
});
