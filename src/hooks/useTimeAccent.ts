import { useMemo } from 'react';

export type TimeOfDay = 'dawn' | 'morning' | 'afternoon' | 'evening' | 'night';

const ACCENTS: Record<TimeOfDay, { color: string; greeting: string }> = {
  dawn:      { color: '#F59E0B', greeting: 'Świt' },
  morning:   { color: '#38BDF8', greeting: 'Dzień dobry' },
  afternoon: { color: '#818CF8', greeting: 'Cześć' },
  evening:   { color: '#FB923C', greeting: 'Dobry wieczór' },
  night:     { color: '#A78BFA', greeting: 'Dobranoc' },
};

function timeOfDay(h: number): TimeOfDay {
  if (h >= 5  && h < 8)  return 'dawn';
  if (h >= 8  && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

export function useTimeAccent() {
  return useMemo(() => {
    const tod = timeOfDay(new Date().getHours());
    return { ...ACCENTS[tod], timeOfDay: tod };
  }, []);
}
