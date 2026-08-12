import { kcalPer100g, estimateItemKcal, looksLikeFood, expenseFoodKcal, foodKcalForDate, foodKcalByName, avgFoodKcal } from '@/utils/calories';
import { Expense } from '@/types';

// pozycje bez NAZWY (żeby wynik zależał od TAGU — deterministyczny; nazwy idą przez FOOD_KCAL).
const item = (o: any) => ({ name: '', price: 0, quantity: 1, tags: [], ...o });
const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'groceries', date: '2026-08-04T10:00:00',
  createdAt: '', updatedAt: '', ...o,
} as Expense);

describe('calories — kcalPer100g (po tagu)', () => {
  test('rozpoznaje tag (case-insensitive), 0 dla nie-jedzenia', () => {
    expect(kcalPer100g({ tags: ['słodycze'] })).toBe(450);
    expect(kcalPer100g({ tags: ['Warzywa'] })).toBe(35);
    expect(kcalPer100g({ tags: ['chemia'] })).toBe(0);
    expect(kcalPer100g({ tags: [] })).toBe(0);
  });
});

// Wcześniej NIETESTOWANE (istniejące testy powyżej celowo omijały nazwę — "pozycje bez
// NAZWY, żeby wynik zależał od TAGU"): dopasowanie po NAZWIE to najbardziej złożona i
// najbardziej podatna na regresję część pliku — FOOD_KCAL_ENTRIES sortowane po długości
// klucza malejąco, więc dłuższy/bardziej specyficzny klucz musi wygrywać z krótszym
// prefiksem (np. "serek" z "ser") — łatwo to przypadkiem cofnąć przy edycji tabeli.
describe('calories — foodKcalByName (dopasowanie po nazwie)', () => {
  test('rozpoznaje znaną nazwę, z polskimi znakami i wielkością liter', () => {
    expect(foodKcalByName('Ziemniaki')).toBe(77);
    expect(foodKcalByName('BANANY')).toBe(89);
  });

  test('DŁUŻSZY/bardziej specyficzny klucz wygrywa z krótszym prefiksem tego samego słowa', () => {
    expect(foodKcalByName('Serek')).toBe(95);  // NIE "ser" (350), mimo że "serek" zaczyna się na "ser"
    expect(foodKcalByName('Ser')).toBe(350);   // ale samo "ser" nadal poprawnie trafia w "ser"
  });

  test('nierozpoznana nazwa → null (NIE 0 — 0 to realna wartość dla np. wody)', () => {
    expect(foodKcalByName('zupelnie nieznany produkt xyz')).toBeNull();
    expect(foodKcalByName('')).toBeNull();
  });

  test('rozpoznana nazwa z realną wartością 0 kcal odróżnialna od braku dopasowania', () => {
    expect(foodKcalByName('Woda')).toBe(0);
  });
});

// Polska liczba mnoga bywa zmienia rdzeń (ruchome e: serek→serki; zmiana końcówki:
// jabłko→jabłka) więc sam prefix-match by cicho nie łapał produktów kupowanych w
// liczbie mnogiej — a to DOMINUJĄCA forma dla warzyw/owoców na paragonie. Naprawione
// przez DODANIE drugiego, pełnego klucza (nie skracanie — skracanie było wypróbowane
// i odrzucone, bo np. rdzeń "ogor" łapał "zupa ogórkowa" jako surowy ogórek).
describe('calories — foodKcalByName: liczba mnoga (rdzeń się zmienia)', () => {
  test('owoce/warzywa: liczba mnoga trafia w tę samą wartość co liczba pojedyncza', () => {
    expect(foodKcalByName('Jabłka')).toBe(52);
    expect(foodKcalByName('Winogrona')).toBe(67);
    expect(foodKcalByName('Ogórki')).toBe(15);
    expect(foodKcalByName('Pomarańcze')).toBe(47);
  });

  test('ruchome e (serek→serki) — najbardziej krucha odmiana, osobno pilnowana', () => {
    expect(foodKcalByName('Serki wiejskie')).toBe(95); // NIE "ser" (350)
  });

  test('dodanie liczby mnogiej NIE złapało pochodnego przymiotnika -owy/-owa (fałszywe trafienie)', () => {
    // "ogor" jako sam rdzeń złapałoby to jako surowy ogórek (15) — dlatego dodany
    // klucz to pełne "ogorki", które NIE jest prefiksem "ogorkowa".
    expect(foodKcalByName('Zupa ogórkowa')).toBe(45); // trafia w "zupa", nie w ogórek
    // podobnie sałatka (danie) nie może przypadkiem trafić w samą sałatę (surowy liść)
    expect(foodKcalByName('Sałatka jarzynowa')).toBeNull();
  });
});

