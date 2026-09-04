import { FoodUnit } from '@/store/foodStore';
import { normalizeProductName } from '@/utils/productMemory';

// Built-in OFFLINE base — a broad starter set of common Polish groceries (kcal per
// 100 g + household portion grams), weighted toward what actually shows up on Lidl /
// Kaufland receipts: pieczywo, nabiał, wędliny, ryby, sosy, makarony/kasze, słodycze,
// przekąski, napoje, plus owoce & warzywa. The user still adds/edits his own products
// via "Dodaj produkt" (kcal + macros + link to a purchase); his curated products always
// WIN over this base — a base item is hidden once a curated one shares its name.
// kcal values are typical per-100 g figures (packaged goods vary ±10-15%).

export interface BaseFood {
  name: string;
  kcal: number;                                   // per 100 g
  protein?: number;                               // g / 100 g
  sugar?: number;                                 // w tym cukry g / 100 g (dla licznika cukru)
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

  // ── Pieczywo ───────────────────────────────────────────────────────────────
  { name: 'Bułka pszenna (kajzerka)', kcal: 290, protein: 9,   unit: 'szt',    unitGrams: { szt: 50 } },
  { name: 'Bułka grahamka',       kcal: 250, protein: 9,   unit: 'szt',    unitGrams: { szt: 55 } },
  { name: 'Bułka pełnoziarnista', kcal: 249, protein: 10,  unit: 'szt',    unitGrams: { szt: 65 } },
  { name: 'Bułka z ziarnami',     kcal: 265, protein: 9,   unit: 'szt',    unitGrams: { szt: 70 } },
  { name: 'Bułka z dynią',        kcal: 293, protein: 11.8, unit: 'szt',   unitGrams: { szt: 86 } },
  { name: 'Bułka fitness',        kcal: 250, protein: 10,  unit: 'szt',    unitGrams: { szt: 50 } },
  { name: 'Bułka górska',         kcal: 270, protein: 9,   unit: 'szt',    unitGrams: { szt: 55 } },
  { name: 'Chleb pszenny tostowy', kcal: 265, protein: 8,  unit: 'kromka', unitGrams: { kromka: 25 } },
  { name: 'Chleb żytni razowy',   kcal: 220, protein: 6.5, unit: 'kromka', unitGrams: { kromka: 35 } },
  { name: 'Chleb mieszany',       kcal: 250, protein: 7,   unit: 'kromka', unitGrams: { kromka: 35 } },
  { name: 'Chleb orkiszowy',      kcal: 240, protein: 8,   unit: 'kromka', unitGrams: { kromka: 35 } },
  { name: 'Bagietka',             kcal: 270, protein: 9,   unit: 'porcja', unitGrams: { porcja: 60 } },
  { name: 'Chałka',               kcal: 320, protein: 8,   unit: 'kromka', unitGrams: { kromka: 40 } },
  { name: 'Tortilla pszenna',     kcal: 300, protein: 8,   unit: 'szt',    unitGrams: { szt: 60 } },
  { name: 'Sucharki',             kcal: 380, protein: 9,   unit: 'szt',    unitGrams: { szt: 8 } },
  { name: 'Bułka tarta',          kcal: 350, protein: 11,  unit: 'lyzka',  unitGrams: { lyzka: 10 } },

