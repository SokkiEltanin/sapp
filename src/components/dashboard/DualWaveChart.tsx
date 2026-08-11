import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { buildWavePath, WAVE_W, WAVE_H } from '@/utils/dashboard/chart';

// Dual-line wave chart: data1 = primary (e.g. food), data2 = secondary (e.g. sweets)
export default function DualWaveChart({ data1, data2, color1, color2, independent, min1 = 0, min2 = 0 }: {
  data1: number[]; data2: number[]; color1: string; color2: string; independent?: boolean;
  min1?: number; min2?: number;
}) {
  if (data1.length < 2) return null;
  // Shared scale by default (comparable magnitudes, e.g. food vs sweets); when
  // `independent`, each line uses its own max so cross-unit trends are visible.
  // min1/min2 zoom a narrow high band (e.g. weight) so its variance is visible.
  const shared = Math.max(...data1, ...data2, 1);
  const max1 = independent ? Math.max(...data1, 1) : shared;
  const max2 = independent ? Math.max(...data2, 1) : shared;
  const p1  = buildWavePath(data1, max1, min1);
  const p2  = buildWavePath(data2, max2, min2);
  return (
    <Svg width="100%" height={WAVE_H} viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id="dwg1" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color1} stopOpacity="0.28" />
          <Stop offset="1" stopColor={color1} stopOpacity="0" />
        </SvgLinearGradient>
        <SvgLinearGradient id="dwg2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color2} stopOpacity="0.16" />
          <Stop offset="1" stopColor={color2} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Path d={p1.fill} fill="url(#dwg1)" />
      <Path d={p2.fill} fill="url(#dwg2)" />
      <Path d={p1.line} stroke={color1} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Path d={p2.line} stroke={color2} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 3" />
      {p1.pts.map((p, i) => (
        <Path key={`d1_${i}`}
          d={`M ${p.x.toFixed(1)} ${p.y.toFixed(1)} m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0`}
          fill={color1} opacity={data1[i] > 0 ? '1' : '0.15'}
        />
      ))}
    </Svg>
  );
}
