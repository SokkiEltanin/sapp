import { buildBillTrends } from '@/utils/billTrends';
import { Expense } from '@/types';

const exp = (over: Partial<Expense>): Expense => ({
  id: over.id ?? Math.random().toString(),
  amount: 100,
  type: 'expense',
  category: 'housing',
  tags: [],
  date: '2026-01-01',
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  ...over,
} as Expense);

describe('buildBillTrends', () => {
  test('pusta lista wydatków → pusty wynik', () => {
    expect(buildBillTrends([])).toEqual([]);
  });

  test('tylko jeden wpis danego typu → pominięty (potrzeba >=2, żeby "zmiana" cokolwiek znaczyła)', () => {
    const out = buildBillTrends([exp({ note: 'PGE prąd', date: '2026-01-10', amount: 200 })]);
    expect(out).toEqual([]);
  });

  test('dwa wpisy prądu → trend z poprawną kolejnością chronologiczną i % zmiany', () => {
    const out = buildBillTrends([
      exp({ note: 'PGE prąd', date: '2026-02-10', amount: 220 }),
      exp({ note: 'PGE prąd', date: '2026-01-10', amount: 200 }),
    ]);
    expect(out).toHaveLength(1);
    expect(out[0].tag).toBe('prąd');
    expect(out[0].points.map(p => p.date)).toEqual(['2026-01-10', '2026-02-10']);
    expect(out[0].lastAmount).toBe(220);
    expect(out[0].changePct).toBe(10); // (220-200)/200 = +10%
    expect(out[0].avgAmount).toBe(210);
  });

  test('przychód (type income) nigdy nie liczy się do rachunków', () => {
    const out = buildBillTrends([
      exp({ note: 'PGE prąd zwrot', date: '2026-01-10', amount: 50, type: 'income' }),
      exp({ note: 'PGE prąd zwrot', date: '2026-02-10', amount: 60, type: 'income' }),
    ]);
    expect(out).toEqual([]);
  });

  test('różne typy rachunków rozdzielone (prąd osobno od internetu)', () => {
    const out = buildBillTrends([
      exp({ note: 'PGE', date: '2026-01-10', amount: 200 }),
      exp({ note: 'PGE', date: '2026-02-10', amount: 200 }),
      exp({ note: 'Internet', date: '2026-01-15', amount: 60 }),
      exp({ note: 'Internet', date: '2026-02-15', amount: 60 }),
    ]);
    expect(out.map(t => t.tag).sort()).toEqual(['internet', 'prąd']);
  });

  test('sortowanie: największa |zmiana %| pierwsza (user chce widzieć głównie prąd, nie stabilny czynsz)', () => {
    const out = buildBillTrends([
      // czynsz — stabilny, 0% zmiany
      exp({ note: 'czynsz', date: '2026-01-05', amount: 1500 }),
      exp({ note: 'czynsz', date: '2026-02-05', amount: 1500 }),
      // prąd — duża zmiana, +50%
      exp({ note: 'PGE', date: '2026-01-10', amount: 200 }),
      exp({ note: 'PGE', date: '2026-02-10', amount: 300 }),
    ]);
    expect(out[0].tag).toBe('prąd');
    expect(out[1].tag).toBe('czynsz');
  });

  test('spadek kwoty → changePct ujemny', () => {
    const out = buildBillTrends([
      exp({ note: 'PGE', date: '2026-01-10', amount: 300 }),
      exp({ note: 'PGE', date: '2026-02-10', amount: 240 }),
    ]);
    expect(out[0].changePct).toBe(-20);
  });
});
