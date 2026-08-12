import { memo } from 'react';
import { View, Text } from 'react-native';
import { Wallet, TrendingUp, TrendingDown } from 'lucide-react-native';
import DualWaveChart from '@/components/dashboard/DualWaveChart';
import { weekLabel } from '@/utils/dashboard/dates';

export type WeekOv = { food: number; sweets: number; avgMood?: number | null; dates: string[]; isCurrent: boolean };

function SweetsVsFoodSection(
  { s, cardBg, accentColor, colors, weekOverview }:
  { s: any; cardBg: string; accentColor: string; colors: any; weekOverview: WeekOv[] },
) {
  const SWEET = '#F472B6';
  const wk = weekOverview.filter(w => w.food > 0 || w.sweets > 0);
  const avgFood = wk.reduce((s2, w) => s2 + w.food, 0) / (wk.length || 1);
  const avgSweet = wk.reduce((s2, w) => s2 + w.sweets, 0) / (wk.length || 1);
  const share = avgFood + avgSweet > 0 ? Math.round((avgSweet / (avgFood + avgSweet)) * 100) : 0;
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Wallet size={13} color={accentColor} />
        <Text style={[s.cardTitle]} numberOfLines={1}>Słodkie vs jedzenie</Text>
        <View style={s.dualLegend}>
          <View style={s.dualLegendItem}>
            <View style={[s.dualLegendLine, { backgroundColor: accentColor }]} />
            <Text style={s.dualLegendLabel}>jedzenie</Text>
          </View>
          <View style={s.dualLegendItem}>
            <View style={[s.dualLegendLine, { backgroundColor: SWEET }]} />
            <Text style={s.dualLegendLabel}>słodkie</Text>
          </View>
        </View>
      </View>
      <Text style={s.statSub}>
        Średnio/tydzień: <Text style={{ color: accentColor, fontWeight: '800' }}>{Math.round(avgFood)} zł</Text> jedzenie ·{' '}
        <Text style={{ color: SWEET, fontWeight: '800' }}>{Math.round(avgSweet)} zł</Text> słodkie
        {share > 0 ? `  ·  ${share}% koszyka` : ''}
      </Text>
      {(() => {
        const ser = weekOverview.map(w => w.sweets);
        const half = Math.max(1, Math.floor(ser.length / 2));
        const earlier = ser.slice(0, ser.length - half);
        const recent = ser.slice(ser.length - half);
        const a = earlier.length ? earlier.reduce((x, y) => x + y, 0) / earlier.length : 0;
        const b = recent.reduce((x, y) => x + y, 0) / (recent.length || 1);
        if (a <= 0 && b <= 0) return null;
        const pct = a > 0 ? Math.round((b - a) / a * 100) : (b > 0 ? 100 : 0);
        const up = b > a + 0.5, down = b < a - 0.5;
        const col = up ? SWEET : down ? '#4CA96B' : colors.text.muted;
        const word = up ? 'rośnie' : down ? 'spada' : 'stabilnie';
        return (
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 4 }}>
            {down ? <TrendingDown size={14} color={col} /> : <TrendingUp size={14} color={col} />}
            <Text style={{ fontSize: 12.5, fontWeight: '800', color: col }}>Słodkie {word}{pct !== 0 ? `  ${pct > 0 ? '+' : ''}${pct}%` : ''}</Text>
            <Text style={{ fontSize: 11, color: colors.text.muted }}>ostatnio vs wcześniej</Text>
          </View>
        );
      })()}
      <View style={s.waveValues}>
        {weekOverview.map((w, i) => (
          <Text key={i} style={[s.waveValue, w.isCurrent && { color: accentColor, fontWeight: '800' }]}>
            {w.food > 0 ? Math.round(w.food) : ''}
          </Text>
        ))}
      </View>
      <DualWaveChart data1={weekOverview.map(w => w.food)} data2={weekOverview.map(w => w.sweets)} color1={accentColor} color2={SWEET} />
      <View style={s.waveLabels}>
        {weekOverview.map((w, i) => (
          <Text key={i} style={[s.waveLabel, w.isCurrent && { color: accentColor, fontWeight: '700' }]}>
            {weekLabel(w.dates).split(' ')[0]}
          </Text>
        ))}
      </View>
    </View>
  );
}

export default memo(SweetsVsFoodSection);
