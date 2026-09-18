import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense, ReceiptItem } from '@/types';
import { looksLikeFood } from '@/utils/calories';
import { normalizeProductName } from '@/utils/productMemory';

// Food spend = FOOD items only, not the whole grocery receipt. Papier toaletowy /
// chemia / higiena bought at Lidl must NOT count as jedzenie. Food sub-tags drive the
// breakdown; chemia/higiena are the non-food tags we exclude.

// Rozbudowane (2026-09-16, user: "jak mamy wydatki per kategoria z jedzeniem proponuję
// lekko rozbudowac o inne kategorie bo ciężko dopasować i sporo jest w inne") — 8 nowych
// tagów (jajka/makarony/ryż i kasze/mąka i produkty sypkie/oleje i tłuszcze/przyprawy/
// konserwy i przetwory/mrożonki) + realnie brakujące słowa kluczowe dla 'sosy' (patrz
// FOOD_TAG_MAP w receiptParser.ts — tag ISTNIAŁ tu w FOOD_SUBCATS, ale miał ZERO słów
// kluczowych w drugim pliku, więc NIC nigdy się pod niego nie podpinało — dokładnie ta
// "ciężko dopasować" luka, o którą user pytał).
//
// Kolejność = priorytet rozstrzygania w `foodSubcat()` (pierwszy pasujący tag wygrywa, gdy
// nazwa produktu łapie kilka naraz). 'sosy'/'przyprawy'/'konserwy i przetwory' są CELOWO
// zaraz po 'mięso', PRZED warzywa/owoce/nabiał — to kategorie "stanu przetworzenia", ich
// słowa kluczowe łapią się WEWNĄTRZ nazw zawierających też surowy składnik ("Przyprawa do
// KURCZAKA" nie jest mięsem, "Dżem TRUSKAWKOWY" nie jest świeżym owocem, "Sos POMIDOROWY"
// nie jest warzywem) — zweryfikowane ręcznym testem (`getFoodTags`+`foodSubcat` na
// realnych nazwach), nie samym czytaniem listy. Reszta kolejności ISTNIEJĄCYCH tagów
// (nabiał→ryby→warzywa→owoce→pieczywo→słodycze→napoje→przekąski→dania gotowe) nietknięta —
// nowe kategorie bez takiego konfliktu wstawione zwyczajnie obok pokrewnych.
export const FOOD_SUBCATS: { tag: string; label: string; color: string }[] = [
  { tag: 'mięso',        label: 'Mięso',        color: '#F87171' },
  { tag: 'sosy',         label: 'Sosy',         color: '#FB923C' },
  { tag: 'przyprawy',    label: 'Przyprawy',    color: '#B45309' },
  { tag: 'konserwy i przetwory', label: 'Konserwy i przetwory', color: '#78716C' },
  { tag: 'nabiał',       label: 'Nabiał',       color: '#FBBF24' },
  { tag: 'jajka',        label: 'Jajka',        color: '#FDE047' },
  { tag: 'ryby',         label: 'Ryby',         color: '#38BDF8' },
  { tag: 'warzywa',      label: 'Warzywa',      color: '#34D399' },
  { tag: 'owoce',        label: 'Owoce',        color: '#FB7185' },
  { tag: 'pieczywo',     label: 'Pieczywo',     color: '#D6A15E' },
  { tag: 'makarony',     label: 'Makarony',     color: '#CA8A04' },
  { tag: 'ryż i kasze',  label: 'Ryż i kasze',  color: '#A16207' },
  { tag: 'mąka i produkty sypkie', label: 'Mąka i produkty sypkie', color: '#E7D8B1' },
  { tag: 'oleje i tłuszcze', label: 'Oleje i tłuszcze', color: '#FDBA74' },
  { tag: 'słodycze',     label: 'Słodycze',     color: '#C084FC' },
  { tag: 'napoje',       label: 'Napoje',       color: '#22D3EE' },
  { tag: 'przekąski',    label: 'Przekąski',    color: '#F59E0B' },
  { tag: 'dania gotowe', label: 'Dania gotowe', color: '#A3E635' },
  { tag: 'mrożonki',     label: 'Mrożonki',     color: '#7DD3FC' },
];
export const FOOD_SUBCAT_META: Record<string, { label: string; color: string }> = {
  ...Object.fromEntries(FOOD_SUBCATS.map(s => [s.tag, { label: s.label, color: s.color }])),
  inne: { label: 'Inne jedzenie', color: '#9CA3AF' },
};

