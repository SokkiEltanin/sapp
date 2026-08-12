import { Expense, ReceiptItem } from '@/types';
import { consumesInScope } from '@/store/statsScope';
import { KcalMemory, kcalFor, normalizeProductName } from '@/utils/productMemory';

// Known foods → kcal per 100 g (of the product as bought). Keys are diacritic-free
// lowercase (matched against normalizeProductName). The most specific (longest)
// matching key wins, so "ser zolty" beats "ser". This is the main accuracy lever:
// raw ingredients ("ziemniaki", "mleko") get a real value instead of a category
// guess. Prepared dishes (puree, zapiekanka…) are best set per-product in Produkty.
// Kilka kluczy ma jawnie dodaną liczbę mnogą obok (jablko/jablka, ogorek/ogorki...).
// Powód: polska liczba mnoga czasem zmienia rdzeń (ruchome e: serek→serki; zmiana
// końcówki: jablko→jablka) więc "jablka".startsWith("jablko") jest FAŁSZEM — dopasowanie
// po nazwie by cicho nie trafiało we frytki/warzywa/owoce kupowane w liczbie mnogiej
// (a to jest DOMINUJĄCA forma dla produktów na paragonie). Skracanie klucza do samego
// rdzenia bywa NIEBEZPIECZNE (np. "ogor" złapałoby "zupa ogórkowa" jako surowy ogórek),
// więc zamiast skracać — DODAJEMY drugi, pełny klucz (ten sam wzorzec co już jaj/jajk niżej).
const FOOD_KCAL: Record<string, number> = {
  // warzywa / ziemniaki
  ziemniak: 77, frytki: 312, puree: 90, pomidor: 18, ogorek: 15, ogorki: 15, cebula: 40, cebule: 40, czosnek: 110,
  marchew: 35, papryka: 30, papryki: 30, salata: 15, salaty: 15, kapusta: 25, brokul: 34, kalafior: 25, pieczarki: 22,
  cukinia: 17, cukinie: 17, baklazan: 25, burak: 43, dynia: 26, dynie: 26, szpinak: 23, fasolka: 31, groszek: 81, kukurydza: 86,
  // owoce
  jablko: 52, jablka: 52, banan: 89, pomarancza: 47, pomarancze: 47, gruszka: 57, gruszki: 57,
  winogrono: 67, winogrona: 67, truskawk: 32, borowk: 57,
  malin: 52, sliwk: 46, brzoskwin: 39, mandarynk: 53, cytryn: 29, arbuz: 30, ananas: 50, kiwi: 61, awokado: 160,
  // nabiał / jaja
  mleko: 50, jogurt: 60, kefir: 50, maslanka: 40, maslanki: 40, smietana: 200, smietanka: 120, masl: 720,
  serek: 95, serki: 95, twarog: 100, ser: 350, mozzarella: 280, feta: 265, parmezan: 400, jaj: 145, jajk: 145,
  // pieczywo / zboża
  chleb: 250, bulk: 280, pieczyw: 265, tortilla: 310, bagietka: 270, bagietki: 270, makaron: 350, ryz: 350,
  kasza: 340, platki: 370, owsian: 370, musli: 380, granola: 450, maka: 360, otreby: 320,
  // mięso / ryby
  kurczak: 165, piers: 165, indyk: 150, wolowin: 250, wieprzow: 240, schab: 240, karkowk: 260,
  mielone: 240, kielbas: 300, szynk: 145, parowk: 270, boczek: 540, salami: 380, kabanos: 460, pasztet: 300,
  ryba: 90, ryby: 90, dorsz: 80, losos: 200, makrela: 200, makrele: 200, tunczyk: 130, sledz: 160, panga: 90, pangi: 90, krewetk: 85,
  // tłuszcze / sosy
  oliwa: 880, olej: 880, majonez: 680, ketchup: 110, musztard: 100, sos: 120, smalec: 890,
  // słodycze / przekąski
  cukier: 400, miod: 304, dzem: 250, nutella: 540, czekolad: 540, ciastk: 470, herbatnik: 460,
  baton: 480, lody: 200, chips: 530, paluszk: 400, krakers: 500, popcorn: 480, zelk: 340, guma: 250,
  // napoje
  woda: 0, sok: 45, cola: 42, pepsi: 43, napoj: 40, lemoniada: 40, piwo: 43, wino: 85, wodka: 230, whisky: 250, energetyk: 45,
  kawa: 2, herbat: 1,
  // strączki / inne
  hummus: 170, fasol: 130, ciecierzyc: 160, soczewic: 115, tofu: 120, orzech: 600, migdal: 580, orzeszk: 580,
  pizza: 270, zupa: 45, kanapk: 250, zapiekank: 240, pierog: 230, nalesnik: 180,
};
const FOOD_KCAL_ENTRIES = Object.entries(FOOD_KCAL).sort((a, b) => b[0].length - a[0].length);

