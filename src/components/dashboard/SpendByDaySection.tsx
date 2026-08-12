import { memo } from 'react';
import { View, Text } from 'react-native';
import { BarChart2 } from 'lucide-react-native';

function SpendByDaySection(
  { s, cardBg, accentColor, colors, weekdayAvg }:
  { s: any; cardBg: string; accentColor: string; colors: any; weekdayAvg: { avg: number; pct: number; label: string }[] },
) {
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <BarChart2 size={13} color={accentColor} />
        <Text style={[s.cardTitle]}>W jakie dni jesz najwięcej?</Text>
        <Text style={[s.cardTitle, { marginLeft: 'auto' as any, color: colors.text.muted }]}>śr. zł/dzień</Text>
      </View>
      <View style={s.dowRow}>
        {weekdayAvg.map((d, i) => {
          const isWeekend = i >= 5;
          const barColor = isWeekend ? accentColor + 'AA' : accentColor;
          return (
            <View key={i} style={s.dowCol}>
              {d.avg > 0 && (
                <Text style={[s.dowAvgLabel, { color: isWeekend ? accentColor + 'AA' : accentColor }]}>
                  {d.avg >= 100 ? `${(d.avg / 1).toFixed(0)}` : d.avg.toFixed(0)}
                </Text>
              )}
              <View style={s.dowBar}>
                <View style={[s.dowFill, { height: Math.max(d.pct * 44, d.avg > 0 ? 4 : 0), backgroundColor: barColor, opacity: d.avg > 0 ? 1 : 0.1 }]} />
              </View>
              <Text style={[s.dowLabel, isWeekend && { color: accentColor + 'AA' }]}>{d.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default memo(SpendByDaySection);
