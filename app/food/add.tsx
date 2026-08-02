import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Search, Plus, Minus, X, Pencil, Check, Trash2, Star, RotateCcw, Layers, ChefHat, Copy, Apple } from 'lucide-react-native';

import {
  useFoodStore, UNIT_META, unitToGrams, computeItemKcal,
  MealItem, MealType, MEAL_TYPES, FoodUnit, MealPreset, MealEntry, FoodProduct,
  presetKcal, presetGrams, presetMacros, presetToItem, computeItemMacros,
  PRESET_CATS, presetCatLabel, isRecipeProduct, presetIngredientNames,
} from '@/store/foodStore';
import { searchFoodBase } from '@/data/foodBase';
import DatePickerField from '@/components/ui/DatePickerField';
import { normalizeProductName } from '@/utils/productMemory';
import { spacing, radius, colors } from '@/theme';
import { fonts } from '@/theme/fonts';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const ACCENT = '#ECEEEE';   // mono (redesign czarno-biały)

function defaultMealType(): MealType {
  const h = new Date().getHours();
  if (h < 11) return 'sniadanie';
  if (h < 16) return 'obiad';
  if (h < 21) return 'kolacja';
  return 'przekaska';
}

function isoNDaysAgo(n: number): string {
  const d = new Date(); d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function dayLabelFor(iso: string): string {
  if (iso === isoNDaysAgo(0)) return 'Dziś';
  if (iso === isoNDaysAgo(1)) return 'Wczoraj';
  const [y, m, d] = iso.split('-');
  return `${d}.${m}.${y}`;
}

// A pickable food — from the user's counted DB (curated) or the offline base.
interface Candidate {
  name: string;
  kcalPer100g?: number;
  kcalPerPortion?: number;
  protein100?: number;
  carbs100?: number;
  fat100?: number;
  sugar100?: number;
  cat?: string;
  unitGrams?: Partial<Record<FoodUnit, number>>;
  defaultUnit?: FoodUnit;
  productId?: string;
  isRecipe?: boolean;
  source: 'curated' | 'base';
}

// One row in the meal library (the main browse): a saved composition (preset) or a
// cooked dish (recipe product). Tapping logs it; long-press pins it.
interface LibEntry {
  key: string; kind: 'preset' | 'dish'; id: string; name: string; cat: string;
  pinned: boolean; uses: number; meta: string; preset?: MealPreset; product?: FoodProduct;
  ingredients: string[];   // składniki (do szukania „po składniku")
  ingHay: string;          // znormalizowane składniki, sklejone (haystack)
}

export default function FoodAdd() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  const products            = useFoodStore(st => st.products);
  const presets             = useFoodStore(st => st.presets);
  const storeMeals          = useFoodStore(st => st.meals);
  const addMeal             = useFoodStore(st => st.addMeal);
  const updateMeal          = useFoodStore(st => st.updateMeal);
  const addPreset           = useFoodStore(st => st.addPreset);
  const updatePreset        = useFoodStore(st => st.updatePreset);
  const removePreset        = useFoodStore(st => st.removePreset);
  const bumpPreset          = useFoodStore(st => st.bumpPreset);
  const togglePinPreset     = useFoodStore(st => st.togglePinPreset);
  const togglePinProduct    = useFoodStore(st => st.togglePinProduct);
  const upsertProductByName = useFoodStore(st => st.upsertProductByName);
  const updateProduct       = useFoodStore(st => st.updateProduct);
  const learnPortion        = useFoodStore(st => st.learnPortion);

  const params = useLocalSearchParams<{ date?: string; edit?: string; preset?: string; dupPreset?: string; dish?: string }>();
  const initialDate = typeof params.date === 'string' && params.date ? params.date
    : `${new Date().getFullYear()}-${String(new Date().getMonth() + 1).padStart(2, '0')}-${String(new Date().getDate()).padStart(2, '0')}`;
  const editId = typeof params.edit === 'string' ? params.edit : undefined;
  const editPresetParam = typeof params.preset === 'string' ? params.preset : undefined;
  const dupPresetParam = typeof params.dupPreset === 'string' ? params.dupPreset : undefined;

  const [mealDate, setMealDate] = useState(initialDate);   // dzień, do którego dodajesz (można cofnąć)
  const [mealType, setMealType] = useState<MealType>(defaultMealType());
  const [items, setItems]       = useState<MealItem[]>([]);
  const [note, setNote]         = useState('');
  const [query, setQuery]       = useState('');
  const [browseTab, setBrowseTab] = useState<'dishes' | 'products' | 'recent'>('dishes');   // przeglądanie: jedno naraz

  // Editing an existing meal → prefill from the store (once).
  useEffect(() => {
    if (!editId) return;
    const m = storeMeals.find(x => x.id === editId);
    if (m) { setMealType(m.type); setItems(m.items.map(it => ({ ...it }))); setNote(m.note ?? ''); setMealDate(m.date); }
  }, [editId]);

  // Opened from the library to edit a preset → load its ingredients into the builder.
  useEffect(() => {
    if (!editPresetParam) return;
    const p = presets.find(x => x.id === editPresetParam);
    if (p) {
      setItems(p.items.map(it => ({ ...it })));
      if (p.type) setMealType(p.type);
      setEditPresetId(p.id); setPName(p.name); setPYields(p.yields ? String(p.yields) : ''); setPCat(p.cat ?? '');
    }
  }, [editPresetParam]);

  // Duplicate a preset → load its ingredients as a NEW preset (edit the copy, swap the bun…).
  useEffect(() => {
    if (!dupPresetParam) return;
    const p = presets.find(x => x.id === dupPresetParam);
    if (p) {
      setItems(p.items.map(it => ({ ...it })));
      if (p.type) setMealType(p.type);
      setEditPresetId(null); setPName(p.name + ' (kopia)'); setPYields(p.yields ? String(p.yields) : ''); setPCat(p.cat ?? '');
      setDupNotice(true);   // składniki wczytane jako NOWY preset — zmień/dodaj i „Zapisz jako preset"
    }
  }, [dupPresetParam]);

  // portion picker (for a selected candidate)
  const [sel, setSel]           = useState<Candidate | null>(null);
  const [editItemIndex, setEditItemIndex] = useState<number | null>(null);  // edycja ilości pozycji już w posiłku
  const [unit, setUnit]         = useState<FoodUnit>('g');
  const [qtyText, setQtyText]   = useState('1');            // wpisywana ilość (0,5 / 1,5 jednostki)
  const [gramsOverride, setGramsOverride] = useState('');   // for unit 'g' this IS the grams (from the scale)
  const qty = parseFloat(qtyText.replace(',', '.')) || 0;
  const bumpQty = (dir: 1 | -1) => setQtyText(prev => {
    const q = parseFloat(prev.replace(',', '.')) || 0;
    const step = q >= 2 ? 1 : 0.5;
    return String(Math.max(0.5, +(q + dir * step).toFixed(2)));
  });
  const [kcal100, setKcal100]             = useState('');   // kcal per 100 g used for the calc (prefilled if known)

  // manual entry
  const [manual, setManual] = useState(false);
  const [mName, setMName]   = useState('');
  const [mKcal, setMKcal]   = useState('');

  // preset apply (×1/2/3, or portions for a dish) + save-as-preset
  const [applying, setApplying] = useState<MealPreset | null>(null);
  const [mult, setMult]         = useState(1);          // assembled meal ×N
  const [dishPortions, setDishPortions] = useState(1);  // dish: portions eaten (of its `yields`)
  const [excludedParts, setExcludedParts] = useState<Set<number>>(new Set()); // składniki pominięte przy jedzeniu
  const [saveP, setSaveP]       = useState(false);
  const [pName, setPName]       = useState('');
  const [pYields, setPYields]   = useState('');         // "ile porcji wychodzi" (dish)
  const [pCat, setPCat]         = useState('');         // library category
  const [editPresetId, setEditPresetId] = useState<string | null>(null);   // editing an existing preset
  const [dupNotice, setDupNotice] = useState(false);    // building a COPY of a preset
  const [composeDishName, setComposeDishName] = useState(''); // building "danie + dodatki" from a dish

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

  // ── meal library: kompozycje (presety) + dania (przepisy) = GŁÓWNY widok ──
  const dishes = useMemo(() => products.filter(isRecipeProduct), [products]);
  const libEntries: LibEntry[] = useMemo(() => {
    const fromPresets: LibEntry[] = presets.map(p => {
      const ingredients = presetIngredientNames(p);
      return {
        key: 'p-' + p.id, kind: 'preset', id: p.id, name: p.name, cat: p.cat || 'inne', pinned: !!p.pinned, uses: p.uses,
        meta: p.yields && p.yields > 1 ? `${Math.round(presetKcal(p) / p.yields)} kcal/porcja · ${p.yields} porcji` : `${presetKcal(p)} kcal · ${p.items.length} skł.`,
        preset: p, ingredients, ingHay: normalizeProductName(ingredients.join(' ')),
      };
    });
    const fromDishes: LibEntry[] = dishes.map(p => {
      const ingredients = p.recipe?.ingredients.map(i => i.name) ?? [];
      return {
        key: 'd-' + p.id, kind: 'dish', id: p.id, name: p.name, cat: p.cat && PRESET_CATS.some(pc => pc.tag === p.cat) ? p.cat : 'dania', pinned: !!p.pinned, uses: p.uses,
        meta: `${p.kcalPer100g ?? 0} kcal/100g · danie`,
        product: p, ingredients, ingHay: normalizeProductName(ingredients.join(' ')),
      };
    });
    return [...fromPresets, ...fromDishes];
  }, [presets, dishes]);

  const byRank = (a: LibEntry, b: LibEntry) => (b.uses - a.uses) || a.name.localeCompare(b.name, 'pl');

  // Default browse (no search): favourites first, then by category.
  const librarySections = useMemo(() => {
    const pinned = libEntries.filter(e => e.pinned).sort(byRank);
    const rest = libEntries.filter(e => !e.pinned);
    const out: { tag: string; label: string; items: LibEntry[] }[] = [];
    if (pinned.length) out.push({ tag: '_fav', label: 'Ulubione', items: pinned });
    for (const pc of PRESET_CATS) {
      const its = rest.filter(e => e.cat === pc.tag).sort(byRank);
      if (its.length) out.push({ tag: pc.tag, label: pc.label, items: its });
    }
    const known = new Set(PRESET_CATS.map(p => p.tag));
    const other = rest.filter(e => !known.has(e.cat)).sort(byRank);
    if (other.length) out.push({ tag: '_inne', label: 'Inne', items: other });
    return out;
  }, [libEntries]);

  // Search: matches by NAME/kategoria OR by INGREDIENT ("napisz składnik → znajdzie dania
  // które go mają"). Multi-word = wszystkie tokeny muszą trafić (nazwa/kategoria/składniki).
  const libMatches = useMemo((): (LibEntry & { note?: string })[] => {
    const nq = normalizeProductName(query);
    if (!nq) return [];
    const toks = nq.split(' ').filter(Boolean);
    const out: (LibEntry & { note?: string })[] = [];
    for (const e of libEntries) {
      const nameHay = normalizeProductName(e.name + ' ' + presetCatLabel(e.cat));
      const hit = (hay: string) => hay.includes(nq) || (toks.length > 1 && toks.every(t => hay.includes(t)));
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
    return out.sort(byRank);
  }, [libEntries, query]);

  const applyPreset = () => {
    if (!applying) return;
    const inc = applying.items.filter((_, i) => !excludedParts.has(i));   // only what you actually ate
    if (inc.length === 0) { setApplying(null); return; }
    const sum = (f: (it: MealItem) => number) => inc.reduce((s, it) => s + (f(it) || 0), 0);
    const isDish = !!(applying.yields && applying.yields > 1);
    const factor = isDish ? (dishPortions / applying.yields!) : mult;
    const r1 = (n: number) => Math.round(n * factor * 10) / 10 || undefined;
    const changed = excludedParts.size > 0;
    setItems(prev => [...prev, {
      name: applying.name + (changed ? ' (bez części)' : ''),
      qty: isDish ? dishPortions : mult, unit: 'porcja' as FoodUnit,
      grams: Math.round(sum(it => it.grams) * factor), kcal: Math.round(sum(it => it.kcal) * factor),
      protein: r1(sum(it => it.protein ?? 0)), carbs: r1(sum(it => it.carbs ?? 0)), fat: r1(sum(it => it.fat ?? 0)),
      parts: inc.map(it => ({ ...it })), presetId: applying.id,
    }]);
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
    const y = yields > 1 ? Math.round(yields) : undefined;
    if (editPresetId) updatePreset(editPresetId, nm, items.map(it => ({ ...it })), mealType, y, pCat);
    else addPreset(nm, items.map(it => ({ ...it })), mealType, y, pCat);
    setSaveP(false); setPName(''); setPYields(''); setPCat(''); setEditPresetId(null); setDupNotice(false); setComposeDishName('');
  };
  // Load a preset's ingredients as a NEW preset (a copy) — change the bun / add stuff, then save.
  const loadPresetAsCopy = (p: MealPreset) => {
    haptic.tap();
    setItems(p.items.map(it => ({ ...it })));
    if (p.type) setMealType(p.type);
    setEditPresetId(null); setPName(p.name + ' (kopia)'); setPYields(p.yields ? String(p.yields) : ''); setPCat(p.cat ?? '');
    setDupNotice(true); setApplying(null);
  };
  // Load a preset's ingredients into the builder to change składniki / proporcje.
  const editPreset = (p: MealPreset) => {
    haptic.tap();
    setItems(p.items.map(it => ({ ...it })));
    if (p.type) setMealType(p.type);
    setEditPresetId(p.id); setPName(p.name); setPYields(p.yields ? String(p.yields) : ''); setPCat(p.cat ?? '');
    setDupNotice(false); setApplying(null);
  };

  // ── candidate list ───────────────────────────────────────────────────────
  const candidates: Candidate[] = useMemo(() => {
    const curated: Candidate[] = products.map(p => ({
      name: p.name, kcalPer100g: p.kcalPer100g, kcalPerPortion: p.kcalPerPortion,
      protein100: p.protein100, carbs100: p.carbs100, fat100: p.fat100, sugar100: p.sugar100, cat: p.cat,
      unitGrams: p.unitGrams, defaultUnit: p.defaultUnit, productId: p.id, isRecipe: isRecipeProduct(p), source: 'curated',
      _rank: (p.fresh && Date.now() - p.fresh < 7 * 864e5 ? 1e12 : 0) + (p.lastUsed ?? 0) + p.uses * 1000,
    } as any));
    const q = query.trim();
    if (!q) {
      // recent / fresh first, then base staples to fill
      curated.sort((a: any, b: any) => b._rank - a._rank);
      const seen = new Set(curated.map(x => normalizeProductName(x.name)));
      const base: Candidate[] = searchFoodBase('', 14)
        .filter(f => !seen.has(normalizeProductName(f.name)))
        .map(f => ({ name: f.name, kcalPer100g: f.kcal, protein100: f.protein, sugar100: f.sugar, unitGrams: f.unitGrams, defaultUnit: f.unit, source: 'base' }));
      return [...curated.slice(0, 10), ...base];
    }
    const nq = normalizeProductName(q);
    const curatedMatch = curated.filter(x => normalizeProductName(x.name).includes(nq));
    const seen = new Set(curatedMatch.map(x => normalizeProductName(x.name)));
    const base: Candidate[] = searchFoodBase(q, 24)
      .filter(f => !seen.has(normalizeProductName(f.name)))
      .map(f => ({ name: f.name, kcalPer100g: f.kcal, sugar100: f.sugar, unitGrams: f.unitGrams, defaultUnit: f.unit, source: 'base' }));
    return [...curatedMatch, ...base];
  }, [products, query]);

  // ── picker helpers ───────────────────────────────────────────────────────
  const pickerUnits = useMemo(() => {
    if (!sel) return ['g'] as FoodUnit[];
    const own = Object.keys(sel.unitGrams ?? {}) as FoodUnit[];
    const list = [sel.defaultUnit, ...own, 'g', 'porcja'].filter(Boolean) as FoodUnit[];
    return Array.from(new Set(list));
  }, [sel]);

  const openPicker = (cand: Candidate, editIndex: number | null = null) => {
    haptic.tap();
    // With a kitchen scale the grams path is the accurate one, so default to 'g' when
    // the food is density-based (kcal/100g); otherwise its household unit.
    const u: FoodUnit = cand.kcalPer100g != null ? 'g' : (cand.defaultUnit ?? (Object.keys(cand.unitGrams ?? {})[0] as FoodUnit) ?? 'g');
    setSel(cand); setUnit(u); setQtyText('1'); setGramsOverride('');
    setKcal100(cand.kcalPer100g != null ? String(cand.kcalPer100g) : '');
    setEditItemIndex(editIndex);   // null = dopisz nową; liczba = zamień istniejącą pozycję
  };

  // Stuknięcie pozycji w „Twój posiłek" → picker z jej ILOŚCIĄ/jednostką → zapis ZASTĘPUJE
  // tę pozycję (a nie dopisuje). Tylko produkty; złożenia/dania edytuje się przez usuń+dodaj.
  const editTrayItem = (i: number) => {
    const it = items[i];
    if (it.parts && it.parts.length) return;
    const p = it.productId ? products.find(x => x.id === it.productId) : undefined;
    const cand: Candidate = p ? productToCandidate(p) : ({
      name: it.name,
      kcalPer100g: it.grams > 0 ? Math.round((it.kcal / it.grams) * 100) : undefined,
      protein100: undefined, carbs100: undefined, fat100: undefined,
      source: 'curated',
    } as any);
    openPicker(cand, i);
    // prefill z istniejącej pozycji (nadpisuje domyślne z openPicker w tym samym renderze)
    setUnit(it.unit);
    setQtyText(String(it.qty || 1));
    setGramsOverride(it.unit !== 'g' && it.grams > 0 ? String(it.grams) : '');
  };

  // A cooked dish (recipe product) → the normal grams picker (weigh your portion).
  const productToCandidate = (p: FoodProduct): Candidate => ({
    name: p.name, kcalPer100g: p.kcalPer100g, kcalPerPortion: p.kcalPerPortion,
    protein100: p.protein100, carbs100: p.carbs100, fat100: p.fat100, sugar100: p.sugar100, cat: p.cat,
    unitGrams: p.unitGrams, defaultUnit: p.defaultUnit, productId: p.id, isRecipe: true, source: 'curated',
  });
  const tapEntry = (e: LibEntry) => {
    haptic.tap();
    if (e.kind === 'preset' && e.preset) { setMult(1); setDishPortions(1); setExcludedParts(new Set()); setApplying(e.preset); }
    else if (e.kind === 'dish' && e.product) openPicker(productToCandidate(e.product));
  };
  const pinEntry = (e: LibEntry) => { haptic.tap(); e.kind === 'dish' ? togglePinProduct(e.id) : togglePinPreset(e.id); };
  // Compose "danie + dodatki": open the dish's portion picker, then you add toppings and
  // save the whole thing as a preset ("Naleśniki z nutellą").
  const composeFromDish = (p: FoodProduct) => {
    setComposeDishName(p.name); setEditPresetId(null); setDupNotice(false);
    setPName(p.name + ' z dodatkami'); setPCat(p.cat && PRESET_CATS.some(pc => pc.tag === p.cat) ? p.cat : 'dania'); setPYields('');
    openPicker(productToCandidate(p));
  };
  // opened from the library "Dodaj dodatki" on a dish
  useEffect(() => {
    const id = typeof params.dish === 'string' ? params.dish : undefined;
    if (!id) return;
    const p = products.find(x => x.id === id);
    if (p && isRecipeProduct(p)) composeFromDish(p);
  }, [params.dish]);

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
        protein100: sel.protein100, carbs100: sel.carbs100, fat100: sel.fat100, sugar100: sel.sugar100,
        unitGrams: sel.unitGrams, defaultUnit: unit, fromBase: sel.source === 'base',
      });
      productId = p.id;
    } else if (k100 > 0 && k100 !== sel.kcalPer100g) {
      updateProduct(productId, { kcalPer100g: k100 });   // user set/corrected the density → remember it
    }
    const ov = parseFloat(gramsOverride.replace(',', '.'));
    if (ov > 0 && unit !== 'g' && qty > 0) learnPortion(productId, unit, ov / qty);
    const mac = computeItemMacros({ protein100: sel.protein100, carbs100: sel.carbs100, fat100: sel.fat100, sugar100: sel.sugar100 } as any, grams);
    const newItem = { name: sel.name, productId, qty: unit === 'g' ? 1 : qty, unit, grams: Math.round(grams), kcal, protein: mac.protein || undefined, carbs: mac.carbs || undefined, fat: mac.fat || undefined, sugar: mac.sugar || undefined };
    if (editItemIndex != null) { const idx = editItemIndex; setItems(prev => prev.map((x, j) => j === idx ? newItem : x)); }
    else setItems(prev => [...prev, newItem]);
    setSel(null); setEditItemIndex(null);
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
    if (editId) updateMeal(editId, mealType, items, note.trim() || undefined, mealDate);
    else addMeal(mealType, items, note.trim() || undefined, mealDate);
    router.back();
  };

  const unitLabel = (u: FoodUnit) => UNIT_META[u].label;

  // Rozróżnienie pozycji w komponowanym posiłku: złożenie (preset), danie (przepis), produkt.
  const kindOf = (it: MealItem): 'danie' | 'kompozycja' | 'produkt' => {
    if (it.parts && it.parts.length) return 'kompozycja';
    const p = it.productId ? products.find(x => x.id === it.productId) : undefined;
    return p && isRecipeProduct(p) ? 'danie' : 'produkt';
  };

  // Wiersz biblioteki (danie/kompozycja) — reużywany w szukaniu i przeglądaniu.
  const renderLibRow = (e: LibEntry & { note?: string }, i: number) => (
    <TouchableOpacity key={e.key} onPress={() => tapEntry(e)} onLongPress={() => pinEntry(e)} delayLongPress={400} style={[s.candRow, i > 0 && s.itemBorder]}>
      <Star size={15} color={ACCENT} fill={e.pinned ? ACCENT : 'transparent'} />
      <View style={{ flex: 1 }}>
        <View style={s.candNameRow}>
          <View style={s.kindTag}>
            {e.kind === 'dish' ? <ChefHat size={10} color={c.text.secondary} /> : <Layers size={10} color={c.text.secondary} />}
            <Text style={[s.kindTagTxt, { color: c.text.secondary }]}>{e.kind === 'dish' ? 'DANIE' : 'ZŁOŻENIE'}</Text>
          </View>
          <Text style={s.candName} numberOfLines={1}>{e.name}</Text>
        </View>
        <Text style={s.candMeta}>{e.meta}{e.note ? `  ·  ${e.note}` : ''}</Text>
      </View>
      <Plus size={18} color={ACCENT} />
    </TouchableOpacity>
  );
  // Wiersz pojedynczego produktu.
  const renderSingle = (cand: Candidate, i: number) => (
    <TouchableOpacity key={cand.productId ?? `b-${cand.name}`} onPress={() => openPicker(cand)} style={[s.candRow, i > 0 && s.itemBorder]}>
      <View style={{ flex: 1 }}>
        <Text style={s.candName} numberOfLines={1}>{cand.name}</Text>
        <Text style={s.candMeta}>
          {cand.kcalPer100g != null ? `${cand.kcalPer100g} kcal/100g` : cand.kcalPerPortion != null ? `${cand.kcalPerPortion} kcal/porcja` : '—'}
          {cand.source === 'curated' ? '  ·  moje' : ''}
        </Text>
      </View>
      <Plus size={18} color={ACCENT} />
    </TouchableOpacity>
  );

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={26} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.headerTitle}>{editId ? 'Edytuj posiłek' : 'Co zjadłem'}</Text>
        <View style={{ width: 26 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll} keyboardShouldPersistTaps="handled">
        {editPresetId && (
          <View style={s.editBanner}>
            <Pencil size={14} color={ACCENT} />
            <Text style={s.editBannerTxt}>Edytujesz preset „{pName}" — zmień składniki/proporcje i Zaktualizuj</Text>
            <TouchableOpacity onPress={() => { haptic.tap(); setEditPresetId(null); setItems([]); setPName(''); setPYields(''); setPCat(''); }} hitSlop={8}><X size={15} color={c.text.muted} /></TouchableOpacity>
          </View>
        )}
        {dupNotice && !editPresetId && (
          <View style={s.editBanner}>
            <Copy size={14} color={ACCENT} />
            <Text style={s.editBannerTxt}>Kopia — zmień co chcesz (np. bułkę) i „Zapisz jako preset"</Text>
            <TouchableOpacity onPress={() => { haptic.tap(); setDupNotice(false); setItems([]); setPName(''); setPYields(''); setPCat(''); }} hitSlop={8}><X size={15} color={c.text.muted} /></TouchableOpacity>
          </View>
        )}
        {composeDishName !== '' && !editPresetId && (
          <View style={s.editBanner}>
            <ChefHat size={14} color={ACCENT} />
            <Text style={s.editBannerTxt}>„{composeDishName}" + dodatki — dorzuć produkty (nutella, banan) i „Zapisz jako preset"</Text>
            <TouchableOpacity onPress={() => { haptic.tap(); setComposeDishName(''); setItems([]); setPName(''); setPYields(''); setPCat(''); }} hitSlop={8}><X size={15} color={c.text.muted} /></TouchableOpacity>
          </View>
        )}
        {/* dzień — szybkie chipy do dodawania WSTECZ + kalendarz */}
        <View style={s.dateRow}>
          <Text style={s.dateLabel}>Dodajesz do:</Text>
          {[0, 1, 2].map(n => {
            const iso = isoNDaysAgo(n);
            const on = mealDate === iso;
            return (
              <TouchableOpacity key={n} onPress={() => { haptic.tap(); setMealDate(iso); }}
                style={[s.dateChip, on && { backgroundColor: ACCENT + '22', borderColor: ACCENT + '88' }]}>
                <Text style={[s.dateChipTxt, on && { color: ACCENT }]}>{n === 0 ? 'Dziś' : n === 1 ? 'Wczoraj' : '2 dni'}</Text>
              </TouchableOpacity>
            );
          })}
          <View style={{ flex: 1 }} />
          <DatePickerField value={mealDate} onChange={setMealDate} style={s.datePicker} />
        </View>

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

        {/* added items — TWÓJ POSIŁEK: rozróżnienie DANIE / ZŁOŻENIE / PRODUKT */}
        {items.length > 0 && (
          <View style={s.card}>
            <View style={s.mealHead}>
              <Text style={s.mealHeadTxt}>Twój posiłek</Text>
              <Text style={s.mealHeadCount}>{items.length} {items.length === 1 ? 'pozycja' : 'pozycje'}</Text>
            </View>
            {items.map((it, i) => {
              const k = kindOf(it);
              const KindIcon = k === 'danie' ? ChefHat : k === 'kompozycja' ? Layers : Apple;
              const kindCol = k === 'produkt' ? c.text.muted : c.text.secondary;   // MONO — bez koloru
              const editable = !(it.parts && it.parts.length);   // produkt = stuknij, by zmienić ilość
              return (
              <View key={i} style={[s.itemRow, i > 0 && s.itemBorder]}>
                <TouchableOpacity style={s.itemMain} activeOpacity={editable ? 0.6 : 1} disabled={!editable}
                  onPress={() => editTrayItem(i)}>
                  <View style={s.kindTag}>
                    <KindIcon size={11} color={kindCol} />
                    <Text style={[s.kindTagTxt, { color: kindCol }]}>{k === 'danie' ? 'DANIE' : k === 'kompozycja' ? 'ZŁOŻENIE' : 'PRODUKT'}</Text>
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.itemName} numberOfLines={1}>{it.name}{it.parts && it.qty > 1 ? ` ×${it.qty}` : ''}</Text>
                    <Text style={s.itemMeta} numberOfLines={1}>
                      {it.parts ? it.parts.map(p => p.name).join(', ')
                        : it.unit === 'g' ? `${it.grams} g`
                        : `${it.qty > 1 ? `${it.qty} × ` : ''}${unitLabel(it.unit)}${it.grams > 0 ? ` · ${it.grams} g` : ''}`}
                    </Text>
                  </View>
                </TouchableOpacity>
                <Text style={s.itemKcal}>{it.kcal}</Text>
                <TouchableOpacity hitSlop={8} onPress={() => { haptic.tap(); setItems(prev => prev.filter((_, j) => j !== i)); }}><Trash2 size={15} color={c.text.muted} /></TouchableOpacity>
              </View>
              );
            })}
            <Text style={s.itemEditHint}>Stuknij pozycję, aby zmienić ilość</Text>
            <View style={s.totalRow}>
              <TouchableOpacity style={s.savePresetBtn} onPress={() => { haptic.tap(); setSaveP(true); }}>
                <Star size={13} color={ACCENT} /><Text style={s.savePresetTxt}>{editPresetId ? 'Zaktualizuj preset' : 'Zapisz jako preset'}</Text>
              </TouchableOpacity>
              <Text style={s.totalVal}>{total}<Text style={s.totalUnit}> kcal</Text></Text>
            </View>
          </View>
        )}

        {/* szukajka = szybkie znajdowanie; bez wpisu = uporządkowane przeglądanie w segmentach */}
        <View style={s.searchBox}>
          <Search size={17} color={c.text.muted} />
          <TextInput style={s.searchInput} value={query} onChangeText={setQuery}
            placeholder="Szukaj produktu / dania…" placeholderTextColor={c.text.muted} />
          {query.length > 0 && <TouchableOpacity onPress={() => setQuery('')} hitSlop={8}><X size={16} color={c.text.muted} /></TouchableOpacity>}
        </View>

        {query.trim() ? (
          /* ── SZUKANIE: pasujące dania/kompozycje + pojedyncze produkty ── */
          <>
            {!exactExists && (
              <TouchableOpacity style={s.addNewRow} onPress={addNew}>
                <Plus size={17} color={ACCENT} />
                <Text style={s.addNewTxt}>Dodaj nowy: „{query.trim()}" (gramy + kcal/100g)</Text>
              </TouchableOpacity>
            )}
            {libMatches.length > 0 && (
              <View style={{ gap: 4 }}>
                <Text style={s.sectionHint}>Dania i kompozycje</Text>
                <View style={s.card}>{libMatches.map((e, i) => renderLibRow(e, i))}</View>
              </View>
            )}
            {(() => {
              const singles = candidates.filter(cand => !cand.isRecipe);
              return (
                <View style={{ gap: 4 }}>
                  <Text style={s.sectionHint}>Pojedyncze produkty</Text>
                  <View style={s.card}>
                    {singles.map((cand, i) => renderSingle(cand, i))}
                    {singles.length === 0 && <Text style={s.candMeta}>Brak — użyj „Dodaj nowy" wyżej.</Text>}
                  </View>
                  <TouchableOpacity style={s.manualRow} onPress={() => { haptic.tap(); setMName(query); setMKcal(''); setManual(true); }}>
                    <Pencil size={14} color={ACCENT} /><Text style={s.manualTxt}>Wpisz „{query.trim()}" ręcznie (na oko)</Text>
                  </TouchableOpacity>
                </View>
              );
            })()}
          </>
        ) : (
          /* ── PRZEGLĄDANIE: segmenty (jedno naraz) ── */
          <>
            <View style={s.segRow}>
              {([['dishes', 'Dania', ChefHat], ['products', 'Produkty', Apple], ['recent', 'Ostatnie', RotateCcw]] as const).map(([id, label, Ic]) => {
                const on = browseTab === id;
                return (
                  <TouchableOpacity key={id} onPress={() => { haptic.tap(); setBrowseTab(id); }} style={[s.segBtn, on && s.segBtnOn]} activeOpacity={0.8}>
                    <Ic size={14} color={on ? c.bg.primary : c.text.muted} />
                    <Text style={[s.segTxt, on && s.segTxtOn]}>{label}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {browseTab === 'dishes' && (
              <>
                <TouchableOpacity style={s.createRow} onPress={() => { haptic.tap(); router.push('/food/recipe' as any); }}>
                  <ChefHat size={16} color={ACCENT} /><Text style={s.createTxt}>Nowy przepis / danie</Text><Plus size={16} color={ACCENT} />
                </TouchableOpacity>
                {librarySections.map(sec => (
                  <View key={sec.tag} style={{ gap: 4 }}>
                    <View style={s.catHead}>
                      {sec.tag === '_fav' && <Star size={13} color={ACCENT} fill={ACCENT} />}
                      <Text style={s.catHeadTxt}>{sec.label}</Text>
                      <Text style={s.catHeadCount}>{sec.items.length}</Text>
                    </View>
                    <View style={s.card}>{sec.items.map((e, i) => renderLibRow(e, i))}</View>
                  </View>
                ))}
                {librarySections.length === 0 && (
                  <View style={s.card}>
                    <Text style={s.candMeta}>Brak dań i kompozycji. Zbuduj posiłek z produktów i „Zapisz jako preset", albo dodaj „Nowy przepis / danie".</Text>
                  </View>
                )}
                <Text style={s.presetHint}>Przytrzymaj pozycję, aby przypiąć ją na górę.</Text>
              </>
            )}

            {browseTab === 'products' && (
              <>
                <TouchableOpacity style={s.createRow} onPress={() => { haptic.tap(); setMName(''); setMKcal(''); setManual(true); }}>
                  <Pencil size={16} color={ACCENT} /><Text style={s.createTxt}>Wpisz ręcznie (na oko)</Text><Plus size={16} color={ACCENT} />
                </TouchableOpacity>
                <View style={s.card}>
                  {candidates.filter(cand => !cand.isRecipe).map((cand, i) => renderSingle(cand, i))}
                </View>
              </>
            )}

            {browseTab === 'recent' && (
              recentMeals.length > 0 ? (
                <View style={s.card}>
                  {recentMeals.map((m, i) => (
                    <TouchableOpacity key={m.id} onPress={() => repeatMeal(m)} style={[s.candRow, i > 0 && s.itemBorder]}>
                      <RotateCcw size={15} color={c.text.muted} />
                      <View style={{ flex: 1 }}>
                        <Text style={s.candName} numberOfLines={1}>{m.items.map(it => it.name).join(', ')}</Text>
                        <Text style={s.candMeta}>{dayLabelFor(m.date)} · {m.kcal} kcal · {m.items.length} poz.</Text>
                      </View>
                      <Plus size={18} color={ACCENT} />
                    </TouchableOpacity>
                  ))}
                </View>
              ) : (
                <View style={s.card}><Text style={s.candMeta}>Brak ostatnich posiłków — pojawią się tu, gdy coś dodasz.</Text></View>
              )
            )}
          </>
        )}
      </ScrollView>

      {/* save bar */}
      <View style={s.saveBar}>
        <TouchableOpacity style={[s.saveBtn, { backgroundColor: items.length ? ACCENT : c.fill.subtle }]} disabled={!items.length} onPress={save}>
          <Check size={18} color={items.length ? '#1A1206' : c.text.muted} />
          <Text style={[s.saveTxt, { color: items.length ? '#1A1206' : c.text.muted }]}>{editId ? 'Zapisz zmiany' : 'Zapisz'}{total > 0 ? ` · ${total} kcal` : ''}</Text>
        </TouchableOpacity>
      </View>

      {/* ── portion picker ─────────────────────────────────────────── */}
      <Modal visible={!!sel} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setSel(null)}>
        <TouchableOpacity style={s.overlay} activeOpacity={1} onPress={() => setSel(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} style={[s.sheet, { backgroundColor: c.bg.card }]} onPress={() => {}}>
              {sel && (
                <ScrollView keyboardShouldPersistTaps="handled" style={{ maxHeight: 460 }}>
                  <Text style={s.sheetTitle}>{editItemIndex != null ? `Zmień ilość: ${sel.name}` : sel.name}</Text>
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
                        <TouchableOpacity style={s.qtyBtn} onPress={() => { haptic.tap(); bumpQty(-1); }}><Minus size={18} color={c.text.primary} /></TouchableOpacity>
                        <View style={s.qtyCenter}>
                          <TextInput style={s.qtyValInput} value={qtyText} onChangeText={t => setQtyText(t.replace(/[^0-9.,]/g, ''))} keyboardType="numeric" selectTextOnFocus />
                          <Text style={s.qtyUnit}>{unitLabel(unit)}</Text>
                        </View>
                        <TouchableOpacity style={s.qtyBtn} onPress={() => { haptic.tap(); bumpQty(1); }}><Plus size={18} color={c.text.primary} /></TouchableOpacity>
                      </View>
                      <Text style={s.qtyHint}>możesz wpisać ułamek — np. 0,5 albo 1,5</Text>
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
                    <Plus size={18} color="#1A1206" /><Text style={s.sheetAddTxt}>{editItemIndex != null ? 'Zapisz zmianę' : 'Dodaj do posiłku'}</Text>
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
              const factor = isDish ? (dishPortions / applying.yields!) : mult;
              const incTotal = applying.items.reduce((sm, it, i) => sm + (excludedParts.has(i) ? 0 : it.kcal), 0);
              const kcalNow = Math.round(incTotal * factor);
              return (
              <>
                <Text style={s.sheetTitle}>{applying.name}</Text>
                {isDish && <Text style={s.sheetSub}>Całość {presetKcal(applying)} kcal / {applying.yields} porcji</Text>}
                {applying.items.length > 1 && (
                  <View style={s.partsBox}>
                    {applying.items.map((it, i) => {
                      const off = excludedParts.has(i);
                      return (
                        <TouchableOpacity key={i} style={s.partRow} activeOpacity={0.7}
                          onPress={() => { haptic.tap(); setExcludedParts(prev => { const n = new Set(prev); n.has(i) ? n.delete(i) : n.add(i); return n; }); }}>
                          <Text style={[s.partName, off && { color: c.text.muted, textDecorationLine: 'line-through' }]} numberOfLines={1}>{it.name}</Text>
                          <Text style={[s.partKcal, off && { color: c.text.muted }]}>{it.kcal} kcal</Text>
                          {off ? <Plus size={14} color={c.text.muted} /> : <X size={14} color={colors.accent.red} />}
                        </TouchableOpacity>
                      );
                    })}
                    <Text style={s.partsHint}>Stuknij składnik, by pominąć (np. kanapka bez sera)</Text>
                  </View>
                )}
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
                <View style={s.presetActions}>
                  <TouchableOpacity style={s.presetActBtn} onPress={() => { haptic.tap(); togglePinPreset(applying.id); }}>
                    <Star size={13} color={ACCENT} fill={applying.pinned ? ACCENT : 'transparent'} /><Text style={s.presetActTxt}>{applying.pinned ? 'Odepnij' : 'Przypnij'}</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.presetActBtn} onPress={() => editPreset(applying)}>
                    <Pencil size={13} color={c.text.secondary} /><Text style={s.presetActTxt}>Edytuj</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.presetActBtn} onPress={() => loadPresetAsCopy(applying)}>
                    <Copy size={13} color={c.text.secondary} /><Text style={s.presetActTxt}>Kopia</Text>
                  </TouchableOpacity>
                  <TouchableOpacity style={s.presetActBtn} onPress={() => { haptic.tap(); removePreset(applying.id); setApplying(null); }}>
                    <Trash2 size={13} color={colors.accent.red} /><Text style={[s.presetActTxt, { color: colors.accent.red }]}>Usuń</Text>
                  </TouchableOpacity>
                </View>
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
              <Text style={s.sheetTitle}>{editPresetId ? 'Zaktualizuj preset' : 'Zapisz jako preset'}</Text>
              <Text style={s.sheetSub}>{items.map(i => i.name).join(', ')} · {total} kcal — {editPresetId ? 'nadpiszę zapisany preset.' : 'dodasz to jednym stuknięciem następnym razem.'}</Text>
              <TextInput style={s.mInput} value={pName} onChangeText={setPName} placeholder="Nazwa (np. Kanapka / Puree)" placeholderTextColor={c.text.muted} autoFocus />
              <View style={s.fieldRow}>
                <Text style={s.fieldLabel}>Porcji wychodzi</Text>
                <TextInput style={s.smInput} value={pYields} onChangeText={setPYields} keyboardType="numeric" placeholder="1" placeholderTextColor={c.text.muted} />
                <Text style={s.fieldHint}>danie na kilka porcji (np. puree) — puste = całość</Text>
              </View>
              <Text style={s.fieldLabel}>Kategoria (biblioteka)</Text>
              <View style={s.presetCatWrap}>
                {PRESET_CATS.map(pc => {
                  const on = pCat === pc.tag;
                  return (
                    <TouchableOpacity key={pc.tag} onPress={() => { haptic.tap(); setPCat(on ? '' : pc.tag); }}
                      style={[s.presetCatChip, on && { backgroundColor: ACCENT + '22', borderColor: ACCENT + '88' }]}>
                      <Text style={[s.presetCatTxt, on && { color: ACCENT }]}>{pc.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
              <TouchableOpacity style={[s.sheetAdd, { backgroundColor: pName.trim() ? ACCENT : c.fill.subtle }]} disabled={!pName.trim()} onPress={saveAsPreset}>
                <Star size={16} color={pName.trim() ? '#1A1206' : c.text.muted} />
                <Text style={[s.sheetAddTxt, { color: pName.trim() ? '#1A1206' : c.text.muted }]}>{editPresetId ? 'Zaktualizuj' : 'Zapisz preset'}</Text>
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
  header:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[3] },
  headerTitle: { fontSize: 19, fontWeight: '900', color: c.text.primary, letterSpacing: -0.3 },
  scroll:    { padding: spacing[4], gap: spacing[4], paddingBottom: 132 },

  card: { backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.subtle },

  dateRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  dateLabel:  { fontFamily: fonts.label, fontSize: 10, color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginRight: 2 },
  dateJump:   { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.border.subtle, backgroundColor: c.fill.subtle },
  dateChip:    { paddingHorizontal: 13, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.border.subtle, backgroundColor: c.fill.subtle },
  dateChipTxt: { fontSize: 12.5, fontWeight: '800', color: c.text.secondary },
  dateJumpTxt:{ fontSize: 12.5, fontWeight: '800', color: c.text.secondary },
  datePicker: { paddingVertical: 8, paddingHorizontal: spacing[3] },

  typeRow:  { flexDirection: 'row', gap: spacing[2] },
  typeChip: { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.subtle, backgroundColor: c.fill.subtle },
  typeTxt:  { fontSize: 12.5, fontWeight: '800', color: c.text.secondary },

  quickRow:  { gap: spacing[2], paddingVertical: 2 },
  quickChip: { flexDirection: 'row', alignItems: 'center', gap: 6, maxWidth: 190, paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  quickTxt:  { fontSize: 12.5, fontWeight: '700', color: c.text.primary, flexShrink: 1 },
  quickKcal: { fontSize: 11, fontWeight: '700', color: c.text.muted },

  presetEditBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, paddingVertical: 10 },
  presetEditTxt: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  presetSearch:  { flexDirection: 'row', alignItems: 'center', gap: 8, backgroundColor: c.fill.subtle, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle, paddingHorizontal: spacing[3], height: 42, marginBottom: spacing[2] },
  presetHint:    { fontSize: 11, color: c.text.muted, marginTop: 6, lineHeight: 15 },
  presetCatWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: 7, marginBottom: spacing[2] },
  presetCatChip: { paddingHorizontal: 12, paddingVertical: 7, borderRadius: 999, borderWidth: 1, borderColor: c.border.subtle, backgroundColor: c.fill.subtle },
  presetCatTxt:  { fontSize: 12, fontWeight: '700', color: c.text.secondary },
  presetActions: { flexDirection: 'row', gap: 6, marginTop: 4 },
  presetActBtn:  { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 4, paddingVertical: 10, paddingHorizontal: 2, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle, backgroundColor: c.fill.subtle },
  presetActTxt:  { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  editBanner:    { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing[3], paddingVertical: 11, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.fill.subtle },
  editBannerTxt: { flex: 1, fontSize: 12.5, fontWeight: '700', color: c.text.primary },
  savePresetBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: 6 },
  savePresetTxt: { fontSize: 12.5, fontWeight: '800', color: ACCENT },

  partsBox:  { gap: 2, backgroundColor: c.fill.subtle, borderRadius: radius.lg, padding: spacing[2] },
  partRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 6, paddingHorizontal: spacing[2] },
  partName:  { flex: 1, fontSize: 13, fontWeight: '600', color: c.text.primary },
  partKcal:  { fontSize: 12, fontWeight: '700', color: c.text.secondary },
  partsHint: { fontSize: 11, color: c.text.muted, paddingHorizontal: spacing[2], paddingTop: 2 },
  multRow:  { flexDirection: 'row', gap: spacing[2], justifyContent: 'center' },
  multChip: { minWidth: 60, alignItems: 'center', paddingVertical: 10, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.subtle, backgroundColor: c.fill.subtle },
  multTxt:  { fontFamily: fonts.display, fontSize: 16, color: c.text.secondary },

  mealHead:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  mealHeadTxt:   { fontFamily: fonts.label, fontSize: 11, color: c.text.primary, textTransform: 'uppercase', letterSpacing: 1 },
  mealHeadCount: { fontSize: 11, fontWeight: '700', color: c.text.muted },
  itemRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 11 },
  itemMain:   { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  itemEditHint: { fontSize: 10.5, color: c.text.muted, marginTop: spacing[2], textAlign: 'center' },
  itemBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  kindTag:    { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: 6, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.fill.subtle, minWidth: 58, justifyContent: 'center' },
  kindTagTxt: { fontSize: 8, fontWeight: '900', letterSpacing: 0.4 },
  itemName:   { fontSize: 14.5, fontWeight: '700', color: c.text.primary },
  itemMeta:   { fontSize: 11.5, color: c.text.muted, marginTop: 1 },
  itemKcal:   { fontFamily: fonts.display, fontSize: 15, color: c.text.primary, fontVariant: ['tabular-nums'] },
  totalRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end', marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: c.border.default },
  totalLabel: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  totalVal:   { fontFamily: fonts.display, fontSize: 32, color: ACCENT, letterSpacing: -0.5 },
  totalUnit:  { fontFamily: fonts.display, fontSize: 14, color: c.text.muted },

  searchBox:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle, paddingHorizontal: spacing[3], height: 50 },
  searchInput: { flex: 1, fontSize: 15.5, color: c.text.primary },

  linkRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[4], flexWrap: 'wrap' },
  manualBtn: { flexDirection: 'row', alignItems: 'center', gap: 7, paddingVertical: 4 },
  manualTxt: { fontSize: 13, fontWeight: '700', color: ACCENT },
  manualRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 9, paddingHorizontal: 2 },

  // segmenty przeglądania (Dania / Produkty / Ostatnie)
  segRow: { flexDirection: 'row', gap: spacing[2] },
  segBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 11, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.subtle, backgroundColor: c.fill.subtle },
  segBtnOn: { backgroundColor: ACCENT, borderColor: ACCENT },
  segTxt: { fontSize: 12.5, fontWeight: '800', color: c.text.muted },
  segTxtOn: { color: c.bg.primary },
  // wiersz „utwórz" (nowy przepis / wpisz ręcznie) na górze segmentu
  createRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing[3], paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, borderStyle: 'dashed', backgroundColor: c.fill.subtle },
  createTxt: { flex: 1, fontSize: 13, fontWeight: '800', color: c.text.primary },

  sectionHint: { fontFamily: fonts.label, fontSize: 10, color: c.text.muted, textTransform: 'uppercase', letterSpacing: 1, marginLeft: 2 },
  catHead:      { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing[2], marginBottom: 2, marginLeft: 2 },
  catHeadDot:   { width: 9, height: 9, borderRadius: 5 },
  catHeadTxt:   { fontFamily: fonts.label, fontSize: 11, color: c.text.primary, textTransform: 'uppercase', letterSpacing: 0.6 },
  catHeadCount: { fontSize: 11, fontWeight: '700', color: c.text.muted },

  candRow:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 11 },
  candNameRow: { flexDirection: 'row', alignItems: 'center', gap: 7 },
  candName: { fontSize: 14, fontWeight: '600', color: c.text.primary, flexShrink: 1 },
  candMeta: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },

  saveBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[5], backgroundColor: c.bg.primary, borderTopWidth: 1, borderTopColor: c.border.subtle },
  saveBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 54, borderRadius: radius.full },
  saveTxt: { fontSize: 15.5, fontWeight: '900' },

  overlay:    { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[4] },
  sheet:      { borderRadius: radius.xl, padding: spacing[4], gap: spacing[3], borderWidth: 1, borderColor: c.border.default },
  sheetTitle: { fontSize: 17, fontWeight: '900', color: c.text.primary, letterSpacing: -0.3 },
  sheetSub:   { fontSize: 12, color: c.text.muted, lineHeight: 16, marginTop: -6 },

  unitWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  unitChip: { paddingHorizontal: spacing[3], paddingVertical: 8, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.subtle, backgroundColor: c.fill.subtle },
  unitTxt:  { fontSize: 12.5, fontWeight: '800', color: c.text.secondary },

  qtyRow:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  qtyBtn:    { width: 48, height: 48, borderRadius: 24, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.fill.subtle, alignItems: 'center', justifyContent: 'center' },
  qtyCenter: { alignItems: 'center', minWidth: 96 },
  qtyVal:    { fontFamily: fonts.display, fontSize: 32, color: c.text.primary },
  qtyValInput: { minWidth: 74, height: 52, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false, paddingVertical: 0, fontFamily: fonts.display, fontSize: 30, color: c.text.primary, borderBottomWidth: 1, borderBottomColor: c.border.default },
  qtyUnit:   { fontSize: 12, fontWeight: '600', color: c.text.muted, marginTop: 2 },
  qtyHint:   { fontSize: 11, color: c.text.muted, textAlign: 'center' },

  fieldRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[1] },
  fieldLabel: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary, width: 88 },
  fieldUnit:  { fontSize: 14, fontWeight: '700', color: c.text.muted },
  fieldHint:  { fontSize: 11, color: c.text.muted, flex: 1 },
  bigInput:   { flex: 1, height: 54, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.fill.subtle, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false, paddingVertical: 0, fontFamily: fonts.display, fontSize: 24, color: c.text.primary },
  smInput:    { width: 76, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.fill.subtle, textAlign: 'center', textAlignVertical: 'center', includeFontPadding: false, paddingVertical: 0, fontSize: 16, fontWeight: '800', color: c.text.primary },

  addNewRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingHorizontal: spacing[3], paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, borderStyle: 'dashed', backgroundColor: c.fill.subtle },
  addNewTxt: { fontSize: 13, fontWeight: '800', color: c.text.primary, flex: 1 },

  sheetKcal:    { alignItems: 'center', gap: 1 },
  sheetKcalVal: { fontFamily: fonts.display, fontSize: 28, color: ACCENT, letterSpacing: -0.5 },
  sheetKcalSub: { fontSize: 11.5, color: c.text.muted },
  sheetAdd:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 50, borderRadius: radius.full },
  sheetAddTxt:  { fontSize: 14.5, fontWeight: '900', color: '#1A1206' },

  mInput: { height: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.fill.subtle, paddingHorizontal: spacing[3], fontSize: 15, color: c.text.primary },
}));
