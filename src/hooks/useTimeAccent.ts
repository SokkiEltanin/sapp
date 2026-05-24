import { useMemo } from 'react';
import { colors } from '@/theme';

export type TimeOfDay = 'night' | 'dawn' | 'morning' | 'afternoon' | 'evening';

const ACCENTS: Record<TimeOfDay, { color: string; greeting: string; gradientTop: string }> = {
  night:     { color: colors.tabs.calendar,  greeting: 'Dobranoc',     gradientTop: colors.timeGradient.night },
  dawn:      { color: colors.accent.amber,   greeting: 'Świt',         gradientTop: colors.timeGradient.dawn },
  morning:   { color: colors.tabs.tasks,     greeting: 'Dzień dobry',  gradientTop: colors.timeGradient.morning },
  afternoon: { color: colors.tabs.calendar,  greeting: 'Cześć',        gradientTop: colors.timeGradient.afternoon },
  evening:   { color: colors.accent.orange,  greeting: 'Dobry wieczór', gradientTop: colors.timeGradient.evening },
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
