import { useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, AlertTriangle } from 'lucide-react-native';
import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { Expense } from '@/types';
import { colors, spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';

function pad(n: number) { return String(n).padStart(2, '0'); }
function isExp(e: Expense) { return !e.type || e.type === 'expense'; }

export default function FinanceAuditScreen() {
  const colors = useColors();
  const s = useMemo(() => makeS(colors), [colors]);
  const { expenses, setExpenses } = useExpensesStore();

  useEffect(() => {
    if (expenses.length === 0) expensesService.getAll().then(setExpenses).catch(() => {});
  }, []);

  const now = new Date();
  const monthKey = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;

  const data = useMemo(() => {
    const thisMonth = expenses
      .filter(e => (e.date ?? '').slice(0, 7) === monthKey)
      .sort((a, b) => (b.date ?? '').localeCompare(a.date ?? ''));

    let expTotal = 0, incTotal = 0;
    const noType: Expense[] = [];
    for (const e of thisMonth) {
      if (e.type === 'income') incTotal += e.amount;
      else if (isExp(e))       expTotal += e.amount;
      if (!e.type) noType.push(e); // counted as expense by backward-compat default
    }

    // Biggest expenses this month (top 5) — quick way to spot a wrong entry
    const biggest = [...thisMonth]
      .filter(isExp)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 5);

    return { thisMonth, expTotal, incTotal, noType, biggest };
  }, [expenses, monthKey]);

  const monthLabel = now.toLocaleDateString('pl-PL', { month: 'long', year: 'numeric' });

  return (
    <SafeAreaView style={s.root} edges={['top']}>
      {/* Header */}
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} style={s.backBtn} activeOpacity={0.7}>
          <ChevronLeft size={20} color={colors.text.secondary} />
        </TouchableOpacity>
        <Text style={s.title}>Audyt finansów</Text>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Summary */}
        <View style={s.summaryCard}>
          <Text style={s.summaryMonth}>{monthLabel.toUpperCase()}</Text>
          <View style={s.summaryRow}>
            <View style={s.summaryCol}>
              <Text style={s.summaryLabel}>WYDATKI</Text>
              <Text style={[s.summaryVal, { color: '#E43434' }]}>{data.expTotal.toFixed(2)}</Text>
            </View>
            <View style={s.summaryDivider} />
            <View style={s.summaryCol}>
              <Text style={s.summaryLabel}>PRZYCHODY</Text>
              <Text style={[s.summaryVal, { color: '#2AC68F' }]}>{data.incTotal.toFixed(2)}</Text>
            </View>
          </View>
          <Text style={s.summaryHint}>
            „Suma wydatków" na ekranie Finanse = {data.expTotal.toFixed(2)} zł
            ({data.thisMonth.filter(isExp).length} wpisów)
          </Text>
        </View>

        {/* Suspicious: entries without a type field */}
        {data.noType.length > 0 && (
          <View style={s.warnCard}>
            <View style={s.warnHeader}>
              <AlertTriangle size={15} color="#FBBF24" />
              <Text style={s.warnTitle}>{data.noType.length} wpisów bez typu</Text>
            </View>
            <Text style={s.warnDesc}>
              Te wpisy nie mają ustawionego pola „typ", więc domyślnie liczą się jako WYDATEK.
              Jeśli któryś to przychód, otwórz go i popraw.
            </Text>
            {data.noType.map(e => (
              <TouchableOpacity
                key={e.id}
                style={s.warnRow}
                onPress={() => router.push(`/expenses/${e.id}` as any)}
                activeOpacity={0.7}
              >
                <Text style={s.warnRowText} numberOfLines={1}>
                  {(e.date ?? '').slice(0, 10)} · {e.category} · {e.note || e.storeName || '—'}
                </Text>
                <Text style={s.warnRowAmt}>{e.amount.toFixed(2)} zł</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Biggest expenses */}
        {data.biggest.length > 0 && (
          <View style={s.sectionCard}>
            <Text style={s.sectionTitle}>NAJWIĘKSZE WYDATKI</Text>
            {data.biggest.map(e => (
              <TouchableOpacity
                key={e.id}
                style={s.txRow}
                onPress={() => router.push(`/expenses/${e.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={{ flex: 1 }}>
                  <Text style={s.txTitle} numberOfLines={1}>{e.note || e.storeName || e.category}</Text>
                  <Text style={s.txMeta}>{(e.date ?? '').slice(0, 10)} · {e.category}</Text>
                </View>
                <Text style={s.txAmt}>{e.amount.toFixed(2)} zł</Text>
              </TouchableOpacity>
            ))}
          </View>
        )}

        {/* Full list this month */}
        <View style={s.sectionCard}>
          <Text style={s.sectionTitle}>WSZYSTKIE TRANSAKCJE — {monthLabel.toUpperCase()}</Text>
          {data.thisMonth.length === 0 ? (
            <Text style={s.empty}>Brak transakcji w tym miesiącu</Text>
          ) : data.thisMonth.map(e => {
            const income = e.type === 'income';
            return (
              <TouchableOpacity
                key={e.id}
                style={s.txRow}
                onPress={() => router.push(`/expenses/${e.id}` as any)}
                activeOpacity={0.7}
              >
                <View style={[s.typeBadge, { backgroundColor: (income ? '#2AC68F' : '#E43434') + '20' }]}>
                  <Text style={[s.typeBadgeText, { color: income ? '#2AC68F' : '#E43434' }]}>
                    {income ? 'PRZ' : 'WYD'}
                  </Text>
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.txTitle} numberOfLines={1}>{e.note || e.storeName || e.category}</Text>
                  <Text style={s.txMeta}>
                    {(e.date ?? '').slice(0, 10)} · {e.category}{!e.type ? ' · (brak typu)' : ''}
                  </Text>
                </View>
                <Text style={[s.txAmt, { color: income ? '#2AC68F' : colors.text.primary }]}>
                  {income ? '+' : '−'}{e.amount.toFixed(2)} zł
                </Text>
              </TouchableOpacity>
            );
          })}
        </View>

        <View style={{ height: 60 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  backBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  title: { fontSize: 18, fontWeight: '800', color: c.text.primary },

  scroll: { padding: spacing[4], gap: spacing[3] },

  summaryCard: {
    backgroundColor: c.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: c.border.card,
    padding: spacing[4], gap: spacing[3],
  },
  summaryMonth: { fontSize: 11, fontWeight: '700', color: c.text.muted, letterSpacing: 1.5 },
  summaryRow: { flexDirection: 'row', alignItems: 'center' },
  summaryCol: { flex: 1, gap: 2 },
  summaryLabel: { fontSize: 10, fontWeight: '700', color: c.text.muted, letterSpacing: 1 },
  summaryVal: { fontSize: 26, fontWeight: '800', letterSpacing: -1 },
  summaryDivider: { width: 1, height: 40, backgroundColor: c.border.subtle },
  summaryHint: { fontSize: 11, color: c.text.secondary, lineHeight: 16 },

  warnCard: {
    backgroundColor: 'rgba(251,191,36,0.08)', borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(251,191,36,0.30)',
    padding: spacing[4], gap: spacing[2],
  },
  warnHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  warnTitle: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },
  warnDesc: { fontSize: 12, color: c.text.secondary, lineHeight: 17, marginBottom: spacing[1] },
  warnRow: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingVertical: spacing[2], gap: spacing[2],
    borderTopWidth: 1, borderTopColor: 'rgba(251,191,36,0.15)',
  },
  warnRowText: { flex: 1, fontSize: 11, color: c.text.secondary },
  warnRowAmt: { fontSize: 12, fontWeight: '700', color: '#FBBF24' },

  sectionCard: {
    backgroundColor: c.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: c.border.card,
    padding: spacing[4], gap: spacing[1],
  },
  sectionTitle: {
    fontSize: 10, fontWeight: '800', color: c.text.muted,
    letterSpacing: 1, marginBottom: spacing[2],
  },
  txRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[2],
    borderTopWidth: 1, borderTopColor: c.border.subtle,
  },
  typeBadge: {
    width: 34, height: 22, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  typeBadgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
  txTitle: { fontSize: 13, fontWeight: '600', color: c.text.primary },
  txMeta: { fontSize: 10, color: c.text.muted, marginTop: 1 },
  txAmt: { fontSize: 13, fontWeight: '700', color: c.text.primary },

  empty: { fontSize: 13, color: c.text.muted, paddingVertical: spacing[3], textAlign: 'center' },
}));
