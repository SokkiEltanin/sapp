import { Expense, CalendarEvent, WorkSettings, Employer } from '@/types';
import { isWorkEvent, shiftHours, shiftClockRange } from '@/utils/workEvents';
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

// 2026-09-10, "Pracodawcy" (patrz Employer w types/index.ts, user: "żeby dało się zmienić
// prefiks... i działał jak zmienię pracę" + "wyłączyć stare żeby one były ale widzieć tylko z
// nowej pracy") — łączy `computePayMonths` PER pracodawca (każdy ma własny prefiks/nadpisania,
// dokładnie ten sam kształt pól co `WorkSettings`, więc funkcja niżej wywołuje ISTNIEJĄCĄ
// `computePayMonths` bez zmian w jej wnętrzu) w jedną, otagowaną listę — ekran Pracy filtruje
// po `employerId`/`employerName`, ukryci (`hidden`) pracodawcy są WYŁĄCZENI z domyślnego
// (łącznego) widoku, ale ich wiersze ZOSTAJĄ w zwróconej liście (nie znikają z danych —
// wywołujący decyduje czy je pokazać, np. gdy user chce "odkryć" starą pracę).
export interface EmployerPayMonthRow extends PayMonthRow {
  employerId: string;
  employerName: string;
  employerHidden: boolean;
}

export function computePayMonthsForEmployers(
  expenses: Expense[], events: CalendarEvent[], employers: Employer[],
): EmployerPayMonthRow[] {
  const rows: EmployerPayMonthRow[] = [];
  for (const emp of employers) {
    const empRows = computePayMonths(expenses, events, emp as unknown as WorkSettings);
    for (const r of empRows) rows.push({ ...r, employerId: emp.id, employerName: emp.name, employerHidden: !!emp.hidden });
  }
  return rows.sort((a, b) => b.month.localeCompare(a.month));
}

// Jak `payMonthsSummary`, ale liczy TYLKO po widocznych (nie `hidden`) pracodawcach —
// domyślny widok "łącznie" na nowym ekranie Pracy. Przekaż `includeHidden: true` żeby user
// mógł chwilowo zobaczyć WSZYSTKO (odkryte + ukryte), bez trwałego odkrywania w ustawieniach.
export function employerPayMonthsSummary(
  rows: EmployerPayMonthRow[], opts: { includeHidden?: boolean } = {},
): { avgRate: number | null; includedCount: number; totalEarned: number } {
  return payMonthsSummary(opts.includeHidden ? rows : rows.filter(r => !r.employerHidden));
}

export interface EmployerShift {
  id: string;
  title: string;
  date: string;       // YYYY-MM-DD
  startTime: string;  // HH:mm (from title range, falls back to event's own times)
  endTime: string;
  hours: number;
}

// 2026-09-10, "mini-kalendarz pokazujący jak pracowałem i ile zarobiłem" (user, przy
// dopytywaniu o ekran Pracy) — pojedyncze zmiany danego pracodawcy w danym miesiącu, ten sam
// kształt/wzorzec co `shiftsIn` w settings.tsx (Ustawienia → Praca → "Wyliczona stawka i
// zmiany"), tylko sparametryzowany po `Employer` zamiast globalnego `WorkSettings`, żeby dało
// się pokazać zmiany DOWOLNEGO pracodawcy, nie tylko aktywnego.
export function shiftsForEmployerInMonth(
  events: CalendarEvent[], employer: Pick<Employer, 'workPrefix' | 'workColor'>, ym: string,
): EmployerShift[] {
  const wp = (employer.workPrefix ?? '').trim().toLowerCase();
  const wc = employer.workColor;
  if (!wp && !wc) return [];
  return events
    .filter(e => isWorkEvent(e, { workColor: wc, workPrefix: wp }) && (e.date ?? '').slice(0, 7) === ym)
    .map(e => {
      const r = shiftClockRange(e);
      return {
        id: e.id, title: e.title ?? '', date: (e.date ?? '').slice(0, 10),
        startTime: r?.start ?? e.startTime ?? '', endTime: r?.end ?? e.endTime ?? '',
        hours: shiftHours(e),
      };
    })
    .sort((a, b) => (a.date + a.startTime).localeCompare(b.date + b.startTime));
}
