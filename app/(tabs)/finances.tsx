import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, SectionList,
  ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { getBalanceOffset } from '@/utils/accountBalance';
import { useStatsScope, isMine, inScope, countsForConsumption } from '@/store/statsScope';
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
          <Stop offset="0" stopColor="#E43434" stopOpacity="0.28" />
          <Stop offset="1" stopColor="#E43434" stopOpacity="0" />
        </SvgLinearGradient>
        <SvgLinearGradient id="finInc" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor="#2AC68F" stopOpacity="0.20" />
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
  const { timeOfDay } = useTimeAccent();
  const { grouped, isLoading, reload } = useExpenses();
  const { expenses, setExpenses } = useExpensesStore();
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);
  const [activePayer, setActivePayer] = useState<string | null>(null);
  const [chartPeriod, setChartPeriod] = useState<'week' | 'month'>('week');
  const [balanceOffset, setBalanceOffset] = useState(0);
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
      const mine = isMine(e);
      // Money totals & balance: only what I paid / received.
      if (mine) {
        if (isIncome) allInc += e.amount;
        else if (isExpense) allExp += e.amount;
      }
      if ((e.date ?? '').slice(0, 7) !== mk) continue;
      if (mine && isIncome) { inc += e.amount; continue; }
      if (!isExpense) continue;
      if (mine) exp += e.amount;
      // Consumption (food / sweets): everyone or only me, per the scope toggle.
      if (!inScope(e, scope)) continue;
      if (e.category === 'groceries') food += e.amount;
      // sweets = items tagged "słodycze" (top-level tag or per-receipt-item tag)
      if (e.tags?.includes('słodycze')) sweets += e.amount;
      else if (e.receiptItems) {
        for (const it of e.receiptItems) if (countsForConsumption(it) && it.tags.includes('słodycze')) sweets += it.price;
      }
    }
    return { exp, inc, allExp, allInc, food, sweets };
  }, [expenses, scope]);

  // Overall account balance = ALL income − ALL expenses (not just this month).
  // displayed balance = manual offset (money you had before tracking) + net flow
  const balance = balanceOffset + monthTotals.allInc - monthTotals.allExp;

  // Chart data: expenses AND income per day (week) or per week-of-month (month).
  // Expenses respect the scope toggle; income is always mine (my paychecks).
  const chartData = useMemo(() => {
    const expByDate: Record<string, number> = {};
    const incByDate: Record<string, number> = {};
    for (const e of expenses) {
      const k = e.date.slice(0, 10);
      if (e.type === 'income') {
        if (isMine(e)) incByDate[k] = (incByDate[k] ?? 0) + e.amount;
      } else if (isExp(e) && inScope(e, scope)) {
        expByDate[k] = (expByDate[k] ?? 0) + e.amount;
      }
    }
    if (chartPeriod === 'week') {
      const dates = weekDates();
      return {
        values:    dates.map(d => expByDate[d] ?? 0),
        incValues: dates.map(d => incByDate[d] ?? 0),
        labels: ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'],
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
  }, [expenses, chartPeriod, scope]);

  const sections = useMemo(() => {
    const matches = (e: Expense) => {
      if (activePayer && e.payer !== activePayer) return false;
      if (activeTagFilter) {
        if (e.tags.includes(activeTagFilter)) return true;
        if (e.receiptItems?.some(it => it.tags.includes(activeTagFilter))) return true;
        return false;
      }
      return true;
    };
    const filtered = (activeTagFilter || activePayer)
      ? grouped.map(([date, items]) => [date, items.filter(matches)] as [string, typeof items])
          .filter(([, items]) => items.length > 0)
      : grouped;
    return filtered.map(([date, items]) => ({
      title: formatDate(date + 'T12:00:00'),
      data: items,
      total: items.reduce((s, e) => s + (isExp(e) ? e.amount : 0), 0),
    }));
  }, [grouped, activeTagFilter, activePayer]);

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
                  {/* accent wash from the LEFT, like the dashboard hero */}
                  <LinearGradient
                    colors={[F.accent + '2A', 'transparent']}
                    style={StyleSheet.absoluteFill}
                    start={{ x: 0, y: 0.3 }} end={{ x: 0.8, y: 0.6 }}
                    pointerEvents="none"
                  />
                  <View style={st.heroGlassBorder} pointerEvents="none" />
                  {/* sharper clouds drifting over the glass */}
                  <AnimatedCardBg timeOfDay={timeOfDay} layer="front" />
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
                      {'  '}<Text style={st.heroScopeTag}>({scope === 'all' ? 'wszyscy' : 'ja'})</Text>
                    </Text>
                  </View>
                </View>
              </LinearGradient>

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
  heroScopeTag:  { color: 'rgba(255,255,255,0.4)', fontWeight: '600', fontStyle: 'italic' },

  // ── Stats scope toggle ──────────────────────────────────────────────────────
  scopeRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[3],
  },
  scopeLabel: { fontSize: 12, fontWeight: '600', color: colors.text.muted },
  scopeToggle: {
    flexDirection: 'row', gap: 2, marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.full, padding: 2,
  },
  scopeBtn: { paddingHorizontal: spacing[3], paddingVertical: 5, borderRadius: radius.full },
  scopeBtnOn: { backgroundColor: colors.accent.blue + '30' },
  scopeBtnText: { fontSize: 11, fontWeight: '700', color: colors.text.muted },
  scopeBtnTextOn: { color: colors.accent.blue },

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
  chartTotalsRow: { flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between' },
  chartTotal: { fontSize: 26, fontWeight: '800', color: '#FFFFFF', letterSpacing: -1 },
  chartTotalUnit: { fontSize: 14, fontWeight: '600', color: colors.text.muted },
  chartLegend: { gap: 3, alignItems: 'flex-end', paddingBottom: 2 },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  legendDot: { width: 8, height: 8, borderRadius: 4 },
  legendDash: { width: 10, height: 2, borderRadius: 1 },
  legendText: { fontSize: 10, color: colors.text.muted, fontWeight: '500' },
  chartValues: { flexDirection: 'row', marginBottom: 2 },
  chartValue: { flex: 1, fontSize: 9, fontWeight: '700', color: 'rgba(255,255,255,0.55)', textAlign: 'center' },
  chartLabels: { flexDirection: 'row' },
  chartLabel: { flex: 1, fontSize: 9, fontWeight: '600', color: colors.text.muted, textAlign: 'center' },

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
  sectionTotal: { fontSize: 11, fontWeight: '700', color: 'rgba(228,52,52,0.55)', letterSpacing: 0.3 },

  itemPad: { paddingHorizontal: spacing[4] },

  // ── Empty state ───────────────────────────────────────────────────────────────
  empty: { alignItems: 'center', paddingTop: 80, gap: spacing[3] },
  emptyTitle: { fontSize: 17, fontWeight: '800', color: colors.text.secondary },
  emptySub:   { fontSize: 13, color: colors.text.muted },

});
