import { memo } from 'react';
import { View, Text } from 'react-native';
import { Sparkles, Scale, CalendarDays, BarChart2, Store, Wallet, Candy, Footprints, Timer, Flame } from 'lucide-react-native';
import { spacing } from '@/theme';

function FunFactsSection(
  { s, cardBg, accentColor, funFacts, weightFacts }:
  { s: any; cardBg: string; accentColor: string; funFacts: { icon: string; label: string }[]; weightFacts: string[] },
) {
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Sparkles size={13} color={accentColor} />
        <Text style={s.cardTitle}>Ciekawostki</Text>
      </View>
      <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
        {weightFacts.map((label, i) => (
          <View key={`w${i}`} style={s.factRow}>
            <View style={[s.factIcon, { backgroundColor: accentColor + '18' }]}>
              <Scale size={13} color={accentColor} />
            </View>
            <Text style={s.factText} numberOfLines={2}>{label}</Text>
          </View>
        ))}
        {funFacts.map((f, i) => {
          const Icon = f.icon === 'calendar' ? CalendarDays
            : f.icon === 'percent' ? BarChart2
            : f.icon === 'store' ? Store
            : f.icon === 'wallet' ? Wallet
            : f.icon === 'candy' ? Candy
            : f.icon === 'footprints' ? Footprints
            : f.icon === 'clock' ? Timer : Flame;
          return (
            <View key={i} style={s.factRow}>
              <View style={[s.factIcon, { backgroundColor: accentColor + '18' }]}>
                <Icon size={13} color={accentColor} />
              </View>
              <Text style={s.factText} numberOfLines={2}>{f.label}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

export default memo(FunFactsSection);
