import { stepsToDistanceFact, spendToFact, kgToFact } from '@/utils/funComparisons';

describe('funComparisons — stepsToDistanceFact', () => {
  test('poniżej 1 km → pusty string (za mało żeby był ciekawy fakt)', () => {
    expect(stepsToDistanceFact(500)).toBe('');
  });

  test('dystans poniżej NAJMNIEJSZEGO landmarku nadal pokazuje ten landmark ("prawie tyle co")', () => {
    // 2000 kroków ≈ 1,5 km — mniej niż najmniejszy landmark (5 km "spacer przez całe
    // miasto"), ale funkcja i tak go pokazuje jako punkt odniesienia zamiast nic nie zwrócić.
    expect(stepsToDistanceFact(2000)).toBe('1,5 km piechotą — prawie tyle co spacer przez całe miasto');
  });

  test('duży dystans: liczba z separatorem tysięcy (pl-PL) i wielokrotność landmarku', () => {
    expect(stepsToDistanceFact(300000)).toBe('229 km piechotą — prawie tyle co z Rzeszowa do Częstochowy');
  });

  // 2026-08-31, user: "duzo zaokrąglone powtórzeń ze te kroki sa z Rzeszowa do Lublina bez
  // sensu" — realistyczny miesiąc (~150k-350k kroków ≈ 115-265 km) trafiał w TYLKO dwa
  // landmarki (90 km/150 km) zanim tabela została zagęszczona; test pilnuje, że kilka
  // typowych miesięcznych sum realnie różni się landmarkiem, nie tylko mnożnikiem.
  test('typowe miesięczne sumy (115–265 km) trafiają w RÓŻNE landmarki, nie zawsze ten sam', () => {
    // wyciąga sam landmark (po "co " / "× "), nie całą liczbę km — inaczej test byłby
    // trywialnie zielony (km zawsze się różni) nawet gdyby landmark był ciągle ten sam.
    const landmarks = new Set([160000, 200000, 250000, 300000, 350000]
      .map(stepsToDistanceFact)
      .map(f => f.replace(/^.*(?:co |× )/, '')));
    expect(landmarks.size).toBeGreaterThan(1);
  });

  test('tuż nad progiem landmarku (maraton 42,2 km) → "prawie tyle co", nie wielokrotność', () => {
    expect(stepsToDistanceFact(60000)).toBe('45,7 km piechotą — prawie tyle co maraton');
  });
});

describe('funComparisons — spendToFact', () => {
  test('poniżej 20 zł → pusty string', () => {
    expect(spendToFact(10)).toBe('');
    expect(spendToFact(19)).toBe('');
  });
  test('dokładnie 20 zł → już pokazuje fakt', () => {
    expect(spendToFact(20)).toBe('1 kaw');
  });
  test('próg kebabów (>=3) trafiony → liczba kebabów, zawsze w liczbie mnogiej w praktyce', () => {
    // Bramka wymaga kebabs>=3, więc kebabs===1 wewnątrz tej gałęzi nigdy nie zachodzi —
    // odmiana liczby pojedynczej w kodzie jest martwa w praktyce, zawsze wychodzi "kebaby".
    expect(spendToFact(75)).toBe('3 kebaby');
  });
  test('poniżej progu kebabów → pada na liczbę kaw zamiast kebabów', () => {
    expect(spendToFact(62)).toBe('4 kaw');
  });
  test('od 2000 zł w górę zawsze liczy kawy (nie kebaby), z separatorem tysięcy przy dużych kwotach', () => {
    expect(spendToFact(2500)).toBe('156 kaw na mieście');
  });
});

describe('funComparisons — kgToFact', () => {
  test('poniżej 0,5 kg → pusty string', () => {
    expect(kgToFact(0.3)).toBe('');
  });
  test('poniżej progu 4 kg → wyświetlone w gramach', () => {
    expect(kgToFact(1.5)).toBe('1500 g cukru i przekąsek');
  });
  test('4 kg i więcej → wyświetlone w kg z porównaniem do arbuza', () => {
    expect(kgToFact(5.25)).toBe('5,3 kg — jak spory arbuz');
  });
});
