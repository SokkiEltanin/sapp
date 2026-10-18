import { buildStreakItems } from '@/utils/buildStreakItems';
import { Habit, Expense } from '@/types';
import { Counter } from '@/store/countersStore';

// Pokrywa realny gap znaleziony przy audycie §368 (ARCHITECTURE.md twierdziło "pokryte
// istniejącymi testami przez useAllStreakItems/integrację" — nieprawda, `buildStreakItems()`
// nie miała ŻADNEGO testu bezpośredniego, i NIE DA SIĘ jej przetestować przez import z
// `useAllStreakItems.ts` — ten plik importuje `useHabits` → `notificationsService` →
// `expo-notifications`, co w jest/node środowisku rzuca "Cannot use import statement outside
// a module"). Stąd wydzielenie do `@/utils/buildStreakItems.ts`. Testujemy kompozycję
// exercise+habits+counters, nie samo `autoDaysWithout`/`exerciseStreakFrom` (już pokryte
// osobno).

const habit = (over: Partial<Habit> = {}): Habit =>
  ({ id: 'h1', title: 'Czytanie', color: '#fff', icon: 'book', ...over } as Habit);

const counter = (over: Partial<Counter> = {}): Counter =>
  ({
    id: 'c1', kind: 'since', name: 'słodycze', mode: 'auto',
    date: '2026-01-01', startDate: '2026-01-01', createdAt: '2026-01-01T00:00:00.000Z',
    ...over,
  } as Counter);

const baseArgs = {
  habits: [] as Habit[],
  getStreak: (_id: string) => 0,
  counters: [] as Counter[],
  expenses: [] as Expense[],
  foodMeals: [] as any[],
  foodProducts: [] as any[],
  exerciseStreak: 0,
};

describe('buildStreakItems (§368, wydzielone z useAllStreakItems)', () => {
  test('bez habitów/liczników → tylko wpis "Ćwiczenia"', () => {
    const items = buildStreakItems(baseArgs);
    expect(items).toEqual([{ key: 'ex:exercises', name: 'Ćwiczenia', days: 0 }]);
  });

  test('exerciseStreak przechodzi na wpis "Ćwiczenia"', () => {
    const items = buildStreakItems({ ...baseArgs, exerciseStreak: 12 });
    expect(items[0]).toEqual({ key: 'ex:exercises', name: 'Ćwiczenia', days: 12 });
  });

  test('habit → h:<id>, days z getStreak(habitId), name=title, kind przekazane', () => {
    const items = buildStreakItems({
      ...baseArgs,
      habits: [habit({ id: 'h1', title: 'Czytanie', kind: 'avoid' })],
      getStreak: (id) => (id === 'h1' ? 7 : 0),
    });
    expect(items).toContainEqual({ key: 'h:h1', name: 'Czytanie', days: 7, kind: 'avoid' });
  });

  test('kilka habitów → każdy dostaje własny streak z getStreak', () => {
    const items = buildStreakItems({
      ...baseArgs,
      habits: [habit({ id: 'h1', title: 'A' }), habit({ id: 'h2', title: 'B' })],
      getStreak: (id) => (id === 'h1' ? 3 : 9),
    });
    expect(items.find(i => i.key === 'h:h1')?.days).toBe(3);
    expect(items.find(i => i.key === 'h:h2')?.days).toBe(9);
  });

  test('licznik kind="since" + mode="auto" + onDashboard niepodane (domyślnie włączony) → wliczony', () => {
    const items = buildStreakItems({
      ...baseArgs,
      counters: [counter({ id: 'c1', name: 'słodycze' })],
    });
    const found = items.find(i => i.key === 'c:c1');
    expect(found).toBeDefined();
    expect(found!.name).toBe('bez słodycze');
    expect(found!.days).toBeGreaterThanOrEqual(0);
  });

  test('licznik z onDashboard=false → WYKLUCZONY', () => {
    const items = buildStreakItems({
      ...baseArgs,
      counters: [counter({ id: 'c1', onDashboard: false })],
    });
    expect(items.find(i => i.key === 'c:c1')).toBeUndefined();
  });

  test('licznik kind="until" (nie "since") → WYKLUCZONY', () => {
    const items = buildStreakItems({
      ...baseArgs,
      counters: [counter({ id: 'c1', kind: 'until' as Counter['kind'] })],
    });
    expect(items.find(i => i.key === 'c1')).toBeUndefined();
    expect(items.find(i => i.key === 'c:c1')).toBeUndefined();
  });

  test('licznik bez mode="auto" (ręczny) → WYKLUCZONY', () => {
    const items = buildStreakItems({
      ...baseArgs,
      counters: [counter({ id: 'c1', mode: undefined })],
    });
    expect(items.find(i => i.key === 'c:c1')).toBeUndefined();
  });

  test('kolejność: Ćwiczenia, potem habity, potem liczniki', () => {
    const items = buildStreakItems({
      ...baseArgs,
      habits: [habit({ id: 'h1' })],
      counters: [counter({ id: 'c1' })],
    });
    expect(items.map(i => i.key)).toEqual(['ex:exercises', 'h:h1', 'c:c1']);
  });
});