  // ── Nabiał ─────────────────────────────────────────────────────────────────
  { name: 'Mleko 3,2%',           kcal: 63,  protein: 3.2, unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Mleko UHT 1,5%',       kcal: 46,  protein: 3.4, unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Serek wiejski',        kcal: 95,  protein: 12,  unit: 'szt',      unitGrams: { szt: 200, lyzka: 30 } },
  { name: 'Serek szczypiorek',    kcal: 230, protein: 8,   unit: 'lyzka',    unitGrams: { lyzka: 20, szt: 100 } },
  { name: 'Jogurt naturalny 2%',  kcal: 60,  protein: 4.3, unit: 'szt',      unitGrams: { szt: 150, lyzka: 25 } },
  { name: 'Jogurt grecki 10%',    kcal: 115, protein: 5,   unit: 'szt',      unitGrams: { szt: 150, lyzka: 25 } },
  { name: 'Kefir',                kcal: 50,  protein: 3.3, unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Śmietana 18%',         kcal: 185, protein: 2.5, unit: 'lyzka',    unitGrams: { lyzka: 20 } },
  { name: 'Ser żółty (gouda/edam)', kcal: 330, protein: 25, unit: 'plaster', unitGrams: { plaster: 20 } },
  { name: 'Ser mozzarella',       kcal: 250, protein: 18,  unit: 'plaster',  unitGrams: { plaster: 25 } },
  { name: 'Ser feta',             kcal: 265, protein: 14,  unit: 'porcja',   unitGrams: { porcja: 30 } },
  { name: 'Twaróg półtłusty',     kcal: 130, protein: 18,  unit: 'porcja',   unitGrams: { porcja: 100 } },
  { name: 'Serek topiony',        kcal: 280, protein: 10,  unit: 'plaster',  unitGrams: { plaster: 25 } },
  { name: 'Mascarpone',           kcal: 430, protein: 4,   unit: 'lyzka',    unitGrams: { lyzka: 20 } },
  { name: 'Ricotta',              kcal: 150, protein: 8,   unit: 'lyzka',    unitGrams: { lyzka: 25 } },

  // ── Wędliny i mięso ────────────────────────────────────────────────────────
  { name: 'Polędwica z kurczaka (wędlina)', kcal: 100, protein: 20, unit: 'plaster', unitGrams: { plaster: 15 } },
  { name: 'Polędwica sopocka',    kcal: 113, protein: 18,  unit: 'plaster',  unitGrams: { plaster: 12 } },
  { name: 'Szynka z indyka',      kcal: 105, protein: 18,  unit: 'plaster',  unitGrams: { plaster: 15 } },
  { name: 'Szynka gotowana',      kcal: 120, protein: 18,  unit: 'plaster',  unitGrams: { plaster: 20 } },
  { name: 'Schab wędzony',        kcal: 150, protein: 22,  unit: 'plaster',  unitGrams: { plaster: 20 } },
  { name: 'Kiełbasa krakowska',   kcal: 260, protein: 20,  unit: 'plaster',  unitGrams: { plaster: 15 } },
  { name: 'Kabanosy',             kcal: 300, protein: 22,  unit: 'szt',      unitGrams: { szt: 30 } },
  { name: 'Parówki',              kcal: 260, protein: 11,  unit: 'szt',      unitGrams: { szt: 30 } },
  { name: 'Boczek wędzony',       kcal: 300, protein: 15,  unit: 'plaster',  unitGrams: { plaster: 15 } },
  { name: 'Pasztet',              kcal: 280, protein: 10,  unit: 'lyzka',    unitGrams: { lyzka: 20, plaster: 20 } },
  { name: 'Salami',               kcal: 380, protein: 22,  unit: 'plaster',  unitGrams: { plaster: 8 } },
  { name: 'Pierś z kurczaka (grillowana)', kcal: 165, protein: 31, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Mięso mielone (smażone)', kcal: 250, protein: 20, unit: 'porcja', unitGrams: { porcja: 120 } },

  // ── Ryby ───────────────────────────────────────────────────────────────────
  { name: 'Makrela wędzona',      kcal: 220, protein: 20,  unit: 'porcja',   unitGrams: { porcja: 100 } },
  { name: 'Łosoś wędzony',        kcal: 180, protein: 22,  unit: 'plaster',  unitGrams: { plaster: 20 } },
  { name: 'Tuńczyk w sosie własnym', kcal: 110, protein: 25, unit: 'porcja', unitGrams: { porcja: 80 } },
  { name: 'Śledź w oleju',        kcal: 210, protein: 16,  unit: 'porcja',   unitGrams: { porcja: 80 } },

  // ── Sosy i tłuszcze ────────────────────────────────────────────────────────
  { name: 'Ketchup',              kcal: 100, protein: 1.4, unit: 'lyzka',    unitGrams: { lyzka: 15 } },
  { name: 'Majonez',              kcal: 680, protein: 1,   unit: 'lyzka',    unitGrams: { lyzka: 15 } },
  { name: 'Musztarda',            kcal: 100, protein: 5,   unit: 'lyzeczka', unitGrams: { lyzeczka: 5, lyzka: 15 } },
  { name: 'Oliwa z oliwek',       kcal: 884, protein: 0,   unit: 'lyzka',    unitGrams: { lyzka: 13, lyzeczka: 5 } },
  { name: 'Masło orzechowe',      kcal: 600, protein: 25,  unit: 'lyzka',    unitGrams: { lyzka: 16 } },

  // ── Makarony, kasze, ryż ───────────────────────────────────────────────────
  { name: 'Makaron (suchy)',      kcal: 360, protein: 12,  unit: 'porcja',   unitGrams: { porcja: 80 } },
  { name: 'Makaron (ugotowany)',  kcal: 140, protein: 5,   unit: 'porcja',   unitGrams: { porcja: 180 } },
  { name: 'Ryż biały (suchy)',    kcal: 350, protein: 7,   unit: 'porcja',   unitGrams: { porcja: 70 } },
  { name: 'Ryż (ugotowany)',      kcal: 130, protein: 2.7, unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Kasza gryczana (sucha)', kcal: 340, protein: 12, unit: 'porcja',  unitGrams: { porcja: 70 } },
  { name: 'Kasza jaglana (sucha)', kcal: 350, protein: 11, unit: 'porcja',   unitGrams: { porcja: 70 } },
  { name: 'Płatki owsiane',       kcal: 370, protein: 13,  unit: 'porcja',   unitGrams: { porcja: 50, lyzka: 10 } },

  // ── Słodycze ───────────────────────────────────────────────────────────────
  { name: 'Czekolada mleczna',    kcal: 535, protein: 7.5, sugar: 52, unit: 'porcja',   unitGrams: { porcja: 25 } },
  { name: 'Czekolada gorzka',     kcal: 550, protein: 8,   sugar: 30, unit: 'porcja',   unitGrams: { porcja: 25 } },
  { name: 'Nutella',              kcal: 539, protein: 6,   sugar: 57, unit: 'lyzka',    unitGrams: { lyzka: 20 } },
  { name: 'Baton czekoladowy',    kcal: 490, protein: 6,   sugar: 50, unit: 'szt',      unitGrams: { szt: 45 } },
  { name: 'Toffifee',             kcal: 530, protein: 5,   sugar: 48, unit: 'szt',      unitGrams: { szt: 10 } },
  { name: 'Oreo (ciastka)',       kcal: 480, protein: 5,   sugar: 38, unit: 'szt',      unitGrams: { szt: 11 } },
  { name: 'Jeżyki (ciastka)',     kcal: 490, protein: 5,   sugar: 35, unit: 'szt',      unitGrams: { szt: 12 } },
  { name: 'Chałwa',               kcal: 500, protein: 12,  sugar: 45, unit: 'porcja',   unitGrams: { porcja: 30 } },
  { name: 'Lody familijne',       kcal: 200, protein: 3.5, sugar: 22, unit: 'porcja',   unitGrams: { porcja: 100 } },
  { name: 'Ciastka kruche',       kcal: 470, protein: 6,   sugar: 25, unit: 'szt',      unitGrams: { szt: 12 } },
  { name: 'Piernik',              kcal: 380, protein: 5,   sugar: 40, unit: 'szt',      unitGrams: { szt: 30 } },
  { name: 'Żelki',                kcal: 340, protein: 6,   sugar: 55, unit: 'garsc',    unitGrams: { garsc: 30 } },
  { name: 'Wafelek',              kcal: 500, protein: 6,   sugar: 40, unit: 'szt',      unitGrams: { szt: 40 } },
  { name: 'Miód',                 kcal: 320, protein: 0.3, sugar: 80, unit: 'lyzka',    unitGrams: { lyzka: 20, lyzeczka: 7 } },
  { name: 'Dżem',                 kcal: 250, protein: 0.4, sugar: 55, unit: 'lyzka',    unitGrams: { lyzka: 20 } },
  { name: 'Kinder Bueno',         kcal: 570, protein: 8,   sugar: 44, unit: 'szt',      unitGrams: { szt: 21 } },
  { name: 'Snickers',             kcal: 480, protein: 8,   sugar: 43, unit: 'szt',      unitGrams: { szt: 50 } },
  { name: 'Ptasie mleczko',       kcal: 390, protein: 3,   sugar: 60, unit: 'szt',      unitGrams: { szt: 15 } },
  { name: 'Michałki',             kcal: 520, protein: 7,   sugar: 45, unit: 'szt',      unitGrams: { szt: 12 } },
  { name: 'Krówki',               kcal: 400, protein: 2,   sugar: 70, unit: 'szt',      unitGrams: { szt: 7 } },
  { name: 'Prince Polo',          kcal: 540, protein: 6,   sugar: 42, unit: 'szt',      unitGrams: { szt: 18 } },
  { name: 'Grześki',              kcal: 505, protein: 6,   sugar: 38, unit: 'szt',      unitGrams: { szt: 36 } },
  { name: 'Delicje (biszkopt)',   kcal: 380, protein: 4,   sugar: 45, unit: 'szt',      unitGrams: { szt: 13 } },
  { name: 'Sernik',               kcal: 320, protein: 7,   sugar: 22, unit: 'porcja',   unitGrams: { porcja: 120 } },
  { name: 'Brownie',              kcal: 420, protein: 5,   sugar: 35, unit: 'porcja',   unitGrams: { porcja: 60 } },
  { name: 'Pączek',               kcal: 360, protein: 6,   sugar: 20, unit: 'szt',      unitGrams: { szt: 70 } },
  { name: 'Drożdżówka',           kcal: 330, protein: 6,   sugar: 18, unit: 'szt',      unitGrams: { szt: 80 } },
  { name: 'Lody na patyku',       kcal: 270, protein: 3,   sugar: 24, unit: 'szt',      unitGrams: { szt: 70 } },
  { name: 'Galaretka owocowa',    kcal: 70,  protein: 1.2, sugar: 15, unit: 'porcja',   unitGrams: { porcja: 120 } },
  { name: 'Budyń',                kcal: 100, protein: 3,   sugar: 13, unit: 'porcja',   unitGrams: { porcja: 140 } },
  { name: 'Kisiel',               kcal: 55,  protein: 0.2, sugar: 12, unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Gofry',                kcal: 290, protein: 6,   sugar: 12, unit: 'szt',      unitGrams: { szt: 80 } },
  { name: 'Cukier',               kcal: 400, protein: 0,   sugar: 100,unit: 'lyzeczka', unitGrams: { lyzeczka: 5, lyzka: 12 } },
  // Dobitka słodyczy (2026-09-03, user: "torcikow kupnych z galaretką na oko możesz mi
  // dać, i wgle więcej ich zrobić") — wartości "na oko" jak reszta tej sekcji (packaged
  // goods, ±10-15%), tym samym stylem/formatem co powyżej.
  { name: 'Tortik z galaretką',   kcal: 410, protein: 4.5, sugar: 38, unit: 'szt',      unitGrams: { szt: 40 } },
  { name: 'Kasztanka',            kcal: 480, protein: 5,   sugar: 45, unit: 'szt',      unitGrams: { szt: 15 } },
  { name: 'Beza',                 kcal: 390, protein: 3,   sugar: 85, unit: 'szt',      unitGrams: { szt: 15 } },
  { name: 'Eklerka',              kcal: 330, protein: 5,   sugar: 20, unit: 'szt',      unitGrams: { szt: 70 } },
  { name: 'Kremówka',             kcal: 310, protein: 4,   sugar: 18, unit: 'szt',      unitGrams: { szt: 100 } },
  { name: 'Faworki',              kcal: 460, protein: 6,   sugar: 20, unit: 'garsc',    unitGrams: { garsc: 40, szt: 15 } },
  { name: 'Rurka z kremem',       kcal: 400, protein: 5,   sugar: 25, unit: 'szt',      unitGrams: { szt: 50 } },
  { name: 'Herbatniki',           kcal: 440, protein: 7,   sugar: 22, unit: 'szt',      unitGrams: { szt: 8 } },
  { name: 'Wafle ryżowe',         kcal: 385, protein: 8,   sugar: 1,  unit: 'szt',      unitGrams: { szt: 9 } },
  { name: 'Ciastka owsiane',      kcal: 440, protein: 7,   sugar: 22, unit: 'szt',      unitGrams: { szt: 15 } },
  { name: 'Ciastka czekoladowe',  kcal: 490, protein: 5,   sugar: 33, unit: 'szt',      unitGrams: { szt: 12 } },
  { name: 'Muffinka',             kcal: 380, protein: 5,   sugar: 28, unit: 'szt',      unitGrams: { szt: 70 } },
  { name: 'Andruty',              kcal: 400, protein: 5,   sugar: 30, unit: 'szt',      unitGrams: { szt: 25 } },

  // ── Fast food / na mieście ───────────────────────────────────────────────────
  { name: 'Kebab (bułka)',        kcal: 215, protein: 12,  unit: 'szt',      unitGrams: { szt: 350 } },
  { name: 'Pizza (kawałek)',      kcal: 270, protein: 11,  unit: 'szt',      unitGrams: { szt: 125 } },
  { name: 'Hamburger',            kcal: 250, protein: 13,  unit: 'szt',      unitGrams: { szt: 150 } },
  { name: 'Hot dog',              kcal: 290, protein: 10,  unit: 'szt',      unitGrams: { szt: 100 } },
  { name: 'Zapiekanka',           kcal: 240, protein: 9,   unit: 'szt',      unitGrams: { szt: 200 } },
  { name: 'Frytki (duże)',        kcal: 312, protein: 3.4, unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Sushi (rolka)',        kcal: 145, protein: 5,   unit: 'szt',      unitGrams: { szt: 30 } },

  // ── Przekąski ──────────────────────────────────────────────────────────────
  { name: 'Chipsy',               kcal: 535, protein: 6,   unit: 'garsc',    unitGrams: { garsc: 25 } },
  { name: 'Chrupki kukurydziane', kcal: 520, protein: 6,   unit: 'garsc',    unitGrams: { garsc: 20 } },
  { name: 'Paluszki',             kcal: 390, protein: 11,  unit: 'garsc',    unitGrams: { garsc: 20 } },
  { name: 'Orzeszki ziemne solone', kcal: 600, protein: 25, unit: 'garsc',   unitGrams: { garsc: 30 } },
  { name: 'Orzechy nerkowca',     kcal: 580, protein: 18,  unit: 'garsc',    unitGrams: { garsc: 30 } },
  { name: 'Orzechy włoskie',      kcal: 650, protein: 15,  unit: 'garsc',    unitGrams: { garsc: 30 } },
  { name: 'Migdały',              kcal: 580, protein: 21,  unit: 'garsc',    unitGrams: { garsc: 30 } },
  { name: 'Mieszanka studencka',  kcal: 480, protein: 12,  unit: 'garsc',    unitGrams: { garsc: 30 } },
  { name: 'Krakersy',             kcal: 450, protein: 9,   unit: 'garsc',    unitGrams: { garsc: 25 } },

  // ── Napoje ─────────────────────────────────────────────────────────────────
  { name: 'Cola',                 kcal: 42,  protein: 0,   sugar: 10.6, unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Napój izotoniczny (Oshee)', kcal: 25, protein: 0, sugar: 5,  unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Sok pomarańczowy',     kcal: 45,  protein: 0.7, sugar: 9,    unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Sok jabłkowy',         kcal: 46,  protein: 0.1, sugar: 10,   unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Napój energetyczny',   kcal: 45,  protein: 0,   sugar: 11,   unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Kawa (czarna)',        kcal: 2,   protein: 0.1, unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Piwo',                 kcal: 43,  protein: 0.5, unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },

  // ── Dania gotowe / obiady ──────────────────────────────────────────────────
  { name: 'Zupa pomidorowa',      kcal: 60,  protein: 2,   unit: 'porcja',   unitGrams: { porcja: 300 } },
  { name: 'Rosół',                kcal: 35,  protein: 2,   unit: 'porcja',   unitGrams: { porcja: 300 } },
  { name: 'Pierogi ruskie',       kcal: 200, protein: 6,   unit: 'szt',      unitGrams: { szt: 30 } },
  { name: 'Naleśnik',             kcal: 150, protein: 5,   unit: 'szt',      unitGrams: { szt: 60 } },
  { name: 'Pizza (kawałek)',      kcal: 260, protein: 11,  unit: 'porcja',   unitGrams: { porcja: 120 } },
  { name: 'Kluski śląskie',       kcal: 160, protein: 3,   unit: 'szt',      unitGrams: { szt: 30 } },
  { name: 'Kanapka z serem/wędliną', kcal: 250, protein: 11, unit: 'szt',    unitGrams: { szt: 100 } },

  // ── Więcej codziennych / Lidl ────────────────────────────────────────────────
  { name: 'Pierś z kurczaka (surowa)', kcal: 165, protein: 31, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Filet z kurczaka grillowany', kcal: 165, protein: 31, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Udko z kurczaka',      kcal: 210, protein: 26,  unit: 'szt',      unitGrams: { szt: 130 } },
  { name: 'Parówki',              kcal: 270, protein: 11,  unit: 'szt',      unitGrams: { szt: 50 } },
  { name: 'Mielonka konserwowa',  kcal: 230, protein: 12,  unit: 'plaster',  unitGrams: { plaster: 25 } },
  { name: 'Boczek wędzony',       kcal: 500, protein: 13,  unit: 'plaster',  unitGrams: { plaster: 20 } },
  { name: 'Jajko gotowane',       kcal: 155, protein: 13,  unit: 'szt',      unitGrams: { szt: 55 } },
  { name: 'Jajecznica (2 jajka)', kcal: 200, protein: 13,  unit: 'porcja',   unitGrams: { porcja: 120 } },
  { name: 'Tuńczyk w puszce',     kcal: 110, protein: 25,  unit: 'porcja',   unitGrams: { porcja: 80 } },
  { name: 'Serek wiejski',        kcal: 98,  protein: 12,  unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Serek homogenizowany', kcal: 140, protein: 7,   sugar: 12, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Jogurt naturalny',     kcal: 60,  protein: 5,   sugar: 5,  unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Jogurt grecki',        kcal: 110, protein: 9,   sugar: 4,  unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Jogurt owocowy',       kcal: 95,  protein: 4,   sugar: 13, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Skyr',                 kcal: 63,  protein: 11,  sugar: 4,  unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Kefir',                kcal: 50,  protein: 3.3, sugar: 4,  unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Maślanka',             kcal: 40,  protein: 3.4, sugar: 4,  unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Ser żółty Gouda',      kcal: 356, protein: 25,  unit: 'plaster',  unitGrams: { plaster: 20 } },
  { name: 'Mleko 2%',             kcal: 51,  protein: 3.4, sugar: 5,  unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Napój owsiany',        kcal: 45,  protein: 1,   sugar: 3,  unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Masło',                kcal: 735, protein: 0.7, unit: 'lyzeczka', unitGrams: { lyzeczka: 5, lyzka: 14 } },
  { name: 'Oliwa z oliwek',       kcal: 884, protein: 0,   unit: 'lyzka',    unitGrams: { lyzka: 10, lyzeczka: 5 } },
  { name: 'Olej rzepakowy',       kcal: 884, protein: 0,   unit: 'lyzka',    unitGrams: { lyzka: 10 } },
  { name: 'Majonez',              kcal: 680, protein: 1,   unit: 'lyzka',    unitGrams: { lyzka: 15 } },
  { name: 'Ketchup',              kcal: 110, protein: 1.2, sugar: 22, unit: 'lyzka',    unitGrams: { lyzka: 15 } },
  { name: 'Musztarda',            kcal: 100, protein: 5,   unit: 'lyzeczka', unitGrams: { lyzeczka: 6 } },
  { name: 'Śmietana 18%',         kcal: 180, protein: 2.5, sugar: 3,  unit: 'lyzka',    unitGrams: { lyzka: 15 } },
  { name: 'Hummus',               kcal: 230, protein: 8,   unit: 'lyzka',    unitGrams: { lyzka: 25 } },
  { name: 'Ryż biały (gotowany)', kcal: 130, protein: 2.7, unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Kasza gryczana (gotowana)', kcal: 110, protein: 4, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Makaron (gotowany)',   kcal: 158, protein: 5.8, unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Płatki owsiane',       kcal: 370, protein: 13,  sugar: 1,  unit: 'porcja',   unitGrams: { porcja: 50, lyzka: 10 } },
  { name: 'Musli / granola',      kcal: 440, protein: 9,   sugar: 20, unit: 'porcja',   unitGrams: { porcja: 50 } },
  { name: 'Płatki kukurydziane',  kcal: 380, protein: 7,   sugar: 8,  unit: 'porcja',   unitGrams: { porcja: 40 } },
  { name: 'Chleb tostowy',        kcal: 265, protein: 8,   sugar: 4,  unit: 'kromka',   unitGrams: { kromka: 25 } },
  { name: 'Bułka kajzerka',       kcal: 280, protein: 9,   unit: 'szt',      unitGrams: { szt: 50 } },
  { name: 'Tortilla (placek)',    kcal: 300, protein: 8,   unit: 'szt',      unitGrams: { szt: 60 } },
  { name: 'Awokado',              kcal: 160, protein: 2,   unit: 'szt',      unitGrams: { szt: 150 } },
  { name: 'Winogrona',            kcal: 69,  protein: 0.7, sugar: 16, unit: 'garsc',    unitGrams: { garsc: 80 } },
  { name: 'Truskawki',            kcal: 33,  protein: 0.7, sugar: 5,  unit: 'garsc',    unitGrams: { garsc: 100 } },
  { name: 'Borówki',              kcal: 57,  protein: 0.7, sugar: 10, unit: 'garsc',    unitGrams: { garsc: 80 } },
  { name: 'Nuggetsy z kurczaka',  kcal: 250, protein: 14,  unit: 'szt',      unitGrams: { szt: 18 } },
  { name: 'Spaghetti bolognese',  kcal: 150, protein: 7,   unit: 'porcja',   unitGrams: { porcja: 300 } },
  { name: 'Sałatka grecka',       kcal: 110, protein: 4,   unit: 'porcja',   unitGrams: { porcja: 200 } },

  // ── Duża dobitka (2026-09-04, user: "dodaj więcej o wiele produktow z kaloriami
  // realnym") — wypełnia największe dziury: mięso SUROWE do gotowania (nie tylko
  // wędliny), więcej ryb, rośliny strączkowe/białko roślinne, owoce suszone, orzechy/
  // nasiona, napoje, śniadaniowe kasze, i sporo dań obiadowych/fast foodowych, których
  // wcześniej brakowało mimo że to bardzo częste pozycje na polskim talerzu.

  // ── Mięso surowe / do gotowania (nie wędliny) ─────────────────────────────
  { name: 'Schab surowy',         kcal: 157, protein: 21,  unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Wołowina mielona (surowa)', kcal: 250, protein: 17, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Filet z indyka (surowy)', kcal: 107, protein: 24, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Kurczak cały (pieczony)', kcal: 215, protein: 27, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Żeberka wieprzowe (pieczone)', kcal: 290, protein: 19, unit: 'porcja', unitGrams: { porcja: 200 } },
  { name: 'Karkówka (grillowana)', kcal: 270, protein: 20,  unit: 'porcja',  unitGrams: { porcja: 150 } },
  { name: 'Boczek surowy',        kcal: 520, protein: 9,   unit: 'plaster',  unitGrams: { plaster: 15 } },
  { name: 'Golonka',              kcal: 230, protein: 19,  unit: 'porcja',   unitGrams: { porcja: 250 } },
  { name: 'Skrzydełka z kurczaka (pieczone)', kcal: 230, protein: 22, unit: 'szt', unitGrams: { szt: 60 } },
  { name: 'Kaszanka',             kcal: 280, protein: 10,  unit: 'plaster',  unitGrams: { plaster: 30 } },

  // ── Ryby (dobitka) ─────────────────────────────────────────────────────────
  { name: 'Dorsz (pieczony)',     kcal: 105, protein: 23,  unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Pstrąg (pieczony)',    kcal: 150, protein: 21,  unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Łosoś (pieczony)',     kcal: 208, protein: 20,  unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Krewetki',             kcal: 99,  protein: 21,  unit: 'porcja',   unitGrams: { porcja: 100 } },
  { name: 'Paluszki rybne',       kcal: 220, protein: 12,  unit: 'szt',      unitGrams: { szt: 25 } },
  { name: 'Filet z mintaja',      kcal: 90,  protein: 19,  unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Sardynki w oleju',     kcal: 210, protein: 21,  unit: 'porcja',   unitGrams: { porcja: 80 } },

  // ── Rośliny strączkowe / białko roślinne ──────────────────────────────────
  { name: 'Soczewica (gotowana)', kcal: 116, protein: 9,   unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Ciecierzyca (gotowana)', kcal: 164, protein: 9, unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Fasola czerwona (gotowana)', kcal: 127, protein: 9, unit: 'porcja', unitGrams: { porcja: 150 } },
  { name: 'Tofu',                 kcal: 76,  protein: 8,   unit: 'porcja',   unitGrams: { porcja: 100 } },
  { name: 'Tempeh',               kcal: 195, protein: 19,  unit: 'porcja',   unitGrams: { porcja: 100 } },
  { name: 'Edamame',              kcal: 122, protein: 11,  unit: 'porcja',   unitGrams: { porcja: 100 } },

  // ── Owoce suszone ──────────────────────────────────────────────────────────
  { name: 'Rodzynki',             kcal: 300, protein: 3,   sugar: 59, unit: 'garsc', unitGrams: { garsc: 30 } },
  { name: 'Morele suszone',       kcal: 240, protein: 3.4, sugar: 53, unit: 'garsc', unitGrams: { garsc: 30 } },
  { name: 'Daktyle',              kcal: 280, protein: 2.5, sugar: 63, unit: 'garsc', unitGrams: { garsc: 30 } },
  { name: 'Śliwki suszone',       kcal: 240, protein: 2.2, sugar: 38, unit: 'garsc', unitGrams: { garsc: 30 } },
  { name: 'Figi suszone',         kcal: 250, protein: 3.3, sugar: 48, unit: 'garsc', unitGrams: { garsc: 30 } },

  // ── Orzechy / nasiona (dobitka) ────────────────────────────────────────────
  { name: 'Pistacje',             kcal: 560, protein: 20,  unit: 'garsc',    unitGrams: { garsc: 30 } },
  { name: 'Orzechy laskowe',      kcal: 630, protein: 15,  unit: 'garsc',    unitGrams: { garsc: 30 } },
  { name: 'Orzechy brazylijskie', kcal: 660, protein: 14,  unit: 'garsc',    unitGrams: { garsc: 30 } },
  { name: 'Nasiona słonecznika',  kcal: 580, protein: 21,  unit: 'lyzka',    unitGrams: { lyzka: 12 } },
  { name: 'Pestki dyni',          kcal: 560, protein: 30,  unit: 'lyzka',    unitGrams: { lyzka: 10 } },
  { name: 'Siemię lniane',        kcal: 530, protein: 18,  unit: 'lyzka',    unitGrams: { lyzka: 10 } },
  { name: 'Chia (nasiona)',       kcal: 490, protein: 17,  unit: 'lyzka',    unitGrams: { lyzka: 12 } },

  // ── Napoje (dobitka) ───────────────────────────────────────────────────────
  { name: 'Herbata (bez cukru)',  kcal: 1,   protein: 0,   unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Woda gazowana',        kcal: 0,   protein: 0,   unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Kompot',               kcal: 40,  protein: 0,   sugar: 9,  unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Wino czerwone',        kcal: 85,  protein: 0.1, unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Kawa z mlekiem',       kcal: 20,  protein: 1,   unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },
  { name: 'Cappuccino',           kcal: 40,  protein: 2,   unit: 'szklanka', unitGrams: { szklanka: 200, ml: 1 } },
  { name: 'Sprite / Fanta',       kcal: 42,  protein: 0,   sugar: 10, unit: 'szklanka', unitGrams: { szklanka: 250, ml: 1 } },

  // ── Śniadaniowe (dobitka) ──────────────────────────────────────────────────
  { name: 'Płatki czekoladowe',   kcal: 390, protein: 6,   sugar: 30, unit: 'porcja', unitGrams: { porcja: 40 } },
  { name: 'Otręby pszenne',       kcal: 210, protein: 16,  unit: 'lyzka',    unitGrams: { lyzka: 10 } },
  { name: 'Kasza manna (sucha)',  kcal: 360, protein: 10,  unit: 'porcja',   unitGrams: { porcja: 50 } },
  { name: 'Kasza kuskus (sucha)', kcal: 375, protein: 13,  unit: 'porcja',   unitGrams: { porcja: 70 } },
  { name: 'Komosa ryżowa (quinoa, gotowana)', kcal: 120, protein: 4.4, unit: 'porcja', unitGrams: { porcja: 150 } },

  // ── Dania gotowe / obiady (dobitka) ────────────────────────────────────────
  { name: 'Gulasz wołowy',        kcal: 150, protein: 12,  unit: 'porcja',   unitGrams: { porcja: 300 } },
  { name: 'Bigos',                kcal: 110, protein: 6,   unit: 'porcja',   unitGrams: { porcja: 300 } },
  { name: 'Żurek',                kcal: 70,  protein: 3,   unit: 'porcja',   unitGrams: { porcja: 300 } },
  { name: 'Barszcz czerwony',     kcal: 35,  protein: 1,   unit: 'porcja',   unitGrams: { porcja: 300 } },
  { name: 'Kotlet schabowy',      kcal: 260, protein: 20,  unit: 'szt',      unitGrams: { szt: 150 } },
  { name: 'Kotlet mielony',       kcal: 230, protein: 15,  unit: 'szt',      unitGrams: { szt: 100 } },
  { name: 'Gołąbki',              kcal: 130, protein: 6,   unit: 'szt',      unitGrams: { szt: 150 } },
  { name: 'Placki ziemniaczane',  kcal: 210, protein: 4,   unit: 'szt',      unitGrams: { szt: 60 } },
  { name: 'Risotto',              kcal: 160, protein: 4,   unit: 'porcja',   unitGrams: { porcja: 300 } },
  { name: 'Curry z kurczakiem',   kcal: 140, protein: 10,  unit: 'porcja',   unitGrams: { porcja: 300 } },
  { name: 'Chili con carne',      kcal: 130, protein: 9,   unit: 'porcja',   unitGrams: { porcja: 300 } },
  { name: 'Sałatka jarzynowa',    kcal: 150, protein: 3,   unit: 'porcja',   unitGrams: { porcja: 150 } },
  { name: 'Sałatka cesar',        kcal: 180, protein: 9,   unit: 'porcja',   unitGrams: { porcja: 250 } },

  // ── Fast food (dobitka) ────────────────────────────────────────────────────
  { name: 'Cheeseburger',         kcal: 280, protein: 15,  unit: 'szt',      unitGrams: { szt: 115 } },
  { name: 'Nachos z serem',       kcal: 320, protein: 6,   unit: 'porcja',   unitGrams: { porcja: 100 } },
  { name: 'Kurczak w cieście (KFC-style)', kcal: 280, protein: 17, unit: 'szt', unitGrams: { szt: 100 } },
  { name: 'Falafel',              kcal: 330, protein: 13,  unit: 'szt',      unitGrams: { szt: 17 } },
  { name: 'Gyros (danie)',        kcal: 200, protein: 12,  unit: 'porcja',   unitGrams: { porcja: 300 } },
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
