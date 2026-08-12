import { buildDerivedAnalysis, AnalysisInput } from '@/utils/exportAnalysis';
import { Expense, ReceiptItem, WorkSettings } from '@/types';

const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  name: '', price: 0, category: 'groceries', quantity: 1, unitPrice: 0, tags: [], ...o,
} as ReceiptItem);
const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'groceries', tags: [], note: '',
  date: '2026-08-04T10:00:00', createdAt: '', updatedAt: '', ...o,
} as Expense);
const workSettings: WorkSettings = { monthlySalary: 0, hoursPerMonth: 0, currency: 'PLN', notifyEveryMinutes: 0 };

const baseInput = (o: Partial<AnalysisInput> = {}): AnalysisInput => ({
  expenses: [], events: [], mood: [], tasks: [], workSettings, healthDays: {}, nameAliases: {}, ...o,
});

describe('buildDerivedAnalysis — kontrola spójności (integrity/warnings)', () => {
  test('data w złym formacie → zliczona i ostrzeżenie', () => {
    const result = buildDerivedAnalysis(baseInput({ expenses: [e({ date: 'nie-data' })] }));
    expect(result.integrity.expenses.badDate).toBe(1);
    expect(result.warnings.some(w => w.includes('bez poprawnej daty'))).toBe(true);
  });

  test('ujemna kwota → zliczona i ostrzeżenie', () => {
    const result = buildDerivedAnalysis(baseInput({ expenses: [e({ amount: -50 })] }));
    expect(result.integrity.expenses.negAmount).toBe(1);
    expect(result.warnings.some(w => w.includes('ujemną kwotą'))).toBe(true);
  });

  test('suma pozycji paragonu wyraźnie (>12%) inna niż kwota → flaga rozbieżności', () => {
    const result = buildDerivedAnalysis(baseInput({ expenses: [
      e({ amount: 100, receiptItems: [item({ price: 60 }), item({ price: 53 })] }), // suma 113, +13%
    ] }));
    expect(result.integrity.expenses.receiptMismatch).toBe(1);
    expect(result.integrity.expenses.mismatchSamples[0].itemsSum).toBe(113);
  });

  test('rozbieżność w granicach 12% (nie ponad) → NIE flagowana', () => {
    const result = buildDerivedAnalysis(baseInput({ expenses: [
      e({ amount: 100, receiptItems: [item({ price: 50 }), item({ price: 50 })] }), // suma 100, 0%
    ] }));
    expect(result.integrity.expenses.receiptMismatch).toBe(0);
  });

  test('paragon z JEDNĄ pozycją nigdy nie jest sprawdzany pod kątem rozbieżności', () => {
    const result = buildDerivedAnalysis(baseInput({ expenses: [
      e({ amount: 100, receiptItems: [item({ price: 1 })] }), // ewidentnie inna suma, ale tylko 1 pozycja
    ] }));
    expect(result.integrity.expenses.receiptMismatch).toBe(0);
  });
});

describe('buildDerivedAnalysis — healthByMonth (rollup zdrowia per miesiąc)', () => {
  test('kroki sumowane, stepDays liczy tylko dni z krokami > 0', () => {
    const result = buildDerivedAnalysis(baseInput({ healthDays: {
      '2026-08-01': { steps: 5000, sleepMinutes: 0, weightKg: null },
      '2026-08-02': { steps: 7000, sleepMinutes: 0, weightKg: null },
      '2026-08-03': { steps: 0, sleepMinutes: 0, weightKg: null }, // brak kroków tego dnia
    } }));
    const h = result.healthByMonth['2026-08'];
    expect(h.steps).toBe(12000);
    expect(h.stepDays).toBe(2);
  });

  test('sleepAvgH liczy średnią TYLKO z dni z realnym snem, w godzinach, zaokrąglone', () => {
    const result = buildDerivedAnalysis(baseInput({ healthDays: {
      '2026-08-01': { steps: 0, sleepMinutes: 420, weightKg: null }, // 7h
      '2026-08-02': { steps: 0, sleepMinutes: 480, weightKg: null }, // 8h
      '2026-08-03': { steps: 0, sleepMinutes: 0, weightKg: null },   // brak snu — pomijany ze średniej
    } }));
    expect(result.healthByMonth['2026-08'].sleepAvgH).toBe(7.5); // (7+8)/2
  });

  test('lastWeight = ostatnia zaobserwowana wartość w kolejności iteracji, nie chronologicznie najpóźniejsza data', () => {
    // Umyślnie NIE w porządku chronologicznym — sprawdzamy realne zachowanie kodu
    // (nadpisuje przy każdym kolejnym trafieniu w Object.entries), nie zakładane.
    const result = buildDerivedAnalysis(baseInput({ healthDays: {
      '2026-08-05': { steps: 0, sleepMinutes: 0, weightKg: 80 },
      '2026-08-01': { steps: 0, sleepMinutes: 0, weightKg: 75 },
    } }));
    expect(result.healthByMonth['2026-08'].lastWeight).toBe(75); // ostatni WPIS w obiekcie, nie najpóźniejsza data
  });
});

describe('buildDerivedAnalysis — topProducts (grupowanie i ranking)', () => {
  test('te same produkty grupowane, licznik i wydatek sumowane, sortowane malejąco po ilości', () => {
    const result = buildDerivedAnalysis(baseInput({ expenses: [
      e({ receiptItems: [item({ name: 'Mleko', price: 3, quantity: 1 }), item({ name: 'Mleko', price: 3, quantity: 1 })] }),
      e({ receiptItems: [item({ name: 'Chleb', price: 5, quantity: 1 })] }),
    ] }));
    const milk = result.topProducts.find(p => p.group === 'mleko')!;
    expect(milk.count).toBe(2);
    expect(milk.spend).toBe(6);
    expect(result.topProducts[0].group).toBe('mleko'); // wyższy count niż chleb
  });

  test('pozycje wykluczone (excluded/kaucja) i przychody nie liczą się do rankingu', () => {
    const result = buildDerivedAnalysis(baseInput({ expenses: [
      e({ type: 'income', receiptItems: [item({ name: 'Cokolwiek', price: 999 })] }),
      e({ receiptItems: [item({ name: 'Butelka', price: 1, kind: 'deposit' })] }),
    ] }));
    expect(result.topProducts.length).toBe(0);
  });
});
