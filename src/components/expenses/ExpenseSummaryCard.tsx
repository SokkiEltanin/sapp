import { useState, useEffect } from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { TrendingDown, TrendingUp } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { getBudgets, MonthlyBudgets } from '@/utils/budgets';
import { CATEGORY_META } from '@/utils/categories';
import { ExpenseCategory } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';

interface Props {
  monthExpenses: number;
  monthIncome: number;
  thisWeek: number;
  lastWeek: number;
  topCategory?: string;
  monthCategorySpend?: Record<string, number>;
}

export default function ExpenseSummaryCard({
  monthExpenses, monthIncome, thisWeek, topCategory, monthCategorySpend,
}: Props) {
  const balance = monthIncome - monthExpenses;
  const pos = balance >= 0;
  const balanceColor = pos ? colors.accent.success : colors.accent.danger;

  const [budgets, setBudgets] = useState<MonthlyBudgets>({});
  useEffect(() => { getBudgets().then(setBudgets).catch(() => {}); }, []);

  // Budget bars: only categories that have both a budget AND any spend this month
  const budgetEntries = Object.entries(budgets)
    .filter(([cat, limit]) => limit && limit > 0 && monthCategorySpend?.[cat])
    .map(([cat, limit]) => {
      const spent = monthCategorySpend?.[cat] ?? 0;
      const pct = Math.min(spent / limit!, 1);
      const meta = CATEGORY_META[cat as ExpenseCategory];
      return { cat: cat as ExpenseCategory, limit: limit!, spent, pct, meta };
    })
    .sort((a, b) => b.pct - a.pct)
    .slice(0, 5); // show at most 5

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
            <Text style={styles.weekLabel}>{thisWeek.toFixed(0)} zł/tyg</Text>
          </>
        )}
        {(() => {
          const now = new Date();
          const dayOfMonth = now.getDate();
          const daysInMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
          if (dayOfMonth < 3 || monthExpenses === 0) return null;
          const projected = Math.round((monthExpenses / dayOfMonth) * daysInMonth);
          return (
            <>
              <View style={styles.sep} />
              <Text style={styles.weekLabel}>prognoza: {projected} zł</Text>
            </>
          );
        })()}
      </View>

      {topCategory && (
        <Text style={styles.topCat}>Najwięcej: {topCategory}</Text>
      )}

      {budgetEntries.length > 0 && (
        <View style={styles.budgetSection}>
          <Text style={styles.budgetTitle}>LIMITY MIESIĘCZNE</Text>
          {budgetEntries.map(({ cat, limit, spent, pct, meta }) => {
            const barColor = pct >= 1 ? colors.accent.red : pct >= 0.85 ? colors.accent.amber : meta?.color ?? colors.accent.blue;
            const IconC = meta?.icon ? (LucideIcons as any)[meta.icon] : null;
            return (
              <View key={cat} style={styles.budgetRow}>
                <View style={styles.budgetLeft}>
                  {IconC && <IconC size={11} color={barColor} />}
                  <Text style={styles.budgetCat}>{meta?.label ?? cat}</Text>
                </View>
                <View style={styles.budgetBarWrap}>
                  <View style={styles.budgetTrack}>
                    <View style={[styles.budgetFill, { width: `${Math.round(pct * 100)}%`, backgroundColor: barColor }]} />
                  </View>
                </View>
                <Text style={[styles.budgetAmt, { color: pct >= 1 ? colors.accent.red : colors.text.muted }]}>
                  {spent.toFixed(0)}/{limit}
                </Text>
              </View>
            );
          })}
        </View>
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
    borderColor: colors.border.default,
    padding: spacing[5],
    gap: spacing[3],
  },
  label: { fontSize: 10, fontWeight: '600', color: colors.text.muted, letterSpacing: 1.2 },
  balance: { fontSize: 40, fontWeight: '800', letterSpacing: -1, lineHeight: 44 },
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

  budgetSection: {
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
    paddingTop: spacing[3], gap: spacing[2],
  },
  budgetTitle: { fontSize: 9, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.2, textTransform: 'uppercase' },
  budgetRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  budgetLeft: { flexDirection: 'row', alignItems: 'center', gap: 4, width: 72 },
  budgetCat: { fontSize: 10, fontWeight: '600', color: colors.text.secondary, flexShrink: 1 },
  budgetBarWrap: { flex: 1 },
  budgetTrack: {
    height: 4, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.full, overflow: 'hidden',
  },
  budgetFill: { height: 4, borderRadius: radius.full },
  budgetAmt: { fontSize: 9, fontWeight: '600', width: 46, textAlign: 'right' },
});
