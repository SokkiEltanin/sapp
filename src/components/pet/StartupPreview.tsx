import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { Startup, SPLASH_BG } from '@/utils/petStartups';

// Kompaktowy, ŻYWY podgląd animacji startupu (do sklepu pupila). Te same 5 rodzajów co
// AnimatedSplash (bar/wave/pulse/sweep/cateyes), ale w małym boksie i skalowane fontSize.
// CELOWO osobny plik — nie ruszamy AnimatedSplash (to pierwszy ekran apki). Native driver.

const LETTERS = ['S', 'a', 'p', 'p'];
const glowFor = (g: boolean | undefined, ink: string) =>
  g ? { textShadowColor: ink + 'AA', textShadowOffset: { width: 0, height: 0 }, textShadowRadius: 10 } : null;

function WaveMark({ ink, glow, fs }: { ink: string; glow?: boolean; fs: number }) {
  const vals = useRef(LETTERS.map(() => new Animated.Value(0))).current;
  useEffect(() => {
    const N = LETTERS.length, STEP = 130;
    const anims = vals.map((v, i) => Animated.loop(Animated.sequence([
      Animated.delay(i * STEP),
      Animated.timing(v, { toValue: 1, duration: 400, easing: Easing.out(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 400, easing: Easing.in(Easing.sin), useNativeDriver: true }),
      Animated.delay((N - i) * STEP + 280),
    ])));
    const g = Animated.parallel(anims); g.start();
    return () => g.stop();
  }, [vals]);
  return (
    <View style={st.row}>
      {LETTERS.map((ch, i) => (
        <Animated.Text key={i} style={[{ fontSize: fs, fontWeight: '900', letterSpacing: 1, color: ink }, glowFor(glow, ink), {
          opacity: vals[i].interpolate({ inputRange: [0, 1], outputRange: [0.34, 1] }),
          transform: [{ translateY: vals[i].interpolate({ inputRange: [0, 1], outputRange: [1.5, -1.5] }) }],
        }]}>{ch}</Animated.Text>
      ))}
    </View>
  );
}

function PulseMark({ ink, glow, fs }: { ink: string; glow?: boolean; fs: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 950, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [v]);
  return (
    <Animated.Text style={[{ fontSize: fs, fontWeight: '900', letterSpacing: 1, color: ink }, glowFor(glow, ink), {
      opacity: v.interpolate({ inputRange: [0, 1], outputRange: [0.5, 1] }),
      transform: [{ scale: v.interpolate({ inputRange: [0, 1], outputRange: [0.97, 1.05] }) }],
    }]}>Sapp</Animated.Text>
  );
}

function BarMark({ ink, glow, fs, w }: { ink: string; glow?: boolean; fs: number; w: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 800, easing: Easing.inOut(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [v]);
  const TRACK = Math.max(60, w - 24), BLOB = Math.round(TRACK * 0.42);
  const x = v.interpolate({ inputRange: [0, 1], outputRange: [-BLOB * 0.5, TRACK - BLOB * 0.5] });
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Text style={[{ fontSize: fs, fontWeight: '900', letterSpacing: 1, color: ink }, glowFor(glow, ink)]}>Sapp</Text>
      <View style={{ width: TRACK, height: 4, borderRadius: 2, overflow: 'hidden', backgroundColor: ink + '16' }}>
        <Animated.View style={{ position: 'absolute', top: 0, height: 4, left: 0, transform: [{ translateX: x }] }} pointerEvents="none">
          <LinearGradient colors={['transparent', ink, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width: BLOB, height: 4 }} />
        </Animated.View>
      </View>
    </View>
  );
}

function SweepMark({ ink, glow, fs, w }: { ink: string; glow?: boolean; fs: number; w: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 950, easing: Easing.inOut(Easing.cubic), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0, duration: 0, useNativeDriver: true }),
      Animated.delay(420),
    ]));
    loop.start(); return () => loop.stop();
  }, [v]);
  const uw = Math.max(50, Math.min(w - 40, fs * 4)), bar = Math.round(uw * 0.5);
  const x = v.interpolate({ inputRange: [0, 1], outputRange: [-bar, uw + bar] });
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Text style={[{ fontSize: fs, fontWeight: '900', letterSpacing: 1, color: ink }, glowFor(glow, ink)]}>Sapp</Text>
      <View style={{ width: uw, height: 2, overflow: 'hidden' }}>
        <View style={{ position: 'absolute', left: 0, right: 0, top: 0, height: 2, borderRadius: 1, backgroundColor: ink + '22' }} />
        <Animated.View style={{ position: 'absolute', top: 0, left: 0, transform: [{ translateX: x }] }} pointerEvents="none">
          <LinearGradient colors={['transparent', ink, 'transparent']} start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }} style={{ width: bar, height: 2 }} />
        </Animated.View>
      </View>
    </View>
  );
}

function CatEyesMark({ ink, glow, fs }: { ink: string; glow?: boolean; fs: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(v, { toValue: 1, duration: 750, easing: Easing.out(Easing.cubic), useNativeDriver: true }),
      Animated.timing(v, { toValue: 0.62, duration: 900, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start(); return () => loop.stop();
  }, [v]);
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.28, 1] });
  const scale = v.interpolate({ inputRange: [0, 1], outputRange: [0.82, 1] });
  const ew = Math.round(fs * 1.5), eh = Math.round(fs * 0.9);
  const eye = (rot: string) => [
    { width: ew, height: eh, borderRadius: eh * 0.55, borderWidth: 1.6, borderColor: ink, backgroundColor: ink + '26',
      alignItems: 'center' as const, justifyContent: 'center' as const, opacity, transform: [{ scale }, { rotate: rot }] },
    glow ? { shadowColor: ink, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6 } : null,
  ];
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: Math.round(fs * 0.8) }}>
        <Animated.View style={eye('-10deg')}><View style={{ width: 2.5, height: eh * 0.7, borderRadius: 2, backgroundColor: '#000' }} /></Animated.View>
        <Animated.View style={eye('10deg')}><View style={{ width: 2.5, height: eh * 0.7, borderRadius: 2, backgroundColor: '#000' }} /></Animated.View>
      </View>
      <Animated.Text style={{ fontSize: Math.round(fs * 0.7), fontWeight: '900', letterSpacing: 1, color: ink, opacity }}>Sapp</Animated.Text>
    </View>
  );
}

export default function StartupPreview({ startup, height = 88, fontSize = 30 }: { startup: Startup; height?: number; fontSize?: number }) {
  const [w, setW] = useState(0);
  const { anim, ink, glow } = startup;
  return (
    <View style={[st.box, { height, backgroundColor: SPLASH_BG }]} onLayout={e => setW(e.nativeEvent.layout.width)}>
      {anim === 'bar' ? <BarMark ink={ink} glow={glow} fs={fontSize} w={w} />
        : anim === 'wave' ? <WaveMark ink={ink} glow={glow} fs={fontSize} />
        : anim === 'pulse' ? <PulseMark ink={ink} glow={glow} fs={fontSize} />
        : anim === 'sweep' ? <SweepMark ink={ink} glow={glow} fs={fontSize} w={w} />
        : <CatEyesMark ink={ink} glow={glow} fs={fontSize} />}
    </View>
  );
}

const st = StyleSheet.create({
  box: { width: '100%', borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
