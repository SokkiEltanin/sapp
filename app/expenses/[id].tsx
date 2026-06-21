import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ArrowLeft, Trash2, Edit3, Save, TrendingDown, TrendingUp,
  Check, Tag, Calendar, ShoppingCart, ChevronDown, ChevronUp,
  Pencil, X as XIcon,
} from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';
import { haptic } from '@/utils/haptics';

import PressableScale from '@/components/ui/PressableScale';
import Chip from '@/components/ui/Chip';
import DatePickerField from '@/components/ui/DatePickerField';
import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { toast } from '@/store/toastStore';
import { ExpenseCategory, IncomeCategory, TransactionType, ReceiptItem, PaymentMethod } from '@/types';
import { getCategoryMeta, CATEGORY_META, INCOME_CATEGORY_META } from '@/utils/categories';
import { saveCustomProductsToMemory, saveCustomTagsToMemory, saveNameAliases } from '@/utils/productMemory';
import { getPayers, addPayer } from '@/utils/payers';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';

const EXPENSE_CATS = Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][];
const INCOME_CATS  = Object.entries(INCOME_CATEGORY_META) as [IncomeCategory, typeof INCOME_CATEGORY_META[IncomeCategory]][];
const EXPENSE_TAGS = ['słodycze', 'warzywa', 'mięso', 'napoje', 'fast food', 'apteka', 'paliwo', 'bilety'];
const INCOME_TAGS  = ['premia', 'nadgodziny', 'zwrot', 'gotówka', 'przelew'];

const ITEM_TAGS = [
  'mięso', 'nabiał', 'ryby', 'warzywa', 'owoce',
  'słodycze', 'pieczywo', 'napoje', 'przekąski',
  'chemia', 'higiena', 'dania gotowe',
];

// ─── Inline item editor ───────────────────────────────────────────────────────

interface ItemEditorProps {
  item: ReceiptItem;
  onSave: (updated: ReceiptItem) => void;
  onCancel: () => void;
}

