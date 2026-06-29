import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpenseCategory } from '@/types';

const KEY      = 'product_category_memory';
const TAG_KEY  = 'product_tag_memory';
const NAME_KEY = 'product_name_aliases';
const WEIGHT_KEY = 'product_weight_memory';
const MAX_ENTRIES = 500;

type ProductMemory = Record<string, ExpenseCategory>;
type NameAliases   = Record<string, string>; // normalizedKey → canonical display name

function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
}

// Strong normalization for product IDENTITY (stats grouping). Folds OCR noise so
// the same product spelled slightly differently collapses to one key. Sizes are
// KEPT (user wants different sizes counted separately in top-stats).
const DIACRITICS: Record<string, string> = {
  ą: 'a', ć: 'c', ę: 'e', ł: 'l', ń: 'n', ó: 'o', ś: 's', ż: 'z', ź: 'z',
};
export function normalizeProductName(name: string): string {
  let s = name.toLowerCase().trim();
  s = s.replace(/[ąćęłńóśżź]/g, c => DIACRITICS[c] ?? c);
  s = s.replace(/[^a-z0-9]+/g, ' ').trim();   // drop punctuation/OCR junk, keep digits (sizes)
  s = s.replace(/\s+/g, ' ');
  return s;
}

// ─── Coarse product grouping for STATS ────────────────────────────────────────
// Collapse variants of the same product so stats aren't fragmented:
// "Serek wiejski lekki" / "Serek wiejski Pilos" → group "serek"; "Bułka kajzerka"
// / "Bułka grahamka" → group "bułka". Sizes/qualifiers (lekki, bio, XXL…) and
// numbers are ignored. Receipts still show the full names; only the rollup groups.
const GROUP_STOP = new Set([
  'lekki', 'lekkie', 'light', 'bio', 'eko', 'duzy', 'duza', 'maly', 'mala', 'mini',
  'maxi', 'xxl', 'xl', 'xxxl', 'classic', 'klasyczny', 'naturalny', 'naturalna',
  'swiezy', 'swieza', 'czerwony', 'zielony', 'bezglutenowy',
]);
function groupTokens(name: string): string[] {
  return normalizeProductName(name).split(' ').filter(t => t.length >= 2 && !/^\d/.test(t) && !GROUP_STOP.has(t));
}
export function productGroupKey(name: string): string {
  const toks = groupTokens(name);
  return toks[0] ?? normalizeProductName(name) ?? name.toLowerCase();
}
// Nicest label for a group = the longest shared word-prefix of its members,
// taken from the shortest original name so diacritics/casing are preserved.
export function productGroupLabel(names: string[]): string {
  if (names.length === 0) return '';
  const norm = names.map(groupTokens);
  let plen = norm[0]?.length ?? 0;
  for (const tl of norm.slice(1)) {
    let i = 0;
    while (i < plen && i < tl.length && norm[0][i] === tl[i]) i++;
    plen = i;
    if (plen === 0) break;
  }
  plen = Math.max(1, plen);
  const base = [...names].sort((a, b) => a.length - b.length)[0];
  const words = base.split(/\s+/).slice(0, plen).join(' ');
  return words.charAt(0).toUpperCase() + words.slice(1);
}

// ─── Fuzzy matching (trigram similarity) ──────────────────────────────────────

function trigrams(s: string): Set<string> {
  const result = new Set<string>();
  const padded = `  ${s}  `;
  for (let i = 0; i < padded.length - 2; i++) {
    result.add(padded.slice(i, i + 3));
  }
  return result;
}

function trigramSimilarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length < 2 || b.length < 2) return 0;
  const ta = trigrams(a);
  const tb = trigrams(b);
  let intersection = 0;
  for (const t of ta) { if (tb.has(t)) intersection++; }
  return (2 * intersection) / (ta.size + tb.size);
}

const FUZZY_THRESHOLD = 0.60; // minimum similarity to apply memory

