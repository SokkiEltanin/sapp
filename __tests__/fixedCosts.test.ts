import { detectFixedCosts } from '@/utils/fixedCosts';
import { Expense } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'subscriptions', tags: [], note: '',
  date: '2026-01-15T10:00:00', createdAt: '', updatedAt: '', ...o,
} as Expense);

describe('fixedCosts — detectFixedCosts: filtrowanie kandydatów', () => {
  test('spożywcze (groceries) NIGDY nie liczą się jako stały koszt, nawet jeśli powtarzają się co miesiąc', () => {
    const exps = [
      e({ storeName: 'Lidl', category: 'groceries', amount: 200, date: '2026-01-05T00:00:00' }),
      e({ storeName: 'Lidl', category: 'groceries', amount: 210, date: '2026-02-05T00:00:00' }),
      e({ storeName: 'Lidl', category: 'groceries', amount: 205, date: '2026-03-05T00:00:00' }),
    ];
    expect(detectFixedCosts(exps)).toEqual([]);
  });

  test('przychody (type=income) są pomijane', () => {
    const exps = [
      e({ storeName: 'Pensja', type: 'income', amount: 5000, date: '2026-01-01T00:00:00' }),
      e({ storeName: 'Pensja', type: 'income', amount: 5000, date: '2026-02-01T00:00:00' }),
    ];
    expect(detectFixedCosts(exps)).toEqual([]);
  });

  test('bez nazwy sklepu/notatki (< 2 znaki) → pomijane', () => {
    const exps = [
      e({ storeName: '', note: '', amount: 40, date: '2026-01-01T00:00:00' }),
      e({ storeName: '', note: '', amount: 40, date: '2026-02-01T00:00:00' }),
    ];
    expect(detectFixedCosts(exps)).toEqual([]);
  });

  test('tylko JEDEN miesiąc wystąpienia → za mało by uznać za stały koszt', () => {
    const exps = [
      e({ storeName: 'Netflix', amount: 43, date: '2026-01-15T00:00:00' }),
    ];
    expect(detectFixedCosts(exps)).toEqual([]);
  });
});

describe('fixedCosts — detectFixedCosts: wykrywanie i mediana', () => {
  test('podstawowy przypadek: ta sama nazwa+kategoria w 3 różnych miesiącach → wykryte, mediana jako kwota', () => {
    const exps = [
      e({ storeName: 'Netflix', amount: 43, date: '2026-01-15T00:00:00' }),
      e({ storeName: 'Netflix', amount: 43, date: '2026-02-15T00:00:00' }),
      e({ storeName: 'Netflix', amount: 55, date: '2026-03-15T00:00:00' }),
    ];
    const result = detectFixedCosts(exps);
    expect(result).toHaveLength(1);
    expect(result[0].name).toBe('Netflix');
    expect(result[0].amount).toBe(43); // mediana z [43,43,55] = 43
    expect(result[0].occurrences).toBe(3);
  });

  test('data osadzona w notatce nie przeszkadza grupowaniu (normalizeName ją usuwa)', () => {
    const exps = [
      e({ storeName: '', note: 'Play rachunek 15.01.2026', amount: 60, date: '2026-01-15T00:00:00' }),
      e({ storeName: '', note: 'Play rachunek 15.02.2026', amount: 60, date: '2026-02-15T00:00:00' }),
      e({ storeName: '', note: 'Play rachunek 15.03.2026', amount: 60, date: '2026-03-15T00:00:00' }),
    ];
    const result = detectFixedCosts(exps);
    expect(result).toHaveLength(1); // gdyby data NIE była usuwana, wyszłyby 3 osobne grupy
    expect(result[0].occurrences).toBe(3);
  });

  test('dwie płatności w TYM SAMYM miesiącu liczą się jako 1 wystąpienie (miesiące), ale obie kwoty wchodzą do mediany', () => {
    const exps = [
      e({ storeName: 'Spotify', amount: 20, date: '2026-01-05T00:00:00' }),
      e({ storeName: 'Spotify', amount: 20, date: '2026-01-20T00:00:00' }), // ten sam miesiąc co wyżej
      e({ storeName: 'Spotify', amount: 20, date: '2026-02-05T00:00:00' }),
    ];
    const result = detectFixedCosts(exps);
    expect(result[0].occurrences).toBe(2); // tylko 2 RÓŻNE miesiące (styczeń, luty)
    expect(result[0].amount).toBe(20); // mediana z [20,20,20]
  });

  test('parzysta liczba wystąpień → mediana to średnia dwóch środkowych', () => {
    const exps = [
      e({ storeName: 'Siłownia', amount: 40, date: '2026-01-01T00:00:00' }),
      e({ storeName: 'Siłownia', amount: 45, date: '2026-02-01T00:00:00' }),
      e({ storeName: 'Siłownia', amount: 55, date: '2026-03-01T00:00:00' }),
      e({ storeName: 'Siłownia', amount: 60, date: '2026-04-01T00:00:00' }),
    ];
    const result = detectFixedCosts(exps);
    expect(result[0].amount).toBe(50); // (45+55)/2
  });
});