// Płaska lista tagów jedzenia do picker-ów w UI (2026-09-18, user: "nadal nie pokazuje sie
// kategoria produkty sypkie... i na kategorie makarony i ryżem kasze... zeby tam byly tagi
// jaja tez i przyprawy") — 4 osobne, plik-lokalne kopie `ITEM_TAGS` (scan.tsx/manual.tsx/
// products.tsx/expenses/[id].tsx) miały WŁASNE, niezależnie rozjeżdżające się listy, żadna
// nie dostała 8 nowych kategorii z rozbudowy wyżej (jajka/sosy/przyprawy/konserwy i
// przetwory/makarony/ryż i kasze/mąka i produkty sypkie/oleje i tłuszcze/mrożonki) — auto-
// wykrywanie (`getFoodTags`) już je łapało poprawnie, ale user nie miał jak RĘCZNIE kliknąć
// żadnej z nich (ani poprawić stary paragon zeskanowany PRZED tą rozbudową, którego pozycje
// zostały z dawnym tagiem na stałe — nic nie re-tagguje wstecznie samo z siebie). Jedno
// źródło prawdy: dodanie kolejnej kategorii do `FOOD_SUBCATS` wyżej automatycznie pokaże się
// we WSZYSTKICH picker-ach, bez pamiętania o 4 rozrzuconych miejscach.
export const FOOD_ITEM_TAGS: string[] = FOOD_SUBCATS.map(s => s.tag);

const FOOD_TAG_SET = new Set(FOOD_SUBCATS.map(s => s.tag));
export const NONFOOD_TAGS = new Set(['chemia', 'higiena', 'nie jedzenie']);

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

// Bridges "co kupuję" (wydatki/paragony) → "co zjadłem" (dziennik jedzenia): looks up a
// food-subcat tag (słodycze/pieczywo/…) already assigned to a purchased receipt item
// with this exact name, so a NEW FoodProduct can inherit it instead of defaulting to
// no category (which avoid-habit/streak tracking reads via FoodProduct.cat — see
// matchedEatDays w countersStore.ts). Most recent purchase wins, so a re-tag on a later
// receipt takes over.
//
// `buildPurchasedCatIndex` was `purchasedCatForName(name, expenses)` doing a fresh
// `[...expenses].sort()` INSIDE the function (2026-09-02, PR#126) — cheap-looking, but
// `app/food/product.tsx` called it from a `useEffect` keyed on the NAME TEXT INPUT, so
// it re-sorted the user's entire expense history on every keystroke while typing a new
// product name. Documented as an unresolved "grey screen" (Co zjadłem → Produkty →
// ciastka → Zapisz, 2026-08-31 NEXT_STEPS.md) that "stopped repeating" without ever being
// fixed — it came back (2026-09-04, user: "dodałem ciastka wczorajsze... znowu mam black
// screena") the next time a genuinely NEW product name hit that path (an already-known
// product with a `cat` set skips this effect entirely, hence "dzisiejszymi nie ma
// problemu" if today's cookie was picked from an existing entry). Fix: sort+scan ONCE per
// `expenses` reference (memoized by the caller) into a name→subcat index; every lookup
// after that is an O(1) Map.get instead of an O(n log n) resort.
export function buildPurchasedCatIndex(expenses: Expense[]): Map<string, string> {
  const sorted = [...expenses].sort((a, b) => b.date.localeCompare(a.date));
  const map = new Map<string, string>();
  for (const e of sorted) {
    for (const it of e.receiptItems ?? []) {
      const key = normalizeProductName(it.name);
      if (!key || map.has(key)) continue;
      const sc = foodSubcat(it);
      if (sc !== 'inne') map.set(key, sc);   // keep looking at OLDER purchases if the newest has no useful tag
    }
  }
  return map;
}

// Returns undefined (never 'inne') when nothing usable is found, so callers can leave
// `cat` alone instead of forcing a guess.
export function purchasedCatForName(name: string, index: Map<string, string>): string | undefined {
  const key = normalizeProductName(name);
  return key ? index.get(key) : undefined;
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
