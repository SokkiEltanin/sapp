import { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import Svg, { Circle, G, Defs, Filter, FeGaussianBlur, RadialGradient, Stop } from 'react-native-svg';
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

function CloudSvg({ shape, w, h, blurId, blur = 5.5 }: { shape: number; w: number; h: number; blurId: string; blur?: number }) {
  const circles = CLOUD_SHAPES[shape % CLOUD_SHAPES.length];
  const rUnit = w / 8;
  const gradId = `${blurId}-g`;
  return (
    // Oversized viewBox padding so the heavy blur isn't clipped at the edges
    <Svg width={w} height={h} viewBox={`-20 -20 ${w + 40} ${h + 40}`}>
      <Defs>
        {/* Blur → foggy, haze-like clouds with soft edges (less = sharper) */}
        <Filter id={blurId} x="-40%" y="-40%" width="180%" height="180%">
          <FeGaussianBlur stdDeviation={blur} />
        </Filter>
        {/* Radial fill → luminous puffy centre fading to soft transparent edges,
            so each puff reads like a real lit cloud instead of a flat blob. */}
        <RadialGradient id={gradId} cx="50%" cy="38%" r="65%">
          <Stop offset="0"   stopColor="#FFFFFF" stopOpacity="1" />
          <Stop offset="0.6" stopColor="#FFFFFF" stopOpacity="0.85" />
          <Stop offset="1"   stopColor="#FFFFFF" stopOpacity="0.45" />
        </RadialGradient>
      </Defs>
      <G filter={`url(#${blurId})`}>
        {circles.map(([cx, cy, rs], i) => (
          <Circle
            key={i}
            cx={cx * w}
            cy={cy * h}
            r={rs * rUnit}
            fill={`url(#${gradId})`}
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

const TRAVEL_END = 540; // px — past the right edge of any card

// BACK clouds: drift behind the glass (blurred by the BlurView) — varied sizes
// from tiny wisps to big cumulus, at different heights/speeds/opacities.
const CLOUD_DEFS_BACK: (CloudDef & { delay: number; blur: number })[] = [
  { w: 300, h: 96, initX: -340, y:  2, dur: 60000, op: 0.13, delay: 0,     blur: 6.0 },
  { w: 120, h: 46, initX: -160, y: 30, dur: 26000, op: 0.10, delay: 9000,  blur: 5.0 },
  { w: 210, h: 74, initX: -250, y: 14, dur: 40000, op: 0.12, delay: 4000,  blur: 5.5 },
  { w: 90,  h: 38, initX: -130, y: 52, dur: 22000, op: 0.08, delay: 17000, blur: 4.5 },
  { w: 250, h: 84, initX: -300, y:  6, dur: 52000, op: 0.11, delay: 26000, blur: 6.0 },
];

// FRONT clouds: a couple of faint, SHARPER wisps drifting OVER the card (not
// blurred), so the sky reads with depth.
const CLOUD_DEFS_FRONT: (CloudDef & { delay: number; blur: number })[] = [
  { w: 150, h: 52, initX: -190, y: 10, dur: 50000, op: 0.07, delay: 3000,  blur: 2.6 },
  { w: 100, h: 40, initX: -140, y: 44, dur: 36000, op: 0.05, delay: 21000, blur: 2.2 },
];

function CloudLayer({ layer = 'back' }: { layer?: 'back' | 'front' }) {
  const defs = layer === 'front' ? CLOUD_DEFS_FRONT : CLOUD_DEFS_BACK;
  const xAnims = useMemo(() => defs.map(c => new Animated.Value(c.initX)), [defs]);
  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    defs.forEach((c, i) => {
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
  }, [defs, xAnims]);

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      {defs.map((c, i) => (
        <Animated.View
          key={i}
          style={{
            position: 'absolute', top: c.y, left: 0,
            width: c.w, height: c.h, opacity: c.op,
            transform: [{ translateX: xAnims[i] }],
          }}
        >
          <CloudSvg shape={i} w={c.w} h={c.h} blurId={`c${layer}${i}`} blur={c.blur} />
        </Animated.View>
      ))}
    </View>
  );
}

// ─── Precipitation (rain / snow) ──────────────────────────────────────────────

const PRECIP_TRAVEL = 230; // px — taller than any hero card

function Precip({ kind }: { kind: 'rain' | 'snow' }) {
  const COUNT = kind === 'rain' ? 18 : 20;
  const parts = useMemo(() =>
    Array.from({ length: COUNT }, () => ({
      lx:    Math.random() * 100,
      delay: Math.random() * 3500,
      dur:   kind === 'rain' ? 650 + Math.random() * 450 : 3200 + Math.random() * 2600,
      len:   kind === 'rain' ? 7 + Math.random() * 7 : 2 + Math.random() * 2.4,
      drift: Math.random() * 18 - 9,
      op:    kind === 'rain' ? 0.12 + Math.random() * 0.12 : 0.18 + Math.random() * 0.18,
      v:     new Animated.Value(0),
    })),
  []);
  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];
    parts.forEach(p => {
      const t = setTimeout(() => {
        if (!alive) return;
        const anim = Animated.loop(Animated.timing(p.v, { toValue: 1, duration: p.dur, useNativeDriver: true }));
        anim.start();
        loops.current.push(anim);
      }, p.delay);
      timers.push(t);
    });
    return () => { alive = false; timers.forEach(clearTimeout); loops.current.forEach(l => l.stop()); loops.current = []; };
  }, []);

  return (
    <View style={[StyleSheet.absoluteFill, { overflow: 'hidden' }]} pointerEvents="none">
      {parts.map((p, i) => {
        const ty = p.v.interpolate({ inputRange: [0, 1], outputRange: [-14, PRECIP_TRAVEL] });
        const tx = kind === 'snow' ? p.v.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0, p.drift, 0] }) : 0;
        return (
          <Animated.View
            key={i}
            style={{
              position: 'absolute', top: 0, left: `${p.lx}%` as any,
              width: kind === 'rain' ? 1.4 : p.len,
              height: kind === 'rain' ? p.len : p.len,
              borderRadius: kind === 'rain' ? 1 : p.len,
              backgroundColor: kind === 'rain' ? '#9FC2FF' : '#FFFFFF',
              opacity: p.op,
              transform: [{ translateY: ty }, { translateX: tx }],
            }}
          />
        );
      })}
    </View>
  );
}

