import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Line as SvgLine } from 'react-native-svg';
import { buildWavePath, WAVE_W, WAVE_H } from '@/utils/dashboard/chart';

export default function WaveChart({ data, color, dotColors, target, zoom }: { data: number[]; color: string; dotColors?: (string | null)[]; target?: number; zoom?: boolean }) {
  if (data.length < 2) return null;
  let min = 0;
  let max = Math.max(...data, target ?? 0, 1);
  // zoom (e.g. weight): when the values sit in a narrow band well above 0, scale to
  // that band so small week-to-week changes are actually visible instead of a flat line.
  if (zoom) {
    const nz = data.filter(v => v > 0);
    if (nz.length >= 2) {
      const lo = Math.min(...nz), hi = Math.max(...nz, target && target > 0 ? target : 0);
      if (hi - lo > 0 && lo > hi * 0.3) {
        const pad = (hi - lo) * 0.35;
        min = Math.max(0, lo - pad);
        max = hi + pad;
      }
    }
  }
  const span = max - min || 1;
  const { line, fill, pts } = buildWavePath(data, max, min);
  const gradId = `wg_${color.replace('#', '')}`;
  const targetY = target && target > 0 ? WAVE_H - 6 - (Math.max(0, Math.min(1, (target - min) / span)) * (WAVE_H - 18)) : null;
  return (
    <Svg width="100%" height={WAVE_H} viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Path d={fill} fill={`url(#${gradId})`} />
      {targetY != null && (
        <SvgLine x1="0" y1={targetY} x2={WAVE_W} y2={targetY} stroke="#FBBF24" strokeWidth="1" strokeDasharray="5 4" opacity="0.8" />
      )}
      <Path d={line} stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => {
        const dc = dotColors?.[i] ?? color;
        return (
          <Path key={i}
            d={`M ${p.x.toFixed(1)} ${p.y.toFixed(1)} m -3.5 0 a 3.5 3.5 0 1 0 7 0 a 3.5 3.5 0 1 0 -7 0`}
            fill={dc} opacity={data[i] > 0 ? '1' : '0.2'}
          />
        );
      })}
    </Svg>
  );
}
