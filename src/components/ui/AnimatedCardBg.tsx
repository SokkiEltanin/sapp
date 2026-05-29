import { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { Path, Defs, Filter, FeGaussianBlur } from 'react-native-svg';
import type { TimeOfDay } from '@/hooks/useTimeAccent';

// ─── Stars (night / dawn / evening) ──────────────────────────────────────────

const STAR_COUNT = 18;

function StarField() {
  const stars = useMemo(() =>
    Array.from({ length: STAR_COUNT }, () => ({
      lx:    5 + Math.random() * 90,
      ly:    5 + Math.random() * 88,
      sz:    1 + Math.random() * 1.5,
      opacity: new Animated.Value(0.04 + Math.random() * 0.18),
      twDur: 1400 + Math.random() * 2600,
      delay: Math.random() * 4000,
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

// ─── Cloud silhouettes ────────────────────────────────────────────────────────
// 3 distinct bezier-path cloud shapes, all fit within viewBox "0 0 100 55"

const CLOUD_PATHS = [
  // Wide cloud with 3 bumps
  'M 8 52 Q 0 52 0 42 Q 0 28 16 26 Q 10 6 30 6 Q 38 -2 52 8 Q 62 2 74 12 Q 86 8 90 24 Q 98 22 100 36 Q 100 52 84 52 Z',
  // Round puffy cloud
  'M 10 50 Q 0 50 0 38 Q 0 22 14 20 Q 8 2 28 2 Q 38 -4 50 6 Q 60 0 68 10 Q 80 6 84 22 Q 90 24 90 38 Q 90 50 74 50 Z',
  // Elongated wispy cloud
  'M 6 46 Q 0 46 0 38 Q 0 28 12 26 Q 6 10 24 10 Q 32 4 44 14 Q 54 6 68 16 Q 78 10 86 22 Q 96 20 100 32 Q 100 46 88 46 Z',
];

function CloudSvg({ shape, blurId }: { shape: number; blurId: string }) {
  return (
    <Svg
      width="100%"
      height="100%"
      viewBox="0 0 100 55"
      style={StyleSheet.absoluteFill}
    >
      <Defs>
        <Filter
          id={blurId}
          x="-15%"
          y="-15%"
          width="130%"
          height="130%"
        >
          <FeGaussianBlur stdDeviation="2" />
        </Filter>
      </Defs>
      <Path
        d={CLOUD_PATHS[shape]}
        fill="white"
        filter={`url(#${blurId})`}
      />
    </Svg>
  );
}

// ─── Cloud layer ──────────────────────────────────────────────────────────────

const CLOUD_DEFS = [
  { shape: 0, w: 200, h: 65, initX: -240, y:  2, dur: 32000, op: 0.11 },
  { shape: 1, w: 155, h: 55, initX:  -70, y: 22, dur: 24000, op: 0.10 },
  { shape: 2, w: 220, h: 62, initX:  100, y:  8, dur: 42000, op: 0.09 },
];

function CloudLayer() {
  const xAnims = useMemo(() =>
    CLOUD_DEFS.map(c => new Animated.Value(c.initX)),
  []);

  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    CLOUD_DEFS.forEach((c, i) => {
      const anim = Animated.loop(Animated.sequence([
        Animated.timing(xAnims[i], { toValue: 480, duration: c.dur, useNativeDriver: true }),
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
            top:    c.y,
            left:   0,
            width:  c.w,
            height: c.h,
            opacity: c.op,
            transform: [{ translateX: xAnims[i] }],
          }}
        >
          <CloudSvg shape={c.shape} blurId={`cloud-blur-${i}`} />
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