// Soft sun glow (clear sky, daytime).
function SunGlow() {
  return (
    <View style={StyleSheet.absoluteFill} pointerEvents="none">
      <Svg width="100%" height="100%">
        <Defs>
          <RadialGradient id="sun" cx="82%" cy="22%" r="42%">
            <Stop offset="0"   stopColor="#FFE9A8" stopOpacity="0.55" />
            <Stop offset="0.5" stopColor="#FFD15C" stopOpacity="0.22" />
            <Stop offset="1"   stopColor="#FFD15C" stopOpacity="0" />
          </RadialGradient>
        </Defs>
        <Circle cx="82%" cy="22%" r="60%" fill="url(#sun)" />
      </Svg>
    </View>
  );
}

// ─── Export ───────────────────────────────────────────────────────────────────

type Condition = 'sun' | 'clouds' | 'rain' | 'snow' | 'stars';

function conditionFor(code: number | undefined, isNight: boolean): Condition {
  if (code == null || code < 0) return isNight ? 'stars' : 'clouds';
  if ((code >= 51 && code <= 67) || (code >= 80 && code <= 82) || code >= 95) return 'rain';
  if ((code >= 71 && code <= 77) || code === 85 || code === 86) return 'snow';
  if (code === 0) return isNight ? 'stars' : 'sun';
  return isNight ? 'stars' : 'clouds';     // 1–3 partly cloudy, 45–48 fog
}

interface Props { timeOfDay: TimeOfDay; layer?: 'back' | 'front'; weatherCode?: number; }

export default function AnimatedCardBg({ timeOfDay, layer = 'back', weatherCode }: Props) {
  const isNight = timeOfDay === 'night' || timeOfDay === 'evening' || timeOfDay === 'dawn';
  const cond = conditionFor(weatherCode, isNight);

  // Front layer: only a couple of sharper clouds (for sun/clouds); nothing else.
  if (layer === 'front') return cond === 'clouds' || cond === 'sun' ? <CloudLayer layer="front" /> : null;

  // Back layer — the main sky.
  switch (cond) {
    case 'stars': return <StarField />;
    case 'rain':  return <><CloudLayer /><Precip kind="rain" /></>;
    case 'snow':  return <><CloudLayer /><Precip kind="snow" /></>;
    case 'sun':   return <><SunGlow /><CloudLayer /></>;
    default:      return <CloudLayer />;
  }
}
