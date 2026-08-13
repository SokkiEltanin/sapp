import { computeWeaknessStreaks, weaknessHpFactor, weakenBoss } from '@/utils/bossWeakness';
import { Habit } from '@/types';

function pad(n: number) { return String(n).padStart(2, '0'); }
function daysAgo(n: number): string {
  const d = new Date();
  d.setDate(d.getDate() - n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const habit = (o: Partial<Habit>): Habit => ({
  id: 'h1', title: 'Habit', color: '#fff', icon: 'zap', createdAt: '2026-01-01T00:00:00.000Z', ...o,
});

describe('weaknessHpFactor', () => {
  test('0 dni serii = brak osłabienia', () => {
    expect(weaknessHpFactor(0)).toBe(1);
  });
  test('spada 1%/dzień, cap -35% przy 35+ dniach', () => {
    expect(weaknessHpFactor(10)).toBeCloseTo(0.9);
    expect(weaknessHpFactor(35)).toBeCloseTo(0.65);
    expect(weaknessHpFactor(500)).toBe(0.65); // nie spada poniżej capu
  });
  test('ujemne wejście traktowane jak 0 (nigdy nie WZMACNIA bossa)', () => {
    expect(weaknessHpFactor(-10)).toBe(1);
  });
});

describe('weakenBoss', () => {
  test('bez serii zwraca DOKŁADNIE ten sam obiekt (referencyjna stabilność)', () => {
    const b = { hp: 1000, name: 'x' };
    expect(weakenBoss(b, 0)).toBe(b);
  });
  test('z serią zwraca klon z obniżonym hp, resztę pól zachowuje', () => {
    const b = { hp: 1000, name: 'x' };
    const weak = weakenBoss(b, 20);
    expect(weak).not.toBe(b);
    expect(weak.hp).toBe(800);
    expect(weak.name).toBe('x');
  });
  test('hp nigdy nie spada do 0 nawet przy ekstremalnej serii', () => {
    expect(weakenBoss({ hp: 1 }, 1000).hp).toBeGreaterThanOrEqual(1);
  });
});

describe('computeWeaknessStreaks', () => {
  const getHabitStreak = (id: string) => (id === 'water1' ? 5 : id === 'steps1' ? 8 : id === 'plain' ? 12 : 0);

  test('habits = najlepsza seria spośród WSZYSTKICH nawyków', () => {
    const habits = [habit({ id: 'a' }), habit({ id: 'plain' }), habit({ id: 'b' })];
    const streaks = computeWeaknessStreaks({
      habits, getHabitStreak, expenses: [], moodEntries: [], healthDays: {},
    });
    expect(streaks.habits).toBe(12);
  });

  test('water: znajduje nawyk kind==="water" po id, ignoruje inne', () => {
    const habits = [habit({ id: 'water1', kind: 'water', title: 'Cokolwiek' }), habit({ id: 'plain' })];
    const streaks = computeWeaknessStreaks({
      habits, getHabitStreak, expenses: [], moodEntries: [], healthDays: {},
    });
    expect(streaks.water).toBe(5);
  });

  test('water: fallback po nazwie "Woda" (count-type) gdy brak kind', () => {
    const habits = [habit({ id: 'water1', title: 'Woda', type: 'count' })];
    const streaks = computeWeaknessStreaks({
      habits, getHabitStreak, expenses: [], moodEntries: [], healthDays: {},
    });
    expect(streaks.water).toBe(5);
  });

  test('water: 0 gdy nie ma pasującego nawyku', () => {
    const habits = [habit({ id: 'plain', title: 'Czytanie' })];
    const streaks = computeWeaknessStreaks({
      habits, getHabitStreak, expenses: [], moodEntries: [], healthDays: {},
    });
    expect(streaks.water).toBe(0);
  });

  test('steps: dopasowanie po nazwie (kroki/steps/spacer…)', () => {
    const habits = [habit({ id: 'steps1', title: 'Kroki' })];
    const streaks = computeWeaknessStreaks({
      habits, getHabitStreak, expenses: [], moodEntries: [], healthDays: {},
    });
    expect(streaks.steps).toBe(8);
  });

  test('sweetless: deleguje do sweetlessDaysFrom (dni od ostatniego słodyczowego zakupu)', () => {
    const expenses = [{ type: 'expense', date: daysAgo(3), receiptItems: [{ tags: ['słodycze'] }] }];
    const streaks = computeWeaknessStreaks({
      habits: [], getHabitStreak, expenses, moodEntries: [], healthDays: {},
    });
    expect(streaks.sweetless).toBe(3);
  });

  test('mood: kolejne dni wstecz z wpisem nastroju, przerywa na pierwszej dziurze', () => {
    const moodEntries = [{ date: daysAgo(0) }, { date: daysAgo(1) }, { date: daysAgo(2) }, { date: daysAgo(5) }];
    const streaks = computeWeaknessStreaks({
      habits: [], getHabitStreak, expenses: [], moodEntries, healthDays: {},
    });
    expect(streaks.mood).toBe(3);
  });

  test('sleep: kolejne noce ≥7h (420 min) wstecz, przerywa gdy brak danych albo za mało snu', () => {
    const healthDays = {
      [daysAgo(0)]: { sleepMinutes: 430 },
      [daysAgo(1)]: { sleepMinutes: 420 },
      [daysAgo(2)]: { sleepMinutes: 300 }, // za mało → przerywa serię
      [daysAgo(3)]: { sleepMinutes: 500 },
    };
    const streaks = computeWeaknessStreaks({
      habits: [], getHabitStreak, expenses: [], moodEntries: [], healthDays,
    });
    expect(streaks.sleep).toBe(2);
  });

  test('pusty kontekst (nowy user) = same zera, nie 400-dniowy fałszywy streak', () => {
    const streaks = computeWeaknessStreaks({
      habits: [], getHabitStreak, expenses: [], moodEntries: [], healthDays: {},
    });
    expect(streaks).toEqual({ steps: 0, sweetless: 0, habits: 0, mood: 0, sleep: 0, water: 0 });
  });
});
