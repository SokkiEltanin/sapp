import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, Plus, Trash2, Check, ShoppingCart } from 'lucide-react-native';
import * as LucideIcons from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import AnimatedButton from '@/components/ui/AnimatedButton';
import DatePickerField from '@/components/ui/DatePickerField';
import { expensesService } from '@/services/expensesService';
import { useExpensesStore } from '@/store/expensesStore';
import { getCategoryMeta, CATEGORY_META } from '@/utils/categories';
import { getBudgets } from '@/utils/budgets';
import { getFoodTags } from '@/utils/receiptParser';
import { toast } from '@/store/toastStore';
import { ExpenseCategory, ReceiptItem } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';

interface Item {
  id: string;
  name: string;
  price: string;
  category: ExpenseCategory;
}

const ALL_CATS = Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][];

function CategoryPicker({ current, onSelect }: {
  current: ExpenseCategory;
  onSelect: (cat: ExpenseCategory) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={styles.pickerScroll}
      contentContainerStyle={styles.pickerRow}
      keyboardShouldPersistTaps="always"
    >
      {ALL_CATS.map(([cat, meta]) => {
        const IconComp = (LucideIcons as any)[meta.icon];
        const active = cat === current;
        return (
          <PressableScale
            key={cat}
            onPress={() => onSelect(cat)}
            style={[styles.pickerItem, active && { borderColor: meta.color, backgroundColor: meta.color + '18' }]}
          >
            {IconComp && <IconComp size={13} color={active ? meta.color : colors.text.muted} />}
            <Text style={[styles.pickerLabel, active && { color: meta.color }]}>{meta.label}</Text>
          </PressableScale>
        );
      })}
    </ScrollView>
  );
}

function ItemRow({ item, index, onUpdate, onDelete }: {
  item: Item;
  index: number;
  onUpdate: (updates: Partial<Item>) => void;
  onDelete: () => void;
}) {
  const [catOpen, setCatOpen] = useState(false);
  const meta = getCategoryMeta(item.category);

  return (
    <View style={styles.itemWrap}>
      <View style={styles.itemRow}>
        <View style={styles.itemNumWrap}>
          <Text style={styles.itemNum}>{index + 1}</Text>
        </View>

        <View style={styles.itemFields}>
          <TextInput
            value={item.name}
            onChangeText={name => onUpdate({ name })}
            placeholder="Nazwa produktu"
            placeholderTextColor={colors.text.muted}
            style={styles.nameInput}
            returnKeyType="next"
          />
          <View style={styles.itemBottom}>
            <PressableScale
              onPress={() => setCatOpen(o => !o)}
              style={[styles.catChip, catOpen && { borderColor: meta.color, backgroundColor: meta.color + '18' }]}
            >
              <Text style={[styles.catChipText, catOpen && { color: meta.color }]}>{meta.label}</Text>
            </PressableScale>
            <TextInput
              value={item.price}
              onChangeText={price => onUpdate({ price })}
              placeholder="0,00"
              placeholderTextColor={colors.text.muted}
              style={styles.priceInput}
              keyboardType="decimal-pad"
              returnKeyType="done"
            />
            <Text style={styles.priceSuffix}>zł</Text>
          </View>
        </View>

        <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
          <Trash2 size={15} color='rgba(255,255,255,0.2)' />
        </TouchableOpacity>
      </View>

      {catOpen && (
        <CategoryPicker
          current={item.category}
          onSelect={cat => { onUpdate({ category: cat }); setCatOpen(false); }}
        />
      )}
    </View>
  );
}

