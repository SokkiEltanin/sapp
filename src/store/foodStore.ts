import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { normalizeProductName } from '@/utils/productMemory';

// ─────────────────────────────────────────────────────────────────────────────
// Calorie counting — a MANUAL log that is deliberately SEPARATE from receipts.
// The app never assumes "bought = eaten", never depletes a pantry, never guesses
// (you buy sardines, you might log "ryba" — that's fine, they don't have to line
// up). Receipts only NUDGE: a freshly-bought product floats higher in suggestions
// (`fresh`). You still enter everything yourself, and only YOU add a product to the
// counted database. Persisted in AsyncStorage → survives restarts AND reinstalls
// (backupService snapshots every AsyncStorage key).
// ─────────────────────────────────────────────────────────────────────────────

// Household units so you can log "na oko" without a kitchen scale. `grams` is a
// GENERIC default; a product can learn its own grams-per-unit (unitGrams), e.g.
// "plaster szynki ≈ 15 g" set once, reused forever.
export type FoodUnit = 'g' | 'ml' | 'szt' | 'plaster' | 'kromka' | 'lyzka' | 'lyzeczka' | 'garsc' | 'szklanka' | 'porcja';

export const UNIT_META: Record<FoodUnit, { label: string; grams: number; exact?: boolean }> = {
  g:        { label: 'g',         grams: 1,   exact: true },
  ml:       { label: 'ml',        grams: 1,   exact: true },
  szt:      { label: 'szt',       grams: 100 },
  plaster:  { label: 'plaster',   grams: 20 },
  kromka:   { label: 'kromka',    grams: 30 },
  lyzka:    { label: 'łyżka',     grams: 15 },
  lyzeczka: { label: 'łyżeczka',  grams: 5 },
  garsc:    { label: 'garść',     grams: 30 },
  szklanka: { label: 'szklanka',  grams: 250 },
  porcja:   { label: 'porcja',    grams: 150 },
};
export const ALL_UNITS: FoodUnit[] = ['g', 'szt', 'plaster', 'kromka', 'lyzka', 'lyzeczka', 'garsc', 'szklanka', 'ml', 'porcja'];

// A product the user counts. Either density-based (kcalPer100g, for real foods) OR
// fixed per portion (kcalPerPortion — for "na oko" things: a Huel shake, a
// restaurant meal). At least one is set.
export interface FoodProduct {
  id: string;
  name: string;
  kcalPer100g?: number;
  kcalPerPortion?: number;                       // fixed-kcal foods
  protein100?: number;                           // białko  g/100g
  carbs100?: number;                             // węglowodany g/100g
  fat100?: number;                               // tłuszcze g/100g
  cat?: string;                                  // food category tag (FOOD_SUBCATS)
  linkedName?: string;                           // purchased-product name this represents (manual link)
  unitGrams?: Partial<Record<FoodUnit, number>>; // learned per-product portion grams
  defaultUnit?: FoodUnit;
  fresh?: number;                                // ms of last purchase → suggest higher
  uses: number;                                  // times logged
  lastUsed?: number;
  createdAt: number;
  fromBase?: boolean;                            // seeded from the offline base
  pinned?: boolean;                              // favourite — floats to the top of the library
  recipe?: RecipeMeta;                           // set → a cooked dish; kcal/100g is DERIVED from it
  semi?: boolean;                                // „półprodukt" — baza (np. naleśniki) do budowania innych dań; podbity w wyborze składników
}

// One line inside a logged meal — grams & kcal are RESOLVED at log time and stored,
// so historical totals never shift if a product's density is later edited. A
// COMPOSITE line (a preset applied, e.g. "Kanapka") keeps its components in `parts`
// and carries a `presetId`, so the breakdown stays visible and editable.
export interface MealItem {
  name: string;
  productId?: string;
  qty: number;
  unit: FoodUnit;
  grams: number;
  kcal: number;
  protein?: number;     // resolved grams of macro for this line (if product carries them)
  carbs?: number;
  fat?: number;
  parts?: MealItem[];   // set for composite/preset lines
  presetId?: string;
}

// How a dish is prepared — drives whether a finished weight is needed:
//  • raw    = a MIXTURE (salad, batter, shake): weight = sum of ingredient weights
//             (auto, editable). No evaporation, kcal = Σ ingredients.
//  • cooked = boiled/baked: you WEIGH the finished dish (water evaporated).
//  • fried  = like cooked + a frying fat is absorbed → adds that fat's calories.
export type PrepType = 'raw' | 'cooked' | 'fried';