// kcal/100g from the product NAME via the known-foods table (longest match wins).
// null = no match (so a real 0, e.g. woda, isn't mistaken for "unknown").
export function foodKcalByName(name: string): number | null {
  const norm = normalizeProductName(name);
  if (!norm) return null;
  const tokens = norm.split(' ');
  for (const [kw, kcal] of FOOD_KCAL_ENTRIES) {
    if (kw.includes(' ') ? norm.includes(kw) : tokens.some(t => t.startsWith(kw))) return kcal;
  }
  return null;
}

// Rough kcal per 100 g by food sub-tag (most specific) then category. These are
// ESTIMATES for a trend signal (energy balance), not a clinical counter.
const TAG_KCAL: Record<string, number> = {
  'słodycze': 450, 'czekolada': 540, 'ciastka': 470, 'lody': 200, 'przekąski': 500, 'chipsy': 530,
  'pieczywo': 265, 'makaron': 350, 'ryż': 350, 'kasza': 340, 'płatki': 370, 'mąka': 360,
  'ser': 350, 'nabiał': 120, 'jogurt': 70, 'jaja': 145, 'masło': 720, 'olej': 880, 'tłuszcze': 800,
  'mięso': 220, 'wędliny': 250, 'ryby': 160, 'drób': 170,
  'owoce': 55, 'warzywa': 35, 'orzechy': 600,
  'napoje': 40, 'soki': 45, 'alkohol': 250, 'piwo': 45,
  'fast food': 300, 'gotowe': 180,
};
// No blanket category fallback — counting every "groceries" line as food (140
// kcal) inflated intake with non-food (toilet paper etc.). Now we only count what
// we recognise (known food name or a food sub-tag); set the rest in Produkty.
const CAT_KCAL: Record<string, number> = {};

// kcal/100g for an item: a per-product learned value (Produkty screen) wins, else
// food sub-tag, else category.
export function kcalPer100g(it: { name?: string; tags?: string[]; category?: string }, mem?: KcalMemory): number {
  if (mem && it.name) { const learned = kcalFor(it.name, mem); if (learned != null && learned > 0) return learned; }
  if (it.name) { const byName = foodKcalByName(it.name); if (byName != null) return byName; } // known food by name
  for (const t of it.tags ?? []) { const v = TAG_KCAL[t.toLowerCase()]; if (v != null) return v; }
  return CAT_KCAL[it.category ?? ''] ?? 0; // 0 = not recognised as food → excluded
}

// kcal for one receipt item: grams (explicit weight, else ~150 g/szt guess) × density.
export function estimateItemKcal(it: ReceiptItem, mem?: KcalMemory): number {
  // Personal intake proxy → count only what I ate (untagged/shared = mine; items
  // tagged for someone else are excluded so they don't inflate my calories).
  if (!consumesInScope(it, 'mine')) return 0;
  const per100 = kcalPer100g(it, mem);
  if (per100 <= 0) return 0;
  let grams = (it.weightKg ?? 0) * 1000;
  if (grams <= 0) grams = 150 * (it.quantity > 0 ? it.quantity : 1);
  return Math.round((grams / 100) * per100);
}

// Plausibly a food the user might want to set kcal for (drives the Produkty list).
// Broader than "has a kcal value" so unrecognised foods still show up to be set.
export function looksLikeFood(it: { name?: string; tags?: string[]; category?: string }): boolean {
  if (foodKcalByName(it.name ?? '') != null) return true;
  if ((it.tags ?? []).some(t => TAG_KCAL[t.toLowerCase()] != null)) return true;
  return it.category === 'groceries';
}

export function expenseFoodKcal(e: Expense, mem?: KcalMemory): number {
  if (e.type === 'income') return 0;
  const items = e.receiptItems ?? [];
  if (items.length === 0) return 0; // plain expenses (no breakdown) → can't estimate
  return items.reduce((s, it) => s + estimateItemKcal(it, mem), 0);
}

// Estimated food energy bought on a given day (YYYY-MM-DD). A proxy for intake.
export function foodKcalForDate(expenses: Expense[], dateStr: string, mem?: KcalMemory): number {
  return expenses
    .filter(e => e.type !== 'income' && e.date.slice(0, 10) === dateStr)
    .reduce((s, e) => s + expenseFoodKcal(e, mem), 0);
}

// Average estimated daily food energy over the last N days (smooths buy≠eat noise).
export function avgFoodKcal(expenses: Expense[], days: number, mem?: KcalMemory): number {
  const now = new Date();
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    total += foodKcalForDate(expenses, ds, mem);
  }
  return Math.round(total / days);
}
