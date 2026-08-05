import { buildRecords } from '@/utils/personalRecords';
import { MoodEntry } from '@/types';

const mood = (date: string, m: number): MoodEntry => ({ date, mood: m, energy: m } as any);

describe('personalRecords — buildRecords', () => {
  test('kroki/sen/waga — wartości + lowerIsBetter', () => {
    const recs = buildRecords({
      '2026-08-01': { steps: 12000, sleepMinutes: 430, weightKg: 72 },
      '2026-08-02': { steps: 8000, sleepMinutes: 500, weightKg: 71.2 },
    }, [], []);
    const byKey = Object.fromEntries(recs.map(r => [r.key, r]));
    expect(byKey.steps.num).toBe(12000);
    expect(byKey.sleep.num).toBe(500);
    expect(byKey.sleep.value).toBe('8h 20m');
    expect(byKey.weight.num).toBe(71.2);
    expect(byKey.weight.lowerIsBetter).toBe(true);
  });

  test('waga wymaga ≥2 odczytów', () => {
    const recs = buildRecords({ '2026-08-01': { steps: 0, sleepMinutes: 0, weightKg: 70 } }, [], []);
    expect(recs.find(r => r.key === 'weight')).toBeUndefined();
  });

  test('najlepszy tydzień nastroju (≥4 dni)', () => {
    const entries = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'].map(d => mood(d, 5));
    const r = buildRecords({}, [], entries).find(x => x.key === 'mood');
    expect(r?.num).toBeCloseTo(5);
    expect(r?.value).toBe('5.0/5');
  });

  test('<4 dni nastroju → brak rekordu nastroju', () => {
    const entries = ['2026-08-01', '2026-08-02', '2026-08-03'].map(d => mood(d, 5));
    expect(buildRecords({}, [], entries).find(r => r.key === 'mood')).toBeUndefined();
  });

  test('puste dane → brak rekordów', () => {
    expect(buildRecords({}, [], [])).toEqual([]);
  });
});
