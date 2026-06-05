import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpenseCategory } from '@/types';

const KEY      = 'product_category_memory';
const TAG_KEY  = 'product_tag_memory';
const NAME_KEY = 'product_name_aliases';
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

// Resolve a raw product name to its canonical form using learned aliases
// (exact key → fuzzy key → prettified raw fallback).
export function canonicalProductName(raw: string, aliases: NameAliases): string {
  const key = normalizeProductName(raw);
  if (aliases[key]) return aliases[key];
  const fuzzy = findFuzzyMatch(key, aliases);
  if (fuzzy) return fuzzy;
  return raw.trim();
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
