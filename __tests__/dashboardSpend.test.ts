import { groceryTotal, allSpend, weekIncome } from '@/utils/dashboard/spend';
import { Expense } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: Math.random().toString(36), amount: 0, currency: 'PLN', category: 'other',
  date: '2026-08-04T10:00:00', createdAt: '', updatedAt: '', ...o,
} as Expense);

const D = ['2026-08-04', '2026-08-05'];

describe('dashboard/spend — agregacje wydatków', () => {
  test('groceryTotal sumuje tylko groceries w oknie dni', () => {
    const exp = [
      e({ category: 'groceries', amount: 30, date: '2026-08-04T09:00:00' }),
      e({ category: 'groceries', amount: 20, date: '2026-08-05T09:00:00' }),
      e({ category: 'transport', amount: 99, date: '2026-08-04T09:00:00' }), // inna kategoria
      e({ category: 'groceries', amount: 50, date: '2026-08-01T09:00:00' }), // poza oknem
      e({ category: 'groceries', amount: 12, date: '2026-08-04T09:00:00', type: 'income' }), // przychód
    ];
    expect(groceryTotal(exp, D)).toBeCloseTo(50);
  });

  test('allSpend sumuje wszystkie wydatki (bez przychodów) w oknie', () => {
    const exp = [
      e({ amount: 30, date: '2026-08-04T09:00:00' }),
      e({ amount: 20, category: 'transport', date: '2026-08-05T09:00:00' }),
      e({ amount: 100, type: 'income', date: '2026-08-04T09:00:00' }),  // przychód pomijany
      e({ amount: 77, date: '2026-08-09T09:00:00' }),                    // poza oknem
    ];
    expect(allSpend(exp, D)).toBeCloseTo(50);
  });

  test('weekIncome sumuje tylko przychody w oknie', () => {
    const exp = [
      e({ amount: 1000, type: 'income', date: '2026-08-04T09:00:00' }),
      e({ amount: 500, type: 'income', date: '2026-08-09T09:00:00' }),   // poza oknem
      e({ amount: 40, date: '2026-08-05T09:00:00' }),                    // wydatek
    ];
    expect(weekIncome(exp, D)).toBeCloseTo(1000);
  });

  test('brak wpisów → 0', () => {
    expect(allSpend([], D)).toBe(0);
    expect(groceryTotal([], D)).toBe(0);
    expect(weekIncome([], D)).toBe(0);
  });
});