describe('fixedCosts — detectFixedCosts: filtr wariancji (odrzuca nieregularne kwoty)', () => {
  test('rozrzut DOKŁADNIE 30% względem mediany → nadal wykryte (granica włączona)', () => {
    const exps = [
      e({ storeName: 'Prąd', amount: 100, date: '2026-01-01T00:00:00' }),
      e({ storeName: 'Prąd', amount: 100, date: '2026-02-01T00:00:00' }),
      e({ storeName: 'Prąd', amount: 130, date: '2026-03-01T00:00:00' }), // dokładnie +30% od mediany 100
    ];
    expect(detectFixedCosts(exps)).toHaveLength(1);
  });

  test('rozrzut POWYŻEJ 30% → odrzucone jako zbyt nieregularne żeby być "stałym" kosztem', () => {
    const exps = [
      e({ storeName: 'Prąd', amount: 100, date: '2026-01-01T00:00:00' }),
      e({ storeName: 'Prąd', amount: 100, date: '2026-02-01T00:00:00' }),
      e({ storeName: 'Prąd', amount: 131, date: '2026-03-01T00:00:00' }), // +31%
    ];
    expect(detectFixedCosts(exps)).toEqual([]);
  });
});

describe('fixedCosts — detectFixedCosts: progi pewności (confidence)', () => {
  const monthly = (name: string, amount: number, months: number) =>
    Array.from({ length: months }, (_, i) =>
      e({ storeName: name, amount, date: `2026-${String(i + 1).padStart(2, '0')}-01T00:00:00` }));

  test('2 wystąpienia → low', () => {
    expect(detectFixedCosts(monthly('Abonament', 10, 2))[0].confidence).toBe('low');
  });
  test('3 wystąpienia → medium', () => {
    expect(detectFixedCosts(monthly('Abonament', 10, 3))[0].confidence).toBe('medium');
  });
  test('4 wystąpienia → high', () => {
    expect(detectFixedCosts(monthly('Abonament', 10, 4))[0].confidence).toBe('high');
  });
});

describe('fixedCosts — detectFixedCosts: sortowanie i grupowanie po kategorii', () => {
  test('wynik posortowany malejąco po kwocie (największy stały koszt pierwszy)', () => {
    const exps = [
      ...['2026-01-01T00:00:00', '2026-02-01T00:00:00'].map(d => e({ storeName: 'Tani abonament', amount: 10, date: d })),
      ...['2026-01-01T00:00:00', '2026-02-01T00:00:00'].map(d => e({ storeName: 'Drogi abonament', amount: 500, date: d })),
    ];
    const result = detectFixedCosts(exps);
    expect(result.map(r => r.name)).toEqual(['Drogi abonament', 'Tani abonament']);
  });

  test('ta sama nazwa w RÓŻNYCH kategoriach to DWIE osobne grupy, nie jedna', () => {
    const exps = [
      e({ storeName: 'Media', category: 'subscriptions', amount: 50, date: '2026-01-01T00:00:00' }),
      e({ storeName: 'Media', category: 'subscriptions', amount: 50, date: '2026-02-01T00:00:00' }),
      e({ storeName: 'Media', category: 'other', amount: 30, date: '2026-01-01T00:00:00' }),
      e({ storeName: 'Media', category: 'other', amount: 30, date: '2026-02-01T00:00:00' }),
    ];
    expect(detectFixedCosts(exps)).toHaveLength(2);
  });
});
