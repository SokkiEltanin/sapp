import { useMemo, useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, TrendingDown, TrendingUp, BarChart2, Settings2 } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, format } from 'date-fns';
import { pl } from 'date-fns/locale';

import PressableScale from '@/components/ui/PressableScale';
import { useExpensesStore } from '@/store/expensesStore';
import { Expense, ExpenseCategory } from '@/types';
import { getCategoryMeta } from '@/utils/categories';
import { getBudgets, MonthlyBudgets } from '@/utils/budgets';
import { colors, spacing, radius, typography } from '@/theme';

const MONTHS_BACK = 6;

function isExpense(e: Expense) { return !e.type || e.type === 'expense'; }
function isIncome(e: Expense) { return e.type === 'income'; }

export default function StatsScreen() {
  const { expenses } = useExpensesStore();
  const now = new Date();
  const [budgets, setBudgets] = useState<MonthlyBudgets>({});

  useEffect(() => { getBudgets().then(setBudgets); }, []);

  const monthlyData = useMemo(() => {
    return Array.from({ length: MONTHS_BACK }, (_, i) => {
      const d = subMonths(now, MONTHS_BACK - 1 - i);
      const start = startOfMonth(d);
      const end = endOfMonth(d);
      const inRange = (e: Expense) => {
        try { return isWithinInterval(parseISO(e.date), { start, end }); }
        catch { return false; }
      };
      const exp = expenses.filter(e => isExpense(e) && inRange(e)).reduce((s, e) => s + e.amount, 0);
      const inc = expenses.filter(e => isIncome(e) && inRange(e)).reduce((s, e) => s + e.amount, 0);
      return {
        label: format(d, 'LLL', { locale: pl }),
        expenses: exp,
        income: inc,
        balance: inc - exp,
      };
    });
  }, [expenses]);

  const maxMonthly = Math.max(...monthlyData.flatMap(m => [m.expenses, m.income]), 1);

  const dailyData = useMemo(() => {
    return Array.from({ length: 30 }, (_, i) => {
      const date = new Date(now);
      date.setDate(date.getDate() - (29 - i));
      const dateStr = format(date, 'yyyy-MM-dd');
      const total = expenses
        .filter(e => isExpense(e) && e.date.startsWith(dateStr))
        .reduce((s, e) => s + e.amount, 0);
      return { date: dateStr, total, isToday: i === 29 };
    });
  }, [expenses]);
  const maxDaily = Math.max(...dailyData.map(d => d.total), 1);

  const catBreakdown = useMemo(() => {
    const start = startOfMonth(now);
    const end = endOfMonth(now);
    const inRange = (e: Expense) => {
      try { return isWithinInterval(parseISO(e.date), { start, end }); }
      catch { return false; }
    };
    const byCat: Record<string, number> = {};
    for (const e of expenses) {
      if (isExpense(e) && inRange(e)) {
        byCat[e.category] = (byCat[e.category] ?? 0) + e.amount;
      }
    }
    const total = Object.values(byCat).reduce((s, v) => s + v, 0);
    return Object.entries(byCat)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, amount]) => ({
        cat: cat as ExpenseCategory,
        amount,
        pct: total > 0 ? amount / total : 0,
        meta: getCategoryMeta(cat as any),
      }));
  }, [expenses]);

  const thisMonthExp = monthlyData[MONTHS_BACK - 1]?.expenses ?? 0;
  const thisMonthInc = monthlyData[MONTHS_BACK - 1]?.income ?? 0;
  const balance = thisMonthInc - thisMonthExp;
  const balanceColor = balance >= 0 ? colors.accent.success : colors.accent.danger;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color={colors.text.secondary} />
        </PressableScale>
        <View>
          <Text style={styles.headerTitle}>Statystyki</Text>
          <Text style={styles.headerSub}>{format(now, 'LLLL yyyy', { locale: pl })}</Text>
        </View>
        <PressableScale onPress={() => router.push('/settings' as any)} style={styles.settingsBtn}>
          <Settings2 size={18} color={colors.text.muted} />
        </PressableScale>
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Balance hero */}
        <View style={styles.heroCard}>
          <View style={styles.heroHeader}>
            <BarChart2 size={14} color={colors.text.muted} />
            <Text style={styles.heroLabel}>Saldo miesiąca</Text>
          </View>
          <Text style={[styles.heroBalance, { color: balanceColor }]}>
            {balance >= 0 ? '+' : ''}{balance.toFixed(2)}
            <Text style={styles.heroUnit}> zł</Text>
          </Text>
          <View style={styles.heroStatsRow}>
            <View style={styles.heroStat}>
              <TrendingUp size={12} color={colors.accent.success} />
              <Text style={[styles.heroStatVal, { color: colors.accent.success }]}>+{thisMonthInc.toFixed(0)} zł</Text>
              <Text style={styles.heroStatLabel}>przychody</Text>
            </View>
            <View style={styles.heroSep} />
            <View style={styles.heroStat}>
              <TrendingDown size={12} color={colors.accent.danger} />
              <Text style={[styles.heroStatVal, { color: colors.accent.danger }]}>-{thisMonthExp.toFixed(0)} zł</Text>
              <Text style={styles.heroStatLabel}>wydatki</Text>
            </View>
          </View>
        </View>

        {/* 6-month trend */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <BarChart2 size={13} color={colors.text.muted} />
            <Text style={styles.cardLabel}>Ostatnie 6 miesięcy</Text>
          </View>
          <View style={styles.chartArea}>
            {monthlyData.map((m, i) => (
              <View key={i} style={styles.monthCol}>
                <View style={styles.barsWrap}>
                  <View style={[styles.bar, {
                    height: Math.max(3, (m.income / maxMonthly) * 72),
                    backgroundColor: colors.accent.success,
                    opacity: m.income > 0 ? 1 : 0.25,
                  }]} />
                  <View style={[styles.bar, {
                    height: Math.max(3, (m.expenses / maxMonthly) * 72),
                    backgroundColor: colors.accent.danger,
                    opacity: m.expenses > 0 ? 1 : 0.25,
                  }]} />
                </View>
                <Text style={[styles.monthLabel, i === MONTHS_BACK - 1 && { color: colors.text.primary, fontWeight: '700' }]}>
                  {m.label}
                </Text>
              </View>
            ))}
          </View>
          <View style={styles.chartLegend}>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accent.success }]} />
              <Text style={styles.legendText}>Przychody</Text>
            </View>
            <View style={styles.legendItem}>
              <View style={[styles.legendDot, { backgroundColor: colors.accent.danger }]} />
              <Text style={styles.legendText}>Wydatki</Text>
            </View>
          </View>
        </View>

        {/* 30-day daily chart */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <TrendingDown size={13} color={colors.text.muted} />
            <Text style={styles.cardLabel}>Ostatnie 30 dni — dziennie</Text>
          </View>
          <View style={styles.dailyChart}>
            {dailyData.map((d, i) => {
              const barH = d.total > 0 ? Math.max(3, (d.total / maxDaily) * 64) : 2;
              const show = i % 5 === 0 || d.isToday;
              return (
                <View key={i} style={styles.dailyCol}>
                  <View style={styles.dailyBarWrap}>
                    <View style={[styles.dailyBar, {
                      height: barH,
                      backgroundColor: d.isToday
                        ? colors.accent.danger
                        : d.total > 0 ? colors.accent.danger + '80' : 'rgba(255,255,255,0.05)',
                      width: d.isToday ? 5 : 3,
                    }]} />
                  </View>
                  {show && (
                    <Text style={[styles.dailyLabel, d.isToday && { color: colors.accent.danger }]}>
                      {d.isToday ? 'dziś' : d.date.slice(8)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.dailyLegendRow}>
            <Text style={styles.dailyLegend}>
              Maks. dzień: {Math.max(...dailyData.map(d => d.total)).toFixed(0)} zł
            </Text>
            <Text style={styles.dailyLegend}>
              Śr. dzień: {dailyData.filter(d => d.total > 0).length > 0
                ? (dailyData.reduce((s, d) => s + d.total, 0) / dailyData.filter(d => d.total > 0).length).toFixed(0)
                : '0'} zł
            </Text>
          </View>
        </View>

        {/* Category breakdown */}
        {catBreakdown.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <TrendingDown size={13} color={colors.text.muted} />
              <Text style={styles.cardLabel}>Wydatki — kategorie</Text>
              <Text style={[styles.cardMeta, { color: colors.accent.danger }]}>
                {thisMonthExp.toFixed(0)} zł
              </Text>
            </View>
            {catBreakdown.map(({ cat, amount, pct, meta }, i) => {
              const IconComp = (LucideIcons as any)[meta.icon];
              const budget = budgets[cat];
              const overBudget = budget != null && amount > budget;
              const budgetPct = budget != null ? Math.min(1, amount / budget) : null;
              return (
                <View key={cat}>
                  <View style={styles.catRow}>
                    <View style={[styles.catIcon, overBudget && { backgroundColor: colors.accent.danger + '20' }]}>
                      {IconComp && <IconComp size={14} color={overBudget ? colors.accent.danger : colors.text.muted} />}
                    </View>
                    <View style={styles.catInfo}>
                      <View style={styles.catTopRow}>
                        <Text style={styles.catLabel}>{meta.label}</Text>
                        <Text style={[styles.catAmount, overBudget && { color: colors.accent.danger }]}>
                          {amount.toFixed(2)} zł
                        </Text>
                      </View>
                      <View style={styles.catBarTrack}>
                        <View
                          style={[styles.catBarFill, {
                            width: `${pct * 100}%`,
                            backgroundColor: meta.color,
                          }]}
                        />
                      </View>
                      {budget != null ? (
                        <>
                          <View style={styles.budgetBarTrack}>
                            <View style={[styles.budgetBarFill, {
                              width: `${(budgetPct ?? 0) * 100}%`,
                              backgroundColor: overBudget ? colors.accent.danger : colors.accent.success,
                            }]} />
                          </View>
                          <Text style={[styles.catPct, overBudget && { color: colors.accent.danger }]}>
                            {overBudget
                              ? `przekroczono o ${(amount - budget).toFixed(0)} zł`
                              : `${(budget - amount).toFixed(0)} zł pozostało z ${budget.toFixed(0)} zł`}
                          </Text>
                        </>
                      ) : (
                        <Text style={styles.catPct}>{Math.round(pct * 100)}% wydatków</Text>
                      )}
                    </View>
                  </View>
                </View>
              );
            })}
          </View>
        )}

        {expenses.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Brak danych</Text>
            <Text style={styles.emptySub}>Dodaj transakcje, żeby zobaczyć statystyki</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  backBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border.default,
  },
  headerTitle: { ...typography.h3, color: colors.text.primary, textAlign: 'center' },
  headerSub: { ...typography.caption, color: colors.text.muted, textAlign: 'center', marginTop: 1 },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },
  heroCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing[5],
    gap: spacing[3], borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  heroHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  heroLabel: {
    ...typography.caption, color: colors.text.secondary,
    textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, fontWeight: '600',
  },
  heroBalance: { fontSize: 42, fontWeight: '800', letterSpacing: -1.5, lineHeight: 46 },
  heroUnit: { fontSize: 20, fontWeight: '400', color: colors.text.muted },
  heroStatsRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)',
  },
  heroStat: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  heroStatVal: { ...typography.label, fontWeight: '700' },
  heroStatLabel: { ...typography.caption, color: colors.text.muted, fontSize: 10 },
  heroSep: { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.08)' },
  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    padding: spacing[4], gap: spacing[3],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardLabel: { ...typography.label, color: colors.text.secondary, flex: 1, fontWeight: '600' },
  cardMeta: { ...typography.label, fontWeight: '700' },
  chartArea: {
    flexDirection: 'row', alignItems: 'flex-end', gap: spacing[1],
    height: 88,
  },
  monthCol: { flex: 1, alignItems: 'center', gap: 4 },
  barsWrap: {
    flex: 1, width: '100%', flexDirection: 'row',
    alignItems: 'flex-end', justifyContent: 'center', gap: 2,
  },
  bar: { width: 8, borderRadius: 4, minHeight: 3 },
  monthLabel: { ...typography.caption, color: colors.text.muted, fontSize: 9 },
  chartLegend: {
    flexDirection: 'row', gap: spacing[4],
    paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.caption, color: colors.text.muted },
  dailyChart: { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  dailyCol: { flex: 1, alignItems: 'center', gap: 2 },
  dailyBarWrap: { height: 68, justifyContent: 'flex-end', alignItems: 'center' },
  dailyBar: { borderRadius: 2, minHeight: 2 },
  dailyLabel: { fontSize: 7, color: colors.text.muted, textAlign: 'center' },
  dailyLegendRow: {
    flexDirection: 'row', justifyContent: 'space-between',
    paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  dailyLegend: { fontSize: 10, color: colors.text.muted },

  catRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3] },
  catIcon: {
    width: 30, height: 30, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  catInfo: { flex: 1, gap: 4 },
  catTopRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catLabel: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '500' },
  catAmount: { ...typography.label, fontWeight: '700', fontSize: 13, color: colors.text.primary },
  catBarTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full, overflow: 'hidden' },
  catBarFill: { height: 3, borderRadius: radius.full },
  budgetBarTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.full, overflow: 'hidden', marginTop: 2 },
  budgetBarFill: { height: 3, borderRadius: radius.full },
  catPct: { ...typography.caption, color: colors.text.muted, fontSize: 9 },
  settingsBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  empty: { alignItems: 'center', paddingVertical: spacing[12], gap: spacing[2] },
  emptyTitle: { ...typography.h3, color: colors.text.secondary },
  emptySub: { ...typography.body, color: colors.text.muted, textAlign: 'center' },
});

