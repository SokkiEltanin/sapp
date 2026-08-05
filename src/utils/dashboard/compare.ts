import { Expense } from '@/types';
import { isSelfTransfer } from '@/utils/statWidgets';

// Porównania wydatków dla karty Finanse — wyniesione z app/(tabs)/index.tsx (krok 1). `now`
// wstrzykiwalny → deterministyczne testy. Self-transfer i przychody wykluczone.

// Zmiana procentowa cur względem base (null gdy base = 0 — brak sensownego odniesienia).
export function pctChange(cur: number, base: number): number | null {
  return base > 0 ? Math.round((cur - base) / base * 100) : null;
}

// Wydatek bieżącego MIESIĄCA vs poprzedni miesiąc i vs średnia z (max 6) wcześniejszych.
export function monthSpendCompare(scopedExpenses: Expense[], now: Date = new Date()): { vsPrev: number | null; vsAvg: number | null } {
  const byMonth: Record<string, number> = {};
  for (const e of scopedExpenses) {
    if ((e.type && e.type !== 'expense') || isSelfTransfer(e)) continue;
    const m = (e.date ?? '').slice(0, 7); if (!m) continue;
    byMonth[m] = (byMonth[m] ?? 0) + e.amount;
  }
  const months = Object.keys(byMonth).sort();
  const curKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
  const cur = byMonth[curKey] ?? 0;
  const priorKeys = months.filter(m => m < curKey);
  const prev = priorKeys.length ? byMonth[priorKeys[priorKeys.length - 1]] : 0;
  const priorVals = priorKeys.slice(-6).map(m => byMonth[m]);
  const avg = priorVals.length ? priorVals.reduce((a, b) => a + b, 0) / priorVals.length : 0;
  return { vsPrev: pctChange(cur, prev), vsAvg: pctChange(cur, avg) };
}
