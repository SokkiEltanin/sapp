import { useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView, KeyboardAvoidingView,
  Platform, Alert,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { X, Check, Tag, TrendingDown, TrendingUp } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

import InputField from '@/components/ui/InputField';
import AnimatedButton from '@/components/ui/AnimatedButton';
import PressableScale from '@/components/ui/PressableScale';
import Chip from '@/components/ui/Chip';
import { ExpenseCategory, IncomeCategory, TransactionType } from '@/types';
import { CATEGORY_META, INCOME_CATEGORY_META } from '@/utils/categories';
import { expensesService } from '@/services/expensesService';
import { useExpensesStore } from '@/store/expensesStore';
import { getBudgets } from '@/utils/budgets';
import { toast } from '@/store/toastStore';
import { colors, spacing, radius, typography } from '@/theme';

const EXPENSE_CATS = Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][];
const INCOME_CATS = Object.entries(INCOME_CATEGORY_META) as [IncomeCategory, typeof INCOME_CATEGORY_META[IncomeCategory]][];

const EXPENSE_TAGS = ['słodycze', 'warzywa', 'mięso', 'napoje', 'fast food', 'apteka', 'paliwo', 'bilety', 'odzież'];
const INCOME_TAGS = ['premia', 'nadgodziny', 'zwrot', 'gotówka', 'przelew'];

