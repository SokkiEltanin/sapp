import { useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, KeyboardAvoidingView, Platform,
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
import { getFoodTags, categorize } from '@/utils/receiptParser';
import { toast } from '@/store/toastStore';
import { ExpenseCategory, ReceiptItem } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

interface Item {
  id: string;
  name: string;
  price: string;
  quantity: string;
  category: ExpenseCategory;
  tags: string[];
}

const ALL_CATS = Object.entries(CATEGORY_META) as [ExpenseCategory, typeof CATEGORY_META[ExpenseCategory]][];
const ITEM_TAGS = ['słodycze', 'nabiał', 'mięso', 'warzywa', 'owoce', 'pieczywo', 'napoje', 'chemia'];

function CategoryPicker({ current, onSelect }: {
  current: ExpenseCategory;
  onSelect: (cat: ExpenseCategory) => void;
}) {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
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
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [catOpen, setCatOpen] = useState(false);
  const [tagsOpen, setTagsOpen] = useState(false);
  const [newTag, setNewTag] = useState('');
  const [suggCat, setSuggCat] = useState<ExpenseCategory | null>(null);
  const suggTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const meta = getCategoryMeta(item.category);
  const qty = parseFloat(item.quantity) || 1;
  const unitPrice = parseFloat(item.price.replace(',', '.')) || 0;
  const lineTotal = qty * unitPrice;

  const handleNameChange = (name: string) => {
    onUpdate({ name });
    if (suggTimer.current) clearTimeout(suggTimer.current);
    if (name.trim().length < 3) { setSuggCat(null); return; }
    suggTimer.current = setTimeout(() => {
      const cat = categorize(name);
      setSuggCat(cat !== item.category ? cat : null);
    }, 300);
  };

  const applySugg = () => {
    if (!suggCat) return;
    const foodTags = getFoodTags(item.name);
    onUpdate({
      category: suggCat,
      tags: item.tags.length === 0 && foodTags.length > 0 ? foodTags : item.tags,
    });
    setSuggCat(null);
  };

  const toggleTag = (tag: string) => {
    const next = item.tags.includes(tag)
      ? item.tags.filter(t => t !== tag)
      : [...item.tags, tag];
    onUpdate({ tags: next });
  };

  return (
    <View style={styles.itemWrap}>
      <View style={styles.itemCard}>
        {/* Name row */}
        <View style={styles.nameRow}>
          <View style={styles.itemNumWrap}>
            <Text style={styles.itemNum}>{index + 1}</Text>
          </View>
          <TextInput
            value={item.name}
            onChangeText={handleNameChange}
            placeholder="Nazwa produktu"
            placeholderTextColor={colors.text.muted}
            style={styles.nameInput}
            returnKeyType="next"
          />
          <TouchableOpacity onPress={onDelete} style={styles.deleteBtn} hitSlop={8}>
            <Trash2 size={15} color={colors.text.muted} />
          </TouchableOpacity>
        </View>

        {suggCat && (
          <TouchableOpacity onPress={applySugg} style={styles.catSugg} activeOpacity={0.75}>
            <Text style={styles.catSuggText}>
              Może być: {getCategoryMeta(suggCat).label} — zastosuj
            </Text>
          </TouchableOpacity>
        )}

        {/* Qty × price row */}
        <View style={styles.priceRow}>
          <View style={styles.qtyWrap}>
            <TouchableOpacity
              onPress={() => onUpdate({ quantity: String(Math.max(1, Math.round((parseFloat(item.quantity) || 1) - 1))) })}
              style={styles.qtyStep} hitSlop={6}
            >
              <Text style={styles.qtyStepText}>−</Text>
            </TouchableOpacity>
            <TextInput
              value={item.quantity}
              onChangeText={quantity => onUpdate({ quantity })}
              placeholder="1"
              placeholderTextColor={colors.text.muted}
              style={styles.qtyInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            <TouchableOpacity
              onPress={() => onUpdate({ quantity: String(Math.round((parseFloat(item.quantity) || 0) + 1)) })}
              style={styles.qtyStep} hitSlop={6}
            >
              <Text style={styles.qtyStepText}>+</Text>
            </TouchableOpacity>
          </View>
          <Text style={styles.timesSign}>×</Text>
          <TextInput
            value={item.price}
            onChangeText={price => onUpdate({ price })}
            placeholder="0,00"
            placeholderTextColor={colors.text.muted}
            style={styles.unitPriceInput}
            keyboardType="decimal-pad"
            returnKeyType="done"
            selectTextOnFocus
          />
          <Text style={styles.priceSuffix}>zł</Text>
          {qty > 1 && unitPrice > 0 && (
            <>
              <Text style={styles.eqSign}>=</Text>
              <Text style={styles.lineTotalText}>{lineTotal.toFixed(2)} zł</Text>
            </>
          )}
        </View>

        {/* Category & tags row */}
        <View style={styles.metaRow}>
          <PressableScale
            onPress={() => { setCatOpen(o => !o); setTagsOpen(false); }}
            style={[styles.catChip, catOpen && { borderColor: meta.color, backgroundColor: meta.color + '18' }]}
          >
            <Text style={[styles.catChipText, catOpen && { color: meta.color }]}>{meta.label}</Text>
          </PressableScale>
          <PressableScale
            onPress={() => { setTagsOpen(o => !o); setCatOpen(false); }}
            style={[
              styles.tagsToggleBtn,
              tagsOpen && styles.tagsToggleBtnActive,
              item.tags.length > 0 && styles.tagsToggleBtnFilled,
            ]}
          >
            {item.tags.length > 0
              ? <Text style={styles.tagsToggleText} numberOfLines={1}>{item.tags.join(' · ')}</Text>
              : <Text style={styles.tagsTogglePlaceholder}>+ tagi</Text>
            }
          </PressableScale>
        </View>
      </View>

      {catOpen && (
        <CategoryPicker
          current={item.category}
          onSelect={cat => { onUpdate({ category: cat }); setCatOpen(false); }}
        />
      )}

      {tagsOpen && (
        <View style={styles.tagPicker}>
          {/* custom tags already on the item but not in the preset list */}
          {item.tags.filter(t => !ITEM_TAGS.includes(t)).map(tag => (
            <PressableScale
              key={tag}
              onPress={() => toggleTag(tag)}
              style={[styles.tagPickerItem, styles.tagPickerItemActive]}
            >
              <Text style={[styles.tagPickerText, { color: colors.accent.blue }]}>{tag} ×</Text>
            </PressableScale>
          ))}
          {ITEM_TAGS.map(tag => {
            const active = item.tags.includes(tag);
            return (
              <PressableScale
                key={tag}
                onPress={() => toggleTag(tag)}
                style={[styles.tagPickerItem, active && styles.tagPickerItemActive]}
              >
                <Text style={[styles.tagPickerText, active && { color: colors.accent.blue }]}>{tag}</Text>
              </PressableScale>
            );
          })}
          {/* add a custom tag — handled everywhere else in the app (filters,
              tag budgets) because it lands in the item's tags array */}
          <View style={styles.customTagRow}>
            <TextInput
              value={newTag}
              onChangeText={setNewTag}
              placeholder="+ własny tag"
              placeholderTextColor={colors.text.muted}
              autoCapitalize="none"
              style={styles.customTagInput}
              returnKeyType="done"
              onSubmitEditing={() => {
                const t = newTag.trim().toLowerCase().replace(/\s+/g, '-');
                if (t && !item.tags.includes(t)) onUpdate({ tags: [...item.tags, t] });
                setNewTag('');
              }}
            />
          </View>
        </View>
      )}
    </View>
  );
}

export default function ManualReceiptScreen() {
  const colors = useColors();
  const styles = useMemo(() => makeStyles(colors), [colors]);
  const [storeName, setStoreName] = useState('');
  const [items, setItems] = useState<Item[]>([makeItem()]);
  const [saving, setSaving] = useState(false);
  const [dateInput, setDateInput] = useState(() => {
    const d = new Date();
    const p = (n: number) => String(n).padStart(2, '0');
    return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
  });
  const addExpense = useExpensesStore(s => s.addExpense);

  function makeItem(): Item {
    return {
      id: `${Date.now()}-${Math.random().toString(36).slice(2)}`,
      name: '',
      price: '',
      quantity: '1',
      category: 'groceries',
      tags: [],
    };
  }

  const addItem = () => setItems(prev => [...prev, makeItem()]);

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
  const total = validItems.reduce((s, it) => {
    const qty = Math.max(1, parseFloat(it.quantity) || 1);
    return s + parseFloat(it.price.replace(',', '.')) * qty;
  }, 0);

  const save = async () => {
    if (validItems.length === 0) {
      toast.error('Dodaj co najmniej jeden produkt z ceną');
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
        const unitPrice = parseFloat(it.price.replace(',', '.'));
        const qty = Math.max(1, parseFloat(it.quantity) || 1);
        const price = Math.round(unitPrice * qty * 100) / 100;
        const item: ReceiptItem = {
          name: it.name.trim(),
          price,
          category: it.category,
          quantity: qty,
          unitPrice,
          tags: it.tags.length > 0 ? it.tags : getFoodTags(it.name),
        };
        return item;
      });

      const totalAmount = receiptItems.reduce((s, it) => s + it.price, 0);

      const catAmts = new Map<ExpenseCategory, number>();
      for (const it of receiptItems) catAmts.set(it.category, (catAmts.get(it.category) ?? 0) + it.price);
      const dominantCat = [...catAmts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'groceries';

      const foodTags = [...new Set(receiptItems.flatMap(it => it.tags))];
      const tags: string[] = store
        ? [store.toLowerCase().split(' ')[0], ...foodTags]
        : foodTags;

      const expense = await expensesService.add({
        type: 'expense',
        amount: Math.round(totalAmount * 100) / 100,
        currency: 'PLN',
        category: dominantCat,
        tags,
        note: store || 'Paragon ręczny',
        date: dateParsed,
        ...(store ? { storeName: store } : {}),
        receiptItems,
      });

      addExpense(expense);
      haptic.success();
      toast.success(`Zapisano ${receiptItems.length} pozycji · ${totalAmount.toFixed(2)} zł`);
      router.back();

      // Budget alerts - non-blocking, fire after navigation
      getBudgets().then(budgets => {
        const nowM = dateParsed.slice(0, 7);
        const currentExpenses = useExpensesStore.getState().expenses;
        for (const [cat, addedAmt] of catAmts) {
          const limit = budgets[cat];
          if (!limit || limit <= 0) continue;
          const prevSpent = currentExpenses
            .filter(e => (!e.type || e.type === 'expense') && e.category === cat && e.date.startsWith(nowM))
            .reduce((s, e) => s + e.amount, 0);
          const pct = prevSpent / limit;
          if (pct >= 1) {
            toast.error(`Budżet "${CATEGORY_META[cat]?.label}" przekroczony!`);
          } else if (pct >= 0.85) {
            toast.info(`${Math.round(pct * 100)}% budżetu "${CATEGORY_META[cat]?.label}" wykorzystane`);
          }
        }
      }).catch(() => {});
    } catch (e: any) {
      setSaving(false);
      toast.error(e?.message ?? 'Błąd zapisu paragonu');
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PressableScale onPress={() => { haptic.tap(); router.back(); }} style={styles.closeBtn}>
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

          <DatePickerField
            value={dateInput}
            onChange={setDateInput}
            placeholder="Data zakupu"
          />

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
  headerCenter: { alignItems: 'center' },
  title: { ...typography.h4, color: c.text.primary },
  subtitle: { ...typography.caption, color: c.text.muted, marginTop: 2 },

  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[6] },

  storeWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: c.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  storeInput: { flex: 1, fontSize: 15, color: c.text.primary, paddingVertical: 0 },

  itemsLabel: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[1],
  },
  labelText: { fontSize: 10, fontWeight: '700', color: c.text.muted, letterSpacing: 1, textTransform: 'uppercase' },
  labelCount: { fontSize: 10, color: c.text.muted },

  // ── Item card ────────────────────────────────────────────────────────────────
  itemWrap: { gap: 0 },
  itemCard: {
    backgroundColor: c.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.border.default,
    padding: spacing[3], gap: spacing[2],
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  itemNumWrap: {
    width: 22, height: 22, borderRadius: 11,
    backgroundColor: c.border.subtle,
    alignItems: 'center', justifyContent: 'center', flexShrink: 0,
  },
  itemNum: { fontSize: 10, fontWeight: '700', color: c.text.muted },
  nameInput: { flex: 1, fontSize: 14, color: c.text.primary, paddingVertical: 0 },
  deleteBtn: { width: 28, height: 28, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },

  // qty × price row
  priceRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  qtyWrap: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: c.bg.elevated, borderRadius: radius.sm,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: 4, paddingVertical: 3,
  },
  qtyStep: {
    width: 26, height: 26, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.border.subtle,
  },
  qtyStepText: { fontSize: 18, fontWeight: '700', color: c.accent.blue, lineHeight: 20 },
  qtyLabel: { fontSize: 9, color: c.text.muted, fontWeight: '500' },
  qtyInput: {
    fontSize: 14, fontWeight: '700', color: c.text.primary,
    width: 34, textAlign: 'center', paddingVertical: 0,
  },
  timesSign: { fontSize: 13, color: c.text.muted },
  unitPriceInput: {
    flex: 1, fontSize: 16, fontWeight: '700', color: c.text.primary,
    textAlign: 'right', paddingVertical: 0,
  },
  priceSuffix: { fontSize: 12, color: c.text.muted, fontWeight: '500' },
  eqSign: { fontSize: 12, color: c.text.muted },
  lineTotalText: { fontSize: 13, fontWeight: '800', color: c.accent.green, letterSpacing: -0.3 },

  // category & tags row
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  catChip: {
    paddingHorizontal: spacing[2], paddingVertical: 5, borderRadius: radius.sm,
    borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.border.subtle,
  },
  catChipText: { fontSize: 10, color: c.text.muted, fontWeight: '600' },
  tagsToggleBtn: {
    flex: 1, paddingHorizontal: spacing[2], paddingVertical: 5,
    borderRadius: radius.sm, borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.border.subtle,
  },
  tagsToggleBtnActive: {
    borderColor: c.accent.blue + '60',
    backgroundColor: c.accent.blue + '0C',
  },
  tagsToggleBtnFilled: { borderColor: c.accent.blue + '40' },
  tagsToggleText: { fontSize: 10, color: c.accent.blue, fontWeight: '600' },
  tagsTogglePlaceholder: { fontSize: 10, color: c.text.muted },

  tagPicker: {
    flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2],
    backgroundColor: c.bg.elevated,
    borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md,
    borderWidth: 1, borderTopWidth: 0, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  tagPickerItem: {
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.md, borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.border.subtle,
  },
  tagPickerItemActive: {
    borderColor: c.accent.blue + '60',
    backgroundColor: c.accent.blue + '18',
  },
  tagPickerText: { fontSize: 11, fontWeight: '600', color: c.text.muted },
  customTagRow: { width: '100%', marginTop: 6 },
  customTagInput: {
    fontSize: 12, color: c.text.primary,
    backgroundColor: c.border.subtle, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: 10, paddingVertical: 6,
  },

  pickerScroll: {
    backgroundColor: c.bg.elevated,
    borderBottomLeftRadius: radius.md, borderBottomRightRadius: radius.md,
    borderWidth: 1, borderTopWidth: 0, borderColor: c.border.default,
  },
  pickerRow: {
    flexDirection: 'row', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  pickerItem: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    backgroundColor: c.border.subtle,
  },
  pickerLabel: { fontSize: 11, fontWeight: '600', color: c.text.muted },

  catSugg: {
    alignSelf: 'flex-start',
    paddingHorizontal: spacing[2], paddingVertical: 4,
    borderRadius: radius.sm,
    backgroundColor: c.accent.blue + '18',
    borderWidth: 1, borderColor: c.accent.blue + '40',
  },
  catSuggText: { fontSize: 10, fontWeight: '600', color: c.accent.blue },

  addItemBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.lg,
    borderWidth: 1, borderColor: c.accent.blue + '30',
    borderStyle: 'dashed',
    backgroundColor: c.accent.blue + '08',
  },
  addItemText: { fontSize: 13, fontWeight: '600', color: c.accent.blue },

  footer: {
    padding: spacing[4], gap: spacing[2],
    borderTopWidth: 1, borderTopColor: c.border.subtle,
    backgroundColor: c.bg.secondary,
  },
  totalRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', paddingHorizontal: spacing[1] },
  totalLabel: { ...typography.label, color: c.text.secondary },
  totalAmount: { fontSize: 20, fontWeight: '800', color: c.text.primary },
});
