import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpenseCategory } from '@/types';

const KEY      = 'product_category_memory';
const TAG_KEY  = 'product_tag_memory';
const MAX_ENTRIES = 500;

type ProductMemory = Record<string, ExpenseCategory>;

function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
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
