import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense, ReceiptItem } from '@/types';
import { looksLikeFood } from '@/utils/calories';
import { normalizeProductName } from '@/utils/productMemory';

// Food spend = FOOD items only, not the whole grocery receipt. Papier toaletowy /
// chemia / higiena bought at Lidl must NOT count as jedzenie. Food sub-tags drive the
// breakdown; chemia/higiena are the non-food tags we exclude.

export const FOOD_SUBCATS: { tag: string; label: string; color: string }[] = [
  { tag: 'mięso',        label: 'Mięso',        color: '#F87171' },
  { tag: 'nabiał',       label: 'Nabiał',       color: '#FBBF24' },
  { tag: 'ryby',         label: 'Ryby',         color: '#38BDF8' },
  { tag: 'warzywa',      label: 'Warzywa',      color: '#34D399' },
  { tag: 'owoce',        label: 'Owoce',        color: '#FB7185' },
  { tag: 'pieczywo',     label: 'Pieczywo',     color: '#D6A15E' },
  { tag: 'słodycze',     label: 'Słodycze',     color: '#C084FC' },
  { tag: 'napoje',       label: 'Napoje',       color: '#22D3EE' },
  { tag: 'przekąski',    label: 'Przekąski',    color: '#F59E0B' },
  { tag: 'dania gotowe', label: 'Dania gotowe', color: '#A3E635' },
];
export const FOOD_SUBCAT_META: Record<string, { label: string; color: string }> = {
  ...Object.fromEntries(FOOD_SUBCATS.map(s => [s.tag, { label: s.label, color: s.color }])),
  inne: { label: 'Inne jedzenie', color: '#9CA3AF' },
};

const FOOD_TAG_SET = new Set(FOOD_SUBCATS.map(s => s.tag));
export const NONFOOD_TAGS = new Set(['chemia', 'higiena']);

// ── User "to nie jedzenie" list ───────────────────────────────────────────────
// Names (products or store/expense names) the user explicitly marked as NOT food
// from the food-breakdown drill-down — e.g. a "groceries"-miscategorised bank charge
// (CASHBILL, Amazon). Kept as a module set (loaded once at startup) so every food
// calc — widget, finances hero, stat widgets — agrees without threading a param.
const NONFOOD_KEY = 'user_nonfood_names_v1';
let userNonFood = new Set<string>();
export function isUserNonFood(name?: string): boolean {
  return !!name && userNonFood.has(normalizeProductName(name));
}
export function setNonFoodNames(names: string[]): void {
  userNonFood = new Set(names.map(n => normalizeProductName(n)).filter(Boolean));
}
export async function loadNonFood(): Promise<string[]> {
  try { const raw = await AsyncStorage.getItem(NONFOOD_KEY); const arr: string[] = raw ? JSON.parse(raw) : []; setNonFoodNames(arr); return [...userNonFood]; } catch { return []; }
}
export async function addNonFood(name: string): Promise<void> {
  const key = normalizeProductName(name);
  if (!key) return;
  userNonFood.add(key);
  try { await AsyncStorage.setItem(NONFOOD_KEY, JSON.stringify([...userNonFood])); } catch {}
}
export async function removeNonFood(name: string): Promise<void> {
  userNonFood.delete(normalizeProductName(name));
  try { await AsyncStorage.setItem(NONFOOD_KEY, JSON.stringify([...userNonFood])); } catch {}
}

// Is a receipt line food? user "nie jedzenie" / chemia/higiena → never; an explicit food
// tag → yes; otherwise any groceries-category line counts (most grocery items are food;
// non-food should be tagged chemia/higiena or categorised away by the scanner).
export function isFoodItem(it: ReceiptItem): boolean {
  if (it.kind === 'deposit') return false;
  if (isUserNonFood(it.name)) return false;
  const tags = (it.tags ?? []).map(t => t.toLowerCase());
  if (tags.some(t => NONFOOD_TAGS.has(t))) return false;
  if (tags.some(t => FOOD_TAG_SET.has(t))) return true;
  return it.category === 'groceries' && looksLikeFood(it);
}

// A food item's sub-category = its first food tag, else 'inne'.
export function foodSubcat(it: ReceiptItem): string {
  const tags = (it.tags ?? []).map(t => t.toLowerCase());
  for (const s of FOOD_SUBCATS) if (tags.includes(s.tag)) return s.tag;
  return 'inne';
}

// How much of an expense is FOOD: with items → sum food lines; without items but the
// whole expense is groceries → the whole amount (can't break it down); else 0.
export function foodAmountOf(e: Expense): number {
  const items = e.receiptItems ?? [];
  if (items.length > 0) {
    let sum = 0;
    for (const it of items) if (isFoodItem(it)) sum += it.price ?? 0;
    return sum;
  }
  if (e.category !== 'groceries') return 0;
  if (isUserNonFood(e.storeName || 'Zakupy (bez pozycji)')) return 0;   // user marked it "nie jedzenie"
  return e.amount;
}
