import { getWeekDates, weekLabel, dayAvg } from '@/utils/dashboard/dates';
import { MoodEntry } from '@/types';

const m = (mood: number, energy: number): MoodEntry => ({ mood, energy } as any);

describe('dashboard/dates', () => {
  test('getWeekDates: 7 kolejnych dni, poniedziałek pierwszy', () => {
    const w = getWeekDates(0);
    expect(w).toHaveLength(7);
    expect(new Date(w[0] + 'T12:00:00').getDay()).toBe(1); // poniedziałek
    for (let i = 1; i < 7; i++) {
      const prev = new Date(w[i - 1] + 'T12:00:00').getTime();
      const cur = new Date(w[i] + 'T12:00:00').getTime();
      expect(Math.round((cur - prev) / (24 * 3600 * 1000))).toBe(1);
    }
  });

  test('getWeekDates(-1) to dokładnie tydzień wcześniej', () => {
    const cur = getWeekDates(0), prev = getWeekDates(-1);
    const diff = (new Date(cur[0] + 'T12:00:00').getTime() - new Date(prev[0] + 'T12:00:00').getTime()) / (24 * 3600 * 1000);
    expect(Math.round(diff)).toBe(7);
  });

  test('weekLabel: ten sam miesiąc vs przełom miesiąca', () => {
    expect(weekLabel(['2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07', '2026-08-08', '2026-08-09', '2026-08-10']))
      .toBe('4–10 Sie');
    expect(weekLabel(['2026-07-30', '2026-07-31', '2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05']))
      .toBe('30 Lip – 5 Sie');
  });

  test('dayAvg: średnia nastroju/energii + null gdy brak', () => {
    expect(dayAvg([])).toBeNull();
    expect(dayAvg([m(4, 3), m(2, 5)])).toEqual({ mood: 3, energy: 4 });
  });
});
