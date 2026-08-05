import { pctChange, monthSpendCompare } from '@/utils/dashboard/compare';
import { Expense } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'other', date: '2026-08-04T10:00:00',
  createdAt: '', updatedAt: '', ...o,
} as Expense);

describe('dashboard/compare — pctChange', () => {
  test('procent zmiany, null gdy baza 0', () => {
    expect(pctChange(150, 100)).toBe(50);
    expect(pctChange(80, 100)).toBe(-20);
    expect(pctChange(100, 0)).toBeNull();
  });
});

describe('dashboard/compare — monthSpendCompare', () => {
  test('bieżący miesiąc vs poprzedni i vs średnia z wcześniejszych', () => {
    const now = new Date(2026, 7, 15); // sierpień 2026
    const exps = [
      e({ amount: 300, date: '2026-08-10T09:00:00' }), // sie
      e({ amount: 200, date: '2026-07-10T09:00:00' }), // lip
      e({ amount: 100, date: '2026-06-10T09:00:00' }), // cze
      e({ type: 'income', amount: 9999, date: '2026-08-01T09:00:00' }),   // pomiń
      e({ category: 'transfer' as any, amount: 9999, date: '2026-08-02T09:00:00' }), // self-transfer, pomiń
    ];
    const r = monthSpendCompare(exps, now);
    expect(r.vsPrev).toBe(50);   // 300 vs 200
    expect(r.vsAvg).toBe(100);   // 300 vs avg(100,200)=150 → +100%
  });

  test('brak wcześniejszych miesięcy → null', () => {
    const now = new Date(2026, 7, 15);
    const r = monthSpendCompare([e({ amount: 300, date: '2026-08-10T09:00:00' })], now);
    expect(r.vsPrev).toBeNull();
    expect(r.vsAvg).toBeNull();
  });
});
