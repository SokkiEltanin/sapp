import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

// Soft elliptical "ground" shadow under a sprite (2026-09-03, user: "musimy jakoś wyróżnić
// cieniem te bossy i kotka" — a flat sprite standing directly on the LOKACJA_KAMPANIA.png
// arena photo read as floating/pasted-on, not grounded). Same real-radial-gradient trick as
// RadialGlow (RN has no radial gradient on plain Views), but stretched non-uniformly
// (`preserveAspectRatio="none"`) into a flattened ellipse instead of a circle — a shadow
// under someone's feet is wide and shallow, not round.
export default function GroundShadow({ width, height, opacity = 0.4 }: {
  width: number; height: number; opacity?: number;
}) {
  return (
    <Svg width={width} height={height} viewBox="0 0 100 100" preserveAspectRatio="none" style={{ position: 'absolute', bottom: 0 }}>
      <Defs>
        <RadialGradient id="gs" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor="#000" stopOpacity={opacity} />
          <Stop offset="1" stopColor="#000" stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill="url(#gs)" />
    </Svg>
  );
}
