import { useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Check, X, Landmark } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useBankQueue, PendingBankTx } from '@/store/bankQueueStore';
import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { findMatchingExpense } from '@/utils/bankNotification';
import { saveMerchant } from '@/utils/merchantMemory';
import { ExpenseCategory } from '@/types';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const CATS: [ExpenseCategory, string][] = [
  ['groceries', 'Spożywcze'], ['transport', 'Transport'], ['entertainment', 'Rozrywka'],
  ['health', 'Zdrowie'], ['clothing', 'Ubrania'], ['housing', 'Mieszkanie'],
  ['subscriptions', 'Subskrypcje'], ['other', 'Inne'],
];

export default function BankReview() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { pending, update, remove } = useBankQueue();
  const { addExpense, updateExpense } = useExpensesStore();

  const accept = async (p: PendingBankTx) => {
    haptic.success();
    const expenses = useExpensesStore.getState().expenses;
    const match = findMatchingExpense(p, expenses);
    if (match) {
      updateExpense(match.id, { bankMatched: true });
      expensesService.update(match.id, { bankMatched: true }).catch(() => {});
      toast.success(`Dopasowano do paragonu: ${match.storeName ?? p.store}`);
    } else {
      try {
        const exp = await expensesService.add({
          type: 'expense', amount: p.amount, currency: 'PLN', category: p.category,
          tags: [], note: p.store || 'Płatność', date: p.dateISO,
          ...(p.store ? { storeName: p.store } : {}),
          paymentMethod: p.method === 'cash' ? 'cash' : 'card', bankMatched: true,
        });
        addExpense(exp);
        toast.success(`Dodano: ${p.amount.toFixed(2)} zł · ${p.store || 'płatność'}`);
      } catch { toast.error('Nie udało się dodać'); return; }
    }
    // Learn: this merchant → this category (+ cleaned name) for next time.
    saveMerchant(p.storeKey, { category: p.category, name: p.store }).catch(() => {});
    remove(p.id);
  };

  const reject = (p: PendingBankTx) => { haptic.tap(); remove(p.id); };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>Płatności z banku</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {pending.length === 0 && (
          <View style={s.empty}>
            <Landmark size={30} color={c.text.muted} />
            <Text style={s.emptyText}>Brak płatności do zatwierdzenia. Gdy zapłacisz kartą, powiadomienie z banku pojawi się tu automatycznie.</Text>
          </View>
        )}
        {pending.map(p => {
          const d = new Date(p.dateISO);
          return (
            <View key={p.id} style={s.card}>
              <View style={s.cardTop}>
                <Text style={s.amount}>{p.amount.toFixed(2)} zł</Text>
                <Text style={s.time}>{d.toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })} · {d.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}</Text>
              </View>
              <Text style={s.fieldLabel}>Sklep</Text>
              <TextInput value={p.store} onChangeText={v => update(p.id, { store: v })} style={s.input} placeholderTextColor={c.text.muted} placeholder="Sklep" />
              <Text style={s.fieldLabel}>Kategoria</Text>
              <View style={s.catRow}>
                {CATS.map(([cat, lbl]) => {
                  const active = p.category === cat;
                  return (
                    <TouchableOpacity key={cat} style={[s.catChip, active && { backgroundColor: '#46B0DE22', borderColor: '#46B0DE' }]}
                      onPress={() => { haptic.tap(); update(p.id, { category: cat }); }} activeOpacity={0.8}>
                      <Text style={[s.catText, active && { color: '#46B0DE' }]}>{lbl}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <View style={s.actions}>
                <TouchableOpacity style={[s.actBtn, s.rejectBtn]} onPress={() => reject(p)} activeOpacity={0.85}>
                  <X size={16} color={c.accent.red} /><Text style={[s.actText, { color: c.accent.red }]}>Odrzuć</Text>
                </TouchableOpacity>
                <TouchableOpacity style={[s.actBtn, s.acceptBtn]} onPress={() => accept(p)} activeOpacity={0.85}>
                  <Check size={16} color="#fff" /><Text style={[s.actText, { color: '#fff' }]}>Zatwierdź</Text>
                </TouchableOpacity>
              </View>
            </View>
          );
        })}
        <View style={{ height: 40 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2] },
  empty: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  emptyText: { fontSize: 13, color: c.text.muted, textAlign: 'center', maxWidth: 280, lineHeight: 19 },
  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[3] },
  cardTop: { flexDirection: 'row', alignItems: 'baseline', justifyContent: 'space-between' },
  amount: { fontSize: 24, fontWeight: '900', color: c.text.primary, letterSpacing: -0.5 },
  time: { fontSize: 12, color: c.text.muted, fontWeight: '600' },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginTop: spacing[3], marginBottom: spacing[1] },
  input: { backgroundColor: c.bg.primary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 11, fontSize: 15, color: c.text.primary },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  catChip: { paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.primary },
  catText: { fontSize: 12.5, fontWeight: '600', color: c.text.secondary },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  actBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 12, borderRadius: radius.lg },
  rejectBtn: { borderWidth: 1, borderColor: c.accent.red + '55', backgroundColor: c.accent.red + '12' },
  acceptBtn: { backgroundColor: '#46B0DE' },
  actText: { fontSize: 14, fontWeight: '800' },
});