// A dish stored ON a product: the ingredients + how it was prepared. kcal/100g is
// DERIVED — total kcal ÷ weight — so you log it by WEIGHING your portion. (Dodatki à la
// nutella robi się teraz przez PÓŁPRODUKTY — patrz FoodProduct.semi — nie osobnym polem.)
export interface RecipeMeta {
  ingredients: MealItem[];
  cookedWeight: number;   // g of the finished dish (for raw = the summed/edited weight)
  prep?: PrepType;        // undefined = 'cooked' (back-compat with dishes saved earlier)
  fryFat?: { name: string; grams: number; kcal: number };  // fried: the fat that got added
}

// Resolved macro grams for a portion of a product (density × grams). 0s when unknown.
export function computeItemMacros(p: FoodProduct | undefined, grams: number): { protein: number; carbs: number; fat: number } {
  const g = grams / 100;
  return {
    protein: p?.protein100 != null ? Math.round(p.protein100 * g * 10) / 10 : 0,
    carbs:   p?.carbs100   != null ? Math.round(p.carbs100 * g * 10) / 10 : 0,
    fat:     p?.fat100     != null ? Math.round(p.fat100 * g * 10) / 10 : 0,
  };
}

export type MealType = 'sniadanie' | 'obiad' | 'kolacja' | 'przekaska';
export const MEAL_TYPES: { id: MealType; label: string }[] = [
  { id: 'sniadanie', label: 'Śniadanie' },
  { id: 'obiad',     label: 'Obiad' },
  { id: 'kolacja',   label: 'Kolacja' },
  { id: 'przekaska', label: 'Przekąska' },
];
export function mealTypeLabel(t: MealType): string {
  return MEAL_TYPES.find(m => m.id === t)?.label ?? 'Posiłek';
}

export interface MealEntry {
  id: string;
  date: string;   // YYYY-MM-DD (local)
  ts: number;     // logged-at ms
  type: MealType;
  items: MealItem[];
  kcal: number;   // sum of item kcal
  note?: string;
}

// A reusable meal template. Two flavours:
//  • an ASSEMBLED meal ("Kanapka") — applied ×1/2/3 as a whole; `yields` unset/1.
//  • a cooked DISH ("Puree z ziemniaków+marchwi") — `yields` = how many portions the
//    batch makes; logging picks how many portions you ate (kcal = total × eaten/yields).
export interface MealPreset {
  id: string;
  name: string;
  type?: MealType;
  items: MealItem[];
  yields?: number;   // >1 = a dish that makes N portions
  cat?: string;      // library category (kanapki / naleśniki / dania / …)
  pinned?: boolean;  // favourites float to the top
  uses: number;
  createdAt: number;
}

// Library categories for presets — pin favourites, group, search.
export const PRESET_CATS: { tag: string; label: string }[] = [
  { tag: 'kanapki',   label: 'Kanapki' },
  { tag: 'nalesniki', label: 'Naleśniki' },
  { tag: 'dania',     label: 'Dania' },
  { tag: 'wypieki',   label: 'Ciasta / wypieki' },
  { tag: 'salatki',   label: 'Sałatki' },
  { tag: 'napoje',    label: 'Napoje / shaki' },
  { tag: 'przekaski', label: 'Przekąski' },
  { tag: 'inne',      label: 'Inne' },
];
export function presetCatLabel(tag?: string): string {
  return PRESET_CATS.find(c => c.tag === tag)?.label ?? 'Inne';
}

export type GoalMode = 'cut' | 'maintain' | 'bulk';

// ── helpers ───────────────────────────────────────────────────────────────────

// Grams for one unit of a product (learned per-product value wins over the generic).
export function unitToGrams(p: FoodProduct | undefined, unit: FoodUnit): number {
  const learned = p?.unitGrams?.[unit];
  if (learned != null && learned > 0) return learned;
  return UNIT_META[unit].grams;
}

