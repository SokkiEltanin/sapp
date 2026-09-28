import { memo } from 'react';
import { View, Text } from 'react-native';
import { CalendarClock } from 'lucide-react-native';
import { getCategoryMeta } from '@/utils/categories';
import { SeasonalSpendWarning } from '@/utils/seasonalSpend';

function SeasonalSpendSection(
  { s, cardBg, accentColor, warning }: { s: any; cardBg: string; accentColor: string; warning: SeasonalSpendWarning },
) {
  const meta = getCategoryMeta(warning.category as any);
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <CalendarClock size={13} color={accentColor} />
        <Text style={s.cardTitle}>Wzorzec sezonowy</Text>
      </View>
      <Text style={s.statSub}>
        W {warning.monthLabel} najwięcej wydałeś na <Text style={{ color: meta.color, fontWeight: '700' }}>{meta.label}</Text> — {Math.round(warning.amount)} zł. Może się powtórzyć.
      </Text>
    </View>
  );
}

export default memo(SeasonalSpendSection);
