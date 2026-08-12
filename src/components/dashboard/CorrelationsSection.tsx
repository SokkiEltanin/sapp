import { memo } from 'react';
import { View, Text } from 'react-native';
import { Link2 } from 'lucide-react-native';
import { spacing } from '@/theme';

function CorrelationsSection(
  { s, cardBg, accentColor, colors, correlations }:
  { s: any; cardBg: string; accentColor: string; colors: any; correlations: { text: string }[] },
) {
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Link2 size={13} color={accentColor} />
        <Text style={s.cardTitle}>Zależności</Text>
      </View>
      <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
        {correlations.map((co, i) => (
          <View key={i} style={s.factRow}>
            <View style={[s.factIcon, { backgroundColor: accentColor + '18' }]}>
              <Link2 size={13} color={accentColor} />
            </View>
            <Text style={s.factText} numberOfLines={2}>{co.text}</Text>
          </View>
        ))}
      </View>
      <Text style={[s.factText, { color: colors.text.muted, fontSize: 10, marginTop: spacing[2] }]}>
        Obserwacja z Twoich dni — nie musi oznaczać przyczyny.
      </Text>
    </View>
  );
}

export default memo(CorrelationsSection);
