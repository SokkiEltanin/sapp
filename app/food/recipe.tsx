import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Search, Plus, Minus, X, Check, Trash2, ChefHat, Scale } from 'lucide-react-native';

import {
  useFoodStore, UNIT_META, unitToGrams, computeItemMacros,
  MealItem, FoodUnit, PRESET_CATS, recipeDensity, recipeTotals,
} from '@/store/foodStore';
import { searchFoodBase } from '@/data/foodBase';
import { normalizeProductName } from '@/utils/productMemory';
import { spacing, radius, colors } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const ACCENT = '#F59E0B';

// A pickable ingredient — from the user's counted DB or the offline base.
interface Candidate {
  name: string;
  kcalPer100g?: number;
  kcalPerPortion?: number;
  protein100?: number;
  carbs100?: number;
  fat100?: number;
  unitGrams?: Partial<Record<FoodUnit, number>>;
  defaultUnit?: FoodUnit;
  productId?: string;
  source: 'curated' | 'base';
}

export default function RecipeBuilder() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  const products            = useFoodStore(st => st.products);
  const upsertProductByName = useFoodStore(st => st.upsertProductByName);
  const updateProduct       = useFoodStore(st => st.updateProduct);
  const removeProduct       = useFoodStore(st => st.removeProduct);
  const learnPortion        = useFoodStore(st => st.learnPortion);
  const saveRecipeProduct   = useFoodStore(st => st.saveRecipeProduct);

  const params = useLocalSearchParams<{ edit?: string; name?: string }>();
  const editId = typeof params.edit === 'string' ? params.edit : undefined;

  const [name, setName]     = useState('');
  const [cat, setCat]       = useState('nalesniki');
  const [cooked, setCooked] = useState('');            // waga gotowego dania (g)
  const [ings, setIngs]     = useState<MealItem[]>([]);
  const [query, setQuery]   = useState('');

  // ingredient portion picker
  const [sel, setSel]           = useState<Candidate | null>(null);
  const [unit, setUnit]         = useState<FoodUnit>('g');
  const [qtyText, setQtyText]   = useState('1');       // wpisywana ilość (0,5 / 1,5 szklanki)
  const [gramsOverride, setGramsOverride] = useState('');
  const [kcal100, setKcal100]   = useState('');
  const qty = parseFloat(qtyText.replace(',', '.')) || 0;
  const bumpQty = (dir: 1 | -1) => setQtyText(prev => {
    const q = parseFloat(prev.replace(',', '.')) || 0;
    const step = q >= 2 ? 1 : 0.5;
    const nq = Math.max(0.5, +(q + dir * step).toFixed(2));
    return nq % 1 === 0 ? String(nq) : String(nq);
  });

  // prefill when editing an existing recipe product
  useEffect(() => {
    if (!editId) { if (params.name) setName(params.name); return; }
    const p = products.find(x => x.id === editId);
    if (p?.recipe) {
      setName(p.name);
      setCat(p.cat && PRESET_CATS.some(pc => pc.tag === p.cat) ? p.cat : 'dania');
      setCooked(String(p.recipe.cookedWeight || ''));
      setIngs(p.recipe.ingredients.map(it => ({ ...it })));
    }
  }, [editId]);

  const totals  = useMemo(() => recipeTotals(ings), [ings]);
  const cookedG = parseFloat(cooked.replace(',', '.')) || 0;
  const density = useMemo(() => recipeDensity(ings, cookedG), [ings, cookedG]);

  // ── candidates (own products first, then base) ─────────────────────────────
  const candidates: Candidate[] = useMemo(() => {
    const curated: Candidate[] = products.map(p => ({
      name: p.name, kcalPer100g: p.kcalPer100g, kcalPerPortion: p.kcalPerPortion,
      protein100: p.protein100, carbs100: p.carbs100, fat100: p.fat100,
      unitGrams: p.unitGrams, defaultUnit: p.defaultUnit, productId: p.id, source: 'curated' as const,
      _rank: (p.lastUsed ?? 0) + p.uses * 1000,
    } as any));
    const q = query.trim();
    if (!q) {
      curated.sort((a: any, b: any) => b._rank - a._rank);
      const seen = new Set(curated.map(x => normalizeProductName(x.name)));
      const base: Candidate[] = searchFoodBase('', 24)
        .filter(f => !seen.has(normalizeProductName(f.name)))
        .map(f => ({ name: f.name, kcalPer100g: f.kcal, protein100: f.protein, unitGrams: f.unitGrams, defaultUnit: f.unit, source: 'base' }));
      return [...curated.slice(0, 8), ...base];
    }
    const nq = normalizeProductName(q);
    const curatedMatch = curated.filter(x => normalizeProductName(x.name).includes(nq));
    const seen = new Set(curatedMatch.map(x => normalizeProductName(x.name)));
    const base: Candidate[] = searchFoodBase(q, 24)
      .filter(f => !seen.has(normalizeProductName(f.name)))
      .map(f => ({ name: f.name, kcalPer100g: f.kcal, protein100: f.protein, unitGrams: f.unitGrams, defaultUnit: f.unit, source: 'base' }));
    return [...curatedMatch, ...base];
  }, [products, query]);

  const exactExists = useMemo(() => {
    const nq = normalizeProductName(query);
    return !!nq && candidates.some(x => normalizeProductName(x.name) === nq);
  }, [query, candidates]);

  // ── picker ─────────────────────────────────────────────────────────────────
  const pickerUnits = useMemo(() => {
    if (!sel) return ['g'] as FoodUnit[];
    const own = Object.keys(sel.unitGrams ?? {}) as FoodUnit[];
    const list = [sel.defaultUnit, ...own, 'g'].filter(Boolean) as FoodUnit[];
    return Array.from(new Set(list));
  }, [sel]);

  const openPicker = (cand: Candidate) => {
    haptic.tap();
    const u: FoodUnit = cand.defaultUnit ?? (Object.keys(cand.unitGrams ?? {})[0] as FoodUnit) ?? 'g';
    setSel(cand); setUnit(u); setQtyText('1'); setGramsOverride('');
    setKcal100(cand.kcalPer100g != null ? String(cand.kcalPer100g) : '');
  };
  const addNew = () => { const nm = query.trim(); if (nm) openPicker({ name: nm, source: 'base' }); };

  const dens = () => { const k = parseFloat(kcal100.replace(',', '.')); return k > 0 ? k : (sel?.kcalPer100g ?? 0); };
  const pickerGrams = () => {
    if (!sel) return 0;
    const g = parseFloat(gramsOverride.replace(',', '.'));
    if (unit === 'g') return g > 0 ? g : 0;
    if (g > 0) return g;
    return qty * unitToGrams(sel as any, unit);
  };
  const pickerKcal = () => {
    if (!sel) return 0;
    const d = dens();
    if (d > 0) return Math.round(pickerGrams() / 100 * d);
    if (sel.kcalPerPortion != null) return Math.round(sel.kcalPerPortion * qty);
    return 0;
  };

  const confirmPicker = () => {
    if (!sel) return;
    const grams = pickerGrams();
    const kcal = pickerKcal();
    const k100 = parseFloat(kcal100.replace(',', '.'));
    let productId = sel.productId;
    if (!productId) {
      const p = upsertProductByName(sel.name, {
        kcalPer100g: k100 > 0 ? k100 : sel.kcalPer100g, kcalPerPortion: sel.kcalPerPortion,
        protein100: sel.protein100, carbs100: sel.carbs100, fat100: sel.fat100,
        unitGrams: sel.unitGrams, defaultUnit: unit, fromBase: sel.source === 'base',
      });
      productId = p.id;
    } else if (k100 > 0 && k100 !== sel.kcalPer100g) {
      updateProduct(productId, { kcalPer100g: k100 });
    }
    const ov = parseFloat(gramsOverride.replace(',', '.'));
    if (ov > 0 && unit !== 'g' && qty > 0) learnPortion(productId, unit, ov / qty);
    const mac = computeItemMacros({ protein100: sel.protein100, carbs100: sel.carbs100, fat100: sel.fat100 } as any, grams);
    setIngs(prev => [...prev, {
      name: sel.name, productId, qty: unit === 'g' ? 1 : qty, unit, grams: Math.round(grams), kcal,
      protein: mac.protein || undefined, carbs: mac.carbs || undefined, fat: mac.fat || undefined,
    }]);
    setSel(null); setQuery('');
  };

  const canSave = !!name.trim() && ings.length > 0 && cookedG > 0;
  const save = () => {
    if (!canSave) return;
    haptic.success();
    saveRecipeProduct(name.trim(), ings, cookedG, cat, editId);
    router.back();
  };
  const del = () => {
    if (!editId) return;
    Alert.alert('Usunąć „' + name + '"?', 'Usuniesz to danie z biblioteki. Zjedzone wcześniej porcje zostają w historii.', [
      { text: 'Anuluj', style: 'cancel' },
      { text: 'Usuń', style: 'destructive', onPress: () => { haptic.tap(); removeProduct(editId); router.back(); } },
    ]);
  };

  const unitLabel = (u: FoodUnit) => UNIT_META[u].label;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={26} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.headerTitle}>{editId ? 'Edytuj danie' : 'Nowy przepis / danie'}</Text>
        {editId ? <TouchableOpacity onPress={del} hitSlop={10}><Trash2 size={20} color={colors.accent.red} /></TouchableOpacity> : <View style={{ width: 26 }} />}
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* jak to działa */}
        <View style={s.explain}>
          <ChefHat size={16} color={ACCENT} />
          <Text style={s.explainTxt}>Dodaj składniki (w szklankach, jajkach, łyżkach — jak chcesz), potem zważ CAŁE gotowe danie. Policzę kcal na gram, a Ty zjesz ważąc porcję. Wodę i przyprawy bez kalorii możesz pominąć — waga gotowego dania i tak je uwzględnia.</Text>
        </View>

        {/* nazwa + kategoria */}
        <Text style={s.label}>Nazwa dania</Text>
        <TextInput style={s.input} value={name} onChangeText={setName} placeholder="np. Naleśniki pełnoziarniste" placeholderTextColor={c.text.muted} />
        <View style={s.catWrap}>
          {PRESET_CATS.filter(p => p.tag !== 'napoje').map(pc => {
            const on = cat === pc.tag;
            return (
              <TouchableOpacity key={pc.tag} onPress={() => { haptic.tap(); setCat(pc.tag); }}
                style={[s.catChip, on && { backgroundColor: ACCENT + '22', borderColor: ACCENT + '88' }]}>
                <Text style={[s.catTxt, on && { color: ACCENT }]}>{pc.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* składniki */}
        <View style={s.sectionHead}><Text style={s.sectionTitle}>Składniki</Text><Text style={s.sectionSum}>{totals.kcal} kcal · {Math.round(totals.grams)} g surowych</Text></View>
        {ings.length > 0 && (
          <View style={s.card}>
            {ings.map((it, i) => (
              <View key={i} style={[s.ingRow, i > 0 && s.itemBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.ingName} numberOfLines={1}>{it.name}</Text>
                  <Text style={s.ingMeta} numberOfLines={1}>{it.unit === 'g' ? `${it.grams} g` : `${it.qty > 1 ? `${it.qty} × ` : ''}${unitLabel(it.unit)}${it.grams > 0 ? ` · ${it.grams} g` : ''}`}</Text>
                </View>
                <Text style={s.ingKcal}>{it.kcal} kcal</Text>
                <TouchableOpacity hitSlop={8} onPress={() => { haptic.tap(); setIngs(prev => prev.filter((_, j) => j !== i)); }}><Trash2 size={15} color={c.text.muted} /></TouchableOpacity>
              </View>
            ))}
          </View>
        )}

        {/* szukaj / dodaj składnik */}
        <View style={s.searchBox}>
          <Search size={17} color={c.text.muted} />
          <TextInput style={s.searchInput} value={query} onChangeText={setQuery} placeholder="Dodaj składnik…" placeholderTextColor={c.text.muted} />
          {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><X size={16} color={c.text.muted} /></TouchableOpacity>}
        </View>
        {query.trim().length > 0 && !exactExists && (
          <TouchableOpacity style={s.addNewRow} onPress={addNew}>
            <Plus size={17} color={ACCENT} /><Text style={s.addNewTxt}>Dodaj nowy: „{query.trim()}" (gramy + kcal/100g)</Text>
          </TouchableOpacity>
        )}
        <View style={s.card}>
          {candidates.map((cand, i) => (
            <TouchableOpacity key={cand.productId ?? `b-${cand.name}`} onPress={() => openPicker(cand)} style={[s.candRow, i > 0 && s.itemBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.candName} numberOfLines={1}>{cand.name}</Text>
                <Text style={s.candMeta}>{cand.kcalPer100g != null ? `${cand.kcalPer100g} kcal/100g` : cand.kcalPerPortion != null ? `${cand.kcalPerPortion} kcal/porcja` : '—'}{cand.source === 'curated' ? '  ·  moje' : ''}</Text>
              </View>
              <Plus size={18} color={ACCENT} />
            </TouchableOpacity>
          ))}
        </View>

        {/* waga gotowego dania */}
        <View style={s.sectionHead}><Scale size={15} color={ACCENT} /><Text style={s.sectionTitle}>Waga gotowego dania</Text></View>
        <View style={s.weightCard}>
          <TextInput style={s.weightInput} value={cooked} onChangeText={setCooked} keyboardType="numeric" placeholder="np. 780" placeholderTextColor={c.text.muted} />
          <Text style={s.weightUnit}>g</Text>
          <Text style={s.weightHint}>zważ całość po usmażeniu / upieczeniu (bez oleju do smażenia)</Text>
        </View>

        {/* wynik */}
        <View style={s.resultCard}>
          <View style={s.resultTop}>
            <View><Text style={s.resultBig}>{density.kcalPer100g || '—'}</Text><Text style={s.resultSub}>kcal / 100 g</Text></View>
            <View style={s.resultDivider} />
            <View><Text style={s.resultBig}>{density.totalKcal}</Text><Text style={s.resultSub}>kcal całość</Text></View>
          </View>
          {(density.protein100 || density.carbs100 || density.fat100) ? (
            <Text style={s.resultMacros}>na 100 g:  B {density.protein100 ?? 0}  ·  W {density.carbs100 ?? 0}  ·  T {density.fat100 ?? 0}</Text>
          ) : null}
          {cookedG > 0 && density.kcalPer100g > 0 && (
            <Text style={s.resultExample}>przykład: porcja 150 g ≈ {Math.round(density.kcalPer100g * 1.5)} kcal</Text>
          )}
        </View>
      </ScrollView>

      <View style={s.saveBar}>
        <TouchableOpacity style={[s.saveBtn, { backgroundColor: canSave ? ACCENT : c.fill.subtle }]} disabled={!canSave} onPress={save}>
          <Check size={18} color={canSave ? '#1A1206' : c.text.muted} />
          <Text style={[s.saveTxt, { color: canSave ? '#1A1206' : c.text.muted }]}>{editId ? 'Zapisz zmiany' : 'Zapisz danie'}</Text>
        </TouchableOpacity>
      </View>

      {/* ── ingredient portion picker ──────────────────────────────── */}
      <Modal visible={!!sel} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSel(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSel(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.bg.card }]} onPress={() => {}}>
              {sel && (
                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
                  <Text style={s.sheetTitle}>{sel.name}</Text>
                  <View style={s.unitWrap}>
                    {pickerUnits.map(u => {
                      const on = unit === u;
                      return (
                        <TouchableOpacity key={u} onPress={() => { haptic.tap(); setUnit(u); setGramsOverride(''); }}
                          style={[s.unitChip, on && { backgroundColor: ACCENT + '22', borderColor: ACCENT + '88' }]}>
                          <Text style={[s.unitTxt, on && { color: ACCENT }]}>{u === 'g' ? 'gramy (waga)' : unitLabel(u)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>

                  {unit === 'g' ? (
                    <View style={s.fieldRow}>
                      <Text style={s.fieldLabel}>Ile gramów</Text>
                      <TextInput style={s.bigInput} value={gramsOverride} onChangeText={setGramsOverride} keyboardType="numeric" placeholder="np. 130" placeholderTextColor={c.text.muted} autoFocus />
                      <Text style={s.fieldUnit}>g</Text>
                    </View>
                  ) : (
                    <>
                      <View style={s.qtyRow}>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => { haptic.tap(); bumpQty(-1); }}><Minus size={18} color={c.text.primary} /></TouchableOpacity>
                        <View style={s.qtyCenter}>
                          <TextInput style={s.qtyValInput} value={qtyText} onChangeText={t => setQtyText(t.replace(/[^0-9.,]/g, ''))} keyboardType="numeric" selectTextOnFocus />
                          <Text style={s.qtyUnit}>{unitLabel(unit)}</Text>
                        </View>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => { haptic.tap(); bumpQty(1); }}><Plus size={18} color={c.text.primary} /></TouchableOpacity>
                      </View>
                      <Text style={s.qtyHint}>możesz wpisać ułamek — np. 0,5 albo 1,5 szklanki</Text>
                      <View style={s.fieldRow}>
                        <Text style={s.fieldLabel}>Dokładnie (g)</Text>
                        <TextInput style={s.smInput} value={gramsOverride} onChangeText={setGramsOverride} keyboardType="numeric" placeholder={`${Math.round(pickerGrams())}`} placeholderTextColor={c.text.muted} />
                        <Text style={s.fieldHint}>zapamięta „{unitLabel(unit)}"</Text>
                      </View>
                    </>
                  )}

                  <View style={s.fieldRow}>
                    <Text style={s.fieldLabel}>kcal / 100 g</Text>
                    <TextInput style={s.smInput} value={kcal100} onChangeText={setKcal100} keyboardType="numeric" placeholder="np. 364" placeholderTextColor={c.text.muted} />
                    <Text style={s.fieldHint}>{sel.kcalPer100g != null ? 'znane — możesz poprawić' : 'zapamięta się'}</Text>
                  </View>

                  <View style={s.sheetKcal}><Text style={s.sheetKcalVal}>{pickerKcal()} kcal</Text><Text style={s.sheetKcalSub}>{Math.round(pickerGrams())} g × {dens() || '—'}/100g</Text></View>
                  <TouchableOpacity style={[s.sheetAdd, { backgroundColor: pickerGrams() > 0 ? ACCENT : c.fill.subtle }]}
                    disabled={!(pickerGrams() > 0)} onPress={confirmPicker}>
                    <Plus size={18} color="#1A1206" /><Text style={s.sheetAddTxt}>Dodaj składnik</Text>
                  </TouchableOpacity>
                </ScrollView>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  headerTitle: { fontSize: 17, fontWeight: '800', color: c.text.primary },
  scroll:    { padding: spacing[4], gap: spacing[3], paddingBottom: 120 },

  explain:    { flexDirection: 'row', gap: 10, alignItems: 'flex-start', backgroundColor: ACCENT + '14', borderRadius: radius.lg, borderWidth: 1, borderColor: ACCENT + '44', padding: spacing[3] },
  explainTxt: { flex: 1, fontSize: 12, color: c.text.secondary, lineHeight: 17 },

  label: { fontSize: 12, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5 },
  input: { height: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], fontSize: 15, color: c.text.primary, backgroundColor: c.bg.card },

  catWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7 },
  catChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  catTxt:  { fontSize: 12, fontWeight: '700', color: c.text.secondary },

  sectionHead:  { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing[2] },
  sectionTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary, flex: 1 },
  sectionSum:   { fontSize: 12, fontWeight: '700', color: c.text.muted },

  card: { backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[3], borderWidth: 1, borderColor: c.border.subtle },
  itemBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },

  ingRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 8 },
  ingName: { fontSize: 14, fontWeight: '700', color: c.text.primary },
  ingMeta: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },
  ingKcal: { fontSize: 13, fontWeight: '800', color: c.text.secondary, fontVariant: ['tabular-nums'] },

  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle, paddingHorizontal: spacing[3], height: 46 },
  searchInput: { flex: 1, fontSize: 15, color: c.text.primary },
  addNewRow:   { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing[3], paddingVertical: 11, borderRadius: radius.lg, borderWidth: 1, borderColor: ACCENT + '55', borderStyle: 'dashed' },
  addNewTxt:   { fontSize: 13, fontWeight: '700', color: ACCENT, flex: 1 },

  candRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 9 },
  candName: { fontSize: 14, fontWeight: '600', color: c.text.primary },
  candMeta: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },

  weightCard: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.subtle, padding: spacing[3] },
  weightInput: { width: 110, height: 52, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, textAlign: 'center', fontSize: 24, fontWeight: '800', color: c.text.primary },
  weightUnit:  { fontSize: 16, fontWeight: '800', color: c.text.secondary },
  weightHint:  { flex: 1, fontSize: 11.5, color: c.text.muted, lineHeight: 15 },

  resultCard:    { backgroundColor: ACCENT + '14', borderRadius: radius.xl, borderWidth: 1, borderColor: ACCENT + '44', padding: spacing[4], gap: spacing[2] },
  resultTop:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  resultDivider: { width: 1, height: 36, backgroundColor: c.border.default },
  resultBig:     { fontSize: 26, fontWeight: '800', color: ACCENT, textAlign: 'center' },
  resultSub:     { fontSize: 11, fontWeight: '700', color: c.text.muted, textAlign: 'center' },
  resultMacros:  { fontSize: 12, fontWeight: '700', color: c.text.secondary, textAlign: 'center' },
  resultExample: { fontSize: 12, color: c.text.muted, textAlign: 'center' },

  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing[4], paddingBottom: spacing[5], backgroundColor: c.bg.primary + 'F2' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.full },
  saveTxt: { fontSize: 15, fontWeight: '800' },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[4] },
  sheet:      { borderRadius: radius.xl, padding: spacing[4], gap: spacing[3], borderWidth: 1, borderColor: c.border.default },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },

  unitWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  unitChip: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  unitTxt:  { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },

  qtyRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  qtyBtn:    { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  qtyCenter: { alignItems: 'center', minWidth: 96 },
  qtyValInput: { minWidth: 74, height: 44, textAlign: 'center', fontSize: 28, fontWeight: '800', color: c.text.primary, borderBottomWidth: 1, borderBottomColor: c.border.default },
  qtyUnit:   { fontSize: 12, fontWeight: '600', color: c.text.muted, marginTop: 2 },
  qtyHint:   { fontSize: 11, color: c.text.muted, textAlign: 'center' },

  fieldRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[1] },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary, width: 88 },
  fieldUnit:  { fontSize: 14, fontWeight: '700', color: c.text.muted },
  fieldHint:  { fontSize: 11, color: c.text.muted, flex: 1 },
  bigInput:   { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, textAlign: 'center', fontSize: 22, fontWeight: '800', color: c.text.primary },
  smInput:    { width: 76, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, textAlign: 'center', fontSize: 16, fontWeight: '700', color: c.text.primary },

  sheetKcal:    { alignItems: 'center', gap: 1 },
  sheetKcalVal: { fontSize: 22, fontWeight: '800', color: ACCENT },
  sheetKcalSub: { fontSize: 11.5, color: c.text.muted },
  sheetAdd:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.full },
  sheetAddTxt:  { fontSize: 14, fontWeight: '800', color: '#1A1206' },
}));
