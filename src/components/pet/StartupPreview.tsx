import { useEffect, useRef, useState } from 'react';
import { View, Text, StyleSheet, Animated, Easing, Image } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path, Ellipse } from 'react-native-svg';
import { Startup, SPLASH_BG } from '@/utils/petStartups';
import { usePetStore } from '@/store/petStore';
import { paletteById } from '@/utils/catPalettes';
import CatArt from '@/components/pet/CatArt';

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

function RingMark({ ink, glow, fs }: { ink: string; glow?: boolean; fs: number }) {
  const v = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(v, { toValue: 1, duration: 1050, easing: Easing.linear, useNativeDriver: true }));
    loop.start(); return () => loop.stop();
  }, [v]);
  const rot = v.interpolate({ inputRange: [0, 1], outputRange: ['0deg', '360deg'] });
  const d = Math.round(fs * 1.7), bw = Math.max(3, Math.round(fs * 0.14));
  return (
    <View style={{ alignItems: 'center', gap: 8 }}>
      <Animated.View style={[{ width: d, height: d, borderRadius: d / 2, borderWidth: bw, borderColor: ink + '22', borderTopColor: ink, transform: [{ rotate: rot }] },
        glow ? { shadowColor: ink, shadowOpacity: 0.8, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 5 } : null]} />
      <Text style={[{ fontSize: Math.round(fs * 0.62), fontWeight: '900', letterSpacing: 1, color: ink }, glowFor(glow, ink)]}>Sapp</Text>
    </View>
  );
}

function CatEyeSvg({ ink, fs }: { ink: string; fs: number }) {
  const w = Math.round(fs * 1.9), h = Math.round(fs * 1.3);
  return (
    <Svg width={w} height={h} viewBox="0 0 58 40">
      <Path d="M2 20 Q29 1 56 20 Q29 39 2 20 Z" fill={ink + '22'} stroke={ink} strokeWidth={2.4} strokeLinejoin="round" />
      <Ellipse cx={29} cy={20} rx={12} ry={15} fill={ink} opacity={0.85} />
      <Ellipse cx={29} cy={20} rx={3.2} ry={13} fill="#000" />
      <Ellipse cx={24} cy={13} rx={3} ry={4} fill="#fff" opacity={0.5} />
    </Svg>
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
  const opacity = v.interpolate({ inputRange: [0, 1], outputRange: [0.18, 1] });
  const scaleY = v.interpolate({ inputRange: [0, 1], outputRange: [0.12, 1] });
  const eye = (rot: string) => [
    { opacity, transform: [{ rotate: rot }, { scaleY }] },
    glow ? { shadowColor: ink, shadowOpacity: 0.9, shadowRadius: 8, shadowOffset: { width: 0, height: 0 }, elevation: 6 } : null,
  ];
  return (
    <View style={{ alignItems: 'center', gap: 6 }}>
      <View style={{ flexDirection: 'row', gap: Math.round(fs * 0.7) }}>
        <Animated.View style={eye('-8deg')}><CatEyeSvg ink={ink} fs={fs} /></Animated.View>
        <Animated.View style={eye('8deg')}><CatEyeSvg ink={ink} fs={fs} /></Animated.View>
      </View>
      <Animated.Text style={{ fontSize: Math.round(fs * 0.62), fontWeight: '900', letterSpacing: 1, color: ink, opacity }}>Sapp</Animated.Text>
    </View>
  );
}

function CatMark({ height }: { height: number }) {
  const catColor = usePetStore(s => s.catColor);
  const catStripes = usePetStore(s => s.catStripes);
  const catTabby = usePetStore(s => s.catTabby);
  const catEyeColor = usePetStore(s => s.catEyeColor);
  const catWhiskers = usePetStore(s => s.catWhiskers);
  const catLegStripes = usePetStore(s => s.catLegStripes);
  const catForeheadM = usePetStore(s => s.catForeheadM);
  return <CatArt size={Math.round(height * 0.92)} expression="happy" animate lively palette={paletteById(catColor)} stripes={catStripes} tabby={catTabby}
    eyeColor={catEyeColor} whiskers={catWhiskers} legStripes={catLegStripes} foreheadM={catForeheadM} />;
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
        : anim === 'ring' ? <RingMark ink={ink} glow={glow} fs={fontSize} />
        : anim === 'cat' ? <CatMark height={height} />
        : anim === 'custom' ? (startup.asset
            ? <Image source={startup.asset} style={{ width: Math.round(height * 0.92), height: Math.round(height * 0.92) }} resizeMode="contain" fadeDuration={0} />
            : <Text style={{ color: ink, fontSize: Math.round(fontSize * 0.5) }}>brak pliku</Text>)
        : <CatEyesMark ink={ink} glow={glow} fs={fontSize} />}
    </View>
  );
}

const st = StyleSheet.create({
  box: { width: '100%', borderRadius: 12, alignItems: 'center', justifyContent: 'center', overflow: 'hidden' },
  row: { flexDirection: 'row', alignItems: 'center' },
});
