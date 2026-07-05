import { useState, useEffect, useMemo } from 'react';
import { WorkShift, WorkSettings, CalendarEvent, Expense } from '@/types';
import { shiftMinutes, shiftClockRange, isWorkEvent } from '@/utils/workEvents';
import { paycheckTargetMonth } from '@/utils/paycheck';

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-01`;
}
function timeToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

// A paycheck for the WORK rate = income carrying the work prefix ([JD]) as a tag or
// in the note. This is strict on purpose: the rate divides by JD calendar hours, so a
// generic "salary" income from another source (e.g. a side gig) must NOT count. Only
// when no prefix is configured do we fall back to the salary category.
export function isPaycheck(e: Expense, workPrefix?: string): boolean {
  if (e.type !== 'income') return false;
  const wp = workPrefix?.trim().toLowerCase();
  if (wp) return (e.tags ?? []).some(t => t.toLowerCase() === wp) || (e.note ?? '').toLowerCase().includes(wp);
  return (e.category as string) === 'salary';
}

export interface WorkEarningsResult {
  activeShift:      WorkShift | null;
  activeEventTitle: string | null;
  isWorking:        boolean;
  secondsWorked:    number;
  totalEarned:      number;
  perSecond:        number;
  progressPct:      number;
  shiftDurationMin: number;
  monthWorkHours:   number;
  isColorMode:      boolean;
  salaryUsed:       number; // actual salary (from income entry if tagged, else settings)
}

export function useWorkEarnings(
  shifts: WorkShift[],
  events: CalendarEvent[],
  settings: WorkSettings,
  expenses?: Expense[],
): WorkEarningsResult {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  // ── Salary from income entries tagged with work prefix ───────────────────
  // Returns the most recent [prefix] paycheck amount AND the YYYY-MM month it
  // was received, so the hourly rate can be derived from the hours actually
  // worked in that paycheck's month (not the partial current month).
  const salaryInfo = useMemo(() => {
    const fallback = { amount: settings.monthlySalary, month: null as string | null };
    if (!expenses?.length) return fallback;
    const candidates = expenses.filter(e => isPaycheck(e, settings.workPrefix));
    if (!candidates.length) return fallback;
    candidates.sort((a, b) => b.date.localeCompare(a.date));
    return { amount: candidates[0].amount, month: candidates[0].date.slice(0, 7) };
  }, [expenses, settings.workPrefix, settings.monthlySalary]);

  // Manual salary override wins over the detected last paycheck.
  const salaryUsed = (settings.salaryOverride && settings.salaryOverride > 0)
    ? settings.salaryOverride
    : salaryInfo.amount;

  // ── Color-mode / prefix-mode: derive everything from calendar events ─────
  const colorMode = useMemo(() => {
    if (!settings.workColor && !settings.workPrefix) return null;
    const wc = settings.workColor;
    const wp = settings.workPrefix?.trim().toLowerCase();

    const workEvents = events.filter(e => isWorkEvent(e, { workColor: wc, workPrefix: wp }));

    // Total work hours this month — hours come from the TITLE range when present.
    const monthStart = monthStartStr();
    const monthEvents = workEvents.filter(e => e.date.slice(0, 10) >= monthStart);
    const totalMonthMins = monthEvents.reduce((sum, e) => sum + shiftMinutes(e), 0);
    const monthWorkHours = totalMonthMins / 60;

    // Active event right now (today, current clock time within the shift range).
    const today = todayStr();
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const activeEvent = workEvents.find(e => {
      if (!e.date.startsWith(today)) return false;
      const r = shiftClockRange(e);
      if (!r) return false;
      return timeToMins(r.start) <= nowMins && nowMins <= timeToMins(r.end);
    }) ?? null;

    return { workEvents, monthWorkHours, activeEvent };
  }, [events, settings.workColor, settings.workPrefix, tick]);

  // ── Per-second rate ───────────────────────────────────────────────────────
  // CORRECT rate = last paycheck ÷ hours worked in the paycheck's month.
  // (Dividing by the partial CURRENT-month hours was the bug that inflated the
  // hourly rate — e.g. 4200 zł / 61h so-far = 69 zł/h instead of 4200/168 = 25.)
  const perSecond = useMemo(() => {
    // Manual overrides win: this-month override, then a permanent override.
    const nowYM = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
    const mOver = settings.monthRateOverride?.[nowYM];
    if (mOver && mOver > 0) return mOver / 3600;
    if (settings.rateOverride && settings.rateOverride > 0) return settings.rateOverride / 3600;

    // Paycheck-driven average (most accurate + matches what the user entered):
    // Σ(actual paycheck) ÷ Σ(calendar hours of the month each paycheck is FOR),
    // one paycheck per target month, skipping months the user turned off.
    if (colorMode && expenses?.length) {
      const excluded = new Set(settings.excludedPayMonths ?? []);
      const seen = new Set<string>();
      let totS = 0, totH = 0;
      const paychecks = expenses.filter(e => isPaycheck(e, settings.workPrefix))
        .sort((a, b) => b.date.localeCompare(a.date));
      for (const p of paychecks) {
        const tm = paycheckTargetMonth(p);
        if (seen.has(tm) || excluded.has(tm)) continue;
        seen.add(tm);
        const h = colorMode.workEvents
          .filter(e => e.date.slice(0, 7) === tm)
          .reduce((s, e) => s + shiftMinutes(e), 0) / 60;
        if (h > 0) { totS += p.amount; totH += h; }
      }
      if (totH > 0) return totS / (totH * 3600);
    }

    // Confirmed months win over auto-detection: average rate = Σsalary / Σhours
    // across the months the user personally verified — MINUS any they excluded
    // (e.g. after switching to a fixed employment contract at a different rate).
    const confirmed = Object.values(settings.confirmedMonths ?? {}).filter(m => !m.excluded);
    if (confirmed.length > 0) {
      const totSalary = confirmed.reduce((s, m) => s + (m.salary || 0), 0);
      const totHours = confirmed.reduce((s, m) => s + (m.hours || 0), 0);
      if (totHours > 0) return totSalary / (totHours * 3600);
    }

    // Manual hours override wins over the calendar.
    const hoursOverride = (settings.hoursOverride && settings.hoursOverride > 0) ? settings.hoursOverride : 0;

    if (colorMode && (salaryInfo.month || hoursOverride)) {
      const hoursForMonth = (ym: string) => colorMode.workEvents
        .filter(e => e.date.slice(0, 7) === ym)
        .reduce((s, e) => s + shiftMinutes(e), 0) / 60;
      // Salaries are paid in arrears: a paycheck dated month M is FOR month M-1.
      // So the hours basis = the month BEFORE the paycheck's date; with no
      // paycheck, the previous completed month (current is partial).
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
      const monthBefore = (ym: string) => { const [y, m] = ym.split('-').map(Number); const d = new Date(y, m - 2, 1); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`; };
      const basisMonth = salaryInfo.month ? monthBefore(salaryInfo.month) : prevMonth;
      const hours = hoursOverride || hoursForMonth(basisMonth) || hoursForMonth(prevMonth) || settings.hoursPerMonth;
      return hours > 0 ? salaryUsed / (hours * 3600) : 0;
    }
    // No tagged paycheck → salary ÷ hours. Hours DEFAULT to the LAST COMPLETED
    // month's calendar hours (full data); fall back to the manual hoursPerMonth.
    let hours = settings.hoursPerMonth;
    if (colorMode) {
      const now = new Date();
      const prev = new Date(now.getFullYear(), now.getMonth() - 1, 1);
      const prevMonth = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
      const prevHours = colorMode.workEvents
        .filter(e => e.date.slice(0, 7) === prevMonth)
        .reduce((s, e) => s + shiftMinutes(e), 0) / 60;
      if (prevHours > 0) hours = prevHours;
      else if (colorMode.monthWorkHours > 0) hours = colorMode.monthWorkHours;
    }
    return hours > 0 ? salaryUsed / (hours * 3600) : 0;
  }, [colorMode, salaryInfo, settings.hoursPerMonth, settings.hoursOverride, settings.rateOverride, settings.monthRateOverride, settings.confirmedMonths, settings.excludedPayMonths, settings.workPrefix, expenses, salaryUsed]);

  // ── Manual-shift active detection (fallback when no workColor) ────────────
  const activeShift = useMemo(() => {
    if (settings.workColor || settings.workPrefix) return null; // color/prefix-mode overrides manual shifts
    const today = todayStr();
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return shifts.find(s => {
      if (s.date !== today) return false;
      const start = timeToMins(s.startTime);
      const end   = timeToMins(s.endTime);
      return nowMins >= start && nowMins <= end;
    }) ?? null;
  }, [shifts, settings.workColor, tick]);

  // ── Compose result ────────────────────────────────────────────────────────
  return useMemo(() => {
    const empty: WorkEarningsResult = {
      activeShift: null, activeEventTitle: null,
      isWorking: false, secondsWorked: 0,
      totalEarned: 0, perSecond, progressPct: 0,
      shiftDurationMin: 0, monthWorkHours: colorMode?.monthWorkHours ?? 0,
      isColorMode: !!(settings.workColor || settings.workPrefix),
      salaryUsed,
    };

    if (colorMode) {
      const ae = colorMode.activeEvent;
      if (!ae) return empty;
      const now = new Date();
      const range       = shiftClockRange(ae);
      const startMins   = range ? timeToMins(range.start) : 0;
      const endMins     = range ? timeToMins(range.end) : 0;
      const nowMins     = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
      const shiftDurMin = endMins - startMins;
      const workedMins  = Math.max(0, Math.min(nowMins - startMins, shiftDurMin));
      const secondsWorked = workedMins * 60;
      return {
        activeShift: null,
        activeEventTitle: ae.title,
        isWorking: true,
        secondsWorked,
        totalEarned: secondsWorked * perSecond,
        perSecond,
        progressPct: Math.min(shiftDurMin > 0 ? workedMins / shiftDurMin : 0, 1),
        shiftDurationMin: shiftDurMin,
        monthWorkHours: colorMode.monthWorkHours,
        isColorMode: !!(settings.workColor || settings.workPrefix),
        salaryUsed,
      };
    }

    if (!activeShift) return empty;
    const now          = new Date();
    const startMins    = timeToMins(activeShift.startTime);
    const endMins      = timeToMins(activeShift.endTime);
    const nowMins      = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const shiftDurMin  = endMins - startMins;
    const workedMins   = Math.max(0, Math.min(nowMins - startMins, shiftDurMin));
    const secondsWorked = workedMins * 60;
    return {
      activeShift,
      activeEventTitle: null,
      isWorking: true,
      secondsWorked,
      totalEarned: secondsWorked * perSecond,
      perSecond,
      progressPct: Math.min(shiftDurMin > 0 ? workedMins / shiftDurMin : 0, 1),
      shiftDurationMin: shiftDurMin,
      monthWorkHours: 0,
      isColorMode: false,
      salaryUsed,
    };
  }, [colorMode, activeShift, tick, perSecond, settings.workColor]);
}
