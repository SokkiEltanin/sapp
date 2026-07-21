import { useState, useMemo, useCallback, useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Search, X } from 'lucide-react-native';

import { expensesService } from '@/services/expensesService';
import { Expense } from '@/types';
import { countsForConsumption } from '@/store/statsScope';
import {
  canonicalProductName, normalizeProductName, loadNameAliases,
  loadWeightMemory, saveWeightMemory, weightFor, WeightMemory,
  saveCustomProductsToMemory, saveCustomTagsToMemory, saveNameAliases,
  productNameSimilarity, removeNameAliases,
} from '@/utils/productMemory';
import { looksLikeFood } from '@/utils/calories';
import { ExpenseCategory } from '@/types';
import { getCategoryMeta } from '@/utils/categories';
import { GitMerge, Check, RotateCcw } from 'lucide-react-native';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius } from '@/theme';

type Product = { name: string; key: string; count: number; category: string; tags: string[] };

export default function ProductsScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [aliases, setAliases]   = useState<Record<string, string>>({});
  const [weightMem, setWeightMem] = useState<WeightMemory>({});
  const [query, setQuery]       = useState('');
  // Prefill search when arrived via /products?q=… (e.g. tapping a product in the
  // dashboard food-breakdown drill-down → jump straight to fixing it).
  const params = useLocalSearchParams<{ q?: string }>();
  useEffect(() => { if (typeof params.q === 'string' && params.q) setQuery(params.q); }, [params.q]);
  const [editing, setEditing]   = useState<Product | null>(null);
  const [editName, setEditName] = useState('');
  const [editWeightG, setEditWeightG] = useState('');
  const [editTags, setEditTags] = useState('');
  const [editCat, setEditCat]   = useState<ExpenseCategory>('groceries');
  // Pairs the user said are NOT the same — MUST persist, else the same pair keeps
  // reappearing every time you reopen the screen ("klikam że to nie to samo, nie zapisuje").
  const [dismissedDup, setDismissedDup] = useState<Set<string>>(new Set());
  const DUP_KEY = 'dismissed_dup_pairs_v1';
  useEffect(() => {
    AsyncStorage.getItem(DUP_KEY).then(raw => { if (raw) setDismissedDup(new Set(JSON.parse(raw))); }).catch(() => {});
  }, []);
  const dismissDup = useCallback((id: string) => {
    setDismissedDup(prev => {
      const next = new Set(prev).add(id);
      AsyncStorage.setItem(DUP_KEY, JSON.stringify([...next])).catch(() => {});
      return next;
    });
  }, []);
  const [dupOpen, setDupOpen] = useState(false);
  const [mergeHistory, setMergeHistory] = useState<{ loser: string; winner: string }[]>([]);

  const reload = useCallback(() => {
    expensesService.getAll().then(setExpenses).catch(() => {});
    loadNameAliases().then(setAliases).catch(() => {});
    loadWeightMemory().then(setWeightMem).catch(() => {});
  }, []);
  useFocusEffect(useCallback(() => { reload(); }, [reload]));

  // Distinct food products actually bought, canonicalised, most-bought first.
  const products = useMemo(() => {
    const map = new Map<string, Product>();
    for (const e of expenses) {
      if (e.type === 'income') continue;
      for (const it of e.receiptItems ?? []) {
        if (!countsForConsumption(it)) continue;
        if (!looksLikeFood({ name: it.name, tags: it.tags, category: it.category })) continue; // skip non-food
        const name = canonicalProductName(it.name, aliases);
        const key = normalizeProductName(name);
        const cur = map.get(key) ?? { name, key, count: 0, category: it.category, tags: it.tags ?? [] };
        cur.count += 1;
        map.set(key, cur);
      }
    }
    return [...map.values()].sort((a, b) => b.count - a.count);
  }, [expenses, aliases]);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return q ? products.filter(p => p.name.toLowerCase().includes(q)) : products;
  }, [products, query]);

  // Likely OCR duplicates: highly-similar product names that aren't yet merged
  // (e.g. "HAŁWA STOŁECZNA" ≈ "HAŁWA SŁONECZNA"). High band so we don't nag on
  // genuinely-different products; the user confirms each. Merge = alias loser→winner.
  const duplicatePairs = useMemo(() => {
    const out: { a: Product; b: Product; id: string }[] = [];
    for (let i = 0; i < products.length; i++) {
      for (let j = i + 1; j < products.length; j++) {
        const sim = productNameSimilarity(products[i].name, products[j].name);
        if (sim >= 0.62 && sim < 0.99) {
          // higher count is the "winner" the other folds into
          const [a, b] = products[i].count >= products[j].count ? [products[i], products[j]] : [products[j], products[i]];
          const id = [a.key, b.key].sort().join('|');   // order-stable so a dismissal sticks
          if (!dismissedDup.has(id)) out.push({ a, b, id });
        }
      }
    }
    return out.slice(0, 40);
  }, [products, dismissedDup]);

  const mergePair = async (a: Product, b: Product, id: string) => {
    haptic.success();
    try {
      await saveNameAliases([{ name: b.name }], { 0: a.name }); // b folds into a
      dismissDup(id);
      setMergeHistory(prev => [{ loser: b.name, winner: a.name }, ...prev].slice(0, 20));
      await loadNameAliases().then(setAliases);
      reload();
      toast.success(`Scalono „${b.name}" → „${a.name}"`);
    } catch { haptic.error(); toast.error('Nie udało się scalić'); }
  };

  // Undo the most recent merge — un-aliases the folded name so it splits back out.
  const undoMerge = async () => {
    const last = mergeHistory[0];
    if (!last) return;
    haptic.tap();
    try {
      await removeNameAliases([last.loser]);
      setMergeHistory(prev => prev.slice(1));
      await loadNameAliases().then(setAliases);
      reload();
      toast.success(`Cofnięto: „${last.loser}" znów osobno`);
    } catch { haptic.error(); toast.error('Nie udało się cofnąć'); }
  };


  const openEdit = (p: Product) => {
    haptic.tap();
    setEditName(p.name);
    const w = weightFor(p.name, weightMem);
    setEditWeightG(w ? String(Math.round(w * 1000)) : '');
    setEditTags((p.tags ?? []).join(', '));
    setEditCat((p.category as ExpenseCategory) || 'groceries');
    setEditing(p);
  };

  const saveEdit = async () => {
    if (!editing) return;
    haptic.success();
    const newName = editName.trim() || editing.name;
    const wG = parseFloat(editWeightG.replace(',', '.'));
    const tags = editTags.split(',').map(t => t.trim().toLowerCase()).filter(Boolean);
    try {
      // Rename → alias: the old name folds into the new one (a manual MERGE).
      if (newName.toLowerCase() !== editing.name.toLowerCase()) {
        await saveNameAliases([{ name: editing.name }], { 0: newName });
      }
      // Calories/macros live in the Jedzenie tab now (Moje produkty) — here we only do
      // matching/merging + weight/tags/category for receipt stats.
      if (!isNaN(wG) && wG > 0) await saveWeightMemory([{ name: newName, kg: wG / 1000 }]);
      await saveCustomProductsToMemory([{ name: newName, category: editCat }]);
      if (tags.length > 0) await saveCustomTagsToMemory([{ name: newName, tags }]);
      await Promise.all([
        loadWeightMemory().then(setWeightMem),
        loadNameAliases().then(setAliases),
      ]);
      setEditing(null);
      toast.success('Zapisano produkt');
    } catch { haptic.error(); toast.error('Nie udało się zapisać'); }
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableBack onPress={() => router.back()} color={c.text.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Produkty</Text>
          <Text style={s.subtitle}>{products.length} produktów · tagi, waga, scalanie duplikatów</Text>
        </View>
      </View>

      <View style={s.searchRow}>
        <Search size={15} color={c.text.muted} />
        <TextInput
          value={query}
          onChangeText={setQuery}
          placeholder="Szukaj produktu…"
          placeholderTextColor={c.text.muted}
          style={s.searchInput}
          autoCapitalize="none"
        />
      </View>

      <ScrollView contentContainerStyle={{ padding: spacing[4], paddingBottom: 120, gap: spacing[2] }} showsVerticalScrollIndicator={false}>
        {!query && (duplicatePairs.length > 0 || mergeHistory.length > 0) && (
          <TouchableOpacity style={s.dupBtn} activeOpacity={0.85} onPress={() => { haptic.tap(); setDupOpen(true); }}>
            <View style={[s.dupBtnIcon, { backgroundColor: '#46B0DE22' }]}><GitMerge size={16} color="#46B0DE" /></View>
            <View style={{ flex: 1 }}>
              <Text style={s.dupBtnTitle}>Duplikaty{duplicatePairs.length > 0 ? ` (${duplicatePairs.length})` : ''}</Text>
              <Text style={s.dupBtnSub}>{duplicatePairs.length > 0 ? 'Sprawdź i scal podobne produkty' : 'Brak — możesz cofnąć scalenia'}</Text>
            </View>
            <ChevronLeft size={16} color={c.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
          </TouchableOpacity>
        )}
        {filtered.length === 0 ? (
          <Text style={s.empty}>{products.length === 0 ? 'Brak produktów — zeskanuj paragony, by je tu zobaczyć.' : 'Nic nie pasuje.'}</Text>
        ) : filtered.map(p => (
            <TouchableOpacity key={p.key} style={s.row} activeOpacity={0.8} onPress={() => openEdit(p)}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.rowMeta} numberOfLines={1}>
                  ×{p.count}{p.tags.length > 0 ? ` · ${p.tags.slice(0, 3).join(', ')}` : ''}
                </Text>
              </View>
              <ChevronLeft size={15} color={c.text.muted} style={{ transform: [{ rotate: '180deg' }] }} />
            </TouchableOpacity>
        ))}
      </ScrollView>

      {/* kcal edit modal */}
      <Modal visible={!!editing} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(null)} />
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle} numberOfLines={1}>Edytuj produkt</Text>
              <TouchableOpacity onPress={() => setEditing(null)} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
            </View>
            <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 400 }}>
              <Text style={s.sheetLabel}>Nazwa  ·  zmiana = scalenie z istniejącym</Text>
              <TextInput value={editName} onChangeText={setEditName} placeholder="Nazwa produktu" placeholderTextColor={c.text.muted} style={s.fieldInput} />

              <Text style={s.sheetLabel}>Waga domyślna (g/szt, opcjonalnie)</Text>
              <TextInput value={editWeightG} onChangeText={setEditWeightG} keyboardType="number-pad" placeholder="np. 250" placeholderTextColor={c.text.muted} style={s.fieldInput} />

              <Text style={s.sheetLabel}>Tagi (przecinek)</Text>
              <TextInput value={editTags} onChangeText={setEditTags} placeholder="np. ser, nabiał" placeholderTextColor={c.text.muted} style={s.fieldInput} autoCapitalize="none" />

              <Text style={s.sheetLabel}>Kategoria</Text>
              <View style={s.catRow}>
                {(['groceries', 'health', 'entertainment', 'clothing', 'housing', 'other'] as ExpenseCategory[]).map(cat => {
                  const meta = getCategoryMeta(cat);
                  const active = editCat === cat;
                  return (
                    <TouchableOpacity key={cat} onPress={() => { haptic.tap(); setEditCat(cat); }} style={[s.catChip, active && { borderColor: meta.color, backgroundColor: meta.color + '22' }]}>
                      <Text style={[s.catChipText, active && { color: meta.color }]}>{meta.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </ScrollView>
            <TouchableOpacity style={s.saveBtn} onPress={saveEdit} activeOpacity={0.85}>
              <Text style={s.saveBtnText}>Zapisz</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Duplicates — one pair at a time: To samo / Różne, with undo */}
      <Modal visible={dupOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDupOpen(false)}>
        <View style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDupOpen(false)} />
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Duplikaty{duplicatePairs.length > 0 ? ` · zostało ${duplicatePairs.length}` : ''}</Text>
              <TouchableOpacity onPress={() => setDupOpen(false)} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
            </View>
            {duplicatePairs.length > 0 ? (() => {
              const { a, b, id } = duplicatePairs[0];
              return (
                <>
                  <Text style={s.dupQ}>To ten sam produkt?</Text>
                  <View style={s.dupPairCard}>
                    <View style={s.dupNameBox}><Text style={s.dupNameText} numberOfLines={2}>{a.name}</Text><Text style={s.dupCount}>×{a.count}</Text></View>
                    <Text style={s.dupVs}>≈</Text>
                    <View style={s.dupNameBox}><Text style={s.dupNameText} numberOfLines={2}>{b.name}</Text><Text style={s.dupCount}>×{b.count}</Text></View>
                  </View>
                  <Text style={s.dupHintModal}>Scalenie złączy „{b.name}" w „{a.name}".</Text>
                  <View style={s.dupActions}>
                    <TouchableOpacity style={[s.dupAct, { borderColor: c.accent.red + '66', backgroundColor: c.accent.red + '14' }]} onPress={() => { haptic.tap(); dismissDup(id); }} activeOpacity={0.85}>
                      <X size={20} color={c.accent.red} /><Text style={[s.dupActText, { color: c.accent.red }]}>Różne</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.dupAct, { borderColor: c.accent.green + '66', backgroundColor: c.accent.green + '18' }]} onPress={() => mergePair(a, b, id)} activeOpacity={0.85}>
                      <Check size={20} color={c.accent.green} /><Text style={[s.dupActText, { color: c.accent.green }]}>To samo</Text>
                    </TouchableOpacity>
                  </View>
                </>
              );
            })() : (
              <Text style={s.dupDone}>Wszystko sprawdzone ✓</Text>
            )}
            {mergeHistory.length > 0 && (
              <TouchableOpacity style={s.undoRow} onPress={undoMerge} activeOpacity={0.8}>
                <RotateCcw size={13} color={c.text.secondary} />
                <Text style={s.undoText} numberOfLines={1}>Cofnij: „{mergeHistory[0].loser}" → „{mergeHistory[0].winner}"</Text>
              </TouchableOpacity>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

function PressableBack({ onPress, color }: { onPress: () => void; color: string }) {
  return (
    <TouchableOpacity onPress={onPress} hitSlop={10} style={{ width: 36, height: 36, alignItems: 'center', justifyContent: 'center' }}>
      <ChevronLeft size={22} color={color} />
    </TouchableOpacity>
  );
}

const makeStyles = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[1], paddingHorizontal: spacing[3], paddingTop: spacing[2], paddingBottom: spacing[2] },
  title: { fontSize: 20, fontWeight: '800', color: c.text.primary },
  subtitle: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  searchRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], paddingHorizontal: spacing[3], paddingVertical: 9,
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
  },
  searchInput: { flex: 1, fontSize: 14, color: c.text.primary, padding: 0 },
  empty: { fontSize: 13, color: c.text.muted, textAlign: 'center', marginTop: spacing[6], lineHeight: 19 },
  dupBtn: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: '#46B0DE44', paddingHorizontal: spacing[3], paddingVertical: spacing[3] },
  dupBtnIcon: { width: 34, height: 34, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  dupBtnTitle: { fontSize: 14, fontWeight: '800', color: '#46B0DE' },
  dupBtnSub: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  dupQ: { fontSize: 13, fontWeight: '700', color: c.text.secondary, textAlign: 'center', marginTop: spacing[1] },
  dupPairCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[2] },
  dupNameBox: { flex: 1, backgroundColor: c.fill.subtle, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.subtle, padding: spacing[3], alignItems: 'center', gap: 3 },
  dupNameText: { fontSize: 13, fontWeight: '700', color: c.text.primary, textAlign: 'center' },
  dupCount: { fontSize: 11, color: c.text.muted, fontWeight: '600' },
  dupVs: { fontSize: 16, color: c.text.muted, fontWeight: '800' },
  dupHintModal: { fontSize: 11, color: c.text.muted, textAlign: 'center', marginTop: spacing[2], lineHeight: 15 },
  dupActions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  dupAct: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: radius.md, borderWidth: 1 },
  dupActText: { fontSize: 14, fontWeight: '800' },
  dupDone: { fontSize: 14, color: c.text.secondary, textAlign: 'center', paddingVertical: spacing[5] },
  undoRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle },
  undoText: { fontSize: 11.5, fontWeight: '600', color: c.text.secondary, flexShrink: 1 },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  rowName: { fontSize: 14, fontWeight: '600', color: c.text.primary },
  rowMeta: { fontSize: 11, color: c.text.muted, marginTop: 2 },

  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing[4] },
  sheet: { backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4], gap: spacing[2], borderWidth: 1, borderColor: c.border.subtle },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  sheetTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text.primary },
  sheetLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[2] },
  sheetInput: { backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 12, fontSize: 18, fontWeight: '700', color: c.text.primary, textAlign: 'center' },
  sheetHint: { fontSize: 10.5, color: c.text.muted, lineHeight: 14 },
  fieldInput: { backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 10, fontSize: 14, color: c.text.primary, marginTop: 4 },
  catRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: 4 },
  catChip: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  catChipText: { fontSize: 12, fontWeight: '600', color: c.text.secondary },
  saveBtn: { backgroundColor: '#FB923C', paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginTop: spacing[1] },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: c.bg.primary },
}));
