import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Plus, Search, X, Utensils } from 'lucide-react-native';

import { useFoodStore } from '@/store/foodStore';
import { FOOD_SUBCAT_META } from '@/utils/food';
import { normalizeProductName } from '@/utils/productMemory';
import { spacing, radius, colors } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const ACCENT = '#F59E0B';

export default function FoodProducts() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const products = useFoodStore(st => st.products);
  const [query, setQuery] = useState('');

  const list = useMemo(() => {
    const q = normalizeProductName(query);
    const filtered = q ? products.filter(p => normalizeProductName(p.name).includes(q)) : products;
    return [...filtered].sort((a, b) => (b.uses - a.uses) || a.name.localeCompare(b.name, 'pl'));
  }, [products, query]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={26} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.headerTitle}>Moje produkty</Text>
        <TouchableOpacity onPress={() => { haptic.tap(); router.push('/food/product' as any); }} hitSlop={10}><Plus size={24} color={ACCENT} /></TouchableOpacity>
      </View>

      <View style={s.searchBox}>
        <Search size={17} color={c.text.muted} />
        <TextInput style={s.searchInput} value={query} onChangeText={setQuery} placeholder="Szukaj produktu…" placeholderTextColor={c.text.muted} />
        {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><X size={16} color={c.text.muted} /></TouchableOpacity>}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {list.length === 0 ? (
          <TouchableOpacity style={s.empty} activeOpacity={0.9} onPress={() => { haptic.tap(); router.push('/food/product' as any); }}>
            <Utensils size={30} color={c.text.muted} />
            <Text style={s.emptyTitle}>{query ? 'Brak trafień' : 'Brak własnych produktów'}</Text>
            <Text style={s.emptySub}>Dodaj produkt (kcal/100g + makra + waga), a potem składaj z nich posiłki.</Text>
            <View style={[s.emptyBtn, { backgroundColor: ACCENT }]}><Plus size={16} color="#1A1206" /><Text style={s.emptyBtnTxt}>Dodaj produkt</Text></View>
          </TouchableOpacity>
        ) : list.map(p => {
          const meta = p.cat ? FOOD_SUBCAT_META[p.cat] : null;
          return (
            <TouchableOpacity key={p.id} style={s.row} activeOpacity={0.75} onPress={() => { haptic.tap(); router.push(`/food/product?id=${p.id}` as any); }}>
              <View style={[s.dot, { backgroundColor: meta?.color ?? '#9CA3AF' }]} />
              <View style={{ flex: 1 }}>
                <Text style={s.name} numberOfLines={1}>{p.name}</Text>
                <Text style={s.meta} numberOfLines={1}>
                  {p.kcalPer100g != null ? `${p.kcalPer100g} kcal/100g` : p.kcalPerPortion != null ? `${p.kcalPerPortion} kcal/porcja` : '—'}
                  {p.protein100 != null || p.carbs100 != null || p.fat100 != null ? `  ·  B${p.protein100 ?? 0} W${p.carbs100 ?? 0} T${p.fat100 ?? 0}` : ''}
                  {p.unitGrams?.szt ? `  ·  ${p.unitGrams.szt} g/szt` : ''}
                </Text>
              </View>
            </TouchableOpacity>
          );
        })}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  headerTitle: { fontSize: 17, fontWeight: '800', color: c.text.primary },
  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginHorizontal: spacing[4], marginBottom: spacing[2], backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle, paddingHorizontal: spacing[3], height: 44 },
  searchInput: { flex: 1, fontSize: 15, color: c.text.primary },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: 40, gap: 2 },

  row:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  dot:  { width: 9, height: 9, borderRadius: 5 },
  name: { fontSize: 14.5, fontWeight: '700', color: c.text.primary },
  meta: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },

  empty:      { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[8] },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  emptySub:   { fontSize: 12.5, color: c.text.muted, textAlign: 'center', lineHeight: 17, paddingHorizontal: spacing[4] },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[4], paddingVertical: 10, borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnTxt: { fontSize: 13, fontWeight: '800', color: '#1A1206' },
}));
