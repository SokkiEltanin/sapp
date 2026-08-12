import { memo } from 'react';
import { View, Text } from 'react-native';
import { Wallet } from 'lucide-react-native';

function SavingsSection(
  { s, cardBg, colors, savings }: { s: any; cardBg: string; colors: any; savings: any },
) {
  return (
    <View style={[s.card, { backgroundColor: cardBg }]}>
      <View style={s.cardHeader}>
        <Wallet size={13} color="#2AC68F" />
        <Text style={s.cardTitle}>Zaoszczędzone</Text>
        <View style={{ flex: 1 }} />
        <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text.muted }}>{savings.count}× kupon / promo</Text>
      </View>
      <View style={s.finRow}>
        <View style={s.finStat}>
          <Text style={[s.finVal, { color: '#2AC68F' }]}>{savings.total.toFixed(0)}</Text>
          <Text style={s.finKey}>zł łącznie</Text>
        </View>
        <View style={s.finDivider} />
        <View style={s.finStat}>
          <Text style={s.finVal}>{savings.thisMonth.toFixed(0)}</Text>
          <Text style={s.finKey}>zł w tym mies.</Text>
        </View>
        {savings.lidlTotal > 0 && (
          <>
            <View style={s.finDivider} />
            <View style={s.finStat}>
              <Text style={s.finVal}>{savings.lidlTotal.toFixed(0)}</Text>
              <Text style={s.finKey}>zł Lidl</Text>
            </View>
          </>
        )}
      </View>
    </View>
  );
}

export default memo(SavingsSection);
