import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Image, StyleSheet, Text, View } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Ellipse } from 'react-native-svg';
import { usePetStore } from '@/store/petStore';
import { startupById, SPLASH_BG, SplashAnim } from '@/utils/petStartups';
import { paletteById } from '@/utils/catPalettes';
import CatArt from '@/components/pet/CatArt';

// Loading screen — lag-proof by design: everything runs on the native driver (opacity +
// transforms), so it never touches the JS thread while the stores hydrate behind it. Pure
// BLACK background (= app.json's native splash) → seamless handoff; only the fade-OUT
// animates.
//
// The LOOK is a cosmetic ("customowy startup", bought with pet coins): equippedStartup in
// petStore picks the accent colour + which animation plays — a fluid loading bar (default),
// a per-letter wave, a breathing pulse, a light sweep, or the cat's eyes igniting in the
// dark. Before the store hydrates we show the free default (instant, matches native splash).

const LETTERS = ['S', 'a', 'p', 'p'];
const STEP = 150;   // stagger between letters in the wave (ms)

const glowFor = (glow: boolean | undefined, ink: string) =>
  glow ? { textShadowColor: ink + 'AA', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 16 } : null;

// ── BAR: a fluid loading bar — a glowing blob glides smoothly back and forth (default). ──
function BarMark({ ink, glow }: { ink: string; glow?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 900, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const TRACK = 224, BLOB = 96;
  const x = v.interpolate({ inputRange: [0, 1], outputRange: [-BLOB * 0.55, TRACK - BLOB * 0.45] });
  return (
    <View style={styles.barCol}>
      <Text style={[styles.markSmall, { color: ink }, glowFor(glow, ink)]}>Sapp</Text>
      <View style={[styles.track, { width: TRACK, backgroundColor: ink + '16' }]}>
        <Animated.View style={[styles.blob, { transform: [{ translateX: x }] }]} pointerEvents="none">
          <LinearGradient colors={['transparent', ink, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width: BLOB, height: '100%' }} />
        </Animated.View>
      </View>
    </View>
  );
}

// ── WAVE: a ripple of light travels across the letters (each is its own node). ──
function WaveMark({ ink, glow }: { ink: string; glow?: boolean }) {
  const vals = useRef(LETTERS.map(() => new Animated.Value(0))).current;
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
  return (
    <View style={styles.row}>
      {LETTERS.map((ch, i) => (
        <Animated.Text
          key={i}
          style={[styles.mark, { color: ink }, glowFor(glow, ink), {
            opacity: vals[i].interpolate({ inputRange: [0, 1], outputRange: [0.34, 1] }),
            transform: [{ translateY: vals[i].interpolate({ inputRange: [0, 1], outputRange: [2.5, -2.5] }) }],
          }]}
        >
          {ch}
        </Animated.Text>
      ))}
    </View>
  );
}

// ── PULSE: the whole wordmark breathes (opacity + a hair of scale). ──
function PulseMark({ ink, glow }: { ink: string; glow?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1150, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 1150, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  return (
    <Animated.Text
      style={[styles.mark, { color: ink }, glowFor(glow, ink), {
        opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
        transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.975, 1.03] }) }],
      }]}
    >
      Sapp
    </Animated.Text>
  );
}

