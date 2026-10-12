// Sanity-pokrycie dla bucketValue/metricNumber/metricSeries po przejściu na indeks
// miesiąc/dzień keszowany po referencji `ctx.expenses` (2026-10-12, audyt optymalizacji
// runda 4, patrz komentarz przy `expenseIndexFor` w statWidgets.ts) — zero testów na ten
// plik istniało wcześniej mimo że liczy realne pieniądze, więc ten plik weryfikuje że
// refaktor (full-array `.filter()` → zawężony `exp` z indeksu) dał TE SAME liczby.
import { metricNumber, metricSeries, StatCtx } from '@/utils/statWidgets';
import { Expense } from '@/types';
import { DEFAULT_WORK_SETTINGS } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: Math.random().toString(36), amount: 0, currency: 'PLN', category: 'other',
  tags: [], note: '', date: '2026-10-12T10:00:00', ...o,
} as Expense);

function pad(n: number) { return String(n).padStart(2, '0'); }
const now = new Date();
const thisYm = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
const lastMonthDate = new Date(now.getFullYear(), now.getMonth() - 1, 15);
const lastYm = `${lastMonthDate.getFullYear()}-${pad(lastMonthDate.getMonth() + 1)}`;
const todayStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;

function ctxWith(expenses: Expense[]): StatCtx {
  return {
    expenses, scope: 'all', moodEntries: [], workEvents: [], workSettings: DEFAULT_WORK_SETTINGS,
    ratePerHour: 0, tasks: [], habitsTotal: 0, habitsDone: 0, nameAliases: {}, weightMemory: {},
    healthDays: {},
  };
}

describe('statWidgets — bucketValue po indeksie miesiąc/dzień (2026-10-12)', () => {
  test('spend (miesiąc): sumuje tylko wydatki z BIEŻĄCEGO miesiąca, pomija inne miesiące/przychód/self-transfer', () => {
    const ctx = ctxWith([
      e({ amount: 30, date: `${thisYm}-05T10:00:00` }),
      e({ amount: 20, date: `${thisYm}-20T10:00:00` }),
      e({ amount: 999, date: `${lastYm}-10T10:00:00` }),           // inny miesiąc
      e({ amount: 500, type: 'income', date: `${thisYm}-05T10:00:00` }), // przychód
      e({ amount: 77, category: 'transfer', date: `${thisYm}-05T10:00:00` }), // self-transfer
    ]);
    expect(metricNumber('spend', ctx, 'month').value).toBeCloseTo(50);
  });

  test('income (miesiąc): sumuje tylko przychody z bieżącego miesiąca', () => {
    const ctx = ctxWith([
      e({ amount: 500, type: 'income', date: `${thisYm}-05T10:00:00` }),
      e({ amount: 300, type: 'income', date: `${thisYm}-20T10:00:00` }),
      e({ amount: 999, type: 'income', date: `${lastYm}-10T10:00:00` }), // inny miesiąc
      e({ amount: 30, date: `${thisYm}-05T10:00:00` }),                  // wydatek
    ]);
    expect(metricNumber('income', ctx, 'month').value).toBeCloseTo(800);
  });

  test('net (miesiąc): przychody minus wydatki, self-transfer wykluczony', () => {
    const ctx = ctxWith([
      e({ amount: 500, type: 'income', date: `${thisYm}-05T10:00:00` }),
      e({ amount: 120, date: `${thisYm}-05T10:00:00` }),
      e({ amount: 50, category: 'transfer', date: `${thisYm}-05T10:00:00` }),
    ]);
    expect(metricNumber('net', ctx, 'month').value).toBeCloseTo(380);
  });

  test('spend (tydzień): łapie dzisiejszy wydatek, pomija sprzed 3 tygodni', () => {
    const threeWeeksAgo = new Date(now); threeWeeksAgo.setDate(now.getDate() - 21);
    const ctx = ctxWith([
      e({ amount: 40, date: `${todayStr}T10:00:00` }),
      e({ amount: 999, date: `${threeWeeksAgo.getFullYear()}-${pad(threeWeeksAgo.getMonth() + 1)}-${pad(threeWeeksAgo.getDate())}T10:00:00` }),
    ]);
    expect(metricNumber('spend', ctx, 'week').value).toBeCloseTo(40);
  });

  test('metricSeries (miesiąc, n=3): każde wiadro liczy TYLKO swój miesiąc, cache indeksu nie przecieka między wiadrami', () => {
    const twoMonthsAgoDate = new Date(now.getFullYear(), now.getMonth() - 2, 15);
    const twoYm = `${twoMonthsAgoDate.getFullYear()}-${pad(twoMonthsAgoDate.getMonth() + 1)}`;
    const ctx = ctxWith([
      e({ amount: 10, date: `${twoYm}-10T10:00:00` }),
      e({ amount: 20, date: `${lastYm}-10T10:00:00` }),
      e({ amount: 30, date: `${thisYm}-10T10:00:00` }),
    ]);
    const series = metricSeries('spend', ctx, 'month', 3);
    // kolejność: najstarszy → najnowszy (offset n-1 .. 0)
    expect(series.values).toEqual([10, 20, 30]);
  });

  test('tagSpend: liczy tylko pozycje paragonu z danym tagiem, w zakresie wiadra', () => {
    const ctx = ctxWith([
      e({
        amount: 50, date: `${thisYm}-05T10:00:00`,
        receiptItems: [
          { name: 'ser', price: 12, quantity: 1, unitPrice: 12, tags: ['nabiał'] } as any,
          { name: 'chleb', price: 8, quantity: 1, unitPrice: 8, tags: ['pieczywo'] } as any,
        ],
      }),
      e({ amount: 999, date: `${lastYm}-05T10:00:00`, receiptItems: [{ name: 'ser', price: 99, quantity: 1, unitPrice: 99, tags: ['nabiał'] } as any] }),
    ]);
    expect(metricNumber('tagSpend', ctx, 'month', 'nabiał').value).toBeCloseTo(12);
  });
});
