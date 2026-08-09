import Svg, { Defs, RadialGradient, Stop, Circle } from 'react-native-svg';

// A soft circular glow — center-out radial falloff, not a flat solid disc. RN's
// View/StyleSheet has no radial gradient, so this is real SVG (already a project
// dependency via CatArt/CatTail) rather than a LinearGradient trick, which can only
// fade in one direction and can't reproduce "opacity drops from the center" evenly
// on all sides. Purely presentational — wrap it in Animated.View for pulse/scale,
// same as the flat Views it replaces.
export default function RadialGlow({ size, color, opacity = 0.55 }: {
  size: number; color: string; opacity?: number;
}) {
  return (
    <Svg width={size} height={size} viewBox="0 0 100 100" style={{ position: 'absolute' }}>
      <Defs>
        <RadialGradient id="glow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={color} stopOpacity={opacity} />
          <Stop offset="1" stopColor={color} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx="50" cy="50" r="50" fill="url(#glow)" />
    </Svg>
  );
}
