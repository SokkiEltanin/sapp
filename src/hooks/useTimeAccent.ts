import { useMemo } from 'react';
import { getSunTimes } from '@/utils/sunTimes';

export type TimeOfDay = 'night' | 'dawn' | 'morning' | 'afternoon' | 'evening';

interface TimeAccent {
  color: string;
  greeting: string;
  gradientTop: string;
  cardBg: string;
  cardBgDark: string;
  timeOfDay: TimeOfDay;
}

// AKCENT = MONO (czarno-biały) — user: „akcent apki czarno-biały, kolory tylko dodatki".
// `color` (emfaza: ikony/paski/wykresy/liczby) = near-white na ciemnym. Hero wash
// (gradientTop/cardBg) = neutralny dark (bez niebieskiego) dla clean look. Greeting time-based.
// Skiny WYŁĄCZONE — user chce jeden dopieszczony mono default (bez kolorowych stylów).
// Kalendarz ma swoje kolory osobno.
const MONO = '#ECEEEE';
const HERO_TOP = '#0B0D0F', HERO_CARD = '#20242A', HERO_CARD_DARK = '#171B20';
const ACCENTS: Record<TimeOfDay, Omit<TimeAccent, 'timeOfDay'>> = {
  night:     { color: MONO, greeting: 'Dobranoc',      gradientTop: HERO_TOP, cardBg: HERO_CARD, cardBgDark: HERO_CARD_DARK },
  dawn:      { color: MONO, greeting: 'Dzień dobry',   gradientTop: HERO_TOP, cardBg: HERO_CARD, cardBgDark: HERO_CARD_DARK },
  morning:   { color: MONO, greeting: 'Dzień dobry',   gradientTop: HERO_TOP, cardBg: HERO_CARD, cardBgDark: HERO_CARD_DARK },
  afternoon: { color: MONO, greeting: 'Dzień dobry',   gradientTop: HERO_TOP, cardBg: HERO_CARD, cardBgDark: HERO_CARD_DARK },
  evening:   { color: MONO, greeting: 'Dobry wieczór', gradientTop: HERO_TOP, cardBg: HERO_CARD, cardBgDark: HERO_CARD_DARK },
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
  // Key changes every 30 min and whenever sun times update → theme re-evaluates.
  const key = `${Math.floor(nowH * 2)}-${sun?.sunrise ?? ''}-${sun?.sunset ?? ''}`;
  return useMemo(() => {
    const tod = sun
      ? timeOfDayBySun(nowH, sun.sunrise, sun.sunset)
      : timeOfDayByHour(now.getHours());
    return { ...ACCENTS[tod], timeOfDay: tod };
  }, [key]); // eslint-disable-line react-hooks/exhaustive-deps
}
