import { useMemo } from 'react';
import { useHabits } from '@/hooks/useHabits';
import { useDayKey } from '@/hooks/useDayKey';
import { useCounters, autoDaysWithout, Counter } from '@/store/countersStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useFoodStore, MealEntry, FoodProduct } from '@/store/foodStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { exerciseStreakFrom } from '@/utils/personalQuests';
import { StreakItem } from '@/components/dashboard/StreakWallCard';
import { Habit, Expense } from '@/types';

// Ta sama logika co `app/(tabs)/index.tsx`'s `streakWall` i `app/dashboard-tile-creator.tsx`'s
// `realStreaks` (habity + auto-liczniki "dni bez" + ćwiczenia → `StreakItem[]`), wyciągnięta
// jako OSOBNY hook dla systemu kopiowania komponentów (§340+, 2026-10-16) — kanwa na kolejnych
// ekranach (np. `food.tsx`, `exercises.tsx`) potrzebuje tej samej listy "do czego da się
// przypiąć kafel serii", a te ekrany NIE mają jeszcze żadnego z `useHabits()`/`useCounters()`/
// itd. zamontowanego, więc zero ryzyka duplikacji. ŚWIADOMIE NIE podpięte do `index.tsx`/
// kreatora — oba JUŻ wołają te hooki osobno dla innych memo na tym samym ekranie (records/
// countdowns/since/gcal); dodanie tego hooka TAM obok istniejących wywołań zamontowałoby
// `useHabits()` (własny AsyncStorage fetch) PO RAZ DRUGI w tym samym drzewie komponentów —
// podwójna, zbędna praca na najbardziej czułym na wydajność ekranie w appce (patrz CLAUDE.md
// o ANR). Czysty DRY tu nie jest wart tego kosztu — duplikacja tych ~8 linijek logiki zostaje
// w `index.tsx`/kreatorze.
//
// UWAGA przy wpinaniu `<ScreenCanvas>` (zawiera ten hook) na KOLEJNYM ekranie — sprawdź najpierw
// `grep -n "useHabits(" <plik>`. `habits.tsx` i `pet.tsx` JUŻ montują `useHabits()` dla
// własnej treści (nawyki/pupil), więc nie są bezpiecznym celem bez zmiany architektury tego
// hooka — dokładnie ta sama pułapka co `index.tsx`/kreator opisana wyżej, inny ekran.
//
// `buildStreakItems()` (Faza 34, 2026-10-18, §368) — czysta część WYDZIELONA z tego hooka, bo
// `mood.tsx` JUŻ montuje `useHabits()` dla własnej treści (ten sam przypadek co `habits.tsx`/
// `pet.tsx` wyżej) — zamiast wykluczać `mood` z płótna (jak `habits`/`pet`), `mood.tsx` może
// wywołać TĘ funkcję ze SWOIMI już-zamontowanymi `habits`/`getStreak` + resztą (lekkie,
// Zustand-owe selektory, bezpieczne wszędzie) i przekazać wynik do `ScreenCanvasBase`
// bezpośrednio — ten sam wzorzec co `index.tsx` robi dla `streakWall`.
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

export function useAllStreakItems(): StreakItem[] {
  const { habits, getStreak } = useHabits();
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
