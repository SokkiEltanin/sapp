import { useMemo, useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, RefreshControl, SectionList,
  ScrollView, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ScanLine, RefreshCcw, Tag, Plus } from 'lucide-react-native';
import { format } from 'date-fns';
import { pl } from 'date-fns/locale';

import ScreenHeader from '@/components/ui/ScreenHeader';
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
  card:       '#5B1818',
  cardBorder: 'rgba(228,52,52,0.18)',
  accent:     '#E43434',
  accentDim:  'rgba(228,52,52,0.14)',
  muted:      'rgba(228,52,52,0.55)',
};

function isExp(e: Expense) { return !e.type || e.type === 'expense'; }

export default function FinancesScreen() {
  const { grouped, stats, isLoading, reload } = useExpenses();
  const { expenses, setExpenses } = useExpensesStore();
  const [activeTagFilter, setActiveTagFilter] = useState<string | null>(null);

  useEffect(() => {
    if (expenses.length === 0) expensesService.getAll().then(setExpenses).catch(() => {});
  }, []);

  const availableTags = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const e of expenses) {
      if (!isExp(e)) continue;
      for (const tag of e.tags) if (tag) freq[tag] = (freq[tag] ?? 0) + 1;
      if (e.receiptItems) for (const it of e.receiptItems) for (const t of it.tags) freq[t] = (freq[t] ?? 0) + 1;
    }
    return Object.entries(freq).sort(([, a], [, b]) => b - a).slice(0, 12).map(([tag]) => tag);
  }, [expenses]);

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
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <PressableScale
                onPress={() => { haptic.tap(); router.push('/expenses/scan' as any); }}
                style={st.hBtn}
              >
                <ScanLine size={17} color={colors.accent.blue} />
              </PressableScale>
              <PressableScale
                onPress={() => { haptic.tap(); router.push('/expenses/subscriptions' as any); }}
                style={st.hBtn}
              >
                <RefreshCcw size={17} color={colors.text.secondary} />
              </PressableScale>
            </View>
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
              {/* ── Hero amount card ─── */}
              <View style={st.hero}>
                <Text style={st.heroDate}>
                  {format(new Date(), 'EEEE, d MMMM', { locale: pl }).toUpperCase()}
                </Text>
                <View style={st.heroAmountRow}>
                  <Text style={st.heroAmount}>{stats.monthExpenses.toFixed(0)}</Text>
                  <Text style={st.heroCurrency}> PLN</Text>
                </View>
                {stats.monthIncome > 0 && (
                  <Text style={st.heroSub}>
                    {stats.monthIncome > stats.monthExpenses
                      ? `Zaoszczędziłeś ${(stats.monthIncome - stats.monthExpenses).toFixed(0)} zł`
                      : `Przekroczono przychody o ${(stats.monthExpenses - stats.monthIncome).toFixed(0)} zł`}
                  </Text>
                )}
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
          contentContainerStyle={{ paddingBottom: 160 }}
          stickySectionHeadersEnabled={false}
        />

        {/* ── Red FAB ─── */}
        <TouchableOpacity
          style={st.fab}
          onPress={() => { haptic.tap(); router.push('/expenses/add' as any); }}
          activeOpacity={0.85}
        >
          <Plus size={22} color={colors.bg.primary} strokeWidth={2.8} />
        </TouchableOpacity>
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
  hero: {
    marginHorizontal: spacing[4], marginTop: spacing[2], marginBottom: spacing[3],
    backgroundColor: F.card,
    borderRadius: radius.xl, padding: spacing[5],
    borderWidth: 1, borderColor: F.cardBorder,
    gap: spacing[2],
  },
  heroDate:      { fontSize: 10, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.5 },
  heroAmountRow: { flexDirection: 'row', alignItems: 'flex-end' },
  heroAmount:    { fontSize: 42, fontWeight: '800', color: colors.white, letterSpacing: -2, lineHeight: 46 },
  heroCurrency:  { fontSize: 20, fontWeight: '600', color: colors.text.muted, paddingBottom: 4 },
  heroSub:       { fontSize: 12, color: F.muted, fontWeight: '500' },

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

  // ── FAB ───────────────────────────────────────────────────────────────────────
  fab: {
    position: 'absolute', bottom: 24, right: 20,
    width: 52, height: 52, borderRadius: 26,
    backgroundColor: F.accent,
    alignItems: 'center', justifyContent: 'center',
    elevation: 12,
    shadowColor: F.accent,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45, shadowRadius: 12,
  },
});
