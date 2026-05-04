import { useState, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, Alert, ActivityIndicator } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, Camera, Image as ImageIcon, Check, Tag } from 'lucide-react-native';
import * as ImagePicker from 'expo-image-picker';

import PressableScale from '@/components/ui/PressableScale';
import AnimatedButton from '@/components/ui/AnimatedButton';
import { parseReceiptText, ParsedReceipt, ReceiptProduct } from '@/utils/receiptParser';
import { extractTextFromImage } from '@/services/ocrService';
import { expensesService } from '@/services/expensesService';
import { useExpensesStore } from '@/store/expensesStore';
import { getCategoryMeta, CATEGORY_META } from '@/utils/categories';
import { ExpenseCategory } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import * as LucideIcons from 'lucide-react-native';

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortMode = 'order' | 'category' | 'price';

const SORT_OPTS: { mode: SortMode; label: string }[] = [
  { mode: 'order',    label: 'Paragon'   },
  { mode: 'category', label: 'Kategoria' },
  { mode: 'price',    label: 'Cena ↓'   },
];

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function ScanReceiptModal() {
  const [receipt, setReceipt]       = useState<ParsedReceipt | null>(null);
  const [selected, setSelected]     = useState<Set<number>>(new Set());
  const [saving, setSaving]         = useState(false);
  const [scanning, setScanning]     = useState(false);
  const [sortMode, setSortMode]     = useState<SortMode>('order');
  const [editedCats, setEditedCats] = useState<Record<number, ExpenseCategory>>({});
  const [catPickerFor, setCatPickerFor] = useState<number | null>(null);
  const addExpense = useExpensesStore(s => s.addExpense);

  const getCategory = (i: number): ExpenseCategory =>
    editedCats[i] ?? (receipt?.products[i].category ?? 'other');

  // ── Camera / gallery ────────────────────────────────────────────────────────

  const pickCamera = async () => {
    const { status } = await ImagePicker.requestCameraPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Brak uprawnień', 'Potrzebuję dostępu do aparatu'); return; }
    const result = await ImagePicker.launchCameraAsync({ quality: 0.85, base64: false });
    if (!result.canceled) processImage(result.assets[0].uri);
  };

  const pickGallery = async () => {
    const { status } = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (status !== 'granted') { Alert.alert('Brak uprawnień', 'Potrzebuję dostępu do galerii'); return; }
    const result = await ImagePicker.launchImageLibraryAsync({ quality: 0.85, base64: false });
    if (!result.canceled) processImage(result.assets[0].uri);
  };

  const processImage = async (uri: string) => {
    setScanning(true);
    try {
      const text   = await extractTextFromImage(uri);
      const parsed = parseReceiptText(text);
      if (parsed.products.length === 0) {
        Alert.alert('Brak produktów', 'Nie udało się rozpoznać produktów. Spróbuj wyraźniejsze zdjęcie.');
        return;
      }
      setReceipt(parsed);
      setSelected(new Set(parsed.products.map((_, i) => i)));
      setEditedCats({});
      setCatPickerFor(null);
    } catch (e: any) {
      Alert.alert('Błąd skanowania', e.message);
    } finally {
      setScanning(false);
    }
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
    if (!receipt || selected.size === 0) return;
    setSaving(true);
    try {
      const now = new Date().toISOString();
      for (const i of selected) {
        const p   = receipt.products[i];
        const cat = getCategory(i);
        const expense = await expensesService.add({
          type: 'expense',
          amount: p.finalPrice,
          currency: 'PLN',
          category: cat,
          tags: [
            ...(p.promotion ? [p.promotion] : []),
            receipt.storeName ? receipt.storeName.toLowerCase().split(' ')[0] : '',
          ].filter(Boolean),
          note: p.name + (p.quantity > 1 ? ` (${p.quantity} szt.)` : ''),
          date: now,
        });
        addExpense(expense);
      }
      router.back();
    } catch (e: any) {
      Alert.alert('Błąd', e.message);
    } finally {
      setSaving(false);
    }
  };

  const resetScan = () => {
    setReceipt(null);
    setSelected(new Set());
    setEditedCats({});
    setCatPickerFor(null);
    setSortMode('order');
  };

  // ── Render ────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.closeBtn}>
          <X size={20} color={colors.text.secondary} />
        </PressableScale>
        <Text style={styles.title}>Skanuj paragon</Text>
        {receipt ? (
          <PressableScale onPress={resetScan} style={styles.closeBtn}>
            <X size={16} color={colors.text.muted} />
          </PressableScale>
        ) : (
          <View style={{ width: 36 }} />
        )}
      </View>

      {!receipt ? (
        <View style={styles.scanArea}>
          {scanning ? (
            <View style={styles.scanningState}>
              <View style={styles.scanFrame}>
                <View style={[styles.scanCorner, styles.cornerTL]} />
                <View style={[styles.scanCorner, styles.cornerTR]} />
                <View style={[styles.scanCorner, styles.cornerBL]} />
                <View style={[styles.scanCorner, styles.cornerBR]} />
                <ActivityIndicator size="large" color={colors.text.secondary} />
              </View>
              <Text style={styles.scanningText}>Analizuję paragon...</Text>
              <Text style={styles.scanningHint}>Rozpoznaję produkty i ceny</Text>
            </View>
          ) : (
            <>
              <View style={styles.viewfinder}>
                <View style={[styles.scanCorner, styles.cornerTL]} />
                <View style={[styles.scanCorner, styles.cornerTR]} />
                <View style={[styles.scanCorner, styles.cornerBL]} />
                <View style={[styles.scanCorner, styles.cornerBR]} />
                <Camera size={40} color={colors.text.muted} />
              </View>
              <Text style={styles.scanTitle}>Zrób zdjęcie paragonu</Text>
              <Text style={styles.scanSub}>
                Rozpoznam produkty, ceny i promocje (1+1, %, rabaty)
              </Text>
              <View style={styles.btnRow}>
                <AnimatedButton
                  onPress={pickCamera}
                  label="Aparat"
                  icon={<Camera size={18} color={colors.bg.primary} />}
                  size="lg"
                  style={{ flex: 1 }}
                />
                <AnimatedButton
                  onPress={pickGallery}
                  label="Galeria"
                  icon={<ImageIcon size={18} color={colors.text.secondary} />}
                  variant="ghost"
                  size="lg"
                  style={{ flex: 1 }}
                />
              </View>
            </>
          )}
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
                        onCategoryPress={() => setCatPickerFor(catPickerFor === i ? null : i)}
                        onCategoryChange={c => changeCategory(i, c)}
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
                  onCategoryPress={() => setCatPickerFor(catPickerFor === i ? null : i)}
                  onCategoryChange={c => changeCategory(i, c)}
                />
              ))
            )}
          </ScrollView>

          <View style={styles.footer}>
            <AnimatedButton
              onPress={saveSelected}
              label={saving ? 'Zapisuję...' : `Dodaj ${selected.size} produktów`}
              icon={<Check size={18} color={colors.bg.primary} />}
              size="lg"
              fullWidth
              disabled={saving || selected.size === 0}
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
}: {
  product: ReceiptProduct;
  category: ExpenseCategory;
  selected: boolean;
  onToggle: () => void;
  catPickerOpen: boolean;
  onCategoryPress: () => void;
  onCategoryChange: (cat: ExpenseCategory) => void;
}) {
  const meta    = getCategoryMeta(category);
  const IconComp = (LucideIcons as any)[meta.icon];

  return (
    <View style={styles.productWrap}>
      <PressableScale
        onPress={onToggle}
        style={[styles.productRow, selected && styles.productRowSelected]}
      >
        <View style={[styles.checkbox, selected && styles.checkboxDone]}>
          {selected && <Check size={12} color={colors.bg.primary} />}
        </View>

        {/* Category icon */}
        <View style={styles.catIconWrap}>
          {IconComp && <IconComp size={16} color={colors.text.muted} />}
        </View>

        {/* Product info */}
        <View style={styles.productInfo}>
          <Text style={styles.productName} numberOfLines={1}>{product.name}</Text>
          <View style={styles.productMeta}>
            {/* Tappable category chip */}
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

        {/* Price */}
        <View style={styles.priceCol}>
          {product.discount != null && product.discount > 0 && (
            <Text style={styles.originalPrice}>
              {(product.finalPrice + product.discount).toFixed(2)} zł
            </Text>
          )}
          <Text style={styles.price}>{product.finalPrice.toFixed(2)} zł</Text>
        </View>
      </PressableScale>

      {/* Inline category picker */}
      {catPickerOpen && (
        <CategoryPicker current={category} onSelect={onCategoryChange} />
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

  // ── Scan area ──────────────────────────────────────────────────────────────
  scanArea: {
    flex: 1, alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[8], gap: spacing[5],
  },
  viewfinder: {
    width: 180, height: 220, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.lg,
  },
  scanFrame: {
    width: 180, height: 220, alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.lg,
  },
  scanCorner: {
    position: 'absolute', width: 22, height: 22,
    borderColor: colors.text.secondary, borderWidth: 3,
  },
  cornerTL: { top: 10, left: 10, borderBottomWidth: 0, borderRightWidth: 0, borderTopLeftRadius: 6 },
  cornerTR: { top: 10, right: 10, borderBottomWidth: 0, borderLeftWidth: 0, borderTopRightRadius: 6 },
  cornerBL: { bottom: 10, left: 10, borderTopWidth: 0, borderRightWidth: 0, borderBottomLeftRadius: 6 },
  cornerBR: { bottom: 10, right: 10, borderTopWidth: 0, borderLeftWidth: 0, borderBottomRightRadius: 6 },
  scanTitle: { ...typography.h3, color: colors.text.primary, textAlign: 'center' },
  scanSub: { ...typography.body, color: colors.text.secondary, textAlign: 'center', lineHeight: 22 },
  scanningState: { alignItems: 'center', gap: spacing[4] },
  scanningText: { ...typography.body, color: colors.text.primary, fontWeight: '600' },
  scanningHint: { ...typography.caption, color: colors.text.muted },
  btnRow: { flexDirection: 'row', gap: spacing[3], width: '100%' },

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
  footer: { padding: spacing[4], borderTopWidth: 1, borderTopColor: colors.border.subtle },
});