function ItemEditor({ item, onSave, onCancel }: ItemEditorProps) {
  const colors = useColors();
  const ie = useMemo(() => makeIe(colors), [colors]);
  const [name, setName]         = useState(item.name);
  const [price, setPrice]       = useState(item.price.toFixed(2));
  const [qty, setQty]           = useState(item.quantity.toString());
  const [category, setCategory] = useState<ExpenseCategory>(item.category);
  const [tags, setTags]         = useState<string[]>(item.tags ?? []);
  const [eaters, setEaters]     = useState<string[]>(item.eaters ?? []);
  const [customTag, setCustomTag] = useState('');
  const [payers, setPayers]     = useState<string[]>([]);
  useEffect(() => { getPayers().then(setPayers).catch(() => {}); }, []);

  const toggleTag = (t: string) =>
    setTags(prev => prev.includes(t) ? prev.filter(x => x !== t) : [...prev, t]);
  const toggleEater = (p: string) =>
    setEaters(prev => prev.includes(p) ? prev.filter(x => x !== p) : [...prev, p]);
  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setCustomTag('');
  };

  const handleSave = () => {
    const p = parseFloat(price.replace(',', '.'));
    const q = parseFloat(qty.replace(',', '.')) || 1;
    if (!name.trim() || isNaN(p) || p <= 0) return;
    onSave({ ...item, name: name.trim(), price: p, quantity: q, category, tags, eaters: eaters.length ? eaters : undefined });
  };

  return (
    <View style={ie.wrap}>
      {/* Name */}
      <TextInput
        style={ie.nameInput}
        value={name}
        onChangeText={setName}
        placeholder="Nazwa produktu"
        placeholderTextColor={colors.text.muted}
        returnKeyType="done"
      />

      {/* Price + Qty row */}
      <View style={ie.row}>
        <View style={ie.field}>
          <Text style={ie.fieldLabel}>CENA zł</Text>
          <TextInput
            style={ie.fieldInput}
            value={price}
            onChangeText={setPrice}
            keyboardType="decimal-pad"
            placeholder="0,00"
            placeholderTextColor={colors.text.muted}
          />
        </View>
        <View style={ie.field}>
          <Text style={ie.fieldLabel}>ILOŚĆ / KG</Text>
          <TextInput
            style={ie.fieldInput}
            value={qty}
            onChangeText={setQty}
            keyboardType="decimal-pad"
            placeholder="1"
            placeholderTextColor={colors.text.muted}
          />
        </View>
      </View>

      {/* Category mini-grid */}
      <Text style={ie.sectionLabel}>Kategoria</Text>
      <View style={ie.catRow}>
        {EXPENSE_CATS.map(([key, meta]) => {
          const Icon = (LucideIcons as any)[meta.icon];
          const sel = category === key;
          return (
            <TouchableOpacity
              key={key}
              onPress={() => setCategory(key as ExpenseCategory)}
              style={[ie.catChip, sel && { backgroundColor: meta.color + '22', borderColor: meta.color + '60' }]}
              activeOpacity={0.7}
            >
              {Icon && <Icon size={11} color={sel ? meta.color : colors.text.muted} />}
              <Text style={[ie.catChipText, sel && { color: meta.color, fontWeight: '700' }]}>{meta.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      {/* Food sub-tags */}
      <Text style={ie.sectionLabel}>Tagi</Text>
      <View style={ie.tagsRow}>
        {[...new Set([...ITEM_TAGS, ...tags])].map(t => (
          <TouchableOpacity
            key={t}
            onPress={() => toggleTag(t)}
            style={[ie.tagChip, tags.includes(t) && ie.tagChipSel]}
            activeOpacity={0.7}
          >
            <Text style={[ie.tagChipText, tags.includes(t) && ie.tagChipTextSel]}>{t}</Text>
          </TouchableOpacity>
        ))}
        <View style={[ie.tagChip, { flexDirection: 'row', alignItems: 'center', gap: 2 }]}>
          <LucideIcons.Plus size={10} color={colors.text.muted} />
          <TextInput
            value={customTag}
            onChangeText={setCustomTag}
            onSubmitEditing={addCustomTag}
            onBlur={addCustomTag}
            placeholder="własny"
            placeholderTextColor={colors.text.muted}
            autoCapitalize="none"
            returnKeyType="done"
            style={{ minWidth: 54, fontSize: 10, color: colors.text.primary, padding: 0 }}
          />
        </View>
      </View>

      {/* Who ate it — drives the per-person limit bars */}
      {payers.length >= 2 && (
        <>
          <Text style={ie.sectionLabel}>Kto jadł {eaters.length === 0 ? '· wspólnie' : ''}</Text>
          <View style={ie.tagsRow}>
            {payers.map(p => {
              const on = eaters.includes(p);
              return (
                <TouchableOpacity
                  key={p}
                  onPress={() => toggleEater(p)}
                  style={[ie.tagChip, on && { backgroundColor: '#4ECBA820', borderColor: '#4ECBA880' }]}
                  activeOpacity={0.7}
                >
                  <Text style={[ie.tagChipText, on && { color: '#4ECBA8', fontWeight: '600' }]}>{p}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </>
      )}

      {/* Actions */}
      <View style={ie.actions}>
        <TouchableOpacity style={ie.cancelBtn} onPress={onCancel} activeOpacity={0.7}>
          <XIcon size={14} color={colors.text.muted} />
          <Text style={ie.cancelText}>Anuluj</Text>
        </TouchableOpacity>
        <TouchableOpacity style={ie.saveBtn} onPress={handleSave} activeOpacity={0.7}>
          <Check size={14} color={colors.bg.primary} />
          <Text style={ie.saveText}>Zapisz produkt</Text>
        </TouchableOpacity>
      </View>
    </View>
  );
}

const makeIe = (c: any) => StyleSheet.create({
  wrap: {
    marginTop: spacing[2], padding: spacing[3],
    backgroundColor: c.bg.elevated,
    borderRadius: radius.lg, gap: spacing[3],
    borderWidth: 1, borderColor: c.border.default,
  },
  nameInput: {
    fontSize: 14, fontWeight: '600', color: c.text.primary,
    backgroundColor: c.bg.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  row: { flexDirection: 'row', gap: spacing[3] },
  field: { flex: 1, gap: 4 },
  fieldLabel: { fontSize: 9, fontWeight: '700', color: c.text.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  fieldInput: {
    fontSize: 15, fontWeight: '700', color: c.text.primary,
    backgroundColor: c.bg.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  sectionLabel: { fontSize: 9, fontWeight: '700', color: c.text.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  catChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2], paddingVertical: 5,
    backgroundColor: c.bg.card, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
  },
  catChipText: { fontSize: 10, color: c.text.muted, fontWeight: '500' },
  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[1] },
  tagChip: {
    paddingHorizontal: spacing[2], paddingVertical: 4,
    backgroundColor: c.bg.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: c.border.default,
  },
  tagChipSel: { backgroundColor: c.accent.blue + '20', borderColor: c.accent.blue + '60' },
  tagChipText: { fontSize: 10, color: c.text.muted },
  tagChipTextSel: { color: c.accent.blue, fontWeight: '600' },
  actions: { flexDirection: 'row', gap: spacing[2], justifyContent: 'flex-end' },
  cancelBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
  },
  cancelText: { fontSize: 12, color: c.text.muted },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: c.text.primary, borderRadius: radius.md,
  },
  saveText: { fontSize: 12, fontWeight: '700', color: c.bg.primary },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function ExpenseDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { expenses, updateExpense, deleteExpense, setExpenses } = useExpensesStore();
  const expense = expenses.find(e => e.id === id);
  const colors = useColors();
  const s = useMemo(() => makeS(colors), [colors]);

  useEffect(() => {
    if (expenses.length === 0) {
      expensesService.getAll().then(setExpenses).catch(() => {});
    }
  }, []);
  useEffect(() => { getPayers().then(setPayers).catch(() => {}); }, []);

  const isInc = expense?.type === 'income';

  // Re-hydrate the editable state once the expense is actually available — e.g.
  // when this screen is opened (deep-linked / cold start) before the store has
  // finished loading, the useState initializers above run with `expense` still
  // undefined and capture empty values. Without this sync the receipt breakdown
  // would never appear and a save could wipe it. Guarded by `!editing` so it
  // never clobbers input while the user is mid-edit; re-runs after saves
  // (updatedAt changes) to keep the view in sync with persisted data.
  useEffect(() => {
    if (!expense || editing) return;
    const inc = expense.type === 'income';
    setAmount(expense.amount.toString());
    setNote(expense.note ?? '');
    setTxType(expense.type ?? 'expense');
    setExpCat((inc ? 'other' : expense.category ?? 'other') as ExpenseCategory);
    setIncCat((inc ? expense.category ?? 'salary' : 'salary') as IncomeCategory);
    setTags(expense.tags ?? []);
    setPayer(expense.payer ?? '');
    setPaymentMethod(expense.paymentMethod ?? 'card');
    setEditedItems(expense.receiptItems ?? []);
    const d = new Date(expense.date ?? Date.now());
    const p = (n: number) => String(n).padStart(2, '0');
    setDateInput(`${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [expense?.id, expense?.updatedAt]);

  const [editing, setEditing]   = useState(false);
  const [amount, setAmount]     = useState(expense?.amount.toString() ?? '');
  const [note, setNote]         = useState(expense?.note ?? '');
  const [txType, setTxType]     = useState<TransactionType>(expense?.type ?? 'expense');
  const [expCat, setExpCat]     = useState<ExpenseCategory>((isInc ? 'other' : expense?.category ?? 'other') as ExpenseCategory);
  const [incCat, setIncCat]     = useState<IncomeCategory>((isInc ? expense?.category ?? 'salary' : 'salary') as IncomeCategory);
  const [tags, setTags]         = useState<string[]>(expense?.tags ?? []);
  const [customTag, setCustomTag] = useState('');
  const [saving, setSaving]     = useState(false);
  const [payer, setPayer]       = useState<string>(expense?.payer ?? '');
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>(expense?.paymentMethod ?? 'card');
  const [payers, setPayers]     = useState<string[]>([]);
  const [addingPayer, setAddingPayer] = useState(false);
  const [newPayer, setNewPayer] = useState('');
  const [itemsExpanded, setItemsExpanded] = useState(true);
  const [editedItems, setEditedItems] = useState<ReceiptItem[]>(expense?.receiptItems ?? []);
  const [editingItemIdx, setEditingItemIdx] = useState<number | null>(null);
  const [dateInput, setDateInput] = useState(() => {
    const d = new Date(expense?.date ?? Date.now());
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
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

  // Gradient colors for amount hero
  const heroGradient: [string, string] = editIsIncome
    ? ['#1a3d2e', '#0f2a1e']   // deep green
    : ['#3d1a1a', '#2a0f0f'];  // deep red
  const heroAccent = editIsIncome ? '#34D399' : '#F87171';

  const toggleTag = (tag: string) =>
    setTags(prev => prev.includes(tag) ? prev.filter(t => t !== tag) : [...prev, tag]);

  const addCustomTag = () => {
    const t = customTag.trim().toLowerCase();
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setCustomTag('');
  };

  const handleItemSave = async (idx: number, updated: ReceiptItem) => {
    const orig = editedItems[idx];
    const next = editedItems.map((it, i) => i === idx ? updated : it);
    setEditedItems(next);
    setEditingItemIdx(null);

    // Persist the product edit IMMEDIATELY. The receipt list is tappable even
    // outside global edit mode, so a single-product change must stick on its own
    // without also requiring the header Save (the previous behaviour silently
    // dropped these edits).
    const oldSum = editedItems.reduce((sum, it) => sum + (it.price ?? 0), 0);
    const newSum = next.reduce((sum, it) => sum + (it.price ?? 0), 0);
    // Realign the receipt total only when it was actually tracking the item sum.
    // If they already diverge (per-item discounts, deposit, non-itemised lines),
    // leave the stored total alone so an edit never silently rewrites it.
    const totalTracksItems = Math.abs(expense.amount - oldSum) <= 0.05;
    const nextAmount = totalTracksItems ? Math.round(newSum * 100) / 100 : expense.amount;
    const itemUpdates = {
      receiptItems: next,
      amount: nextAmount,
      updatedAt: new Date().toISOString(),
    };
    updateExpense(id!, itemUpdates);
    setAmount(nextAmount.toString());
    expensesService.update(id!, itemUpdates)
      .then(() => toast.success('Zapisano produkt'))
      .catch(() => toast.error('Nie zapisano produktu'));

    // Save to shared product memory so future receipt scans auto-apply corrections
    const tagsChanged = JSON.stringify(orig.tags) !== JSON.stringify(updated.tags);
    const changed = orig.category !== updated.category || tagsChanged || orig.name !== updated.name;
    if (changed) {
      saveCustomProductsToMemory([{ name: updated.name, category: updated.category }]).catch(() => {});
      if (updated.tags.length > 0) {
        saveCustomTagsToMemory([{ name: updated.name, tags: updated.tags }]).catch(() => {});
      }
    }
    // Name changed → offer to apply the new name to EVERY product called the old
    // name (learns a canonical alias → all past & future entries group/show under
    // the new name in stats). "Tylko ten" just edits this line.
    if (orig.name.trim() && updated.name.trim() && orig.name.trim() !== updated.name.trim()) {
      Alert.alert(
        'Zmień nazwę',
        `Zastosować „${updated.name.trim()}" do wszystkich produktów „${orig.name.trim()}"?`,
        [
          { text: 'Tylko ten', style: 'cancel' },
          {
            text: 'Wszystkie', onPress: () => {
              saveNameAliases([{ name: orig.name }], { 0: updated.name.trim() }).catch(() => {});
              toast.success('Zastosowano do wszystkich');
            },
          },
        ],
      );
    }
  };

  const handleSave = async () => {
    const parsed = parseFloat(amount.replace(',', '.'));
    if (!parsed || isNaN(parsed) || parsed <= 0) {
      toast.error('Nieprawidłowa kwota');
      return;
    }
    setSaving(true);
    try {
      let dateParsed = expense.date;
      if (dateInput) {
        const [y, m, d] = dateInput.split('-').map(Number);
        const dt = new Date(y, m - 1, d, 12, 0, 0);
        if (!isNaN(dt.getTime())) dateParsed = dt.toISOString();
      }
      const updates = {
        type: txType,
        amount: parsed,
        note: note.trim(),
        category: editIsIncome ? incCat : expCat,
        tags,
        payer: payer || undefined,
        paymentMethod,
        date: dateParsed,
        receiptItems: editedItems,
        updatedAt: new Date().toISOString(),
      };
      updateExpense(id!, updates);
      await expensesService.update(id!, updates);
      haptic.success();
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
          haptic.medium();
          deleteExpense(id!);
          await expensesService.remove(id!).catch(() => {});
          toast.info('Usunięto');
          router.back();
        },
      },
    ]);
  };

  const displayAmt = editing ? amount : expense.amount.toFixed(2);

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
          {/* ── Amount hero — gradient tile ─────────────────────────────────── */}
          <LinearGradient colors={heroGradient} style={s.heroCard} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }}>
            {/* Store name if receipt */}
            {expense.storeName ? (
              <Text style={s.storeName}>{expense.storeName}</Text>
            ) : null}

            {/* Amount — number first, then zł */}
            {editing ? (
              <View style={s.amountEditRow}>
                <TextInput
                  value={amount}
                  onChangeText={setAmount}
                  style={[s.amountInput, { color: heroAccent }]}
                  keyboardType="decimal-pad"
                  autoFocus
                  placeholder="0,00"
                  placeholderTextColor={heroAccent + '60'}
                />
                <Text style={[s.currencyLabel, { color: heroAccent + 'AA' }]}>zł</Text>
              </View>
            ) : (
              <View style={s.amountRow}>
                <Text style={[s.amountDisplay, { color: heroAccent }]}>
                  {editIsIncome ? '+' : '-'}{expense.amount.toFixed(2)}
                </Text>
                <Text style={[s.currencyLabel, { color: heroAccent + 'AA' }]}>zł</Text>
              </View>
            )}

            {/* Date chip */}
            <View style={s.heroMeta}>
              <View style={[s.dateBadge, { borderColor: heroAccent + '30' }]}>
                <Calendar size={10} color={heroAccent + '90'} />
                <Text style={[s.dateBadgeText, { color: heroAccent + '90' }]}>
                  {new Date(expense.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short', year: 'numeric' })}
                </Text>
              </View>
            </View>

            {/* Note */}
            {editing ? (
              <TextInput
                value={note}
                onChangeText={setNote}
                style={s.noteInput}
                placeholder="Opis..."
                placeholderTextColor={'rgba(255,255,255,0.25)'}
                multiline
              />
            ) : (
              expense.note ? <Text style={s.noteText}>{expense.note}</Text> : null
            )}
          </LinearGradient>

          {/* ── Date picker (editing) ────────────────────────────────────────── */}
          {editing && (
            <View style={s.card}>
              <Text style={s.cardLabel}>Data</Text>
              <DatePickerField value={dateInput} onChange={setDateInput} placeholder="Data transakcji" />
            </View>
          )}

          {/* ── Receipt breakdown ────────────────────────────────────────────── */}
          {editedItems.length > 0 && (
            <View style={s.card}>
              <TouchableOpacity
                style={s.receiptHeader}
                onPress={() => setItemsExpanded(x => !x)}
                activeOpacity={0.7}
              >
                <ShoppingCart size={14} color={colors.accent.blue} />
                <Text style={[s.cardLabel, { color: colors.accent.blue, flex: 1 }]}>
                  PRODUKTY ({editedItems.length})
                </Text>
                {itemsExpanded
                  ? <ChevronUp size={14} color={colors.text.muted} />
                  : <ChevronDown size={14} color={colors.text.muted} />
                }
              </TouchableOpacity>
              {itemsExpanded && editedItems.map((it, idx) => {
                const meta = getCategoryMeta(it.category);
                const isEditing = editingItemIdx === idx;
                return (
                  <View key={idx}>
                    <TouchableOpacity
                      style={s.receiptItem}
                      onPress={() => setEditingItemIdx(isEditing ? null : idx)}
                      activeOpacity={0.7}
                    >
                      <View style={[s.itemCatDot, { backgroundColor: meta.color + '30', borderColor: meta.color + '60' }]}>
                        {(() => { const Icon = (LucideIcons as any)[meta.icon]; return Icon ? <Icon size={9} color={meta.color} /> : null; })()}
                      </View>
                      <View style={s.receiptItemLeft}>
                        <Text style={s.receiptItemName} numberOfLines={1}>{it.name}</Text>
                        <Text style={s.receiptItemMeta}>
                          {it.quantity !== 1 ? `${it.quantity} × ` : ''}{meta.label}
                          {it.discount ? ` · -${it.discount.toFixed(2)} zł` : ''}
                        </Text>
                        {it.tags?.length > 0 && (
                          <View style={s.itemTagsRow}>
                            {it.tags.map(tag => (
                              <View key={tag} style={s.itemTagBadge}>
                                <Text style={s.itemTagText}>{tag}</Text>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                      <View style={s.itemRight}>
                        <Text style={s.receiptItemPrice}>{it.price.toFixed(2)} zł</Text>
                        <Pencil size={11} color={isEditing ? colors.accent.blue : colors.text.muted} />
                      </View>
                    </TouchableOpacity>

                    {isEditing && (
                      <ItemEditor
                        item={it}
                        onSave={(updated) => handleItemSave(idx, updated)}
                        onCancel={() => setEditingItemIdx(null)}
                      />
                    )}
                  </View>
                );
              })}
            </View>
          )}

          {/* ── Type toggle (editing only) ───────────────────────────────────── */}
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

          {/* ── Category ─────────────────────────────────────────────────────── */}
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

          {/* ── Tags ─────────────────────────────────────────────────────────── */}
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

          {/* Who paid */}
          <View style={s.card}>
            <Text style={s.cardLabel}>{editIsIncome ? 'Kto otrzymał' : 'Kto zapłacił'}</Text>
            {editing ? (
              <View style={s.tagsWrap}>
                {payers.map(p => {
                  const active = payer === p;
                  return (
                    <PressableScale key={p} onPress={() => { haptic.tap(); setPayer(active ? '' : p); }} style={[s.payerChip, active && s.payerChipActive]}>
                      <Text style={[s.payerChipText, active && s.payerChipTextActive]}>{p}</Text>
                    </PressableScale>
                  );
                })}
                {addingPayer ? (
                  <TextInput
                    value={newPayer}
                    onChangeText={setNewPayer}
                    placeholder="Imię…"
                    placeholderTextColor={colors.text.muted}
                    style={s.payerInput}
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
                  <PressableScale onPress={() => { haptic.tap(); setAddingPayer(true); }} style={s.payerAddChip}>
                    <Text style={s.payerAddText}>+ osoba</Text>
                  </PressableScale>
                )}
              </View>
            ) : (
              <Text style={s.payerValue}>{payer || 'Nie określono'}</Text>
            )}

            <Text style={[s.cardLabel, { marginTop: spacing[3] }]}>Płatność</Text>
            {editing ? (
              <View style={s.tagsWrap}>
                {(['card', 'cash'] as const).map(m => {
                  const active = paymentMethod === m;
                  return (
                    <PressableScale key={m} onPress={() => { haptic.tap(); setPaymentMethod(m); }} style={[s.payerChip, active && s.payerChipActive]}>
                      <Text style={[s.payerChipText, active && s.payerChipTextActive]}>{m === 'card' ? 'Karta' : 'Gotówka'}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            ) : (
              <Text style={s.payerValue}>{paymentMethod === 'cash' ? 'Gotówka' : 'Karta'}</Text>
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

const makeS = (c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: { backgroundColor: c.text.primary, borderColor: c.text.primary },
  typePill: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, alignSelf: 'flex-start',
  },
  typePillText: { fontSize: 12, fontWeight: '600' },
  headerActions: { flexDirection: 'row', gap: spacing[2] },

  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },

  // ── Amount hero ────────────────────────────────────────────────────────────
  heroCard: {
    borderRadius: radius.xl, padding: spacing[5], gap: spacing[2],
    overflow: 'hidden',
  },
  storeName: {
    fontSize: 11, fontWeight: '600', color: 'rgba(255,255,255,0.35)',
    textTransform: 'uppercase', letterSpacing: 1,
  },
  amountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  amountEditRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  amountDisplay: { fontSize: 44, fontWeight: '800', letterSpacing: -2, lineHeight: 50 },
  amountInput: {
    fontSize: 44, fontWeight: '800', letterSpacing: -2,
    flex: 1, padding: 0, lineHeight: 50,
  },
  currencyLabel: { fontSize: 20, fontWeight: '300', lineHeight: 50 },
  heroMeta: { flexDirection: 'row', marginTop: 2 },
  dateBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2], paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
    backgroundColor: 'rgba(0,0,0,0.2)',
  },
  dateBadgeText: { fontSize: 10, fontWeight: '500' },
  noteText: { fontSize: 14, color: 'rgba(255,255,255,0.55)', lineHeight: 20, marginTop: 4 },
  noteInput: { fontSize: 14, color: 'rgba(255,255,255,0.65)', lineHeight: 20, marginTop: 4, padding: 0 },

  // ── Cards ──────────────────────────────────────────────────────────────────
  card: {
    backgroundColor: c.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: c.border.default,
    padding: spacing[4], gap: spacing[3],
  },
  cardLabel: {
    fontSize: 10, fontWeight: '600', color: c.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8,
  },

  typeToggle: {
    flexDirection: 'row', gap: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: c.border.default, padding: spacing[2],
  },
  typeBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: spacing[2], paddingVertical: spacing[2], borderRadius: radius.md,
  },
  typeBtnActive: { backgroundColor: c.text.primary },
  typeBtnText: { fontSize: 13, fontWeight: '600', color: c.text.muted },
  typeBtnTextActive: { color: c.bg.primary },

  catGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  catItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: c.bg.elevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
  },
  catIcon: {
    width: 24, height: 24, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.border.subtle,
  },
  catLabel: { fontSize: 12, fontWeight: '500', color: c.text.secondary },
  checkDot: {
    width: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
  },

  tagsWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  customTagRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  tagInput: {
    flex: 1, fontSize: 14, color: c.text.primary,
    backgroundColor: c.bg.elevated, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  addTagBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: c.bg.elevated, borderWidth: 1,
    borderColor: c.border.default, alignItems: 'center', justifyContent: 'center',
  },
  tagBadge: {
    paddingHorizontal: spacing[3], paddingVertical: 5,
    backgroundColor: c.bg.elevated, borderRadius: radius.full,
    borderWidth: 1, borderColor: c.border.default,
  },
  tagBadgeText: { fontSize: 12, color: c.text.secondary, fontWeight: '500' },
  emptyTags: { fontSize: 13, color: c.text.muted },

  payerChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    backgroundColor: c.bg.elevated, borderRadius: radius.full,
    borderWidth: 1, borderColor: c.border.default,
  },
  payerChipActive: { backgroundColor: c.accent.blue + '20', borderColor: c.accent.blue },
  payerChipText: { fontSize: 13, fontWeight: '600', color: c.text.muted },
  payerChipTextActive: { color: c.accent.blue },
  payerInput: {
    minWidth: 90, fontSize: 13, color: c.text.primary,
    backgroundColor: c.bg.elevated, borderRadius: radius.full,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  payerAddChip: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default,
    borderStyle: 'dashed',
  },
  payerAddText: { fontSize: 13, fontWeight: '600', color: c.text.secondary },
  payerValue: { fontSize: 14, color: c.text.primary, fontWeight: '500' },

  dateRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dateTxt: { fontSize: 14, color: c.text.secondary },

  meta: { fontSize: 11, color: c.text.muted, paddingHorizontal: spacing[1], lineHeight: 18 },

  // ── Receipt items ──────────────────────────────────────────────────────────
  receiptHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  receiptItem: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2],
    borderTopWidth: 1, borderTopColor: c.border.subtle,
  },
  itemCatDot: {
    width: 22, height: 22, borderRadius: 11,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  receiptItemLeft: { flex: 1, gap: 2 },
  receiptItemName: { fontSize: 13, fontWeight: '500', color: c.text.primary },
  receiptItemMeta: { fontSize: 10, color: c.text.muted },
  itemRight: { alignItems: 'flex-end', gap: 3 },
  receiptItemPrice: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  itemTagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 3 },
  itemTagBadge: {
    paddingHorizontal: 6, paddingVertical: 2,
    backgroundColor: c.accent.blue + '18', borderRadius: radius.full,
    borderWidth: 1, borderColor: c.accent.blue + '30',
  },
  itemTagText: { fontSize: 9, color: c.accent.blue, fontWeight: '600' },

  deleteBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[4], borderRadius: radius.xl,
    borderWidth: 1, borderColor: c.accent.red + '40',
    backgroundColor: c.accent.red + '0E',
  },
  deleteBtnText: { fontSize: 14, fontWeight: '600', color: c.accent.red },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  notFoundText: { color: c.text.secondary, fontSize: 16 },
});
