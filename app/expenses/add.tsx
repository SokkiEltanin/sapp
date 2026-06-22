import { useState, useEffect, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, Alert, InteractionManager, TextInput,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { X, Check, Tag, TrendingDown, TrendingUp, ClipboardList } from 'lucide-react-native';
import { haptic } from '@/utils/haptics';
import * as LucideIcons from 'lucide-react-native';

import InputField from '@/components/ui/InputField';
import AnimatedButton from '@/components/ui/AnimatedButton';
import PressableScale from '@/components/ui/PressableScale';
import Chip from '@/components/ui/Chip';
import DatePickerField from '@/components/ui/DatePickerField';
import { ExpenseCategory, IncomeCategory, TransactionType, PaymentMethod, Vehicle } from '@/types';
import { vehiclesService } from '@/services/vehiclesService';
import { CATEGORY_META, INCOME_CATEGORY_META } from '@/utils/categories';
import { expensesService } from '@/services/expensesService';
import { templatesService } from '@/services/templatesService';
import { useExpensesStore } from '@/store/expensesStore';
import { getBudgets, MonthlyBudgets } from '@/utils/budgets';
import { getPayers, addPayer } from '@/utils/payers';
import { notificationsService } from '@/services/notificationsService';
import { toast } from '@/store/toastStore';
import { getBalanceOffset } from '@/utils/accountBalance';
import { isMine } from '@/store/statsScope';
import { useKeyboardHeight } from '@/hooks/useKeyboardHeight';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

const EXPENSE_CATS = Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][];
const INCOME_CATS = Object.entries(INCOME_CATEGORY_META) as [IncomeCategory, typeof INCOME_CATEGORY_META[IncomeCategory]][];

const EXPENSE_TAGS = ['słodycze', 'warzywa', 'mięso', 'napoje', 'fast food', 'apteka', 'paliwo', 'bilety', 'odzież'];
const INCOME_TAGS = ['premia', 'nadgodziny', 'zwrot', 'gotówka', 'przelew'];

