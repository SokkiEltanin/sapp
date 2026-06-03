import { useState, useEffect, useMemo } from 'react';
import { WorkShift, WorkSettings, CalendarEvent, Expense } from '@/types';

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
    if (!expenses?.length || !settings.workPrefix?.trim()) return fallback;
    const wp = settings.workPrefix.trim().toLowerCase();
    // A paycheck = income carrying the [JD] prefix, whether as a tag OR in the note.
    const candidates = expenses.filter(e =>
      e.type === 'income' && (
        e.tags.some(t => t.toLowerCase() === wp) ||
        (e.note ?? '').toLowerCase().includes(wp)
      )
    );
    if (!candidates.length) return fallback;
    candidates.sort((a, b) => b.date.localeCompare(a.date));
    return { amount: candidates[0].amount, month: candidates[0].date.slice(0, 7) };
  }, [expenses, settings.workPrefix, settings.monthlySalary]);

  const salaryUsed = salaryInfo.amount;

  // ── Color-mode / prefix-mode: derive everything from calendar events ─────
  const colorMode = useMemo(() => {
    if (!settings.workColor && !settings.workPrefix) return null;
    const wc = settings.workColor;
    const wp = settings.workPrefix?.trim().toLowerCase();

    const isWorkEvent = (e: CalendarEvent) => {
      if (!e.startTime || !e.endTime) return false;
      if (wc && e.color === wc) return true;
      if (wp && e.title.toLowerCase().startsWith(wp)) return true;
      return false;
    };

    const workEvents = events.filter(isWorkEvent);

    // Total work hours this month
    const monthStart = monthStartStr();
    const monthEvents = workEvents.filter(e => e.date.slice(0, 10) >= monthStart);
    const totalMonthMins = monthEvents.reduce((sum, e) => {
      return sum + Math.max(0, timeToMins(e.endTime!) - timeToMins(e.startTime!));
    }, 0);
    const monthWorkHours = totalMonthMins / 60;

    // Active event right now (today, current time within event)
    const today = todayStr();
    const now = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    const activeEvent = workEvents.find(e =>
      e.date.startsWith(today) &&
      timeToMins(e.startTime!) <= nowMins &&
      nowMins <= timeToMins(e.endTime!)
    ) ?? null;

    return { workEvents, monthWorkHours, activeEvent };
  }, [events, settings.workColor, settings.workPrefix, tick]);

  // ── Per-second rate ───────────────────────────────────────────────────────
  // CORRECT rate = last paycheck ÷ hours worked in the paycheck's month.
  // (Dividing by the partial CURRENT-month hours was the bug that inflated the
  // hourly rate — e.g. 4200 zł / 61h so-far = 69 zł/h instead of 4200/168 = 25.)
  const perSecond = useMemo(() => {
    if (colorMode && salaryInfo.month) {
      const hoursForMonth = (ym: string) => colorMode.workEvents
        .filter(e => e.date.slice(0, 7) === ym)
        .reduce((s, e) => s + Math.max(0, timeToMins(e.endTime!) - timeToMins(e.startTime!)), 0) / 60;
      // Paycheck month, then the previous month (salaries are often paid in
      // arrears), then the user's configured hoursPerMonth as a safe fallback.
      const [py, pm] = salaryInfo.month.split('-').map(Number);
      const prev = new Date(py, pm - 2, 1);
      const prevMonth = `${prev.getFullYear()}-${pad(prev.getMonth() + 1)}`;
      const hours = hoursForMonth(salaryInfo.month) || hoursForMonth(prevMonth) || settings.hoursPerMonth;
      return hours > 0 ? salaryUsed / (hours * 3600) : 0;
    }
    // No tagged paycheck → straightforward monthlySalary / hoursPerMonth (both
    // editable in Settings so the user can correct a wrong rate).
    return settings.hoursPerMonth > 0 ? salaryUsed / (settings.hoursPerMonth * 3600) : 0;
  }, [colorMode, salaryInfo, settings.hoursPerMonth, salaryUsed]);

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
      const startMins   = timeToMins(ae.startTime!);
      const endMins     = timeToMins(ae.endTime!);
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