// ── SWEEP: the mark sits still while a thin light bar crosses a hairline underneath it. ──
function SweepMark({ ink, glow }: { ink: string; glow?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  const [w, setW] = useState(0);
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 1200, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(520),
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const barW = 70;
  const x = v.interpolate({ inputRange: [0, 1], outputRange: [-barW, (w || 200) + barW] });
  return (
    <View style={styles.sweepWrap} onLayout={e => setW(e.nativeEvent.layout.width)}>
      <Animated.Text style={[styles.mark, { color: ink }, glowFor(glow, ink)]}>Sapp</Animated.Text>
      <View style={styles.underline}>
        <View style={[styles.underlineBase, { backgroundColor: ink + '22' }]} />
        {w > 0 && (
          <Animated.View style={[styles.underlineHi, { transform: [{ translateX: x }] }]} pointerEvents="none">
            <LinearGradient colors={['transparent', ink, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width: barW, height: 2 }} />
          </Animated.View>
        )}
      </View>
    </View>
  );
}

// ── RING: a clean rotating loader ring (NOT text — a proper spinner). ──
function RingMark({ ink, glow }: { ink: string; glow?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1100, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const rot = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  return (
    <View style={styles.ringCol}>
      <Animated.View
        style={[styles.ring, { borderColor: ink + '22', borderTopColor: ink, transform: [{ rotate: rot }] },
          glow ? { shadowColor: ink, shadowOpacity: 0.8, shadowRadius: 12, shadowOffset: { width: 0, height: 0 }, elevation: 7 } : null]}
        pointerEvents="none"
      />
      <Text style={[styles.markSmall, { color: ink }, glowFor(glow, ink)]}>Sapp</Text>
    </View>
  );
}

// One feline eye: an almond outline with a glowing iris and a vertical slit pupil. SVG so
// it actually reads as a cat's eye (the old version was a rounded rectangle). Static shape —
// the ignite/pulse animates the wrapper (native driver), never the SVG props.
function CatEyeSvg({ ink }: { ink: string }) {
  return (
    <Svg width={42} height={29} viewBox="0 0 58 40">
      <Path d="M2 20 Q29 1 56 20 Q29 39 2 20 Z" fill={ink + '22'} stroke={ink} strokeWidth={2.4} strokeLinejoin="round" />
      <Ellipse cx={29} cy={20} rx={12} ry={15} fill={ink} opacity={0.85} />
      <Ellipse cx={29} cy={20} rx={3.2} ry={13} fill="#000" />
      <Ellipse cx={24} cy={13} rx={3} ry={4} fill="#fff" opacity={0.5} />
    </Svg>
  );
}

// ── CAT EYES: two real feline eyes ignite in the dark (scaleY = slowly opening), then
// glow-pulse. Wrapper-only transforms → native driver. ──
function CatEyesMark({ ink, glow }: { ink: string; glow?: boolean }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 850, easing: Easing.out(Easing.cubic), useNativeDriver: true }),   // ignite (eyes open)
      Animated.timing(v, { toValue: 0.62, duration: 950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }), // glow-pulse
    ]));
    loop.start();
    return () => loop.stop();
  }, [v]);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.18, 1] });
  const scaleY = v.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] });   // lids open as they light up
  const eyeStyle = (rot: string) => [
    { opacity, transform: [{ rotate: rot }, { scaleY }] },
    glow ? { shadowColor: ink, shadowOpacity: 0.9, shadowRadius: 14, shadowOffset: { width: 0, height: 0 }, elevation: 8 } : null,
  ];
  return (
    <View style={styles.eyesCol}>
      <View style={styles.eyesRow}>
        <Animated.View style={eyeStyle('-8deg')}><CatEyeSvg ink={ink} /></Animated.View>
        <Animated.View style={eyeStyle('8deg')}><CatEyeSvg ink={ink} /></Animated.View>
      </View>
      <Animated.Text style={[styles.eyesBrand, { color: ink, opacity }]}>Sapp</Animated.Text>
    </View>
  );
}

// ── CAT: the actual companion greets you — wearing the coat/stripes/tabby you bought.
// Uses CatArt's purpose-built `lively` idle. Only mounts once the wallet is hydrated (you
// must already own+equip it), so its JS timers never compete with cold-start hydration. ──
function CatMark({ glow }: { ink: string; glow?: boolean }) {
  const catColor = usePetStore(s => s.catColor);
  const catStripes = usePetStore(s => s.catStripes);
  const catEyeColor = usePetStore(s => s.catEyeColor);
  const catNoseColor = usePetStore(s => s.catNoseColor);
  const catWhiskers = usePetStore(s => s.catWhiskers);
  const catLegStripes = usePetStore(s => s.catLegStripes);
  return (
    <View style={styles.catCol}>
      <CatArt size={156} expression="happy" animate lively palette={paletteById(catColor)} stripes={catStripes}
        eyeColor={catEyeColor} noseColor={catNoseColor} whiskers={catWhiskers} legStripes={catLegStripes} />
      <Text style={[styles.markSmall, { color: '#F2F3F3' }, glowFor(glow, '#F2F3F3')]}>Sapp</Text>
    </View>
  );
}

