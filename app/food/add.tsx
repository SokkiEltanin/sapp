import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Search, Plus, Minus, X, Pencil, Check, Trash2 } from 'lucide-react-native';

import {
  useFoodStore, UNIT_META, unitToGrams, computeItemKcal,
  MealItem, MealType, MEAL_TYPES, FoodUnit,
} from '@/store/foodStore';
import { searchFoodBase } from '@/data/foodBase';
import { normalizeProductName } from '@/utils/productMemory';
import { spacing, radius, colors } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const ACCENT = '#F59E0B';

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'sniadanie';
  if (h < 16) return 'obiad';
  if (h < 21) return 'kolacja';
  return 'przekaska';
}

// A pickable food — from the user's counted DB (curated) or the offline base.
interface Candidate {
  name: string;
  kcalPer100g?: number;
  kcalPerPortion?: number;
  unitGrams?: Partial<Record<FoodUnit, number>>;
  defaultUnit?: FoodUnit;
  productId?: string;
  source: 'curated' | 'base';
}

export default function FoodAdd() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  const products            = useFoodStore(st => st.products);
  const addMeal             = useFoodStore(st => st.addMeal);
  const upsertProductByName = useFoodStore(st => st.upsertProductByName);
  const learnPortion        = useFoodStore(st => st.learnPortion);

  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [items, setItems]       = useState<MealItem[]>([]);
  const [note, setNote]         = useState('');
  const [query, setQuery]       = useState('');

  // portion picker (for a selected candidate)
  const [sel, setSel]           = useState<Candidate | null>(null);
  const [unit, setUnit]         = useState<FoodUnit>('g');
  const [qty, setQty]           = useState(1);
  const [gramsOverride, setGramsOverride] = useState('');

  // manual entry
  const [manual, setManual] = useState(false);
  const [mName, setMName]   = useState('');
  const [mKcal, setMKcal]   = useState('');

  const total = items.reduce((sum, it) => sum + it.kcal, 0);

  // ── candidate list ───────────────────────────────────────────────────────
  const candidates: Candidate[] = useMemo(() => {
    const curated: Candidate[] = products.map(p => ({
      name: p.name, kcalPer100g: p.kcalPer100g, kcalPerPortion: p.kcalPerPortion,
      unitGrams: p.unitGrams, defaultUnit: p.defaultUnit, productId: p.id, source: 'curated',
      _rank: (p.fresh && Date.now() - p.fresh < 7 * 864e5 ? 1e12 : 0) + (p.lastUsed ?? 0) + p.uses * 1000,
    } as any));
    const q = query.trim();
    if (!q) {
      // recent / fresh first, then base staples to fill
      curated.sort((a: any, b: any) => b._rank - a._rank);
      const seen = new Set(curated.map(x => normalizeProductName(x.name)));
      const base: Candidate[] = searchFoodBase('', 14)
        .filter(f => !seen.has(normalizeProductName(f.name)))
        .map(f => ({ name: f.name, kcalPer100g: f.kcal, unitGrams: f.unitGrams, defaultUnit: f.unit, source: 'base' }));
      return [...curated.slice(0, 10), ...base];
    }
    const nq = normalizeProductName(q);
    const curatedMatch = curated.filter(x => normalizeProductName(x.name).includes(nq));
    const seen = new Set(curatedMatch.map(x => normalizeProductName(x.name)));
    const base: Candidate[] = searchFoodBase(q, 24)
      .filter(f => !seen.has(normalizeProductName(f.name)))
      .map(f => ({ name: f.name, kcalPer100g: f.kcal, unitGrams: f.unitGrams, defaultUnit: f.unit, source: 'base' }));
    return [...curatedMatch, ...base];
  }, [products, query]);

  // ── picker helpers ───────────────────────────────────────────────────────
  const pickerUnits = useMemo(() => {
    if (!sel) return ['g'] as FoodUnit[];
    const own = Object.keys(sel.unitGrams ?? {}) as FoodUnit[];
    const list = [sel.defaultUnit, ...own, 'g', 'porcja'].filter(Boolean) as FoodUnit[];
    return Array.from(new Set(list));
  }, [sel]);

  const openPicker = (cand: Candidate) => {
    haptic.tap();
    const u = cand.defaultUnit ?? (Object.keys(cand.unitGrams ?? {})[0] as FoodUnit) ?? 'g';
    setSel(cand); setUnit(u); setQty(1); setGramsOverride('');
  };

  const pickerGrams = () => {
    if (!sel) return 0;
    const ov = parseFloat(gramsOverride.replace(',', '.'));
    if (ov > 0) return ov;
    return qty * unitToGrams(sel as any, unit);
  };
  const pickerKcal = () => {
    if (!sel) return 0;
    return computeItemKcal({ kcalPer100g: sel.kcalPer100g, kcalPerPortion: sel.kcalPerPortion } as any, unit, qty, pickerGrams());
  };

  const confirmPicker = () => {
    if (!sel) return;
    const grams = pickerGrams();
    const kcal = pickerKcal();
    let productId = sel.productId;
    if (!productId) {
      const p = upsertProductByName(sel.name, {
        kcalPer100g: sel.kcalPer100g, kcalPerPortion: sel.kcalPerPortion,
        unitGrams: sel.unitGrams, defaultUnit: unit, fromBase: sel.source === 'base',
      });
      productId = p.id;
    }
    const ov = parseFloat(gramsOverride.replace(',', '.'));
    if (ov > 0 && unit !== 'g' && qty > 0) learnPortion(productId, unit, ov / qty);
    setItems(prev => [...prev, { name: sel.name, productId, qty, unit, grams: Math.round(grams), kcal }]);
    setSel(null);
  };

  const confirmManual = () => {
    const name = mName.trim();
    const kcal = Math.round(parseFloat(mKcal.replace(',', '.')));
    if (!name || !(kcal > 0)) return;
    const p = upsertProductByName(name, { kcalPerPortion: kcal, defaultUnit: 'porcja' });
    setItems(prev => [...prev, { name, productId: p.id, qty: 1, unit: 'porcja', grams: 0, kcal }]);
    setManual(false); setMName(''); setMKcal('');
  };

  const save = () => {
    if (items.length === 0) return;
    haptic.success();
    addMeal(mealType, items, note.trim() || undefined);
    router.back();
  };

  const unitLabel = (u: FoodUnit) => UNIT_META[u].label;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={26} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.headerTitle}>Co zjadłem</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {/* meal type */}
        <View style={s.typeRow}>
          {MEAL_TYPES.map(mt => {
            const on = mealType === mt.id;
            return (
              <TouchableOpacity key={mt.id} onPress={() => { haptic.tap(); setMealType(mt.id); }}
                style={[s.typeChip, on && { backgroundColor: ACCENT + '22', borderColor: ACCENT + '88' }]}>
                <Text style={[s.typeTxt, on && { color: ACCENT }]}>{mt.label}</Text>
              </TouchableOpacity>
            );
          })}
        </View>

        {/* added items */}
        {items.length > 0 && (
          <View style={s.card}>
            {items.map((it, i) => (
              <View key={i} style={[s.itemRow, i > 0 && s.itemBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName} numberOfLines={1}>{it.name}</Text>
                  <Text style={s.itemMeta}>{it.qty > 1 ? `${it.qty} × ` : ''}{unitLabel(it.unit)}{it.grams > 0 ? ` · ${it.grams} g` : ''}</Text>
                </View>
                <Text style={s.itemKcal}>{it.kcal} kcal</Text>
                <TouchableOpacity hitSlop={8} onPress={() => { haptic.tap(); setItems(prev => prev.filter((_, j) => j !== i)); }}><Trash2 size={15} color={c.text.muted} /></TouchableOpacity>
              </View>
            ))}
            <View style={s.totalRow}><Text style={s.totalLabel}>Razem</Text><Text style={s.totalVal}>{total} kcal</Text></View>
          </View>
        )}

        {/* search */}
        <View style={s.searchBox}>
          <Search size={17} color={c.text.muted} />
          <TextInput style={s.searchInput} value={query} onChangeText={setQuery}
            placeholder="Szukaj jedzenia…" placeholderTextColor={c.text.muted} />
          {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><X size={16} color={c.text.muted} /></TouchableOpacity>}
        </View>

        <TouchableOpacity style={s.manualBtn} onPress={() => { haptic.tap(); setMName(query); setMKcal(''); setManual(true); }}>
          <Pencil size={15} color={ACCENT} /><Text style={s.manualTxt}>Wpisz ręcznie (kcal na oko)</Text>
        </TouchableOpacity>

        {!query && <Text style={s.sectionHint}>{products.length > 0 ? 'Ostatnie i baza' : 'Baza produktów'}</Text>}

        <View style={s.card}>
          {candidates.map((cand, i) => (
            <TouchableOpacity key={cand.productId ?? `b-${cand.name}`} onPress={() => openPicker(cand)}
              style={[s.candRow, i > 0 && s.itemBorder]}>
              <View style={{ flex: 1 }}>
                <Text style={s.candName} numberOfLines={1}>{cand.name}</Text>
                <Text style={s.candMeta}>
                  {cand.kcalPer100g != null ? `${cand.kcalPer100g} kcal/100g` : cand.kcalPerPortion != null ? `${cand.kcalPerPortion} kcal/porcja` : '—'}
                  {cand.source === 'curated' ? '  ·  moje' : ''}
                </Text>
              </View>
              <Plus size={18} color={ACCENT} />
            </TouchableOpacity>
          ))}
          {candidates.length === 0 && <Text style={s.candMeta}>Brak trafień — użyj „Wpisz ręcznie".</Text>}
        </View>
      </ScrollView>

      {/* save bar */}
      <View style={s.saveBar}>
        <TouchableOpacity style={[s.saveBtn, { backgroundColor: items.length ? ACCENT : c.fill.subtle }]} disabled={!items.length} onPress={save}>
          <Check size={18} color={items.length ? '#1A1206' : c.text.muted} />
          <Text style={[s.saveTxt, { color: items.length ? '#1A1206' : c.text.muted }]}>Zapisz{total > 0 ? ` · ${total} kcal` : ''}</Text>
        </TouchableOpacity>
      </View>

      {/* ── portion picker ─────────────────────────────────────────── */}
      <Modal visible={!!sel} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSel(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSel(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.bg.card }]} onPress={() => {}}>
              {sel && (
                <>
                  <Text style={s.sheetTitle}>{sel.name}</Text>
                  {/* unit chips */}
                  <View style={s.unitWrap}>
                    {pickerUnits.map(u => {
                      const on = unit === u;
                      return (
                        <TouchableOpacity key={u} onPress={() => { haptic.tap(); setUnit(u); setGramsOverride(''); }}
                          style={[s.unitChip, on && { backgroundColor: ACCENT + '22', borderColor: ACCENT + '88' }]}>
                          <Text style={[s.unitTxt, on && { color: ACCENT }]}>{unitLabel(u)}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {/* qty stepper */}
                  <View style={s.qtyRow}>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => { haptic.tap(); setQty(q => Math.max(0.5, +(q - (q > 2 ? 1 : 0.5)).toFixed(1))); }}><Minus size={18} color={c.text.primary} /></TouchableOpacity>
                    <View style={s.qtyCenter}>
                      <Text style={s.qtyVal}>{qty % 1 === 0 ? qty : qty.toFixed(1)}</Text>
                      <Text style={s.qtyUnit}>{unitLabel(unit)}{qty !== 1 && unit !== 'g' ? '' : ''}</Text>
                    </View>
                    <TouchableOpacity style={s.qtyBtn} onPress={() => { haptic.tap(); setQty(q => +(q + (q >= 2 ? 1 : 0.5)).toFixed(1)); }}><Plus size={18} color={c.text.primary} /></TouchableOpacity>
                  </View>
                  {/* optional exact grams */}
                  {unit !== 'g' && (
                    <View style={s.gramsRow}>
                      <Text style={s.gramsLabel}>Dokładnie (g):</Text>
                      <TextInput style={s.gramsInput} value={gramsOverride} onChangeText={setGramsOverride}
                        keyboardType="numeric" placeholder={`${Math.round(pickerGrams())}`} placeholderTextColor={c.text.muted} />
                      <Text style={s.gramsHint}>zapamięta „{unitLabel(unit)}"</Text>
                    </View>
                  )}
                  <View style={s.sheetKcal}><Text style={s.sheetKcalVal}>{pickerKcal()} kcal</Text><Text style={s.sheetKcalSub}>≈ {Math.round(pickerGrams())} g</Text></View>
                  <TouchableOpacity style={[s.sheetAdd, { backgroundColor: ACCENT }]} onPress={confirmPicker}>
                    <Plus size={18} color="#1A1206" /><Text style={s.sheetAddTxt}>Dodaj do posiłku</Text>
                  </TouchableOpacity>
                </>
              )}
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* ── manual entry ───────────────────────────────────────────── */}
      <Modal visible={manual} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setManual(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setManual(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.bg.card }]} onPress={() => {}}>
              <Text style={s.sheetTitle}>Wpisz ręcznie</Text>
              <Text style={s.sheetSub}>Nazwa i kalorie „na oko". Zapamięta się jako produkt na później.</Text>
              <TextInput style={s.mInput} value={mName} onChangeText={setMName} placeholder="Nazwa (np. Obiad u mamy)" placeholderTextColor={c.text.muted} />
              <TextInput style={s.mInput} value={mKcal} onChangeText={setMKcal} keyboardType="numeric" placeholder="Kalorie (kcal)" placeholderTextColor={c.text.muted} />
              <TouchableOpacity style={[s.sheetAdd, { backgroundColor: mName.trim() && +mKcal > 0 ? ACCENT : c.fill.subtle }]}
                disabled={!(mName.trim() && +mKcal.replace(',', '.') > 0)} onPress={confirmManual}>
                <Check size={18} color={mName.trim() && +mKcal > 0 ? '#1A1206' : c.text.muted} />
                <Text style={[s.sheetAddTxt, { color: mName.trim() && +mKcal > 0 ? '#1A1206' : c.text.muted }]}>Dodaj</Text>
              </TouchableOpacity>
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

  card: { backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[3], borderWidth: 1, borderColor: c.border.subtle },

  typeRow:  { flexDirection: 'row', gap: spacing[2] },
  typeChip: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  typeTxt:  { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },

  itemRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 8 },
  itemBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  itemName:   { fontSize: 14, fontWeight: '700', color: c.text.primary },
  itemMeta:   { fontSize: 11.5, color: c.text.muted, marginTop: 1 },
  itemKcal:   { fontSize: 13, fontWeight: '800', color: c.text.secondary, fontVariant: ['tabular-nums'] },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: c.border.default },
  totalLabel: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  totalVal:   { fontSize: 16, fontWeight: '800', color: ACCENT },

  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle, paddingHorizontal: spacing[3], height: 46 },
  searchInput: { flex: 1, fontSize: 15, color: c.text.primary },

  manualBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  manualTxt: { fontSize: 13, fontWeight: '700', color: ACCENT },

  sectionHint: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 2 },

  candRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 9 },
  candName: { fontSize: 14, fontWeight: '600', color: c.text.primary },
  candMeta: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },

  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, padding: spacing[4], paddingBottom: spacing[5], backgroundColor: c.bg.primary + 'F2' },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 52, borderRadius: radius.full },
  saveTxt: { fontSize: 15, fontWeight: '800' },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[4] },
  sheet:      { borderRadius: radius.xl, padding: spacing[4], gap: spacing[3], borderWidth: 1, borderColor: c.border.default },
  sheetTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  sheetSub:   { fontSize: 12, color: c.text.muted, lineHeight: 16, marginTop: -6 },

  unitWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  unitChip: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  unitTxt:  { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },

  qtyRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  qtyBtn:    { width: 46, height: 46, borderRadius: 23, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  qtyCenter: { alignItems: 'center', minWidth: 90 },
  qtyVal:    { fontSize: 30, fontWeight: '800', color: c.text.primary },
  qtyUnit:   { fontSize: 12, fontWeight: '600', color: c.text.muted },

  gramsRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  gramsLabel: { fontSize: 12.5, fontWeight: '600', color: c.text.secondary },
  gramsInput: { width: 70, height: 38, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, textAlign: 'center', fontSize: 15, fontWeight: '700', color: c.text.primary },
  gramsHint:  { fontSize: 11, color: c.text.muted, flex: 1 },

  sheetKcal:    { alignItems: 'center', gap: 1 },
  sheetKcalVal: { fontSize: 22, fontWeight: '800', color: ACCENT },
  sheetKcalSub: { fontSize: 11.5, color: c.text.muted },
  sheetAdd:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.full },
  sheetAddTxt:  { fontSize: 14, fontWeight: '800', color: '#1A1206' },

  mInput: { height: 46, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], fontSize: 15, color: c.text.primary },
}));
