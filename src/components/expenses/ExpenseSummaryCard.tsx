import { View, Text, StyleSheet } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import { colors, spacing, radius, typography } from '@/theme';

interface Props {
  monthExpenses: number;
  monthIncome: number;
  thisWeek: number;
  lastWeek: number;
  topCategory?: string;
}

export default function ExpenseSummaryCard({ monthExpenses, monthIncome, thisWeek, topCategory }: Props) {
  const balance = monthIncome - monthExpenses;
  const pos = balance >= 0;
  const balanceColor = pos ? colors.accent.success : colors.accent.danger;

  return (
    <View style={styles.card}>
      <Text style={styles.label}>SALDO MIESIĄCA</Text>

      <Text style={[styles.balance, { color: balanceColor }]}>
        {pos ? '+' : ''}{balance.toFixed(2)}
        <Text style={styles.balanceCur}> zł</Text>
      </Text>

      <View style={styles.row}>
        <View style={styles.stat}>
          <TrendingUp size={11} color={colors.accent.success} />
          <Text style={[styles.statVal, { color: colors.accent.success }]}>
            +{monthIncome.toFixed(2)} zł
          </Text>
        </View>
        <View style={styles.sep} />
        <View style={styles.stat}>
          <TrendingDown size={11} color={colors.accent.danger} />
          <Text style={[styles.statVal, { color: colors.accent.danger }]}>
            -{monthExpenses.toFixed(2)} zł
          </Text>
        </View>
        {thisWeek > 0 && (
          <>
            <View style={styles.sep} />
            <Text style={styles.weekLabel}>{thisWeek.toFixed(0)} zł / tydzień</Text>
          </>
        )}
      </View>

      {topCategory && (
        <Text style={styles.topCat}>Najwięcej: {topCategory}</Text>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    marginHorizontal: spacing[4],
    marginBottom: spacing[4],
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.05)',
    padding: spacing[5],
    gap: spacing[3],
  },
  label: {
    fontSize: 10, fontWeight: '600', color: colors.text.muted, letterSpacing: 1.2,
  },
  balance: {
    fontSize: 40, fontWeight: '800', letterSpacing: -1, lineHeight: 44,
  },
  balanceCur: { fontSize: 20, fontWeight: '400' },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3], flexWrap: 'wrap',
    paddingTop: spacing[2],
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  stat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  statVal: { fontSize: 13, fontWeight: '600' },
  sep: { width: 1, height: 16, backgroundColor: 'rgba(255,255,255,0.07)' },
  weekLabel: { ...typography.caption, color: colors.text.muted, fontSize: 10 },
  topCat: { ...typography.caption, color: colors.text.muted, fontSize: 10 },
});
