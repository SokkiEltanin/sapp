import { FoodUnit } from '@/store/foodStore';
import { normalizeProductName } from '@/utils/productMemory';

// Built-in OFFLINE base of common Polish foods — kcal per 100 g, plus household
// portion grams for the ones you'd log "na oko" (a slice of ham, one egg, a
// tablespoon of ketchup) so you don't need a kitchen scale. No network, no API.
// This is a STARTER table: whatever you add/verify yourself lives in foodStore and
// wins over this. `protein` (g/100g) is filled where known for Etap 3; unused yet.

export interface BaseFood {
  name: string;
  kcal: number;                                   // per 100 g
  protein?: number;                               // g / 100 g
  unit?: FoodUnit;                                // best default unit when logging
  unitGrams?: Partial<Record<FoodUnit, number>>;  // grams for that product's units
}

export const FOOD_BASE: BaseFood[] = [
  // ── Pieczywo / zboża ─────────────────────────────────────────────────────
  { name: 'Chleb pszenny',        kcal: 250, protein: 8,  unit: 'kromka', unitGrams: { kromka: 30 } },
  { name: 'Chleb żytni',          kcal: 220, protein: 7,  unit: 'kromka', unitGrams: { kromka: 30 } },
  { name: 'Chleb razowy',         kcal: 210, protein: 8,  unit: 'kromka', unitGrams: { kromka: 30 } },
  { name: 'Bułka pszenna',        kcal: 280, protein: 9,  unit: 'szt',    unitGrams: { szt: 60 } },
  { name: 'Bułka grahamka',       kcal: 250, protein: 9,  unit: 'szt',    unitGrams: { szt: 60 } },
  { name: 'Bułka żytnia',         kcal: 240, protein: 8,  unit: 'szt',    unitGrams: { szt: 70 } },
  { name: 'Tortilla pszenna',     kcal: 310, protein: 8,  unit: 'szt',    unitGrams: { szt: 62 } },
  { name: 'Bagietka',             kcal: 270, protein: 9,  unit: 'kromka', unitGrams: { kromka: 30 } },
  { name: 'Makaron (suchy)',      kcal: 350, protein: 12, unit: 'porcja', unitGrams: { porcja: 75, szklanka: 90 } },
  { name: 'Makaron (ugotowany)',  kcal: 130, protein: 5,  unit: 'porcja', unitGrams: { porcja: 200 } },
  { name: 'Ryż (suchy)',          kcal: 350, protein: 7,  unit: 'porcja', unitGrams: { porcja: 75, szklanka: 180 } },
  { name: 'Ryż (ugotowany)',      kcal: 130, protein: 3,  unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Kasza gryczana',       kcal: 340, protein: 12, unit: 'porcja', unitGrams: { porcja: 75 } },
  { name: 'Kasza jaglana',        kcal: 350, protein: 11, unit: 'porcja', unitGrams: { porcja: 75 } },
  { name: 'Płatki owsiane',       kcal: 370, protein: 13, unit: 'porcja', unitGrams: { porcja: 50, lyzka: 10 } },
  { name: 'Musli',                kcal: 380, protein: 10, unit: 'porcja', unitGrams: { porcja: 50 } },
  { name: 'Granola',              kcal: 450, protein: 9,  unit: 'porcja', unitGrams: { porcja: 45 } },
  { name: 'Płatki kukurydziane',  kcal: 360, protein: 7,  unit: 'porcja', unitGrams: { porcja: 30 } },
  { name: 'Mąka pszenna',         kcal: 360, protein: 10, unit: 'lyzka',  unitGrams: { lyzka: 10 } },
  { name: 'Otręby',               kcal: 320, protein: 16, unit: 'lyzka',  unitGrams: { lyzka: 8 } },

  // ── Nabiał / jaja ────────────────────────────────────────────────────────
  { name: 'Mleko 2%',             kcal: 50,  protein: 3.4, unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Mleko 3,2%',           kcal: 62,  protein: 3.3, unit: 'szklanka', unitGrams: { szklanka: 250 } },
  { name: 'Jogurt naturalny',     kcal: 60,  protein: 5,   unit: 'porcja',   unitGrams: { porcja: 150, lyzka: 20 } },
  { name: 'Jogurt grecki',        kcal: 115, protein: 9,   unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Kefir',                kcal: 50,  protein: 3.3, unit: 'szklanka', unitGrams: { szklanka: 250 } },
  { name: 'Maślanka',             kcal: 40,  protein: 3.3, unit: 'szklanka', unitGrams: { szklanka: 250 } },
  { name: 'Śmietana 18%',         kcal: 185, protein: 2.5, unit: 'lyzka',    unitGrams: { lyzka: 15 } },
  { name: 'Śmietana 30%',         kcal: 290, protein: 2.3, unit: 'lyzka',    unitGrams: { lyzka: 15 } },
  { name: 'Serek wiejski',        kcal: 95,  protein: 11,  unit: 'porcja',   unitGrams: { porcja: 200 } },
  { name: 'Twaróg półtłusty',     kcal: 130, protein: 18,  unit: 'porcja',   unitGrams: { porcja: 100 } },
  { name: 'Twaróg chudy',         kcal: 100, protein: 19,  unit: 'porcja',   unitGrams: { porcja: 100 } },
  { name: 'Ser żółty',            kcal: 350, protein: 25,  unit: 'plaster',  unitGrams: { plaster: 20 } },
  { name: 'Ser Edam',             kcal: 330, protein: 25,  unit: 'plaster',  unitGrams: { plaster: 20 } },
  { name: 'Ser Gouda',            kcal: 356, protein: 25,  unit: 'plaster',  unitGrams: { plaster: 20 } },
  { name: 'Mozzarella',           kcal: 280, protein: 22,  unit: 'plaster',  unitGrams: { plaster: 20 } },
  { name: 'Ser feta',             kcal: 265, protein: 14,  unit: 'porcja',   unitGrams: { porcja: 50 } },
  { name: 'Parmezan',             kcal: 400, protein: 36,  unit: 'lyzka',    unitGrams: { lyzka: 8 } },
  { name: 'Masło',                kcal: 720, protein: 0.7, unit: 'lyzeczka', unitGrams: { lyzeczka: 5, lyzka: 15 } },
  { name: 'Jajko kurze',          kcal: 145, protein: 13,  unit: 'szt',      unitGrams: { szt: 55 } },

  // ── Mięso / wędliny / ryby ───────────────────────────────────────────────
  { name: 'Pierś z kurczaka',     kcal: 165, protein: 31, unit: 'porcja',  unitGrams: { porcja: 150 } },
  { name: 'Udko z kurczaka',      kcal: 210, protein: 18, unit: 'szt',     unitGrams: { szt: 120 } },
  { name: 'Indyk (pierś)',        kcal: 150, protein: 29, unit: 'porcja',  unitGrams: { porcja: 150 } },
  { name: 'Wołowina',             kcal: 250, protein: 26, unit: 'porcja',  unitGrams: { porcja: 150 } },
  { name: 'Schab',                kcal: 240, protein: 21, unit: 'porcja',  unitGrams: { porcja: 150 } },
  { name: 'Karkówka',             kcal: 260, protein: 19, unit: 'porcja',  unitGrams: { porcja: 150 } },
  { name: 'Mięso mielone',        kcal: 240, protein: 18, unit: 'porcja',  unitGrams: { porcja: 150 } },
  { name: 'Boczek',               kcal: 540, protein: 12, unit: 'plaster', unitGrams: { plaster: 15 } },
  { name: 'Kiełbasa',             kcal: 300, protein: 13, unit: 'szt',     unitGrams: { szt: 90 } },
  { name: 'Parówki',              kcal: 270, protein: 11, unit: 'szt',     unitGrams: { szt: 40 } },
  { name: 'Szynka',               kcal: 120, protein: 18, unit: 'plaster', unitGrams: { plaster: 15 } },
  { name: 'Szynka z kurczaka',    kcal: 105, protein: 18, unit: 'plaster', unitGrams: { plaster: 15 } },
  { name: 'Salami',               kcal: 380, protein: 21, unit: 'plaster', unitGrams: { plaster: 8 } },
  { name: 'Kabanos',              kcal: 460, protein: 25, unit: 'szt',     unitGrams: { szt: 35 } },
  { name: 'Pasztet',              kcal: 300, protein: 12, unit: 'lyzka',   unitGrams: { lyzka: 20 } },
  { name: 'Filet z łososia',      kcal: 200, protein: 20, unit: 'porcja',  unitGrams: { porcja: 150 } },
  { name: 'Dorsz',                kcal: 82,  protein: 18, unit: 'porcja',  unitGrams: { porcja: 150 } },
  { name: 'Makrela wędzona',      kcal: 220, protein: 19, unit: 'porcja',  unitGrams: { porcja: 100 } },
  { name: 'Tuńczyk (w sosie własnym)', kcal: 110, protein: 25, unit: 'porcja', unitGrams: { porcja: 80 } },
  { name: 'Śledź',                kcal: 160, protein: 17, unit: 'porcja',  unitGrams: { porcja: 80 } },
  { name: 'Sardynki (puszka)',    kcal: 200, protein: 22, unit: 'porcja',  unitGrams: { porcja: 90 } },
  { name: 'Krewetki',             kcal: 85,  protein: 18, unit: 'porcja',  unitGrams: { porcja: 100 } },

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

  // ── Tłuszcze / sosy ──────────────────────────────────────────────────────
  { name: 'Oliwa z oliwek',       kcal: 880, protein: 0,   unit: 'lyzka',    unitGrams: { lyzka: 10, lyzeczka: 5 } },
  { name: 'Olej rzepakowy',       kcal: 880, protein: 0,   unit: 'lyzka',    unitGrams: { lyzka: 10 } },
  { name: 'Majonez',              kcal: 680, protein: 1,   unit: 'lyzka',    unitGrams: { lyzka: 15 } },
  { name: 'Ketchup',              kcal: 110, protein: 1.2, unit: 'lyzka',    unitGrams: { lyzka: 15 } },
  { name: 'Musztarda',            kcal: 100, protein: 5,   unit: 'lyzeczka', unitGrams: { lyzeczka: 5 } },
  { name: 'Sos czosnkowy',        kcal: 350, protein: 2,   unit: 'lyzka',    unitGrams: { lyzka: 15 } },
  { name: 'Hummus',               kcal: 170, protein: 8,   unit: 'lyzka',    unitGrams: { lyzka: 20 } },

  // ── Strączki / orzechy ───────────────────────────────────────────────────
  { name: 'Ciecierzyca (konserwowa)', kcal: 120, protein: 7, unit: 'porcja', unitGrams: { porcja: 100 } },
  { name: 'Fasola czerwona (konserwowa)', kcal: 90, protein: 7, unit: 'porcja', unitGrams: { porcja: 100 } },
  { name: 'Soczewica (gotowana)', kcal: 115, protein: 9,  unit: 'porcja', unitGrams: { porcja: 100 } },
  { name: 'Tofu',                 kcal: 120, protein: 12, unit: 'porcja', unitGrams: { porcja: 100 } },
  { name: 'Orzechy włoskie',      kcal: 650, protein: 15, unit: 'garsc',  unitGrams: { garsc: 30 } },
  { name: 'Orzechy nerkowca',     kcal: 580, protein: 18, unit: 'garsc',  unitGrams: { garsc: 30 } },
  { name: 'Migdały',              kcal: 580, protein: 21, unit: 'garsc',  unitGrams: { garsc: 30 } },
  { name: 'Orzeszki ziemne',      kcal: 570, protein: 26, unit: 'garsc',  unitGrams: { garsc: 30 } },
  { name: 'Masło orzechowe',      kcal: 600, protein: 25, unit: 'lyzka',  unitGrams: { lyzka: 16 } },

  // ── Słodycze / przekąski ─────────────────────────────────────────────────
  { name: 'Cukier',               kcal: 400, protein: 0,  unit: 'lyzeczka', unitGrams: { lyzeczka: 5, lyzka: 12 } },
  { name: 'Miód',                 kcal: 304, protein: 0.3, unit: 'lyzeczka', unitGrams: { lyzeczka: 7, lyzka: 21 } },
  { name: 'Dżem',                 kcal: 250, protein: 0.4, unit: 'lyzeczka', unitGrams: { lyzeczka: 7, lyzka: 20 } },
  { name: 'Nutella',              kcal: 540, protein: 6,  unit: 'lyzka',    unitGrams: { lyzka: 15 } },
  { name: 'Czekolada mleczna',    kcal: 540, protein: 7,  unit: 'porcja',   unitGrams: { porcja: 25 } },
  { name: 'Czekolada gorzka',     kcal: 560, protein: 8,  unit: 'porcja',   unitGrams: { porcja: 20 } },
  { name: 'Baton czekoladowy',    kcal: 480, protein: 6,  unit: 'szt',      unitGrams: { szt: 50 } },
  { name: 'Ciastka',              kcal: 470, protein: 6,  unit: 'szt',      unitGrams: { szt: 15 } },
  { name: 'Herbatniki',           kcal: 450, protein: 7,  unit: 'szt',      unitGrams: { szt: 8 } },
  { name: 'Lody',                 kcal: 200, protein: 3.5, unit: 'porcja',  unitGrams: { porcja: 100 } },
  { name: 'Chipsy',               kcal: 530, protein: 6,  unit: 'garsc',    unitGrams: { garsc: 30 } },
  { name: 'Paluszki',             kcal: 400, protein: 10, unit: 'garsc',    unitGrams: { garsc: 25 } },
  { name: 'Popcorn',              kcal: 480, protein: 9,  unit: 'garsc',    unitGrams: { garsc: 20 } },
  { name: 'Żelki',                kcal: 340, protein: 6,  unit: 'garsc',    unitGrams: { garsc: 30 } },

  // ── Dania gotowe / fast food ─────────────────────────────────────────────
  { name: 'Pizza',                kcal: 270, protein: 11, unit: 'porcja', unitGrams: { porcja: 125 } },
  { name: 'Zupa (na wywarze)',    kcal: 45,  protein: 2,  unit: 'porcja', unitGrams: { porcja: 300, szklanka: 250 } },
  { name: 'Kanapka',              kcal: 250, protein: 10, unit: 'szt',    unitGrams: { szt: 120 } },
  { name: 'Pierogi ruskie',       kcal: 220, protein: 6,  unit: 'szt',    unitGrams: { szt: 35 } },
  { name: 'Naleśnik',             kcal: 180, protein: 6,  unit: 'szt',    unitGrams: { szt: 90 } },
  { name: 'Zapiekanka',           kcal: 240, protein: 9,  unit: 'szt',    unitGrams: { szt: 200 } },
  { name: 'Hamburger',            kcal: 250, protein: 12, unit: 'szt',    unitGrams: { szt: 220 } },

  // ── Napoje ───────────────────────────────────────────────────────────────
  { name: 'Sok owocowy',          kcal: 45,  protein: 0.5, unit: 'szklanka', unitGrams: { szklanka: 250 } },
  { name: 'Cola',                 kcal: 42,  protein: 0,   unit: 'szklanka', unitGrams: { szklanka: 250 } },
  { name: 'Piwo',                 kcal: 43,  protein: 0.5, unit: 'szklanka', unitGrams: { szklanka: 500 } },
  { name: 'Wino',                 kcal: 85,  protein: 0.1, unit: 'szklanka', unitGrams: { szklanka: 150 } },
  { name: 'Energetyk',            kcal: 45,  protein: 0,   unit: 'szklanka', unitGrams: { szklanka: 250 } },
  { name: 'Kawa czarna',          kcal: 2,   protein: 0.1, unit: 'szklanka', unitGrams: { szklanka: 250 } },
  { name: 'Kawa z mlekiem',       kcal: 40,  protein: 2,   unit: 'szklanka', unitGrams: { szklanka: 250 } },

  // ── Gotowe / białkowe ────────────────────────────────────────────────────
  { name: 'Huel (shake)',         kcal: 400, protein: 29, unit: 'porcja', unitGrams: { porcja: 100 } },
  { name: 'Odżywka białkowa',     kcal: 380, protein: 75, unit: 'lyzka',  unitGrams: { lyzka: 30 } },
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
