import { Expense, CalendarEvent, WorkSettings } from '@/types';
import { isWorkEvent, shiftHours } from '@/utils/workEvents';
import { isPaycheck } from '@/hooks/useWorkEarnings';
import { paycheckTargetMonth } from '@/utils/paycheck';

export interface PayMonthRow {
  month: string;      // YYYY-MM the paycheck is FOR
  amount: number;     // the actual paycheck
  hours: number;      // calendar hours that month
  excluded: boolean;  // left out of the average by the user
  date: string;       // paycheck date (YYYY-MM-DD)
  count: number;      // how many paychecks map to this month (duplicate flag)
}

// One row per real paycheck (target month + amount + that month's calendar hours),
// most-recent first. Shared by Settings and the dashboard work panel so both show the
// SAME average — Σ(included paycheck) ÷ Σ(their hours), across ALL months, not just one.
export function computePayMonths(expenses: Expense[], events: CalendarEvent[], settings: WorkSettings): PayMonthRow[] {
  const wp = (settings.workPrefix ?? '').trim();
  const wc = settings.workColor;
  if (!wp && !wc) return [];
  const isWork = (e: CalendarEvent) => isWorkEvent(e, { workColor: wc, workPrefix: wp.toLowerCase() });
  const hoursIn = (ym: string) => events
    .filter(e => isWork(e) && (e.date ?? '').slice(0, 7) === ym)
    .reduce((s, e) => s + shiftHours(e), 0);
  const excluded = new Set(settings.excludedPayMonths ?? []);
  const paychecks = expenses
    .filter(e => isPaycheck(e, settings.workPrefix))
    .sort((a, b) => b.date.localeCompare(a.date));
  const countByMonth: Record<string, number> = {};
  for (const p of paychecks) { const m = paycheckTargetMonth(p); countByMonth[m] = (countByMonth[m] ?? 0) + 1; }
  const seen = new Set<string>();
  const rows: PayMonthRow[] = [];
  for (const p of paychecks) {
    const month = paycheckTargetMonth(p);
    if (seen.has(month)) continue;
    seen.add(month);
    rows.push({ month, amount: p.amount, hours: hoursIn(month), excluded: excluded.has(month), date: p.date.slice(0, 10), count: countByMonth[month] });
  }
  return rows;
}

// Average zł/h = Σ(included paycheck with hours) ÷ Σ(their hours) + the earnings total.
export function payMonthsSummary(rows: PayMonthRow[]): { avgRate: number | null; includedCount: number; totalEarned: number } {
  let sal = 0, hrs = 0, cnt = 0, total = 0;
  for (const r of rows) {
    total += r.amount;
    if (!r.excluded && r.hours > 0) { sal += r.amount; hrs += r.hours; cnt++; }
  }
  return { avgRate: hrs > 0 ? sal / hrs : null, includedCount: cnt, totalEarned: total };
}
