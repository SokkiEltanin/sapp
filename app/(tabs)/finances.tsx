import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, SectionList,
  Animated, ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ScanLine, BarChart2, RefreshCcw,
  ChevronLeft, ChevronRight, TrendingDown, TrendingUp,
  Settings2, Lightbulb, AlertTriangle, Wallet,
} from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { startOfMonth, endOfMonth, subMonths, isWithinInterval, parseISO, format } from 'date-fns';
import { pl } from 'date-fns/locale';

import ScreenHeader from '@/components/ui/ScreenHeader';
import PressableScale from '@/components/ui/PressableScale';
import ExpenseItem from '@/components/expenses/ExpenseItem';
import ExpenseSummaryCard from '@/components/expenses/ExpenseSummaryCard';
import { useExpenses } from '@/hooks/useExpenses';
import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { getCategoryMeta } from '@/utils/categories';
import { getBudgets, MonthlyBudgets } from '@/utils/budgets';
import { formatDate } from '@/utils/date';
import { Expense, ExpenseCategory } from '@/types';
import { colors, spacing, typography, radius } from '@/theme';
import { useTabSwipe } from '@/hooks/useTabSwipe';

const MONTHS_BACK = 6;

function isExp(e: Expense)  { return !e.type || e.type === 'expense'; }
function isInc(e: Expense)  { return e.type === 'income'; }
function inMonth(e: Expense, start: Date, end: Date) {
  try { return isWithinInterval(parseISO(e.date), { start, end }); }
  catch { return false; }
}
function pctLabel(curr: number, prev: number): { text: string; color: string } | null {
  if (!prev) return null;
  const diff = ((curr - prev) / prev) * 100;
  if (Math.abs(diff) < 5) return null;
  return {
    text: `${diff > 0 ? '+' : ''}${diff.toFixed(0)}%`,
    color: diff > 0 ? colors.accent.red : colors.accent.green,
  };
}

