import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, Check, Tag, PenLine, Plus, Trash2 } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import AnimatedButton from '@/components/ui/AnimatedButton';
import DatePickerField from '@/components/ui/DatePickerField';
import { parseReceiptText, ParsedReceipt, ReceiptProduct, getFoodTags } from '@/utils/receiptParser';
import { expensesService } from '@/services/expensesService';
import { useExpensesStore } from '@/store/expensesStore';
import { getCategoryMeta, CATEGORY_META } from '@/utils/categories';
import { loadProductMemory, applyProductMemory, saveProductCategories, saveCustomProductsToMemory } from '@/utils/productMemory';
import { ExpenseCategory, ReceiptItem } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import * as LucideIcons from 'lucide-react-native';

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortMode = 'order' | 'category' | 'price';

const SORT_OPTS: { mode: SortMode; label: string }[] = [
  { mode: 'order',    label: 'Paragon'   },
  { mode: 'category', label: 'Kategoria' },
  { mode: 'price',    label: 'Cena ↓'   },
];

function todayIso() {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScanReceiptModal() {
  const [receipt, setReceipt]       = useState<ParsedReceipt | null>(null);
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [saving, setSaving]         = useState(false);
  const [sortMode, setSortMode]     = useState<SortMode>('order');
  const [editedCats, setEditedCats]   = useState<Record<number, ExpenseCategory>>({});
  const [editedPrices, setEditedPrices] = useState<Record<number, string>>({});
  const [editedNames, setEditedNames] = useState<Record<number, string>>({});
  const [catPickerFor, setCatPickerFor] = useState<number | null>(null);
  const [customProducts, setCustomProducts] = useState<{ name: string; price: string; category: ExpenseCategory }[]>([]);
  const [customCatPickerFor, setCustomCatPickerFor] = useState<number | null>(null);
  const [pastedText, setPastedText] = useState('');
  const [dateInput, setDateInput]   = useState(todayIso);
  const addExpense = useExpensesStore(s => s.addExpense);

  const getCategory = (i: number): ExpenseCategory =>
    editedCats[i] ?? (receipt?.products[i].category ?? 'other');

  const getPrice = (i: number): number => {
    const edited = editedPrices[i];
    if (edited !== undefined) {
      const parsed = parseFloat(edited.replace(',', '.'));
      return isNaN(parsed) ? (receipt?.products[i].finalPrice ?? 0) : parsed;
    }
    return receipt?.products[i].finalPrice ?? 0;
  };

  const getProductName = (i: number): string =>
    editedNames[i] ?? (receipt?.products[i].name ?? '');

  const addCustomProduct = () => {
    setCustomProducts(prev => [...prev, { name: '', price: '0.00', category: 'groceries' }]);
    setCustomCatPickerFor(null);
    setCatPickerFor(null);
  };

  const removeCustomProduct = (idx: number) => {
    setCustomProducts(prev => prev.filter((_, i) => i !== idx));
    if (customCatPickerFor === idx) setCustomCatPickerFor(null);
  };

  const processText = () => {
    const text = pastedText.trim();
    if (!text) { Alert.alert('Brak tekstu', 'Wklej tekst paragonu'); return; }
    const parsed = parseReceiptText(text);
    if (parsed.products.length === 0) {
      Alert.alert('Brak produktów', 'Nie udało się rozpoznać produktów. Sprawdź format tekstu — musi zawierać linie z cenami (np. "1 * 7,99 7,99 C").');
      return;
    }
    applyParsedReceipt(parsed);
  };

  const applyParsedReceipt = async (parsed: ParsedReceipt) => {
    setReceipt(parsed);
    setSelected(new Set(parsed.products.map((_, i) => i)));
    setCatPickerFor(null);
    setEditedPrices({});
    setEditedNames({});
    setCustomProducts([]);
    setCustomCatPickerFor(null);
    if (parsed.date) setDateInput(parsed.date);
    const memory = await loadProductMemory();
    const remembered = await applyProductMemory(parsed.products, memory);
    setEditedCats(remembered);
  };

  // ── Selection ────────────────────────────────────────────────────────────────

  const toggleProduct = (i: number) => {
    setSelected(prev => {
      const next = new Set(prev);
      next.has(i) ? next.delete(i) : next.add(i);
      return next;
    });
  };

  const toggleAll = () => {
    if (!receipt) return;
    setSelected(selected.size === receipt.products.length
      ? new Set()
      : new Set(receipt.products.map((_, i) => i))
    );
  };

  // ── Category editing ─────────────────────────────────────────────────────────

  const changeCategory = (i: number, cat: ExpenseCategory) => {
    setEditedCats(prev => ({ ...prev, [i]: cat }));
    setCatPickerFor(null);
  };

  // ── Sorted/grouped products ───────────────────────────────────────────────────

  const displayItems = useMemo(() => {
    if (!receipt) return [];
    const items = receipt.products.map((p, i) => ({ p, i }));
    switch (sortMode) {
      case 'price':
        return [...items].sort((a, b) => b.p.finalPrice - a.p.finalPrice);
      case 'category':
        return [...items].sort((a, b) =>
          (editedCats[a.i] ?? a.p.category).localeCompare(editedCats[b.i] ?? b.p.category)
        );
      default:
        return items;
    }
  }, [receipt, sortMode, editedCats]);

  const groups = useMemo(() => {
    if (sortMode !== 'category' || !receipt) return null;
    const map = new Map<ExpenseCategory, { p: ReceiptProduct; i: number }[]>();
    for (const item of displayItems) {
      const cat = editedCats[item.i] ?? item.p.category;
      if (!map.has(cat)) map.set(cat, []);
      map.get(cat)!.push(item);
    }
    return Array.from(map.entries());
  }, [displayItems, sortMode, editedCats]);

  // ── Save ──────────────────────────────────────────────────────────────────────

  const saveSelected = async () => {
    const validCustom = customProducts.filter(p => p.name.trim());
    if (!receipt || (selected.size === 0 && validCustom.length === 0)) return;
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

      const parsedItems: ReceiptItem[] = Array.from(selected).map(i => {
        const p = receipt.products[i];
        const finalPrice = getPrice(i);
        const name = getProductName(i);
        const item: ReceiptItem = {
          name,
          price: finalPrice,
          category: getCategory(i),
          quantity: p.quantity,
          unitPrice: p.unitPrice,
          tags: getFoodTags(name),
        };
        if (p.discount != null) item.discount = p.discount;
        return item;
      });

      const customItems: ReceiptItem[] = validCustom.map(p => {
        const price = parseFloat(p.price.replace(',', '.')) || 0;
        return {
          name: p.name.trim(),
          price,
          category: p.category,
          quantity: 1,
          unitPrice: price,
          tags: getFoodTags(p.name),
        };
      });

      const receiptItems = [...parsedItems, ...customItems];
      const total = receiptItems.reduce((s, it) => s + it.price, 0);

      const catAmts = new Map<ExpenseCategory, number>();
      for (const it of receiptItems) catAmts.set(it.category, (catAmts.get(it.category) ?? 0) + it.price);
      const dominantCat = [...catAmts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? 'groceries';

      const storeTag = receipt.storeName?.toLowerCase().split(' ')[0];
      const foodTags = [...new Set(receiptItems.flatMap(it => it.tags))];
      const tags = [storeTag, ...foodTags].filter(Boolean) as string[];

      const expense = await expensesService.add({
        type: 'expense',
        amount: Math.round(total * 100) / 100,
        currency: 'PLN',
        category: dominantCat,
        tags,
        note: receipt.storeName || 'Paragon',
        date: dateParsed,
        ...(receipt.storeName ? { storeName: receipt.storeName } : {}),
        receiptItems,
      });
      addExpense(expense);
      // Persist corrections to memory for future receipts
      const parsedCats: Record<number, ExpenseCategory> = {};
      receipt.products.forEach((p, i) => { parsedCats[i] = p.category; });
      saveProductCategories(receipt.products, editedCats, parsedCats, editedNames).catch(() => {});
      if (validCustom.length > 0) {
        saveCustomProductsToMemory(validCustom.map(p => ({ name: p.name.trim(), category: p.category }))).catch(() => {});
      }
      router.back();
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Błąd', e.message);
    }
  };

  const resetScan = () => {
    setReceipt(null);
    setSelected(new Set());
    setEditedCats({});
    setEditedPrices({});
    setEditedNames({});
    setCatPickerFor(null);
    setCustomProducts([]);
    setCustomCatPickerFor(null);
    setSortMode('order');
    setPastedText('');
    setDateInput(todayIso());
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.closeBtn}>
          <X size={20} color={colors.text.secondary} />
        </PressableScale>
        <Text style={styles.title}>Wklej paragon</Text>
        {receipt ? (
          <PressableScale onPress={resetScan} style={styles.closeBtn}>
            <X size={16} color={colors.text.muted} />
          </PressableScale>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {!receipt ? (
        <View style={{ flex: 1, padding: spacing[4], gap: spacing[3] }}>
          <TextInput
            style={styles.pasteInput}
            multiline
            value={pastedText}
            onChangeText={setPastedText}
            placeholder={'Wklej tu cały tekst paragonu z aplikacji Lidl, Biedronka itp.\n\nNp.:\nPolędwica z kurczaka\n      1 * 9.99 9.99 C\n   Lidl Plus voucher  -1,00\nJaja ściółkowe M\n      1 * 10.49 10.49 C'}
            placeholderTextColor={colors.text.muted}
            textAlignVertical="top"
            autoFocus
          />
          <AnimatedButton
            onPress={processText}
            label="Analizuj paragon"
            icon={<Check size={18} color={colors.bg.primary} />}
            size="lg"
            fullWidth
            disabled={!pastedText.trim()}
          />
          <PressableScale onPress={() => router.push('/expenses/manual' as any)} style={styles.manualBtn}>
            <PenLine size={14} color={colors.text.secondary} />
            <Text style={styles.manualBtnText}>Wpisz ręcznie produkty</Text>
          </PressableScale>
        </View>
      ) : (
        <>
          {/* Receipt summary */}
          <View style={styles.receiptMeta}>
            {receipt.storeName && <Text style={styles.storeName}>{receipt.storeName}</Text>}
            <View style={styles.metaRow}>
              {receipt.totalDiscount > 0 && (
                <View style={styles.discountBadge}>
                  <Text style={styles.discountText}>
                    Zaoszczędzono {receipt.totalDiscount.toFixed(2)} zł
                  </Text>
                </View>
              )}
              <Text style={styles.total}>Razem: {receipt.total.toFixed(2)} zł</Text>
            </View>
            {(() => {
              const diff = Math.abs(receipt.subtotal - receipt.total);
              if (receipt.total > 0 && receipt.subtotal > 0 && diff > 0.05) {
                const over = receipt.subtotal > receipt.total;
                return (
                  <View style={styles.mismatchBadge}>
                    <Text style={styles.mismatchText}>
                      {over
                        ? `Suma produktów (${receipt.subtotal.toFixed(2)} zł) > kwota na paragonie — brakuje rabatów lub produktów`
                        : `Suma produktów (${receipt.subtotal.toFixed(2)} zł) < kwota na paragonie — mogły zostać pominięte pozycje`
                      }
                    </Text>
                  </View>
                );
              }
              return null;
            })()}
          </View>

          {/* Sort bar */}
          <View style={styles.sortBar}>
            {SORT_OPTS.map(({ mode, label }) => (
              <PressableScale
                key={mode}
                onPress={() => { setSortMode(mode); setCatPickerFor(null); }}
              >
                <View style={[styles.sortPill, sortMode === mode && styles.sortPillActive]}>
                  <Text style={[styles.sortText, sortMode === mode && styles.sortTextActive]}>
                    {label}
                  </Text>
                </View>
              </PressableScale>
            ))}
            <View style={{ flex: 1 }} />
            <PressableScale onPress={toggleAll}>
              <View style={styles.toggleAllBtn}>
                <Text style={styles.toggleAllText}>
                  {selected.size === receipt.products.length ? 'Odznacz' : 'Zaznacz'} wszystko
                </Text>
              </View>
            </PressableScale>
          </View>

          {/* Product list */}
          <ScrollView
            style={{ flex: 1 }}
            contentContainerStyle={styles.productList}
            showsVerticalScrollIndicator={false}
          >
            <Text style={styles.sectionLabel}>
              Wybierz co dodać ({selected.size} z {receipt.products.length})
              {customProducts.length > 0 ? ` + ${customProducts.filter(p => p.name.trim()).length} ręcznych` : ''}
            </Text>

            {groups ? (
              groups.map(([cat, items]) => {
                const meta      = getCategoryMeta(cat);
                const CatIcon   = (LucideIcons as any)[meta.icon];
                const catTotal  = items.reduce((s, { p }) => s + p.finalPrice, 0);
                const catSel    = items.filter(({ i }) => selected.has(i)).length;
                return (
                  <View key={cat}>
                    <View style={styles.groupHeader}>
                      <View style={[styles.groupIconWrap, { backgroundColor: meta.color + '22' }]}>
                        {CatIcon && <CatIcon size={11} color={meta.color} />}
                      </View>
                      <Text style={[styles.groupName, { color: meta.color }]}>{meta.label}</Text>
                      <Text style={styles.groupCount}>{catSel}/{items.length}</Text>
                      <View style={{ flex: 1 }} />
                      <Text style={styles.groupTotal}>{catTotal.toFixed(2)} zł</Text>
                    </View>
                    {items.map(({ p, i }) => (
                      <ProductRow
                        key={i}
                        product={p}
                        category={getCategory(i)}
                        selected={selected.has(i)}
                        onToggle={() => toggleProduct(i)}
                        catPickerOpen={catPickerFor === i}
                        onCategoryPress={() => { setCatPickerFor(catPickerFor === i ? null : i); setCustomCatPickerFor(null); }}
                        onCategoryChange={c => changeCategory(i, c)}
                        priceValue={editedPrices[i] !== undefined ? editedPrices[i] : p.finalPrice.toFixed(2)}
                        onPriceChange={v => setEditedPrices(prev => ({ ...prev, [i]: v }))}
                        productName={getProductName(i)}
                        onNameChange={v => setEditedNames(prev => ({ ...prev, [i]: v }))}
                      />
                    ))}
                  </View>
                );
              })
            ) : (
              displayItems.map(({ p, i }) => (
                <ProductRow
                  key={i}
                  product={p}
                  category={getCategory(i)}
                  selected={selected.has(i)}
                  onToggle={() => toggleProduct(i)}
                  catPickerOpen={catPickerFor === i}
                  onCategoryPress={() => { setCatPickerFor(catPickerFor === i ? null : i); setCustomCatPickerFor(null); }}
                  onCategoryChange={c => changeCategory(i, c)}
                  priceValue={editedPrices[i] !== undefined ? editedPrices[i] : p.finalPrice.toFixed(2)}
                  onPriceChange={v => setEditedPrices(prev => ({ ...prev, [i]: v }))}
                  productName={getProductName(i)}
                  onNameChange={v => setEditedNames(prev => ({ ...prev, [i]: v }))}
                />
              ))
            )}

            {/* Custom (manually added) products */}
            {customProducts.length > 0 && (
              <Text style={[styles.sectionLabel, { marginTop: spacing[3] }]}>
                Dodane ręcznie ({customProducts.filter(p => p.name.trim()).length})
              </Text>
            )}
            {customProducts.map((cp, idx) => (
              <CustomProductRow
                key={`custom-${idx}`}
                product={cp}
                onRemove={() => removeCustomProduct(idx)}
                onNameChange={v => setCustomProducts(prev => prev.map((p, i) => i === idx ? { ...p, name: v } : p))}
                onPriceChange={v => setCustomProducts(prev => prev.map((p, i) => i === idx ? { ...p, price: v } : p))}
                onCategoryChange={c => {
                  setCustomProducts(prev => prev.map((p, i) => i === idx ? { ...p, category: c } : p));
                  setCustomCatPickerFor(null);
                }}
                catPickerOpen={customCatPickerFor === idx}
                onCategoryPress={() => { setCustomCatPickerFor(customCatPickerFor === idx ? null : idx); setCatPickerFor(null); }}
              />
            ))}

            {/* Add product button */}
            <PressableScale onPress={addCustomProduct} style={styles.addProductBtn}>
              <Plus size={14} color={colors.accent.green} />
              <Text style={styles.addProductBtnText}>Dodaj produkt ręcznie</Text>
            </PressableScale>
          </ScrollView>

          <View style={styles.footer}>
            <DatePickerField value={dateInput} onChange={setDateInput} placeholder="Data paragonu" />
            <AnimatedButton
              onPress={saveSelected}
              label={saving ? 'Zapisuję...' : `Zapisz paragon (${selected.size + customProducts.filter(p => p.name.trim()).length} poz.)`}
              icon={<Check size={18} color={colors.bg.primary} />}
              size="lg"
              fullWidth
              disabled={saving || (selected.size === 0 && customProducts.filter(p => p.name.trim()).length === 0)}
            />
          </View>
        </>
      )}
    </SafeAreaView>
  );
}

// ─── Category picker ──────────────────────────────────────────────────────────

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
    >
      {ALL_CATS.map(([cat, meta]) => {
        const IconComp = (LucideIcons as any)[meta.icon];
        const active   = cat === current;
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

// ─── ProductRow ───────────────────────────────────────────────────────────────

function ProductRow({
  product, category, selected, onToggle,
  catPickerOpen, onCategoryPress, onCategoryChange,
  priceValue, onPriceChange, productName, onNameChange,
}: {
  product: ReceiptProduct;
  category: ExpenseCategory;
  selected: boolean;
  onToggle: () => void;
  catPickerOpen: boolean;
  onCategoryPress: () => void;
  onCategoryChange: (cat: ExpenseCategory) => void;
  priceValue: string;
  onPriceChange: (v: string) => void;
  productName: string;
  onNameChange: (v: string) => void;
}) {
  const meta    = getCategoryMeta(category);
  const IconComp = (LucideIcons as any)[meta.icon];

  return (
    <View style={styles.productWrap}>
      <View style={[styles.productRow, selected && styles.productRowSelected]}>
        <PressableScale onPress={onToggle} style={[styles.checkbox, selected && styles.checkboxDone]}>
          {selected && <Check size={12} color={colors.bg.primary} />}
        </PressableScale>

        {/* Category icon */}
        <View style={styles.catIconWrap}>
          {IconComp && <IconComp size={16} color={colors.text.muted} />}
        </View>

        {/* Product info */}
        <View style={styles.productInfo}>
          <TextInput
            value={productName}
            onChangeText={onNameChange}
            style={styles.productNameInput}
            placeholder={product.name}
            placeholderTextColor={colors.text.muted}
          />
          <View style={styles.productMeta}>
            <PressableScale onPress={onCategoryPress}>
              <View style={[
                styles.catChip,
                catPickerOpen && { borderColor: meta.color, backgroundColor: meta.color + '20' },
              ]}>
                <Text style={[styles.catChipText, catPickerOpen && { color: meta.color }]}>
                  {meta.label}
                </Text>
              </View>
            </PressableScale>
            {product.quantity > 1 && (
              <Text style={styles.productMetaText}>· {product.quantity} szt.</Text>
            )}
            {product.promotion && (
              <View style={styles.promoBadge}>
                <Tag size={9} color={colors.accent.success} />
                <Text style={styles.promoText}>{product.promotion}</Text>
              </View>
            )}
          </View>
        </View>

        {/* Editable price */}
        <View style={styles.priceCol}>
          {product.discount != null && product.discount > 0 && (
            <Text style={styles.originalPrice}>
              {(product.finalPrice + product.discount).toFixed(2)} zł
            </Text>
          )}
          <View style={styles.priceInputWrap}>
            <TextInput
              value={priceValue}
              onChangeText={onPriceChange}
              style={styles.priceInput}
              keyboardType="decimal-pad"
              selectTextOnFocus
            />
            <Text style={styles.priceCur}>zł</Text>
          </View>
        </View>
      </View>

      {/* Inline category picker */}
      {catPickerOpen && (
        <CategoryPicker current={category} onSelect={onCategoryChange} />
      )}
    </View>
  );
}

// ─── CustomProductRow ─────────────────────────────────────────────────────────

function CustomProductRow({
  product, onRemove, onNameChange, onPriceChange, onCategoryChange,
  catPickerOpen, onCategoryPress,
}: {
  product: { name: string; price: string; category: ExpenseCategory };
  onRemove: () => void;
  onNameChange: (name: string) => void;
  onPriceChange: (price: string) => void;
  onCategoryChange: (cat: ExpenseCategory) => void;
  catPickerOpen: boolean;
  onCategoryPress: () => void;
}) {
  const meta     = getCategoryMeta(product.category);
  const IconComp = (LucideIcons as any)[meta.icon];

  return (
    <View style={styles.productWrap}>
      <View style={[styles.productRow, styles.customRow]}>
        {/* Delete */}
        <PressableScale onPress={onRemove} style={styles.deleteCustomBtn}>
          <Trash2 size={13} color={colors.accent.red} />
        </PressableScale>

        {/* Category icon */}
        <View style={[styles.catIconWrap, { backgroundColor: meta.color + '18' }]}>
          {IconComp && <IconComp size={16} color={meta.color} />}
        </View>

        {/* Name + category chip */}
        <View style={styles.productInfo}>
          <TextInput
            value={product.name}
            onChangeText={onNameChange}
            style={[styles.productNameInput, { color: colors.text.primary }]}
            placeholder="Nazwa produktu..."
            placeholderTextColor={colors.text.muted}
            autoFocus={product.name === ''}
          />
          <PressableScale onPress={onCategoryPress}>
            <View style={[styles.catChip, { borderColor: meta.color + '60', backgroundColor: meta.color + '14' }]}>
              <Text style={[styles.catChipText, { color: meta.color }]}>{meta.label}</Text>
            </View>
          </PressableScale>
        </View>

        {/* Editable price */}
        <View style={styles.priceInputWrap}>
          <TextInput
            value={product.price}
            onChangeText={onPriceChange}
            style={styles.priceInput}
            keyboardType="decimal-pad"
            selectTextOnFocus
          />
          <Text style={styles.priceCur}>zł</Text>
        </View>
      </View>

      {catPickerOpen && (
        <CategoryPicker current={product.category} onSelect={onCategoryChange} />
      )}
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

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
  title: { ...typography.h4, color: colors.text.primary },

  // ── Text paste input ────────────────────────────────────────────────────────
  pasteInput: {
    flex: 1,
    backgroundColor: colors.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[4], color: colors.text.primary,
    fontSize: 12, lineHeight: 18,
    fontFamily: 'monospace',
  },

  manualBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
  },
  manualBtnText: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },

  // ── Receipt meta ───────────────────────────────────────────────────────────
  receiptMeta: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle, gap: spacing[2],
  },
  storeName: { ...typography.h4, color: colors.text.primary },
  metaRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  discountBadge: {
    backgroundColor: colors.accent.success + '22',
    paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.sm,
  },
  discountText: { ...typography.caption, color: colors.accent.success, fontWeight: '600' },
  total: { ...typography.label, color: colors.text.primary, fontWeight: '700' },
  mismatchBadge: {
    backgroundColor: colors.accent.warning + '18',
    borderRadius: radius.sm,
    paddingHorizontal: spacing[2], paddingVertical: 4,
    borderLeftWidth: 2, borderLeftColor: colors.accent.warning,
  },
  mismatchText: { fontSize: 10, color: colors.accent.warning, fontWeight: '500', lineHeight: 15 },

  // ── Sort bar ───────────────────────────────────────────────────────────────
  sortBar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.04)',
  },
  sortPill: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
  },
  sortPillActive: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
  sortText: { fontSize: 11, fontWeight: '600', color: colors.text.muted },
  sortTextActive: { color: colors.text.inverse },
  toggleAllBtn: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  toggleAllText: { fontSize: 10, fontWeight: '500', color: colors.text.muted },

  // ── Product list ───────────────────────────────────────────────────────────
  productList: { padding: spacing[4], gap: spacing[2], paddingBottom: 100 },
  sectionLabel: {
    ...typography.caption, color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: spacing[1],
  },

  // ── Category group header ──────────────────────────────────────────────────
  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2], paddingHorizontal: spacing[1],
    marginTop: spacing[2],
  },
  groupIconWrap: {
    width: 22, height: 22, borderRadius: 6,
    alignItems: 'center', justifyContent: 'center',
  },
  groupName: { fontSize: 11, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.6 },
  groupCount: { fontSize: 10, color: colors.text.muted, marginLeft: 2 },
  groupTotal: { fontSize: 12, fontWeight: '700', color: colors.text.primary },

  // ── Product row ────────────────────────────────────────────────────────────
  productWrap: { marginBottom: spacing[2] },
  productRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    padding: spacing[3], backgroundColor: colors.bg.card,
    borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.subtle,
  },
  productRowSelected: { borderColor: 'rgba(255,255,255,0.25)', backgroundColor: 'rgba(255,255,255,0.04)' },
  checkbox: {
    width: 20, height: 20, borderRadius: 5, borderWidth: 2,
    borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center',
  },
  checkboxDone: { backgroundColor: colors.text.primary, borderColor: colors.text.primary },
  catIconWrap: {
    width: 32, height: 32, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  productInfo: { flex: 1, gap: 4 },
  productName: { ...typography.bodySmall, color: colors.text.primary, fontWeight: '500' },
  productMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  productMetaText: { ...typography.caption, color: colors.text.muted },

  catChip: {
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.05)',
  },
  catChipText: { fontSize: 10, color: colors.text.muted, fontWeight: '600' },

  promoBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accent.success + '22',
    paddingHorizontal: 5, paddingVertical: 2, borderRadius: 4,
  },
  promoText: { ...typography.caption, color: colors.accent.success, fontWeight: '600', fontSize: 10 },

  priceCol: { alignItems: 'flex-end', gap: 1 },
  originalPrice: { ...typography.caption, color: colors.text.muted, textDecorationLine: 'line-through' },
  price: { ...typography.label, fontWeight: '700', color: colors.text.primary },
  priceInputWrap: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  priceInput: {
    fontSize: 13, fontWeight: '700', color: colors.text.primary,
    minWidth: 44, textAlign: 'right', paddingVertical: 0,
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.15)',
  },
  priceCur: { fontSize: 11, color: colors.text.muted, fontWeight: '500' },

  // ── Category picker ────────────────────────────────────────────────────────
  pickerScroll: {
    backgroundColor: colors.bg.elevated,
    borderBottomLeftRadius: radius.md,
    borderBottomRightRadius: radius.md,
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

  // ── Footer ─────────────────────────────────────────────────────────────────
  footer: { padding: spacing[4], gap: spacing[2], borderTopWidth: 1, borderTopColor: colors.border.subtle },

  // ── Editable product name ─────────────────────────────────────────────────
  productNameInput: {
    fontSize: 13, fontWeight: '500', color: colors.text.primary,
    padding: 0, flex: 1,
  },

  // ── Custom product row ────────────────────────────────────────────────────
  customRow: {
    borderColor: colors.accent.green + '30',
    backgroundColor: colors.accent.green + '06',
  },
  deleteCustomBtn: {
    width: 28, height: 28, borderRadius: radius.sm,
    backgroundColor: colors.accent.red + '15', borderWidth: 1, borderColor: colors.accent.red + '30',
    alignItems: 'center', justifyContent: 'center',
  },

  // ── Add product button ────────────────────────────────────────────────────
  addProductBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.md,
    borderWidth: 1, borderColor: colors.accent.green + '40', borderStyle: 'dashed',
    backgroundColor: colors.accent.green + '08', marginTop: spacing[1],
  },
  addProductBtnText: { fontSize: 13, fontWeight: '600', color: colors.accent.green },
});
