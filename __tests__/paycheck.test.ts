import { paycheckTargetMonth } from '@/utils/paycheck';

const p = (note: string, date: string) => paycheckTargetMonth({ note, date });

describe('paycheck — paycheckTargetMonth', () => {
  test('„WYPŁATA ZA <miesiąc>" → ten miesiąc', () => {
    expect(p('[JD] WYPŁATA ZA KWIECIEŃ', '2026-05-10')).toBe('2026-04');
    expect(p('wypłata za sierpień', '2026-08-25')).toBe('2026-08');
  });

  test('styczniowa wypłata „za grudzień" → grudzień POPRZEDNIEGO roku', () => {
    expect(p('WYPŁATA ZA GRUDZIEŃ', '2026-01-10')).toBe('2025-12');
  });

  test('brak „za <miesiąc>" → fallback: miesiąc PRZED datą (wynagrodzenie z dołu)', () => {
    expect(p('Wynagrodzenie', '2026-08-10')).toBe('2026-07');
  });

  test('nazwa pracodawcy zawierająca stem miesiąca NIE łapie (zamraża bug MARKETING→marzec)', () => {
    // „MARKETING" zawiera „mar" (marzec) — nie może przypisać do marca; fallback = lipiec
    expect(p('MARKETING INVESTMENT GROUP', '2026-08-10')).toBe('2026-07');
  });
});
