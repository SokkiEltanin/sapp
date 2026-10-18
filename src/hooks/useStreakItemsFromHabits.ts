import { useMemo } from 'react';
import { useDayKey } from '@/hooks/useDayKey';
import { useCounters } from '@/store/countersStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useFoodStore } from '@/store/foodStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { exerciseStreakFrom } from '@/utils/personalQuests';
import { StreakItem } from '@/components/dashboard/StreakWallCard';
import { buildStreakItems } from '@/utils/buildStreakItems';
import { Habit } from '@/types';

// Wydzielone z `useAllStreakItems()` (§373) — reszta źródeł, które `buildStreakItems()`
// potrzebuje OBOK `habits`/`getStreak`, to same tanie, Zustand-owe selektory (bezpieczne do
// zamontowania WSZĘDZIE, bez ryzyka duplikacji jak `useHabits()`/`useAllNotesItems()`'s
// `getAllNotes()`). Ten hook istnieje, żeby ekrany, które JUŻ montują `useHabits()` dla
// własnej treści (`mood.tsx`, `habits.tsx`, `pet.tsx` — patrz ostrzeżenie w
// `useAllStreakItems.ts`) mogły dociągnąć TYLKO tę resztę, bez trzeciego/czwartego
// skopiowania tych samych ~10 linijek boilerplate'u w każdym z nich. `useAllStreakItems()`
// sam jest teraz cienkim wrapperem: `useHabits()` + ten hook.
export function useStreakItemsFromHabits(habits: Habit[], getStreak: (habitId: string) => number): StreakItem[] {
  const counters = useCounters(st => st.counters);
  const expenses = useExpensesStore(st => st.expenses);
  const foodMeals = useFoodStore(st => st.meals);
  const foodProducts = useFoodStore(st => st.products);
  const exerciseLogs = useExercisesStore(st => st.logs);
  const dayKey = useDayKey();
  const exerciseStreak = useMemo(() => exerciseStreakFrom(exerciseLogs, dayKey), [exerciseLogs, dayKey]);

  return useMemo(
    () => buildStreakItems({ habits, getStreak, counters, expenses, foodMeals, foodProducts, exerciseStreak }),
    [habits, getStreak, counters, expenses, foodMeals, foodProducts, exerciseStreak],
  );
}
