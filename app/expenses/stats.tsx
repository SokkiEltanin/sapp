import { useMemo, useState, useEffect, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, TrendingDown, TrendingUp, BarChart2, Settings2, ShoppingCart, AlertTriangle, UtensilsCrossed, RefreshCw } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { startOfMonth, endOfMonth, startOfWeek, endOfWeek, subMonths, isWithinInterval, parseISO, format } from 'date-fns';
import { pl } from 'date-fns/locale';

import PressableScale from '@/components/ui/PressableScale';
import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { Expense, ExpenseCategory } from '@/types';
import { getCategoryMeta } from '@/utils/categories';
import { getBudgets, MonthlyBudgets } from '@/utils/budgets';
import { detectFixedCosts } from '@/utils/fixedCosts';
import { colors, spacing, radius, typography } from '@/theme';

const MONTHS_BACK = 6;
const FOOD_TAGS = ['słodycze', 'nabiał', 'mięso', 'warzywa', 'owoce', 'pieczywo', 'napoje'];

function isExpense(e: Expense) { return !e.type || e.type === 'expense'; }
function isIncome(e: Expense)  { return e.type === 'income'; }

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

export default function StatsScreen() {
  const { expenses, setExpenses } = useExpensesStore();
  const today = new Date();
  const [budgets, setBudgets]           = useState<MonthlyBudgets>({});
  const [monthOffset, setMonthOffset]   = useState(0); // 0 = current, 1 = previous, ...
  const [expandedCat, setExpandedCat]   = useState<ExpenseCategory | null>(null);
  const [dailyFilter, setDailyFilter]   = useState<'all' | 'food'>('all');

  useEffect(() => { getBudgets().then(setBudgets); }, []);
  useEffect(() => {
    if (expenses.length === 0) {
      expensesService.getAll().then(setExpenses).catch(() => {});
    }
  }, []);

  // Selected month base
  const monthBase  = subMonths(today, monthOffset);
  const start      = startOfMonth(monthBase);
  const end        = endOfMonth(monthBase);
  const prevStart  = startOfMonth(subMonths(monthBase, 1));
  const prevEnd    = endOfMonth(subMonths(monthBase, 1));
  const isCurrentMonth = monthOffset === 0;

  const prevMonth  = useCallback((e: Expense) => inMonth(e, prevStart, prevEnd), [prevStart, prevEnd]);
  const thisMonth  = useCallback((e: Expense) => inMonth(e, start, end),         [start, end]);

  // ── 6-month trend (always based on today, not selected month)
  const monthlyData = useMemo(() => {
    return Array.from({ length: MONTHS_BACK }, (_, i) => {
      const d  = subMonths(today, MONTHS_BACK - 1 - i);
      const s  = startOfMonth(d); const en = endOfMonth(d);
      const exp = expenses.filter(e => isExpense(e) && inMonth(e, s, en)).reduce((a, e) => a + e.amount, 0);
      const inc = expenses.filter(e => isIncome(e)  && inMonth(e, s, en)).reduce((a, e) => a + e.amount, 0);
      return { label: format(d, 'LLL', { locale: pl }), expenses: exp, income: inc, balance: inc - exp, isSelected: i === MONTHS_BACK - 1 - monthOffset };
    });
  }, [expenses, monthOffset]);
  const maxMonthly = Math.max(...monthlyData.flatMap(m => [m.expenses, m.income]), 1);

  // ── Daily for selected month
  const dailyData = useMemo(() => {
    const daysInMonth = new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 0).getDate();
    return Array.from({ length: daysInMonth }, (_, i) => {
      const date = new Date(monthBase.getFullYear(), monthBase.getMonth(), i + 1);
      const dateStr = format(date, 'yyyy-MM-dd');
      const total = expenses
        .filter(e => isExpense(e) && e.date.startsWith(dateStr) && (dailyFilter === 'all' || e.category === 'groceries'))
        .reduce((s, e) => s + e.amount, 0);
      const isToday = isCurrentMonth && i + 1 === today.getDate();
      return { date: dateStr, total, isToday, day: i + 1 };
    });
  }, [expenses, monthBase, dailyFilter]);
  const maxDaily = Math.max(...dailyData.map(d => d.total), 1);

  // ── Category breakdown for selected month (with vs prev month)
  const catBreakdown = useMemo(() => {
    const byCurr: Record<string, number> = {};
    const byPrev: Record<string, number> = {};
    for (const e of expenses) {
      if (!isExpense(e)) continue;
      if (thisMonth(e)) byCurr[e.category] = (byCurr[e.category] ?? 0) + e.amount;
      if (prevMonth(e)) byPrev[e.category] = (byPrev[e.category] ?? 0) + e.amount;
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
  }, [expenses, thisMonth, prevMonth]);

  // ── Transactions for expanded category
  const catTransactions = useMemo(() => {
    if (!expandedCat) return [];
    return expenses
      .filter(e => isExpense(e) && thisMonth(e) && e.category === expandedCat)
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 20);
  }, [expenses, expandedCat, thisMonth]);

  // ── Flat product list for expanded category (receipt items) sorted by unit price
  const catProducts = useMemo(() => {
    if (!expandedCat) return [];
    const items: { date: string; name: string; price: number; unitPrice: number; qty: number }[] = [];
    for (const e of catTransactions) {
      if (e.receiptItems?.length) {
        for (const it of e.receiptItems) {
          items.push({
            date: e.date.slice(5, 10).replace('-', '.'),
            name: it.name,
            price: it.price,
            unitPrice: it.unitPrice > 0 ? it.unitPrice : it.price,
            qty: it.quantity > 0 ? it.quantity : 1,
          });
        }
      }
    }
    return items.sort((a, b) => b.unitPrice - a.unitPrice);
  }, [catTransactions, expandedCat]);

  // ── Tag breakdown
  const tagBreakdown = useMemo(() => {
    const byTag: Record<string, number> = {};
    for (const e of expenses) {
      if (!isExpense(e) || !thisMonth(e)) continue;
      const items = e.receiptItems;
      if (items?.length) {
        for (const it of items) for (const tag of it.tags) byTag[tag] = (byTag[tag] ?? 0) + it.price;
      } else {
        for (const tag of e.tags) if (tag) byTag[tag] = (byTag[tag] ?? 0) + e.amount;
      }
    }
    const total = Object.values(byTag).reduce((s, v) => s + v, 0);
    return Object.entries(byTag).sort(([, a], [, b]) => b - a).slice(0, 10)
      .map(([tag, amount]) => ({ tag, amount, pct: total > 0 ? amount / total : 0 }));
  }, [expenses, thisMonth]);

  const thisMonthData = monthlyData.find(m => m.isSelected) ?? monthlyData[MONTHS_BACK - 1];
  const thisMonthExp  = thisMonthData.expenses;
  const thisMonthInc  = thisMonthData.income;
  const balance       = thisMonthInc - thisMonthExp;
  const balanceColor  = balance >= 0 ? colors.accent.green : colors.accent.red;

  // ── Spending spike alerts (category > 150% vs previous month)
  const spendingAlerts = useMemo(() =>
    catBreakdown.filter(c => c.prevAmount > 0 && c.amount > c.prevAmount * 1.5),
  [catBreakdown]);

  // ── Budget velocity alerts (on current month, pace exceeds budget before month end)
  const velocityAlerts = useMemo(() => {
    if (!isCurrentMonth) return [];
    const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
    const daysElapsed = today.getDate();
    if (daysElapsed < 5) return [];
    const daysRemaining = daysInMonth - daysElapsed;
    return catBreakdown
      .filter(({ cat, amount }) => {
        const budget = budgets[cat];
        if (!budget || budget <= 0 || amount <= 0 || amount >= budget) return false;
        const dailyRate = amount / daysElapsed;
        const projection = dailyRate * daysInMonth;
        return projection > budget;
      })
      .map(({ cat, amount, meta }) => {
        const budget = budgets[cat]!;
        const dailyRate = amount / daysElapsed;
        const daysLeft = Math.round((budget - amount) / dailyRate);
        const projection = Math.round(dailyRate * daysInMonth);
        return { cat, amount, meta, budget, daysLeft, projection, daysRemaining };
      });
  }, [catBreakdown, budgets, isCurrentMonth, today]);

  // ── Fixed / recurring cost detection (uses all-time data, not just selected month)
  const fixedCosts = useMemo(() => detectFixedCosts(expenses), [expenses]);

  // ── Food (groceries) stats: this month vs prev month + tag subcategories
  const foodStats = useMemo(() => {
    const weekStart = startOfWeek(today, { weekStartsOn: 1 });
    const weekEnd   = endOfWeek(today, { weekStartsOn: 1 });
    const thisGroc  = expenses.filter(e => isExpense(e) && thisMonth(e) && e.category === 'groceries');
    const prevGroc  = expenses.filter(e => isExpense(e) && prevMonth(e) && e.category === 'groceries');
    const weekGroc  = expenses.filter(e => isExpense(e) && e.category === 'groceries' && isWithinInterval(parseISO(e.date), { start: weekStart, end: weekEnd }));

    const thisTotal = thisGroc.reduce((s, e) => s + e.amount, 0);
    const prevTotal = prevGroc.reduce((s, e) => s + e.amount, 0);
    const weekTotal = weekGroc.reduce((s, e) => s + e.amount, 0);

    const daysInMonth = new Date(monthBase.getFullYear(), monthBase.getMonth() + 1, 0).getDate();
    const daysElapsed = isCurrentMonth ? today.getDate() : daysInMonth;
    const dailyRate   = daysElapsed > 0 ? thisTotal / daysElapsed : 0;
    const projection  = isCurrentMonth ? dailyRate * daysInMonth : null;

    const byTag: Record<string, { curr: number; prev: number }> = {};
    for (const tag of FOOD_TAGS) byTag[tag] = { curr: 0, prev: 0 };

    for (const e of thisGroc) {
      for (const it of (e.receiptItems ?? [])) {
        for (const tag of it.tags) { if (byTag[tag]) byTag[tag].curr += it.price; }
      }
    }
    for (const e of prevGroc) {
      for (const it of (e.receiptItems ?? [])) {
        for (const tag of it.tags) { if (byTag[tag]) byTag[tag].prev += it.price; }
      }
    }
    return { thisTotal, prevTotal, weekTotal, dailyRate, projection, daysElapsed, daysInMonth, byTag };
  }, [expenses, thisMonth, prevMonth, today, monthBase, isCurrentMonth]);

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.backBtn}>
          <ChevronLeft size={22} color={colors.text.secondary} />
        </PressableScale>
        <View style={styles.monthPicker}>
          <PressableScale onPress={() => setMonthOffset(o => Math.min(o + 1, MONTHS_BACK - 1))} style={styles.monthArrow}>
            <ChevronLeft size={16} color={monthOffset < MONTHS_BACK - 1 ? colors.text.secondary : colors.text.muted} />
          </PressableScale>
          <View style={styles.monthLabel}>
            <Text style={styles.headerTitle}>{format(monthBase, 'LLLL', { locale: pl })}</Text>
            <Text style={styles.headerSub}>{format(monthBase, 'yyyy')}</Text>
          </View>
          <PressableScale onPress={() => setMonthOffset(o => Math.max(o - 1, 0))} style={styles.monthArrow}>
            <ChevronRight size={16} color={monthOffset > 0 ? colors.text.secondary : colors.text.muted} />
          </PressableScale>
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
              <TrendingUp size={12} color={colors.accent.green} />
              <Text style={[styles.heroStatVal, { color: colors.accent.green }]}>+{thisMonthInc.toFixed(0)} zł</Text>
              <Text style={styles.heroStatLabel}>przychody</Text>
            </View>
            <View style={styles.heroSep} />
            <View style={styles.heroStat}>
              <TrendingDown size={12} color={colors.accent.red} />
              <Text style={[styles.heroStatVal, { color: colors.accent.red }]}>-{thisMonthExp.toFixed(0)} zł</Text>
              <Text style={styles.heroStatLabel}>wydatki</Text>
            </View>
          </View>
        </View>

        {/* Spending spike alerts */}
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
                    <Text style={styles.alertHint}>
                      {cat === 'groceries' || meta.label.toLowerCase().includes('słod') || meta.label.toLowerCase().includes('spoż')
                        ? `Hej, uważaj na ${meta.label.toLowerCase()} — kieszeń też ma granice 🍭`
                        : `Wydałeś ${change?.text} więcej na ${meta.label.toLowerCase()} niż w poprzednim miesiącu.`}
                    </Text>
                  </View>
                  <Text style={[styles.alertPct, { color: colors.accent.amber }]}>{change?.text}</Text>
                </View>
              );
            })}
          </View>
        )}

        {/* Budget velocity alerts */}
        {velocityAlerts.length > 0 && (
          <View style={[styles.card, styles.velocityAlertCard]}>
            <View style={styles.cardRow}>
              <TrendingUp size={13} color={colors.accent.red} />
              <Text style={[styles.cardLabel, { color: colors.accent.red }]}>Uwaga — budżet</Text>
            </View>
            {velocityAlerts.map(({ cat, amount, meta, budget, daysLeft, projection }) => {
              const Icon = (LucideIcons as any)[meta.icon];
              const pct = Math.round(amount / budget * 100);
              return (
                <View key={cat} style={styles.velAlertRow}>
                  <View style={[styles.alertIcon, { backgroundColor: colors.accent.red + '18' }]}>
                    {Icon && <Icon size={12} color={colors.accent.red} />}
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.velAlertTitle}>
                      {meta.label} — {pct}% budżetu ({amount.toFixed(0)}/{budget.toFixed(0)} zł)
                    </Text>
                    <Text style={styles.velAlertSub}>
                      W tym tempie przekroczysz limit za {daysLeft} {daysLeft === 1 ? 'dzień' : 'dni'} · prognoza: {projection} zł
                    </Text>
                  </View>
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
                    height: Math.max(3, (m.income / maxMonthly) * 72),
                    backgroundColor: colors.accent.green,
                    opacity: m.income > 0 ? (m.isSelected ? 1 : 0.5) : 0.15,
                  }]} />
                  <View style={[styles.bar, {
                    height: Math.max(3, (m.expenses / maxMonthly) * 72),
                    backgroundColor: colors.accent.red,
                    opacity: m.expenses > 0 ? (m.isSelected ? 1 : 0.5) : 0.15,
                  }]} />
                </View>
                <Text style={[styles.monthLbl, m.isSelected && styles.monthLblSelected]}>
                  {m.label}
                </Text>
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

        {/* Daily chart for selected month */}
        <View style={styles.card}>
          <View style={styles.cardRow}>
            <TrendingDown size={13} color={colors.text.muted} />
            <Text style={styles.cardLabel}>
              {format(monthBase, 'LLLL', { locale: pl })} — dziennie
            </Text>
            <View style={styles.filterRow}>
              <TouchableOpacity
                style={[styles.filterBtn, dailyFilter === 'all' && styles.filterBtnActive]}
                onPress={() => setDailyFilter('all')}
              >
                <Text style={[styles.filterBtnText, dailyFilter === 'all' && styles.filterBtnTextActive]}>Wszystko</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.filterBtn, dailyFilter === 'food' && styles.filterBtnActive]}
                onPress={() => setDailyFilter('food')}
              >
                <Text style={[styles.filterBtnText, dailyFilter === 'food' && styles.filterBtnTextActive]}>Jedzenie</Text>
              </TouchableOpacity>
            </View>
          </View>
          <View style={styles.dailyChart}>
            {dailyData.map((d, i) => {
              const barH = d.total > 0 ? Math.max(3, (d.total / maxDaily) * 64) : 2;
              const show = (i % 5 === 0) || d.isToday || i === dailyData.length - 1;
              return (
                <View key={i} style={styles.dailyCol}>
                  <View style={styles.dailyBarWrap}>
                    <View style={[styles.dailyBar, {
                      height: barH,
                      backgroundColor: d.isToday
                        ? colors.accent.red
                        : d.total > 0 ? colors.accent.red + '70' : 'rgba(255,255,255,0.05)',
                      width: d.isToday ? 5 : 3,
                    }]} />
                  </View>
                  {show && (
                    <Text style={[styles.dailyLabel, d.isToday && { color: colors.accent.red }]}>
                      {d.isToday ? 'dziś' : String(d.day)}
                    </Text>
                  )}
                </View>
              );
            })}
          </View>
          <View style={styles.dailyLegendRow}>
            <Text style={styles.dailyLegend}>Maks.: {maxDaily.toFixed(0)} zł</Text>
            <Text style={styles.dailyLegend}>
              Śr./dzień: {dailyData.filter(d => d.total > 0).length > 0
                ? (dailyData.reduce((s, d) => s + d.total, 0) / dailyData.filter(d => d.total > 0).length).toFixed(0)
                : '0'} zł
            </Text>
          </View>
        </View>

        {/* Food spending comparison */}
        {(foodStats.thisTotal > 0 || foodStats.prevTotal > 0) && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <ShoppingCart size={13} color={colors.accent.green} />
              <Text style={[styles.cardLabel, { color: colors.accent.green }]}>Jedzenie</Text>
              {foodStats.weekTotal > 0 && (
                <Text style={styles.foodWeekLabel}>ten tyg.: {foodStats.weekTotal.toFixed(0)} zł</Text>
              )}
            </View>

            {/* This month vs last month */}
            <View style={styles.foodMonthRow}>
              <View style={styles.foodMonthStat}>
                <Text style={styles.foodMonthVal}>{foodStats.thisTotal.toFixed(0)} <Text style={styles.foodMonthUnit}>zł</Text></Text>
                <Text style={styles.foodMonthLabel}>ten miesiąc</Text>
              </View>
              {foodStats.prevTotal > 0 && (
                <>
                  <View style={styles.foodSep} />
                  <View style={styles.foodMonthStat}>
                    <Text style={[styles.foodMonthVal, { color: colors.text.secondary }]}>{foodStats.prevTotal.toFixed(0)} <Text style={styles.foodMonthUnit}>zł</Text></Text>
                    <Text style={styles.foodMonthLabel}>poprzedni</Text>
                  </View>
                  {(() => {
                    const diff = foodStats.thisTotal - foodStats.prevTotal;
                    const pct = Math.abs(diff / foodStats.prevTotal * 100).toFixed(0);
                    if (Math.abs(diff) < 5) return null;
                    const good = diff < 0;
                    return (
                      <View style={[styles.foodChangeBadge, { backgroundColor: (good ? colors.accent.green : colors.accent.red) + '1A' }]}>
                        <Text style={[styles.foodChangeBadgeText, { color: good ? colors.accent.green : colors.accent.red }]}>
                          {diff > 0 ? '+' : ''}{pct}%
                        </Text>
                      </View>
                    );
                  })()}
                </>
              )}
            </View>

            {/* Spending velocity */}
            {foodStats.dailyRate > 0 && (
              <View style={styles.velocityRow}>
                <View style={styles.velocityStat}>
                  <Text style={styles.velocityVal}>{foodStats.dailyRate.toFixed(1)} <Text style={styles.velocityUnit}>zł/dzień</Text></Text>
                  <Text style={styles.velocityLabel}>średnio ({foodStats.daysElapsed} dni)</Text>
                </View>
                {foodStats.projection != null && (
                  <>
                    <View style={styles.foodSep} />
                    <View style={styles.velocityStat}>
                      <Text style={[styles.velocityVal, {
                        color: foodStats.projection > (foodStats.prevTotal || foodStats.projection) * 1.1
                          ? colors.accent.amber : colors.text.primary,
                      }]}>
                        {foodStats.projection.toFixed(0)} <Text style={styles.velocityUnit}>zł</Text>
                      </Text>
                      <Text style={styles.velocityLabel}>prognoza miesiąca</Text>
                    </View>
                  </>
                )}
              </View>
            )}

            {/* Tag subcategory breakdown */}
            {FOOD_TAGS.filter(t => foodStats.byTag[t].curr > 0 || foodStats.byTag[t].prev > 0).map(tag => {
              const { curr, prev } = foodStats.byTag[tag];
              const change = prev > 0 ? pctLabel(curr, prev) : null;
              return (
                <View key={tag} style={styles.foodTagRow}>
                  <Text style={styles.foodTagName}>{tag}</Text>
                  <View style={styles.foodTagBarTrack}>
                    <View style={[styles.foodTagBarFill, {
                      width: foodStats.thisTotal > 0 ? `${Math.min(1, curr / foodStats.thisTotal) * 100}%` : '0%',
                    }]} />
                  </View>
                  <Text style={styles.foodTagAmt}>{curr.toFixed(0)} zł</Text>
                  {change && (
                    <Text style={[styles.foodTagChange, { color: change.color }]}>{change.text}</Text>
                  )}
                  {prev > 0 && curr === 0 && (
                    <Text style={styles.foodTagChange}>vs {prev.toFixed(0)} zł</Text>
                  )}
                </View>
              );
            })}
          </View>
        )}

        {/* Fixed / recurring costs */}
        {fixedCosts.length > 0 && (
          <View style={styles.card}>
            <View style={styles.cardRow}>
              <RefreshCw size={13} color={colors.accent.purple} />
              <Text style={[styles.cardLabel, { color: colors.accent.purple }]}>Stałe koszty</Text>
              <Text style={styles.cardMeta}>
                {fixedCosts.reduce((s, c) => s + c.amount, 0).toFixed(0)} zł/mies.
              </Text>
            </View>
            {fixedCosts.slice(0, 8).map((fc, i) => {
              const confColor = fc.confidence === 'high' ? colors.accent.green : fc.confidence === 'medium' ? colors.accent.amber : colors.text.muted;
              return (
                <View key={i} style={styles.fixedRow}>
                  <View style={[styles.fixedConfDot, { backgroundColor: confColor }]} />
                  <Text style={styles.fixedName} numberOfLines={1}>{fc.name}</Text>
                  <Text style={styles.fixedOcc}>{fc.occurrences}×</Text>
                  <Text style={styles.fixedAmt}>{fc.amount.toFixed(0)} zł</Text>
                </View>
              );
            })}
            <Text style={styles.fixedHint}>
              Wykryto na podstawie historii transakcji.
              Zielony = wysoka pewność, żółty = średnia, szary = niska.
            </Text>
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
              const IconComp = (LucideIcons as any)[meta.icon];
              const budget = budgets[cat];
              const overBudget = budget != null && amount > budget;
              const budgetPct = budget != null ? Math.min(1, amount / budget) : null;
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

                  {/* Expanded: receipt products or transactions */}
                  {isExpanded && (catProducts.length > 0 || catTransactions.length > 0) && (
                    <View style={styles.txList}>
                      {catProducts.length > 0 ? (
                        catProducts.map((p, i) => (
                          <View key={i} style={styles.txRow}>
                            <Text style={styles.txDate}>{p.date}</Text>
                            <Text style={styles.txNote} numberOfLines={1}>{p.name}</Text>
                            <Text style={styles.txAmt}>
                              {p.unitPrice.toFixed(2)} zł{p.qty > 1 ? `/szt · x${p.qty}` : '/szt'}
                            </Text>
                          </View>
                        ))
                      ) : (
                        catTransactions.map((e) => (
                          <View key={e.id} style={styles.txRow}>
                            <Text style={styles.txDate}>{e.date.slice(5, 10).replace('-', '.')}</Text>
                            <Text style={styles.txNote} numberOfLines={1}>{e.note || e.storeName || '—'}</Text>
                            <Text style={styles.txAmt}>{e.amount.toFixed(2)} zł</Text>
                          </View>
                        ))
                      )}
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
            </View>
            {tagBreakdown.map(({ tag, amount, pct }) => (
              <View key={tag} style={styles.tagRow}>
                <Text style={styles.tagName}>{tag}</Text>
                <View style={styles.tagBarTrack}>
                  <View style={[styles.tagBarFill, { width: `${pct * 100}%` }]} />
                </View>
                <Text style={styles.tagAmount}>{amount.toFixed(0)} zł</Text>
              </View>
            ))}
          </View>
        )}

        {expenses.length === 0 && (
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>Brak danych</Text>
            <Text style={styles.emptySub}>Dodaj transakcje żeby zobaczyć statystyki</Text>
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
  monthPicker: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  monthArrow: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  monthLabel: { alignItems: 'center', minWidth: 100 },
  headerTitle: { ...typography.h4, color: colors.text.primary, textAlign: 'center', textTransform: 'capitalize' },
  headerSub:   { ...typography.caption, color: colors.text.muted, textAlign: 'center', marginTop: 1 },
  settingsBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },

  heroCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl, padding: spacing[5],
    gap: spacing[3], borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  heroHeader:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  heroLabel:    { ...typography.caption, color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 1, fontSize: 10, fontWeight: '600' },
  heroBalance:  { fontSize: 42, fontWeight: '800', letterSpacing: -1.5, lineHeight: 46 },
  heroUnit:     { fontSize: 20, fontWeight: '400', color: colors.text.muted },
  heroStatsRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.06)' },
  heroStat:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  heroStatVal:  { ...typography.label, fontWeight: '700' },
  heroStatLabel:{ ...typography.caption, color: colors.text.muted, fontSize: 10 },
  heroSep:      { width: 1, height: 20, backgroundColor: 'rgba(255,255,255,0.08)' },

  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    padding: spacing[4], gap: spacing[3],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  alertCard: { borderColor: colors.accent.amber + '30', backgroundColor: colors.accent.amber + '08' },
  velocityAlertCard: { borderColor: colors.accent.red + '30', backgroundColor: colors.accent.red + '06' },
  velAlertRow:   { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  velAlertTitle: { fontSize: 12, color: colors.text.secondary, fontWeight: '600', lineHeight: 17 },
  velAlertSub:   { fontSize: 11, color: colors.accent.red, lineHeight: 16, marginTop: 2 },
  cardRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardLabel: { ...typography.label, color: colors.text.secondary, flex: 1, fontWeight: '600' },
  cardMeta:  { ...typography.label, fontWeight: '700' },

  alertRow:  { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  alertIcon: { width: 26, height: 26, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2 },
  alertText: { fontSize: 12, color: colors.text.secondary, lineHeight: 18 },
  alertHint: { fontSize: 11, color: colors.accent.amber, lineHeight: 16, marginTop: 2 },
  alertPct:  { fontSize: 12, fontWeight: '700', minWidth: 44, textAlign: 'right' },

  chartArea:  { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[1], height: 96 },
  monthCol:   { flex: 1, alignItems: 'center', gap: 4 },
  barsWrap:   { flex: 1, width: '100%', flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'center', gap: 2 },
  bar:        { width: 8, borderRadius: 4, minHeight: 3 },
  monthLbl:   { ...typography.caption, color: colors.text.muted, fontSize: 9 },
  monthLblSelected: { color: colors.text.primary, fontWeight: '700' },
  monthDot:   { width: 4, height: 4, borderRadius: 2, backgroundColor: colors.accent.blue },
  chartLegend:{ flexDirection: 'row', gap: spacing[3], alignItems: 'center', paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', flexWrap: 'wrap' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  legendDot:  { width: 8, height: 8, borderRadius: 4 },
  legendText: { ...typography.caption, color: colors.text.muted },
  legendHint: { ...typography.caption, color: colors.text.muted, fontSize: 9, flex: 1, textAlign: 'right' },

  dailyChart:    { flexDirection: 'row', alignItems: 'flex-end', gap: 2 },
  dailyCol:      { flex: 1, alignItems: 'center', gap: 2 },
  dailyBarWrap:  { height: 68, justifyContent: 'flex-end', alignItems: 'center' },
  dailyBar:      { borderRadius: 2, minHeight: 2 },
  dailyLabel:    { fontSize: 7, color: colors.text.muted, textAlign: 'center' },
  dailyLegendRow:{ flexDirection: 'row', justifyContent: 'space-between', paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  dailyLegend:   { fontSize: 10, color: colors.text.muted },

  catRow:      { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[3], paddingVertical: spacing[1] },
  catRowExpanded: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, padding: spacing[2] },
  catIcon:     { width: 30, height: 30, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center', marginTop: 2, backgroundColor: 'rgba(255,255,255,0.05)' },
  catInfo:     { flex: 1, gap: 4 },
  catTopRow:   { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  catRight:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  catLabel:    { ...typography.bodySmall, color: colors.text.primary, fontWeight: '500' },
  catAmount:   { ...typography.label, fontWeight: '700', fontSize: 13, color: colors.text.primary },
  changeBadge: { paddingHorizontal: 5, paddingVertical: 2, borderRadius: 5 },
  changeBadgeText: { fontSize: 10, fontWeight: '700' },
  catBarTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full, overflow: 'hidden' },
  catBarFill:  { height: 3, borderRadius: radius.full },
  budgetBarTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.full, overflow: 'hidden', marginTop: 2 },
  budgetBarFill:  { height: 3, borderRadius: radius.full },
  catPct:      { ...typography.caption, color: colors.text.muted, fontSize: 9 },

  txList:      { marginLeft: 46, marginTop: spacing[1], marginBottom: spacing[2], gap: 4 },
  txRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  txDate:      { fontSize: 10, color: colors.text.muted, width: 36 },
  txNote:      { flex: 1, fontSize: 12, color: colors.text.secondary },
  txAmt:       { fontSize: 12, fontWeight: '700', color: colors.text.primary },

  // Daily filter
  filterRow:         { flexDirection: 'row', gap: 4, marginLeft: 'auto' },
  filterBtn:         { paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default },
  filterBtnActive:   { backgroundColor: colors.accent.green + '20', borderColor: colors.accent.green + '60' },
  filterBtnText:     { fontSize: 10, fontWeight: '500', color: colors.text.muted },
  filterBtnTextActive: { color: colors.accent.green, fontWeight: '700' },

  // Food velocity
  velocityRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[1], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', paddingTop: spacing[2] },
  velocityStat:  { alignItems: 'center', gap: 2 },
  velocityVal:   { fontSize: 16, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3 },
  velocityUnit:  { fontSize: 10, fontWeight: '400', color: colors.text.muted },
  velocityLabel: { fontSize: 10, color: colors.text.muted },

  // Food stats
  foodWeekLabel:     { fontSize: 10, color: colors.text.muted },
  foodMonthRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  foodMonthStat:     { alignItems: 'center', gap: 2 },
  foodMonthVal:      { fontSize: 22, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  foodMonthUnit:     { fontSize: 12, fontWeight: '400', color: colors.text.muted },
  foodMonthLabel:    { fontSize: 10, color: colors.text.muted },
  foodSep:           { width: 1, height: 32, backgroundColor: 'rgba(255,255,255,0.07)' },
  foodChangeBadge:   { paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  foodChangeBadgeText:{ fontSize: 13, fontWeight: '800' },
  foodTagRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  foodTagName:       { fontSize: 11, color: colors.text.secondary, width: 68, fontWeight: '500' },
  foodTagBarTrack:   { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full, overflow: 'hidden' },
  foodTagBarFill:    { height: 4, borderRadius: radius.full, backgroundColor: colors.accent.green },
  foodTagAmt:        { fontSize: 11, fontWeight: '700', color: colors.text.primary, width: 46, textAlign: 'right' },
  foodTagChange:     { fontSize: 10, width: 38, textAlign: 'right', color: colors.text.muted },

  // Fixed costs
  fixedRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 4 },
  fixedConfDot: { width: 7, height: 7, borderRadius: 4, flexShrink: 0 },
  fixedName:    { flex: 1, fontSize: 13, color: colors.text.secondary },
  fixedOcc:     { fontSize: 10, color: colors.text.muted, width: 22, textAlign: 'right' },
  fixedAmt:     { fontSize: 13, fontWeight: '700', color: colors.text.primary, width: 52, textAlign: 'right' },
  fixedHint:    { fontSize: 10, color: colors.text.muted, lineHeight: 15, marginTop: spacing[1] },

  tagRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 5 },
  tagName:     { fontSize: 12, color: colors.text.secondary, fontWeight: '600', width: 100 },
  tagBarTrack: { flex: 1, height: 5, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full, overflow: 'hidden' },
  tagBarFill:  { height: 5, borderRadius: radius.full, backgroundColor: colors.accent.blue },
  tagAmount:   { fontSize: 12, fontWeight: '700', color: colors.text.primary, width: 52, textAlign: 'right' },

  empty:     { alignItems: 'center', paddingVertical: spacing[12], gap: spacing[2] },
  emptyTitle:{ ...typography.h3, color: colors.text.secondary },
  emptySub:  { ...typography.body, color: colors.text.muted, textAlign: 'center' },
});
