import { payMonthsSummary } from '@/utils/workSummary';

const row = (o: any) => ({ month: '2026-08', amount: 0, hours: 0, excluded: false, date: '2026-08-01', count: 1, ...o });

describe('workSummary — payMonthsSummary', () => {
  test('średnia stawka = Σ pensji ÷ Σ godzin (tylko included z godzinami)', () => {
    const r = payMonthsSummary([
      row({ month: '2026-08', amount: 4000, hours: 160 }),
      row({ month: '2026-07', amount: 3000, hours: 120 }),
    ]);
    expect(r.totalEarned).toBe(7000);
    expect(r.includedCount).toBe(2);
    expect(r.avgRate).toBeCloseTo(7000 / 280); // 25 zł/h
  });

  test('wykluczony miesiąc liczy się do sumy, ale NIE do stawki', () => {
    const r = payMonthsSummary([
      row({ month: '2026-08', amount: 4000, hours: 160 }),
      row({ month: '2026-07', amount: 9999, hours: 100, excluded: true }),
    ]);
    expect(r.totalEarned).toBe(13999);
    expect(r.includedCount).toBe(1);
    expect(r.avgRate).toBeCloseTo(4000 / 160);
  });

  test('brak godzin kalendarza → avgRate null (nie dzieli przez 0) — zamraża naprawiony bug', () => {
    const r = payMonthsSummary([row({ month: '2026-08', amount: 4000, hours: 0 })]);
    expect(r.avgRate).toBeNull();
    expect(r.totalEarned).toBe(4000);
    expect(r.includedCount).toBe(0);
  });

  test('puste → null/0', () => {
    expect(payMonthsSummary([])).toEqual({ avgRate: null, includedCount: 0, totalEarned: 0 });
  });
});
