import { seasonalSpendWarning } from '@/utils/seasonalSpend';
import { Expense } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 10, currency: 'PLN', category: 'groceries', tags: [], note: '',
  date: '2025-10-15T10:00:00', createdAt: '', updatedAt: '', type: 'expense', receiptItems: [], ...o,
} as Expense);

const NOW = new Date(2026, 9, 5); // 5 października 2026 — patrzy na październik 2025

describe('seasonalSpendWarning', () => {
  it('zwraca null gdy brak wydatków', () => {
    expect(seasonalSpendWarning([], NOW)).toBeNull();
  });

  it('zwraca null gdy nic z tego samego miesiąca rok wcześniej', () => {
    const expenses = [e({ date: '2026-10-05T10:00:00', category: 'groceries', amount: 500 })]; // ten rok, nie zeszły
    expect(seasonalSpendWarning(expenses, NOW)).toBeNull();
  });

  it('wybiera kategorię z najwyższą sumą w tym samym miesiącu rok wcześniej', () => {
    const expenses = [
      e({ id: '1', date: '2025-10-03T10:00:00', category: 'groceries', amount: 100 }),
      e({ id: '2', date: '2025-10-10T10:00:00', category: 'entertainment', amount: 400 }),
      e({ id: '3', date: '2025-10-20T10:00:00', category: 'entertainment', amount: 50 }),
      e({ id: '4', date: '2025-09-15T10:00:00', category: 'health', amount: 1000 }), // inny miesiąc — nie liczy się
    ];
    const result = seasonalSpendWarning(expenses, NOW);
    expect(result).toEqual({ monthLabel: 'Październiku 2025', category: 'entertainment', amount: 450 });
  });

  it('pomija przychody', () => {
    const expenses = [
      e({ id: '1', date: '2025-10-03T10:00:00', category: 'salary', amount: 5000, type: 'income' }),
      e({ id: '2', date: '2025-10-10T10:00:00', category: 'groceries', amount: 80 }),
    ];
    const result = seasonalSpendWarning(expenses, NOW);
    expect(result).toEqual({ monthLabel: 'Październiku 2025', category: 'groceries', amount: 80 });
  });

  it('pomija transfery własne (kategoria transfer)', () => {
    const expenses = [
      e({ id: '1', date: '2025-10-03T10:00:00', category: 'transfer', amount: 2000 }),
      e({ id: '2', date: '2025-10-10T10:00:00', category: 'clothing', amount: 60 }),
    ];
    const result = seasonalSpendWarning(expenses, NOW);
    expect(result).toEqual({ monthLabel: 'Październiku 2025', category: 'clothing', amount: 60 });
  });

  it('zeruje się poprawnie na granicy roku (styczeń → styczeń poprzedniego roku)', () => {
    const jan = new Date(2026, 0, 10); // styczeń 2026 → patrzy na styczeń 2025 (TEN SAM miesiąc)
    const expenses = [
      e({ date: '2025-01-24T10:00:00', category: 'other', amount: 300 }),
      e({ date: '2025-12-24T10:00:00', category: 'health', amount: 9999 }), // grudzień — nie liczy się
    ];
    const result = seasonalSpendWarning(expenses, jan);
    expect(result).toEqual({ monthLabel: 'Styczniu 2025', category: 'other', amount: 300 });
  });
});
