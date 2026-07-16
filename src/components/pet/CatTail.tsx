import { useEffect, useRef } from 'react';
import { View, Animated, Easing } from 'react-native';

// The tail, as a chain of nested Animated.Views — NOT SVG.
//
// Why: animating an SVG prop from JS stutters/teleports on this device. But a segmented
// tail needs a per-joint rotation, so one wrapper transform can't do it either. So each
// joint is its own Animated.View holding a plain rounded View (a capsule needs no SVG),
// rotated with the NATIVE driver. Each joint runs the wave one beat behind its parent, so
// the motion travels base → tip and the tail curls instead of swinging rigidly.
//
// IMPORTANT — sizing is in VIEWBOX UNITS, exactly as approved in the HTML lab, converted
// with `unit` (= size / 2000). The first port invented a "reference size 150" and guessed
// the numbers, which made the tail 4.6× too long and 4.4× too wide — it rendered longer
// than the entire cat. Never re-derive these; they are the lab's values.
const SEGS = 7;
const LEN_U = 62;    // segment length, viewBox units
// A cat tail is nearly even-width — it barely tapers. The old 48→32 read as a thin cone
// ("jakby był coraz cieńszy"); 78→64 is a fuller, cat-like tail.
const W0_U = 78;     // base width
const W1_U = 64;     // tip width
const ROOT = 74;     // first joint: leaves the rear almost horizontally
const PER = -9;      // each next joint curls the tail upward
// Root sits at the base of the rump. Nudged up + in from the lab value so it connects to
// the haunch instead of drooping from mid-body.
export const TAIL_X_U = 1265;   // root, viewBox units
export const TAIL_Y_U = 1430;

export default function CatTail({
  color, markColor, stripes, animate = true, mood = 'idle', unit,
}: {
  color: string; markColor: string; stripes?: boolean;
  animate?: boolean; mood?: 'idle' | 'purr' | 'angry';
  unit: number;   // px per viewBox unit = size / 2000
}) {
  return <Joint i={0} color={color} markColor={markColor} stripes={stripes} animate={animate} mood={mood} unit={unit} />;
}

function Joint({
  i, color, markColor, stripes, animate, mood, unit,
}: {
  i: number; color: string; markColor: string; stripes?: boolean;
  animate?: boolean; mood: 'idle' | 'purr' | 'angry'; unit: number;
}) {
  const wave = useRef(new Animated.Value(0.5)).current;
  const dur = mood === 'angry' ? 250 : mood === 'purr' ? 950 : 1800;

  useEffect(() => {
    if (!animate) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(wave, { toValue: 1, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(wave, { toValue: 0, duration: dur, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    // the phase lag that makes the wave travel outward instead of the whole tail swinging
    const t = setTimeout(() => loop.start(), i * 130);
    return () => { clearTimeout(t); loop.stop(); };
  }, [animate, dur, i]);

  const w = (W0_U + (W1_U - W0_U) * (i / (SEGS - 1))) * unit;
  const len = LEN_U * unit;
  const base = i === 0 ? ROOT : PER;
  const puff = mood === 'angry' ? 1.8 : 1;   // bottle-brush
  const swing = mood === 'angry' ? 9 : 4.5;

  const rotate = wave.interpolate({ inputRange: [0, 1], outputRange: [`${-swing}deg`, `${swing}deg`] });

  return (
    // RN rotates about a view's CENTRE, so pivot at the JOINT: shift down half a
    // segment, rotate, shift back.
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
      {/* overflow:hidden matters — RN does NOT clip children to a parent's borderRadius,
          so without it the stripe is a rectangle with square corners poking out of the
          rounded tail (and the angry puff widens the radius, making it worse). */}
      <View style={{
        width: w * puff, height: len + w, borderRadius: (w * puff) / 2,
        backgroundColor: color, alignSelf: 'center', overflow: 'hidden',
      }}>
        {stripes && (
          <View style={{
            position: 'absolute',
            // From the lab: the stripe sits at y = -len*0.72 while the capsule starts at
            // y = -(len + w/2) — so measured from the capsule's top that's 0.28*len + w/2.
            // Dropping the w/2 put it 3.4px too high, right in the rounded cap.
            top: len * 0.28 + w / 2,
            left: 0, right: 0,
            height: Math.max(1.5, 15 * unit),
            backgroundColor: markColor,
          }} />
        )}
      </View>
      {i < SEGS - 1 && (
        <View style={{ position: 'absolute', top: -len, left: 0, right: 0, alignItems: 'center' }}>
          <Joint i={i + 1} color={color} markColor={markColor} stripes={stripes} animate={animate} mood={mood} unit={unit} />
        </View>
      )}
    </Animated.View>
  );
}
