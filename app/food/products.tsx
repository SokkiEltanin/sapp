import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Plus, Search, X, Utensils, UtensilsCrossed, Star, ChefHat, Layers, Copy } from 'lucide-react-native';

import {
  useFoodStore, isRecipeProduct, PRESET_CATS, presetCatLabel, presetKcal, presetIngredientNames,
} from '@/store/foodStore';
import { FOOD_SUBCAT_META } from '@/utils/food';
import { normalizeProductName } from '@/utils/productMemory';
import { spacing, radius, colors } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const ACCENT = '#F59E0B';

type Tab = 'produkty' | 'kompozycje';

interface Entry {
  key: string; id: string; kind: 'preset' | 'recipe';
  name: string; cat: string; pinned: boolean; uses: number; sub: string;
  ingredients: string[]; ingHay: string; note?: string;
}

// ONE screen ("Baza jedzenia") with two internal tabs — Produkty (surowe składniki) and
// Kompozycje i dania (presety + dania z przepisu). Merged from the old two routes so the
// food area has fewer separate entries.
export default function FoodBase() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  const params = useLocalSearchParams<{ tab?: string }>();
  const [tab, setTab] = useState<Tab>(params.tab === 'kompozycje' ? 'kompozycje' : 'produkty');
  const [query, setQuery] = useState('');

  const products          = useFoodStore(st => st.products);
  const presets           = useFoodStore(st => st.presets);
  const removePreset      = useFoodStore(st => st.removePreset);
  const removeProduct     = useFoodStore(st => st.removeProduct);
  const togglePinPreset   = useFoodStore(st => st.togglePinPreset);
  const togglePinProduct  = useFoodStore(st => st.togglePinProduct);

  // ── Produkty tab (raw ingredients only) ──
  const productList = useMemo(() => {
    const base = products.filter(p => !isRecipeProduct(p));
    const q = normalizeProductName(query);
    const filtered = q ? base.filter(p => normalizeProductName(p.name).includes(q)) : base;
    return [...filtered].sort((a, b) => (Number(!!b.pinned) - Number(!!a.pinned)) || (b.uses - a.uses) || a.name.localeCompare(b.name, 'pl'));
  }, [products, query]);

  // ── Kompozycje i dania tab (presets + recipe dishes) ──
  const entries: Entry[] = useMemo(() => {
    const fromPresets: Entry[] = presets.map(p => {
      const ingredients = presetIngredientNames(p);
      return {
        key: 'p-' + p.id, id: p.id, kind: 'preset' as const, name: p.name, cat: p.cat || 'inne',
        pinned: !!p.pinned, uses: p.uses,
        sub: p.yields && p.yields > 1 ? `${p.yields} porcji · ${Math.round(presetKcal(p) / p.yields)} kcal/porcja` : `${presetKcal(p)} kcal · ${p.items.length} skł.`,
        ingredients, ingHay: normalizeProductName(ingredients.join(' ')),
      };
    });
    const fromRecipes: Entry[] = products.filter(isRecipeProduct).map(p => {
      const ingredients = p.recipe!.ingredients.map(i => i.name);
      return {
        key: 'r-' + p.id, id: p.id, kind: 'recipe' as const, name: p.name, cat: p.cat && PRESET_CATS.some(pc => pc.tag === p.cat) ? p.cat : 'dania',
        pinned: !!p.pinned, uses: p.uses,
        sub: `${p.kcalPer100g ?? 0} kcal/100g · z ${ingredients.length} skł. · ${p.recipe!.cookedWeight} g`,
        ingredients, ingHay: normalizeProductName(ingredients.join(' ')),
      };
    });
    const all = [...fromPresets, ...fromRecipes];
    const nq = normalizeProductName(query);
    if (!nq) return all;
    const toks = nq.split(' ').filter(Boolean);
    const hit = (hay: string) => hay.includes(nq) || (toks.length > 1 && toks.every(t => hay.includes(t)));
    const out: Entry[] = [];
    for (const e of all) {
      const nameHay = normalizeProductName(e.name + ' ' + presetCatLabel(e.cat));
      const nameHit = hit(nameHay);
      const ingHit = hit(e.ingHay);
      if (!nameHit && !ingHit) continue;
      let note: string | undefined;
      if (!nameHit && ingHit) {
        const found = e.ingredients.find(n => { const nn = normalizeProductName(n); return toks.some(t => nn.includes(t)); });
        if (found) note = 'zawiera ' + found;
      }
      out.push({ ...e, note });
    }
    return out;
  }, [presets, products, query]);

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
  const dup = (e: Entry) => {
    haptic.tap();
    if (e.kind === 'recipe') router.push(`/food/recipe?dup=${e.id}` as any);
    else router.push(`/food/add?dupPreset=${e.id}` as any);
  };
  const del = (e: Entry) => {
    Alert.alert('Usunąć „' + e.name + '"?', e.kind === 'recipe' ? 'Usuniesz to danie z biblioteki. Zjedzone wcześniej porcje zostają w historii.' : 'Usuniesz ten preset.', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => { haptic.tap(); e.kind === 'recipe' ? removeProduct(e.id) : removePreset(e.id); } },
    ]);
  };
  const rowMenu = (e: Entry) => {
    haptic.tap();
    const opts: any[] = [];
    if (e.kind === 'recipe') opts.push({ text: 'Dodaj dodatki (złóż danie)', onPress: () => { haptic.tap(); router.push(`/food/add?dish=${e.id}` as any); } });
    opts.push(
      { text: 'Duplikuj (zrób wariant)', onPress: () => dup(e) },
      { text: e.pinned ? 'Odepnij' : 'Przypnij', onPress: () => togglePin(e) },
      { text: 'Usuń', style: 'destructive', onPress: () => del(e) },
      { text: 'Anuluj', style: 'cancel' },
    );
    Alert.alert(e.name, e.kind === 'recipe' ? 'Danie z przepisu' : 'Kompozycja', opts);
  };

  const switchTab = (t: Tab) => { haptic.tap(); setTab(t); setQuery(''); };
  const addNew = () => { haptic.tap(); router.push((tab === 'produkty' ? '/food/product' : '/food/recipe') as any); };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={26} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.headerTitle}>Baza jedzenia</Text>
        <TouchableOpacity onPress={addNew} hitSlop={10}><Plus size={24} color={ACCENT} /></TouchableOpacity>
      </View>

      {/* Produkty | Kompozycje i dania — wewnętrzne zakładki (bez przeskoków) */}
      <View style={s.segment}>
        {(['produkty', 'kompozycje'] as const).map(t => {
          const on = tab === t;
          return (
            <TouchableOpacity key={t} style={[s.segBtn, on && s.segOn]} onPress={() => switchTab(t)}>
              <Text style={[s.segTxt, on && s.segTxtOn]}>{t === 'produkty' ? 'Produkty' : 'Kompozycje i dania'}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <View style={s.searchBox}>
        <Search size={17} color={c.text.muted} />
        <TextInput style={s.searchInput} value={query} onChangeText={setQuery}
          placeholder={tab === 'produkty' ? 'Szukaj produktu…' : 'Szukaj nazwy lub składnika (np. ser)…'} placeholderTextColor={c.text.muted} />
        {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><X size={16} color={c.text.muted} /></TouchableOpacity>}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>
        {tab === 'produkty' ? (
          productList.length === 0 ? (
            <TouchableOpacity style={s.empty} activeOpacity={0.9} onPress={() => { haptic.tap(); router.push('/food/product' as any); }}>
              <Utensils size={30} color={c.text.muted} />
              <Text style={s.emptyTitle}>{query ? 'Brak trafień' : 'Brak własnych produktów'}</Text>
              <Text style={s.emptySub}>Dodaj produkt (kcal/100g + makra + waga), a potem składaj z nich posiłki.</Text>
              <View style={[s.emptyBtn, { backgroundColor: ACCENT }]}><Plus size={16} color="#1A1206" /><Text style={s.emptyBtnTxt}>Dodaj produkt</Text></View>
            </TouchableOpacity>
          ) : productList.map(p => {
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
          })
        ) : (
          <>
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
                  <TouchableOpacity key={e.key} style={s.row} activeOpacity={0.75} onPress={() => openEntry(e)} onLongPress={() => rowMenu(e)} delayLongPress={400}>
                    <TouchableOpacity hitSlop={8} onPress={() => togglePin(e)}>
                      <Star size={17} color={ACCENT} fill={e.pinned ? ACCENT : 'transparent'} />
                    </TouchableOpacity>
                    <View style={{ flex: 1 }}>
                      <View style={s.nameRow}>
                        {e.kind === 'recipe' ? <ChefHat size={13} color={ACCENT} /> : <Layers size={13} color={c.text.muted} />}
                        <Text style={s.name} numberOfLines={1}>{e.name}</Text>
                      </View>
                      <Text style={s.meta} numberOfLines={1}>{e.sub}{e.note ? `  ·  ${e.note}` : ''}</Text>
                    </View>
                    <TouchableOpacity hitSlop={10} onPress={() => rowMenu(e)}><Copy size={16} color={c.text.muted} /></TouchableOpacity>
                  </TouchableOpacity>
                ))}
              </View>
            ))}
            <Text style={s.hint}>Stuknij = edytuj · gwiazdka = przypnij · przytrzymaj / ikona kopii = Dodatki / Duplikuj / Usuń. Szukaj też po składniku.</Text>
          </>
        )}
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
  dot:  { width: 9, height: 9, borderRadius: 5 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  name: { fontSize: 14.5, fontWeight: '700', color: c.text.primary, flexShrink: 1 },
  meta: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },

  empty:      { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[8] },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  emptySub:   { fontSize: 12.5, color: c.text.muted, textAlign: 'center', lineHeight: 17, paddingHorizontal: spacing[4] },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[4], paddingVertical: 10, borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnTxt: { fontSize: 13, fontWeight: '800', color: '#1A1206' },

  hint: { fontSize: 11.5, color: c.text.muted, textAlign: 'center', marginTop: spacing[3], lineHeight: 16 },
}));
