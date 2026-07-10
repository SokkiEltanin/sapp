import { useMemo, useState, useEffect, useCallback } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, SectionList,
  ScrollView, TouchableOpacity, Modal, TextInput, Pressable,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { BlurView } from 'expo-blur';
import { getBalanceOffset, getCashOffset } from '@/utils/accountBalance';
import { useStatsScope, isMine, inScope, countsForConsumption } from '@/store/statsScope';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { looksLikeFood } from '@/utils/calories';
import { isSelfTransfer } from '@/utils/statWidgets';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { router, useFocusEffect } from 'expo-router';
import { RefreshCcw, Tag, Car, Package, HandCoins, SlidersHorizontal, X } from 'lucide-react-native';
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
  const kb = useKeyboardHeight();
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
  const [activeType, setActiveType] = useState<'all' | 'income' | 'expense'>('all');
  const [amtMin, setAmtMin] = useState('');
  const [amtMax, setAmtMax] = useState('');
  const [filterModal, setFilterModal] = useState(false);
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
      for (const tag of (e.tags ?? [])) if (tag) freq[tag] = (freq[tag] ?? 0) + 1;
      if (e.receiptItems) for (const it of e.receiptItems) for (const t of (it.tags ?? [])) freq[t] = (freq[t] ?? 0) + 1;
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
    let expVar = 0;                // current month: VARIABLE spend only (excludes the
                                   // fixed monthly bills — housing + subscriptions)
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
      if (mine && !selfT) {
        exp += e.amount;
        if (e.category !== 'housing' && e.category !== 'subscriptions') expVar += e.amount;
      }
      if (selfT) continue;
      // Consumption (food / sweets): everyone or only me, per the scope toggle.
      if (!inScope(e, scope)) continue;
      if (e.category === 'groceries') food += e.amount;
      // sweets = ONLY the items tagged "słodycze". A receipt is summed by its
      // items (never the whole shop); the top-level tag only counts a plain,
      // non-itemised expense.
      const sItems = e.receiptItems ?? [];
      if (sItems.length > 0) {
        for (const it of sItems) if (countsForConsumption(it) && (it.tags ?? []).includes('słodycze')) sweets += it.price;
      } else if (e.tags?.includes('słodycze')) {
        sweets += e.amount;
      }
    }
    return { exp, expVar, inc, allExp, allInc, cashExp, cashInc, food, sweets };
  }, [expenses, scope]);

  // Card and cash are independent pots; the total is their sum. Each = its offset
  // (money there before tracking) + its own net flow (all-time).
  const cardBalance = balanceOffset + (monthTotals.allInc - monthTotals.cashInc) - (monthTotals.allExp - monthTotals.cashExp);
  const cashBalance = cashOffset + monthTotals.cashInc - monthTotals.cashExp;
  const balance = cardBalance + cashBalance;


  const min = parseFloat(amtMin.replace(',', '.'));
  const max = parseFloat(amtMax.replace(',', '.'));
  const activeFilterCount =
    (activeType !== 'all' ? 1 : 0) + (activePayer ? 1 : 0) + (activePayment !== 'all' ? 1 : 0) +
    (activeTagFilter ? 1 : 0) + (!isNaN(min) ? 1 : 0) + (!isNaN(max) ? 1 : 0);

  const clearFilters = () => {
    setActiveType('all'); setActivePayer(null); setActivePayment('all');
    setActiveTagFilter(null); setAmtMin(''); setAmtMax('');
  };

  const sections = useMemo(() => {
    const matches = (e: Expense) => {
      if (activeType === 'income' && e.type !== 'income') return false;
      if (activeType === 'expense' && !isExp(e)) return false;
      if (activePayer && e.payer !== activePayer) return false;
      if (activePayment !== 'all' && (e.paymentMethod ?? 'card') !== activePayment) return false;
      if (!isNaN(min) && e.amount < min) return false;
      if (!isNaN(max) && e.amount > max) return false;
      if (activeTagFilter) {
        if ((e.tags ?? []).includes(activeTagFilter)) return true;
        if (e.receiptItems?.some(it => (it.tags ?? []).includes(activeTagFilter))) return true;
        return false;
      }
      return true;
    };
    const filtered = activeFilterCount > 0
      ? grouped.map(([date, items]) => [date, items.filter(matches)] as [string, typeof items])
          .filter(([, items]) => items.length > 0)
      : grouped;
    return filtered.map(([date, items]) => ({
      title: formatDate(date + 'T12:00:00'),
      data: items,
      total: items.reduce((s, e) => s + (isExp(e) ? e.amount : 0), 0),
    }));
  }, [grouped, activeTagFilter, activePayer, activePayment, activeType, min, max, activeFilterCount]);

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

              {/* ── This month: income vs spending at a glance (replaces the wave
                    chart nobody read — NA KARCIE above is the headline). ─── */}
              {(() => {
                const inc = monthTotals.inc;
                const exp = monthTotals.expVar;             // VARIABLE spend only (no fixed bills)
                const fixed = monthTotals.exp - monthTotals.expVar; // housing + subscriptions
                const mx = Math.max(inc, exp, 1);
                const net = inc - exp;
                return (
                  <View style={st.monthCard}>
                    <Text style={st.monthTitle}>TEN MIESIĄC · ZMIENNE</Text>
                    <View style={st.flowRow}>
                      <Text style={st.flowLabel}>Przychody</Text>
                      <View style={st.flowTrack}>
                        <View style={[st.flowFill, { width: `${Math.round((inc / mx) * 100)}%`, backgroundColor: '#2AC68F' }]} />
                      </View>
                      <Text style={st.flowVal}>{inc.toFixed(0)} zł</Text>
                    </View>
                    <View style={st.flowRow}>
                      <Text style={st.flowLabel}>Wydatki</Text>
                      <View style={st.flowTrack}>
                        <View style={[st.flowFill, { width: `${Math.round((exp / mx) * 100)}%`, backgroundColor: '#E43434' }]} />
                      </View>
                      <Text style={st.flowVal}>{exp.toFixed(0)} zł</Text>
                    </View>
                    <View style={st.flowNetRow}>
                      <Text style={st.flowNetLabel}>Zostało (bez stałych)</Text>
                      <Text style={[st.flowNet, { color: net >= 0 ? '#2AC68F' : '#E43434' }]}>
                        {net >= 0 ? '+' : '−'}{Math.abs(net).toFixed(0)} zł
                      </Text>
                    </View>
                    {fixed > 0.5 && (
                      <Text style={st.flowFixedNote}>Wydatki stałe (mieszkanie, subskrypcje) pominięte: {fixed.toFixed(0)} zł</Text>
                    )}
                  </View>
                );
              })()}

              {/* ── Filters button → popup ─── */}
              <View style={st.filterBar}>
                <TouchableOpacity
                  style={[st.filterBtn, activeFilterCount > 0 && st.filterBtnOn]}
                  onPress={() => { haptic.tap(); setFilterModal(true); }}
                  activeOpacity={0.8}
                >
                  <SlidersHorizontal size={15} color={activeFilterCount > 0 ? F.accent : colors.text.secondary} />
                  <Text style={[st.filterBtnText, activeFilterCount > 0 && { color: F.accent }]}>
                    Filtry{activeFilterCount > 0 ? ` · ${activeFilterCount}` : ''}
                  </Text>
                </TouchableOpacity>
                {activeFilterCount > 0 && (
                  <TouchableOpacity onPress={() => { haptic.tap(); clearFilters(); }} style={st.filterClear} activeOpacity={0.8}>
                    <Text style={st.filterClearText}>Wyczyść</Text>
                  </TouchableOpacity>
                )}
              </View>
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

      {/* ── Filters popup ─── */}
      <Modal visible={filterModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFilterModal(false)}>
        <View style={[st.fmOverlay, { paddingBottom: kb }]}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setFilterModal(false)} />
          <View style={st.fmCard}>
            <View style={st.fmHeader}>
              <SlidersHorizontal size={16} color={F.accent} />
              <Text style={st.fmTitle}>Filtry</Text>
              <TouchableOpacity onPress={() => setFilterModal(false)} hitSlop={10} style={{ marginLeft: 'auto' }}>
                <X size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {/* Typ */}
              <Text style={st.fmLabel}>Typ</Text>
              <View style={st.fmRow}>
                {([['all', 'Wszystko'], ['expense', 'Wydatki'], ['income', 'Przychody']] as const).map(([val, lbl]) => (
                  <TouchableOpacity key={val} onPress={() => { haptic.tap(); setActiveType(val); }}
                    style={[st.tagChip, activeType === val && st.tagChipOn]} activeOpacity={0.8}>
                    <Text style={[st.tagText, activeType === val && st.tagTextOn]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>

              {/* Kwota */}
              <Text style={st.fmLabel}>Kwota (zł)</Text>
              <View style={st.fmAmtRow}>
                <TextInput value={amtMin} onChangeText={setAmtMin} keyboardType="decimal-pad" placeholder="od"
                  placeholderTextColor={colors.text.muted} style={st.fmInput} />
                <Text style={st.fmDash}>—</Text>
                <TextInput value={amtMax} onChangeText={setAmtMax} keyboardType="decimal-pad" placeholder="do"
                  placeholderTextColor={colors.text.muted} style={st.fmInput} />
              </View>
              <View style={st.fmRow}>
                {([['', '20', 'do 20'], ['20', '100', '20–100'], ['100', '', '100+']] as const).map(([lo, hi, lbl]) => {
                  const on = amtMin === lo && amtMax === hi;
                  return (
                    <TouchableOpacity key={lbl} onPress={() => { haptic.tap(); setAmtMin(lo); setAmtMax(hi); }}
                      style={[st.tagChip, on && st.tagChipOn]} activeOpacity={0.8}>
                      <Text style={[st.tagText, on && st.tagTextOn]}>{lbl}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              {/* Osoba */}
              {payersInData.length > 0 && (
                <>
                  <Text style={st.fmLabel}>Osoba</Text>
                  <View style={st.fmRow}>
                    <TouchableOpacity onPress={() => { haptic.tap(); setActivePayer(null); }}
                      style={[st.tagChip, !activePayer && st.tagChipOn]} activeOpacity={0.8}>
                      <Text style={[st.tagText, !activePayer && st.tagTextOn]}>Wszyscy</Text>
                    </TouchableOpacity>
                    {payersInData.map(p => (
                      <TouchableOpacity key={p} onPress={() => { haptic.tap(); setActivePayer(activePayer === p ? null : p); }}
                        style={[st.tagChip, activePayer === p && st.tagChipOn]} activeOpacity={0.8}>
                        <Text style={[st.tagText, activePayer === p && st.tagTextOn]}>{p}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Płatność */}
              {expenses.some(e => e.paymentMethod === 'cash') && (
                <>
                  <Text style={st.fmLabel}>Płatność</Text>
                  <View style={st.fmRow}>
                    {([['all', 'Wszystko'], ['card', 'Karta'], ['cash', 'Gotówka']] as const).map(([val, lbl]) => (
                      <TouchableOpacity key={val} onPress={() => { haptic.tap(); setActivePayment(val); }}
                        style={[st.tagChip, activePayment === val && st.tagChipOn]} activeOpacity={0.8}>
                        <Text style={[st.tagText, activePayment === val && st.tagTextOn]}>{lbl}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}

              {/* Tag */}
              {availableTags.length > 0 && (
                <>
                  <Text style={st.fmLabel}>Tag</Text>
                  <View style={st.fmRow}>
                    <TouchableOpacity onPress={() => { haptic.tap(); setActiveTagFilter(null); }}
                      style={[st.tagChip, !activeTagFilter && st.tagChipOn]} activeOpacity={0.8}>
                      <Text style={[st.tagText, !activeTagFilter && st.tagTextOn]}>Wszystkie</Text>
                    </TouchableOpacity>
                    {availableTags.map(tag => (
                      <TouchableOpacity key={tag} onPress={() => { haptic.tap(); setActiveTagFilter(activeTagFilter === tag ? null : tag); }}
                        style={[st.tagChip, activeTagFilter === tag && st.tagChipOn]} activeOpacity={0.8}>
                        <Text style={[st.tagText, activeTagFilter === tag && st.tagTextOn]}>{tag}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </>
              )}
              <View style={{ height: 12 }} />
            </ScrollView>

            <View style={st.fmFooter}>
              <TouchableOpacity onPress={() => { haptic.tap(); clearFilters(); }} style={st.fmClearBtn} activeOpacity={0.85}>
                <Text style={st.fmClearText}>Wyczyść</Text>
              </TouchableOpacity>
              <TouchableOpacity onPress={() => { haptic.tap(); setFilterModal(false); }} style={st.fmApplyBtn} activeOpacity={0.9}>
                <Text style={st.fmApplyText}>Zastosuj{activeFilterCount > 0 ? ` (${activeFilterCount})` : ''}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
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

  // "TEN MIESIĄC" glance card — two proportional bars + net balance.
  monthCard: {
    marginHorizontal: spacing[4], marginBottom: spacing[3],
    backgroundColor: f.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: f.cardBorder,
    padding: spacing[4], gap: spacing[3],
  },
  monthTitle: { fontSize: 11, fontWeight: '800', color: f.accent, letterSpacing: 1 },
  flowRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  flowLabel: { width: 72, fontSize: 12, color: c.text.secondary, fontWeight: '600' },
  flowTrack: {
    flex: 1, height: 12, borderRadius: 6,
    backgroundColor: c.bg.elevated, overflow: 'hidden',
  },
  flowFill: { height: '100%', borderRadius: 6, minWidth: 3 },
  flowVal: { width: 78, textAlign: 'right', fontSize: 13, fontWeight: '700', color: c.text.primary },
  flowNetRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    marginTop: spacing[1], paddingTop: spacing[2],
    borderTopWidth: 1, borderTopColor: c.border.subtle,
  },
  flowNetLabel: { fontSize: 12, color: c.text.muted, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5 },
  flowNet: { fontSize: 18, fontWeight: '800' },
  flowFixedNote: { fontSize: 10.5, color: c.text.muted, marginTop: 2 },
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

  // ── Filters ───────────────────────────────────────────────────────────────────
  filterBar: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], marginBottom: 8 },
  filterBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: f.card, borderRadius: radius.full, borderWidth: 1, borderColor: f.cardBorder,
  },
  filterBtnOn: { backgroundColor: f.accent + '14', borderColor: f.accent + '66' },
  filterBtnText: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },
  filterClear: { paddingHorizontal: spacing[2], paddingVertical: spacing[2] },
  filterClearText: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  fmOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  fmCard: {
    backgroundColor: c.bg.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    padding: spacing[4], paddingBottom: spacing[6], borderWidth: 1, borderColor: c.border.default,
  },
  fmHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  fmTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  fmLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[3], marginBottom: spacing[2] },
  fmRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  fmAmtRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  fmInput: {
    flex: 1, backgroundColor: c.bg.primary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: 10, fontSize: 15, color: c.text.primary,
  },
  fmDash: { fontSize: 15, color: c.text.muted },
  fmFooter: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  fmClearBtn: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default },
  fmClearText: { fontSize: 14, fontWeight: '700', color: c.text.secondary },
  fmApplyBtn: { flex: 1.6, alignItems: 'center', justifyContent: 'center', paddingVertical: 13, borderRadius: radius.lg, backgroundColor: f.accent },
  fmApplyText: { fontSize: 14, fontWeight: '800', color: '#fff' },

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
