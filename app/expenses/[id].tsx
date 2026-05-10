import { useState, useEffect } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import { ArrowLeft, Trash2, Edit3, Save, TrendingDown, TrendingUp, Check, Tag, Calendar, ShoppingCart, ChevronDown, ChevronUp } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import Chip from '@/components/ui/Chip';
import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { toast } from '@/store/toastStore';
import { ExpenseCategory, IncomeCategory, TransactionType } from '@/types';
import { getCategoryMeta, CATEGORY_META, INCOME_CATEGORY_META } from '@/utils/categories';
import { colors, spacing, radius, typography } from '@/theme';

const EXPENSE_CATS = Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][];
const INCOME_CATS  = Object.entries(INCOME_CATEGORY_META) as [IncomeCategory, typeof INCOME_CATEGORY_META[IncomeCategory]][];
const EXPENSE_TAGS = ['słodycze', 'warzywa', 'mięso', 'napoje', 'fast food', 'apteka', 'paliwo', 'bilety'];
const INCOME_TAGS  = ['premia', 'nadgodziny', 'zwrot', 'gotówka', 'przelew'];

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses, updateExpense, deleteExpense, setExpenses } = useExpensesStore();
  const expense = expenses.find(e => e.id === id);

  useEffect(() => {
    if (expenses.length === 0) {
      expensesService.getAll().then(setExpenses).catch(() => {});
    }
  }, []);

  const isInc = expense?.type === 'income';

  const [editing, setEditing]   = useState(false);
  const [amount, setAmount]     = useState(expense?.amount.toString() ?? '');
  const [note, setNote]         = useState(expense?.note ?? '');
  const [txType, setTxType]     = useState<TransactionType>(expense?.type ?? 'expense');
  const [expCat, setExpCat]     = useState<ExpenseCategory>((isInc ? 'other' : expense?.category ?? 'other') as ExpenseCategory);
  const [incCat, setIncCat]     = useState<IncomeCategory>((isInc ? expense?.category ?? 'salary' : 'salary') as IncomeCategory);
  const [tags, setTags]         = useState<string[]>(expense?.tags ?? []);
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving]     = useState(false);
  const [itemsExpanded, setItemsExpanded] = useState(true);
  const [dateInput, setDateInput] = useState(() => {
    const d = new Date(expense?.date ?? Date.now());
    return `${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}.${d.getFullYear()}`;
  });

  if (!expense) {
    return (
      <SafeAreaView style={s.safe}>
        <View style={s.notFound}>
          <Text style={s.notFoundText}>Transakcja nie istnieje</Text>
          <PressableScale onPress={() => router.back()}>
            <Text style={{ color: colors.text.primary, padding: spacing[4] }}>Wróć</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    );
  }

  const editIsIncome = txType === 'income';
  const quickTags = editIsIncome ? INCOME_TAGS : EXPENSE_TAGS;
  const accentColor = editIsIncome ? colors.accent.green : colors.accent.red;

  const toggleTag = (tag: string) =>
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setCustomTag('');
  };

  const handleSave = async () => {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!parsed || isNaN(parsed) || parsed <= 0) {
      toast.error('Nieprawidłowa kwota');
      return;
    }
    setSaving(true);
    try {
      // Parse DD.MM.YYYY date input
    let dateParsed = expense.date;
    const parts = dateInput.split('.');
    if (parts.length === 3) {
      const [d, m, y] = parts.map(Number);
      const dt = new Date(y, m - 1, d, 12, 0, 0);
      if (!isNaN(dt.getTime())) dateParsed = dt.toISOString();
    }

    const updates = {
        type: txType,
        amount: parsed,
        note: note.trim(),
        category: editIsIncome ? incCat : expCat,
        tags,
        date: dateParsed,
        updatedAt: new Date().toISOString(),
      };
      updateExpense(id!, updates);
      await expensesService.update(id!, updates);
      setEditing(false);
      toast.success('Zapisano');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = () => {
    Alert.alert('Usuń transakcję', 'Na pewno usunąć?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive', onPress: async () => {
          deleteExpense(id!);
          await expensesService.remove(id!).catch(() => {});
          toast.info('Usunięto');
          router.back();
        },
      },
    ]);
  };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={s.header}>
          <PressableScale onPress={() => router.back()} style={s.iconBtn}>
            <ArrowLeft size={20} color={colors.text.secondary} />
          </PressableScale>

          <View style={[s.typePill, { backgroundColor: accentColor + '18', borderColor: accentColor + '40' }]}>
            {isInc
              ? <TrendingUp size={11} color={accentColor} />
              : <TrendingDown size={11} color={accentColor} />
            }
            <Text style={[s.typePillText, { color: accentColor }]}>
              {editing ? (editIsIncome ? 'Przychód' : 'Wydatek') : (isInc ? 'Przychód' : 'Wydatek')}
            </Text>
          </View>

          <View style={s.headerActions}>
            {editing ? (
              <PressableScale onPress={saving ? undefined : handleSave} style={[s.iconBtn, s.saveBtn]}>
                <Save size={18} color={colors.bg.primary} />
              </PressableScale>
            ) : (
              <PressableScale onPress={() => setEditing(true)} style={s.iconBtn}>
                <Edit3 size={18} color={colors.text.secondary} />
              </PressableScale>
            )}
          </View>
        </View>

        <ScrollView
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Amount hero */}
          <View style={[s.amountCard, { borderLeftColor: accentColor }]}>
            {editing ? (
              <View style={s.amountRow}>
                <Text style={s.currency}>PLN</Text>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  style={[s.amountInput, { color: accentColor }]}
                  keyboardType="decimal-pad"
                  autoFocus
                  placeholder="0,00"
                  placeholderTextColor={colors.text.muted}
                />
              </View>
            ) : (
              <View style={s.amountRow}>
                <Text style={s.currency}>PLN</Text>
                <Text style={[s.amountDisplay, { color: accentColor }]}>
                  {isInc ? '+' : '-'}{expense.amount.toFixed(2)}
                </Text>
              </View>
            )}

            {/* Note */}
            {editing ? (
              <TextInput
                value={note}
                onChangeText={setNote}
                style={s.noteInput}
                placeholder="Opis..."
                placeholderTextColor={colors.text.muted}
                multiline
              />
            ) : (
              expense.note ? <Text style={s.noteText}>{expense.note}</Text> : null
            )}
          </View>

          {/* Receipt breakdown */}
          {expense.receiptItems && expense.receiptItems.length > 0 && (
            <View style={s.card}>
              <TouchableOpacity
                style={s.receiptHeader}
                onPress={() => setItemsExpanded(x => !x)}
                activeOpacity={0.7}
              >
                <ShoppingCart size={14} color={colors.accent.blue} />
                <Text style={[s.cardLabel, { color: colors.accent.blue, flex: 1 }]}>
                  PRODUKTY ({expense.receiptItems.length})
                </Text>
                {itemsExpanded
                  ? <ChevronUp size={14} color={colors.text.muted} />
                  : <ChevronDown size={14} color={colors.text.muted} />
                }
              </TouchableOpacity>
              {itemsExpanded && expense.receiptItems.map((it, idx) => {
                const meta = getCategoryMeta(it.category);
                return (
                  <View key={idx} style={s.receiptItem}>
                    <View style={s.receiptItemLeft}>
                      <Text style={s.receiptItemName} numberOfLines={1}>{it.name}</Text>
                      <Text style={s.receiptItemMeta}>
                        {it.quantity > 1 ? `${it.quantity} szt. · ` : ''}{meta.label}
                        {it.discount ? ` · -${it.discount.toFixed(2)} zł` : ''}
                      </Text>
                    </View>
                    <Text style={s.receiptItemPrice}>{it.price.toFixed(2)} zł</Text>
                  </View>
                );
              })}
            </View>
          )}

          {/* Date row */}
          <View style={s.card}>
            <Text style={s.cardLabel}>Data</Text>
            {editing ? (
              <View style={s.dateRow}>
                <Calendar size={14} color={colors.text.muted} />
                <TextInput
                  value={dateInput}
                  onChangeText={setDateInput}
                  style={s.dateInput}
                  placeholder="DD.MM.RRRR"
                  placeholderTextColor={colors.text.muted}
                  keyboardType="numeric"
                  maxLength={10}
                />
              </View>
            ) : (
              <View style={s.dateRow}>
                <Calendar size={14} color={colors.text.muted} />
                <Text style={s.dateTxt}>
                  {new Date(expense.date).toLocaleDateString('pl-PL', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </Text>
              </View>
            )}
          </View>

          {/* Type toggle (editing only) */}
          {editing && (
            <View style={s.typeToggle}>
              <TouchableOpacity
                style={[s.typeBtn, !editIsIncome && s.typeBtnActive]}
                onPress={() => setTxType('expense')}
                activeOpacity={0.8}
              >
                <TrendingDown size={15} color={!editIsIncome ? colors.bg.primary : colors.text.muted} />
                <Text style={[s.typeBtnText, !editIsIncome && s.typeBtnTextActive]}>Wydatek</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.typeBtn, editIsIncome && s.typeBtnActive]}
                onPress={() => setTxType('income')}
                activeOpacity={0.8}
              >
                <TrendingUp size={15} color={editIsIncome ? colors.bg.primary : colors.text.muted} />
                <Text style={[s.typeBtnText, editIsIncome && s.typeBtnTextActive]}>Przychód</Text>
              </TouchableOpacity>
            </View>
          )}

          {/* Category */}
          <View style={s.card}>
            <Text style={s.cardLabel}>Kategoria</Text>
            <View style={s.catGrid}>
              {(editIsIncome ? INCOME_CATS : EXPENSE_CATS).map(([key, meta]) => {
                const IconComp = (LucideIcons as any)[meta.icon];
                const selected = editing
                  ? (editIsIncome ? incCat === key : expCat === key)
                  : expense.category === key;
                return (
                  <PressableScale
                    key={key}
                    onPress={() => {
                      if (!editing) return;
                      editIsIncome ? setIncCat(key as IncomeCategory) : setExpCat(key as ExpenseCategory);
                    }}
                    style={[s.catItem, selected && { borderColor: meta.color + '80', backgroundColor: meta.color + '12' }]}
                  >
                    <View style={s.catIcon}>
                      {IconComp && <IconComp size={14} color={selected ? meta.color : colors.text.muted} />}
                    </View>
                    <Text style={[s.catLabel, selected && { color: meta.color, fontWeight: '700' }]}>
                      {meta.label}
                    </Text>
                    {selected && <View style={[s.checkDot, { backgroundColor: meta.color }]}><Check size={8} color="#000" /></View>}
                  </PressableScale>
                );
              })}
            </View>
          </View>

          {/* Tags */}
          <View style={s.card}>
            <Text style={s.cardLabel}>Tagi</Text>
            {editing ? (
              <>
                <View style={s.tagsWrap}>
                  {quickTags.map(tag => (
                    <Chip
                      key={tag} label={tag}
                      selected={tags.includes(tag)}
                      onPress={() => toggleTag(tag)}
                      color={editIsIncome ? colors.accent.green : undefined}
                    />
                  ))}
                </View>
                <View style={s.customTagRow}>
                  <TextInput
                    value={customTag}
                    onChangeText={setCustomTag}
                    style={s.tagInput}
                    placeholder="Własny tag..."
                    placeholderTextColor={colors.text.muted}
                    onSubmitEditing={addCustomTag}
                    returnKeyType="done"
                  />
                  <PressableScale onPress={addCustomTag} style={s.addTagBtn}>
                    <Tag size={15} color={colors.text.secondary} />
                  </PressableScale>
                </View>
                {tags.length > 0 && (
                  <View style={s.tagsWrap}>
                    {tags.map(tag => (
                      <Chip key={tag} label={`× ${tag}`} selected onPress={() => toggleTag(tag)} color={editIsIncome ? colors.accent.green : undefined} />
                    ))}
                  </View>
                )}
              </>
            ) : (
              tags.length > 0 ? (
                <View style={s.tagsWrap}>
                  {tags.map(tag => (
                    <View key={tag} style={s.tagBadge}>
                      <Text style={s.tagBadgeText}>{tag}</Text>
                    </View>
                  ))}
                </View>
              ) : (
                <Text style={s.emptyTags}>Brak tagów</Text>
              )
            )}
          </View>

          {/* Meta */}
          <Text style={s.meta}>
            Dodano: {new Date(expense.createdAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}
            {expense.updatedAt !== expense.createdAt
              ? `\nEdytowano: ${new Date(expense.updatedAt).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' })}`
              : ''}
          </Text>

          <PressableScale onPress={handleDelete} style={s.deleteBtn}>
            <Trash2 size={16} color={colors.accent.red} />
            <Text style={s.deleteBtnText}>Usuń transakcję</Text>
          </PressableScale>
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const s = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
  typePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, alignSelf: 'flex-start',
  },
  typePillText: { fontSize: 12, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: spacing[2] },

  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },

  amountCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    borderLeftWidth: 3, padding: spacing[5], gap: spacing[2],
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  currency: { fontSize: 18, fontWeight: '300', color: colors.text.muted },
  amountDisplay: { fontSize: 40, fontWeight: '800', letterSpacing: -1.5, lineHeight: 46 },
  amountInput: { fontSize: 40, fontWeight: '800', letterSpacing: -1.5, flex: 1, padding: 0 },
  noteText: { fontSize: 14, color: colors.text.secondary, lineHeight: 20 },
  noteInput: { fontSize: 14, color: colors.text.secondary, lineHeight: 20, padding: 0 },

  typeToggle: {
    flexDirection: 'row', gap: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default, padding: spacing[2],
  },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[2], borderRadius: radius.md,
  },
  typeBtnActive: { backgroundColor: colors.text.primary },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: colors.text.muted },
  typeBtnTextActive: { color: colors.bg.primary },

  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[4], gap: spacing[3],
  },
  cardLabel: {
    fontSize: 10, fontWeight: '600', color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  catItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: colors.bg.elevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default,
  },
  catIcon: {
    width: 24, height: 24, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  catLabel: { fontSize: 12, fontWeight: '500', color: colors.text.secondary },
  checkDot: {
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  customTagRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
  },
  tagInput: {
    flex: 1, fontSize: 14, color: colors.text.primary,
    backgroundColor: colors.bg.elevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  addTagBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.bg.elevated, borderWidth: 1,
    borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center',
  },
  tagBadge: {
    paddingHorizontal: spacing[3], paddingVertical: 5,
    backgroundColor: colors.bg.elevated, borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border.default,
  },
  tagBadgeText: { fontSize: 12, color: colors.text.secondary, fontWeight: '500' },
  emptyTags: { fontSize: 13, color: colors.text.muted },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dateInput: {
    flex: 1, fontSize: 15, color: colors.text.primary,
    paddingVertical: 0, fontWeight: '600',
  },
  dateTxt: { fontSize: 14, color: colors.text.secondary },

  meta: { fontSize: 11, color: colors.text.muted, paddingHorizontal: spacing[1], lineHeight: 18 },

  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  receiptItem: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[2],
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
  },
  receiptItemLeft: { flex: 1, gap: 2 },
  receiptItemName: { fontSize: 13, fontWeight: '500', color: colors.text.primary },
  receiptItemMeta: { fontSize: 10, color: colors.text.muted },
  receiptItemPrice: { fontSize: 13, fontWeight: '700', color: colors.text.primary },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[4], borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.accent.red + '40',
    backgroundColor: colors.accent.red + '0E',
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: colors.accent.red },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: colors.text.secondary, fontSize: 16 },
});
