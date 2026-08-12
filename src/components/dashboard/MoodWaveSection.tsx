import { memo } from 'react';
import { View, Text } from 'react-native';
import { Smile } from 'lucide-react-native';
import WaveChart from '@/components/dashboard/WaveChart';
import { WeekOv } from '@/components/dashboard/SweetsVsFoodSection';
import { moodColor } from '@/utils/dashboard/format';
import { weekLabel } from '@/utils/dashboard/dates';

function MoodWaveSection(
  { s, cardBg, accentColor, colors, weekOverview }:
  { s: any; cardBg: string; accentColor: string; colors: any; weekOverview: WeekOv[] },
) {
  const cur = weekOverview.find(w => w.isCurrent);
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Smile size={13} color={colors.text.muted} />
        <Text style={s.cardTitle}>Nastrój — 8 tygodni</Text>
        {cur?.avgMood != null && (
          <View style={[s.avgPill, { backgroundColor: moodColor(cur.avgMood) + '25' }]}>
            <Text style={[s.avgPillText, { color: moodColor(cur.avgMood) }]}>{cur.avgMood.toFixed(1)}</Text>
          </View>
        )}
      </View>
      <WaveChart data={weekOverview.map(w => w.avgMood ?? 0)} color={accentColor} dotColors={weekOverview.map(w => w.avgMood ? moodColor(w.avgMood) : null)} />
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

export default memo(MoodWaveSection);
