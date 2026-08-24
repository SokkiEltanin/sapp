import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpenseCategory } from '@/types';

// Learns how to read a bank notification: for each merchant (store keyword) remembers
// the category (and a cleaned display name) the user confirmed, so the next payment
// from the same shop is auto-categorised correctly. This is how the reader "gets
// better" every time you fix one.
//
// It also earns TRUST gradually: every time you accept a payment for a shop WITHOUT
// changing its category, a clean-accept counter goes up; after AUTO_THRESHOLD clean
// accepts the shop graduates to `auto` and its future payments are logged for you
// automatically (still matched to receipts, still visible/undoable). Any correction
// resets the counter and drops it back to manual review — it has to re-earn trust.
const KEY = 'merchant_memory_v1';

export const AUTO_THRESHOLD = 5; // clean accepts before a merchant goes on autopilot

export interface MerchantInfo {
  category: ExpenseCategory;
  name?: string;
  cleanAccepts?: number; // consecutive accepts where the suggested category was kept
  auto?: boolean;        // graduated → log automatically without manual review
  tags?: string[];       // tags to auto-apply to future bank payments from this merchant
}
export type MerchantMemory = Record<string, MerchantInfo>; // storeKey (lowercased) → info

const norm = (k: string) => k.trim().toLowerCase();

export async function loadMerchantMemory(): Promise<MerchantMemory> {
  try { const raw = await AsyncStorage.getItem(KEY); return raw ? JSON.parse(raw) : {}; } catch { return {}; }
}

async function writeMemory(mem: MerchantMemory): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(mem)); } catch {}
}

// Save/refresh a merchant's category + name WITHOUT touching its trust counters.
export async function saveMerchant(storeKey: string, info: MerchantInfo): Promise<void> {
  const key = norm(storeKey);
  if (!key) return;
  const mem = await loadMerchantMemory();
  const prev = mem[key] ?? { category: info.category };
  mem[key] = { ...prev, category: info.category, ...(info.name ? { name: info.name } : {}) };
  await writeMemory(mem);
}

// Record one accepted payment and advance (or reset) the merchant's trust. Returns
// the updated info so the caller can tell the user "3/5" or "just went automatic".
export async function recordMerchantAccept(
  storeKey: string,
  opts: { category: ExpenseCategory; name?: string; corrected: boolean },
): Promise<MerchantInfo | undefined> {
  const key = norm(storeKey);
  if (!key) return undefined;
  const mem = await loadMerchantMemory();
  const prev = mem[key] ?? { category: opts.category };
  const next: MerchantInfo = {
    ...prev,
    category: opts.category,
    ...(opts.name ? { name: opts.name } : {}),
  };
  if (opts.corrected) {
    // the reader was wrong → back to square one, needs supervision again
    next.cleanAccepts = 0;
    next.auto = false;
  } else {
    next.cleanAccepts = (prev.cleanAccepts ?? 0) + 1;
    if (next.cleanAccepts >= AUTO_THRESHOLD) next.auto = true;
  }
  mem[key] = next;
  await writeMemory(mem);
  return next;
}

export function merchantFor(storeKey: string, mem: MerchantMemory): MerchantInfo | undefined {
  return mem[norm(storeKey)];
}

// Remember which tags this merchant's payments should carry from now on (2026-08-24,
// user: "jak mi dodało autopłatność z banku to chciałbym móc jej nadać że to jest opłata
// za internet, żeby mi łapało jak z wypłatą" — a bank auto-payment from a recognised
// recipient should auto-tag itself, the way the merchant's CATEGORY already does).
// Unlike category trust (`cleanAccepts`/`auto`, earned over 5 clean accepts), this is an
// explicit one-time choice on the expense screen — applies to the very next matching
// payment, no graduation period. Doesn't touch the category trust counters.
export async function saveMerchantTags(storeKey: string, tags: string[], name?: string): Promise<void> {
  const key = norm(storeKey);
  if (!key) return;
  const mem = await loadMerchantMemory();
  const prev = mem[key] ?? { category: guessCategory(name ?? key) };
  if (!mem[key] && !name) return; // nothing to guess a category from — nothing to save
  mem[key] = { ...prev, tags, ...(name ? { name } : {}) };
  await writeMemory(mem);
}

// Is this shop trusted enough to log automatically? (async form for headless ingest)
export async function merchantIsAuto(storeKey: string): Promise<boolean> {
  const mem = await loadMerchantMemory();
  return !!merchantFor(storeKey, mem)?.auto;
}

// Manual override — revoke (or grant) a shop's autopilot from the UI.
export async function setMerchantAuto(storeKey: string, auto: boolean): Promise<void> {
  const key = norm(storeKey);
  const mem = await loadMerchantMemory();
  const prev = mem[key];
  if (!prev) return;
  mem[key] = { ...prev, auto, ...(auto ? {} : { cleanAccepts: 0 }) };
  await writeMemory(mem);
}

// First guess for a store's category before anything is learned — a small built-in
// dictionary of common Polish chains. Falls back to 'groceries'.
const STORE_CAT: [string[], ExpenseCategory][] = [
  [['lidl', 'biedronka', 'kaufland', 'auchan', 'carrefour', 'żabka', 'zabka', 'aldi', 'netto', 'dino', 'stokrotka', 'lewiatan', 'delikatesy', 'spar'], 'groceries'],
  [['orlen', ' bp', 'shell', 'circle k', 'moya', 'lotos', 'amic', 'stacja paliw', 'mpk', 'pkp', 'intercity', 'uber', 'bolt'], 'transport'],
  [['mcdonald', 'kfc', 'burger', 'pizza', 'kebab', 'sushi', 'restauracja', 'pyszne', 'glovo', 'wolt', 'kino', 'cinema', 'steam', 'nuvei', 'núvei', 'spotify', 'netflix', 'playstation', 'xbox', 'epic games', 'gog'], 'entertainment'],
  [['rossmann', 'hebe', 'super-pharm', 'apteka', 'ziko', 'dr max', 'gemini'], 'health'],
  [['ccc', 'deichmann', 'reserved', 'sinsay', 'house', 'cropp', 'h&m', 'zara', 'pepco', 'primark', 'decathlon'], 'clothing'],
  [['media expert', 'rtv euro', 'x-kom', 'komputronik', 'media markt', 'empik', 'action', 'ikea', 'leroy'], 'other'],
];

export function guessCategory(store: string): ExpenseCategory {
  const s = store.toLowerCase();
  for (const [kws, cat] of STORE_CAT) if (kws.some(k => s.includes(k))) return cat;
  return 'groceries';
}
