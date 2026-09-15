import { bucketByDay, bucketByHour, oldestEventDate } from '@/utils/usageStatsAnalysis';
import { ScreenOpenEvent } from '@/store/usageStatsStore';

const at = (iso: string): number => new Date(iso).getTime();

describe('usageStatsAnalysis — bucketByDay', () => {
  const now = new Date('2026-09-15T18:00:00');

  test('pusty log → same zera, dziś oznaczone', () => {
    const buckets = bucketByDay([], 3, now);
    expect(buckets).toEqual([
      { dateStr: '2026-09-13', count: 0, isToday: false },
      { dateStr: '2026-09-14', count: 0, isToday: false },
      { dateStr: '2026-09-15', count: 0, isToday: true },
    ]);
  });

  test('liczy zdarzenia per dzień, dziury zostają zerami (nie są pomijane)', () => {
    const events: ScreenOpenEvent[] = [
      { screenId: '/', at: at('2026-09-13T09:00:00') },
      { screenId: '/tasks', at: at('2026-09-13T09:05:00') },
      { screenId: '/', at: at('2026-09-15T08:00:00') },
    ];
    const buckets = bucketByDay(events, 3, now);
    expect(buckets.map(b => b.count)).toEqual([2, 0, 1]);
  });

  test('zdarzenia poza oknem `days` nie są liczone', () => {
    const events: ScreenOpenEvent[] = [{ screenId: '/', at: at('2026-09-01T09:00:00') }];
    const buckets = bucketByDay(events, 3, now);
    expect(buckets.every(b => b.count === 0)).toBe(true);
  });
});

describe('usageStatsAnalysis — bucketByHour', () => {
  test('24 kubełki, liczy wg lokalnej godziny', () => {
    const events: ScreenOpenEvent[] = [
      { screenId: '/', at: new Date('2026-09-15T08:15:00').getTime() },
      { screenId: '/tasks', at: new Date('2026-09-15T08:45:00').getTime() },
      { screenId: '/', at: new Date('2026-09-15T21:00:00').getTime() },
    ];
    const buckets = bucketByHour(events);
    expect(buckets).toHaveLength(24);
    expect(buckets[8].count).toBe(2);
    expect(buckets[21].count).toBe(1);
    expect(buckets[0].count).toBe(0);
  });
});

describe('usageStatsAnalysis — oldestEventDate', () => {
  test('pusty log → null', () => {
    expect(oldestEventDate([])).toBeNull();
  });

  test('zwraca najstarsze zdarzenie niezależnie od kolejności w tablicy', () => {
    const events: ScreenOpenEvent[] = [
      { screenId: '/', at: at('2026-09-10T09:00:00') },
      { screenId: '/', at: at('2026-08-01T09:00:00') },
      { screenId: '/', at: at('2026-09-12T09:00:00') },
    ];
    expect(oldestEventDate(events)?.getTime()).toBe(at('2026-08-01T09:00:00'));
  });
});
