import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Plus, Search, X, Star, ChefHat, Layers, UtensilsCrossed } from 'lucide-react-native';

import {
  useFoodStore, PRESET_CATS, presetCatLabel, presetKcal, isRecipeProduct,
} from '@/store/foodStore';
import { normalizeProductName } from '@/utils/productMemory';
import { spacing, radius, colors } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const ACCENT = '#F59E0B';

interface Entry {
  key: string; id: string; kind: 'preset' | 'recipe';
  name: string; cat: string; pinned: boolean; uses: number; sub: string;
}

export default function FoodLibrary() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  const presets           = useFoodStore(st => st.presets);
  const products          = useFoodStore(st => st.products);
  const removePreset      = useFoodStore(st => st.removePreset);
  const removeProduct     = useFoodStore(st => st.removeProduct);
  const togglePinPreset   = useFoodStore(st => st.togglePinPreset);
  const togglePinProduct  = useFoodStore(st => st.togglePinProduct);

  const [query, setQuery] = useState('');

  const entries: Entry[] = useMemo(() => {
    const fromPresets: Entry[] = presets.map(p => ({
      key: 'p-' + p.id, id: p.id, kind: 'preset' as const, name: p.name, cat: p.cat || 'inne',
      pinned: !!p.pinned, uses: p.uses,
      sub: p.yields && p.yields > 1 ? `${p.yields} porcji · ${Math.round(presetKcal(p) / p.yields)} kcal/porcja` : `${presetKcal(p)} kcal · ${p.items.length} skł.`,
    }));
    const fromRecipes: Entry[] = products.filter(isRecipeProduct).map(p => ({
      key: 'r-' + p.id, id: p.id, kind: 'recipe' as const, name: p.name, cat: p.cat && PRESET_CATS.some(pc => pc.tag === p.cat) ? p.cat : 'dania',
      pinned: !!p.pinned, uses: p.uses,
      sub: `${p.kcalPer100g ?? 0} kcal/100g · z ${p.recipe!.ingredients.length} skł. · ${p.recipe!.cookedWeight} g`,
    }));
    const all = [...fromPresets, ...fromRecipes];
    const q = normalizeProductName(query);
    return q ? all.filter(e => normalizeProductName(e.name).includes(q) || normalizeProductName(presetCatLabel(e.cat)).includes(q)) : all;
  }, [presets, products, query]);

  // pinned flat first, then grouped by category (PRESET_CATS order)
  const sections = useMemo(() => {
    const pinned = entries.filter(e => e.pinned).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name, 'pl'));
    const rest = entries.filter(e => !e.pinned);
    const out: { tag: string; label: string; items: Entry[] }[] = [];
    if (pinned.length) out.push({ tag: '_fav', label: 'Ulubione', items: pinned });
    for (const pc of PRESET_CATS) {
      const items = rest.filter(e => e.cat === pc.tag).sort((a, b) => b.uses - a.uses || a.name.localeCompare(b.name, 'pl'));
      if (items.length) out.push({ tag: pc.tag, label: pc.label, items });
    }
    const known = new Set(PRESET_CATS.map(p => p.tag));
    const other = rest.filter(e => !known.has(e.cat)).sort((a, b) => b.uses - a.uses);
    if (other.length) out.push({ tag: '_inne', label: 'Inne', items: other });
    return out;
  }, [entries]);

  const openEntry = (e: Entry) => {
    haptic.tap();
    if (e.kind === 'recipe') router.push(`/food/recipe?edit=${e.id}` as any);
    else router.push(`/food/add?preset=${e.id}` as any);
  };
  const togglePin = (e: Entry) => { haptic.tap(); e.kind === 'recipe' ? togglePinProduct(e.id) : togglePinPreset(e.id); };
  const del = (e: Entry) => {
    Alert.alert('Usunąć „' + e.name + '"?', e.kind === 'recipe' ? 'Usuniesz to danie z biblioteki. Zjedzone wcześniej porcje zostają w historii.' : 'Usuniesz ten preset.', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => { haptic.tap(); e.kind === 'recipe' ? removeProduct(e.id) : removePreset(e.id); } },
    ]);
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={26} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.headerTitle}>Biblioteka</Text>
        <TouchableOpacity onPress={() => { haptic.tap(); router.push('/food/recipe' as any); }} hitSlop={10}><Plus size={24} color={ACCENT} /></TouchableOpacity>
      </View>

      {/* Produkty | Kompozycje i dania */}
      <View style={s.segment}>
        <TouchableOpacity style={s.segBtn} onPress={() => { haptic.tap(); router.replace('/food/products' as any); }}>
          <Text style={s.segTxt}>Produkty</Text>
        </TouchableOpacity>
        <View style={[s.segBtn, s.segOn]}>
          <Text style={[s.segTxt, s.segTxtOn]}>Kompozycje i dania</Text>
        </View>
      </View>

      <View style={s.searchBox}>
        <Search size={17} color={c.text.muted} />
        <TextInput style={s.searchInput} value={query} onChangeText={setQuery} placeholder="Szukaj kompozycji / dania…" placeholderTextColor={c.text.muted} />
        {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><X size={16} color={c.text.muted} /></TouchableOpacity>}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        <TouchableOpacity style={s.newBtn} activeOpacity={0.85} onPress={() => { haptic.tap(); router.push('/food/recipe' as any); }}>
          <ChefHat size={18} color="#1A1206" />
          <Text style={s.newBtnTxt}>Nowy przepis / danie (zważ ugotowane)</Text>
        </TouchableOpacity>

        {sections.length === 0 ? (
          <View style={s.empty}>
            <UtensilsCrossed size={30} color={c.text.muted} />
            <Text style={s.emptyTitle}>{query ? 'Brak trafień' : 'Pusto tu jeszcze'}</Text>
            <Text style={s.emptySub}>Kompozycje (np. kanapka) zapiszesz w „Co zjadłem". Dania z przepisu (naleśniki, ciasto) — przyciskiem wyżej.</Text>
          </View>
        ) : sections.map(sec => (
          <View key={sec.tag} style={{ gap: 2 }}>
            <View style={s.catHead}>
              {sec.tag === '_fav' && <Star size={13} color={ACCENT} fill={ACCENT} />}
              <Text style={s.catHeadTxt}>{sec.label}</Text>
              <Text style={s.catHeadCount}>{sec.items.length}</Text>
            </View>
            {sec.items.map(e => (
              <TouchableOpacity key={e.key} style={s.row} activeOpacity={0.75} onPress={() => openEntry(e)} onLongPress={() => del(e)} delayLongPress={450}>
                <TouchableOpacity hitSlop={8} onPress={() => togglePin(e)}>
                  <Star size={17} color={ACCENT} fill={e.pinned ? ACCENT : 'transparent'} />
                </TouchableOpacity>
                <View style={{ flex: 1 }}>
                  <View style={s.nameRow}>
                    {e.kind === 'recipe' ? <ChefHat size={13} color={ACCENT} /> : <Layers size={13} color={c.text.muted} />}
                    <Text style={s.name} numberOfLines={1}>{e.name}</Text>
                  </View>
                  <Text style={s.meta} numberOfLines={1}>{e.sub}</Text>
                </View>
              </TouchableOpacity>
            ))}
          </View>
        ))}
        <Text style={s.hint}>Stuknij, by edytować · gwiazdka przypina na górę · przytrzymaj, by usunąć.</Text>
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  headerTitle: { fontSize: 17, fontWeight: '800', color: c.text.primary },

  segment: { flexDirection: 'row', marginHorizontal: spacing[4], marginBottom: spacing[2], backgroundColor: c.fill.subtle, borderRadius: radius.full, padding: 3 },
  segBtn:  { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radius.full },
  segOn:   { backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default },
  segTxt:  { fontSize: 13, fontWeight: '700', color: c.text.muted },
  segTxtOn: { color: c.text.primary },

  searchBox: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginHorizontal: spacing[4], marginBottom: spacing[2], backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle, paddingHorizontal: spacing[3], height: 44 },
  searchInput: { flex: 1, fontSize: 15, color: c.text.primary },
  scroll: { paddingHorizontal: spacing[4], paddingBottom: 40, gap: spacing[2] },

  newBtn:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 9, height: 50, borderRadius: radius.full, backgroundColor: ACCENT },
  newBtnTxt: { fontSize: 14, fontWeight: '800', color: '#1A1206' },

  catHead:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing[2], marginLeft: 2 },
  catHeadTxt:   { fontSize: 13, fontWeight: '800', color: c.text.primary },
  catHeadCount: { fontSize: 11, fontWeight: '700', color: c.text.muted },

  row:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.border.subtle },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14.5, fontWeight: '700', color: c.text.primary, flexShrink: 1 },
  meta: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },

  empty:      { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[8] },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  emptySub:   { fontSize: 12.5, color: c.text.muted, textAlign: 'center', lineHeight: 17, paddingHorizontal: spacing[4] },

  hint: { fontSize: 11.5, color: c.text.muted, textAlign: 'center', marginTop: spacing[3], lineHeight: 16 },
}));