function findFuzzyMatch<V>(key: string, memory: Record<string, V>): V | undefined {
  const keys = Object.keys(memory);
  if (keys.length === 0) return undefined;
  let bestScore = FUZZY_THRESHOLD;
  let bestVal: V | undefined;
  for (const k of keys) {
    const score = trigramSimilarity(key, k);
    if (score > bestScore) { bestScore = score; bestVal = memory[k]; }
  }
  return bestVal;
}

// Normalized trigram similarity between two product names (0..1). Used to flag
// likely OCR duplicates ("HAŁWA STOŁECZNA" vs "HAŁWA SŁONECZNA") in the library.
export function productNameSimilarity(a: string, b: string): number {
  return trigramSimilarity(normalizeProductName(a), normalizeProductName(b));
}

// "Is this the same as X?" — finds a known name SIMILAR to `name` but in the
// uncertain band [lo, FUZZY_THRESHOLD): too close to ignore, too far to auto-merge.
// Used by the scanner to gently suggest a merge the user can confirm. Returns the
// best known name, or null. Exact / already-auto-merged (>=threshold) names are skipped.
export function suggestSimilarName(name: string, knownNames: string[], lo = 0.45): string | null {
  const key = normalizeProductName(name);
  if (!key) return null;
  let best: string | null = null;
  let bestScore = lo;
  for (const kn of knownNames) {
    const nk = normalizeProductName(kn);
    if (nk === key) return null; // exact match — nothing to suggest
    const score = trigramSimilarity(key, nk);
    if (score >= bestScore && score < FUZZY_THRESHOLD) { bestScore = score; best = kn; }
  }
  return best;
}

export async function loadProductMemory(): Promise<ProductMemory> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function applyProductMemory(
  products: { name: string }[],
  memory: ProductMemory,
): Promise<Record<number, ExpenseCategory>> {
  const result: Record<number, ExpenseCategory> = {};
  for (let i = 0; i < products.length; i++) {
    const key = normalize(products[i].name);
    result[i] = memory[key] ?? findFuzzyMatch(key, memory) ?? (undefined as any);
    if (result[i] == null) delete result[i];
  }
  return result;
}

