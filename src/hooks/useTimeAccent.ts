import { useMemo } from 'react';

export type TimeOfDay = 'night' | 'dawn' | 'morning' | 'afternoon' | 'evening';

interface TimeAccent {
  color: string;
  greeting: string;
  gradientTop: string;
  cardBg: string;
  cardBgDark: string;
  timeOfDay: TimeOfDay;
}

const ACCENTS: Record<TimeOfDay, Omit<TimeAccent, 'timeOfDay'>> = {
  night:     { color: '#5B7BE3', greeting: 'Dobranoc',   gradientTop: '#0B0E1A', cardBg: '#282F44', cardBgDark: '#1E2333' },
  dawn:      { color: '#5B7BE3', greeting: 'Dobranoc',   gradientTop: '#0B0E1A', cardBg: '#282F44', cardBgDark: '#1E2333' },
  morning:   { color: '#46B0DE', greeting: 'Dzień dobry', gradientTop: '#091820', cardBg: '#1B3947', cardBgDark: '#132A34' },
  afternoon: { color: '#46B0DE', greeting: 'Dzień dobry', gradientTop: '#091820', cardBg: '#1B3947', cardBgDark: '#132A34' },
  evening:   { color: '#5B7BE3', greeting: 'Dobranoc',   gradientTop: '#0B0E1A', cardBg: '#282F44', cardBgDark: '#1E2333' },
};

function timeOfDay(h: number): TimeOfDay {
  if (h >= 5  && h < 8)  return 'dawn';
  if (h >= 8  && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

export function useTimeAccent(): TimeAccent {
  return useMemo(() => {
    const tod = timeOfDay(new Date().getHours());
    return { ...ACCENTS[tod], timeOfDay: tod };
  }, []);
}
