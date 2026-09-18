import { bucketByDay, bucketByHour, oldestEventDate, periodCounts, screenTrends, screenTransitions, bouncePairs } from '@/utils/usageStatsAnalysis';
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

// 2026-09-18, user: "nie ma otwiarc dzisiaj łącznie, w tym tygodniu i miesiącu łącznie, i
// Porównań otwarc" — `now` = piątek 2026-09-18, tydzień startuje w poniedziałek (2026-09-14).
describe('usageStatsAnalysis — periodCounts', () => {
  const now = new Date('2026-09-18T18:00:00');
  const events: ScreenOpenEvent[] = [
    { screenId: '/', at: at('2026-09-18T10:00:00') },   // dziś
    { screenId: '/', at: at('2026-09-17T10:00:00') },   // wczoraj
    { screenId: '/', at: at('2026-09-16T10:00:00') },   // ten tydzień (śr, nie dziś/wczoraj)
    { screenId: '/', at: at('2026-09-10T10:00:00') },   // zeszły tydzień (czw, przed pon 14)
    { screenId: '/', at: at('2026-08-15T10:00:00') },   // zeszły miesiąc
  ];

  test('liczy każdy okres niezależnie (dzień/wczoraj/tydzień/zeszły tydzień/miesiąc/zeszły miesiąc)', () => {
    expect(periodCounts(events, now)).toEqual({
      today: 1, yesterday: 1, thisWeek: 3, lastWeek: 1, thisMonth: 4, lastMonth: 1,
    });
  });

  test('pusty log → same zera', () => {
    expect(periodCounts([], now)).toEqual({ today: 0, yesterday: 0, thisWeek: 0, lastWeek: 0, thisMonth: 0, lastMonth: 0 });
  });
});

describe('usageStatsAnalysis — screenTrends (porównanie ekranów: ten tydzień vs zeszły)', () => {
  const now = new Date('2026-09-18T18:00:00');

  test('rosnące i spadające ekrany, sortowane po |delta|', () => {
    const events: ScreenOpenEvent[] = [
      // /tasks: 1 w zeszłym tygodniu → 5 w tym (wzrost +4)
      ...Array.from({ length: 5 }, () => ({ screenId: '/tasks', at: at('2026-09-15T10:00:00') })),
      { screenId: '/tasks', at: at('2026-09-10T10:00:00') },
      // /notes: 5 w zeszłym tygodniu → 1 w tym (spadek -4)
      { screenId: '/notes', at: at('2026-09-15T10:00:00') },
      ...Array.from({ length: 5 }, () => ({ screenId: '/notes', at: at('2026-09-10T10:00:00') })),
      // /mood: stabilne 2 → 2 (delta 0)
      ...Array.from({ length: 2 }, () => ({ screenId: '/mood', at: at('2026-09-15T10:00:00') })),
      ...Array.from({ length: 2 }, () => ({ screenId: '/mood', at: at('2026-09-10T10:00:00') })),
    ];
    const trends = screenTrends(events, now);
    expect(trends[0].screenId).toBe('/tasks');
    expect(trends[0]).toEqual({ screenId: '/tasks', current: 5, previous: 1, delta: 4 });
    expect(trends[1]).toEqual({ screenId: '/notes', current: 1, previous: 5, delta: -4 });
    const moodTrend = trends.find(t => t.screenId === '/mood')!;
    expect(moodTrend.delta).toBe(0);
  });
});

describe('usageStatsAnalysis — screenTransitions ("jakie ekrany po sobie")', () => {
  test('liczy KOLEJNE otwarcia w oknie czasowym, ignoruje przerwy i powrót na ten sam ekran', () => {
    const events: ScreenOpenEvent[] = [
      { screenId: '/', at: at('2026-09-18T10:00:00') },
      { screenId: '/tasks', at: at('2026-09-18T10:01:00') },      // / → /tasks (1 min — liczy się)
      { screenId: '/tasks', at: at('2026-09-18T10:01:30') },      // /tasks → /tasks — POMIJANE (ten sam ekran)
      { screenId: '/finances', at: at('2026-09-18T12:00:00') },   // /tasks → /finances (2h — POZA oknem 30 min)
      { screenId: '/', at: at('2026-09-18T12:01:00') },           // /finances → / (1 min — liczy się)
    ];
    const t = screenTransitions(events, 30 * 60 * 1000);
    expect(t).toEqual(expect.arrayContaining([
      { from: '/', to: '/tasks', count: 1 },
      { from: '/finances', to: '/', count: 1 },
    ]));
    expect(t.some(x => x.from === '/tasks' && x.to === '/finances')).toBe(false);
    expect(t.some(x => x.from === '/tasks' && x.to === '/tasks')).toBe(false);
  });

  test('nie zakłada że events są już posortowane chronologicznie wejściowo', () => {
    const events: ScreenOpenEvent[] = [
      { screenId: '/tasks', at: at('2026-09-18T10:01:00') },
      { screenId: '/', at: at('2026-09-18T10:00:00') },
    ];
    expect(screenTransitions(events)).toEqual([{ from: '/', to: '/tasks', count: 1 }]);
  });
});

describe('usageStatsAnalysis — bouncePairs ("czy się jakieś ekrany zacinają pomiędzy sobą")', () => {
  test('para z częstym ruchem w OBIE strony jest zgłoszona, jednostronna ścieżka nie', () => {
    const transitions = [
      { from: '/tasks', to: '/notes', count: 5 },
      { from: '/notes', to: '/tasks', count: 4 },
      { from: '/', to: '/settings', count: 10 }, // jednostronne — brak odwrotu wcale
    ];
    const pairs = bouncePairs(transitions, 3);
    expect(pairs).toEqual([{ a: '/tasks', b: '/notes', aToB: 5, bToA: 4, total: 9 }]);
  });

  test('minEach odsiewa jednorazowe/rzadkie odbicia', () => {
    const transitions = [
      { from: '/a', to: '/b', count: 2 },
      { from: '/b', to: '/a', count: 2 },
    ];
    expect(bouncePairs(transitions, 3)).toEqual([]);
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
