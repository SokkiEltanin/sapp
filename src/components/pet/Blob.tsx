import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View, StyleSheet, Text } from 'react-native';
import Svg, { Defs, RadialGradient, LinearGradient as SvgLinear, Stop, Ellipse, Circle, Path, G } from 'react-native-svg';
import { PetExpression } from '@/utils/petState';
import { haptic } from '@/utils/haptics';
import { HatArt, GlassesArt, HeldArt } from '@/components/pet/BlobItems';

// The companion blob — a clean, Duolingo-style vector character: big expressive
// eyes, a soft belly, little feet, and fluid, gentle motion (subtle breathing +
// sway + blink + a springy hop on tap). No harsh rubber-band stretching.

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

// expression → face parameters
interface FaceCfg { lid: number; pupilDX: number; pupilDY: number; brow: 'none' | 'sad' | 'angry'; mouth: string; mouthFill: boolean; cheeks: boolean; tear: boolean; sweat: boolean }
const FACES: Record<PetExpression, FaceCfg> = {
  happy:    { lid: 0,    pupilDX: 0, pupilDY: -0.3, brow: 'none', mouth: 'M41 63 Q50 74 59 63 Q50 69 41 63 Z', mouthFill: true,  cheeks: true,  tear: false, sweat: false },
  content:  { lid: 0.12, pupilDX: 0, pupilDY: 0,    brow: 'none', mouth: 'M43 64 Q50 71 57 64',                 mouthFill: false, cheeks: true,  tear: false, sweat: false },
  meh:      { lid: 0.45, pupilDX: 0, pupilDY: 0.6,  brow: 'none', mouth: 'M44 66 H56',                          mouthFill: false, cheeks: false, tear: false, sweat: false },
  sad:      { lid: 0.32, pupilDX: 0, pupilDY: 1.4,  brow: 'sad',  mouth: 'M43 68 Q50 61 57 68',                 mouthFill: false, cheeks: false, tear: true,  sweat: false },
  sick:     { lid: 0.5,  pupilDX: 0, pupilDY: 0.4,  brow: 'none', mouth: 'M43 66 q3.5 4 7 0 q3.5 -4 7 0',       mouthFill: false, cheeks: false, tear: false, sweat: true  },
  sleeping: { lid: 1,    pupilDX: 0, pupilDY: 0,    brow: 'none', mouth: 'M47 65 Q50 68 53 65',                 mouthFill: false, cheeks: false, tear: false, sweat: false },
};

