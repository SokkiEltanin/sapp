import { isFixedExpense, fixedVariableMonths } from '@/utils/fixedVariable';
import { Expense } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'other', date: '2026-08-04T10:00:00',
  createdAt: '', updatedAt: '', ...o,
} as Expense);

describe('fixedVariable — isFixedExpense', () => {
  test('housing/subscriptions = stałe; przychód/jedzenie = nie', () => {
    expect(isFixedExpense(e({ category: 'housing', amount: 1000 }))).toBe(true);
    expect(isFixedExpense(e({ category: 'subscriptions', amount: 40 }))).toBe(true);
    expect(isFixedExpense(e({ type: 'income', category: 'housing' }))).toBe(false);
    expect(isFixedExpense(e({ category: 'groceries', note: 'chleb' }))).toBe(false);
  });
});

describe('fixedVariable — fixedVariableMonths', () => {
  test('rozdziela stałe/zmienne/jedzenie w danym miesiącu, pomija przychód i self-transfer', () => {
    const now = new Date(2026, 7, 15); // sierpień 2026
    const exps = [
      e({ category: 'housing', amount: 1000, date: '2026-08-03T09:00:00' }),      // stałe
      e({ category: 'groceries', amount: 200, date: '2026-08-04T09:00:00' }),     // jedzenie
      e({ category: 'entertainment', amount: 50, date: '2026-08-05T09:00:00' }),  // zmienne
      e({ type: 'income', amount: 5000, date: '2026-08-01T09:00:00' }),           // przychód (pomiń)
      e({ category: 'transfer', amount: 999, date: '2026-08-02T09:00:00' }),      // self-transfer (pomiń)
      e({ category: 'housing', amount: 800, date: '2026-07-01T09:00:00' }),       // inny miesiąc
    ];
    const [m] = fixedVariableMonths(exps, 1, now);
    expect(m.month).toBe('2026-08');
    expect(m.fixed).toBe(1000);
    expect(m.food).toBe(200);
    expect(m.variable).toBe(50);
  });
});