// kcal for a resolved (product, unit, qty, grams). Fixed-kcal products count per
// portion/piece; everything else is density × grams.
export function computeItemKcal(p: FoodProduct | undefined, unit: FoodUnit, qty: number, grams: number): number {
  if (p?.kcalPer100g != null && p.kcalPer100g >= 0 && unit !== 'porcja') {
    return Math.round((grams / 100) * p.kcalPer100g);
  }
  if (p?.kcalPerPortion != null) return Math.round(p.kcalPerPortion * qty);
  if (p?.kcalPer100g != null) return Math.round((grams / 100) * p.kcalPer100g);
  return 0;
}

// Daily intake target from the day's burn + goal mode (or a manual override). Burn
// under 1200 is treated as unknown → a sane maintenance fallback.
export function targetIntake(burnKcal: number, mode: GoalMode, manual?: number): number {
  if (manual && manual > 0) return manual;
  const base = burnKcal >= 1200 ? burnKcal : 2200;
  if (mode === 'cut')  return Math.max(1200, Math.round(base - 500));
  if (mode === 'bulk') return Math.round(base + 300);
  return Math.round(base);
}

export function presetKcal(p: MealPreset): number {
  return p.items.reduce((s, it) => s + (it.kcal || 0), 0);
}
// All ingredient names in a preset (incl. components of composite lines) — for
// "search by ingredient" (find every meal that contains X).
export function presetIngredientNames(p: MealPreset): string[] {
  const out: string[] = [];
  for (const it of p.items) {
    out.push(it.name);
    if (it.parts) for (const pt of it.parts) out.push(pt.name);
  }
  return out;
}
export function presetGrams(p: MealPreset): number {
  return p.items.reduce((s, it) => s + (it.grams || 0), 0);
}
export function presetMacros(p: MealPreset): { protein: number; carbs: number; fat: number } {
  return p.items.reduce((a, it) => ({
    protein: a.protein + (it.protein || 0), carbs: a.carbs + (it.carbs || 0), fat: a.fat + (it.fat || 0),
  }), { protein: 0, carbs: 0, fat: 0 });
}
const r1 = (n: number) => Math.round(n * 10) / 10;

// ── cooked-recipe maths ───────────────────────────────────────────────────────
export function recipeTotals(ings: MealItem[]): { kcal: number; protein: number; carbs: number; fat: number; grams: number } {
  return ings.reduce((a, it) => ({
    kcal: a.kcal + (it.kcal || 0), protein: a.protein + (it.protein || 0),
    carbs: a.carbs + (it.carbs || 0), fat: a.fat + (it.fat || 0), grams: a.grams + (it.grams || 0),
  }), { kcal: 0, protein: 0, carbs: 0, fat: 0, grams: 0 });
}
// Per-100 g density of a dish. `weight` is the finished weight (cooked/fried) or the
// summed ingredient weight (raw). `extraKcal`/`extraFatG` add a frying fat. Falls back
// to the raw ingredient weight when no weight is set yet (live preview while building).
export function recipeDensity(ings: MealItem[], weight: number, extraKcal = 0, extraFatG = 0): {
  kcalPer100g: number; protein100?: number; carbs100?: number; fat100?: number; totalKcal: number; weight: number;
} {
  const t = recipeTotals(ings);
  const w = weight > 0 ? weight : (t.grams > 0 ? t.grams : 0);
  const totalKcal = t.kcal + extraKcal;
  if (!(w > 0)) return { kcalPer100g: 0, totalKcal, weight: 0 };
  const per = (v: number) => { const x = Math.round((v / w) * 1000) / 10; return x > 0 ? x : undefined; };
  return { kcalPer100g: Math.round((totalKcal / w) * 100), protein100: per(t.protein), carbs100: per(t.carbs), fat100: per(t.fat + extraFatG), totalKcal, weight: w };
}
export function isRecipeProduct(p: FoodProduct): boolean {
  return !!p.recipe && p.recipe.ingredients.length > 0;
}

// A composite meal line from a preset applied ×mult ("Kanapka ×2"): summed kcal +
// macros; components kept in `parts` for the breakdown.
export function presetToItem(p: MealPreset, mult: number): MealItem {
  const m = presetMacros(p);
  return {
    name: p.name,
    qty: mult,
    unit: 'porcja',
    grams: Math.round(presetGrams(p) * mult),
    kcal: Math.round(presetKcal(p) * mult),
    protein: r1(m.protein * mult) || undefined,
    carbs: r1(m.carbs * mult) || undefined,
    fat: r1(m.fat * mult) || undefined,
    parts: p.items.map(it => ({ ...it })),
    presetId: p.id,
  };
}

