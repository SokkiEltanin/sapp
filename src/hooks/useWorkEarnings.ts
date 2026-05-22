import { useState, useEffect, useMemo } from 'react';
import { WorkShift, WorkSettings, CalendarEvent } from '@/types';

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
  activeEventTitle: string | null; // event title when color-mode is active
  isWorking:        boolean;
  secondsWorked:    number;
  totalEarned:      number;
  perSecond:        number;
  progressPct:      number;
  shiftDurationMin: number;
  monthWorkHours:   number; // total hours from work-colored events this month
  isColorMode:      boolean; // true when tracking via calendar event color
}

export function useWorkEarnings(
  shifts: WorkShift[],
  events: CalendarEvent[],
  settings: WorkSettings,
): WorkEarningsResult {
  const [tick, setTick] = useState(0);

  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

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
  const perSecond = useMemo(() => {
    if (colorMode) {
      const hours = colorMode.monthWorkHours > 0 ? colorMode.monthWorkHours : settings.hoursPerMonth;
      return hours > 0 ? settings.monthlySalary / (hours * 3600) : 0;
    }
    return settings.monthlySalary / (settings.hoursPerMonth * 3600);
  }, [colorMode, settings]);

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
    };
  }, [colorMode, activeShift, tick, perSecond, settings.workColor]);
}
