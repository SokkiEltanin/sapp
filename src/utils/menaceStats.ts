import { CalendarEvent, Expense, WorkSettings } from '@/types';
import { isWorkEvent, shiftHours } from '@/utils/workEvents';
import { sweetsTotal } from '@/utils/dashboard/spend';

// Pure aggregation for the "nemesis miesiąca" trigger (seasonalEvents.pickMenace) —
// this month's number vs the trailing average of the months before it. Kept separate
// from seasonalEvents.ts so that file stays free of Expense/CalendarEvent types.

function pad(n: number) { return String(n).padStart(2, '0'); }
function ymOf(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; }

// YYYY-MM keys for `count` months ending at `end` (end included, most recent last).
function trailingMonthKeys(end: Date, count: number): string[] {
  const out: string[] = [];
  for (let i = count - 1; i >= 0; i--) {
    const d = new Date(end.getFullYear(), end.getMonth() - i, 1);
    out.push(ymOf(d));
  }
  return out;
}

// Hours worked (per calendar-tagged events) in each of the last `monthsBack` months
// BEFORE `end`'s month, plus `end`'s own month — keyed by YYYY-MM. Empty when work
// tracking isn't configured (no workPrefix/workColor) — mirrors workDiag/useWorkEarnings.
export function monthlyWorkHours(events: CalendarEvent[], settings: WorkSettings, end: Date, monthsBack = 4): Record<string, number> {
  const wp = (settings.workPrefix ?? '').trim().toLowerCase();
  const wc = settings.workColor;
  if (!wp && !wc) return {};
  const isWork = (e: CalendarEvent) => isWorkEvent(e, { workColor: wc, workPrefix: wp });
  const keys = trailingMonthKeys(end, monthsBack + 1); // +1 = includes the current month
  const out: Record<string, number> = {};
  for (const ym of keys) {
    out[ym] = events.filter(e => isWork(e) && (e.date ?? '').slice(0, 7) === ym).reduce((s, e) => s + shiftHours(e), 0);
  }
  return out;
}

// Sweets spend (zł) per month, same window shape as monthlyWorkHours.
export function monthlySweetsSpend(expenses: Expense[], end: Date, monthsBack = 4): Record<string, number> {
  const keys = trailingMonthKeys(end, monthsBack + 1);
  const out: Record<string, number> = {};
  for (const ym of keys) {
    const dates = expenses
      .map(e => (e.date ?? '').slice(0, 10))
      .filter(d => d.slice(0, 7) === ym);
    out[ym] = sweetsTotal(expenses, dates);
  }
  return out;
}

// This-month value + average of the PRECEDING months (current month excluded from the
// average, so a big current-month spike compares against a clean baseline).
export function thisMonthVsAvg(byMonth: Record<string, number>, end: Date): { thisMonth: number; avg: number } {
  const curKey = ymOf(end);
  const thisMonth = byMonth[curKey] ?? 0;
  const prevVals = Object.entries(byMonth).filter(([k]) => k !== curKey).map(([, v]) => v);
  const nonZero = prevVals.filter(v => v > 0);
  const avg = nonZero.length > 0 ? nonZero.reduce((s, v) => s + v, 0) / nonZero.length : 0;
  return { thisMonth, avg };
}