const rid = (p: string) => `${p}-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 6)}`;

// ── store ───────────────────────────────────────────────────────────────────

interface FoodState {
  products: FoodProduct[];
  meals: MealEntry[];
  presets: MealPreset[];
  goalMode: GoalMode;
  manualGoal?: number;   // overrides the burn-derived target when > 0

  // products
  addProduct: (p: Omit<FoodProduct, 'id' | 'uses' | 'createdAt'>) => FoodProduct;
  updateProduct: (id: string, patch: Partial<FoodProduct>) => void;
  removeProduct: (id: string) => void;
  // find/create a counted product by name (identity via normalizeProductName)
  upsertProductByName: (name: string, seed?: Partial<FoodProduct>) => FoodProduct;
  findProductByName: (name: string) => FoodProduct | undefined;
  learnPortion: (id: string, unit: FoodUnit, grams: number) => void;
  togglePinProduct: (id: string) => void;
  // create/update a dish product: kcal/100g derived from ingredients (+fry fat) ÷ weight
  saveRecipeProduct: (input: {
    name: string; ingredients: MealItem[]; weight: number; cat?: string; id?: string;
    prep?: PrepType; fryFat?: { name: string; grams: number; kcal: number };
    semi?: boolean;
  }) => FoodProduct;
  markFresh: (name: string) => void;            // one product bought
  markFreshMany: (names: string[]) => void;     // a receipt's worth (already-counted only)

  // meals
  addMeal: (type: MealType, items: MealItem[], note?: string, date?: string) => void;
  updateMeal: (id: string, type: MealType, items: MealItem[], note?: string, date?: string) => void;
  removeMeal: (id: string) => void;
  mealsForDate: (date: string) => MealEntry[];
  kcalForDate: (date: string) => number;

  // presets
  addPreset: (name: string, items: MealItem[], type?: MealType, yields?: number, cat?: string) => void;
  updatePreset: (id: string, name: string, items: MealItem[], type?: MealType, yields?: number, cat?: string) => void;
  removePreset: (id: string) => void;
  bumpPreset: (id: string) => void;
  togglePinPreset: (id: string) => void;

  // goal
  setGoal: (mode: GoalMode, manual?: number) => void;
}

