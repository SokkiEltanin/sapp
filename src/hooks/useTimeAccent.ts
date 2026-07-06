import { useMemo } from 'react';
import { getSunTimes } from '@/utils/sunTimes';
import { useSkinStore } from '@/store/skinStore';
import { skinById } from '@/theme/skins';

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
  night:     { color: '#5B7BE3', greeting: 'Dobranoc',      gradientTop: '#0B0E1A', cardBg: '#282F44', cardBgDark: '#1E2333' },
  dawn:      { color: '#5B7BE3', greeting: 'Dzień dobry',   gradientTop: '#0B0E1A', cardBg: '#282F44', cardBgDark: '#1E2333' },
  morning:   { color: '#46B0DE', greeting: 'Dzień dobry',   gradientTop: '#091820', cardBg: '#1B3947', cardBgDark: '#132A34' },
  afternoon: { color: '#46B0DE', greeting: 'Dzień dobry',   gradientTop: '#091820', cardBg: '#1B3947', cardBgDark: '#132A34' },
  evening:   { color: '#5B7BE3', greeting: 'Dobry wieczór', gradientTop: '#0B0E1A', cardBg: '#282F44', cardBgDark: '#1E2333' },
};

// Fixed-hour fallback when real sun times aren't known yet.
function timeOfDayByHour(h: number): TimeOfDay {
  if (h >= 5  && h < 8)  return 'dawn';
  if (h >= 8  && h < 12) return 'morning';
  if (h >= 12 && h < 18) return 'afternoon';
  if (h >= 18 && h < 22) return 'evening';
  return 'night';
}

// Real sunrise/sunset-driven theme: DAY (light blue) while the sun is up,
// NIGHT (dark blue) while it's down, with a ~1h dawn/evening transition band.
function timeOfDayBySun(nowH: number, sunrise: number, sunset: number): TimeOfDay {
  if (nowH < sunrise - 0.5 || nowH >= sunset + 0.5) return 'night';
  if (nowH < sunrise + 1)  return 'dawn';     // just after sunrise — still bluish
  if (nowH >= sunset - 1)  return 'evening';  // approaching sunset — bluish
  return nowH < 13 ? 'morning' : 'afternoon';
}

export function useTimeAccent(): TimeAccent {
  const now = new Date();
  const nowH = now.getHours() + now.getMinutes() / 60;
  const sun = getSunTimes();
  const activeSkin = useSkinStore((s) => s.active);
  // Key changes every 30 min and whenever sun times / skin update → theme re-evaluates.
  const key = `${Math.floor(nowH * 2)}-${sun?.sunrise ?? ''}-${sun?.sunset ?? ''}-${activeSkin}`;
  return useMemo(() => {
    const tod = sun
      ? timeOfDayBySun(nowH, sun.sunrise, sun.sunset)
      : timeOfDayByHour(now.getHours());
    const base = { ...ACCENTS[tod], timeOfDay: tod };
    // An equipped skin overrides the colours but keeps the time-based greeting.
    const skin = activeSkin !== 'auto' ? skinById(activeSkin) : undefined;
    return skin?.colors ? { ...base, ...skin.colors } : base;
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
