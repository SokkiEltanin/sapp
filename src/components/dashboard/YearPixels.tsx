import { useMemo } from 'react';
import { View } from 'react-native';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { useColors } from '@/theme/useColors';
import { MOOD_COLORS } from '@/types';

// A GitHub-contributions-style grid of the whole year: one small square per day,
// coloured by a metric's value that day. Mood/energy use the discrete mood colours;
// quantities (spend, steps…) use an intensity ramp of the accent. One static SVG.

const MONTHS = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
function pad(n: number) { return String(n).padStart(2, '0'); }

// Clearly-separated alpha steps for the shade levels (dark/faded → intense accent),
// so adjacent tiers are distinguishable — not a smooth ramp. Legendary tier is a
// distinct gold that stands out from every blue/green shade.
const SHADE_ALPHA = ['26', '3C', '58', '7A', 'A0', 'CC'];
const LEGENDARY = '#FFCB47';

export default function YearPixels({ year, valueFor, mood, accent, tiers }: {
  year: number;
  valueFor: (day: string) => number;   // metric value for a YYYY-MM-DD
  mood?: boolean;                        // true → colour by mood level 1–5
  accent: string;                        // base colour for the intensity ramp
  tiers?: number[];                      // absolute thresholds → discrete tiers (+ legendary top)
}) {
  const c = useColors();

  const { cells, cols, max, monthCols } = useMemo(() => {
    const start = new Date(year, 0, 1);
    const end = new Date(year, 11, 31);
    const firstDow = (start.getDay() + 6) % 7; // Monday = 0
    const cells: { col: number; row: number; v: number }[] = [];
    const monthCols: { m: number; col: number }[] = [];
    let max = 0, idx = 0, lastMonth = -1;
    for (const cur = new Date(start); cur <= end; cur.setDate(cur.getDate() + 1)) {
      const ds = `${cur.getFullYear()}-${pad(cur.getMonth() + 1)}-${pad(cur.getDate())}`;
      const v = valueFor(ds);
      if (v > max) max = v;
      const p = firstDow + idx;
      const col = Math.floor(p / 7), row = p % 7;
      const month = cur.getMonth();
      if (month !== lastMonth) { monthCols.push({ m: month, col }); lastMonth = month; }
      cells.push({ col, row, v });
      idx++;
    }
    const cols = Math.floor((firstDow + idx - 1) / 7) + 1;
    return { cells, cols, max, monthCols };
  }, [year, valueFor]);

  const CELL = 5, GAP = 1.5, TOP = 11;
  const W = cols * (CELL + GAP);
  const H = TOP + 7 * (CELL + GAP);

  const colorFor = (v: number) => {
    if (v <= 0) return c.fill.subtle;
    if (mood) return (MOOD_COLORS as any)[Math.round(v)] ?? accent;
    let level: number, isLegend: boolean;
    if (tiers && tiers.length) {
      // discrete ABSOLUTE tiers: level = how many thresholds the value clears
      level = tiers.filter(th => v >= th).length;          // 0..tiers.length
      isLegend = level >= tiers.length;                    // cleared them all → top tier
    } else {
      // no absolute scale (money/weight) → discretise the relative ramp into 5 buckets
      const t = max > 0 ? v / max : 0;
      level = Math.min(4, Math.floor(t * 5));
      isLegend = t >= 0.92;                                // near a personal record
    }
    if (isLegend) return LEGENDARY;
    return accent + SHADE_ALPHA[Math.min(level, SHADE_ALPHA.length - 1)];
  };

  return (
    <View style={{ width: '100%', aspectRatio: W / H, marginTop: 2 }}>
      <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
        {monthCols.map(({ m, col }) => (
          <SvgText key={m} x={col * (CELL + GAP)} y={7} fontSize={5.4} fill={c.text.muted}>{MONTHS[m]}</SvgText>
        ))}
        {cells.map((cell, i) => (
          <Rect key={i} x={cell.col * (CELL + GAP)} y={TOP + cell.row * (CELL + GAP)} width={CELL} height={CELL} rx={1.2} fill={colorFor(cell.v)} />
        ))}
      </Svg>
    </View>
  );
}
