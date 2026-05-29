import { useEffect, useMemo, useRef } from 'react';
import { View, Animated, StyleSheet } from 'react-native';
import type { TimeOfDay } from '@/hooks/useTimeAccent';

// ─── Stars (night / dawn / evening) ──────────────────────────────────────────

const STAR_COUNT = 20;

function StarField() {
  const stars = useMemo(() =>
    Array.from({ length: STAR_COUNT }, () => ({
      lx: 4 + Math.random() * 92,          // % from left
      ly: 4 + Math.random() * 92,          // % from top
      sz: 1 + Math.random() * 2,
      opacity: new Animated.Value(0.05 + Math.random() * 0.3),
      ty:      new Animated.Value(0),
      twDur:   1100 + Math.random() * 2200,
      fallDur: 9000 + Math.random() * 11000,
      delay:   Math.random() * 5000,
    })),
  []);

  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    let alive = true;
    const timers: ReturnType<typeof setTimeout>[] = [];

    stars.forEach(s => {
      const t = setTimeout(() => {
        if (!alive) return;
        const twinkle = Animated.loop(Animated.sequence([
          Animated.timing(s.opacity, { toValue: 0.6 + Math.random() * 0.4, duration: s.twDur, useNativeDriver: true }),
          Animated.timing(s.opacity, { toValue: 0.02 + Math.random() * 0.1, duration: s.twDur, useNativeDriver: true }),
        ]));
        const fall = Animated.loop(Animated.sequence([
          Animated.timing(s.ty, { toValue: 42, duration: s.fallDur, useNativeDriver: true }),
          Animated.timing(s.ty, { toValue: 0,  duration: 0,          useNativeDriver: true }),
        ]));
        twinkle.start();
        fall.start();
        loops.current.push(twinkle, fall);
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
            transform: [{ translateY: s.ty }],
          }}
        />
      ))}
    </View>
  );
}

// ─── Cloud blob shape ─────────────────────────────────────────────────────────

function CloudBlob({ w, h }: { w: number; h: number }) {
  const r = h * 0.5;
  return (
    <View style={{ width: w, height: h }}>
      {/* base pill */}
      <View style={{
        position: 'absolute', bottom: 0, left: 0, right: 0,
        height: h * 0.52, borderRadius: h * 0.26,
        backgroundColor: 'rgba(255,255,255,0.92)',
      }} />
      {/* left bump */}
      <View style={{
        position: 'absolute', bottom: h * 0.3, left: w * 0.08,
        width: w * 0.30, height: h * 0.68, borderRadius: w * 0.15,
        backgroundColor: 'rgba(255,255,255,0.92)',
      }} />
      {/* centre bump (tallest) */}
      <View style={{
        position: 'absolute', bottom: h * 0.3, left: w * 0.30,
        width: w * 0.38, height: h * 0.95, borderRadius: w * 0.19,
        backgroundColor: 'rgba(255,255,255,0.92)',
      }} />
      {/* right bump */}
      <View style={{
        position: 'absolute', bottom: h * 0.3, left: w * 0.60,
        width: w * 0.28, height: h * 0.60, borderRadius: w * 0.14,
        backgroundColor: 'rgba(255,255,255,0.92)',
      }} />
    </View>
  );
}

// ─── Clouds (morning / afternoon) ────────────────────────────────────────────

const CLOUD_DEFS = [
  { w: 200, h: 60, initX: -240, y:  6, dur: 26000, op: 0.12 },
  { w: 150, h: 46, initX:  -80, y: 36, dur: 19000, op: 0.09 },
  { w: 220, h: 70, initX:  120, y: 16, dur: 33000, op: 0.10 },
];

function CloudLayer() {
  const xAnims = useMemo(() =>
    CLOUD_DEFS.map(c => new Animated.Value(c.initX)),
  []);

  const loops = useRef<Animated.CompositeAnimation[]>([]);

  useEffect(() => {
    CLOUD_DEFS.forEach((c, i) => {
      const anim = Animated.loop(Animated.sequence([
        Animated.timing(xAnims[i], { toValue: 440, duration: c.dur, useNativeDriver: true }),
        Animated.timing(xAnims[i], { toValue: c.initX - 10, duration: 0, useNativeDriver: true }),
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
          <CloudBlob w={c.w} h={c.h} />
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
