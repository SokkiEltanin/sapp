import { FOOD_BASE, searchFoodBase, foodMatchScore } from '@/data/foodBase';
import { normalizeProductName } from '@/utils/productMemory';

// 2026-10-05, user: "musimy sie skupić ogólnie nad ulepszenie tego i to bardzo... co zjadlem
// pododawaj produktów mnóstwo typu Passata pomidorowa i wgle bo brakuje lepsze wyszukiwanie".
// Dwie rzeczy zmienione: (1) zdublowane wpisy w FOOD_BASE wyczyszczone (zaśmiecały wyniki
// wyszukiwania dwoma prawie-identycznymi kartami dla tego samego produktu), (2) ~90 nowych
// wpisów wypełniających realnie puste kategorie (sosy/przyprawy/konserwy/mrożonki/kuchnia
// świata), (3) `searchFoodBase`/`foodMatchScore` dostały fallback na literówki. Ten plik
// pilnuje wszystkich trzech, żeby nie dało się po cichu znowu zaśmiecić bazy duplikatem.

describe('FOOD_BASE — integralność danych', () => {
  test('brak zduplikowanych nazw (dawny realny bug — ta sama karta pokazywała się 2× w wynikach z różnymi makro)', () => {
    const seen = new Map<string, number>();
    for (const f of FOOD_BASE) seen.set(f.name, (seen.get(f.name) ?? 0) + 1);
    const dups = [...seen.entries()].filter(([, c]) => c > 1);
    expect(dups).toEqual([]);
  });

  test('każdy wpis ma dodatnie kcal (lub realne 0 dla wody/napojów bezkalorycznych) i niepustą nazwę', () => {
    for (const f of FOOD_BASE) {
      expect(f.name.trim().length).toBeGreaterThan(0);
      expect(f.kcal).toBeGreaterThanOrEqual(0);
    }
  });

  test('"Passata pomidorowa" jest w bazie (dokładny przykład usera)', () => {
    expect(FOOD_BASE.some(f => f.name === 'Passata pomidorowa')).toBe(true);
  });

  test('baza realnie się rozrosła — nowe kategorie (sosy/przyprawy/konserwy/mrożonki/kuchnia świata) mają wpisy', () => {
    const names = FOOD_BASE.map(f => normalizeProductName(f.name));
    expect(names.some(n => n.includes('sos sojowy'))).toBe(true);
    expect(names.some(n => n.includes('pieprz'))).toBe(true);
    expect(names.some(n => n.includes('fasolka po breto'))).toBe(true);
    expect(names.some(n => n.includes('frytki mrozone'))).toBe(true);
    expect(names.some(n => n.includes('ramen'))).toBe(true);
    expect(FOOD_BASE.length).toBeGreaterThan(350);  // było 310 przed rozbudową
  });
});

describe('foodMatchScore — wspólna skala trafności (baza + własne produkty usera)', () => {
  test('dokładne dopasowanie > zaczyna się od > zawiera > wszystkie tokeny > literówka', () => {
    const exact = foodMatchScore('passata pomidorowa', 'passata pomidorowa');
    const starts = foodMatchScore('passata pomidorowa', 'passata');
    const includes = foodMatchScore('sos passata pomidorowa domowa', 'passata');
    const tokens = foodMatchScore('pomidorowa passata', 'passata pomidorowa');
    const typo = foodMatchScore('passata pomidorowa', 'pasata pomidorowa'); // literówka: jedno 's'
    expect(exact).toBeGreaterThan(starts);
    expect(starts).toBeGreaterThan(includes);
    expect(includes).toBeGreaterThanOrEqual(tokens);
    expect(tokens).toBeGreaterThan(typo);
    expect(typo).toBeGreaterThan(0);
  });

  test('brak zapytania → 0 (nigdy fałszywego dopasowania)', () => {
    expect(foodMatchScore('cokolwiek', '')).toBe(0);
  });

  test('zupełnie niepasująca nazwa → 0, nawet przy fallbacku na literówki', () => {
    expect(foodMatchScore('kurczak pieczony', 'passata pomidorowa')).toBe(0);
  });

  test('bardzo krótki token (<3 znaki) wymaga dokładnego dopasowania, nie fuzzy — inaczej złapałby prawie wszystko', () => {
    // 'ser' (3 znaki — próg) nie powinien fuzzy-dopasować się do czegoś niepowiązanego typu 'sok'
    expect(foodMatchScore('sok pomaranczowy', 'ser')).toBe(0);
  });
});

describe('searchFoodBase — literówki wciąż coś pokazują (2026-10-05, "brakuje lepsze wyszukiwanie")', () => {
  test('lekka literówka w nazwie produktu nadal go znajduje', () => {
    const results = searchFoodBase('pasata pomidorowa'); // brakuje jednego 's'
    expect(results.some(f => f.name === 'Passata pomidorowa')).toBe(true);
  });

  test('poprawne zapytanie nadal trafia jako NAJLEPSZY wynik (fuzzy nie przebija prawdziwego dopasowania)', () => {
    const results = searchFoodBase('passata');
    expect(results[0]?.name).toBe('Passata pomidorowa');
  });

  test('zupełnie losowy ciąg znaków nie zwraca wszystkiego (fallback nie jest zbyt luźny)', () => {
    const results = searchFoodBase('xzqw123nieistniejeprodukt');
    expect(results.length).toBe(0);
  });

  test('puste zapytanie zwraca coś (pierwsze `limit` pozycji), nie pustą listę', () => {
    expect(searchFoodBase('', 5).length).toBe(5);
  });
});
