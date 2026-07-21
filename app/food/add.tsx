import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Search, Plus, Minus, X, Pencil, Check, Trash2, Star, RotateCcw, Layers } from 'lucide-react-native';

import {
  useFoodStore, UNIT_META, unitToGrams, computeItemKcal,
  MealItem, MealType, MEAL_TYPES, FoodUnit, MealPreset, MealEntry,
  presetKcal, presetGrams, presetToItem,
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
  const presets             = useFoodStore(st => st.presets);
  const storeMeals          = useFoodStore(st => st.meals);
  const addMeal             = useFoodStore(st => st.addMeal);
  const addPreset           = useFoodStore(st => st.addPreset);
  const removePreset        = useFoodStore(st => st.removePreset);
  const bumpPreset          = useFoodStore(st => st.bumpPreset);
  const upsertProductByName = useFoodStore(st => st.upsertProductByName);
  const updateProduct       = useFoodStore(st => st.updateProduct);
  const learnPortion        = useFoodStore(st => st.learnPortion);

  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [items, setItems]       = useState<MealItem[]>([]);
  const [note, setNote]         = useState('');
  const [query, setQuery]       = useState('');

  // portion picker (for a selected candidate)
  const [sel, setSel]           = useState<Candidate | null>(null);
  const [unit, setUnit]         = useState<FoodUnit>('g');
  const [qty, setQty]           = useState(1);
  const [gramsOverride, setGramsOverride] = useState('');   // for unit 'g' this IS the grams (from the scale)
  const [kcal100, setKcal100]             = useState('');   // kcal per 100 g used for the calc (prefilled if known)

  // manual entry
  const [manual, setManual] = useState(false);
  const [mName, setMName]   = useState('');
  const [mKcal, setMKcal]   = useState('');

  // preset apply (×1/2/3, or portions for a dish) + save-as-preset
  const [applying, setApplying] = useState<MealPreset | null>(null);
  const [mult, setMult]         = useState(1);          // assembled meal ×N
  const [dishPortions, setDishPortions] = useState(1);  // dish: portions eaten (of its `yields`)
  const [saveP, setSaveP]       = useState(false);
  const [pName, setPName]       = useState('');
  const [pYields, setPYields]   = useState('');         // "ile porcji wychodzi" (dish)

  const total = items.reduce((sum, it) => sum + it.kcal, 0);

  // recent meals to repeat ("to samo co wczoraj") — distinct by summary, newest first
  const recentMeals: MealEntry[] = useMemo(() => {
    const seen = new Set<string>();
    const out: MealEntry[] = [];
    for (const m of [...storeMeals].sort((a, b) => b.ts - a.ts)) {
      const sig = m.items.map(i => i.name).join('|');
      if (!sig || seen.has(sig)) continue;
      seen.add(sig); out.push(m);
      if (out.length >= 6) break;
    }
    return out;
  }, [storeMeals]);

  const applyPreset = () => {
    if (!applying) return;
    const isDish = !!(applying.yields && applying.yields > 1);
    if (isDish) {
      const factor = dishPortions / applying.yields!;          // fraction of the whole batch
      setItems(prev => [...prev, {
        name: applying.name, qty: dishPortions, unit: 'porcja' as FoodUnit,
        grams: Math.round(presetGrams(applying) * factor), kcal: Math.round(presetKcal(applying) * factor),
        parts: applying.items.map(it => ({ ...it })), presetId: applying.id,
      }]);
    } else {
      setItems(prev => [...prev, presetToItem(applying, mult)]);
    }
    bumpPreset(applying.id);
    setApplying(null);
  };
  const repeatMeal = (m: MealEntry) => {
    haptic.tap();
    setItems(prev => [...prev, ...m.items.map(it => ({ ...it }))]);
    setMealType(m.type);
  };
  const saveAsPreset = () => {
    const nm = pName.trim();
    if (!nm || items.length === 0) return;
    const yields = parseFloat(pYields.replace(',', '.'));
    addPreset(nm, items.map(it => ({ ...it })), mealType, yields > 1 ? Math.round(yields) : undefined);
    setSaveP(false); setPName(''); setPYields('');
  };

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
    // With a kitchen scale the grams path is the accurate one, so default to 'g' when
    // the food is density-based (kcal/100g); otherwise its household unit.
    const u: FoodUnit = cand.kcalPer100g != null ? 'g' : (cand.defaultUnit ?? (Object.keys(cand.unitGrams ?? {})[0] as FoodUnit) ?? 'g');
    setSel(cand); setUnit(u); setQty(1); setGramsOverride('');
    setKcal100(cand.kcalPer100g != null ? String(cand.kcalPer100g) : '');
  };

  const density = () => {
    const k = parseFloat(kcal100.replace(',', '.'));
    return k > 0 ? k : (sel?.kcalPer100g ?? 0);
  };
  const pickerGrams = () => {
    if (!sel) return 0;
    const g = parseFloat(gramsOverride.replace(',', '.'));   // the grams field ('g' unit) or exact-override
    if (unit === 'g') return g > 0 ? g : 0;
    if (g > 0) return g;
    return qty * unitToGrams(sel as any, unit);
  };
  const pickerKcal = () => {
    if (!sel) return 0;
    const d = density();
    if (d > 0) return Math.round(pickerGrams() / 100 * d);
    if (sel.kcalPerPortion != null) return Math.round(sel.kcalPerPortion * qty);   // fixed-kcal fallback
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
        unitGrams: sel.unitGrams, defaultUnit: unit, fromBase: sel.source === 'base',
      });
      productId = p.id;
    } else if (k100 > 0 && k100 !== sel.kcalPer100g) {
      updateProduct(productId, { kcalPer100g: k100 });   // user set/corrected the density → remember it
    }
    const ov = parseFloat(gramsOverride.replace(',', '.'));
    if (ov > 0 && unit !== 'g' && qty > 0) learnPortion(productId, unit, ov / qty);
    setItems(prev => [...prev, { name: sel.name, productId, qty: unit === 'g' ? 1 : qty, unit, grams: Math.round(grams), kcal }]);
    setSel(null);
  };

  // add a brand-new product straight from the search box → the grams+kcal/100g picker
  const addNew = () => {
    const name = query.trim();
    if (!name) return;
    openPicker({ name, source: 'base' });
  };
  const exactExists = useMemo(() => {
    const nq = normalizeProductName(query);
    return !!nq && candidates.some(x => normalizeProductName(x.name) === nq);
  }, [query, candidates]);

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

        {/* quick: presets + repeat recent */}
        {(presets.length > 0 || recentMeals.length > 0) && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.quickRow}>
            {presets.map(p => (
              <TouchableOpacity key={p.id} style={s.quickChip} onPress={() => { haptic.tap(); setMult(1); setDishPortions(1); setApplying(p); }}
                onLongPress={() => { haptic.tap(); removePreset(p.id); }} delayLongPress={450}>
                <Star size={13} color={ACCENT} fill={ACCENT} />
                <Text style={s.quickTxt} numberOfLines={1}>{p.name}{p.yields && p.yields > 1 ? ` · ${p.yields} porcji` : ''}</Text>
                <Text style={s.quickKcal}>{p.yields && p.yields > 1 ? Math.round(presetKcal(p) / p.yields) : presetKcal(p)}</Text>
              </TouchableOpacity>
            ))}
            {recentMeals.map(m => (
              <TouchableOpacity key={m.id} style={[s.quickChip, { borderStyle: 'dashed' }]} onPress={() => repeatMeal(m)}>
                <RotateCcw size={13} color={c.text.muted} />
                <Text style={s.quickTxt} numberOfLines={1}>{m.items.map(i => i.name).slice(0, 2).join(', ')}</Text>
                <Text style={s.quickKcal}>{m.kcal}</Text>
              </TouchableOpacity>
            ))}
          </ScrollView>
        )}

        {/* added items */}
        {items.length > 0 && (
          <View style={s.card}>
            {items.map((it, i) => (
              <View key={i} style={[s.itemRow, i > 0 && s.itemBorder]}>
                <View style={{ flex: 1 }}>
                  <Text style={s.itemName} numberOfLines={1}>
                    {it.parts ? <Layers size={12} color={ACCENT} /> : null}{it.parts ? ' ' : ''}{it.name}{it.parts && it.qty > 1 ? ` ×${it.qty}` : ''}
                  </Text>
                  <Text style={s.itemMeta} numberOfLines={1}>
                    {it.parts ? it.parts.map(p => p.name).join(', ')
                      : it.unit === 'g' ? `${it.grams} g`
                      : `${it.qty > 1 ? `${it.qty} × ` : ''}${unitLabel(it.unit)}${it.grams > 0 ? ` · ${it.grams} g` : ''}`}
                  </Text>
                </View>
                <Text style={s.itemKcal}>{it.kcal} kcal</Text>
                <TouchableOpacity hitSlop={8} onPress={() => { haptic.tap(); setItems(prev => prev.filter((_, j) => j !== i)); }}><Trash2 size={15} color={c.text.muted} /></TouchableOpacity>
              </View>
            ))}
            <View style={s.totalRow}>
              <TouchableOpacity style={s.savePresetBtn} onPress={() => { haptic.tap(); setPName(''); setSaveP(true); }}>
                <Star size={13} color={ACCENT} /><Text style={s.savePresetTxt}>Zapisz jako preset</Text>
              </TouchableOpacity>
              <Text style={s.totalVal}>{total} kcal</Text>
            </View>
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

        {/* add a brand-new product straight from the search → grams + kcal/100g picker */}
        {query.trim().length > 0 && !exactExists && (
          <TouchableOpacity style={s.addNewRow} onPress={addNew}>
            <Plus size={17} color={ACCENT} />
            <Text style={s.addNewTxt}>Dodaj nowy: „{query.trim()}" (gramy + kcal/100g)</Text>
          </TouchableOpacity>
        )}

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
                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
                  <Text style={s.sheetTitle}>{sel.name}</Text>
                  {/* unit chips — 'g' first for the scale workflow */}
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
                    /* grams straight from the scale */
                    <View style={s.fieldRow}>
                      <Text style={s.fieldLabel}>Ile gramów</Text>
                      <TextInput style={s.bigInput} value={gramsOverride} onChangeText={setGramsOverride}
                        keyboardType="numeric" placeholder="np. 15" placeholderTextColor={c.text.muted} autoFocus />
                      <Text style={s.fieldUnit}>g</Text>
                    </View>
                  ) : (
                    <>
                      <View style={s.qtyRow}>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => { haptic.tap(); setQty(q => Math.max(0.5, +(q - (q > 2 ? 1 : 0.5)).toFixed(1))); }}><Minus size={18} color={c.text.primary} /></TouchableOpacity>
                        <View style={s.qtyCenter}>
                          <Text style={s.qtyVal}>{qty % 1 === 0 ? qty : qty.toFixed(1)}</Text>
                          <Text style={s.qtyUnit}>{unitLabel(unit)}</Text>
                        </View>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => { haptic.tap(); setQty(q => +(q + (q >= 2 ? 1 : 0.5)).toFixed(1)); }}><Plus size={18} color={c.text.primary} /></TouchableOpacity>
                      </View>
                      <View style={s.fieldRow}>
                        <Text style={s.fieldLabel}>Dokładnie (g)</Text>
                        <TextInput style={s.smInput} value={gramsOverride} onChangeText={setGramsOverride}
                          keyboardType="numeric" placeholder={`${Math.round(pickerGrams())}`} placeholderTextColor={c.text.muted} />
                        <Text style={s.fieldHint}>zapamięta „{unitLabel(unit)}"</Text>
                      </View>
                    </>
                  )}

                  {/* kcal per 100 g — prefilled if known, else fill from the packaging */}
                  <View style={s.fieldRow}>
                    <Text style={s.fieldLabel}>kcal / 100 g</Text>
                    <TextInput style={s.smInput} value={kcal100} onChangeText={setKcal100}
                      keyboardType="numeric" placeholder="np. 350" placeholderTextColor={c.text.muted} />
                    <Text style={s.fieldHint}>{sel.kcalPer100g != null ? 'znane — możesz poprawić' : 'zapamięta się'}</Text>
                  </View>

                  <View style={s.sheetKcal}><Text style={s.sheetKcalVal}>{pickerKcal()} kcal</Text><Text style={s.sheetKcalSub}>{Math.round(pickerGrams())} g × {density() || '—'}/100g</Text></View>
                  <TouchableOpacity style={[s.sheetAdd, { backgroundColor: pickerKcal() > 0 || pickerGrams() > 0 ? ACCENT : c.fill.subtle }]}
                    disabled={!(pickerGrams() > 0 && (density() > 0 || sel.kcalPerPortion != null))} onPress={confirmPicker}>
                    <Plus size={18} color="#1A1206" /><Text style={s.sheetAddTxt}>Dodaj do posiłku</Text>
                  </TouchableOpacity>
                </ScrollView>
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

      {/* ── apply preset ×1/2/3 ────────────────────────────────────── */}
      <Modal visible={!!applying} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setApplying(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setApplying(null)}>
          <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.bg.card }]} onPress={() => {}}>
            {applying && (() => {
              const isDish = !!(applying.yields && applying.yields > 1);
              const total = presetKcal(applying);
              const kcalNow = isDish ? Math.round(total * (dishPortions / applying.yields!)) : Math.round(total * mult);
              return (
              <>
                <Text style={s.sheetTitle}>{applying.name}</Text>
                <Text style={s.sheetSub}>{applying.items.map(i => i.name).join(', ')}{isDish ? `  ·  całość ${total} kcal / ${applying.yields} porcji` : ''}</Text>
                {isDish ? (
                  <>
                    <View style={s.qtyRow}>
                      <TouchableOpacity style={s.qtyBtn} onPress={() => { haptic.tap(); setDishPortions(q => Math.max(0.5, +(q - 0.5).toFixed(1))); }}><Minus size={18} color={c.text.primary} /></TouchableOpacity>
                      <View style={s.qtyCenter}>
                        <Text style={s.qtyVal}>{dishPortions % 1 === 0 ? dishPortions : dishPortions.toFixed(1)}</Text>
                        <Text style={s.qtyUnit}>z {applying.yields} porcji</Text>
                      </View>
                      <TouchableOpacity style={s.qtyBtn} onPress={() => { haptic.tap(); setDishPortions(q => Math.min(applying.yields!, +(q + 0.5).toFixed(1))); }}><Plus size={18} color={c.text.primary} /></TouchableOpacity>
                    </View>
                  </>
                ) : (
                  <View style={s.multRow}>
                    {[1, 2, 3].map(n => {
                      const on = mult === n;
                      return (
                        <TouchableOpacity key={n} onPress={() => { haptic.tap(); setMult(n); }}
                          style={[s.multChip, on && { backgroundColor: ACCENT + '22', borderColor: ACCENT + '88' }]}>
                          <Text style={[s.multTxt, on && { color: ACCENT }]}>×{n}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                )}
                <View style={s.sheetKcal}><Text style={s.sheetKcalVal}>{kcalNow} kcal</Text></View>
                <TouchableOpacity style={[s.sheetAdd, { backgroundColor: ACCENT }]} onPress={applyPreset}>
                  <Plus size={18} color="#1A1206" /><Text style={s.sheetAddTxt}>Dodaj do posiłku</Text>
                </TouchableOpacity>
              </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* ── save current items as preset ───────────────────────────── */}
      <Modal visible={saveP} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSaveP(false)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSaveP(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.bg.card }]} onPress={() => {}}>
              <Text style={s.sheetTitle}>Zapisz jako preset</Text>
              <Text style={s.sheetSub}>{items.map(i => i.name).join(', ')} · {total} kcal — dodasz to jednym stuknięciem następnym razem.</Text>
              <TextInput style={s.mInput} value={pName} onChangeText={setPName} placeholder="Nazwa (np. Kanapka / Puree)" placeholderTextColor={c.text.muted} autoFocus />
              <View style={s.fieldRow}>
                <Text style={s.fieldLabel}>Porcji wychodzi</Text>
                <TextInput style={s.smInput} value={pYields} onChangeText={setPYields} keyboardType="numeric" placeholder="1" placeholderTextColor={c.text.muted} />
                <Text style={s.fieldHint}>danie na kilka porcji (np. puree) — puste = całość</Text>
              </View>
              <TouchableOpacity style={[s.sheetAdd, { backgroundColor: pName.trim() ? ACCENT : c.fill.subtle }]} disabled={!pName.trim()} onPress={saveAsPreset}>
                <Star size={16} color={pName.trim() ? '#1A1206' : c.text.muted} />
                <Text style={[s.sheetAddTxt, { color: pName.trim() ? '#1A1206' : c.text.muted }]}>Zapisz preset</Text>
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

  quickRow:  { gap: spacing[2], paddingVertical: 2 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 190, paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  quickTxt:  { fontSize: 12.5, fontWeight: '700', color: c.text.primary, flexShrink: 1 },
  quickKcal: { fontSize: 11, fontWeight: '700', color: c.text.muted },

  savePresetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  savePresetTxt: { fontSize: 12.5, fontWeight: '700', color: ACCENT },

  multRow:  { flexDirection: 'row', gap: spacing[2], justifyContent: 'center' },
  multChip: { minWidth: 56, alignItems: 'center', paddingVertical: 9, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  multTxt:  { fontSize: 15, fontWeight: '800', color: c.text.secondary },

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

  fieldRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[1] },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary, width: 88 },
  fieldUnit:  { fontSize: 14, fontWeight: '700', color: c.text.muted },
  fieldHint:  { fontSize: 11, color: c.text.muted, flex: 1 },
  bigInput:   { flex: 1, height: 48, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, textAlign: 'center', fontSize: 22, fontWeight: '800', color: c.text.primary },
  smInput:    { width: 76, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, textAlign: 'center', fontSize: 16, fontWeight: '700', color: c.text.primary },

  addNewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing[3], paddingVertical: 11, borderRadius: radius.lg, borderWidth: 1, borderColor: ACCENT + '55', borderStyle: 'dashed' },
  addNewTxt: { fontSize: 13, fontWeight: '700', color: ACCENT, flex: 1 },

  sheetKcal:    { alignItems: 'center', gap: 1 },
  sheetKcalVal: { fontSize: 22, fontWeight: '800', color: ACCENT },
  sheetKcalSub: { fontSize: 11.5, color: c.text.muted },
  sheetAdd:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.full },
  sheetAddTxt:  { fontSize: 14, fontWeight: '800', color: '#1A1206' },

  mInput: { height: 46, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], fontSize: 15, color: c.text.primary },
}));
