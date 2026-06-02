import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, SectionList,
  ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getBalanceOffset } from '@/utils/accountBalance';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { RefreshCcw, Tag } from 'lucide-react-native';
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

// Current week dates (Mon→Sun)
function weekDates(): string[] {
  const today = new Date();
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const mon = new Date(today); mon.setDate(today.getDate() - dow);
  return Array.from({ length: 7 }, (_, i) => { const d = new Date(mon); d.setDate(mon.getDate() + i); return toStr(d); });
}
// Current month dates (1..N)
function monthDates(): string[] {
  const d = new Date(), y = d.getFullYear(), m = d.getMonth();
  const n = new Date(y, m + 1, 0).getDate();
  return Array.from({ length: n }, (_, i) => `${y}-${pad(m + 1)}-${pad(i + 1)}`);
}

// ─── Wave chart ────────────────────────────────────────────────────────────────
const WAVE_W = 320, WAVE_H = 70;

function WaveChart({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * WAVE_W,
    y: WAVE_H - 8 - (v / max) * (WAVE_H - 20),
  }));
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const px = pts[i - 1].x, py = pts[i - 1].y, cx = pts[i].x, cy = pts[i].y;
    const mx = (px + cx) / 2;
    line += ` C ${mx.toFixed(1)} ${py.toFixed(1)}, ${mx.toFixed(1)} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  const fill = `${line} L ${WAVE_W} ${WAVE_H} L 0 ${WAVE_H} Z`;
  return (
    <Svg width="100%" height={WAVE_H} viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id="finwave" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.32" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Path d={fill} fill="url(#finwave)" />
      <Path d={line} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => (
        <Path key={i}
          d={`M ${p.x.toFixed(1)} ${p.y.toFixed(1)} m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0`}
          fill={color} opacity={data[i] > 0 ? '1' : '0.2'}
        />
      ))}
    </Svg>
  );
}

export default function FinancesScreen() {
  const { timeOfDay } = useTimeAccent();
  const { grouped, isLoading, reload } = useExpenses();
  const { expenses, setExpenses } = useExpensesStore();
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('week');
  const [balanceOffset, setBalanceOffset] = useState(0);

  useEffect(() => {
    if (expenses.length === 0) expensesService.getAll().then(setExpenses).catch(() => {});
  }, []);
  // Re-read the offset on focus so a value set in Settings shows immediately.
  useFocusEffect(useCallback(() => { getBalanceOffset().then(setBalanceOffset).catch(() => {}); }, []));

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
    let food = 0, sweets = 0;      // current month: groceries + #słodycze items
    for (const e of unique) {
      const isIncome = e.type === 'income';
      const isExpense = isExp(e);
      if (isIncome) allInc += e.amount;
      else if (isExpense) allExp += e.amount;
      if ((e.date ?? '').slice(0, 7) !== mk) continue;
      if (isIncome) { inc += e.amount; continue; }
      if (!isExpense) continue;
      exp += e.amount;
      if (e.category === 'groceries') food += e.amount;
      // sweets = items tagged "słodycze" (top-level tag or per-receipt-item tag)
      if (e.tags?.includes('słodycze')) sweets += e.amount;
      else if (e.receiptItems) {
        for (const it of e.receiptItems) if (it.tags.includes('słodycze')) sweets += it.price;
      }
    }
    return { exp, inc, allExp, allInc, food, sweets };
  }, [expenses]);

  // Overall account balance = ALL income − ALL expenses (not just this month).
  // displayed balance = manual offset (money you had before tracking) + net flow
  const balance = balanceOffset + monthTotals.allInc - monthTotals.allExp;

  // Chart data: spending per day (week) or per week-of-month (month)
  const chartData = useMemo(() => {
    const byDate: Record<string, number> = {};
    for (const e of expenses) {
      if (!isExp(e)) continue;
      const k = e.date.slice(0, 10);
      byDate[k] = (byDate[k] ?? 0) + e.amount;
    }
    if (chartPeriod === 'week') {
      const dates = weekDates();
      return {
        values: dates.map(d => byDate[d] ?? 0),
        labels: ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'],
        total: dates.reduce((s, d) => s + (byDate[d] ?? 0), 0),
      };
    } else {
      // group month into ~5 weekly buckets
      const dates = monthDates();
      const buckets: number[] = [0, 0, 0, 0, 0];
      for (const d of dates) {
        const day = parseInt(d.slice(8, 10), 10);
        const wi = Math.min(4, Math.floor((day - 1) / 7));
        buckets[wi] += byDate[d] ?? 0;
      }
      return {
        values: buckets,
        labels: ['T1', 'T2', 'T3', 'T4', 'T5'],
        total: buckets.reduce((s, v) => s + v, 0),
      };
    }
  }, [expenses, chartPeriod]);

  const sections = useMemo(() => {
    const filtered = activeTagFilter
      ? grouped.map(([date, items]) => [date, items.filter(e => {
          if (e.tags.includes(activeTagFilter)) return true;
          if (e.receiptItems?.some(it => it.tags.includes(activeTagFilter))) return true;
          return false;
        })] as [string, typeof items]).filter(([, items]) => items.length > 0)
      : grouped;
    return filtered.map(([date, items]) => ({
      title: formatDate(date + 'T12:00:00'),
      data: items,
      total: items.reduce((s, e) => s + (isExp(e) ? e.amount : 0), 0),
    }));
  }, [grouped, activeTagFilter]);

  return (
    <SafeAreaView style={st.root} edges={[]}>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Finanse"
          subtitle={new Date().toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' })}
          accentColor={colors.tabs.finances}
          style={{ borderBottomColor: F.cardBorder }}
          rightSlot={
            <PressableScale
              onPress={() => { haptic.tap(); router.push('/expenses/subscriptions' as any); }}
              style={st.hBtn}
            >
              <RefreshCcw size={17} color={colors.text.secondary} />
            </PressableScale>
          }
        />

        <SectionList
          sections={sections}
          keyExtractor={item => item.id}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={colors.text.muted} />
          }
          ListHeaderComponent={
            <>
              {/* ── Hero amount card (dark + red gradient border) ─── */}
              <LinearGradient
                colors={[F.accent + 'AA', F.accent + '25', 'transparent']}
                start={{ x: 0, y: 0.5 }} end={{ x: 1, y: 0.5 }}
                style={st.heroBorder}
              >
                <View style={st.heroInner}>
                  {/* Very subtle warm-dark base — low contrast so the frost reads
                      as glass (stars showing through), NOT a visible red panel. */}
                  <LinearGradient
                    colors={['#1C1517', '#161113', '#121011']}
                    start={{ x: 0.3, y: 0 }} end={{ x: 0.7, y: 1 }}
                    style={StyleSheet.absoluteFill}
                  />
                  <AnimatedCardBg timeOfDay={timeOfDay} />
                  <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill} />
                  {/* soft bottom shade, same as dashboard glass */}
                  <LinearGradient
                    colors={['transparent', 'rgba(0,0,0,0.18)']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                    pointerEvents="none"
                  />
                  <View style={st.heroGlassBorder} pointerEvents="none" />
                  <View style={st.heroContent}>
                    <Text style={st.heroDate}>SALDO KONTA</Text>
                    {/* BILANS OGÓLNY = wszystkie przychody − wszystkie wydatki */}
                    <View style={st.heroAmountRow}>
                      <Text style={[st.heroAmount, { color: balance >= 0 ? '#FFFFFF' : '#FF8A8A' }]}>
                        {balance >= 0 ? '+' : '−'}{Math.abs(balance).toFixed(0)}
                      </Text>
                      <Text style={st.heroCurrency}> PLN</Text>
                    </View>
                    <Text style={st.heroSub}>
                      W tym miesiącu: wydatki <Text style={st.heroSubStrong}>{monthTotals.exp.toFixed(0)}</Text> zł
                      {'   ·   '}
                      Przychody <Text style={st.heroSubStrong}>{monthTotals.inc.toFixed(0)}</Text> zł
                    </Text>
                    <Text style={st.heroSub2}>
                      Jedzenie <Text style={st.heroSubStrong}>{monthTotals.food.toFixed(0)}</Text> zł
                      {'   ·   '}
                      Słodycze <Text style={st.heroSubStrong}>{monthTotals.sweets.toFixed(0)}</Text> zł
                    </Text>
                  </View>
                </View>
              </LinearGradient>

              {/* ── Spending wave chart + period toggle ─── */}
              <View style={st.chartCard}>
                <View style={st.chartHeader}>
                  <Text style={st.chartTitle}>WYDATKI — {chartPeriod === 'week' ? 'TYDZIEŃ' : 'MIESIĄC'}</Text>
                  <View style={st.toggle}>
                    <TouchableOpacity
                      style={[st.toggleBtn, chartPeriod === 'week' && st.toggleBtnOn]}
                      onPress={() => { haptic.tap(); setChartPeriod('week'); }}
                      activeOpacity={0.8}
                    >
                      <Text style={[st.toggleText, chartPeriod === 'week' && st.toggleTextOn]}>Tydz.</Text>
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
                <Text style={st.chartTotal}>{chartData.total.toFixed(0)} <Text style={st.chartTotalUnit}>zł</Text></Text>
                <WaveChart data={chartData.values} color={F.accent} />
                <View style={st.chartLabels}>
                  {chartData.labels.map((l, i) => (
                    <Text key={i} style={st.chartLabel}>{l}</Text>
                  ))}
                </View>
              </View>

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
          contentContainerStyle={{ paddingBottom: 200 }}
          stickySectionHeadersEnabled={false}
        />

      </View>
    </SafeAreaView>
  );
}

const st = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },

  hBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: F.card, borderWidth: 1, borderColor: F.cardBorder,
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
    borderColor: 'rgba(255,255,255,0.10)',
  },
  heroContent: {
    padding: spacing[5],
    gap: spacing[2],
  },
  heroDate:      { fontSize: 10, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.5 },
  heroAmountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroAmount:    { fontSize: 42, fontWeight: '800', color: '#FFFFFF', letterSpacing: -2, lineHeight: 46 },
  heroCurrency:  { fontSize: 20, fontWeight: '600', color: colors.text.muted, paddingBottom: 4 },
  heroSub:       { fontSize: 12, color: 'rgba(255,255,255,0.55)', fontWeight: '500' },
  heroSub2:      { fontSize: 12, color: 'rgba(255,255,255,0.45)', fontWeight: '500', marginTop: 2 },
  heroSubStrong: { color: '#FFFFFF', fontWeight: '800' },

  // ── Chart card ──────────────────────────────────────────────────────────────
  chartCard: {
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    backgroundColor: F.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: F.cardBorder,
    padding: spacing[4], gap: spacing[2],
  },
  chartHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  chartTitle: { fontSize: 11, fontWeight: '800', color: F.accent, letterSpacing: 1 },
  toggle: {
    flexDirection: 'row', gap: 2, backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: radius.full, padding: 2,
  },
  toggleBtn: { paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.full },
  toggleBtnOn: { backgroundColor: F.accent + '25' },
  toggleText: { fontSize: 10, fontWeight: '700', color: colors.text.muted },
  toggleTextOn: { color: F.accent },
  chartTotal: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  chartTotalUnit: { fontSize: 14, fontWeight: '600', color: colors.text.muted },
  chartLabels: { flexDirection: 'row', justifyContent: 'space-between', paddingHorizontal: 2 },
  chartLabel: { fontSize: 9, fontWeight: '600', color: colors.text.muted },

  // ── Tag filters ───────────────────────────────────────────────────────────────
  tagRow: { paddingHorizontal: spacing[4], gap: spacing[2] },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: F.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: F.cardBorder,
  },
  tagChipOn: { backgroundColor: F.accent + '18', borderColor: F.accent + '55' },
  tagText:   { fontSize: 11, fontWeight: '600', color: colors.text.muted },
  tagTextOn: { color: F.accent },

  // ── Section header ────────────────────────────────────────────────────────────
  sectionHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2],
  },
  sectionLine:  { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  sectionTitle: { fontSize: 11, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, fontWeight: '700' },
  sectionTotal: { fontSize: 11, fontWeight: '700', color: F.accent, letterSpacing: 0.3 },

  itemPad: { paddingHorizontal: spacing[4] },

  // ── Empty state ───────────────────────────────────────────────────────────────
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing[3] },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text.secondary },
  emptySub:   { fontSize: 13, color: colors.text.muted },

});
