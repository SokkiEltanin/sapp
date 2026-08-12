import { memo } from 'react';
import { View, Text } from 'react-native';
import { History } from 'lucide-react-native';
import { spacing } from '@/theme';

function YearAgoSection(
  { s, cardBg, accentColor, yearAgo }: { s: any; cardBg: string; accentColor: string; yearAgo: any },
) {
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <History size={13} color={accentColor} />
        <Text style={s.cardTitle}>Rok temu tego dnia</Text>
      </View>
      <Text style={[s.statSub, { marginBottom: spacing[2] }]}>{yearAgo.label}</Text>
      <View style={s.yearAgoRow}>
        {yearAgo.mood != null && (
          <View style={s.yearAgoStat}><Text style={[s.yearAgoVal, { color: accentColor }]}>{yearAgo.mood.toFixed(1)}/5</Text><Text style={s.yearAgoKey}>nastrój</Text></View>
        )}
        {yearAgo.hasSpend && (
          <View style={s.yearAgoStat}><Text style={[s.yearAgoVal, { color: accentColor }]}>{Math.round(yearAgo.spend)} zł</Text><Text style={s.yearAgoKey}>wydane</Text></View>
        )}
        {yearAgo.steps > 0 && (
          <View style={s.yearAgoStat}><Text style={[s.yearAgoVal, { color: accentColor }]}>{yearAgo.steps >= 1000 ? `${(yearAgo.steps / 1000).toFixed(1).replace('.0', '')}k` : yearAgo.steps}</Text><Text style={s.yearAgoKey}>kroków</Text></View>
        )}
      </View>
    </View>
  );
}

export default memo(YearAgoSection);
