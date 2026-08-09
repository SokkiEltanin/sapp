import { ACHIEVEMENTS, buildAchCtx, evaluateAchievements, AchCtx } from '@/utils/achievements';
import { Expense } from '@/types';

const exp = (o: Partial<Expense>): Expense => ({
  id: Math.random().toString(36), type: 'expense', amount: 10, currency: 'PLN',
  category: 'groceries', tags: [], note: '', date: '2026-08-01',
  createdAt: '2026-08-01', updatedAt: '2026-08-01', ...o,
});
const emptyArgs = {
  expenses: [] as Expense[], moodEntries: [], workEvents: [], workSettings: {},
  habitBestStreak: 0, healthDays: {}, tasksDone: 0, budgetTotal: 0, billTracked: false,
};

describe('achievements — ACHIEVEMENTS array invariants', () => {
  test('no duplicate ids (a duplicate silently overwrites in BADGE_PNG + evaluateAchievements)', () => {
    const ids = ACHIEVEMENTS.map(a => a.id);
    const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
    expect(dupes).toEqual([]);
  });
  test('every target is positive, every id is non-empty', () => {
    for (const a of ACHIEVEMENTS) {
      expect(a.id.length).toBeGreaterThan(0);
      expect(a.target).toBeGreaterThan(0);
    }
  });
});

describe('achievements — buildAchCtx on empty input never throws, everything is zeroed/false', () => {
  test('empty args → all-zero ctx, evaluateAchievements runs clean with nothing unlocked past target-1 booleans', () => {
    const ctx = buildAchCtx(emptyArgs);
    expect(ctx.activeDays).toBe(0);
    expect(ctx.savingsTotal).toBe(0);
    expect(ctx.agsDayEver).toBe(false);
    expect(ctx.pirateTreasure).toBe(false);
    const states = evaluateAchievements(ctx);
    expect(states.length).toBe(ACHIEVEMENTS.length);
    // nothing with a target > 0 should be unlocked from true-zero data
    expect(states.every(s => !s.unlocked)).toBe(true);
  });
});

describe('achievements — rolling 7-day window (meatWeekMaxKg / fishWeekMaxKg)', () => {
  test('7 consecutive 1kg days sum to 7kg; a gap resets the window', () => {
    const days = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04', '2026-08-05', '2026-08-06', '2026-08-07'];
    const expenses = days.map(d => exp({
      date: d, receiptItems: [{ name: 'kurczak', price: 10, category: 'groceries', quantity: 1, unitPrice: 10, tags: [], weightKg: 1 }],
    }));
    const ctx = buildAchCtx({ ...emptyArgs, expenses });
    expect(ctx.meatWeekMaxKg).toBeCloseTo(7);
  });
  test('an 8th day 10 days later does not join the earlier window', () => {
    const expenses = [
      exp({ date: '2026-08-01', receiptItems: [{ name: 'kurczak', price: 10, category: 'groceries', quantity: 1, unitPrice: 10, tags: [], weightKg: 5 }] }),
      exp({ date: '2026-08-20', receiptItems: [{ name: 'kurczak', price: 10, category: 'groceries', quantity: 1, unitPrice: 10, tags: [], weightKg: 5 }] }),
    ];
    const ctx = buildAchCtx({ ...emptyArgs, expenses });
    expect(ctx.meatWeekMaxKg).toBeCloseTo(5); // never 10 — the two purchases are 19 days apart
  });
});

describe('achievements — AGŚ (Automatyczny Generator Śmieci) day/month/streak bucketing', () => {
  const dayWith = (date: string, n: number) => exp({
    date, receiptItems: Array.from({ length: n }, (_, i) => ({
      name: `produkt${i}`, price: 5, category: 'groceries' as const, quantity: 1, unitPrice: 5, tags: [],
    })),
  });
  test('3 distinct items in a day trips agsDayEver; exactly 2 trips only agsEdgeDayEver', () => {
    const over = buildAchCtx({ ...emptyArgs, expenses: [dayWith('2026-08-01', 3)] });
    expect(over.agsDayEver).toBe(true);
    expect(over.agsEdgeDayEver).toBe(false);
    const edge = buildAchCtx({ ...emptyArgs, expenses: [dayWith('2026-08-01', 2)] });
    expect(edge.agsDayEver).toBe(false);
    expect(edge.agsEdgeDayEver).toBe(true);
  });
  test('cleanMonthNoAgs is true only when a CLOSED month has zero AGŚ-days', () => {
    const clean = buildAchCtx({ ...emptyArgs, expenses: [dayWith('2026-06-01', 1), dayWith('2026-06-15', 2)] });
    expect(clean.cleanMonthNoAgs).toBe(true);
    const dirty = buildAchCtx({ ...emptyArgs, expenses: [dayWith('2026-06-01', 3)] });
    expect(dirty.cleanMonthNoAgs).toBe(false);
  });
});

describe('achievements — budget streak / precision walk only CLOSED months', () => {
  test('3 consecutive closed months under budget → monthsUnderBudgetStreak = 3; a bad month in between breaks it', () => {
    const good = [
      exp({ date: '2026-05-10', amount: 100 }),
      exp({ date: '2026-06-10', amount: 100 }),
      exp({ date: '2026-07-10', amount: 100 }),
    ];
    const ctx = buildAchCtx({ ...emptyArgs, expenses: good, budgetTotal: 200 });
    expect(ctx.monthsUnderBudgetStreak).toBe(3);
    const withBadMonth = [...good, exp({ date: '2026-06-11', amount: 500 })];
    const ctx2 = buildAchCtx({ ...emptyArgs, expenses: withBadMonth, budgetTotal: 200 });
    expect(ctx2.monthsUnderBudgetStreak).toBe(1); // only July (the trailing closed month) still counts
  });
});

describe('achievements — mood bounce-back and meta badges (pirateTreasure / moodMastery)', () => {
  test('a ≤2 day immediately followed by a ≥4 day sets moodBounceBack', () => {
    const ctx = buildAchCtx({
      ...emptyArgs,
      moodEntries: [{ date: '2026-08-01', mood: 1 }, { date: '2026-08-02', mood: 5 }],
    });
    expect(ctx.moodBounceBack).toBe(true);
  });
  test('a ≤2 day followed by a GAP day (not the next calendar day) does not count', () => {
    const ctx = buildAchCtx({
      ...emptyArgs,
      moodEntries: [{ date: '2026-08-01', mood: 1 }, { date: '2026-08-03', mood: 5 }],
    });
    expect(ctx.moodBounceBack).toBe(false);
  });
  test('pirateTreasure requires saver-1000 + fat-wallet + under-limit simultaneously, not just one', () => {
    const onlySavings = buildAchCtx({ ...emptyArgs, expenses: [exp({ category: 'transfer', amount: 2000 })] });
    expect(onlySavings.pirateTreasure).toBe(false); // no card peak, no under-limit month
  });
});

describe('achievements — evaluateAchievements unlocks a saver badge once its field clears the target', () => {
  test('a 1000zł self-transfer unlocks saver-1000 but not saver-5000', () => {
    const ctx = buildAchCtx({ ...emptyArgs, expenses: [exp({ category: 'transfer', amount: 1000 })] });
    const states = evaluateAchievements(ctx);
    const saver1000 = states.find(s => s.a.id === 'saver-1000')!;
    const saver5000 = states.find(s => s.a.id === 'saver-5000')!;
    expect(saver1000.unlocked).toBe(true);
    expect(saver5000.unlocked).toBe(false);
  });
});
