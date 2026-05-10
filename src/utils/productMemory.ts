import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpenseCategory } from '@/types';

const KEY = 'product_category_memory';
const MAX_ENTRIES = 500;

type ProductMemory = Record<string, ExpenseCategory>;

function normalize(name: string): string {
  return name.toLowerCase().trim().replace(/\s+/g, ' ');
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
    if (memory[key]) result[i] = memory[key];
  }
  return result;
}

export async function saveProductCategories(
  products: { name: string }[],
  categories: Record<number, ExpenseCategory>,
  parsed: Record<number, ExpenseCategory>,
): Promise<void> {
  try {
    const memory = await loadProductMemory();
    for (const [idxStr, cat] of Object.entries(categories)) {
      const idx = parseInt(idxStr);
      const parsedCat = parsed[idx];
      if (cat !== parsedCat) {
        memory[normalize(products[idx].name)] = cat;
      }
    }
    const entries = Object.entries(memory);
    const trimmed = entries.length > MAX_ENTRIES
      ? Object.fromEntries(entries.slice(-MAX_ENTRIES))
      : memory;
    await AsyncStorage.setItem(KEY, JSON.stringify(trimmed));
  } catch {}
}
