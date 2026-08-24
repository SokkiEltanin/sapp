import { View, Text, StyleSheet } from 'react-native';
import Svg, { Circle, Path, Defs, ClipPath, LinearGradient as SvgGrad, Stop } from 'react-native-svg';

// Circular water gauge: a progress ring + a wave-fill that rises with intake.
// `showText` (2026-08-24) — kompaktowy widget nawodnienia (health.tsx) chce sam pierścień
// bez nakładki L/% (liczby już pokazane obok, osobnym tekstem) — domyślnie true, żeby
// istniejące (jedyne na razie) wywołanie w pełnym rozmiarze zostało bez zmian.
export default function WaterGauge({
  ml, goalMl, accent, muted, textColor, size = 168, showText = true,
}: {
  ml: number; goalMl: number; accent: string; muted: string; textColor: string; size?: number; showText?: boolean;
}) {
  const pct = goalMl > 0 ? Math.max(0, Math.min(1, ml / goalMl)) : 0;
  const cx = size / 2, cy = size / 2;
  const ringStroke = 9;
  const ringR = size / 2 - ringStroke / 2;
  const circ = 2 * Math.PI * ringR;
  const innerR = size / 2 - ringStroke - 6;

  // Water surface y (SVG y grows down); flat at the extremes, wavy in between.
  const amp = pct > 0.02 && pct < 0.98 ? 6 : 0;
  const surfaceY = cy + innerR - pct * (innerR * 2);
  const x0 = cx - innerR, w = innerR * 2;
  const wave = (off: number) =>
    `M ${x0} ${surfaceY + off}` +
    ` C ${x0 + w * 0.25} ${surfaceY + off - amp}, ${x0 + w * 0.25} ${surfaceY + off + amp}, ${x0 + w * 0.5} ${surfaceY + off}` +
    ` C ${x0 + w * 0.75} ${surfaceY + off - amp}, ${x0 + w * 0.75} ${surfaceY + off + amp}, ${x0 + w} ${surfaceY + off}` +
    ` L ${x0 + w} ${cy + innerR} L ${x0} ${cy + innerR} Z`;

  // Up to 2 decimals, trailing zeros trimmed — a single 250 ml glass reads "0,25 L",
  // not "0,3" (toFixed(1) rounds 0.25 → "0.3" per spec, which looked like a bug).
  const liters = (Math.round((ml / 1000) * 100) / 100).toString().replace('.', ',');

  return (
    <View style={{ width: size, height: size, alignItems: 'center', justifyContent: 'center' }}>
      <Svg width={size} height={size}>
        <Defs>
          <ClipPath id="waterClip"><Circle cx={cx} cy={cy} r={innerR} /></ClipPath>
          <SvgGrad id="waterFill" x1="0" y1="0" x2="0" y2="1">
            <Stop offset="0" stopColor={accent} stopOpacity="0.9" />
            <Stop offset="1" stopColor={accent} stopOpacity="0.5" />
          </SvgGrad>
        </Defs>

        {/* inner well */}
        <Circle cx={cx} cy={cy} r={innerR} fill={muted} opacity={0.10} />
        {/* wave fill — a lighter wave behind for depth */}
        <Path d={wave(6)} fill={accent} opacity={0.28} clipPath="url(#waterClip)" />
        <Path d={wave(0)} fill="url(#waterFill)" clipPath="url(#waterClip)" />

        {/* progress ring */}
        <Circle cx={cx} cy={cy} r={ringR} stroke={muted} strokeWidth={ringStroke} fill="none" opacity={0.2} />
        <Circle
          cx={cx} cy={cy} r={ringR}
          stroke={accent} strokeWidth={ringStroke} fill="none"
          strokeDasharray={`${circ}`} strokeDashoffset={circ * (1 - pct)} strokeLinecap="round"
          transform={`rotate(-90 ${cx} ${cy})`}
        />
      </Svg>

      {showText && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="none">
          <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
            <Text style={{ fontSize: 32, fontWeight: '800', color: textColor, letterSpacing: -1 }}>
              {liters}<Text style={{ fontSize: 14, fontWeight: '700', color: muted }}> L</Text>
            </Text>
            <Text style={{ fontSize: 11, fontWeight: '700', color: muted }}>{Math.round(pct * 100)}%</Text>
          </View>
        </View>
      )}
    </View>
  );
}
