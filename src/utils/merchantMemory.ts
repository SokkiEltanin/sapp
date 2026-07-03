import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpenseCategory } from '@/types';

// Learns how to read a bank notification: for each merchant (store keyword) remembers
// the category (and a cleaned display name) the user confirmed, so the next payment
// from the same shop is auto-categorised correctly. This is how the reader "gets
// better" every time you fix one.
const KEY = 'merchant_memory_v1';

export interface MerchantInfo { category: ExpenseCategory; name?: string }
export type MerchantMemory = Record<string, MerchantInfo>; // storeKey (lowercased) → info

export async function loadMerchantMemory(): Promise<MerchantMemory> {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

export async function saveMerchant(storeKey: string, info: MerchantInfo): Promise<void> {
  const key = storeKey.trim().toLowerCase();
  if (!key) return;
  try {
    const mem = await loadMerchantMemory();
    mem[key] = { category: info.category, ...(info.name ? { name: info.name } : {}) };
    await AsyncStorage.setItem(KEY, JSON.stringify(mem));
  } catch {}
}

export function merchantFor(storeKey: string, mem: MerchantMemory): MerchantInfo | undefined {
  return mem[storeKey.trim().toLowerCase()];
}

// First guess for a store's category before anything is learned — a small built-in
// dictionary of common Polish chains. Falls back to 'groceries'.
const STORE_CAT: [string[], ExpenseCategory][] = [
  [['lidl', 'biedronka', 'kaufland', 'auchan', 'carrefour', 'żabka', 'zabka', 'aldi', 'netto', 'dino', 'stokrotka', 'lewiatan', 'delikatesy', 'spar'], 'groceries'],
  [['orlen', ' bp', 'shell', 'circle k', 'moya', 'lotos', 'amic', 'stacja paliw', 'mpk', 'pkp', 'intercity', 'uber', 'bolt'], 'transport'],
  [['mcdonald', 'kfc', 'burger', 'pizza', 'kebab', 'sushi', 'restauracja', 'pyszne', 'glovo', 'wolt', 'kino', 'cinema', 'steam', 'spotify', 'netflix'], 'entertainment'],
  [['rossmann', 'hebe', 'super-pharm', 'apteka', 'ziko', 'dr max', 'gemini'], 'health'],
  [['ccc', 'deichmann', 'reserved', 'sinsay', 'house', 'cropp', 'h&m', 'zara', 'pepco', 'primark', 'decathlon'], 'clothing'],
  [['media expert', 'rtv euro', 'x-kom', 'komputronik', 'media markt', 'empik', 'action', 'ikea', 'leroy'], 'other'],
];

export function guessCategory(store: string): ExpenseCategory {
  const s = store.toLowerCase();
  for (const [kws, cat] of STORE_CAT) if (kws.some(k => s.includes(k))) return cat;
  return 'groceries';
}