export default function ManualReceiptScreen() {
  const [storeName, setStoreName] = useState('');
  const [items, setItems] = useState<Item[]>([makeItem()]);
  const [saving, setSaving] = useState(false);
  const [dateInput, setDateInput] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  const { addExpense, expenses } = useExpensesStore();

  function makeItem(): Item {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: '',
      price: '',
      category: 'groceries',
    };
  }

  const addItem = () => {
    setItems(prev => [...prev, makeItem()]);
  };

  const updateItem = (id: string, updates: Partial<Item>) => {
    setItems(prev => prev.map(it => it.id === id ? { ...it, ...updates } : it));
  };

  const deleteItem = (id: string) => {
    setItems(prev => {
      if (prev.length === 1) return prev.map(it => it.id === id ? makeItem() : it);
      return prev.filter(it => it.id !== id);
    });
  };

  const validItems = items.filter(it => it.name.trim() && parseFloat(it.price.replace(',', '.')) > 0);
  const total = validItems.reduce((s, it) => s + parseFloat(it.price.replace(',', '.')), 0);

  const save = async () => {
    if (validItems.length === 0) {
      Alert.alert('Brak produktów', 'Dodaj co najmniej jeden produkt z ceną.');
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
      const store = storeName.trim();

      const receiptItems: ReceiptItem[] = validItems.map(it => {
        const price = parseFloat(it.price.replace(',', '.'));
        return { name: it.name.trim(), price, category: it.category, quantity: 1, unitPrice: price, tags: getFoodTags(it.name) };
      });

      const totalAmount = receiptItems.reduce((s, it) => s + it.price, 0);

      // Dominant category by amount
      const catAmts = new Map<ExpenseCategory, number>();
      for (const it of receiptItems) catAmts.set(it.category, (catAmts.get(it.category) ?? 0) + it.price);
      const dominantCat = [...catAmts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'groceries';

      const storeTag = store ? store.toLowerCase().split(' ')[0] : undefined;
      const foodTags = [...new Set(receiptItems.flatMap(it => it.tags))];
      const tags = [storeTag, ...foodTags].filter(Boolean) as string[];

      const expense = await expensesService.add({
        type: 'expense',
        amount: Math.round(totalAmount * 100) / 100,
        currency: 'PLN',
        category: dominantCat,
        tags,
        note: store || 'Paragon ręczny',
        date: dateParsed,
        storeName: store || undefined,
        receiptItems,
      });
      addExpense(expense);

      // Budget alerts per category
      const budgets = await getBudgets();
      const nowM = dateParsed.slice(0, 7);
      for (const [cat, addedAmt] of catAmts) {
        const limit = budgets[cat];
        if (!limit || limit <= 0) continue;
        const prevSpent = expenses
          .filter(e => (!e.type || e.type === 'expense') && e.category === cat && e.date.startsWith(nowM))
          .reduce((s, e) => s + e.amount, 0);
        const monthSpent = prevSpent + addedAmt;
        const pct = monthSpent / limit;
        if (pct >= 1) {
          toast.error(`Budżet "${CATEGORY_META[cat]?.label}" przekroczony! ${monthSpent.toFixed(0)}/${limit} zł`);
        } else if (pct >= 0.85) {
          toast.info(`Uwaga: ${Math.round(pct * 100)}% budżetu "${CATEGORY_META[cat]?.label}" wykorzystane`);
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
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.closeBtn}>
          <X size={20} color={colors.text.secondary} />
        </PressableScale>
        <View style={styles.headerCenter}>
          <Text style={styles.title}>Ręczny paragon</Text>
          {validItems.length > 0 && (
            <Text style={styles.subtitle}>{validItems.length} produktów · {total.toFixed(2)} zł</Text>
          )}
        </View>
        <View style={{ width: 36 }} />
      </View>

      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ScrollView
          contentContainerStyle={styles.scroll}
          showsVerticalScrollIndicator={false}
          keyboardShouldPersistTaps="handled"
        >
          {/* Store name */}
          <View style={styles.storeWrap}>
            <ShoppingCart size={14} color={colors.text.muted} />
            <TextInput
              value={storeName}
              onChangeText={setStoreName}
              placeholder="Nazwa sklepu (opcjonalnie)"
              placeholderTextColor={colors.text.muted}
              style={styles.storeInput}
              returnKeyType="next"
            />
          </View>

          {/* Date */}
          <DatePickerField
            value={dateInput}
            onChange={setDateInput}
            placeholder="Data zakupu"
          />

          {/* Items */}
          <View style={styles.itemsLabel}>
            <Text style={styles.labelText}>PRODUKTY</Text>
            <Text style={styles.labelCount}>{validItems.length} z {items.length}</Text>
          </View>

          {items.map((item, i) => (
            <ItemRow
              key={item.id}
              item={item}
              index={i}
              onUpdate={u => updateItem(item.id, u)}
              onDelete={() => deleteItem(item.id)}
            />
          ))}

          <TouchableOpacity onPress={addItem} style={styles.addItemBtn} activeOpacity={0.7}>
            <Plus size={14} color={colors.accent.blue} />
            <Text style={styles.addItemText}>Dodaj produkt</Text>
          </TouchableOpacity>

          <View style={{ height: 120 }} />
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={styles.footer}>
        {total > 0 && (
          <View style={styles.totalRow}>
            <Text style={styles.totalLabel}>Razem</Text>
            <Text style={styles.totalAmount}>{total.toFixed(2)} zł</Text>
          </View>
        )}
        <AnimatedButton
          onPress={save}
          label={saving ? 'Zapisuję...' : `Zapisz paragon${validItems.length > 0 ? ` (${validItems.length} poz.)` : ''}`}
          icon={<Check size={18} color={colors.bg.primary} />}
          size="lg"
          fullWidth
          disabled={saving || validItems.length === 0}
        />
      </View>
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
  headerCenter: { alignItems: 'center' },
  title: { ...typography.h4, color: colors.text.primary },
  subtitle: { ...typography.caption, color: colors.text.muted, marginTop: 2 },

  scroll: { padding: spacing[4], gap: spacing[3] },

  storeWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  storeInput: { flex: 1, fontSize: 15, color: colors.text.primary, paddingVertical: 0 },

  itemsLabel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
  },
  labelText: { fontSize: 10, fontWeight: '700', color: colors.text.muted, letterSpacing: 1, textTransform: 'uppercase' },
  labelCount: { fontSize: 10, color: colors.text.muted },

  itemWrap: { gap: 0 },
  itemRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[3],
  },
  itemNumWrap: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },
  itemNum: { fontSize: 10, fontWeight: '700', color: colors.text.muted },
  itemFields: { flex: 1, gap: spacing[2] },
  nameInput: { fontSize: 14, color: colors.text.primary, paddingVertical: 0 },
  itemBottom: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  catChip: {
    paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.sm,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  catChipText: { fontSize: 10, color: colors.text.muted, fontWeight: '600' },
  priceInput: {
    flex: 1, fontSize: 15, fontWeight: '700', color: colors.text.primary,
    textAlign: 'right', paddingVertical: 0,
  },
  priceSuffix: { fontSize: 12, color: colors.text.muted, fontWeight: '500' },
  deleteBtn: {
    width: 28, height: 28, alignItems: 'center', justifyContent: 'center', marginTop: 2,
  },

  pickerScroll: {
    backgroundColor: colors.bg.elevated,
    borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md,
    borderWidth: 1, borderTopWidth: 0, borderColor: 'rgba(255,255,255,0.1)',
  },
  pickerRow: {
    flexDirection: 'row', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pickerLabel: { fontSize: 11, fontWeight: '600', color: colors.text.muted },

  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.accent.blue + '30',
    borderStyle: 'dashed',
    backgroundColor: colors.accent.blue + '08',
  },
  addItemText: { fontSize: 13, fontWeight: '600', color: colors.accent.blue },

  footer: {
    padding: spacing[4], gap: spacing[2],
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
    backgroundColor: colors.bg.secondary,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[1] },
  totalLabel: { ...typography.label, color: colors.text.secondary },
  totalAmount: { fontSize: 20, fontWeight: '800', color: colors.text.primary },
});
