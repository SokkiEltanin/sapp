import { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Pressable, View, StyleSheet, Text } from 'react-native';
import Svg, { Defs, RadialGradient, Stop, Ellipse, Circle, Path, Line, G } from 'react-native-svg';
import { PetExpression } from '@/utils/petState';
import { haptic } from '@/utils/haptics';

// The companion blob. One squishy SVG body + a vector face whose expression is
// driven by the pet's mood. Idle = gentle squash-stretch breathing + bob + blink;
// tap = a happy spring bounce. Cheap to run (transforms on the native driver).

function shade(hex: string, amt: number): string {
  const n = parseInt(hex.slice(1), 16);
  let r = (n >> 16) & 255, g = (n >> 8) & 255, b = n & 255;
  r = Math.max(0, Math.min(255, Math.round(r + amt)));
  g = Math.max(0, Math.min(255, Math.round(g + amt)));
  b = Math.max(0, Math.min(255, Math.round(b + amt)));
  return `#${((1 << 24) + (r << 16) + (g << 8) + b).toString(16).slice(1)}`;
}

export default function Blob({
  color, expression, size = 120, onPress, animate = true,
}: { color: string; expression: PetExpression; size?: number; onPress?: () => void; animate?: boolean }) {
  const breathe = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const [blink, setBlink] = useState(false);
  const asleep = expression === 'sleeping';

  // idle breathing (squash-stretch) + bob
  useEffect(() => {
    if (!animate) return;
    const dur = asleep ? 2600 : 1500;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(breathe, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(breathe, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [animate, asleep]);

  // blink every few seconds (skip while asleep — eyes already closed)
  useEffect(() => {
    if (!animate || asleep) return;
    let t: any;
    const schedule = () => {
      t = setTimeout(() => { setBlink(true); setTimeout(() => setBlink(false), 120); schedule(); }, 2400 + Math.random() * 2600);
    };
    schedule();
    return () => clearTimeout(t);
  }, [animate, asleep]);

  const onTap = () => {
    haptic.tap();
    pop.setValue(0);
    Animated.spring(pop, { toValue: 1, friction: 4, tension: 90, useNativeDriver: true }).start(() => pop.setValue(0));
    onPress?.();
  };

  const amp = asleep ? 0.03 : 0.06;
  const scaleX = breathe.interpolate({ inputRange: [0, 1], outputRange: [1 - amp, 1 + amp] });
  const scaleY = breathe.interpolate({ inputRange: [0, 1], outputRange: [1 + amp, 1 - amp] });
  const bob = breathe.interpolate({ inputRange: [0, 1], outputRange: [size * 0.02, -size * 0.02] });
  const popScale = pop.interpolate({ inputRange: [0, 0.5, 1], outputRange: [1, 1.14, 1] });

  return (
    <Pressable onPress={onTap} hitSlop={12}>
      <Animated.View style={{ transform: [{ scale: popScale }] }}>
        <Animated.View style={{ transform: [{ translateY: bob }, { scaleX }, { scaleY }] }}>
          <Svg width={size} height={size} viewBox="0 0 100 100">
            <Defs>
              <RadialGradient id="body" cx="42%" cy="34%" r="72%">
                <Stop offset="0" stopColor={shade(color, 42)} />
                <Stop offset="0.55" stopColor={color} />
                <Stop offset="1" stopColor={shade(color, -34)} />
              </RadialGradient>
            </Defs>
            {/* ground shadow */}
            <Ellipse cx="50" cy="93" rx="30" ry="5" fill="#000" opacity={0.16} />
            {/* body */}
            <Ellipse cx="50" cy="55" rx="40" ry="36" fill="url(#body)" />
            {/* glossy highlight */}
            <Ellipse cx="36" cy="34" rx="12" ry="8" fill="#fff" opacity={0.28} />
            <Face expression={expression} blink={blink} accent={shade(color, -70)} />
          </Svg>
          {asleep && <SleepZs size={size} />}
        </Animated.View>
      </Animated.View>
    </Pressable>
  );
}

function Face({ expression, blink, accent }: { expression: PetExpression; blink: boolean; accent: string }) {
  const eyeY = 50;
  const lx = 37, rx = 63;
  const closed = blink || expression === 'sleeping';

  const Eye = ({ cx }: { cx: number }) => {
    if (closed) return <Line x1={cx - 6} y1={eyeY} x2={cx + 6} y2={eyeY} stroke={accent} strokeWidth={2.6} strokeLinecap="round" />;
    if (expression === 'sick') return <Line x1={cx - 5} y1={eyeY - 4} x2={cx + 5} y2={eyeY + 4} stroke={accent} strokeWidth={2.4} strokeLinecap="round" />; // half-dizzy \
    if (expression === 'sad') {
      // droopy eye: circle with a heavy upper lid
      return <G><Circle cx={cx} cy={eyeY + 1} r={4.4} fill={accent} /><Line x1={cx - 6} y1={eyeY - 3} x2={cx + 5} y2={eyeY - 1} stroke={accent} strokeWidth={2.4} strokeLinecap="round" /></G>;
    }
    // normal round eye with a highlight
    return <G><Circle cx={cx} cy={eyeY} r={5} fill={accent} /><Circle cx={cx - 1.6} cy={eyeY - 1.8} r={1.5} fill="#fff" /></G>;
  };

  const mouth = MOUTHS[expression];

  return (
    <G>
      <Eye cx={lx} />
      <Eye cx={rx} />
      {/* cheeks on happy/content */}
      {(expression === 'happy' || expression === 'content') && (
        <G>
          <Ellipse cx={lx - 6} cy={eyeY + 9} rx={4} ry={2.6} fill="#fff" opacity={0.22} />
          <Ellipse cx={rx + 6} cy={eyeY + 9} rx={4} ry={2.6} fill="#fff" opacity={0.22} />
        </G>
      )}
      <Path d={mouth} stroke={accent} strokeWidth={2.8} strokeLinecap="round" strokeLinejoin="round" fill={expression === 'happy' ? accent : 'none'} />
      {/* tear when sad, sweat when sick */}
      {expression === 'sad' && <Path d="M31 58 q-2 5 0 7 q2 -2 0 -7 z" fill="#8CC7FF" />}
      {expression === 'sick' && <Path d="M69 54 q2 5 0 7 q-2 -2 0 -7 z" fill="#BFE3B0" />}
    </G>
  );
}

// mouth path per expression (viewBox 0..100, mouth around y=64)
const MOUTHS: Record<PetExpression, string> = {
  happy:    'M40 62 q10 12 20 0 q-10 4 -20 0 z',
  content:  'M42 63 q8 7 16 0',
  meh:      'M43 65 h14',
  sad:      'M42 67 q8 -7 16 0',
  sick:     'M42 65 q4 4 8 0 q4 -4 8 0',
  sleeping: 'M46 64 q4 3 8 0',
};

function SleepZs({ size }: { size: number }) {
  const a = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    const loop = Animated.loop(Animated.timing(a, { toValue: 1, duration: 2400, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, []);
  const y = a.interpolate({ inputRange: [0, 1], outputRange: [0, -size * 0.28] });
  const op = a.interpolate({ inputRange: [0, 0.2, 0.8, 1], outputRange: [0, 1, 1, 0] });
  return (
    <Animated.View style={[zs.wrap, { right: size * 0.12, top: size * 0.06, opacity: op, transform: [{ translateY: y }] }]}>
      <Text style={[zs.z, { fontSize: size * 0.16 }]}>z</Text>
    </Animated.View>
  );
}

const zs = StyleSheet.create({
  wrap: { position: 'absolute' },
  z: { color: '#B9B0E8', fontWeight: '900' },
});
