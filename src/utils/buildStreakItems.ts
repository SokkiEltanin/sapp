import { autoDaysWithout, Counter } from '@/store/countersStore';
import { MealEntry, FoodProduct } from '@/store/foodStore';
import type { StreakItem } from '@/components/dashboard/StreakWallCard';
import { Habit, Expense } from '@/types';

// Wydzielone z `useAllStreakItems.ts` (§368, audyt — ARCHITECTURE.md §368 twierdziło że ta
// funkcja jest "pokryta istniejącymi testami przez useAllStreakItems/integrację", co było
// NIEPRAWDĄ: `useAllStreakItems.ts` importuje `useHabits` → `notificationsService` →
// `expo-notifications` (ESM), więc samo zaimportowanie tego pliku w jest/node środowisku
// rzuca "Cannot use import statement outside a module" — `buildStreakItems` nie była
// testowalna, mimo że jest czystą funkcją. Przeniesione do osobnego, czysto-TS pliku (ten sam
// wzorzec co wydzielenie `shapeStyleDefaults.ts`/`dataFieldTileStyleDefaults.ts` — zero
// importów dotykających RN/hooków), żeby dało się ją bezpośrednio testować. `useAllStreakItems.ts`
// re-eksportuje tę funkcję dla zgodności z istniejącymi importami.
export function buildStreakItems(args: {
  habits: Habit[];
  getStreak: (habitId: string) => number;
  counters: Counter[];
  expenses: Expense[];
  foodMeals: MealEntry[];
  foodProducts: FoodProduct[];
  exerciseStreak: number;
}): StreakItem[] {
  const { habits, getStreak, counters, expenses, foodMeals, foodProducts, exerciseStreak } = args;
  const fromHabits = habits.map(h => ({ key: `h:${h.id}`, name: h.title, days: getStreak(h.id), kind: h.kind }));
  const fromCounters = counters
    .filter(cn => cn.kind === 'since' && cn.mode === 'auto' && cn.onDashboard !== false)
    .map(cn => ({ key: `c:${cn.id}`, name: `bez ${cn.name}`, days: autoDaysWithout(cn, expenses, foodMeals, foodProducts) }));
  const exercise: StreakItem = { key: 'ex:exercises', name: 'Ćwiczenia', days: exerciseStreak };
  return [exercise, ...fromHabits, ...fromCounters];
}
