import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, Pressable, KeyboardAvoidingView, Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Plus, X, Trash2, HandCoins, CreditCard, Banknote, Check } from 'lucide-react-native';

import DatePickerField from '@/components/ui/DatePickerField';
import { debtsService } from '@/services/debtsService';
import { expensesService } from '@/services/expensesService';
import { Debt, PaymentMethod } from '@/types';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';

function todayIso() { return new Date().toISOString().slice(0, 10); }

export default function DebtsScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const [debts, setDebts] = useState<Debt[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [askDate, setAskDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [settling, setSettling] = useState<Debt | null>(null);

  const reload = useCallback(() => { debtsService.getAll().then(setDebts).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  const open = useMemo(() => debts.filter(d => !d.settled), [debts]);
  const settled = useMemo(() => debts.filter(d => d.settled), [debts]);
  const totalOwed = useMemo(() => open.reduce((t, d) => t + d.amount, 0), [open]);

  const resetForm = () => { setPerson(''); setAmount(''); setAskDate(todayIso()); setNote(''); };

  const saveDebt = async () => {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!person.trim()) { Alert.alert('Brak osoby', 'Kto Ci jest winny?'); return; }
    if (isNaN(amt) || amt <= 0) { Alert.alert('Błędna kwota', 'Podaj kwotę'); return; }
    haptic.success();
    try {
      await debtsService.add({ person: person.trim(), amount: amt, currency: 'PLN', askDate, note: note.trim() || undefined });
      setAddOpen(false); resetForm(); reload();
      toast.success('Dodano dług');
    } catch (e: any) { Alert.alert('Błąd', e.message); }
  };

  // Settle: log an income (cash/card) and mark the debt returned.
  const settle = async (d: Debt, method: PaymentMethod) => {
    haptic.success();
    try {
      const today = todayIso();
      await expensesService.add({
        type: 'income', amount: d.amount, currency: 'PLN', category: 'transfer' as any,
        tags: [], note: `Zwrot: ${d.person}`, date: today, paymentMethod: method,
      });
      await debtsService.update(d.id, { settled: true, settledMethod: method, settledDate: today });
      setSettling(null); reload();
      toast.success(`Zwrot dodany do przychodów (${method === 'cash' ? 'gotówka' : 'karta'})`);
    } catch (e: any) { Alert.alert('Błąd', e.message); }
  };

  const confirmDelete = (d: Debt) =>
    Alert.alert('Usuń dług', `Usunąć „${d.person} · ${d.amount} zł"?`, [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => { debtsService.remove(d.id).then(reload).catch(() => {}); } },
    ]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Długi</Text>
          <Text style={s.subtitle}>{open.length > 0 ? `${totalOwed.toFixed(2)} zł do odzyskania` : 'Kto Ci jest winny'}</Text>
        </View>
        <TouchableOpacity onPress={() => { haptic.tap(); resetForm(); setAddOpen(true); }} style={s.addBtn}>
          <Plus size={18} color={c.bg.primary} />
        </TouchableOpacity>
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: 120, gap: spacing[2] }} showsVerticalScrollIndicator={false}>
        {open.length === 0 && settled.length === 0 && (
          <Text style={s.empty}>Brak długów. Dodaj kto i ile Ci jest winny — przypomnę w wybranym dniu.</Text>
        )}
        {open.map(d => {
          const due = d.askDate <= todayIso();
          return (
            <View key={d.id} style={[s.row, due && { borderColor: '#FBBF2455' }]}>
              <View style={[s.iconWrap, { backgroundColor: '#FBBF2422' }]}><HandCoins size={16} color="#FBBF24" /></View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{d.person}</Text>
                <Text style={s.rowMeta}>{d.note ? `${d.note} · ` : ''}pyta od {d.askDate.split('-').reverse().join('.')}{due ? ' · termin' : ''}</Text>
              </View>
              <Text style={s.rowAmt}>{d.amount.toFixed(2)} zł</Text>
              <TouchableOpacity onPress={() => { haptic.tap(); setSettling(d); }} style={s.settleBtn}><Text style={s.settleText}>Oddał</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(d)} hitSlop={8} style={{ paddingLeft: 4 }}><Trash2 size={14} color={c.text.muted} /></TouchableOpacity>
            </View>
          );
        })}

        {settled.length > 0 && (
          <>
            <Text style={s.sectionLabel}>ODDANE</Text>
            {settled.map(d => (
              <View key={d.id} style={[s.row, { opacity: 0.6 }]}>
                <View style={[s.iconWrap, { backgroundColor: c.accent.green + '22' }]}><Check size={16} color={c.accent.green} /></View>
                <View style={{ flex: 1 }}>
                  <Text style={s.rowName}>{d.person}</Text>
                  <Text style={s.rowMeta}>oddał {d.settledMethod === 'cash' ? 'gotówką' : 'kartą'}{d.settledDate ? ` · ${d.settledDate.split('-').reverse().join('.')}` : ''}</Text>
                </View>
                <Text style={[s.rowAmt, { color: c.accent.green }]}>+{d.amount.toFixed(2)} zł</Text>
                <TouchableOpacity onPress={() => confirmDelete(d)} hitSlop={8} style={{ paddingLeft: 8 }}><Trash2 size={14} color={c.text.muted} /></TouchableOpacity>
              </View>
            ))}
          </>
        )}
      </ScrollView>

      {/* Add debt modal */}
      <Modal visible={addOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddOpen(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHead}><Text style={s.sheetTitle}>Nowy dług</Text><TouchableOpacity onPress={() => setAddOpen(false)} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity></View>
            <TextInput value={person} onChangeText={setPerson} placeholder="Kto (np. Kuba)" placeholderTextColor={c.text.muted} style={s.input} />
            <TextInput value={amount} onChangeText={setAmount} keyboardType="decimal-pad" placeholder="Kwota (zł)" placeholderTextColor={c.text.muted} style={s.input} />
            <Text style={s.fieldLabel}>Kiedy przypomnieć / pytać</Text>
            <DatePickerField value={askDate} onChange={setAskDate} placeholder="Data" />
            <TextInput value={note} onChangeText={setNote} placeholder="Notatka (opcjonalnie)" placeholderTextColor={c.text.muted} style={s.input} />
            <TouchableOpacity style={s.saveBtn} onPress={saveDebt} activeOpacity={0.85}><Text style={s.saveBtnText}>Dodaj</Text></TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Settle (cash / card) modal */}
      <Modal visible={!!settling} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSettling(null)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setSettling(null)} />
          <View style={s.sheet}>
            <Text style={s.sheetTitle}>{settling?.person} oddał {settling?.amount.toFixed(2)} zł</Text>
            <Text style={s.sheetHint}>Jak oddał? Dodam jako przychód i rozliczę dług.</Text>
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] }}>
              <TouchableOpacity style={[s.methodBtn, { borderColor: c.accent.green + '66' }]} onPress={() => settling && settle(settling, 'cash')} activeOpacity={0.85}>
                <Banknote size={18} color={c.accent.green} /><Text style={[s.methodText, { color: c.accent.green }]}>Gotówka</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.methodBtn, { borderColor: c.accent.blue + '66' }]} onPress={() => settling && settle(settling, 'card')} activeOpacity={0.85}>
                <CreditCard size={18} color={c.accent.blue} /><Text style={[s.methodText, { color: c.accent.blue }]}>Karta</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[2] },
  backBtn: { width: 36, height: 36, alignItems: 'center', justifyContent: 'center' },
  title: { fontSize: 20, fontWeight: '800', color: c.text.primary },
  subtitle: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  addBtn: { width: 38, height: 38, borderRadius: 19, backgroundColor: c.accent.green, alignItems: 'center', justifyContent: 'center' },
  empty: { fontSize: 13, color: c.text.muted, textAlign: 'center', marginTop: spacing[6], lineHeight: 19 },
  sectionLabel: { fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, marginTop: spacing[3], marginBottom: spacing[1] },
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  iconWrap: { width: 32, height: 32, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  rowName: { fontSize: 14, fontWeight: '600', color: c.text.primary },
  rowMeta: { fontSize: 10.5, color: c.text.muted, marginTop: 2 },
  rowAmt: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  settleBtn: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, backgroundColor: c.accent.green + '22', borderWidth: 1, borderColor: c.accent.green + '55' },
  settleText: { fontSize: 11, fontWeight: '800', color: c.accent.green },

  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing[4] },
  sheet: { backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4], gap: spacing[2], borderWidth: 1, borderColor: c.border.subtle },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  sheetTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  sheetHint: { fontSize: 11.5, color: c.text.muted, lineHeight: 15 },
  fieldLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted, marginTop: spacing[1] },
  input: { backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 11, fontSize: 14, color: c.text.primary },
  saveBtn: { backgroundColor: c.accent.green, paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginTop: spacing[1] },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: c.bg.primary },
  methodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 14, borderRadius: radius.md, borderWidth: 1, backgroundColor: c.bg.elevated },
  methodText: { fontSize: 14, fontWeight: '800' },
});
