import { useState, useEffect, useMemo } from 'react';
import { WorkShift, WorkSettings } from '@/types';

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function timeToMins(hhmm: string): number {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
}

export interface WorkEarningsResult {
  activeShift:      WorkShift | null;
  isWorking:        boolean;
  secondsWorked:    number;   // seconds from shift start to now
  totalEarned:      number;   // PLN
  perSecond:        number;   // PLN/s
  progressPct:      number;   // 0..1 through the shift
  shiftDurationMin: number;
}

export function useWorkEarnings(shifts: WorkShift[], settings: WorkSettings): WorkEarningsResult {
  const [tick, setTick] = useState(0);

  const perSecond = useMemo(
    () => settings.monthlySalary / (settings.hoursPerMonth * 3600),
    [settings.monthlySalary, settings.hoursPerMonth],
  );

  // Find today's active shift (current time is within start..end)
  const activeShift = useMemo(() => {
    const today = todayStr();
    const now   = new Date();
    const nowMins = now.getHours() * 60 + now.getMinutes();
    return shifts.find(s => {
      if (s.date !== today) return false;
      const start = timeToMins(s.startTime);
      const end   = timeToMins(s.endTime);
      return nowMins >= start && nowMins <= end;
    }) ?? null;
  }, [shifts, tick]);

  // Tick every second when working
  useEffect(() => {
    const id = setInterval(() => setTick(t => t + 1), 1000);
    return () => clearInterval(id);
  }, []);

  return useMemo(() => {
    if (!activeShift) {
      return { activeShift: null, isWorking: false, secondsWorked: 0, totalEarned: 0, perSecond, progressPct: 0, shiftDurationMin: 0 };
    }

    const now          = new Date();
    const startMins    = timeToMins(activeShift.startTime);
    const endMins      = timeToMins(activeShift.endTime);
    const nowMins      = now.getHours() * 60 + now.getMinutes() + now.getSeconds() / 60;
    const shiftDurMin  = endMins - startMins;
    const workedMins   = Math.max(0, Math.min(nowMins - startMins, shiftDurMin));
    const secondsWorked = workedMins * 60;
    const earned        = secondsWorked * perSecond;
    const progressPct   = shiftDurMin > 0 ? workedMins / shiftDurMin : 0;

    return {
      activeShift,
      isWorking: true,
      secondsWorked,
      totalEarned: earned,
      perSecond,
      progressPct: Math.min(progressPct, 1),
      shiftDurationMin: shiftDurMin,
    };
  }, [activeShift, tick, perSecond]);
}
