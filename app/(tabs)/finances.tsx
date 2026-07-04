import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, SectionList,
  ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { getBalanceOffset, getCashOffset } from '@/utils/accountBalance';
import { useStatsScope, isMine, inScope, countsForConsumption } from '@/store/statsScope';
import { looksLikeFood } from '@/utils/calories';
import { isSelfTransfer } from '@/utils/statWidgets';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { RefreshCcw, Tag, Car, Package, HandCoins } from 'lucide-react-native';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

import ScreenHeader from '@/components/ui/ScreenHeader';
import AnimatedCardBg from '@/components/ui/AnimatedCardBg';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import PressableScale from '@/components/ui/PressableScale';
import ExpenseItem from '@/components/expenses/ExpenseItem';
import { useExpenses } from '@/hooks/useExpenses';
import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { formatDate } from '@/utils/date';
import { Expense } from '@/types';
import { colors, spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

const F = {
  card:       '#0E0707',        // near-black, slight red undertone
  cardBorder: 'rgba(228,52,52,0.22)',
  accent:     '#E43434',
  accentDim:  'rgba(228,52,52,0.14)',
  muted:      'rgba(228,52,52,0.50)',
};

function isExp(e: Expense) { return !e.type || e.type === 'expense'; }

function pad(n: number) { return String(n).padStart(2, '0'); }
function toStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// Rolling last 7 days (oldest → today). A fixed Mon→Sun week looks empty early
// in the week (on Monday you'd see one bar), so we use a sliding 7-day window.
const DOW_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
function last7Dates(): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(today); d.setDate(today.getDate() - (6 - i)); return toStr(d); });
}
// Current month dates (1..N)
function monthDates(): string[] {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  const n = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${y}-${pad(m + 1)}-${pad(i + 1)}`);
}

// ─── Wave chart ────────────────────────────────────────────────────────────────
const WAVE_W = 320, WAVE_H = 70;

// Points at column centres ((i+0.5)/n) so they line up with the value/label rows.
function buildFinPath(data: number[], max: number) {
  const n = data.length;
  const pts = data.map((v, i) => ({
    x: ((i + 0.5) / n) * WAVE_W,
    y: WAVE_H - 8 - (v / max) * (WAVE_H - 20),
  }));
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const px = pts[i - 1].x, py = pts[i - 1].y, cx = pts[i].x, cy = pts[i].y;
    const mx = (px + cx) / 2;
    line += ` C ${mx.toFixed(1)} ${py.toFixed(1)}, ${mx.toFixed(1)} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  const fill = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${WAVE_H} L ${pts[0].x.toFixed(1)} ${WAVE_H} Z`;
  return { line, fill, pts };
}

// Dual wave: expenses (red, solid) + income (green, dashed), shared scale.
function DualFinWave({ exp, inc }: { exp: number[]; inc: number[] }) {
  if (exp.length < 2) return null;
  const max = Math.max(...exp, ...inc, 1);
  const E = buildFinPath(exp, max);
  const I = buildFinPath(inc, max);
  return (
    <Svg width="100%" height={WAVE_H} viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id="finExp" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#FF5A5A" stopOpacity="0.16" />
          <Stop offset="1" stopColor="#FF5A5A" stopOpacity="0" />
        </SvgLinearGradient>
        <SvgLinearGradient id="finInc" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2AC68F" stopOpacity="0.10" />
          <Stop offset="1" stopColor="#2AC68F" stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Path d={E.fill} fill="url(#finExp)" />
      <Path d={I.fill} fill="url(#finInc)" />
      <Path d={E.line} stroke="#E43434" strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Path d={I.line} stroke="#2AC68F" strokeWidth="1.8" fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 3" />
    </Svg>
  );
}

export default function FinancesScreen() {
  const insets = useSafeAreaInsets();
  // Theme-reactive: shadow module colors/F so the screen + its StyleSheet flip.
  const colors = useColors();
  const F = useMemo(() => ({
    card: colors.bg.card,
    cardBorder: 'rgba(228,52,52,0.24)',
    accent: '#E43434',
    accentDim: 'rgba(228,52,52,0.14)',
    muted: 'rgba(228,52,52,0.55)',
  }), [colors]);
  const st = useMemo(() => makeStyles(colors, F), [colors, F]);

  const { timeOfDay } = useTimeAccent();
  const { grouped, isLoading, reload } = useExpenses();
  const { expenses, setExpenses } = useExpensesStore();
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activePayer, setActivePayer] = useState<string | null>(null);
  const [activePayment, setActivePayment] = useState<'all' | 'cash' | 'card'>('all');
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('week');
  const [chartFoodOnly, setChartFoodOnly] = useState(false);
  const [balanceOffset, setBalanceOffset] = useState(0);
  const [cashOffset, setCashOffset] = useState(0);
  const scope = useStatsScope(s => s.scope);
  const toggleScope = useStatsScope(s => s.toggle);

  // Distinct payers that actually appear in the data (for the filter row).
  const payersInData = useMemo(() => {
    const set = new Set<string>();
    for (const e of expenses) if (e.payer) set.add(e.payer);
    return Array.from(set);
  }, [expenses]);

  useEffect(() => {
    if (expenses.length === 0) expensesService.getAll().then(setExpenses).catch(() => {});
  }, []);
  // Re-read the offset on focus so a value set in Settings shows immediately.
  useFocusEffect(useCallback(() => {
    getBalanceOffset().then(setBalanceOffset).catch(() => {});
    getCashOffset().then(setCashOffset).catch(() => {});
  }, []));

  const availableTags = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const e of expenses) {
      if (!isExp(e)) continue;
      for (const tag of e.tags) if (tag) freq[tag] = (freq[tag] ?? 0) + 1;
      if (e.receiptItems) for (const it of e.receiptItems) for (const t of it.tags) freq[t] = (freq[t] ?? 0) + 1;
    }
    return Object.entries(freq).sort(([, a], [, b]) => b - a).slice(0, 12).map(([tag]) => tag);
  }, [expenses]);

  // Explicit, auditable current-month totals (string-based date match — no
  // timezone drift, no risk of pulling in adjacent months). Expenses and income
  // are kept strictly separate.
  const monthTotals = useMemo(() => {
    const now = new Date();
    const mk = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`; // e.g. "2026-05"
    // Dedupe by id first — guards against any accidental duplicate entries
    // inflating the total (a reported cause of the "sum too large" bug).
    const unique = Array.from(new Map(expenses.map(e => [e.id, e])).values());
    let exp = 0, inc = 0;          // current month
    let allExp = 0, allInc = 0;    // all-time (overall balance)
    let cashExp = 0, cashInc = 0;  // all-time CASH-only (for the cash/card split)
    let food = 0, sweets = 0;      // current month: groceries + #słodycze items
    for (const e of unique) {
      const isIncome = e.type === 'income';
      const isExpense = isExp(e);
      const mine = isMine(e);
      const isCash = e.paymentMethod === 'cash';
      // Money totals & balance: only what I paid / received.
      if (mine) {
        if (isIncome) { allInc += e.amount; if (isCash) cashInc += e.amount; }
        else if (isExpense) { allExp += e.amount; if (isCash) cashExp += e.amount; }
      }
      if ((e.date ?? '').slice(0, 7) !== mk) continue;
      // Self-transfers (savings / Revolut) move money but aren't spend/income — they
      // already counted toward the balance above; just skip them in the month stats.
      const selfT = isSelfTransfer(e);
      if (mine && isIncome) { if (!selfT) inc += e.amount; continue; }
      if (!isExpense) continue;
      if (mine && !selfT) exp += e.amount;
      if (selfT) continue;
      // Consumption (food / sweets): everyone or only me, per the scope toggle.
      if (!inScope(e, scope)) continue;
      if (e.category === 'groceries') food += e.amount;
      // sweets = ONLY the items tagged "słodycze". A receipt is summed by its
      // items (never the whole shop); the top-level tag only counts a plain,
      // non-itemised expense.
      const sItems = e.receiptItems ?? [];
      if (sItems.length > 0) {
        for (const it of sItems) if (countsForConsumption(it) && it.tags.includes('słodycze')) sweets += it.price;
      } else if (e.tags?.includes('słodycze')) {
        sweets += e.amount;
      }
    }
    return { exp, inc, allExp, allInc, cashExp, cashInc, food, sweets };
  }, [expenses, scope]);

  // Card and cash are independent pots; the total is their sum. Each = its offset
  // (money there before tracking) + its own net flow (all-time).
  const cardBalance = balanceOffset + (monthTotals.allInc - monthTotals.cashInc) - (monthTotals.allExp - monthTotals.cashExp);
  const cashBalance = cashOffset + monthTotals.cashInc - monthTotals.cashExp;
  const balance = cardBalance + cashBalance;

  // Chart data: expenses AND income per day (week) or per week-of-month (month).
  // Expenses respect the scope toggle; income is always mine (my paychecks).
  // Spend that counts as food for an expense — receipt food items, else the whole
  // amount if it's a grocery/food expense. Powers the "tylko jedzenie" chart toggle.
  const foodSpend = (e: Expense): number => {
    if (e.receiptItems?.length) {
      return e.receiptItems.reduce((s, it) =>
        s + (looksLikeFood({ name: it.name, tags: it.tags, category: it.category }) ? (it.price ?? 0) : 0), 0);
    }
    return (e.category === 'groceries' || (e.category as string) === 'food') ? e.amount : 0;
  };

  const chartData = useMemo(() => {
    const expByDate: Record<string, number> = {};
    const incByDate: Record<string, number> = {};
    for (const e of expenses) {
      const k = e.date.slice(0, 10);
      if (e.type === 'income') {
        if (isMine(e)) incByDate[k] = (incByDate[k] ?? 0) + e.amount;
      } else if (isExp(e) && inScope(e, scope)) {
        expByDate[k] = (expByDate[k] ?? 0) + (chartFoodOnly ? foodSpend(e) : e.amount);
      }
    }
    if (chartPeriod === 'week') {
      const dates = last7Dates();
      return {
        values:    dates.map(d => expByDate[d] ?? 0),
        incValues: dates.map(d => incByDate[d] ?? 0),
        labels:    dates.map(d => DOW_SHORT[new Date(d + 'T00:00:00').getDay()]),
        total:    dates.reduce((s, d) => s + (expByDate[d] ?? 0), 0),
        incTotal: dates.reduce((s, d) => s + (incByDate[d] ?? 0), 0),
      };
    } else {
      const dates = monthDates();
      const exp: number[] = [0, 0, 0, 0, 0];
      const inc: number[] = [0, 0, 0, 0, 0];
      for (const d of dates) {
        const day = parseInt(d.slice(8, 10), 10);
        const wi = Math.min(4, Math.floor((day - 1) / 7));
        exp[wi] += expByDate[d] ?? 0;
        inc[wi] += incByDate[d] ?? 0;
      }
      return {
        values: exp, incValues: inc,
        labels: ['T1', 'T2', 'T3', 'T4', 'T5'],
        total: exp.reduce((s, v) => s + v, 0),
        incTotal: inc.reduce((s, v) => s + v, 0),
      };
    }
  }, [expenses, chartPeriod, scope, chartFoodOnly]);

  const sections = useMemo(() => {
    const matches = (e: Expense) => {
      if (activePayer && e.payer !== activePayer) return false;
      if (activePayment !== 'all' && (e.paymentMethod ?? 'card') !== activePayment) return false;
      if (activeTagFilter) {
        if (e.tags.includes(activeTagFilter)) return true;
        if (e.receiptItems?.some(it => it.tags.includes(activeTagFilter))) return true;
        return false;
      }
      return true;
    };
    const filtered = (activeTagFilter || activePayer || activePayment !== 'all')
      ? grouped.map(([date, items]) => [date, items.filter(matches)] as [string, typeof items])
          .filter(([, items]) => items.length > 0)
      : grouped;
    return filtered.map(([date, items]) => ({
      title: formatDate(date + 'T12:00:00'),
      data: items,
      total: items.reduce((s, e) => s + (isExp(e) ? e.amount : 0), 0),
    }));
  }, [grouped, activeTagFilter, activePayer, activePayment]);

  return (
    <SafeAreaView style={st.root} edges={[]}>
      <View style={{ flex: 1 }}>
        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={colors.text.muted} progressViewOffset={insets.top + 50} />
          }
          ListHeaderComponent={
            <>
              <ScreenHeader
                title="Finanse"
                subtitle={new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
                accentColor={colors.tabs.finances}
                style={{ borderBottomColor: F.cardBorder }}
                rightSlot={
                  <View style={{ flexDirection: 'row', gap: spacing[2] }}>
                    <PressableScale onPress={() => { haptic.tap(); router.push('/products' as any); }} style={st.hBtn}>
                      <Package size={17} color={colors.text.secondary} />
                    </PressableScale>
                    <PressableScale onPress={() => { haptic.tap(); router.push('/debts' as any); }} style={st.hBtn}>
                      <HandCoins size={17} color={colors.text.secondary} />
                    </PressableScale>
                    <PressableScale onPress={() => { haptic.tap(); router.push('/vehicles' as any); }} style={st.hBtn}>
                      <Car size={17} color={colors.text.secondary} />
                    </PressableScale>
                    <PressableScale onPress={() => { haptic.tap(); router.push('/expenses/subscriptions' as any); }} style={st.hBtn}>
                      <RefreshCcw size={17} color={colors.text.secondary} />
                    </PressableScale>
                  </View>
                }
              />
              {/* ── Balance: card is the headline; cash + total are smaller pills ─── */}
              <View style={st.heroMin}>
                <Text style={st.heroDate}>NA KARCIE</Text>
                <View style={st.heroAmountRow}>
                  <Text style={[st.heroAmount, { color: cardBalance >= 0 ? colors.text.primary : colors.accent.red }]}>
                    {cardBalance < 0 ? '−' : ''}{Math.abs(cardBalance).toFixed(2)}
                  </Text>
                  <Text style={st.heroCurrency}> PLN</Text>
                </View>
                <PressableScale onPress={() => { haptic.tap(); router.push('/settings' as any); }}>
                  <View style={st.heroPills}>
                    <View style={st.heroPill}>
                      <Text style={st.heroPillLabel}>Gotówka</Text>
                      <Text style={[st.heroPillVal, cashBalance < 0 && { color: colors.accent.red }]}>{cashBalance.toFixed(2)} zł</Text>
                    </View>
                    <View style={st.heroPill}>
                      <Text style={st.heroPillLabel}>Razem G+K</Text>
                      <Text style={[st.heroPillVal, balance < 0 && { color: colors.accent.red }]}>{balance.toFixed(2)} zł</Text>
                    </View>
                  </View>
                </PressableScale>
                <Text style={st.heroSub}>
                  W tym miesiącu: wydatki <Text style={st.heroSubStrong}>{monthTotals.exp.toFixed(0)}</Text> zł
                  {'   ·   '}
                  Przychody <Text style={st.heroSubStrong}>{monthTotals.inc.toFixed(0)}</Text> zł
                </Text>
                <Text style={st.heroSub2}>
                  Jedzenie <Text style={st.heroSubStrong}>{monthTotals.food.toFixed(0)}</Text> zł
                  {'   ·   '}
                  Słodycze <Text style={st.heroSubStrong}>{monthTotals.sweets.toFixed(0)}</Text> zł
                  {'  '}<Text style={st.heroScopeTag}>({scope === 'all' ? 'wszyscy' : 'ja'})</Text>
                </Text>
              </View>

              {/* ── Stats scope toggle: everyone vs only me ─── */}
              <View style={st.scopeRow}>
                <Text style={st.scopeLabel}>Statystyki:</Text>
                <View style={st.scopeToggle}>
                  <TouchableOpacity
                    style={[st.scopeBtn, scope === 'all' && st.scopeBtnOn]}
                    onPress={() => { haptic.tap(); if (scope !== 'all') toggleScope(); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.scopeBtnText, scope === 'all' && st.scopeBtnTextOn]}>Wszyscy</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[st.scopeBtn, scope === 'mine' && st.scopeBtnOn]}
                    onPress={() => { haptic.tap(); if (scope !== 'mine') toggleScope(); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[st.scopeBtnText, scope === 'mine' && st.scopeBtnTextOn]}>Tylko ja</Text>
                  </TouchableOpacity>
                </View>
              </View>

              {/* ── Spending wave chart + period toggle ─── */}
              <View style={st.chartCard}>
                <View style={st.chartHeader}>
                  <TouchableOpacity onPress={() => { haptic.tap(); setChartFoodOnly(v => !v); }} activeOpacity={0.7}>
                    <Text style={st.chartTitle}>{chartFoodOnly ? 'JEDZENIE' : 'WYDATKI'} — {chartPeriod === 'week' ? '7 DNI' : 'MIESIĄC'}  ⇄</Text>
                  </TouchableOpacity>
                  <View style={st.toggle}>
                    <TouchableOpacity
                      style={[st.toggleBtn, chartPeriod === 'week' && st.toggleBtnOn]}
                      onPress={() => { haptic.tap(); setChartPeriod('week'); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[st.toggleText, chartPeriod === 'week' && st.toggleTextOn]}>7 dni</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[st.toggleBtn, chartPeriod === 'month' && st.toggleBtnOn]}
                      onPress={() => { haptic.tap(); setChartPeriod('month'); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[st.toggleText, chartPeriod === 'month' && st.toggleTextOn]}>Mies.</Text>
                    </TouchableOpacity>
                  </View>
                </View>
                <View style={st.chartTotalsRow}>
                  <Text style={st.chartTotal}>
                    {chartData.total.toFixed(0)} <Text style={st.chartTotalUnit}>zł</Text>
                  </Text>
                  <View style={st.chartLegend}>
                    <View style={st.legendItem}>
                      <View style={[st.legendDot, { backgroundColor: '#E43434' }]} />
                      <Text style={st.legendText}>wydatki</Text>
                    </View>
                    <View style={st.legendItem}>
                      <View style={[st.legendDash, { backgroundColor: '#2AC68F' }]} />
                      <Text style={st.legendText}>przychody {chartData.incTotal.toFixed(0)} zł</Text>
                    </View>
                  </View>
                </View>
                {/* Expense values above the chart (red), income values below (green) */}
                <View style={st.chartValues}>
                  {chartData.values.map((v, i) => (
                    <Text key={i} style={[st.chartValue, { color: '#E97171' }]}>{v > 0 ? Math.round(v) : ''}</Text>
                  ))}
                </View>
                <DualFinWave exp={chartData.values} inc={chartData.incValues} />
                <View style={st.chartValues}>
                  {chartData.incValues.map((v, i) => (
                    <Text key={i} style={[st.chartValue, { color: '#2AC68F' }]}>{v > 0 ? Math.round(v) : ''}</Text>
                  ))}
                </View>
                <View style={st.chartLabels}>
                  {chartData.labels.map((l, i) => (
                    <Text key={i} style={st.chartLabel}>{l}</Text>
                  ))}
                </View>
              </View>

              {/* ── Payer filter chips (who paid) ─── */}
              {payersInData.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={st.tagRow}
                  style={{ marginBottom: 8 }}
                >
                  <TouchableOpacity
                    onPress={() => { haptic.tap(); setActivePayer(null); }}
                    style={[st.tagChip, !activePayer && st.tagChipOn]}
                    activeOpacity={0.7}
                  >
                    <Text style={[st.tagText, !activePayer && st.tagTextOn]}>Wszyscy</Text>
                  </TouchableOpacity>
                  {payersInData.map(p => (
                    <TouchableOpacity
                      key={p}
                      onPress={() => { haptic.tap(); setActivePayer(activePayer === p ? null : p); }}
                      style={[st.tagChip, activePayer === p && st.tagChipOn]}
                      activeOpacity={0.7}
                    >
                      <Text style={[st.tagText, activePayer === p && st.tagTextOn]}>{p}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
              {/* ── Payment-method filter (karta / gotówka) ─── */}
              {expenses.some(e => e.paymentMethod === 'cash') && (
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={st.tagRow} style={{ marginBottom: 8 }}>
                  {([['all', 'Wszystko'], ['card', 'Karta'], ['cash', 'Gotówka']] as const).map(([val, lbl]) => (
                    <TouchableOpacity
                      key={val}
                      onPress={() => { haptic.tap(); setActivePayment(val); }}
                      style={[st.tagChip, activePayment === val && st.tagChipOn]}
                      activeOpacity={0.7}
                    >
                      <Text style={[st.tagText, activePayment === val && st.tagTextOn]}>{lbl}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}

              {/* ── Tag filter chips ─── */}
              {availableTags.length > 0 && (
                <ScrollView
                  horizontal
                  showsHorizontalScrollIndicator={false}
                  contentContainerStyle={st.tagRow}
                  style={{ marginBottom: 8 }}
                >
                  <TouchableOpacity
                    onPress={() => { haptic.tap(); setActiveTagFilter(null); }}
                    style={[st.tagChip, !activeTagFilter && st.tagChipOn]}
                    activeOpacity={0.7}
                  >
                    <Tag size={10} color={!activeTagFilter ? F.accent : colors.text.muted} />
                    <Text style={[st.tagText, !activeTagFilter && st.tagTextOn]}>Wszystkie</Text>
                  </TouchableOpacity>
                  {availableTags.map(tag => (
                    <TouchableOpacity
                      key={tag}
                      onPress={() => { haptic.tap(); setActiveTagFilter(activeTagFilter === tag ? null : tag); }}
                      style={[st.tagChip, activeTagFilter === tag && st.tagChipOn]}
                      activeOpacity={0.7}
                    >
                      <Text style={[st.tagText, activeTagFilter === tag && st.tagTextOn]}>{tag}</Text>
                    </TouchableOpacity>
                  ))}
                </ScrollView>
              )}
            </>
          }
          renderSectionHeader={({ section }) => (
            <View style={st.sectionHeader}>
              <Text style={st.sectionTitle}>{(section as any).title}</Text>
              <View style={st.sectionLine} />
              <Text style={st.sectionTotal}>{((section as any).total as number).toFixed(0)} PLN</Text>
            </View>
          )}
          renderItem={({ item, index }) => (
            <View style={st.itemPad}>
              <ExpenseItem
                expense={item}
                index={index}
                onPress={e => { haptic.tap(); router.push(`/expenses/${e.id}` as any); }}
              />
            </View>
          )}
          ListEmptyComponent={
            !isLoading ? (
              <View style={st.empty}>
                <Text style={st.emptyTitle}>Brak transakcji</Text>
                <Text style={st.emptySub}>Dodaj pierwszą transakcję przyciskiem +</Text>
              </View>
            ) : null
          }
          contentContainerStyle={{ paddingTop: insets.top + 50, paddingBottom: 200 }}
          stickySectionHeadersEnabled={false}
        />

      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: any, f: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg.primary },

  hBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: f.card, borderWidth: 1, borderColor: f.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Hero card ─────────────────────────────────────────────────────────────────
  heroBorder: {
    marginHorizontal: spacing[4], marginTop: spacing[2], marginBottom: spacing[3],
    borderRadius: radius.xl,
    padding: 1.5,
  },
  heroInner: {
    borderRadius: radius.xl,
    overflow: 'hidden',
    minHeight: 130,
    // No solid fill — the base sky gradient + clouds + BlurView provide the
    // glassmorphism, mirroring the dashboard hero exactly.
  },
  heroGlassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: c.border.glass,
  },
  heroContent: {
    padding: spacing[5],
    gap: spacing[2],
  },
  heroMin: {
    marginHorizontal: spacing[4], marginTop: spacing[2], marginBottom: spacing[3],
    gap: spacing[2],
  },
  heroPills: { flexDirection: 'row', gap: spacing[2], marginTop: 4, marginBottom: 2 },
  heroPill: {
    flexDirection: 'row', alignItems: 'baseline', gap: 6,
    backgroundColor: c.fill.subtle, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderWidth: 1, borderColor: c.border.subtle,
  },
  heroPillLabel: { fontSize: 11, color: c.text.muted, fontWeight: '600' },
  heroPillVal: { fontSize: 12.5, color: c.text.primary, fontWeight: '800' },
  heroDate:      { fontSize: 10, fontWeight: '700', color: c.text.muted, letterSpacing: 1.5 },
  heroAmountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroAmount:    { fontSize: 42, fontWeight: '800', color: c.text.primary, letterSpacing: -2, lineHeight: 46 },
  heroCurrency:  { fontSize: 20, fontWeight: '600', color: c.text.muted, paddingBottom: 4 },
  heroSplit:     { fontSize: 12, color: c.text.secondary, fontWeight: '500', marginTop: 3, marginBottom: 2 },
  heroSub:       { fontSize: 12, color: c.text.secondary, fontWeight: '500' },
  heroSub2:      { fontSize: 12, color: c.text.muted, fontWeight: '500', marginTop: 2 },
  heroSubStrong: { color: c.text.primary, fontWeight: '800' },
  heroScopeTag:  { color: c.text.muted, fontWeight: '600', fontStyle: 'italic' },

  // ── Stats scope toggle ──────────────────────────────────────────────────────
  scopeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[3],
  },
  scopeLabel: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  scopeToggle: {
    flexDirection: 'row', gap: 2, marginLeft: 'auto',
    backgroundColor: c.fill.medium, borderRadius: radius.full, padding: 2,
  },
  scopeBtn: { paddingHorizontal: spacing[3], paddingVertical: 5, borderRadius: radius.full },
  scopeBtnOn: { backgroundColor: c.accent.blue + '30' },
  scopeBtnText: { fontSize: 11, fontWeight: '700', color: c.text.muted },
  scopeBtnTextOn: { color: c.accent.blue },

  // ── Chart card ──────────────────────────────────────────────────────────────
  chartCard: {
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    backgroundColor: f.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: f.cardBorder,
    padding: spacing[4], gap: spacing[2],
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: { fontSize: 11, fontWeight: '800', color: f.accent, letterSpacing: 1 },
  toggle: {
    flexDirection: 'row', gap: 2, backgroundColor: c.border.subtle,
    borderRadius: radius.full, padding: 2,
  },
  toggleBtn: { paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.full },
  toggleBtnOn: { backgroundColor: f.accent + '25' },
  toggleText: { fontSize: 10, fontWeight: '700', color: c.text.muted },
  toggleTextOn: { color: f.accent },
  chartTotalsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartTotal: { fontSize: 26, fontWeight: '800', color: c.text.primary, letterSpacing: -1 },
  chartTotalUnit: { fontSize: 14, fontWeight: '600', color: c.text.muted },
  chartLegend: { gap: 3, alignItems: 'flex-end', paddingBottom: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendDash: { width: 10, height: 2, borderRadius: 1 },
  legendText: { fontSize: 10, color: c.text.muted, fontWeight: '500' },
  chartValues: { flexDirection: 'row', marginBottom: 2 },
  chartValue: { flex: 1, fontSize: 9, fontWeight: '700', color: c.text.secondary, textAlign: 'center' },
  chartLabels: { flexDirection: 'row' },
  chartLabel: { flex: 1, fontSize: 9, fontWeight: '600', color: c.text.muted, textAlign: 'center' },

  // ── Tag filters ───────────────────────────────────────────────────────────────
  tagRow: { paddingHorizontal: spacing[4], gap: spacing[2] },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: f.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: f.cardBorder,
  },
  tagChipOn: { backgroundColor: f.accent + '18', borderColor: f.accent + '55' },
  tagText:   { fontSize: 11, fontWeight: '600', color: c.text.muted },
  tagTextOn: { color: f.accent },

  // ── Section header ────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2],
  },
  sectionLine:  { flex: 1, height: 1, backgroundColor: c.border.default },
  sectionTitle: { fontSize: 11, color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' },
  sectionTotal: { fontSize: 11, fontWeight: '700', color: 'rgba(228,52,52,0.55)', letterSpacing: 0.3 },

  itemPad: { paddingHorizontal: spacing[4] },

  // ── Empty state ───────────────────────────────────────────────────────────────
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing[3] },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: c.text.secondary },
  emptySub:   { fontSize: 13, color: c.text.muted },

});
