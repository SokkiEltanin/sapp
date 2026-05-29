import { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { Circle } from 'react-native-svg';
import type { TimeOfDay } from '@/hooks/useTimeAccent';

// ─── Stars (night / dawn / evening) ──────────────────────────────────────────

const STAR_COUNT = 18;

function StarField() {
  const stars = useMemo(() =>
    Array.from({ length: STAR_COUNT }, () => ({
      lx: 5 + Math.random() * 90,
      ly: 5 + Math.random() * 88,
      sz: 1 + Math.random() * 1.5,
      opacity: new Animated.Value(0.04 + Math.random() * 0.18),
      twDur:   1400 + Math.random() * 2600,
      delay:   Math.random() * 4000,
    })),
  []);

  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    stars.forEach(s => {
      const t = setTimeout(() => {
        if (!alive) return;
        const anim = Animated.loop(Animated.sequence([
          Animated.timing(s.opacity, { toValue: 0.5 + Math.random() * 0.3, duration: s.twDur, useNativeDriver: true }),
          Animated.timing(s.opacity, { toValue: 0.02 + Math.random() * 0.06, duration: s.twDur, useNativeDriver: true }),
        ]));
        anim.start();
        loops.current.push(anim);
      }, s.delay);
      timers.push(t);
    });

    return () => {
      alive = false;
      timers.forEach(clearTimeout);
      loops.current.forEach(l => l.stop());
      loops.current = [];
    };
  }, []);

  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      {stars.map((s, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            left:   `${s.lx}%` as any,
            top:    `${s.ly}%` as any,
            width:  s.sz,
            height: s.sz,
            borderRadius: s.sz,
            backgroundColor: '#FFFFFF',
            opacity: s.opacity,
          }}
        />
      ))}
    </View>
  );
}

// ─── Cloud (SVG circles of same fill merge into seamless shape) ───────────────

function CloudSvg({ w, h }: { w: number; h: number }) {
  return (
    <Svg width={w} height={h}>
      <Circle cx={w * 0.50} cy={h * 0.74} r={h * 0.26} fill="white" />
      <Circle cx={w * 0.22} cy={h * 0.64} r={h * 0.24} fill="white" />
      <Circle cx={w * 0.44} cy={h * 0.42} r={h * 0.32} fill="white" />
      <Circle cx={w * 0.66} cy={h * 0.50} r={h * 0.26} fill="white" />
      <Circle cx={w * 0.80} cy={h * 0.68} r={h * 0.22} fill="white" />
    </Svg>
  );
}

// ─── Cloud layer ──────────────────────────────────────────────────────────────

const CLOUD_DEFS = [
  { w: 180, h: 56, initX: -220, y:  4, dur: 28000, op: 0.07 },
  { w: 140, h: 44, initX:  -60, y: 30, dur: 22000, op: 0.06 },
  { w: 200, h: 64, initX:  110, y: 10, dur: 36000, op: 0.06 },
];

function CloudLayer() {
  const xAnims = useMemo(() =>
    CLOUD_DEFS.map(c => new Animated.Value(c.initX)),
  []);

  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    CLOUD_DEFS.forEach((c, i) => {
      const anim = Animated.loop(Animated.sequence([
        Animated.timing(xAnims[i], { toValue: 460, duration: c.dur, useNativeDriver: true }),
        Animated.timing(xAnims[i], { toValue: c.initX, duration: 0, useNativeDriver: true }),
      ]));
      anim.start();
      loops.current.push(anim);
    });
    return () => {
      loops.current.forEach(l => l.stop());
      loops.current = [];
    };
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      {CLOUD_DEFS.map((c, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute',
            top: c.y,
            left: 0,
            opacity: c.op,
            transform: [{ translateX: xAnims[i] }],
          }}
        >
          <CloudSvg w={c.w} h={c.h} />
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

interface Props { timeOfDay: TimeOfDay; }

export default function AnimatedCardBg({ timeOfDay }: Props) {
  const isNight = timeOfDay === 'night' || timeOfDay === 'evening' || timeOfDay === 'dawn';
  return isNight ? <StarField /> : <CloudLayer />;
}
