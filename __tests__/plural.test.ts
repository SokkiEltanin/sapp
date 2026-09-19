import { plPlural } from '@/utils/plural';

// 2026-09-19, user: "jak na dashboardzie pokazuje się że mam do odebrania nagrody u pupila
// to nie odmienia sieę przez liczbę" — realny bug w PetTile.tsx (zawsze "nagród"
// niezależnie od liczby). `plPlural` już istniało i było używane w kilku miejscach
// (TopPill.tsx, dashboard fallback), ale nigdy nie miało własnego testu.
describe('plPlural (polska odmiana rzeczownika przez liczbę)', () => {
  test('1 → forma "one"', () => {
    expect(plPlural(1, 'zadanie', 'zadania', 'zadań')).toBe('zadanie');
  });

  test('2-4 → forma "few" (poza 12-14)', () => {
    expect(plPlural(2, 'zadanie', 'zadania', 'zadań')).toBe('zadania');
    expect(plPlural(3, 'zadanie', 'zadania', 'zadań')).toBe('zadania');
    expect(plPlural(4, 'zadanie', 'zadania', 'zadań')).toBe('zadania');
    expect(plPlural(22, 'zadanie', 'zadania', 'zadań')).toBe('zadania');
    expect(plPlural(23, 'zadanie', 'zadania', 'zadań')).toBe('zadania');
  });

  test('0, 5-21, 12-14 → forma "many"', () => {
    expect(plPlural(0, 'zadanie', 'zadania', 'zadań')).toBe('zadań');
    expect(plPlural(5, 'zadanie', 'zadania', 'zadań')).toBe('zadań');
    expect(plPlural(21, 'zadanie', 'zadania', 'zadań')).toBe('zadań');
    expect(plPlural(12, 'zadanie', 'zadania', 'zadań')).toBe('zadań');
    expect(plPlural(13, 'zadanie', 'zadania', 'zadań')).toBe('zadań');
    expect(plPlural(14, 'zadanie', 'zadania', 'zadań')).toBe('zadań');
  });

  test('liczby ujemne liczone po wartości bezwzględnej', () => {
    expect(plPlural(-1, 'zadanie', 'zadania', 'zadań')).toBe('zadanie');
    expect(plPlural(-3, 'zadanie', 'zadania', 'zadań')).toBe('zadania');
    expect(plPlural(-5, 'zadanie', 'zadania', 'zadań')).toBe('zadań');
  });

  test('dziesiątki+ z końcówką 12-14 są "many", nie "few" (112,113,114)', () => {
    expect(plPlural(112, 'zadanie', 'zadania', 'zadań')).toBe('zadań');
    expect(plPlural(113, 'zadanie', 'zadania', 'zadań')).toBe('zadań');
    expect(plPlural(114, 'zadanie', 'zadania', 'zadań')).toBe('zadań');
  });
});
