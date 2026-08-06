import { monthlyWorkHours, monthlySweetsSpend, thisMonthVsAvg } from '@/utils/menaceStats';
import { CalendarEvent, Expense, DEFAULT_WORK_SETTINGS } from '@/types';

const ev = (o: Partial<CalendarEvent>): CalendarEvent => ({
  id: Math.random().toString(36), title: '', date: '2026-08-04', ...o,
} as CalendarEvent);

const exp = (o: Partial<Expense>): Expense => ({
  id: Math.random().toString(36), amount: 0, currency: 'PLN', category: 'other',
  date: '2026-08-04T10:00:00', createdAt: '', updatedAt: '', ...o,
} as Expense);

describe('menaceStats — monthlyWorkHours', () => {
  test('no workPrefix/workColor configured → empty (mirrors workDiag/useWorkEarnings)', () => {
    const events = [ev({ title: '[JD] 9:00 - 17:00', date: '2026-08-05' })];
    expect(monthlyWorkHours(events, { ...DEFAULT_WORK_SETTINGS }, new Date(2026, 7, 15))).toEqual({});
  });

  test('sums hours per month for events matching the prefix', () => {
    const settings = { ...DEFAULT_WORK_SETTINGS, workPrefix: '[JD]' };
    const events = [
      ev({ title: '[JD] 9:00 - 17:00', date: '2026-08-05' }),  // 8h sierpień
      ev({ title: '[JD] 10:00 - 18:00', date: '2026-08-12' }), // 8h sierpień
      ev({ title: '[JD] 9:00 - 13:00', date: '2026-07-05' }),  // 4h lipiec
      ev({ title: 'Coś innego', date: '2026-08-06' }),         // pomiń — inny prefiks
    ];
    const byMonth = monthlyWorkHours(events, settings, new Date(2026, 7, 15), 2);
    expect(byMonth['2026-08']).toBeCloseTo(16);
    expect(byMonth['2026-07']).toBeCloseTo(4);
    expect(byMonth['2026-06']).toBe(0);
  });
});

describe('menaceStats — monthlySweetsSpend', () => {
  test('sums sweets item prices per month', () => {
    const expenses = [
      exp({ date: '2026-08-04T09:00:00', receiptItems: [{ name: 'Baton', price: 5, tags: ['słodycze'] }] as any }),
      exp({ date: '2026-08-20T09:00:00', receiptItems: [{ name: 'Chipsy', price: 7, tags: ['przekąski'] }] as any }),
      exp({ date: '2026-07-04T09:00:00', receiptItems: [{ name: 'Cukierki', price: 3, tags: ['słodycze'] }] as any }),
    ];
    const byMonth = monthlySweetsSpend(expenses, new Date(2026, 7, 15), 2);
    expect(byMonth['2026-08']).toBeCloseTo(12);
    expect(byMonth['2026-07']).toBeCloseTo(3);
  });
});

describe('menaceStats — thisMonthVsAvg', () => {
  test('averages the OTHER months, excluding the current one and zero months', () => {
    const byMonth = { '2026-08': 200, '2026-07': 100, '2026-06': 0, '2026-05': 60 };
    const r = thisMonthVsAvg(byMonth, new Date(2026, 7, 20));
    expect(r.thisMonth).toBe(200);
    expect(r.avg).toBeCloseTo((100 + 60) / 2); // czerwiec (0) pomijany jako brak danych
  });

  test('no history at all → avg 0', () => {
    expect(thisMonthVsAvg({ '2026-08': 50 }, new Date(2026, 7, 20))).toEqual({ thisMonth: 50, avg: 0 });
  });
});