// ── CUSTOM: your own dropped-in animation (assets/startups/NAZWA_CENA.webp). RN Image
// loops an animated WebP/GIF natively on Android — no extra dependency, no JS-thread cost. ──
function CustomMark({ glow, asset }: { ink: string; glow?: boolean; asset?: number }) {
  if (!asset) return <BarMark ink="#F2F3F3" glow={glow} />;   // plik zniknął po rebuildzie → fallback
  return (
    <View style={styles.catCol}>
      <Image source={asset} style={styles.customImg} resizeMode="contain" fadeDuration={0} />
      <Text style={[styles.markSmall, { color: '#F2F3F3' }, glowFor(glow, '#F2F3F3')]}>Sapp</Text>
    </View>
  );
}

const MARKS: Record<SplashAnim, typeof WaveMark> = {
  bar: BarMark, wave: WaveMark, pulse: PulseMark, sweep: SweepMark, ring: RingMark, cateyes: CatEyesMark, cat: CatMark, custom: CustomMark,
};

export default function AnimatedSplash({ visible, onHidden }: { visible: boolean; onHidden: () => void }) {
  const fade = useRef(new Animated.Value(1)).current;   // START shown — seamless with native splash
  // Before hydration → free default (instant, matches native splash); the owned cosmetic
  // applies once the wallet loads (usually <100 ms; bg never changes, so no jarring flash).
  const startupId = usePetStore(s => (s._hydrated ? s.equippedStartup : 'default'));
  const cfg = startupById(startupId);
  const Mark = MARKS[cfg.anim] ?? BarMark;

  // Fade out once ready, then unmount.
  useEffect(() => {
    if (visible) return;
    Animated.timing(fade, { toValue: 0, duration: 420, easing: Easing.in(Easing.quad), useNativeDriver: true })
      .start(({ finished }) => { if (finished) onHidden(); });
  }, [visible, fade, onHidden]);

  return (
    <Animated.View style={[StyleSheet.absoluteFill, styles.root, { opacity: fade }]} pointerEvents={visible ? 'auto' : 'none'}>
      {cfg.anim === 'custom'
        ? <CustomMark ink={cfg.ink} glow={cfg.glow} asset={cfg.asset} />
        : <Mark ink={cfg.ink} glow={cfg.glow} />}
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  root: { backgroundColor: SPLASH_BG, alignItems: 'center', justifyContent: 'center', zIndex: 100 },

  // bar (default)
  barCol: { alignItems: 'center', gap: 18 },
  markSmall: { fontSize: 32, fontWeight: '900', letterSpacing: 2 },
  track: { height: 5, borderRadius: 3, overflow: 'hidden' },
  blob: { position: 'absolute', top: 0, height: 5, left: 0 },

  // wave / pulse / sweep
  row: { flexDirection: 'row', alignItems: 'center' },
  mark: { fontSize: 58, fontWeight: '900', letterSpacing: 1, marginHorizontal: 1 },
  sweepWrap: { alignItems: 'center' },
  underline: { marginTop: 12, height: 2, alignSelf: 'stretch', overflow: 'hidden' },
  underlineBase: { position: 'absolute', left: 0, right: 0, top: 0, height: 2, borderRadius: 1 },
  underlineHi: { position: 'absolute', top: 0, left: 0 },

  // ring (orbita)
  ringCol: { alignItems: 'center', gap: 20 },
  ring: { width: 64, height: 64, borderRadius: 32, borderWidth: 5 },

  // cat eyes
  eyesCol: { alignItems: 'center', gap: 16 },
  eyesRow: { flexDirection: 'row', gap: 20 },
  eyesBrand: { fontSize: 20, fontWeight: '900', letterSpacing: 2 },

  // twój kot
  catCol: { alignItems: 'center', gap: 8 },

  // custom (własna animacja z assets)
  customImg: { width: 200, height: 200 },
});
