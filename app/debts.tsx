import { useState, useMemo, useCallback, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, Pressable, KeyboardAvoidingView, Platform, Alert, AppState,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Plus, X, Trash2, HandCoins, CreditCard, Banknote, Check, ArrowDownLeft, ArrowUpRight } from 'lucide-react-native';

import DatePickerField from '@/components/ui/DatePickerField';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import { debtsService } from '@/services/debtsService';
import { expensesService } from '@/services/expensesService';
import { Debt, PaymentMethod } from '@/types';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';
import { todayISO, localISO } from '@/utils/date';

const todayIso = todayISO;
type DebtKind = 'theyOwe' | 'iOwe';
const kindOf = (d: Debt): DebtKind => d.kind ?? 'theyOwe';   // brak = stary rekord = ktoś winny mnie

export default function DebtsScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const [debts, setDebts] = useState<Debt[]>([]);
  const [addOpen, setAddOpen] = useState(false);
  const [kind, setKind] = useState<DebtKind>('theyOwe');
  const [person, setPerson] = useState('');
  const [amount, setAmount] = useState('');
  const [askDate, setAskDate] = useState(todayIso());
  const [note, setNote] = useState('');
  const [settling, setSettling] = useState<Debt | null>(null);

  const reload = useCallback(() => { debtsService.getAll().then(setDebts).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));
  // useFocusEffect łapie tylko nawigację, nie powrót z tła (ekrany zostają zamontowane) —
  // ten sam fix co pet.tsx (2026-08-12/13, patrz memory focus_vs_appstate_refresh.md).
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') reload(); });
    return () => sub.remove();
  }, [reload]);

  const open = useMemo(() => debts.filter(d => !d.settled), [debts]);
  const settled = useMemo(() => debts.filter(d => d.settled), [debts]);
  // dwa kierunki liczone osobno: ile mam ODZYSKAĆ vs ile mam ODDAĆ
  const toGet = useMemo(() => open.filter(d => kindOf(d) === 'theyOwe').reduce((t, d) => t + d.amount, 0), [open]);
  const toGive = useMemo(() => open.filter(d => kindOf(d) === 'iOwe').reduce((t, d) => t + d.amount, 0), [open]);

  const resetForm = () => { setKind('theyOwe'); setPerson(''); setAmount(''); setAskDate(todayIso()); setNote(''); };

  const saveDebt = async () => {
    const amt = parseFloat(amount.replace(',', '.'));
    if (!person.trim()) { Alert.alert('Brak osoby', kind === 'iOwe' ? 'Komu jesteś winny?' : 'Kto Ci jest winny?'); return; }
    if (isNaN(amt) || amt <= 0) { Alert.alert('Błędna kwota', 'Podaj kwotę'); return; }
    haptic.success();
    try {
      await debtsService.add({ person: person.trim(), kind, amount: amt, currency: 'PLN', askDate, note: note.trim() || undefined });
      setAddOpen(false); resetForm(); reload();
      toast.success('Dodano');
    } catch (e: any) { Alert.alert('Błąd', e.message); }
  };

  // Rozliczenie. TYLKO gotówka tworzy wpis (przychód gdy ktoś oddaje mnie, wydatek gdy ja
  // oddaję). Karta/przelew NIE tworzy nic — tę transakcję i tak złapie powiadomienie z banku,
  // więc dodanie tu = podwójne liczenie. Dług zawsze oznaczamy jako rozliczony.
  const settle = async (d: Debt, method: PaymentMethod) => {
    haptic.success();
    try {
      const iOwe = kindOf(d) === 'iOwe';
      if (method === 'cash') {
        await expensesService.add({
          type: iOwe ? 'expense' : 'income', amount: d.amount, currency: 'PLN', category: 'transfer' as any,
          tags: [], note: iOwe ? `Oddałem: ${d.person}` : `Zwrot: ${d.person}`, date: localISO(), paymentMethod: 'cash',
        });
      }
      await debtsService.update(d.id, { settled: true, settledMethod: method, settledDate: todayIso() });
      setSettling(null); reload();
      toast.success(method === 'cash'
        ? (iOwe ? 'Rozliczono — dodano do wydatków' : 'Rozliczono — dodano do przychodów')
        : 'Rozliczono — kartę/przelew złapie bank');
    } catch (e: any) { Alert.alert('Błąd', e.message); }
  };

  const [pendingDelete, setPendingDelete] = useState<Debt | null>(null);
  const confirmDelete = (d: Debt) => { haptic.tap(); setPendingDelete(d); };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></TouchableOpacity>
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Długi</Text>
          <Text style={s.subtitle}>
            {open.length === 0 ? 'Kto komu jest winny'
              : [toGet > 0 ? `${toGet.toFixed(2)} zł do odzyskania` : '', toGive > 0 ? `${toGive.toFixed(2)} zł do oddania` : '']
                  .filter(Boolean).join('  ·  ')}
          </Text>
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
          const iOwe = kindOf(d) === 'iOwe';
          const accent = iOwe ? c.accent.red : '#FBBF24';
          return (
            <View key={d.id} style={[s.row, due && { borderColor: accent + '55' }]}>
              <View style={[s.iconWrap, { backgroundColor: accent + '22' }]}>
                {iOwe ? <ArrowUpRight size={16} color={accent} /> : <ArrowDownLeft size={16} color={accent} />}
              </View>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName}>{d.person}</Text>
                <Text style={s.rowMeta}>{iOwe ? 'jesteś winny' : 'winny Tobie'}{d.note ? ` · ${d.note}` : ''} · od {d.askDate.split('-').reverse().join('.')}{due ? ' · termin' : ''}</Text>
              </View>
              <Text style={[s.rowAmt, { color: accent }]}>{iOwe ? '−' : '+'}{d.amount.toFixed(2)} zł</Text>
              <TouchableOpacity onPress={() => { haptic.tap(); setSettling(d); }} style={[s.settleBtn, { backgroundColor: accent + '22', borderColor: accent + '55' }]}><Text style={[s.settleText, { color: accent }]}>{iOwe ? 'Oddałem' : 'Oddał'}</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => confirmDelete(d)} hitSlop={8} style={{ paddingLeft: 4 }}><Trash2 size={14} color={c.text.muted} /></TouchableOpacity>
            </View>
          );
        })}

        {settled.length > 0 && (
          <>
            <Text style={s.sectionLabel}>ODDANE</Text>
            {settled.map(d => {
              const iOwe = kindOf(d) === 'iOwe';
              return (
                <View key={d.id} style={[s.row, { opacity: 0.6 }]}>
                  <View style={[s.iconWrap, { backgroundColor: c.accent.green + '22' }]}><Check size={16} color={c.accent.green} /></View>
                  <View style={{ flex: 1 }}>
                    <Text style={s.rowName}>{d.person}</Text>
                    <Text style={s.rowMeta}>{iOwe ? 'oddałeś' : 'oddał'} {d.settledMethod === 'cash' ? 'gotówką' : 'kartą'}{d.settledDate ? ` · ${d.settledDate.split('-').reverse().join('.')}` : ''}</Text>
                  </View>
                  <Text style={[s.rowAmt, { color: c.accent.green }]}>{iOwe ? '−' : '+'}{d.amount.toFixed(2)} zł</Text>
                  <TouchableOpacity onPress={() => confirmDelete(d)} hitSlop={8} style={{ paddingLeft: 8 }}><Trash2 size={14} color={c.text.muted} /></TouchableOpacity>
                </View>
              );
            })}
          </>
        )}
      </ScrollView>

      {/* Add debt modal */}
      <Modal visible={addOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setAddOpen(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setAddOpen(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHead}><Text style={s.sheetTitle}>Nowy dług</Text><TouchableOpacity onPress={() => setAddOpen(false)} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity></View>

            {/* kierunek: ktoś winny mnie / ja winny */}
            <View style={s.kindRow}>
              <TouchableOpacity style={[s.kindBtn, kind === 'theyOwe' && { borderColor: '#FBBF24', backgroundColor: '#FBBF2418' }]} onPress={() => { haptic.tap(); setKind('theyOwe'); }} activeOpacity={0.85}>
                <ArrowDownLeft size={15} color={kind === 'theyOwe' ? '#FBBF24' : c.text.muted} />
                <Text style={[s.kindTxt, kind === 'theyOwe' && { color: '#FBBF24' }]}>Winny mnie</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.kindBtn, kind === 'iOwe' && { borderColor: c.accent.red, backgroundColor: c.accent.red + '18' }]} onPress={() => { haptic.tap(); setKind('iOwe'); }} activeOpacity={0.85}>
                <ArrowUpRight size={15} color={kind === 'iOwe' ? c.accent.red : c.text.muted} />
                <Text style={[s.kindTxt, kind === 'iOwe' && { color: c.accent.red }]}>Ja winny</Text>
              </TouchableOpacity>
            </View>

            <TextInput value={person} onChangeText={setPerson} placeholder={kind === 'iOwe' ? 'Komu (np. Olesia)' : 'Kto (np. Kuba)'} placeholderTextColor={c.text.muted} style={s.input} />
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
          {(() => {
            const iOwe = settling ? kindOf(settling) === 'iOwe' : false;
            return (
              <View style={s.sheet}>
                <Text style={s.sheetTitle}>{iOwe ? `Oddałeś ${settling?.person}` : `${settling?.person} oddał`} {settling?.amount.toFixed(2)} zł</Text>
                <Text style={s.sheetHint}>
                  Gotówkę dodam ręcznie {iOwe ? 'do wydatków' : 'do przychodów'}. Kartę/przelew POMINĘ —
                  tę transakcję złapie powiadomienie z banku, żeby nie policzyć podwójnie.
                </Text>
                <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] }}>
                  <TouchableOpacity style={[s.methodBtn, { borderColor: c.accent.green + '66' }]} onPress={() => settling && settle(settling, 'cash')} activeOpacity={0.85}>
                    <Banknote size={18} color={c.accent.green} />
                    <View><Text style={[s.methodText, { color: c.accent.green }]}>Gotówka</Text><Text style={s.methodSub}>dodam wpis</Text></View>
                  </TouchableOpacity>
                  <TouchableOpacity style={[s.methodBtn, { borderColor: c.accent.blue + '66' }]} onPress={() => settling && settle(settling, 'card')} activeOpacity={0.85}>
                    <CreditCard size={18} color={c.accent.blue} />
                    <View><Text style={[s.methodText, { color: c.accent.blue }]}>Karta / przelew</Text><Text style={s.methodSub}>złapie bank</Text></View>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })()}
        </View>
      </Modal>

      <ConfirmDialog
        visible={!!pendingDelete}
        title="Usuń dług"
        message={pendingDelete ? `Usunąć „${pendingDelete.person} · ${pendingDelete.amount} zł"?` : undefined}
        onCancel={() => setPendingDelete(null)}
        onConfirm={() => { if (pendingDelete) debtsService.remove(pendingDelete.id).then(reload).catch(() => {}); setPendingDelete(null); }}
      />
    </SafeAreaView>
  );
}

const makeStyles = themedStyles((c: any) => StyleSheet.create({
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
  methodBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 12, borderRadius: radius.md, borderWidth: 1, backgroundColor: c.bg.elevated },
  methodText: { fontSize: 14, fontWeight: '800' },
  methodSub: { fontSize: 9.5, color: c.text.muted, fontWeight: '600', marginTop: 1 },
  kindRow: { flexDirection: 'row', gap: spacing[2] },
  kindBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  kindTxt: { fontSize: 12.5, fontWeight: '800', color: c.text.muted },
}));
