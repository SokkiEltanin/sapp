import { FoodUnit } from '@/store/foodStore';
import { normalizeProductName } from '@/utils/productMemory';

// Built-in OFFLINE base — deliberately ONLY fruit & vegetables (kcal per 100 g +
// household portion grams). Everything else the user adds himself over time via the
// "Dodaj produkt" form (kcal + macros + optional link to a purchased item), and it
// gets remembered in foodStore — his own products always win over this starter set.

export interface BaseFood {
  name: string;
  kcal: number;                                   // per 100 g
  protein?: number;                               // g / 100 g
  unit?: FoodUnit;                                // best default unit when logging
  unitGrams?: Partial<Record<FoodUnit, number>>;  // grams for that product's units
}

export const FOOD_BASE: BaseFood[] = [
  // ── Warzywa ──────────────────────────────────────────────────────────────
  { name: 'Ziemniaki (gotowane)', kcal: 77,  protein: 2,  unit: 'szt',     unitGrams: { szt: 120 } },
  { name: 'Frytki',               kcal: 312, protein: 3.4, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Puree ziemniaczane',   kcal: 90,  protein: 2,  unit: 'porcja',  unitGrams: { porcja: 200 } },
  { name: 'Pomidor',              kcal: 18,  protein: 0.9, unit: 'szt',    unitGrams: { szt: 120, plaster: 20 } },
  { name: 'Ogórek świeży',        kcal: 15,  protein: 0.7, unit: 'plaster', unitGrams: { plaster: 10, szt: 120 } },
  { name: 'Ogórek kiszony',       kcal: 12,  protein: 0.6, unit: 'plaster', unitGrams: { plaster: 10, szt: 40 } },
  { name: 'Ogórek konserwowy',    kcal: 20,  protein: 0.5, unit: 'plaster', unitGrams: { plaster: 8 } },
  { name: 'Cebula',               kcal: 40,  protein: 1.1, unit: 'szt',     unitGrams: { szt: 90 } },
  { name: 'Czosnek',              kcal: 110, protein: 6,   unit: 'szt',     unitGrams: { szt: 5 } },
  { name: 'Marchew',              kcal: 35,  protein: 0.9, unit: 'szt',     unitGrams: { szt: 70 } },
  { name: 'Papryka',              kcal: 30,  protein: 1,   unit: 'szt',     unitGrams: { szt: 120 } },
  { name: 'Sałata',               kcal: 15,  protein: 1.4, unit: 'garsc',   unitGrams: { garsc: 20 } },
  { name: 'Kapusta',              kcal: 25,  protein: 1.3, unit: 'garsc',   unitGrams: { garsc: 40 } },
  { name: 'Kapusta kiszona',      kcal: 19,  protein: 1,   unit: 'porcja',  unitGrams: { porcja: 100 } },
  { name: 'Brokuł',               kcal: 34,  protein: 2.8, unit: 'porcja',  unitGrams: { porcja: 100 } },
  { name: 'Kalafior',             kcal: 25,  protein: 1.9, unit: 'porcja',  unitGrams: { porcja: 100 } },
  { name: 'Pieczarki',            kcal: 22,  protein: 3.1, unit: 'porcja',  unitGrams: { porcja: 80 } },
  { name: 'Cukinia',              kcal: 17,  protein: 1.2, unit: 'szt',     unitGrams: { szt: 200 } },
  { name: 'Buraki',               kcal: 43,  protein: 1.6, unit: 'porcja',  unitGrams: { porcja: 100 } },
  { name: 'Szpinak',              kcal: 23,  protein: 2.9, unit: 'garsc',   unitGrams: { garsc: 30 } },
  { name: 'Kukurydza (konserwowa)', kcal: 86, protein: 3,  unit: 'lyzka',   unitGrams: { lyzka: 20 } },
  { name: 'Groszek konserwowy',   kcal: 81,  protein: 5,   unit: 'lyzka',   unitGrams: { lyzka: 20 } },
  { name: 'Fasolka szparagowa',   kcal: 31,  protein: 1.8, unit: 'porcja',  unitGrams: { porcja: 100 } },
  { name: 'Awokado',              kcal: 160, protein: 2,   unit: 'szt',     unitGrams: { szt: 150 } },
  { name: 'Sałata lodowa',        kcal: 14,  protein: 0.9, unit: 'garsc',   unitGrams: { garsc: 20 } },
  { name: 'Rukola',               kcal: 25,  protein: 2.6, unit: 'garsc',   unitGrams: { garsc: 20 } },
  { name: 'Rzodkiewka',           kcal: 16,  protein: 0.7, unit: 'szt',     unitGrams: { szt: 15 } },
  { name: 'Seler naciowy',        kcal: 16,  protein: 0.7, unit: 'szt',     unitGrams: { szt: 40 } },
  { name: 'Bakłażan',             kcal: 25,  protein: 1,   unit: 'szt',     unitGrams: { szt: 250 } },
  { name: 'Dynia',                kcal: 26,  protein: 1,   unit: 'porcja',  unitGrams: { porcja: 100 } },
  { name: 'Batat',                kcal: 86,  protein: 1.6, unit: 'szt',     unitGrams: { szt: 130 } },
  { name: 'Por',                  kcal: 61,  protein: 1.5, unit: 'szt',     unitGrams: { szt: 90 } },
  { name: 'Kalarepa',             kcal: 27,  protein: 1.7, unit: 'szt',     unitGrams: { szt: 150 } },

  // ── Owoce ────────────────────────────────────────────────────────────────
  { name: 'Jabłko',               kcal: 52,  protein: 0.3, unit: 'szt',   unitGrams: { szt: 150 } },
  { name: 'Banan',                kcal: 89,  protein: 1.1, unit: 'szt',   unitGrams: { szt: 120 } },
  { name: 'Pomarańcza',           kcal: 47,  protein: 0.9, unit: 'szt',   unitGrams: { szt: 130 } },
  { name: 'Gruszka',              kcal: 57,  protein: 0.4, unit: 'szt',   unitGrams: { szt: 150 } },
  { name: 'Mandarynka',           kcal: 53,  protein: 0.8, unit: 'szt',   unitGrams: { szt: 70 } },
  { name: 'Winogrona',            kcal: 67,  protein: 0.6, unit: 'garsc', unitGrams: { garsc: 80 } },
  { name: 'Truskawki',            kcal: 32,  protein: 0.7, unit: 'garsc', unitGrams: { garsc: 80 } },
  { name: 'Borówki',              kcal: 57,  protein: 0.7, unit: 'garsc', unitGrams: { garsc: 60 } },
  { name: 'Maliny',               kcal: 52,  protein: 1.2, unit: 'garsc', unitGrams: { garsc: 60 } },
  { name: 'Śliwka',               kcal: 46,  protein: 0.7, unit: 'szt',   unitGrams: { szt: 50 } },
  { name: 'Brzoskwinia',          kcal: 39,  protein: 0.9, unit: 'szt',   unitGrams: { szt: 120 } },
  { name: 'Kiwi',                 kcal: 61,  protein: 1.1, unit: 'szt',   unitGrams: { szt: 75 } },
  { name: 'Arbuz',                kcal: 30,  protein: 0.6, unit: 'porcja', unitGrams: { porcja: 200 } },
  { name: 'Ananas',               kcal: 50,  protein: 0.5, unit: 'porcja', unitGrams: { porcja: 100 } },
  { name: 'Cytryna',              kcal: 29,  protein: 1.1, unit: 'szt',   unitGrams: { szt: 60 } },
  { name: 'Nektarynka',           kcal: 44,  protein: 1.1, unit: 'szt',   unitGrams: { szt: 130 } },
  { name: 'Grejpfrut',            kcal: 42,  protein: 0.8, unit: 'szt',   unitGrams: { szt: 250 } },
  { name: 'Czereśnie',            kcal: 63,  protein: 1,   unit: 'garsc', unitGrams: { garsc: 80 } },
  { name: 'Wiśnie',               kcal: 50,  protein: 1,   unit: 'garsc', unitGrams: { garsc: 80 } },
  { name: 'Melon',                kcal: 34,  protein: 0.8, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Mango',                kcal: 60,  protein: 0.8, unit: 'szt',   unitGrams: { szt: 200 } },
  { name: 'Granat',               kcal: 83,  protein: 1.7, unit: 'szt',   unitGrams: { szt: 200 } },
  { name: 'Awokado (owoc)',       kcal: 160, protein: 2,   unit: 'szt',   unitGrams: { szt: 150 } },

  // ── Podstawy do wypieków / gotowania ──────────────────────────────────────
  // Dodane po to, by PRZEPISY (naleśniki, ciasta) liczyły się od razu: kluczowe są
  // poprawne gramy na jednostkę (szklanka mąki ≈ 130 g, nie 250; jajko ≈ 55 g).
  { name: 'Jajko',                kcal: 143, protein: 13,  unit: 'szt',      unitGrams: { szt: 55 } },
  { name: 'Mąka pszenna',         kcal: 364, protein: 10,  unit: 'szklanka', unitGrams: { szklanka: 130, lyzka: 9 } },
  { name: 'Mąka pełnoziarnista',  kcal: 340, protein: 13,  unit: 'szklanka', unitGrams: { szklanka: 120, lyzka: 8 } },
  { name: 'Mąka ziemniaczana',    kcal: 343, protein: 0.4, unit: 'lyzka',    unitGrams: { szklanka: 160, lyzka: 12 } },
  { name: 'Mleko 2%',             kcal: 50,  protein: 3.4, unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Olej rzepakowy',       kcal: 884, protein: 0,   unit: 'lyzka',    unitGrams: { lyzka: 13, lyzeczka: 5 } },
  { name: 'Cukier',               kcal: 400, protein: 0,   unit: 'lyzka',    unitGrams: { szklanka: 220, lyzka: 12, lyzeczka: 5 } },
  { name: 'Masło',                kcal: 735, protein: 0.9, unit: 'lyzka',    unitGrams: { lyzka: 15, lyzeczka: 5, szt: 200 } },
  { name: 'Woda',                 kcal: 0,   protein: 0,   unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
];

// Fuzzy-ish search over the base: normalized substring + token match, ranked so a
// name that STARTS with the query beats one that merely contains it. Returns up to
// `limit` best matches (all when the query is empty, capped).
export function searchFoodBase(query: string, limit = 30): BaseFood[] {
  const q = normalizeProductName(query);
  if (!q) return FOOD_BASE.slice(0, limit);
  const toks = q.split(' ').filter(Boolean);
  const scored: { f: BaseFood; score: number }[] = [];
  for (const f of FOOD_BASE) {
    const nk = normalizeProductName(f.name);
    let score = 0;
    if (nk === q) score = 100;
    else if (nk.startsWith(q)) score = 70;
    else if (nk.includes(q)) score = 45;
    else if (toks.every(t => nk.includes(t))) score = 30;
    if (score > 0) { score -= f.name.length * 0.1; scored.push({ f, score }); }
  }
  scored.sort((a, b) => b.score - a.score);
  return scored.slice(0, limit).map(s => s.f);
}
