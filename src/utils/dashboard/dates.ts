import { ymd } from '@/utils/date';
import { MoodEntry, MoodLevel } from '@/types';

// Date/week helpery dashboardu — wyniesione z app/(tabs)/index.tsx (krok 1). Czyste,
// lokalny dzień przez ymd() (patrz date_local_iso).

export const MONTH_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];

// 7 dni tygodnia (pon–niedz) z przesunięciem w tygodniach; lokalne YYYY-MM-DD.
export function getWeekDates(offset: number): string[] {
  const today = new Date();
  const dow = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const mon = new Date(today);
  mon.setDate(today.getDate() - dow + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon); d.setDate(mon.getDate() + i); return ymd(d);
  });
}

// Etykieta zakresu tygodnia, np. „4–10 Sie" / „30 Lip – 5 Sie".
export function weekLabel(dates: string[]): string {
  const from = new Date(dates[0]), to = new Date(dates[6]);
  const fM = MONTH_SHORT[from.getMonth()], tM = MONTH_SHORT[to.getMonth()];
  return from.getMonth() === to.getMonth()
    ? `${from.getDate()}–${to.getDate()} ${fM}`
    : `${from.getDate()} ${fM} – ${to.getDate()} ${tM}`;
}

// Średni nastrój/energia z wpisów jednego dnia (null gdy brak wpisów).
export function dayAvg(entries: MoodEntry[]): { mood: MoodLevel; energy: MoodLevel } | null {
  if (!entries.length) return null;
  return {
    mood: entries.reduce((a, b) => a + b.mood, 0) / entries.length as MoodLevel,
    energy: entries.reduce((a, b) => a + b.energy, 0) / entries.length as MoodLevel,
  };
}