export default function AddExpenseModal() {
  const { type } = useLocalSearchParams<{ type?: TransactionType }>();
  const [txType, setTxType] = useState<TransactionType>(type === 'income' ? 'income' : 'expense');
  const [amount, setAmount] = useState('');
  const [note, setNote] = useState('');
  const [expCat, setExpCat] = useState<ExpenseCategory>('other');
  const [incCat, setIncCat] = useState<IncomeCategory>('salary');
  const [tags, setTags] = useState<string[]>([]);
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving] = useState(false);
  const addExpense  = useExpensesStore((s) => s.addExpense);
  const expenses    = useExpensesStore((s) => s.expenses);

  const isIncome = txType === 'income';
  const amountColor = isIncome ? colors.accent.success : colors.text.primary;
  const quickTags = isIncome ? INCOME_TAGS : EXPENSE_TAGS;

  const toggleTag = (tag: string) =>
    setTags((prev) => prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]);

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags((prev) => [...prev, t]);
    setCustomTag('');
  };

  const handleTypeSwitch = (type: TransactionType) => {
    setTxType(type);
    setTags([]);
  };

  const handleSave = async () => {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!parsed || isNaN(parsed) || parsed <= 0) {
      Alert.alert('Błąd', 'Wpisz poprawną kwotę');
      return;
    }
    setSaving(true);
    try {
      const expense = await expensesService.add({
        type: txType,
        amount: parsed,
        currency: 'PLN',
        category: isIncome ? incCat : expCat,
        tags,
        note,
        date: new Date().toISOString(),
      });
      addExpense(expense);

      // Budget check for expenses
      if (txType === 'expense') {
        const budgets = await getBudgets();
        const limit = budgets[expCat];
        if (limit && limit > 0) {
          const nowM = new Date().toISOString().slice(0, 7); // YYYY-MM
          const monthSpent = expenses
            .filter(e => (!e.type || e.type === 'expense') && e.category === expCat && e.date.startsWith(nowM))
            .reduce((s, e) => s + e.amount, 0) + parsed;
          const pct = monthSpent / limit;
          if (pct >= 1) {
            toast.error(`Budżet "${CATEGORY_META[expCat]?.label}" przekroczony! ${monthSpent.toFixed(0)}/${limit} zł`);
          } else if (pct >= 0.85) {
            toast.info(`Uwaga: ${Math.round(pct * 100)}% budżetu "${CATEGORY_META[expCat]?.label}" wykorzystane`);
          }
        }
      }

      router.back();
    } catch (e: any) {
      Alert.alert('Błąd', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Header */}
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} style={styles.closeBtn}>
            <X size={20} color={colors.text.secondary} />
          </PressableScale>
          <Text style={styles.headerTitle}>
            {isIncome ? 'Nowy przychód' : 'Nowy wydatek'}
          </Text>
          <View style={{ width: 36 }} />
        </View>

        {/* Type toggle */}
        <View style={styles.typeToggle}>
          <PressableScale
            onPress={() => handleTypeSwitch('expense')}
            style={[styles.typeBtn, !isIncome && styles.typeBtnActive]}
          >
            <TrendingDown size={16} color={!isIncome ? colors.bg.primary : colors.text.muted} />
            <Text style={[styles.typeBtnText, !isIncome && styles.typeBtnTextActive]}>Wydatek</Text>
          </PressableScale>
          <PressableScale
            onPress={() => handleTypeSwitch('income')}
            style={[styles.typeBtn, isIncome && styles.typeBtnActive]}
          >
            <TrendingUp size={16} color={isIncome ? colors.bg.primary : colors.text.muted} />
            <Text style={[styles.typeBtnText, isIncome && styles.typeBtnTextActive]}>Przychód</Text>
          </PressableScale>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Amount hero */}
          <View style={styles.amountWrap}>
            <View style={styles.amountRow}>
              <Text style={[styles.currencySymbol, { color: colors.text.muted }]}>PLN</Text>
              <InputField
                value={amount}
                onChangeText={setAmount}
                placeholder="0,00"
                keyboardType="decimal-pad"
                containerStyle={{ flex: 1 }}
                style={[styles.amountInput, { color: amountColor }]}
              />
            </View>
            <View style={styles.amountDivider} />
            <Text style={styles.amountHint}>
              {isIncome ? 'Kwota przychodu' : 'Kwota wydatku'}
            </Text>
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

          {/* Category */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>Kategoria</Text>
            <View style={styles.categoryGrid}>
              {(isIncome ? INCOME_CATS : EXPENSE_CATS).map(([key, meta]) => {
                const IconComp = (LucideIcons as any)[meta.icon];
                const selected = isIncome ? incCat === key : expCat === key;
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
                    <Text style={[styles.categoryLabel, selected && styles.categoryLabelSelected]}>
                      {meta.label}
                    </Text>
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

        <View style={styles.footer}>
          <AnimatedButton
            onPress={handleSave}
            label={saving ? 'Zapisuję...' : (isIncome ? 'Zapisz przychód' : 'Zapisz wydatek')}
            icon={<Check size={18} color={colors.bg.primary} />}
            size="lg"
            fullWidth
            disabled={saving}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.secondary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: colors.border.default,
  },
  headerTitle: { ...typography.h4, color: colors.text.primary },
  typeToggle: {
    flexDirection: 'row', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[2], borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.card,
  },
  typeBtnActive: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  typeBtnText: { ...typography.label, color: colors.text.muted, fontWeight: '600' },
  typeBtnTextActive: { color: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[6] },
  amountWrap: {
    borderRadius: radius.xl, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: colors.bg.card,
    paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[4],
    gap: spacing[1],
  },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  currencySymbol: { ...typography.h3, fontWeight: '300', fontSize: 20 },
  amountInput: { fontSize: 38, fontWeight: '800', letterSpacing: -1 },
  amountDivider: { height: 1, backgroundColor: 'rgba(255,255,255,0.06)', marginTop: spacing[1] },
  amountHint: { ...typography.caption, fontSize: 11, letterSpacing: 0.5, color: colors.text.muted },
  section: { gap: spacing[3] },
  sectionLabel: {
    ...typography.label, color: colors.text.secondary,
    textTransform: 'uppercase', letterSpacing: 0.8, fontSize: 11,
  },
  categoryGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  categoryItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default,
  },
  categoryItemSelected: {
    borderColor: 'rgba(255,255,255,0.4)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  categoryIcon: {
    width: 26, height: 26, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  categoryLabel: { ...typography.bodySmall, color: colors.text.secondary, fontWeight: '500' },
  categoryLabelSelected: { color: colors.text.primary, fontWeight: '700' },
  checkDot: {
    width: 15, height: 15, borderRadius: radius.full,
    alignItems: 'center', justifyContent: 'center', marginLeft: 1,
    backgroundColor: colors.text.primary,
  },
  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  customTagRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  addTagBtn: {
    width: 48, height: 48, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  footer: { padding: spacing[4], borderTopWidth: 1, borderTopColor: colors.border.subtle },
});