export const useFoodStore = create<FoodState>()(
  persist(
    (set, get) => ({
      products: [],
      meals: [],
      presets: [],
      goalMode: 'maintain',
      manualGoal: undefined,

      addProduct: (p) => {
        const prod: FoodProduct = { ...p, id: rid('fp'), uses: 0, createdAt: Date.now() };
        set(s => ({ products: [...s.products, prod] }));
        return prod;
      },
      updateProduct: (id, patch) => set(s => ({
        products: s.products.map(p => (p.id === id ? { ...p, ...patch } : p)),
      })),
      removeProduct: (id) => set(s => ({ products: s.products.filter(p => p.id !== id) })),

      findProductByName: (name) => {
        const key = normalizeProductName(name);
        return get().products.find(p => normalizeProductName(p.name) === key);
      },
      upsertProductByName: (name, seed) => {
        const existing = get().findProductByName(name);
        if (existing) {
          if (seed) get().updateProduct(existing.id, seed);
          return get().products.find(p => p.id === existing.id)!;
        }
        return get().addProduct({ name: name.trim(), ...seed });
      },
      learnPortion: (id, unit, grams) => {
        if (!(grams > 0)) return;
        set(s => ({
          products: s.products.map(p =>
            p.id === id ? { ...p, unitGrams: { ...(p.unitGrams ?? {}), [unit]: Math.round(grams) }, defaultUnit: unit } : p),
        }));
      },
      togglePinProduct: (id) => set(s => ({ products: s.products.map(p => (p.id === id ? { ...p, pinned: !p.pinned } : p)) })),
      saveRecipeProduct: ({ name, ingredients, weight, cat, id, prep = 'cooked', fryFat, semi }) => {
        const t = recipeTotals(ingredients);
        // raw = a mixture → weight is the summed ingredient weight (unless the user set one)
        const w = prep === 'raw' ? (weight > 0 ? weight : t.grams) : weight;
        const d = recipeDensity(ingredients, w, fryFat?.kcal ?? 0, fryFat?.grams ?? 0);
        const patch: Partial<FoodProduct> = {
          name: name.trim(),
          kcalPer100g: d.kcalPer100g, kcalPerPortion: undefined,
          protein100: d.protein100, carbs100: d.carbs100, fat100: d.fat100,
          cat: cat || 'inne', defaultUnit: 'g', semi: !!semi,
          recipe: {
            ingredients: ingredients.map(it => ({ ...it })), cookedWeight: Math.round(d.weight),
            prep, fryFat: fryFat && fryFat.grams > 0 ? fryFat : undefined,
          },
        };
        const existing = id ? get().products.find(p => p.id === id) : undefined;
        if (existing) { get().updateProduct(existing.id, patch); return get().products.find(p => p.id === existing.id)!; }
        return get().upsertProductByName(name, patch);
      },
      markFresh: (name) => {
        const key = normalizeProductName(name);
        set(s => ({
          products: s.products.map(p => (normalizeProductName(p.name) === key ? { ...p, fresh: Date.now() } : p)),
        }));
      },
      // Bump `fresh` on every counted product a receipt just bought. Never CREATES a
      // product (only the user adds those) — it just floats already-counted ones up.
      markFreshMany: (names) => {
        const keys = new Set(names.map(n => normalizeProductName(n)).filter(Boolean));
        if (keys.size === 0) return;
        const now = Date.now();
        set(s => {
          let changed = false;
          const products = s.products.map(p => {
            const hit = keys.has(normalizeProductName(p.name)) || (p.linkedName && keys.has(normalizeProductName(p.linkedName)));
            if (hit) { changed = true; return { ...p, fresh: now }; }
            return p;
          });
          return changed ? { products } : {};
        });
      },

      addMeal: (type, items, note, date) => {
        const now = new Date();
        const d = date ?? `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`;
        const kcal = items.reduce((s, it) => s + (it.kcal || 0), 0);
        const meal: MealEntry = { id: rid('meal'), date: d, ts: Date.now(), type, items, kcal, note };
        // bump product usage for ordering + learning
        const ids = new Set(items.map(i => i.productId).filter(Boolean) as string[]);
        set(s => ({
          meals: [meal, ...s.meals],
          products: s.products.map(p => (ids.has(p.id) ? { ...p, uses: p.uses + 1, lastUsed: Date.now() } : p)),
        }));
      },
      updateMeal: (id, type, items, note, date) => set(s => ({
        meals: s.meals.map(m => (m.id === id ? { ...m, type, items, kcal: items.reduce((a, it) => a + (it.kcal || 0), 0), note, ...(date ? { date } : {}) } : m)),
      })),
      removeMeal: (id) => set(s => ({ meals: s.meals.filter(m => m.id !== id) })),
      mealsForDate: (date) => get().meals.filter(m => m.date === date),
      kcalForDate: (date) => get().meals.filter(m => m.date === date).reduce((s, m) => s + m.kcal, 0),

      addPreset: (name, items, type, yields, cat) => set(s => ({
        presets: [...s.presets, { id: rid('preset'), name: name.trim(), items, type, yields: yields && yields > 1 ? yields : undefined, cat: cat || undefined, uses: 0, createdAt: Date.now() }],
      })),
      updatePreset: (id, name, items, type, yields, cat) => set(s => ({
        presets: s.presets.map(p => (p.id === id ? { ...p, name: name.trim(), items, type, yields: yields && yields > 1 ? yields : undefined, cat: cat || p.cat } : p)),
      })),
      removePreset: (id) => set(s => ({ presets: s.presets.filter(p => p.id !== id) })),
      bumpPreset: (id) => set(s => ({ presets: s.presets.map(p => (p.id === id ? { ...p, uses: p.uses + 1 } : p)) })),
      togglePinPreset: (id) => set(s => ({ presets: s.presets.map(p => (p.id === id ? { ...p, pinned: !p.pinned } : p)) })),

      setGoal: (mode, manual) => set({ goalMode: mode, manualGoal: manual && manual > 0 ? Math.round(manual) : undefined }),
    }),
    {
      name: 'food-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (s) => ({
        products: s.products, meals: s.meals, presets: s.presets, goalMode: s.goalMode, manualGoal: s.manualGoal,
      }),
    },
  ),
);
