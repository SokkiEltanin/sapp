import { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';

// The tail, as a chain of nested Animated.Views — NOT SVG.
//
// Why: animating an SVG prop from JS stutters/teleports on this device (the rule that
// bit us on the first cat). But a segmented tail needs a per-joint rotation, so a single
// wrapper transform can't do it either. So each joint is its own Animated.View holding a
// plain rounded View (a capsule needs no SVG at all), rotated with the NATIVE driver.
// Smooth, and the SVG animation problem never enters the picture.
//
// Each joint runs the same wave one beat behind its parent, so the motion travels base →
// tip and the tail curls instead of swinging rigidly. RN rotates about a view's centre,
// so every joint is offset to pivot at its BASE (translate half-length → rotate → back).

const SEGS = 7;
const LEN = 22;      // px per segment at the reference size
const W0 = 16;       // base width
const W1 = 11;       // tip width — deliberately not much thinner; a needle tip looked wrong
const ROOT = 78;     // first joint: leaves the rear almost horizontally
const PER = -9;      // each next joint curls the tail upward

export default function CatTail({
  color, markColor, stripes, animate = true, mood, scale = 1,
}: {
  color: string; markColor: string; stripes?: boolean;
  animate?: boolean; mood?: 'idle' | 'purr' | 'angry'; scale?: number;
}) {
  return <Joint i={0} color={color} markColor={markColor} stripes={stripes} animate={animate} mood={mood} scale={scale} />;
}

function Joint({
  i, color, markColor, stripes, animate, mood, scale,
}: {
  i: number; color: string; markColor: string; stripes?: boolean;
  animate?: boolean; mood?: 'idle' | 'purr' | 'angry'; scale: number;
}) {
  const wave = useRef(new Animated.Value(0.5)).current;
  const dur = mood === 'angry' ? 250 : mood === 'purr' ? 950 : 1800;

  useEffect(() => {
    if (!animate) return;
    let cancelled = false;
    const run = () => {
      if (cancelled) return;
      Animated.loop(
        Animated.sequence([
          Animated.timing(wave, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
          Animated.timing(wave, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        ]),
      ).start();
    };
    // the phase lag that makes the wave travel outward instead of the whole tail swinging
    const t = setTimeout(run, i * 130);
    return () => { cancelled = true; clearTimeout(t); wave.stopAnimation(); };
  }, [animate, dur, i]);

  const w = (W0 + (W1 - W0) * (i / (SEGS - 1))) * scale;
  const len = LEN * scale;
  const base = i === 0 ? ROOT : PER;
  const puff = mood === 'angry' ? 1.8 : 1;   // bottle-brush
  const swing = mood === 'angry' ? 9 : 4.5;

  const rotate = wave.interpolate({ inputRange: [0, 1], outputRange: [`${-swing}deg`, `${swing}deg`] });

  return (
    // pivot at the JOINT: shift down half a segment, rotate, shift back
    <Animated.View
      style={{
        transform: [
          { translateY: len / 2 },
          { rotate: `${base}deg` },
          { rotate },
          { translateY: -len / 2 },
        ],
      }}
    >
      <View style={{ width: w * puff, height: len + w, borderRadius: (w * puff) / 2, backgroundColor: color, alignSelf: 'center' }}>
        {stripes && (
          <View style={{ position: 'absolute', top: len * 0.28, left: 0, right: 0, height: Math.max(2, 4 * scale), backgroundColor: markColor }} />
        )}
      </View>
      {i < SEGS - 1 && (
        <View style={{ position: 'absolute', top: -len, left: 0, right: 0, alignItems: 'center' }}>
          <Joint i={i + 1} color={color} markColor={markColor} stripes={stripes} animate={animate} mood={mood} scale={scale} />
        </View>
      )}
    </Animated.View>
  );
}