export default function AddExpenseModal() {
  const { type, prefillAmount, prefillCategory, prefillNote } = useLocalSearchParams<{
    type?: TransactionType;
    prefillAmount?: string;
    prefillCategory?: string;
    prefillNote?: string;
  }>();
  const [txType, setTxType] = useState<TransactionType>(type === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState(prefillAmount ?? '');
  const [note, setNote] = useState(prefillNote ?? '');
  const [expCat, setExpCat] = useState<ExpenseCategory>((prefillCategory as ExpenseCategory) ?? 'other');
  const [incCat, setIncCat] = useState<IncomeCategory>((prefillCategory as IncomeCategory) ?? 'salary');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);
  const [budgets, setBudgets] = useState<MonthlyBudgets>({});
  const [payers, setPayers] = useState<string[]>([]);
  const [payer, setPayer] = useState<string>('');
  const [addingPayer, setAddingPayer] = useState(false);
  const [newPayer, setNewPayer] = useState('');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('card');
  const [vehicleId, setVehicleId] = useState<string | undefined>(undefined);
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [dateInput, setDateInput] = useState(() => {
    const d = new Date();
    const pad = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  });
  const addExpense  = useExpensesStore((s) => s.addExpense);
  const expenses    = useExpensesStore((s) => s.expenses);
  const [balanceOffset, setBalanceOffset] = useState(0);
  const kb = useKeyboardHeight();
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const amountRef = useRef<TextInput>(null);

  // Open the keyboard on the amount field, but only AFTER the quick-add menu
  // close + the screen's fade transition have settled. Plain `autoFocus` fires
  // mid-animation and the keyboard often fails to appear on Android — hence the
  // "sometimes it doesn't open". runAfterInteractions + a short delay is the
  // reliable pattern. Skipped when an amount was prefilled (e.g. from a template).
  useEffect(() => {
    if (prefillAmount) return;
    const task = InteractionManager.runAfterInteractions(() => {
      setTimeout(() => amountRef.current?.focus(), 80);
    });
    return () => task.cancel();
  }, []);

  useEffect(() => { getBudgets().then(setBudgets).catch(() => {}); }, []);
  useEffect(() => { vehiclesService.getAll().then(setVehicles).catch(() => {}); }, []);
  useEffect(() => { getPayers().then(list => { setPayers(list); setPayer(p => p || list[0]); }).catch(() => {}); }, []);
  useEffect(() => { getBalanceOffset().then(setBalanceOffset).catch(() => {}); }, []);

  const isIncome = txType === 'income';
  const amountColor = isIncome ? '#2AC68F' : '#E43434';

  // Current account balance (mine only — matches Finances) + projection after this.
  const accountBalance = (() => {
    const unique = Array.from(new Map(expenses.map(e => [e.id, e])).values());
    let net = 0;
    for (const e of unique) { if (!isMine(e)) continue; net += e.type === 'income' ? e.amount : -e.amount; }
    return balanceOffset + net;
  })();
  const amtNum = parseFloat(amount.replace(',', '.'));
  const projectedBalance = !isNaN(amtNum) && amtNum > 0
    ? accountBalance + (isIncome ? amtNum : -amtNum)
    : null;
  const quickTags = isIncome ? INCOME_TAGS : EXPENSE_TAGS;

  const nowM = new Date().toISOString().slice(0, 7);
  const monthSpendByCat = expenses
    .filter(e => (!e.type || e.type === 'expense') && e.date.startsWith(nowM))
    .reduce<Record<string, number>>((acc, e) => { acc[e.category] = (acc[e.category] ?? 0) + e.amount; return acc; }, {});

  const toggleTag = (tag: string) =>
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag('');
  };

  const handleTypeSwitch = (type: TransactionType) => {
    haptic.tap();
    setTxType(type);
    setTags([]);
  };

  // Save the current form as a reusable template (one-click add later).
  const saveAsTemplate = async () => {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!parsed || isNaN(parsed) || parsed <= 0) { Alert.alert('Błąd', 'Wpisz kwotę, zanim zapiszesz szablon'); return; }
    const cat = isIncome ? incCat : expCat;
    const catMeta: any = isIncome ? INCOME_CATEGORY_META : CATEGORY_META;
    const name = (note.trim() || catMeta[cat]?.label || cat) as string;
    try {
      haptic.success();
      await templatesService.add({ name, type: txType, amount: parsed, currency: 'PLN', category: cat, tags, note });
      toast.success(`Szablon „${name}" zapisany`);
    } catch {
      haptic.error();
      toast.error('Nie zapisano szablonu');
    }
  };

  const handleSave = async () => {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!parsed || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Błąd', 'Wpisz poprawną kwotę');
      return;
    }
    setSaving(true);
    try {
      let dateParsed = new Date().toISOString();
      if (dateInput) {
        const parts = dateInput.split('-').map(Number);
        if (parts.length === 3) {
          const dt = new Date(parts[0], parts[1] - 1, parts[2], 12, 0, 0);
          if (!isNaN(dt.getTime())) dateParsed = dt.toISOString();
        }
      }

      const expense = await expensesService.add({
        type: txType,
        amount: parsed,
        currency: 'PLN',
        category: isIncome ? incCat : expCat,
        tags,
        note,
        date: dateParsed,
        payer: payer || undefined,
        paymentMethod,
        vehicleId: !isIncome ? (vehicleId || undefined) : undefined,
      });
      haptic.success();
      router.back();
      InteractionManager.runAfterInteractions(async () => {
        addExpense(expense);
        if (txType === 'expense') {
          const budgets = await getBudgets();
          const limit = budgets[expCat];
          if (limit && limit > 0) {
            const nowM = new Date().toISOString().slice(0, 7);
            const monthSpent = expenses
              .filter(e => (!e.type || e.type === 'expense') && e.category === expCat && e.date.startsWith(nowM))
              .reduce((s, e) => s + e.amount, 0) + parsed;
            const pct = monthSpent / limit;
            const label = CATEGORY_META[expCat]?.label ?? expCat;
            if (pct >= 1) {
              toast.error(`Budżet "${label}" przekroczony! ${monthSpent.toFixed(0)}/${limit} zł`);
              notificationsService.notifyCategoryLimit(label, monthSpent, limit);
            } else if (pct >= 0.85) {
              toast.info(`Uwaga: ${Math.round(pct * 100)}% budżetu "${label}" wykorzystane`);
              notificationsService.notifyCategoryLimit(label, monthSpent, limit);
            }
          }
        }
      });
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Błąd', e.message);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={{ flex: 1 }}>
        {/* Header */}
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} style={styles.closeBtn}>
            <X size={20} color={colors.text.secondary} />
          </PressableScale>
          <Text style={styles.headerTitle}>
            {isIncome ? 'Nowy przychód' : 'Nowy wydatek'}
          </Text>
          <PressableScale onPress={() => router.push('/expenses/templates' as any)} style={styles.closeBtn}>
            <ClipboardList size={18} color={colors.text.secondary} />
          </PressableScale>
        </View>

        {/* Type toggle — segmented pill, expense=red / income=green */}
        <View style={styles.typeToggle}>
          <PressableScale
            onPress={() => handleTypeSwitch('expense')}
            style={[styles.typeBtn, !isIncome && { backgroundColor: '#E43434' }]}
          >
            <TrendingDown size={16} color={!isIncome ? '#FFFFFF' : colors.text.muted} strokeWidth={2.4} />
            <Text style={[styles.typeBtnText, !isIncome && { color: '#FFFFFF' }]}>Wydatek</Text>
          </PressableScale>
          <PressableScale
            onPress={() => handleTypeSwitch('income')}
            style={[styles.typeBtn, isIncome && { backgroundColor: '#2AC68F' }]}
          >
            <TrendingUp size={16} color={isIncome ? '#FFFFFF' : colors.text.muted} strokeWidth={2.4} />
            <Text style={[styles.typeBtnText, isIncome && { color: '#FFFFFF' }]}>Przychód</Text>
          </PressableScale>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={[styles.scroll, { paddingBottom: spacing[6] + kb }]}
          keyboardShouldPersistTaps="handled"
          keyboardDismissMode="interactive"
          showsVerticalScrollIndicator={false}
        >
          {/* Amount hero */}
          <View style={styles.amountWrap}>
            <View style={styles.amountRow}>
              <Text style={[styles.currencySymbol, { color: colors.text.muted }]}>PLN</Text>
              <InputField
                ref={amountRef}
                value={amount}
                onChangeText={setAmount}
                placeholder="0,00"
                keyboardType="decimal-pad"
                containerStyle={{ flex: 1 }}
                style={[styles.amountInput, { color: amountColor }]}
              />
            </View>
            <View style={styles.amountDivider} />
            <View style={styles.amountFootRow}>
              <Text style={styles.amountHint}>
                {isIncome ? 'Kwota przychodu' : 'Kwota wydatku'}
              </Text>
              {projectedBalance != null && (
                <Text style={styles.amountProjected}>
                  Zostanie <Text style={{ color: projectedBalance >= 0 ? '#2AC68F' : '#FF8A8A', fontWeight: '800' }}>
                    {projectedBalance >= 0 ? '' : '−'}{Math.abs(Math.round(projectedBalance))} zł
                  </Text>
                </Text>
              )}
            </View>
          </View>

          {/* Note */}
          <View>
            <InputField
              label="Opis (opcjonalnie)"
              value={note}
              onChangeText={setNote}
              placeholder={isIncome ? 'np. Wypłata za kwiecień...' : 'np. Biedronka, tankowanie...'}
            />
          </View>

          {/* Date */}
          <DatePickerField value={dateInput} onChange={setDateInput} placeholder="Wybierz datę" />

          {/* Who paid */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>{isIncome ? 'Kto otrzymał' : 'Kto zapłacił'}</Text>
            <View style={styles.payerRow}>
              {payers.map(p => {
                const active = payer === p;
                return (
                  <PressableScale key={p} onPress={() => setPayer(p)} style={[styles.payerChip, active && styles.payerChipActive]}>
                    <Text style={[styles.payerChipText, active && styles.payerChipTextActive]}>{p}</Text>
                  </PressableScale>
                );
              })}
              {addingPayer ? (
                <TextInput
                  value={newPayer}
                  onChangeText={setNewPayer}
                  placeholder="Imię…"
                  placeholderTextColor={colors.text.muted}
                  style={styles.payerInput}
                  autoFocus
                  returnKeyType="done"
                  onSubmitEditing={async () => {
                    const name = newPayer.trim();
                    if (name) { const list = await addPayer(name); setPayers(list); setPayer(name); }
                    setNewPayer(''); setAddingPayer(false);
                  }}
                  onBlur={() => { setNewPayer(''); setAddingPayer(false); }}
                />
              ) : (
                <PressableScale onPress={() => setAddingPayer(true)} style={styles.payerAddChip}>
                  <Text style={styles.payerAddText}>+ osoba</Text>
                </PressableScale>
              )}
            </View>
          </View>

          {/* Payment method */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Płatność</Text>
            <View style={styles.payerRow}>
              {(['card', 'cash'] as const).map(m => {
                const active = paymentMethod === m;
                return (
                  <PressableScale key={m} onPress={() => { haptic.tap(); setPaymentMethod(m); }} style={[styles.payerChip, active && styles.payerChipActive]}>
                    <Text style={[styles.payerChipText, active && styles.payerChipTextActive]}>{m === 'card' ? 'Karta' : 'Gotówka'}</Text>
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* Vehicle link (expenses only) */}
          {!isIncome && vehicles.length > 0 && (
            <View style={styles.section}>
              <Text style={styles.sectionLabel}>Pojazd (opcjonalnie)</Text>
              <View style={styles.payerRow}>
                <PressableScale onPress={() => { haptic.tap(); setVehicleId(undefined); }} style={[styles.payerChip, !vehicleId && styles.payerChipActive]}>
                  <Text style={[styles.payerChipText, !vehicleId && styles.payerChipTextActive]}>Brak</Text>
                </PressableScale>
                {vehicles.map(v => {
                  const active = vehicleId === v.id;
                  return (
                    <PressableScale key={v.id} onPress={() => { haptic.tap(); setVehicleId(active ? undefined : v.id); }} style={[styles.payerChip, active && { backgroundColor: v.color + '22', borderColor: v.color }]}>
                      <Text style={[styles.payerChipText, active && { color: v.color }]}>{v.name}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </View>
          )}

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Kategoria</Text>
            <View style={styles.categoryGrid}>
              {(isIncome ? INCOME_CATS : EXPENSE_CATS).map(([key, meta]) => {
                const IconComp = (LucideIcons as any)[meta.icon];
                const selected = isIncome ? incCat === key : expCat === key;
                const budgetLimit = !isIncome ? budgets[key as ExpenseCategory] : undefined;
                const budgetSpent = !isIncome ? (monthSpendByCat[key] ?? 0) : 0;
                const budgetPct = budgetLimit ? budgetSpent / budgetLimit : 0;
                const budgetOver = budgetLimit ? budgetSpent >= budgetLimit : false;

                return (
                  <PressableScale
                    key={key}
                    onPress={() => isIncome
                      ? setIncCat(key as IncomeCategory)
                      : setExpCat(key as ExpenseCategory)
                    }
                    style={[styles.categoryItem, selected && styles.categoryItemSelected]}
                  >
                    <View style={styles.categoryIcon}>
                      {IconComp && <IconComp size={16} color={selected ? meta.color : colors.text.muted} />}
                    </View>
                    <View style={{ flex: 1 }}>
                      <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                        {meta.label}
                      </Text>
                      {budgetLimit != null && budgetLimit > 0 && (
                        <Text style={[styles.budgetHint, budgetOver && { color: colors.accent.danger }]}>
                          {budgetOver ? 'przekroczony' : `${(budgetLimit - budgetSpent).toFixed(0)} zł`}
                        </Text>
                      )}
                    </View>
                    {selected && (
                      <View style={styles.checkDot}>
                        <Check size={9} color={colors.bg.primary} />
                      </View>
                    )}
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* Tags */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Tagi</Text>
            <View style={styles.tagsWrap}>
              {quickTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  selected={tags.includes(tag)}
                  onPress={() => toggleTag(tag)}
                  color={isIncome ? colors.accent.success : undefined}
                />
              ))}
            </View>
            <View style={styles.customTagRow}>
              <InputField
                value={customTag}
                onChangeText={setCustomTag}
                placeholder="Własny tag..."
                leftSlot={<Tag size={16} color={colors.text.muted} />}
                containerStyle={{ flex: 1 }}
                onSubmitEditing={addCustomTag}
                returnKeyType="done"
              />
              <PressableScale onPress={addCustomTag} style={styles.addTagBtn}>
                <Check size={16} color={colors.text.secondary} />
              </PressableScale>
            </View>
            {tags.length > 0 && (
              <View style={styles.tagsWrap}>
                {tags.map((tag) => (
                  <Chip key={tag} label={`× ${tag}`} selected onPress={() => toggleTag(tag)} color={isIncome ? colors.accent.success : undefined} />
                ))}
              </View>
            )}
          </View>
        </ScrollView>

        <View style={[styles.footer, { marginBottom: kb }]}>
          <AnimatedButton
            onPress={handleSave}
            label={saving ? 'Zapisuję...' : (isIncome ? 'Zapisz przychód' : 'Zapisz wydatek')}
            icon={<Check size={18} color={colors.bg.primary} />}
            size="lg"
            fullWidth
            disabled={saving}
          />
          <PressableScale onPress={saveAsTemplate} disabled={saving}>
            <View style={styles.saveTplBtn}>
              <ClipboardList size={14} color={colors.text.secondary} />
              <Text style={styles.saveTplText}>Zapisz jako szablon</Text>
            </View>
          </PressableScale>
        </View>
      </View>
    </SafeAreaView>
  );
}

const makeStyles = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.secondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: c.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default,
  },
  headerTitle: { ...typography.h4, color: c.text.primary },
  typeToggle: {
    flexDirection: 'row', gap: 4,
    marginHorizontal: spacing[4], marginVertical: spacing[3],
    padding: 4, borderRadius: radius.full,
    backgroundColor: c.border.subtle,
    borderWidth: 1, borderColor: c.border.default,
  },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[3], borderRadius: radius.full,
    backgroundColor: 'transparent',
  },
  typeBtnText: { ...typography.label, color: c.text.muted, fontWeight: '700' },
  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[6] },
  amountWrap: {
    borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.bg.card,
    paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[4],
    gap: spacing[1],
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  currencySymbol: { ...typography.h3, fontWeight: '300', fontSize: 20 },
  amountInput: {
    fontSize: 38, fontWeight: '800', letterSpacing: -1,
    lineHeight: 46, paddingVertical: 2, includeFontPadding: false as any, textAlignVertical: 'center',
  },
  amountDivider: { height: 1, backgroundColor: c.border.subtle, marginTop: spacing[1] },
  amountHint: { ...typography.caption, fontSize: 11, letterSpacing: 0.5, color: c.text.muted },
  amountFootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  amountProjected: { fontSize: 11.5, color: c.text.muted, fontWeight: '600' },
  section: { gap: spacing[3] },
  payerRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  payerChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.bg.card,
  },
  payerChipActive: { backgroundColor: c.accent.blue + '20', borderColor: c.accent.blue },
  payerChipText: { fontSize: 13, fontWeight: '600', color: c.text.muted },
  payerChipTextActive: { color: c.accent.blue },
  payerInput: {
    minWidth: 90, paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: c.accent.blue + '60',
    backgroundColor: c.border.subtle, fontSize: 13, color: c.text.primary,
  },
  payerAddChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderStyle: 'dashed',
    borderColor: c.border.focus,
  },
  payerAddText: { fontSize: 13, fontWeight: '600', color: c.text.secondary },
  sectionLabel: {
    ...typography.label, color: c.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  categoryItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
    width: '48%',
  },
  categoryItemSelected: {
    borderColor: c.border.default,
    backgroundColor: c.border.subtle,
  },
  categoryIcon: {
    width: 26, height: 26, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.border.subtle,
  },
  categoryLabel: { ...typography.bodySmall, color: c.text.secondary, fontWeight: '500' },
  categoryLabelSelected: { color: c.text.primary, fontWeight: '700' },
  budgetHint: { fontSize: 9, color: c.text.muted, fontWeight: '500', marginTop: 1 },
  checkDot: {
    width: 15, height: 15, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', marginLeft: 1,
    backgroundColor: c.text.primary,
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  customTagRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  addTagBtn: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: c.bg.card, borderWidth: 1,
    borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: { padding: spacing[4], borderTopWidth: 1, borderTopColor: c.border.subtle, gap: spacing[2] },
  saveTplBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[2],
  },
  saveTplText: { fontSize: 12, fontWeight: '600', color: c.text.secondary },
});

