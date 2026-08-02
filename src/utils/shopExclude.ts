import AsyncStorage from '@react-native-async-storage/async-storage';

// User-curated "to nie sklep" list for the "Kolekcja sklepów" dashboard card. The card
// counts distinct expense `storeName`s, which also catches transfers / people / one-off
// merchants (Olesia, "Przelew wychodzący", CASHBILL…). Excluding one here teaches the
// card to skip that name forever — mirrors the food `user_nonfood_names_v1` pattern.
const KEY = 'user_nonshop_names_v1';

const norm = (s?: string) => (s ?? '').trim().toLowerCase();

let excluded = new Set<string>();

export function isUserNonShop(name?: string): boolean {
  return !!name && excluded.has(norm(name));
}

export function setNonShopNames(names: string[]): void {
  excluded = new Set(names.map(norm).filter(Boolean));
}

export async function loadNonShop(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const arr: string[] = raw ? JSON.parse(raw) : [];
    setNonShopNames(arr);
    return [...excluded];
  } catch { return []; }
}

export async function addNonShop(name: string): Promise<void> {
  const key = norm(name);
  if (!key) return;
  excluded.add(key);
  try { await AsyncStorage.setItem(KEY, JSON.stringify([...excluded])); } catch {}
}

export async function removeNonShop(name: string): Promise<void> {
  const key = norm(name);
  if (!excluded.delete(key)) return;
  try { await AsyncStorage.setItem(KEY, JSON.stringify([...excluded])); } catch {}
}