export default function FinancesScreen() {
  const { panHandlers, animatedStyle } = useTabSwipe();
  const { grouped, stats, isLoading, reload, remove } = useExpenses();
  const { expenses, setExpenses } = useExpensesStore();

  const [viewMode, setViewMode]   = useState<'list' | 'stats'>('list');
  const [budgets, setBudgets]     = useState<MonthlyBudgets>({});
  const [monthOffset, setMonthOffset] = useState(0);
  const [expandedCat, setExpandedCat] = useState<ExpenseCategory | null>(null);
  const [expandedTag, setExpandedTag] = useState<string | null>(null);
  const [tagProductSort, setTagProductSort] = useState<'price' | 'date'>('price');

  const today = new Date();

  useEffect(() => { getBudgets().then(setBudgets); }, []);
  useEffect(() => {
    if (expenses.length === 0) {
      expensesService.getAll().then(setExpenses).catch(() => {});
    }
  }, []);

  const monthBase      = subMonths(today, monthOffset);
  const start          = startOfMonth(monthBase);
  const end            = endOfMonth(monthBase);
  const prevStart      = startOfMonth(subMonths(monthBase, 1));
  const prevEnd        = endOfMonth(subMonths(monthBase, 1));
  const isCurrentMonth = monthOffset === 0;

  const prevMonthFn = useCallback((e: Expense) => inMonth(e, prevStart, prevEnd), [prevStart, prevEnd]);
  const thisMonthFn = useCallback((e: Expense) => inMonth(e, start, end),         [start, end]);

  const monthlyData = useMemo(() => {
    return Array.from({ length: MONTHS_BACK }, (_, i) => {
      const d   = subMonths(today, MONTHS_BACK - 1 - i);
      const s   = startOfMonth(d);
      const en  = endOfMonth(d);
      const exp = expenses.filter(e => isExp(e) && inMonth(e, s, en)).reduce((a, e) => a + e.amount, 0);
      const inc = expenses.filter(e => isInc(e) && inMonth(e, s, en)).reduce((a, e) => a + e.amount, 0);
      return {
        label: format(d, 'LLL', { locale: pl }),
        expenses: exp, income: inc, balance: inc - exp,
        isSelected: i === MONTHS_BACK - 1 - monthOffset,
      };
    });
  }, [expenses, monthOffset]);
  const maxMonthly = Math.max(...monthlyData.flatMap(m => [m.expenses, m.income]), 1);

  const weeklyData = useMemo(() => {
    const year = monthBase.getFullYear();
    const month = monthBase.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const monthStr = format(monthBase, 'yyyy-MM');
    const weeks: { label: string; total: number; hasToday: boolean }[] = [];
    let dayStart = 1;
    while (dayStart <= daysInMonth) {
      const dayEnd = Math.min(dayStart + 6, daysInMonth);
      const total = expenses
        .filter(e => isExp(e) && e.date.startsWith(monthStr))
        .filter(e => { const d = parseInt(e.date.slice(8, 10), 10); return d >= dayStart && d <= dayEnd; })
        .reduce((s, e) => s + e.amount, 0);
      const hasToday = isCurrentMonth && today.getDate() >= dayStart && today.getDate() <= dayEnd;
      weeks.push({ label: `${dayStart}–${dayEnd}`, total, hasToday });
      dayStart += 7;
    }
    return weeks;
  }, [expenses, monthBase, isCurrentMonth]);
  const maxWeekly = Math.max(...weeklyData.map(w => w.total), 1);

  const catBreakdown = useMemo(() => {
    const byCurr: Record<string, number> = {};
    const byPrev: Record<string, number> = {};
    for (const e of expenses) {
      if (!isExp(e)) continue;
      if (thisMonthFn(e)) byCurr[e.category] = (byCurr[e.category] ?? 0) + e.amount;
      if (prevMonthFn(e)) byPrev[e.category] = (byPrev[e.category] ?? 0) + e.amount;
    }
    const total = Object.values(byCurr).reduce((s, v) => s + v, 0);
    return Object.entries(byCurr)
      .sort(([, a], [, b]) => b - a)
      .map(([cat, amount]) => ({
        cat: cat as ExpenseCategory,
        amount, prevAmount: byPrev[cat] ?? 0,
        pct: total > 0 ? amount / total : 0,
        meta: getCategoryMeta(cat as any),
        change: pctLabel(amount, byPrev[cat] ?? 0),
      }));
  }, [expenses, thisMonthFn, prevMonthFn]);

  const catTransactions = useMemo(() => {
    if (!expandedCat) return [];
    return expenses
      .filter(e => isExp(e) && thisMonthFn(e) && e.category === expandedCat)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);
  }, [expenses, expandedCat, thisMonthFn]);

  const catProducts = useMemo(() => {
    if (!expandedCat) return [];
    const items: { date: string; name: string; price: number }[] = [];
    for (const e of catTransactions) {
      if (e.receiptItems?.length) {
        for (const it of e.receiptItems) {
          items.push({ date: e.date.slice(5, 10).replace('-', '.'), name: it.name, price: it.price });
        }
      }
    }
    return items;
  }, [catTransactions, expandedCat]);

  const tagProducts = useMemo(() => {
    if (!expandedTag) return [];
    const items: { name: string; price: number; date: string }[] = [];
    for (const e of expenses) {
      if (!isExp(e) || !thisMonthFn(e)) continue;
      if (e.receiptItems?.length) {
        for (const it of e.receiptItems) {
          if (it.tags.includes(expandedTag)) {
            items.push({ name: it.name, price: it.price, date: e.date.slice(5, 10).replace('-', '.') });
          }
        }
      } else if (e.tags.includes(expandedTag)) {
        items.push({ name: e.note || e.storeName || '—', price: e.amount, date: e.date.slice(5, 10).replace('-', '.') });
      }
    }
    if (tagProductSort === 'price') return items.sort((a, b) => b.price - a.price);
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, expandedTag, tagProductSort, thisMonthFn]);

  const tagBreakdown = useMemo(() => {
    const byTag: Record<string, number> = {};
    for (const e of expenses) {
      if (!isExp(e) || !thisMonthFn(e)) continue;
      const items = e.receiptItems;
      if (items?.length) {
        for (const it of items) for (const tag of it.tags) byTag[tag] = (byTag[tag] ?? 0) + it.price;
      } else {
        for (const tag of e.tags) if (tag) byTag[tag] = (byTag[tag] ?? 0) + e.amount;
      }
    }
    const total = Object.values(byTag).reduce((s, v) => s + v, 0);
    return Object.entries(byTag)
      .sort(([, a], [, b]) => b - a)
      .slice(0, 10)
      .map(([tag, amount]) => ({ tag, amount, pct: total > 0 ? amount / total : 0 }));
  }, [expenses, thisMonthFn]);

  // Most recent income (any month) for salary comparison
  const lastIncome = useMemo(() =>
    expenses.filter(isInc).sort((a, b) => b.date.localeCompare(a.date))[0] ?? null,
    [expenses]);

  // Top individual products from receipt scans this month
  const topProducts = useMemo(() => {
    const items: { name: string; price: number; date: string; cat: ExpenseCategory }[] = [];
    for (const e of expenses) {
      if (!isExp(e) || !thisMonthFn(e)) continue;
      if (e.receiptItems?.length) {
        for (const it of e.receiptItems) {
          if (it.price > 0) items.push({ name: it.name, price: it.price, date: e.date.slice(5, 10).replace('-', '.'), cat: e.category as ExpenseCategory });
        }
      }
    }
    return items.sort((a, b) => b.price - a.price).slice(0, 10);
  }, [expenses, thisMonthFn]);

  // Spending by day-of-week (Mon–Sun totals)
  const weekdayBreakdown = useMemo(() => {
    const days = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
    const totals = [0, 0, 0, 0, 0, 0, 0];
    for (const e of expenses) {
      if (!isExp(e) || !thisMonthFn(e)) continue;
      const d = parseISO(e.date);
      const dow = (d.getDay() + 6) % 7; // Mon=0
      totals[dow] += e.amount;
    }
    const max = Math.max(...totals, 1);
    return days.map((label, i) => ({ label, total: totals[i], pct: totals[i] / max }));
  }, [expenses, thisMonthFn]);

  const thisMonthData = monthlyData.find(m => m.isSelected) ?? monthlyData[MONTHS_BACK - 1];
  const thisMonthExp  = thisMonthData.expenses;
  const thisMonthInc  = thisMonthData.income;
  const balance       = thisMonthInc - thisMonthExp;
  const balanceColor  = balance >= 0 ? colors.accent.green : colors.accent.red;
  const avgDailySpend = useMemo(() => {
    const day = isCurrentMonth ? today.getDate() : new Date(end).getDate();
    return day > 0 && thisMonthExp > 0 ? thisMonthExp / day : 0;
  }, [thisMonthExp, isCurrentMonth, today, end]);

  const spendingAlerts = useMemo(
    () => catBreakdown.filter(c => c.prevAmount > 0 && c.amount > c.prevAmount * 1.5),
    [catBreakdown],
  );

  const insights = useMemo(() => {
    const msgs: { text: string; good?: boolean; bad?: boolean }[] = [];
    const prevData = monthlyData[MONTHS_BACK - 1 - monthOffset - 1];
    if (prevData?.expenses > 0 && thisMonthExp > 0) {
      const diff = thisMonthExp - prevData.expenses;
      const pct  = Math.abs(diff / prevData.expenses * 100).toFixed(0);
      if (diff > 0) msgs.push({ text: `Wydałeś o ${pct}% więcej niż poprzednio.`, bad: true });
      else if (diff < 0) msgs.push({ text: `Wydałeś o ${pct}% mniej niż poprzednio.`, good: true });
    }
    if (catBreakdown.length > 0) {
      const top = catBreakdown[0];
      msgs.push({ text: `Dominuje ${top.meta.label} - ${Math.round(top.pct * 100)}% wydatków.` });
    }
    const day = isCurrentMonth ? today.getDate() : new Date(end).getDate();
    if (day > 0 && thisMonthExp > 0) {
      msgs.push({ text: `Średnia dzienna: ${(thisMonthExp / day).toFixed(0)} zł.` });
    }
    catBreakdown.forEach(c => {
      const b = budgets[c.cat];
      if (b != null && c.amount > b) {
        msgs.push({ text: `${c.meta.label} przekracza budżet o ${(c.amount - b).toFixed(0)} zł.`, bad: true });
      }
    });
    if (balance > 0 && thisMonthInc > 0) {
      msgs.push({ text: `Zaoszczędziłeś ${balance.toFixed(0)} zł.`, good: true });
    } else if (balance < -50 && thisMonthInc > 0) {
      msgs.push({ text: `Wydatki przekraczają przychody o ${Math.abs(balance).toFixed(0)} zł.`, bad: true });
    }
    return msgs;
  }, [monthlyData, catBreakdown, budgets, thisMonthExp, thisMonthInc, balance, isCurrentMonth]);

  const sections = grouped.map(([date, items]) => ({
    title: formatDate(date + 'T12:00:00'),
    data: items,
  }));

  return (
    <SafeAreaView style={styles.container} edges={['top']} {...panHandlers}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <ScreenHeader
          title="Finanse"
          subtitle={
            viewMode === 'stats'
              ? format(monthBase, 'LLLL yyyy', { locale: pl })
              : new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })
          }
          accentColor={colors.expenses}
          rightSlot={
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <PressableScale onPress={() => router.push('/expenses/scan' as any)} style={styles.headerBtn}>
                <ScanLine size={17} color={colors.accent.blue} />
              </PressableScale>
              <PressableScale onPress={() => router.push('/expenses/subscriptions' as any)} style={styles.headerBtn}>
                <RefreshCcw size={17} color={colors.text.secondary} />
              </PressableScale>
            </View>
          }
        />

        {/* Segment toggle */}
        <View style={styles.segWrap}>
          <TouchableOpacity
            onPress={() => setViewMode('list')}
            style={[styles.segBtn, viewMode === 'list' && styles.segBtnActive]}
            activeOpacity={0.7}
          >
            <Wallet size={13} color={viewMode === 'list' ? colors.text.primary : colors.text.muted} />
            <Text style={[styles.segText, viewMode === 'list' && styles.segTextActive]}>Transakcje</Text>
          </TouchableOpacity>
          <TouchableOpacity
            onPress={() => setViewMode('stats')}
            style={[styles.segBtn, viewMode === 'stats' && styles.segBtnActive]}
            activeOpacity={0.7}
          >
            <BarChart2 size={13} color={viewMode === 'stats' ? colors.text.primary : colors.text.muted} />
            <Text style={[styles.segText, viewMode === 'stats' && styles.segTextActive]}>Statystyki</Text>
          </TouchableOpacity>
        </View>

        {/* ── LIST VIEW ── */}
        {viewMode === 'list' ? (
          <SectionList
            sections={sections}
            keyExtractor={(item) => item.id}
            refreshControl={
              <RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={colors.text.muted} />
            }
            ListHeaderComponent={
              <ExpenseSummaryCard
                monthExpenses={stats.monthExpenses}
                monthIncome={stats.monthIncome}
                thisWeek={stats.thisWeek}
                lastWeek={stats.lastWeek}
                topCategory={stats.topCategory}
                monthCategorySpend={stats.monthCategorySpend}
              />
            }
            renderSectionHeader={({ section: { title } }) => (
              <View style={styles.sectionHeader}>
                <View style={styles.sectionDot} />
                <Text style={styles.sectionTitle}>{title}</Text>
              </View>
            )}
            renderItem={({ item, index }) => (
              <View style={styles.listPadding}>
                <ExpenseItem
                  expense={item}
                  index={index}
                  onPress={(e) => router.push(`/expenses/${e.id}` as any)}
                />
              </View>
            )}
            ListEmptyComponent={
              !isLoading ? (
                <View style={styles.empty}>
                  <Text style={styles.emptyTitle}>Brak transakcji</Text>
                  <Text style={styles.emptySubtitle}>Dodaj pierwszą transakcję przyciskiem poniżej</Text>
                </View>
              ) : null
            }
            contentContainerStyle={{ paddingBottom: 160 }}
            stickySectionHeadersEnabled={false}
          />

        ) : (

          /* ── STATS VIEW ── */
          <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.statsScroll}>

            {/* Month picker */}
            <View style={styles.monthPicker}>
              <PressableScale
                onPress={() => setMonthOffset(o => Math.min(o + 1, MONTHS_BACK - 1))}
                style={styles.monthArrow}
              >
                <ChevronLeft size={16} color={monthOffset < MONTHS_BACK - 1 ? colors.text.secondary : colors.text.muted} />
              </PressableScale>
              <View style={styles.monthLabelWrap}>
                <Text style={styles.monthTitle}>{format(monthBase, 'LLLL', { locale: pl })}</Text>
                <Text style={styles.monthYear}>{format(monthBase, 'yyyy')}</Text>
              </View>
              <PressableScale
                onPress={() => setMonthOffset(o => Math.max(o - 1, 0))}
                style={styles.monthArrow}
              >
                <ChevronRight size={16} color={monthOffset > 0 ? colors.text.secondary : colors.text.muted} />
              </PressableScale>
              <PressableScale onPress={() => router.push('/settings' as any)} style={styles.settingsBtn}>
                <Settings2 size={16} color={colors.text.muted} />
              </PressableScale>
            </View>

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
                  <TrendingUp size={12} color={colors.accent.green} />
                  <Text style={[styles.heroStatVal, { color: colors.accent.green }]}>
                    +{thisMonthInc.toFixed(0)} zł
                  </Text>
                  <Text style={styles.heroStatLabel}>przychody</Text>
                </View>
                <View style={styles.heroSep} />
                <View style={styles.heroStat}>
                  <TrendingDown size={12} color={colors.accent.red} />
                  <Text style={[styles.heroStatVal, { color: colors.accent.red }]}>
                    -{thisMonthExp.toFixed(0)} zł
                  </Text>
                  <Text style={styles.heroStatLabel}>wydatki</Text>
                </View>
                {avgDailySpend > 0 && (
                  <>
                    <View style={styles.heroSep} />
                    <View style={styles.heroStat}>
                      <Text style={[styles.heroStatVal, { color: colors.text.muted }]}>
                        {avgDailySpend.toFixed(0)} zł
                      </Text>
                      <Text style={styles.heroStatLabel}>śr/dzień</Text>
                    </View>
                  </>
                )}
              </View>
            </View>

            {/* Salary vs expenses card */}
            {lastIncome && thisMonthExp > 0 && (() => {
              const ratio    = thisMonthExp / lastIncome.amount;
              const leftover = lastIncome.amount - thisMonthExp;
              const over     = leftover < 0;
              const barColor = ratio >= 1 ? colors.accent.red : ratio >= 0.75 ? colors.accent.amber : colors.accent.green;
              const incDate  = lastIncome.date.slice(0, 7);
              const incLabel = format(parseISO(lastIncome.date.slice(0, 10) + 'T12:00:00'), 'LLLL', { locale: pl });
              return (
                <View style={[styles.card, styles.salaryCard]}>
                  <View style={styles.cardRow}>
                    <TrendingUp size={13} color={colors.accent.green} />
                    <Text style={[styles.cardLabel, { color: colors.accent.green }]}>Ostatni przychód ({incLabel})</Text>
                    <Text style={[styles.cardMeta, { color: colors.accent.green }]}>+{lastIncome.amount.toFixed(0)} zł</Text>
                  </View>

                  {/* Big ratio */}
                  <View style={styles.salaryRatioRow}>
                    <Text style={[styles.salaryBigPct, { color: barColor }]}>
                      {Math.round(ratio * 100)}%
                    </Text>
                    <Text style={styles.salaryRatioLabel}>wypłaty{'\n'}wydane</Text>
                    <View style={{ flex: 1 }} />
                    <View style={styles.salarySideStats}>
                      <View style={styles.salarySideStat}>
                        <Text style={[styles.salarySideVal, { color: colors.accent.red }]}>-{thisMonthExp.toFixed(0)} zł</Text>
                        <Text style={styles.salarySideLabel}>wydatki</Text>
                      </View>
                      <View style={[styles.salarySideStat, { alignItems: 'flex-end' }]}>
                        <Text style={[styles.salarySideVal, { color: over ? colors.accent.red : colors.accent.green }]}>
                          {over ? '-' : '+'}{Math.abs(leftover).toFixed(0)} zł
                        </Text>
                        <Text style={styles.salarySideLabel}>{over ? 'brakuje' : 'zostaje'}</Text>
                      </View>
                    </View>
                  </View>

                  {/* Progress bar */}
                  <View style={styles.salaryBarTrack}>
                    <View style={[styles.salaryBarFill, {
                      width: `${Math.min(100, ratio * 100)}%`,
                      backgroundColor: barColor,
                    }]} />
                  </View>
                  <Text style={styles.salaryHint}>
                    {ratio < 0.5 ? 'Oszczędzasz solidnie.' : ratio < 0.75 ? 'Całkiem dobrze, ale można lepiej.' : ratio < 1 ? 'Uwaga — zostało mało.' : 'Wydatki przekroczyły przychód!'}
                  </Text>
                </View>
              );
            })()}

            {/* Spending alerts */}
            {spendingAlerts.length > 0 && (
              <View style={[styles.card, styles.alertCard]}>
                <View style={styles.cardRow}>
                  <AlertTriangle size={13} color={colors.accent.amber} />
                  <Text style={[styles.cardLabel, { color: colors.accent.amber }]}>Wzrost wydatków</Text>
                </View>
                {spendingAlerts.map(({ cat, amount, prevAmount, meta, change }) => {
                  const Icon = (LucideIcons as any)[meta.icon];
                  return (
                    <View key={cat} style={styles.alertRow}>
                      <View style={[styles.alertIcon, { backgroundColor: colors.accent.amber + '18' }]}>
                        {Icon && <Icon size={12} color={colors.accent.amber} />}
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.alertText}>
                          <Text style={{ fontWeight: '700' }}>{meta.label}</Text>
                          {' — '}{amount.toFixed(0)} zł vs {prevAmount.toFixed(0)} zł poprzednio
                        </Text>
                      </View>
                      <Text style={[styles.alertPct, { color: colors.accent.amber }]}>{change?.text}</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {/* 6-month trend */}
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <BarChart2 size={13} color={colors.text.muted} />
                <Text style={styles.cardLabel}>Ostatnie 6 miesięcy</Text>
              </View>
              <View style={styles.chartArea}>
                {monthlyData.map((m, i) => (
                  <TouchableOpacity key={i} style={styles.monthCol} onPress={() => setMonthOffset(MONTHS_BACK - 1 - i)}>
                    <View style={styles.barsWrap}>
                      <View style={[styles.bar, {
                        height: Math.max(3, (m.income / maxMonthly) * 100),
                        backgroundColor: colors.accent.green,
                        opacity: m.income > 0 ? (m.isSelected ? 1 : 0.5) : 0.15,
                      }]} />
                      <View style={[styles.bar, {
                        height: Math.max(3, (m.expenses / maxMonthly) * 100),
                        backgroundColor: colors.accent.red,
                        opacity: m.expenses > 0 ? (m.isSelected ? 1 : 0.5) : 0.15,
                      }]} />
                    </View>
                    <Text style={[styles.monthLbl, m.isSelected && styles.monthLblSelected]}>{m.label}</Text>
                    {m.isSelected && <View style={styles.monthDot} />}
                  </TouchableOpacity>
                ))}
              </View>
              <View style={styles.chartLegend}>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.accent.green }]} />
                  <Text style={styles.legendText}>Przychody</Text>
                </View>
                <View style={styles.legendItem}>
                  <View style={[styles.legendDot, { backgroundColor: colors.accent.red }]} />
                  <Text style={styles.legendText}>Wydatki</Text>
                </View>
                <Text style={styles.legendHint}>Kliknij słupek by wybrać miesiąc</Text>
              </View>
            </View>

            {/* Weekly chart */}
            <View style={styles.card}>
              <View style={styles.cardRow}>
                <TrendingDown size={13} color={colors.text.muted} />
                <Text style={styles.cardLabel}>{format(monthBase, 'LLLL', { locale: pl })} — tygodniowo</Text>
              </View>
              <View style={styles.weeklyChart}>
                {weeklyData.map((w, i) => {
                  const barH = w.total > 0 ? Math.max(8, (w.total / maxWeekly) * 110) : 4;
                  return (
                    <View key={i} style={styles.weeklyCol}>
                      <Text style={[styles.weeklyAmt, w.hasToday && { color: colors.accent.red }]}>
                        {w.total > 0 ? (w.total >= 1000 ? `${(w.total / 1000).toFixed(1)}k` : w.total.toFixed(0)) : ''}
                      </Text>
                      <View style={styles.weeklyBarWrap}>
                        <View style={[styles.weeklyBar, {
                          height: barH,
                          backgroundColor: w.hasToday ? colors.accent.red : w.total > 0 ? colors.accent.red + '80' : 'rgba(255,255,255,0.07)',
                        }]} />
                      </View>
                      <Text style={[styles.weeklyLabel, w.hasToday && { color: colors.accent.red, fontWeight: '700' }]}>
                        {w.label}
                      </Text>
                    </View>
                  );
                })}
              </View>
              <View style={styles.dailyLegendRow}>
                <Text style={styles.dailyLegend}>Maks. tydzień: {maxWeekly.toFixed(0)} zł</Text>
                <Text style={styles.dailyLegend}>
                  Razem: {weeklyData.reduce((s, w) => s + w.total, 0).toFixed(0)} zł
                </Text>
              </View>
            </View>

            {/* Insights */}
            {insights.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <Lightbulb size={13} color={colors.accent.amber} />
                  <Text style={[styles.cardLabel, { color: colors.accent.amber }]}>Spostrzeżenia</Text>
                </View>
                {insights.map((ins, i) => (
                  <View key={i} style={styles.insightRow}>
                    <View style={[styles.insightDot, {
                      backgroundColor: ins.good ? colors.accent.green : ins.bad ? colors.accent.red : colors.text.muted,
                    }]} />
                    <Text style={[
                      styles.insightText,
                      ins.good && { color: colors.accent.green },
                      ins.bad  && { color: colors.accent.red },
                    ]}>
                      {ins.text}
                    </Text>
                  </View>
                ))}
              </View>
            )}

            {/* Category breakdown */}
            {catBreakdown.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <TrendingDown size={13} color={colors.text.muted} />
                  <Text style={styles.cardLabel}>Wydatki — kategorie</Text>
                  <Text style={[styles.cardMeta, { color: colors.accent.red }]}>{thisMonthExp.toFixed(0)} zł</Text>
                </View>
                {catBreakdown.map(({ cat, amount, pct, meta, change, prevAmount }) => {
                  const IconComp  = (LucideIcons as any)[meta.icon];
                  const budget    = budgets[cat];
                  const overBudget = budget != null && amount > budget;
                  const budgetPct  = budget != null ? Math.min(1, amount / budget) : null;
                  const isExpanded = expandedCat === cat;
                  return (
                    <View key={cat}>
                      <TouchableOpacity onPress={() => setExpandedCat(isExpanded ? null : cat)} activeOpacity={0.7}>
                        <View style={[styles.catRow, isExpanded && styles.catRowExpanded]}>
                          <View style={[styles.catIcon, overBudget && { backgroundColor: colors.accent.red + '20' }]}>
                            {IconComp && <IconComp size={14} color={overBudget ? colors.accent.red : colors.text.muted} />}
                          </View>
                          <View style={styles.catInfo}>
                            <View style={styles.catTopRow}>
                              <Text style={styles.catLabel}>{meta.label}</Text>
                              <View style={styles.catRight}>
                                {change && (
                                  <View style={[styles.changeBadge, { backgroundColor: change.color + '20' }]}>
                                    <Text style={[styles.changeBadgeText, { color: change.color }]}>{change.text}</Text>
                                  </View>
                                )}
                                <Text style={[styles.catAmount, overBudget && { color: colors.accent.red }]}>
                                  {amount.toFixed(2)} zł
                                </Text>
                              </View>
                            </View>
                            <View style={styles.catBarTrack}>
                              <View style={[styles.catBarFill, { width: `${pct * 100}%`, backgroundColor: meta.color }]} />
                            </View>
                            {budget != null ? (
                              <>
                                <View style={styles.budgetBarTrack}>
                                  <View style={[styles.budgetBarFill, {
                                    width: `${(budgetPct ?? 0) * 100}%`,
                                    backgroundColor: overBudget ? colors.accent.red : colors.accent.green,
                                  }]} />
                                </View>
                                <Text style={[styles.catPct, overBudget && { color: colors.accent.red }]}>
                                  {overBudget ? `przekroczono o ${(amount - budget).toFixed(0)} zł` : `${(budget - amount).toFixed(0)} zł z ${budget.toFixed(0)} zł`}
                                </Text>
                              </>
                            ) : (
                              <Text style={styles.catPct}>
                                {Math.round(pct * 100)}% wydatków
                                {prevAmount > 0 ? ` · poprzednio: ${prevAmount.toFixed(0)} zł` : ''}
                              </Text>
                            )}
                          </View>
                        </View>
                      </TouchableOpacity>

                      {isExpanded && (catProducts.length > 0 || catTransactions.length > 0) && (
                        <View style={styles.txList}>
                          {catProducts.length > 0
                            ? catProducts.map((p, idx) => (
                              <View key={idx} style={styles.txRow}>
                                <Text style={styles.txDate}>{p.date}</Text>
                                <Text style={styles.txNote} numberOfLines={1}>{p.name}</Text>
                                <Text style={styles.txAmt}>{p.price.toFixed(2)} zł</Text>
                              </View>
                            ))
                            : catTransactions.map(e => (
                              <View key={e.id} style={styles.txRow}>
                                <Text style={styles.txDate}>{e.date.slice(5, 10).replace('-', '.')}</Text>
                                <Text style={styles.txNote} numberOfLines={1}>{e.note || e.storeName || '—'}</Text>
                                <Text style={styles.txAmt}>{e.amount.toFixed(2)} zł</Text>
                              </View>
                            ))
                          }
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Tag breakdown */}
            {tagBreakdown.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <TrendingDown size={13} color={colors.accent.blue} />
                  <Text style={[styles.cardLabel, { color: colors.accent.blue }]}>Wydatki — co kupujesz</Text>
                  <Text style={styles.cardMeta2}>dotknij by zobaczyć produkty</Text>
                </View>
                {tagBreakdown.map(({ tag, amount, pct }) => {
                  const isTagExpanded = expandedTag === tag;
                  return (
                    <View key={tag}>
                      <TouchableOpacity
                        onPress={() => setExpandedTag(isTagExpanded ? null : tag)}
                        activeOpacity={0.7}
                      >
                        <View style={[styles.tagRow, isTagExpanded && styles.tagRowExpanded]}>
                          <Text style={[styles.tagName, isTagExpanded && { color: colors.accent.blue }]}>{tag}</Text>
                          <View style={styles.tagBarTrack}>
                            <View style={[styles.tagBarFill, { width: `${pct * 100}%` }]} />
                          </View>
                          <Text style={styles.tagAmount}>{amount.toFixed(0)} zł</Text>
                        </View>
                      </TouchableOpacity>
                      {isTagExpanded && (
                        <View style={styles.tagProductList}>
                          <View style={styles.tagSortRow}>
                            <TouchableOpacity
                              onPress={() => setTagProductSort('price')}
                              style={[styles.tagSortBtn, tagProductSort === 'price' && styles.tagSortBtnActive]}
                            >
                              <Text style={[styles.tagSortBtnText, tagProductSort === 'price' && styles.tagSortBtnTextActive]}>Cena</Text>
                            </TouchableOpacity>
                            <TouchableOpacity
                              onPress={() => setTagProductSort('date')}
                              style={[styles.tagSortBtn, tagProductSort === 'date' && styles.tagSortBtnActive]}
                            >
                              <Text style={[styles.tagSortBtnText, tagProductSort === 'date' && styles.tagSortBtnTextActive]}>Data</Text>
                            </TouchableOpacity>
                          </View>
                          {tagProducts.length > 0
                            ? tagProducts.map((p, idx) => (
                              <View key={idx} style={styles.txRow}>
                                <Text style={styles.txDate}>{p.date}</Text>
                                <Text style={styles.txNote} numberOfLines={1}>{p.name}</Text>
                                <Text style={styles.txAmt}>{p.price.toFixed(2)} zł</Text>
                              </View>
                            ))
                            : <Text style={styles.tagNoProducts}>Brak produktów z tagiem "{tag}"</Text>
                          }
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            )}

            {/* Day-of-week spending pattern */}
            {thisMonthExp > 0 && (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <BarChart2 size={13} color={colors.text.muted} />
                  <Text style={styles.cardLabel}>Kiedy wydajesz najwięcej</Text>
                </View>
                <View style={styles.weekRow}>
                  {weekdayBreakdown.map((d, i) => {
                    const isMax = d.pct === 1 && d.total > 0;
                    return (
                      <View key={i} style={styles.weekCol}>
                        <Text style={[styles.weekAmt, isMax && { color: colors.accent.red }]}>
                          {d.total > 0 ? `${d.total.toFixed(0)}` : ''}
                        </Text>
                        <View style={styles.weekBarWrap}>
                          <View style={[styles.weekBar, {
                            height: Math.max(3, d.pct * 72),
                            backgroundColor: isMax ? colors.accent.red : d.total > 0 ? colors.accent.red + '60' : 'rgba(255,255,255,0.05)',
                          }]} />
                        </View>
                        <Text style={[styles.weekLabel, isMax && { color: colors.accent.red, fontWeight: '700' }]}>{d.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* Top products from receipts */}
            {topProducts.length > 0 && (
              <View style={styles.card}>
                <View style={styles.cardRow}>
                  <TrendingDown size={13} color={colors.accent.purple} />
                  <Text style={[styles.cardLabel, { color: colors.accent.purple }]}>Najdroższe produkty</Text>
                  <Text style={styles.cardMeta}>{format(monthBase, 'LLL', { locale: pl })}</Text>
                </View>
                {topProducts.map((p, i) => {
                  const meta = getCategoryMeta(p.cat);
                  return (
                    <View key={i} style={styles.productRow}>
                      <Text style={styles.productRank}>#{i + 1}</Text>
                      <View style={styles.productInfo}>
                        <Text style={styles.productName} numberOfLines={1}>{p.name}</Text>
                        <Text style={styles.productDate}>{p.date} · {meta.label}</Text>
                      </View>
                      <Text style={styles.productPrice}>{p.price.toFixed(2)} zł</Text>
                    </View>
                  );
                })}
              </View>
            )}

            {expenses.length === 0 && (
              <View style={styles.empty}>
                <Text style={styles.emptyTitle}>Brak danych</Text>
                <Text style={styles.emptySubtitle}>Dodaj transakcje żeby zobaczyć statystyki</Text>
              </View>
            )}
          </ScrollView>
        )}

      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },

  segWrap: {
    flexDirection: 'row',
    marginHorizontal: spacing[4],
    marginBottom: spacing[2],
    backgroundColor: colors.bg.card,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border.default,
    overflow: 'hidden',
  },
  segBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: spacing[2],
  },
  segBtnActive: { backgroundColor: colors.bg.elevated },
  segText: { fontSize: 12, fontWeight: '600', color: colors.text.muted },
  segTextActive: { color: colors.text.primary },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2],
  },
  sectionDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.2)' },
  sectionTitle: {
    ...typography.label, color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11,
  },
  listPadding: { paddingHorizontal: spacing[4] },

  empty: { alignItems: 'center', paddingTop: spacing[12], paddingHorizontal: spacing[8], gap: spacing[3] },
  emptyTitle: { ...typography.h3, color: colors.text.secondary },
  emptySubtitle: { ...typography.body, color: colors.text.muted, textAlign: 'center', lineHeight: 22 },

  headerBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Stats styles ──────────────────────────────────────────────────────────────

  statsScroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 130 },

  monthPicker: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], marginBottom: spacing[2],
  },
  monthArrow: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  monthLabelWrap: { alignItems: 'center', flex: 1 },
  monthTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary, textTransform: 'capitalize' },
  monthYear:  { fontSize: 11, color: colors.text.muted },
  settingsBtn: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },

  heroCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing[5],
    gap: spacing[3], borderWidth: 1, borderColor: colors.border.default,
  },
  heroHeader:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  heroLabel:     { fontSize: 10, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1, fontWeight: '600' },
  heroBalance:   { fontSize: 42, fontWeight: '800', letterSpacing: -1.5, lineHeight: 46 },
  heroUnit:      { fontSize: 20, fontWeight: '400', color: colors.text.muted },
  heroStatsRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  heroStat:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  heroStatVal:   { fontSize: 13, fontWeight: '700' },
  heroStatLabel: { fontSize: 10, color: colors.text.muted },
  heroSep:       { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.08)' },

  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    padding: spacing[4], gap: spacing[3],
    borderWidth: 1, borderColor: colors.border.default,
  },
  alertCard: { borderColor: colors.accent.amber + '30', backgroundColor: colors.accent.amber + '08' },
  cardRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardLabel: { fontSize: 12, color: colors.text.secondary, flex: 1, fontWeight: '600' },
  cardMeta:  { fontSize: 13, fontWeight: '700' },

  alertRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  alertIcon: { width: 26, height: 26, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  alertText: { fontSize: 12, color: colors.text.secondary, lineHeight: 18 },
  alertPct:  { fontSize: 12, fontWeight: '700', minWidth: 44, textAlign: 'right' },

  chartArea:        { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[1], height: 130 },
  monthCol:         { flex: 1, alignItems: 'center', gap: 4 },
  barsWrap:         { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
  bar:              { width: 11, borderRadius: 5, minHeight: 3 },
  monthLbl:         { fontSize: 11, color: colors.text.muted },
  monthLblSelected: { color: colors.text.primary, fontWeight: '700' },
  monthDot:         { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent.blue },
  chartLegend:      { flexDirection: 'row', gap: spacing[3], alignItems: 'center', paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', flexWrap: 'wrap' },
  legendItem:       { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  legendDot:        { width: 8, height: 8, borderRadius: 4 },
  legendText:       { fontSize: 11, color: colors.text.muted },
  legendHint:       { fontSize: 10, color: colors.text.muted, flex: 1, textAlign: 'right' },

  weeklyChart:    { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  weeklyCol:      { flex: 1, alignItems: 'center', gap: spacing[2] },
  weeklyBarWrap:  { height: 120, justifyContent: 'flex-end', alignItems: 'center', width: '100%' },
  weeklyBar:      { width: '80%', borderRadius: radius.md, minHeight: 4 },
  weeklyLabel:    { fontSize: 11, color: colors.text.muted, textAlign: 'center' },
  weeklyAmt:      { fontSize: 11, fontWeight: '700', color: colors.text.secondary, textAlign: 'center', minHeight: 16 },
  dailyLegendRow: { flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  dailyLegend:    { fontSize: 10, color: colors.text.muted },

  insightRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  insightDot:  { width: 6, height: 6, borderRadius: 3, marginTop: 5 },
  insightText: { flex: 1, fontSize: 13, color: colors.text.secondary, lineHeight: 20 },

  catRow:         { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], paddingVertical: spacing[1] },
  catRowExpanded: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, padding: spacing[2] },
  catIcon:        { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2, backgroundColor: 'rgba(255,255,255,0.05)' },
  catInfo:        { flex: 1, gap: 4 },
  catTopRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catRight:       { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  catLabel:       { fontSize: 13, color: colors.text.primary, fontWeight: '500' },
  catAmount:      { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  changeBadge:    { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  changeBadgeText:{ fontSize: 10, fontWeight: '700' },
  catBarTrack:    { height: 7, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full, overflow: 'hidden' },
  catBarFill:     { height: 7, borderRadius: radius.full },
  budgetBarTrack: { height: 5, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.full, overflow: 'hidden', marginTop: 2 },
  budgetBarFill:  { height: 5, borderRadius: radius.full },
  catPct:         { fontSize: 9, color: colors.text.muted },

  txList: { marginLeft: 46, marginTop: spacing[1], marginBottom: spacing[2], gap: 4 },
  txRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  txDate: { fontSize: 10, color: colors.text.muted, width: 36 },
  txNote: { flex: 1, fontSize: 12, color: colors.text.secondary },
  txAmt:  { fontSize: 12, fontWeight: '700', color: colors.text.primary },

  tagRow:            { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 5 },
  tagRowExpanded:    { backgroundColor: 'rgba(85,180,255,0.06)', borderRadius: radius.md, paddingHorizontal: spacing[2] },
  tagName:           { fontSize: 12, color: colors.text.secondary, fontWeight: '600', width: 100 },
  tagBarTrack:       { flex: 1, height: 7, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full, overflow: 'hidden' },
  tagBarFill:        { height: 7, borderRadius: radius.full, backgroundColor: colors.accent.blue },
  tagAmount:         { fontSize: 12, fontWeight: '700', color: colors.text.primary, width: 52, textAlign: 'right' },
  tagProductList:    { marginLeft: spacing[2], marginBottom: spacing[2], gap: 2 },
  tagSortRow:        { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2], paddingTop: spacing[1] },
  tagSortBtn:        { paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  tagSortBtnActive:  { backgroundColor: colors.accent.blue + '20', borderColor: colors.accent.blue + '50' },
  tagSortBtnText:    { fontSize: 11, color: colors.text.muted, fontWeight: '600' },
  tagSortBtnTextActive: { color: colors.accent.blue },
  tagNoProducts:     { fontSize: 12, color: colors.text.muted, fontStyle: 'italic', paddingVertical: spacing[2] },
  cardMeta2:         { fontSize: 9, color: colors.text.muted, fontStyle: 'italic' },

  // ── Salary card ──────────────────────────────────────────────────────────────
  salaryCard:      { borderColor: colors.accent.green + '22' },
  salaryRatioRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  salaryBigPct:    { fontSize: 52, fontWeight: '900', letterSpacing: -2, lineHeight: 56 },
  salaryRatioLabel:{ fontSize: 11, color: colors.text.muted, lineHeight: 16 },
  salarySideStats: { gap: spacing[2] },
  salarySideStat:  { gap: 1 },
  salarySideVal:   { fontSize: 15, fontWeight: '800', letterSpacing: -0.5 },
  salarySideLabel: { fontSize: 9, color: colors.text.muted },
  salaryBarTrack:  { height: 10, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full, overflow: 'hidden' },
  salaryBarFill:   { height: 10, borderRadius: radius.full },
  salaryHint:      { fontSize: 11, color: colors.text.muted, fontStyle: 'italic' },

  // ── Weekday chart ────────────────────────────────────────────────────────────
  weekRow:    { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  weekCol:    { flex: 1, alignItems: 'center', gap: 3 },
  weekBarWrap:{ height: 96, justifyContent: 'flex-end', alignItems: 'center' },
  weekBar:    { width: 22, borderRadius: 7, minHeight: 3 },
  weekLabel:  { fontSize: 11, color: colors.text.muted },
  weekAmt:    { fontSize: 10, color: colors.text.muted, textAlign: 'center' },

  // ── Top products ─────────────────────────────────────────────────────────────
  productRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.03)' },
  productRank:  { fontSize: 11, fontWeight: '700', color: colors.text.muted, width: 24 },
  productInfo:  { flex: 1, gap: 1 },
  productName:  { fontSize: 13, color: colors.text.primary, fontWeight: '500' },
  productDate:  { fontSize: 10, color: colors.text.muted },
  productPrice: { fontSize: 14, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3 },
});