export default function Blob({
  color, expression, size = 120, onPress, animate = true, equipped,
}: { color: string; expression: PetExpression; size?: number; onPress?: () => void; animate?: boolean; equipped?: { hat?: string; face?: string; held?: string } }) {
  // `equipped` holds cosmetic IDS (not emoji) — drawn as custom SVG that fits the blob.
  const breathe = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const hop = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);
  const asleep = expression === 'sleeping';

  // gentle breathing + slow sway (fluid, never rubbery)
  useEffect(() => {
    if (!animate) return;
    const b = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: asleep ? 2800 : 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: asleep ? 2800 : 2100, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    const sw = Animated.loop(Animated.sequence([
      Animated.timing(sway, { toValue: 1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(sway, { toValue: -1, duration: 3200, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    b.start(); sw.start();
    return () => { b.stop(); sw.stop(); };
  }, [animate, asleep]);

  useEffect(() => {
    if (!animate || asleep) return;
    let t: any;
    const schedule = () => { t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 130); schedule(); }, 2600 + Math.random() * 2800); };
    schedule();
    return () => clearTimeout(t);
  }, [animate, asleep]);

  const onTap = () => {
    haptic.tap();
    Animated.sequence([
      Animated.timing(hop, { toValue: 1, duration: 200, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.spring(hop, { toValue: 0, friction: 4.5, tension: 80, useNativeDriver: true }),
    ]).start();
    onPress?.();
  };

  const amp = asleep ? 0.02 : 0.028;                       // subtle breathing, no wild stretch
  const scale = breathe.interpolate({ inputRange: [0, 1], outputRange: [1 - amp, 1 + amp] });
  const bob = breathe.interpolate({ inputRange: [0, 1], outputRange: [size * 0.012, -size * 0.012] });
  const rot = sway.interpolate({ inputRange: [-1, 1], outputRange: ['-2.2deg', '2.2deg'] });
  const hopY = hop.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.14] });
  const hopSquash = hop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.06] });

  const f = FACES[expression];
  const dark = shade(color, -78);
  const belly = shade(color, 46);
  const foot = '#F5A03C';

  return (
    <Pressable onPress={onTap} hitSlop={12}>
      <Animated.View style={{ transform: [{ translateY: hopY }] }}>
        <Animated.View style={{ transform: [{ translateY: bob }, { rotate: rot }, { scale }, { scaleY: hopSquash }] }}>
          <Svg width={size} height={size} viewBox="0 0 100 105">
            <Defs>
              <RadialGradient id="body" cx="42%" cy="32%" r="75%">
                <Stop offset="0" stopColor={shade(color, 40)} />
                <Stop offset="0.6" stopColor={color} />
                <Stop offset="1" stopColor={shade(color, -30)} />
              </RadialGradient>
              <SvgLinear id="bellyG" x1="0" y1="0" x2="0" y2="1">
                <Stop offset="0" stopColor={belly} stopOpacity={0.55} />
                <Stop offset="1" stopColor={belly} stopOpacity={0.15} />
              </SvgLinear>
            </Defs>

            {/* ground shadow */}
            <Ellipse cx="50" cy="99" rx="28" ry="4.5" fill="#000" opacity={0.16} />
            {/* feet */}
            <Ellipse cx="39" cy="94" rx="8" ry="5" fill={foot} />
            <Ellipse cx="61" cy="94" rx="8" ry="5" fill={foot} />
            {/* body */}
            <Ellipse cx="50" cy="52" rx="39" ry="40" fill="url(#body)" />
            {/* belly */}
            <Ellipse cx="50" cy="62" rx="26" ry="26" fill="url(#bellyG)" />
            {/* top gloss */}
            <Ellipse cx="37" cy="26" rx="13" ry="9" fill="#fff" opacity={0.3} />

            <HeldArt id={equipped?.held} />
            <Face f={f} blink={blink} dark={dark} bodyColor={color} />
            <GlassesArt id={equipped?.face} />
            <HatArt id={equipped?.hat} />
          </Svg>
          {asleep && <SleepZs size={size} />}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function Eye({ cx, f, blink, dark, bodyColor }: { cx: number; f: FaceCfg; blink: boolean; dark: string; bodyColor: string }) {
  const eyeY = 45, rx = 8.5, ry = 10;
  const closed = blink || f.lid >= 1;
  if (closed) {
    // happy/sleepy closed eye = a downward lash curve
    return <Path d={`M${cx - 7} ${eyeY - 1} Q${cx} ${eyeY + 5} ${cx + 7} ${eyeY - 1}`} stroke={dark} strokeWidth={2.6} strokeLinecap="round" fill="none" />;
  }
  const px = cx + f.pupilDX * 4;
  const py = eyeY + f.pupilDY * 3;
  // eyelid: a body-coloured ellipse sliding down from the top by `lid`
  const lidCy = eyeY - ry * 2 * (1 - f.lid);
  return (
    <G>
      <Ellipse cx={cx} cy={eyeY} rx={rx} ry={ry} fill="#FFFFFF" />
      <Circle cx={px} cy={py} r={4.2} fill={dark} />
      <Circle cx={px - 1.6} cy={py - 2} r={1.6} fill="#fff" />
      {f.lid > 0 && <Ellipse cx={cx} cy={lidCy} rx={rx + 0.6} ry={ry} fill={bodyColor} />}
    </G>
  );
}

function Face({ f, blink, dark, bodyColor }: { f: FaceCfg; blink: boolean; dark: string; bodyColor: string }) {
  return (
    <G>
      {f.brow === 'sad' && <>
        <Path d="M29 33 Q35 31 40 34" stroke={dark} strokeWidth={2.4} strokeLinecap="round" fill="none" />
        <Path d="M60 34 Q65 31 71 33" stroke={dark} strokeWidth={2.4} strokeLinecap="round" fill="none" />
      </>}
      {f.brow === 'angry' && <>
        <Path d="M30 32 L40 36" stroke={dark} strokeWidth={2.6} strokeLinecap="round" />
        <Path d="M70 32 L60 36" stroke={dark} strokeWidth={2.6} strokeLinecap="round" />
      </>}
      <Eye cx={35} f={f} blink={blink} dark={dark} bodyColor={bodyColor} />
      <Eye cx={65} f={f} blink={blink} dark={dark} bodyColor={bodyColor} />
      {f.cheeks && <>
        <Ellipse cx="26" cy="56" rx="5" ry="3.2" fill="#FF8FA3" opacity={0.35} />
        <Ellipse cx="74" cy="56" rx="5" ry="3.2" fill="#FF8FA3" opacity={0.35} />
      </>}
      <Path d={f.mouth} stroke={dark} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill={f.mouthFill ? dark : 'none'} />
      {f.tear && <Path d="M31 50 q-2.4 5 0 7.5 q2.4 -2.5 0 -7.5 z" fill="#8CC7FF" />}
      {f.sweat && <Path d="M70 44 q2.4 5 0 7.5 q-2.4 -2.5 0 -7.5 z" fill="#BFE3F5" />}
    </G>
  );
}

function SleepZs({ size }: { size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 2600, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const y = a.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.28] });
  const op = a.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View style={[zs.wrap, { right: size * 0.14, top: size * 0.08, opacity: op, transform: [{ translateY: y }] }]}>
      <Text style={[zs.z, { fontSize: size * 0.15 }]}>z</Text>
    </Animated.View>
  );
}

const zs = StyleSheet.create({
  wrap: { position: 'absolute' },
  z: { color: '#B9B0E8', fontWeight: '900' },
});