// Realna kolejność w kcalPer100g (potwierdzona uruchomieniem, nie zgadywaniem — pierwsza
// wersja tego testu zakładała odwrotnie i ZŁAPAŁA SIĘ NA WŁASNYM teście): mem (nauczone) >
// NAZWA > tag > kategoria. Nazwa jest bardziej specyficzna niż ogólny tag, więc wygrywa.
describe('calories — kcalPer100g: nazwa ma pierwszeństwo przed tagiem', () => {
  test('brak tagu → liczy z nazwy', () => {
    expect(kcalPer100g({ name: 'Ziemniaki', tags: [] })).toBe(77);
  });
  test('nazwa rozpoznana I tag obecny → nazwa wygrywa (bardziej specyficzna)', () => {
    expect(kcalPer100g({ name: 'Ziemniaki', tags: ['słodycze'] })).toBe(77);
  });
  test('nazwa NIE rozpoznana → dopiero wtedy liczy się tag', () => {
    expect(kcalPer100g({ name: 'zupelnie nieznany xyz', tags: ['słodycze'] })).toBe(450);
  });
});

describe('calories — estimateItemKcal', () => {
  test('gramy z wagi × gęstość tagu', () => {
    expect(estimateItemKcal(item({ tags: ['słodycze'], weightKg: 0.1, quantity: 1 }))).toBe(450);
    expect(estimateItemKcal(item({ tags: ['warzywa'], weightKg: 0.2 }))).toBe(70);
  });
  test('brak wagi → 150 g na sztukę', () => {
    expect(estimateItemKcal(item({ tags: ['słodycze'], quantity: 2 }))).toBe(1350);
  });
  test('nierozpoznane / excluded / zjedzone przez kogoś innego → 0', () => {
    expect(estimateItemKcal(item({ tags: [], quantity: 1 }))).toBe(0);
    expect(estimateItemKcal(item({ tags: ['słodycze'], weightKg: 0.1, excluded: true }))).toBe(0);
    expect(estimateItemKcal(item({ tags: ['słodycze'], weightKg: 0.1, eaters: ['Partnerka'] }))).toBe(0);
  });
});

describe('calories — looksLikeFood', () => {
  test('tag jedzeniowy / groceries = true, śmieci = false', () => {
    expect(looksLikeFood({ tags: ['warzywa'] })).toBe(true);
    expect(looksLikeFood({ category: 'groceries' })).toBe(true);
    expect(looksLikeFood({ name: 'xyznonfood', tags: [], category: 'other' })).toBe(false);
  });
});

describe('calories — expenseFoodKcal / foodKcalForDate', () => {
  test('przychód lub brak paragonu → 0', () => {
    expect(expenseFoodKcal(e({ type: 'income', receiptItems: [item({ tags: ['słodycze'], weightKg: 0.1 })] as any }))).toBe(0);
    expect(expenseFoodKcal(e({ receiptItems: [] }))).toBe(0);
  });
  test('foodKcalForDate sumuje tylko dany dzień (bez przychodów)', () => {
    const exps = [
      e({ date: '2026-08-04T09:00:00', receiptItems: [item({ tags: ['słodycze'], weightKg: 0.1 }), item({ tags: ['warzywa'], weightKg: 0.2 })] as any }),
      e({ date: '2026-08-05T09:00:00', receiptItems: [item({ tags: ['słodycze'], weightKg: 0.1 })] as any }), // inny dzień
      e({ date: '2026-08-04T09:00:00', type: 'income', receiptItems: [item({ tags: ['słodycze'], weightKg: 1 })] as any }), // przychód
    ];
    expect(foodKcalForDate(exps, '2026-08-04')).toBe(520); // 450 + 70
  });
});

// avgFoodKcal liczy "dziś" wewnętrznie (new Date(), brak parametru do wstrzyknięcia daty —
// w przeciwieństwie do foodKcalForDate wyżej), więc test buduje daty względem PRAWDZIWEGO
// "teraz", tym samym sposobem co sama funkcja (lokalny YYYY-MM-DD, nie toISOString — patrz
// memory date_local_iso.md).
describe('calories — avgFoodKcal (średnia z N dni, puste dni liczą się jako 0)', () => {
  test('dzieli sumę przez CAŁE days, nie tylko dni z danymi', () => {
    const now = new Date();
    const localYmd = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T09:00:00`;
    const exps = [
      // dziś: 450 kcal; wczoraj: brak paragonu → 0
      e({ date: localYmd(now), receiptItems: [item({ tags: ['słodycze'], weightKg: 0.1 })] as any }),
    ];
    expect(avgFoodKcal(exps, 2)).toBe(225); // (450 + 0) / 2
  });

  test('brak wydatków w ogóle → 0, nie NaN', () => {
    expect(avgFoodKcal([], 3)).toBe(0);
  });
});
