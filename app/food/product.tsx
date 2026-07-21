import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Check, Link2, Search, X, Trash2 } from 'lucide-react-native';

import { useFoodStore, FoodUnit } from '@/store/foodStore';
import { FOOD_SUBCATS } from '@/utils/food';
import { expensesService } from '@/services/expensesService';
import { loadNameAliases, canonicalProductName, normalizeProductName } from '@/utils/productMemory';
import { spacing, radius, colors } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const ACCENT = '#F59E0B';
const numOr0 = (s: string) => { const v = parseFloat(s.replace(',', '.')); return isNaN(v) ? 0 : v; };

export default function FoodProductForm() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const params = useLocalSearchParams<{ id?: string; name?: string }>();

  const products      = useFoodStore(st => st.products);
  const addProduct    = useFoodStore(st => st.addProduct);
  const updateProduct = useFoodStore(st => st.updateProduct);
  const removeProduct = useFoodStore(st => st.removeProduct);

  const editing = params.id ? products.find(p => p.id === params.id) : undefined;

  const [cat, setCat]       = useState('');
  const [name, setName]     = useState('');
  const [weightG, setWeightG] = useState('');
  const [kcal, setKcal]     = useState('');
  const [prot, setProt]     = useState('');
  const [carb, setCarb]     = useState('');
  const [fat, setFat]       = useState('');
  const [linkedName, setLinkedName] = useState('');
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkQuery, setLinkQuery] = useState('');
  const [purchased, setPurchased] = useState<string[]>([]);

  // prefill on edit / from a passed name
  useEffect(() => {
    if (editing) {
      setCat(editing.cat ?? '');
      setName(editing.name);
      setWeightG(editing.unitGrams?.szt ? String(editing.unitGrams.szt) : '');
      setKcal(editing.kcalPer100g != null ? String(editing.kcalPer100g) : '');
      setProt(editing.protein100 != null ? String(editing.protein100) : '');
      setCarb(editing.carbs100 != null ? String(editing.carbs100) : '');
      setFat(editing.fat100 != null ? String(editing.fat100) : '');
      setLinkedName(editing.linkedName ?? '');
    } else if (params.name) {
      setName(params.name);
    }
  }, [editing?.id]);

  // purchased product names (from receipts) for the optional link
  useEffect(() => {
    Promise.all([expensesService.getAll(), loadNameAliases()]).then(([exps, aliases]) => {
      const map = new Map<string, string>();
      for (const e of exps) for (const it of (e.receiptItems ?? [])) {
        const nm = canonicalProductName(it.name ?? '', aliases);
        const key = normalizeProductName(nm);
        if (key && !map.has(key)) map.set(key, nm);
      }
      setPurchased([...map.values()].sort((a, b) => a.localeCompare(b, 'pl')));
    }).catch(() => {});
  }, []);

  const linkResults = useMemo(() => {
    const q = normalizeProductName(linkQuery);
    const list = q ? purchased.filter(n => normalizeProductName(n).includes(q)) : purchased;
    return list.slice(0, 30);
  }, [purchased, linkQuery]);

  const canSave = !!name.trim() && numOr0(kcal) > 0;

  const save = () => {
    if (!canSave) return;
    haptic.success();
    const wg = Math.round(numOr0(weightG));
    const fields = {
      name: name.trim(),
      cat: cat || undefined,
      kcalPer100g: Math.round(numOr0(kcal)),
      protein100: numOr0(prot) > 0 ? numOr0(prot) : undefined,
      carbs100:   numOr0(carb) > 0 ? numOr0(carb) : undefined,
      fat100:     numOr0(fat) > 0 ? numOr0(fat) : undefined,
      unitGrams:  wg > 0 ? { szt: wg } as Partial<Record<FoodUnit, number>> : undefined,
      defaultUnit: (wg > 0 ? 'szt' : 'g') as FoodUnit,
      linkedName: linkedName.trim() || undefined,
    };
    if (editing) updateProduct(editing.id, fields);
    else addProduct(fields);
    router.back();
  };

  const del = () => { if (editing) { haptic.tap(); removeProduct(editing.id); router.back(); } };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={26} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.headerTitle}>{editing ? 'Edytuj produkt' : 'Nowy produkt'}</Text>
        {editing ? <TouchableOpacity onPress={del} hitSlop={10}><Trash2 size={20} color={colors.accent.red} /></TouchableOpacity> : <View style={{ width: 26 }} />}
      </View>

      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
          {/* kategoria */}
          <Text style={s.label}>Kategoria</Text>
          <View style={s.catWrap}>
            {FOOD_SUBCATS.map(sc => {
              const on = cat === sc.tag;
              return (
                <TouchableOpacity key={sc.tag} onPress={() => { haptic.tap(); setCat(on ? '' : sc.tag); }}
                  style={[s.catChip, on && { backgroundColor: sc.color + '22', borderColor: sc.color }]}>
                  <View style={[s.catDot, { backgroundColor: sc.color }]} />
                  <Text style={[s.catTxt, on && { color: sc.color }]}>{sc.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>

          <Text style={s.label}>Nazwa</Text>
          <TextInput style={s.input} value={name} onChangeText={setName} placeholder="np. Bułka z kiełkami żyta" placeholderTextColor={c.text.muted} />

          <View style={s.twoCol}>
            <View style={s.col}>
              <Text style={s.label}>Waga (g/szt)</Text>
              <TextInput style={s.input} value={weightG} onChangeText={setWeightG} keyboardType="numeric" placeholder="np. 70" placeholderTextColor={c.text.muted} />
            </View>
            <View style={s.col}>
              <Text style={s.label}>kcal / 100 g</Text>
              <TextInput style={s.input} value={kcal} onChangeText={setKcal} keyboardType="numeric" placeholder="np. 324" placeholderTextColor={c.text.muted} />
            </View>
          </View>

          <Text style={s.label}>Makra na 100 g (opcjonalnie)</Text>
          <View style={s.macroRow}>
            <View style={s.macroCol}><Text style={s.macroLbl}>B (białko)</Text><TextInput style={s.macroInput} value={prot} onChangeText={setProt} keyboardType="numeric" placeholder="12" placeholderTextColor={c.text.muted} /></View>
            <View style={s.macroCol}><Text style={s.macroLbl}>W (węgle)</Text><TextInput style={s.macroInput} value={carb} onChangeText={setCarb} keyboardType="numeric" placeholder="46" placeholderTextColor={c.text.muted} /></View>
            <View style={s.macroCol}><Text style={s.macroLbl}>T (tłuszcz)</Text><TextInput style={s.macroInput} value={fat} onChangeText={setFat} keyboardType="numeric" placeholder="9.4" placeholderTextColor={c.text.muted} /></View>
          </View>

          {/* powiązanie z kupionym */}
          <TouchableOpacity style={s.linkHead} onPress={() => { haptic.tap(); setLinkOpen(o => !o); }}>
            <Link2 size={15} color={ACCENT} />
            <Text style={s.linkHeadTxt}>{linkedName ? `Powiązane z: ${linkedName}` : 'Powiąż z kupionym produktem (opcjonalnie)'}</Text>
            {linkedName ? <TouchableOpacity hitSlop={8} onPress={() => setLinkedName('')}><X size={15} color={c.text.muted} /></TouchableOpacity> : null}
          </TouchableOpacity>
          {linkOpen && (
            <View style={s.linkBox}>
              <View style={s.searchRow}>
                <Search size={15} color={c.text.muted} />
                <TextInput style={s.searchInput} value={linkQuery} onChangeText={setLinkQuery} placeholder="Szukaj w kupionych…" placeholderTextColor={c.text.muted} />
              </View>
              <ScrollView style={{ maxHeight: 180 }} keyboardShouldPersistTaps="handled" nestedScrollEnabled>
                {linkResults.map(n => (
                  <TouchableOpacity key={n} style={s.linkRow} onPress={() => { haptic.tap(); setLinkedName(n); if (!name.trim()) setName(n); setLinkOpen(false); }}>
                    <Text style={s.linkRowTxt} numberOfLines={1}>{n}</Text>
                  </TouchableOpacity>
                ))}
                {linkResults.length === 0 && <Text style={s.linkEmpty}>Brak — kupione produkty pojawią się tu po zeskanowaniu paragonów.</Text>}
              </ScrollView>
            </View>
          )}

          <Text style={s.hint}>Zapisany produkt trafia do „Moich produktów" i wyszukasz go w „Co zjadłem". Powiązanie sprawia, że po zakupie tego produktu podskoczy on w podpowiedziach.</Text>
        </ScrollView>
      </KeyboardAvoidingView>

      <View style={s.saveBar}>
        <TouchableOpacity style={[s.saveBtn, { backgroundColor: canSave ? ACCENT : c.fill.subtle }]} disabled={!canSave} onPress={save}>
          <Check size={18} color={canSave ? '#1A1206' : c.text.muted} />
          <Text style={[s.saveTxt, { color: canSave ? '#1A1206' : c.text.muted }]}>{editing ? 'Zapisz zmiany' : 'Zapisz produkt'}</Text>
        </TouchableOpacity>
      </View>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  headerTitle: { fontSize: 17, fontWeight: '800', color: c.text.primary },
  scroll:    { padding: spacing[4], gap: spacing[2], paddingBottom: 120 },

  label:  { fontSize: 12, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[2] },
  input:  { height: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], fontSize: 15, color: c.text.primary, backgroundColor: c.bg.card },
  hint:   { fontSize: 11.5, color: c.text.muted, lineHeight: 16, marginTop: spacing[2] },

  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  catChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  catDot:  { width: 8, height: 8, borderRadius: 4 },
  catTxt:  { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },

  twoCol: { flexDirection: 'row', gap: spacing[3] },
  col:    { flex: 1 },

  macroRow:   { flexDirection: 'row', gap: spacing[2] },
  macroCol:   { flex: 1, gap: 4 },
  macroLbl:   { fontSize: 11, fontWeight: '700', color: c.text.muted, textAlign: 'center' },
  macroInput: { height: 46, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, textAlign: 'center', fontSize: 16, fontWeight: '700', color: c.text.primary, backgroundColor: c.bg.card },

  linkHead:    { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[3], paddingVertical: 6 },
  linkHeadTxt: { fontSize: 13, fontWeight: '700', color: ACCENT, flex: 1 },
  linkBox:     { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle, padding: spacing[2], gap: spacing[1] },
  searchRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[2], height: 40 },
  searchInput: { flex: 1, fontSize: 14, color: c.text.primary },
  linkRow:     { paddingVertical: 9, paddingHorizontal: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  linkRowTxt:  { fontSize: 13.5, color: c.text.primary },
  linkEmpty:   { fontSize: 12, color: c.text.muted, padding: spacing[2] },

  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing[4], paddingBottom: spacing[5], backgroundColor: c.bg.primary + 'F2' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.full },
  saveTxt: { fontSize: 15, fontWeight: '800' },
}));