export async function saveProductCategories(
  products: { name: string }[],
  categories: Record<number, ExpenseCategory>,
  parsed: Record<number, ExpenseCategory>,
  editedNames?: Record<number, string>,
): Promise<void> {
  try {
    const memory = await loadProductMemory();
    for (const [idxStr, cat] of Object.entries(categories)) {
      const idx = parseInt(idxStr);
      const parsedCat = parsed[idx];
      const name = editedNames?.[idx]?.trim() || products[idx].name;
      if ((cat !== parsedCat || editedNames?.[idx]) && name) {
        memory[normalize(name)] = cat;
      }
    }
    const entries = Object.entries(memory);
    const trimmed = entries.length > MAX_ENTRIES
      ? Object.fromEntries(entries.slice(-MAX_ENTRIES))
      : memory;
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {}
}

// ─── Tag memory ───────────────────────────────────────────────────────────────

type TagMemory = Record<string, string[]>;

export async function loadTagMemory(): Promise<TagMemory> {
  try {
    const raw = await AsyncStorage.getItem(TAG_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function applyTagMemory(
  products: { name: string }[],
  memory: TagMemory,
): Promise<Record<number, string[]>> {
  const result: Record<number, string[]> = {};
  for (let i = 0; i < products.length; i++) {
    const key = normalize(products[i].name);
    const val = memory[key] ?? findFuzzyMatch(key, memory);
    if (val?.length) result[i] = val;
  }
  return result;
}

export async function saveTagMemory(
  products: { name: string }[],
  editedTags: Record<number, string[]>,
  editedNames?: Record<number, string>,
): Promise<void> {
  if (Object.keys(editedTags).length === 0) return;
  try {
    const memory = await loadTagMemory();
    for (const [idxStr, tags] of Object.entries(editedTags)) {
      const idx  = parseInt(idxStr);
      const name = editedNames?.[idx]?.trim() || products[idx].name;
      if (name) memory[normalize(name)] = tags;
    }
    const entries = Object.entries(memory);
    const trimmed = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : memory;
    await AsyncStorage.setItem(TAG_KEY, JSON.stringify(trimmed));
  } catch {}
}

export async function saveCustomTagsToMemory(
  products: { name: string; tags: string[] }[],
): Promise<void> {
  if (products.length === 0) return;
  try {
    const memory = await loadTagMemory();
    for (const p of products) {
      const name = p.name.trim();
      if (name && p.tags.length > 0) memory[normalize(name)] = p.tags;
    }
    const entries = Object.entries(memory);
    const trimmed = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : memory;
    await AsyncStorage.setItem(TAG_KEY, JSON.stringify(trimmed));
  } catch {}
}

// ─── Custom products memory ───────────────────────────────────────────────────

// ─── Tag frequency ────────────────────────────────────────────────────────────

export async function getTagFrequency(): Promise<Record<string, number>> {
  const memory = await loadTagMemory();
  const freq: Record<string, number> = {};
  for (const tags of Object.values(memory)) {
    for (const tag of tags) {
      freq[tag] = (freq[tag] ?? 0) + 1;
    }
  }
  return freq;
}

// ─── Name aliases (canonical product identity for stats) ──────────────────────
// When the user renames a parsed product, we remember garbled→canonical so the
// same product spelled differently (OCR / store) merges into one stats entry.

export async function loadNameAliases(): Promise<NameAliases> {
  try {
    const raw = await AsyncStorage.getItem(NAME_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveNameAliases(
  products: { name: string }[],
  editedNames: Record<number, string>,
): Promise<void> {
  const entries = Object.entries(editedNames);
  if (entries.length === 0) return;
  try {
    const aliases = await loadNameAliases();
    for (const [idxStr, editedRaw] of entries) {
      const idx = parseInt(idxStr);
      const canonical = editedRaw.trim();
      const original = products[idx]?.name;
      if (!canonical) continue;
      if (original) aliases[normalizeProductName(original)] = canonical; // garbled → canonical
      aliases[normalizeProductName(canonical)] = canonical;              // canonical → itself
    }
    const all = Object.entries(aliases);
    const trimmed = all.length > MAX_ENTRIES ? Object.fromEntries(all.slice(-MAX_ENTRIES)) : aliases;
    await AsyncStorage.setItem(NAME_KEY, JSON.stringify(trimmed));
  } catch {}
}

// Undo a merge: drop the alias for these (raw) names so they split apart again.
export async function removeNameAliases(names: string[]): Promise<void> {
  try {
    const aliases = await loadNameAliases();
    for (const n of names) delete aliases[normalizeProductName(n)];
    await AsyncStorage.setItem(NAME_KEY, JSON.stringify(aliases));
  } catch {}
}

// Resolve a raw product name to its canonical form using learned aliases
// (exact key → fuzzy key → prettified raw fallback).
// ─── Known product bases ──────────────────────────────────────────────────────
// Many branded snacks/sweets appear under dozens of slightly different OCR names
// and flavours ("Jeżyki", "jeżyki cherry", "jezykicherry"…). When a distinctive
// base token shows up in a name we fold the whole family to ONE canonical name,
// so stats group them automatically without the user renaming each variant.
// Tokens are normalised (lowercase, no diacritics). Order = priority.
const BRAND_CANON: { tokens: string[]; name: string; tag?: string }[] = [
  { tokens: ['jezyki'],                 name: 'Jeżyki',        tag: 'słodycze' },
  { tokens: ['grzeski'],                name: 'Grześki',       tag: 'słodycze' },
  { tokens: ['princepolo'],             name: 'Prince Polo',   tag: 'słodycze' },
  { tokens: ['delicje'],                name: 'Delicje',       tag: 'słodycze' },
  { tokens: ['ptasiemleczko'],          name: 'Ptasie mleczko',tag: 'słodycze' },
  { tokens: ['michalki'],               name: 'Michałki',      tag: 'słodycze' },
  { tokens: ['krowki', 'krowka'],       name: 'Krówki',        tag: 'słodycze' },
  { tokens: ['lays'],                   name: "Lay's",         tag: 'przekąski' },
  { tokens: ['pringles'],               name: 'Pringles',      tag: 'przekąski' },
  { tokens: ['doritos'],                name: 'Doritos',       tag: 'przekąski' },
  { tokens: ['cheetos'],                name: 'Cheetos',       tag: 'przekąski' },
  { tokens: ['chrupki'],                name: 'Chrupki',       tag: 'przekąski' },
  { tokens: ['krakers', 'krakersy'],    name: 'Krakersy',      tag: 'przekąski' },
  { tokens: ['paluszki'],               name: 'Paluszki',      tag: 'przekąski' },
  { tokens: ['precle', 'precelki'],     name: 'Precle',        tag: 'przekąski' },
  { tokens: ['nachos'],                 name: 'Nachos',        tag: 'przekąski' },
  { tokens: ['orzeszki', 'orzeszkiwskorupkach'], name: 'Orzeszki', tag: 'przekąski' },
  { tokens: ['grzanki'],                name: 'Grzanki',       tag: 'przekąski' },
  { tokens: ['ovenbaked'],              name: 'Ovenbaked',     tag: 'przekąski' },
  { tokens: ['snickers'],               name: 'Snickers',      tag: 'słodycze' },
  { tokens: ['twix'],                   name: 'Twix',          tag: 'słodycze' },
  { tokens: ['kitkat'],                 name: 'KitKat',        tag: 'słodycze' },
  { tokens: ['kinder'],                 name: 'Kinder',        tag: 'słodycze' },
  { tokens: ['milka'],                  name: 'Milka',         tag: 'słodycze' },
  { tokens: ['wedel'],                  name: 'Wedel',         tag: 'słodycze' },
  { tokens: ['oreo'],                   name: 'Oreo',          tag: 'słodycze' },
  { tokens: ['lubella'],                name: 'Lubella' },
  { tokens: ['coca', 'cocacola'],       name: 'Coca-Cola',     tag: 'napoje' },
  { tokens: ['pepsi'],                  name: 'Pepsi',         tag: 'napoje' },
  { tokens: ['redbull'],                name: 'Red Bull',      tag: 'napoje' },
  { tokens: ['monster'],                name: 'Monster',       tag: 'napoje' },
  { tokens: ['tymbark'],                name: 'Tymbark',       tag: 'napoje' },
];

// Store private labels (Lidl, Biedronka, Kaufland…) span MANY different products,
// so we do NOT fold them to one name — we only use them to imply a sub-tag
// (e.g. anything "Pikok" is cold cuts → mięso, "Milbona" is dairy → nabiał).
const STORE_LABELS: { tokens: string[]; tag: string }[] = [
  // ─ Lidl ─
  { tokens: ['pikok'],              tag: 'mięso' },
  { tokens: ['dulano'],             tag: 'mięso' },
  { tokens: ['milbona'],            tag: 'nabiał' },
  { tokens: ['pilos'],              tag: 'nabiał' },
  { tokens: ['sondey'],             tag: 'słodycze' },
  { tokens: ['snackday', 'snack'],  tag: 'przekąski' },
  { tokens: ['alesto'],             tag: 'przekąski' },
  { tokens: ['chefselect', 'chef'], tag: 'dania gotowe' },
  { tokens: ['freshona'],           tag: 'warzywa' },
  { tokens: ['oceansea'],           tag: 'ryby' },
  // ─ Biedronka ─
  { tokens: ['dada'],               tag: 'chemia' },
  // ─ Kaufland ─
  { tokens: ['kclassic', 'kklassik'], tag: 'dania gotowe' },
];

function findInList<T extends { tokens: string[] }>(key: string, list: T[]): T | undefined {
  const words = key.split(' ');
  const flat = key.replace(/ /g, '');
  for (const b of list) {
    for (const t of b.tokens) {
      if (words.includes(t)) return b;                  // distinct word
      if (t.length >= 4 && flat.startsWith(t)) return b; // brand leads the name ("lay s"→"lays…")
      if (t.length >= 6 && flat.includes(t)) return b;   // concatenated / OCR-glued mid-name
    }
  }
  return undefined;
}

const matchBrand = (key: string) => findInList(key, BRAND_CANON);

// The food sub-tag implied by a recognised brand or store label (e.g. Lay's or
// Pikok), or undefined. Fallback when keyword auto-tagging found nothing.
export function brandTag(raw: string): string | undefined {
  const key = normalizeProductName(raw);
  return matchBrand(key)?.tag ?? findInList(key, STORE_LABELS)?.tag;
}

export function canonicalProductName(raw: string, aliases: NameAliases): string {
  const key = normalizeProductName(raw);
  // 1) user's own learned rename wins (most specific)
  if (aliases[key]) return aliases[key];
  // 2) known product base — folds flavour/OCR variants to one family
  const brand = matchBrand(key);
  if (brand) return brand.name;
  // 3) space-insensitive alias match (OCR glues/splits words differently)
  const flat = key.replace(/ /g, '');
  for (const k of Object.keys(aliases)) {
    if (k.replace(/ /g, '') === flat) return aliases[k];
  }
  // 4) fuzzy match against learned aliases (typos / close variants)
  const fuzzy = findFuzzyMatch(key, aliases);
  if (fuzzy) return fuzzy;
  return raw.trim();
}

// ─── Per-product weight memory (kg) ───────────────────────────────────────────
// Receipts rarely list grams. The first time you set a weight for a product the
// app remembers it (keyed by name), so the same product defaults to that weight
// next time AND its past entries are counted with it. Always overridable.

export type WeightMemory = Record<string, number>; // normalizedName → kg

export async function loadWeightMemory(): Promise<WeightMemory> {
  try {
    const raw = await AsyncStorage.getItem(WEIGHT_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveWeightMemory(items: { name: string; kg: number }[]): Promise<void> {
  const valid = items.filter(i => i.name.trim() && i.kg > 0);
  if (valid.length === 0) return;
  try {
    const mem = await loadWeightMemory();
    for (const i of valid) mem[normalize(i.name)] = i.kg;
    const entries = Object.entries(mem);
    const trimmed = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : mem;
    await AsyncStorage.setItem(WEIGHT_KEY, JSON.stringify(trimmed));
  } catch {}
}

// Learned weight for a product name (exact then fuzzy).
export function weightFor(name: string, mem: WeightMemory): number | undefined {
  const key = normalize(name);
  return mem[key] ?? findFuzzyMatch(key, mem);
}

// ─── Per-product kcal memory (kcal per 100 g) ─────────────────────────────────
// You set a product's energy density once (on the Produkty screen); the calorie
// estimate then uses it for that product instead of the coarse category guess.

const KCAL_KEY = 'product_kcal_memory';
export type KcalMemory = Record<string, number>; // normalizedName → kcal/100g

export async function loadKcalMemory(): Promise<KcalMemory> {
  try {
    const raw = await AsyncStorage.getItem(KCAL_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveKcalMemory(items: { name: string; kcal: number }[]): Promise<void> {
  const valid = items.filter(i => i.name.trim() && i.kcal > 0);
  if (valid.length === 0) return;
  try {
    const mem = await loadKcalMemory();
    for (const i of valid) mem[normalize(i.name)] = Math.round(i.kcal);
    const entries = Object.entries(mem);
    await AsyncStorage.setItem(KCAL_KEY, JSON.stringify(entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : mem));
  } catch {}
}

// Learned kcal/100g for a product name (exact then fuzzy).
export function kcalFor(name: string, mem: KcalMemory): number | undefined {
  const key = normalize(name);
  return mem[key] ?? findFuzzyMatch(key, mem);
}

function unitToKg(n: number, unit: string): number | undefined {
  if (!(n > 0)) return undefined;
  // l/ml treated as kg-equivalent (density ~1) so volume products get a weight too.
  const kg = unit === 'kg' || unit === 'l' ? n : n / 1000; // g / ml
  if (kg <= 0 || kg > 50) return undefined;                // ignore absurd OCR values
  return Math.round(kg * 1000) / 1000;
}

// Extract an explicit weight/volume written INTO the product name, in kg.
// "Ogórki 700g" → 0.7, "Ser Gouda 0,5 kg" → 0.5, "Woda 1,5l" → 1.5,
// "Chipsy 6x40g" → 0.24 (multiplier packs). Returns undefined when the name
// carries no weight token — callers then fall back to learned/typed weight.
export function parseWeightFromName(name: string): number | undefined {
  if (!name) return undefined;
  const s = name.toLowerCase().replace(/,/g, '.');
  // multiplier pack: "6 x 40 g", "2x0.5l"
  const mult = s.match(/(\d+(?:\.\d+)?)\s*[x×]\s*(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/);
  if (mult) return unitToKg(parseFloat(mult[1]) * parseFloat(mult[2]), mult[3]);
  // single token — take the last one (weight usually trails the name)
  const all = [...s.matchAll(/(\d+(?:\.\d+)?)\s*(kg|g|ml|l)\b/g)];
  if (all.length === 0) return undefined;
  const m = all[all.length - 1];
  return unitToKg(parseFloat(m[1]), m[2]);
}

// ─── Per-store line decisions (is this even a product?) ───────────────────────
// When a suspect line comes up the UI asks; the user's verdict is remembered
// PER STORE so next time the same junk line is auto-handled. 'ignore' = not a
// product (auto-removed), 'product' = real (never flag again).

const LINE_KEY = 'receipt_line_memory';
export type LineVerdict = 'ignore' | 'product';
type LineMemory = Record<string, Record<string, LineVerdict>>; // store → normName → verdict

function storeSlug(store?: string): string {
  return (store ?? 'generic').toLowerCase().trim() || 'generic';
}

export async function loadLineMemory(): Promise<LineMemory> {
  try {
    const raw = await AsyncStorage.getItem(LINE_KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

// Look up a verdict for a line within a store (exact then fuzzy on the name).
export function lineVerdict(mem: LineMemory, store: string | undefined, name: string): LineVerdict | undefined {
  const byStore = mem[storeSlug(store)];
  if (!byStore) return undefined;
  const key = normalizeProductName(name);
  if (byStore[key]) return byStore[key];
  return findFuzzyMatch(key, byStore);
}

export async function saveLineVerdicts(
  store: string | undefined,
  verdicts: { name: string; verdict: LineVerdict }[],
): Promise<void> {
  if (verdicts.length === 0) return;
  try {
    const mem = await loadLineMemory();
    const slug = storeSlug(store);
    const byStore = mem[slug] ?? {};
    for (const v of verdicts) {
      const key = normalizeProductName(v.name);
      if (key) byStore[key] = v.verdict;
    }
    const entries = Object.entries(byStore);
    mem[slug] = entries.length > MAX_ENTRIES ? Object.fromEntries(entries.slice(-MAX_ENTRIES)) : byStore;
    await AsyncStorage.setItem(LINE_KEY, JSON.stringify(mem));
  } catch {}
}

export async function saveCustomProductsToMemory(
  products: { name: string; category: ExpenseCategory }[],
): Promise<void> {
  if (products.length === 0) return;
  try {
    const memory = await loadProductMemory();
    for (const p of products) {
      const name = p.name.trim();
      if (name) memory[normalize(name)] = p.category;
    }
    const entries = Object.entries(memory);
    const trimmed = entries.length > MAX_ENTRIES
      ? Object.fromEntries(entries.slice(-MAX_ENTRIES))
      : memory;
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {}
}
