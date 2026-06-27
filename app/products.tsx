import { useState, useMemo, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity,
  Modal, Pressable, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Search, Flame, X } from 'lucide-react-native';

import { expensesService } from '@/services/expensesService';
import { Expense } from '@/types';
import { countsForConsumption } from '@/store/statsScope';
import {
  canonicalProductName, normalizeProductName, loadNameAliases,
  loadKcalMemory, saveKcalMemory, kcalFor, KcalMemory,
} from '@/utils/productMemory';
import { kcalPer100g, looksLikeFood } from '@/utils/calories';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { useColors } from '@/theme/useColors';
import { spacing, radius } from '@/theme';

type Product = { name: string; key: string; count: number; category: string; tags: string[] };

export default function ProductsScreen() {
  const c = useColors();
  const s = useMemo(() => makeStyles(c), [c]);

  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [aliases, setAliases]   = useState<Record<string, string>>({});
  const [kcalMem, setKcalMem]   = useState<KcalMemory>({});
  const [query, setQuery]       = useState('');
  const [editing, setEditing]   = useState<Product | null>(null);
  const [kcalInput, setKcalInput] = useState('');

  const reload = useCallback(() => {
    expensesService.getAll().then(setExpenses).catch(() => {});
    loadNameAliases().then(setAliases).catch(() => {});
    loadKcalMemory().then(setKcalMem).catch(() => {});
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

  const kcalOf = (p: Product): { value: number; learned: boolean } => {
    const learned = kcalFor(p.name, kcalMem);
    if (learned != null && learned > 0) return { value: learned, learned: true };
    return { value: kcalPer100g({ name: p.name, tags: p.tags, category: p.category }), learned: false };
  };

  const openEdit = (p: Product) => {
    haptic.tap();
    const k = kcalOf(p);
    setKcalInput(k.value > 0 ? String(k.value) : '');
    setEditing(p);
  };

  const saveKcal = async () => {
    if (!editing) return;
    const v = parseInt(kcalInput.replace(',', '.'), 10);
    if (isNaN(v) || v <= 0) { haptic.error(); toast.error('Podaj kcal na 100 g'); return; }
    haptic.success();
    await saveKcalMemory([{ name: editing.name, kcal: v }]);
    await loadKcalMemory().then(setKcalMem);
    setEditing(null);
    toast.success('Zapisano kalorie produktu');
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableBack onPress={() => router.back()} color={c.text.primary} />
        <View style={{ flex: 1 }}>
          <Text style={s.title}>Produkty</Text>
          <Text style={s.subtitle}>{products.length} produktów · ustaw kcal/100 g</Text>
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
        {filtered.length === 0 ? (
          <Text style={s.empty}>{products.length === 0 ? 'Brak produktów — zeskanuj paragony, by je tu zobaczyć.' : 'Nic nie pasuje.'}</Text>
        ) : filtered.map(p => {
          const k = kcalOf(p);
          return (
            <TouchableOpacity key={p.key} style={s.row} activeOpacity={0.8} onPress={() => openEdit(p)}>
              <View style={{ flex: 1 }}>
                <Text style={s.rowName} numberOfLines={1}>{p.name}</Text>
                <Text style={s.rowMeta} numberOfLines={1}>
                  ×{p.count}{p.tags.length > 0 ? ` · ${p.tags.slice(0, 3).join(', ')}` : ''}
                </Text>
              </View>
              <View style={[s.kcalChip, k.learned && { backgroundColor: '#FB923C22', borderColor: '#FB923C55' }]}>
                <Flame size={11} color={k.learned ? '#FB923C' : c.text.muted} />
                <Text style={[s.kcalText, k.learned && { color: '#FB923C' }]}>
                  {k.value > 0 ? k.value : '—'}<Text style={s.kcalUnit}>/100g</Text>
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      {/* kcal edit modal */}
      <Modal visible={!!editing} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setEditing(null)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.overlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setEditing(null)} />
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle} numberOfLines={2}>{editing?.name}</Text>
              <TouchableOpacity onPress={() => setEditing(null)} hitSlop={10}><X size={18} color={c.text.muted} /></TouchableOpacity>
            </View>
            <Text style={s.sheetLabel}>Kalorie na 100 g</Text>
            <TextInput
              value={kcalInput}
              onChangeText={setKcalInput}
              keyboardType="number-pad"
              placeholder="np. 350"
              placeholderTextColor={c.text.muted}
              style={s.sheetInput}
              autoFocus
              selectTextOnFocus
            />
            <Text style={s.sheetHint}>Ustawione tutaj kcal zastąpią zgadywanie z kategorii w „Bilansie energii".</Text>
            <TouchableOpacity style={s.saveBtn} onPress={saveKcal} activeOpacity={0.85}>
              <Text style={s.saveBtnText}>Zapisz</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
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

const makeStyles = (c: any) => StyleSheet.create({
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
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  rowName: { fontSize: 14, fontWeight: '600', color: c.text.primary },
  rowMeta: { fontSize: 11, color: c.text.muted, marginTop: 2 },
  kcalChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[2] + 2, paddingVertical: 6, borderRadius: radius.full,
    backgroundColor: c.fill.medium, borderWidth: 1, borderColor: c.border.default,
  },
  kcalText: { fontSize: 13, fontWeight: '800', color: c.text.secondary },
  kcalUnit: { fontSize: 9, fontWeight: '600', color: c.text.muted },

  overlay: { flex: 1, justifyContent: 'center', backgroundColor: 'rgba(0,0,0,0.6)', padding: spacing[4] },
  sheet: { backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4], gap: spacing[2], borderWidth: 1, borderColor: c.border.subtle },
  sheetHead: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  sheetTitle: { flex: 1, fontSize: 15, fontWeight: '800', color: c.text.primary },
  sheetLabel: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[2] },
  sheetInput: { backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 12, fontSize: 18, fontWeight: '700', color: c.text.primary, textAlign: 'center' },
  sheetHint: { fontSize: 10.5, color: c.text.muted, lineHeight: 14 },
  saveBtn: { backgroundColor: '#FB923C', paddingVertical: 13, borderRadius: radius.md, alignItems: 'center', marginTop: spacing[1] },
  saveBtnText: { fontSize: 14, fontWeight: '800', color: c.bg.primary },
});
