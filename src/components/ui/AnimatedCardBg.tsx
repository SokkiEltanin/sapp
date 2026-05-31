import { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { Circle, G, Defs, Filter, FeGaussianBlur } from 'react-native-svg';
import type { TimeOfDay } from '@/hooks/useTimeAccent';

// ─── Stars (night / dawn / evening) ──────────────────────────────────────────

const STAR_COUNT = 20;

function StarField() {
  const stars = useMemo(() =>
    Array.from({ length: STAR_COUNT }, () => ({
      lx:    5 + Math.random() * 90,
      ly:    5 + Math.random() * 88,
      sz:    0.8 + Math.random() * 1.6,
      opacity: new Animated.Value(0.04 + Math.random() * 0.14),
      twDur: 1600 + Math.random() * 2800,
      delay: Math.random() * 5000,
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
          Animated.timing(s.opacity, { toValue: 0.45 + Math.random() * 0.35, duration: s.twDur, useNativeDriver: true }),
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

// ─── Cloud (overlapping circles — MUST use r > gap/2 so they merge) ──────────
//
// Key insight: adjacent circles spaced 0.19*w apart need r > 0.095*w to merge.
// We use r = w/8 = 0.125*w which guarantees clean merging.
// feGaussianBlur on the group softens edges into natural cloud texture.

type CloudDef = { w: number; h: number; initX: number; y: number; dur: number; op: number };

// 3 cloud shapes defined as fractions: [cx_frac, cy_frac, r_scale]
// r = r_scale * (w / 8)
const CLOUD_SHAPES = [
  // Compact cumulus (5 circles, 3 rows: base/body/peak)
  [
    [0.15, 0.80, 0.80], [0.38, 0.80, 0.90], [0.62, 0.80, 0.90], [0.85, 0.80, 0.80],
    [0.28, 0.54, 0.95], [0.55, 0.48, 1.15], [0.78, 0.54, 0.95],
    [0.52, 0.22, 0.95],
  ],
  // Wide flat cloud (more horizontal spread)
  [
    [0.10, 0.82, 0.75], [0.28, 0.82, 0.85], [0.50, 0.82, 0.88], [0.72, 0.82, 0.85], [0.90, 0.82, 0.75],
    [0.22, 0.56, 0.90], [0.50, 0.50, 1.05], [0.76, 0.56, 0.90],
  ],
  // Tall puffy (strong vertical development)
  [
    [0.18, 0.82, 0.80], [0.42, 0.82, 0.92], [0.66, 0.82, 0.92], [0.88, 0.82, 0.80],
    [0.30, 0.55, 1.00], [0.58, 0.50, 1.18], [0.82, 0.55, 1.00],
    [0.44, 0.24, 0.92], [0.68, 0.24, 0.92],
  ],
];

function CloudSvg({ shape, w, h, blurId }: { shape: number; w: number; h: number; blurId: string }) {
  const circles = CLOUD_SHAPES[shape];
  const rUnit = w / 8;
  return (
    // Oversized viewBox padding so the heavy blur isn't clipped at the edges
    <Svg width={w} height={h} viewBox={`-20 -20 ${w + 40} ${h + 40}`}>
      <Defs>
        {/* Heavy blur → foggy, haze-like clouds with very soft edges */}
        <Filter id={blurId} x="-40%" y="-40%" width="180%" height="180%">
          <FeGaussianBlur stdDeviation="5.5" />
        </Filter>
      </Defs>
      <G filter={`url(#${blurId})`}>
        {circles.map(([cx, cy, rs], i) => (
          <Circle
            key={i}
            cx={cx * w}
            cy={cy * h}
            r={rs * rUnit}
            fill="white"
          />
        ))}
      </G>
    </Svg>
  );
}

// ─── Cloud layer ──────────────────────────────────────────────────────────────
// All clouds START fully off-screen left (initX = -(w + margin)) and drift to
// off-screen right, then reset off-screen left. They can NEVER appear mid-card
// on spawn. Staggered delays spread them out so they don't clump.

const TRAVEL_END = 520; // px — past the right edge of any card

const CLOUD_DEFS: (CloudDef & { delay: number })[] = [
  { w: 210, h: 72, initX: -250, y:  2, dur: 34000, op: 0.13, delay: 0     },
  { w: 165, h: 60, initX: -210, y: 24, dur: 26000, op: 0.11, delay: 11000 },
  { w: 230, h: 78, initX: -270, y:  8, dur: 44000, op: 0.12, delay: 5000  },
];

function CloudLayer() {
  const xAnims = useMemo(() =>
    CLOUD_DEFS.map(c => new Animated.Value(c.initX)),
  []);

  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    CLOUD_DEFS.forEach((c, i) => {
      const t = setTimeout(() => {
        if (!alive) return;
        const anim = Animated.loop(Animated.sequence([
          Animated.timing(xAnims[i], { toValue: TRAVEL_END, duration: c.dur, useNativeDriver: true }),
          Animated.timing(xAnims[i], { toValue: c.initX, duration: 0, useNativeDriver: true }),
        ]));
        anim.start();
        loops.current.push(anim);
      }, c.delay);
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
          <CloudSvg shape={i} w={c.w} h={c.h} blurId={`cb${i}`} />
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
