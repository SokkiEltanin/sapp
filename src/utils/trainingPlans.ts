import { TrainingExercise, ExerciseLogEntry, amountLoggedOn } from '@/utils/personalQuests';

// Builder planów treningowych (2026-10-14, user: "żebym mógł sobie go kopiować i edytowac i
// np zaznaczać jak w jedzeniu co zrobiłem"). Zakres potwierdzony AskUserQuestion: pozycje
// planu mogą być DOWOLNE (nie tylko 6 kanonicznych ćwiczeń z exerciseMeta.ts), zaznaczanie
// "zrobione" to tap → pole z ilością wypełnione celem, edytowalne przed zapisem, odpalanie
// planu to osobny ekran "Dzisiejsza sesja" (nie wbudowane w app/exercises.tsx).
//
// `linkedExercise` to most CELOWE, nie przypadkowe pole: jeśli pozycja planu odpowiada jednej
// z 6 kanonicznych wartości `TrainingExercise`, logowanie jej w sesji woła
// `exercisesStore.addLog(linkedExercise, ...)` DOKŁADNIE jak ręczne wpisanie na ekranie
// Ćwiczenia — więc zalicza TEN SAM quest (`b_pushups` itd.) i daje monety/XP identycznie.
// Pozycja BEZ `linkedExercise` (user wpisał własną nazwę w builderze) loguje się pod własną
// nazwą — liczy się do SERII (patrz `exerciseStreakFrom`, nie patrzy na wartość `exercise`),
// ale nie ma za nią skonfigurowanego questu/nagrody (nie ma dla niej spersonalizowanego celu w
// `targetsFor()` ani akcji `markXDone` w petStore — nie ma co "odblokować"). Świadomy wybór,
// nie dziura: builder NIE udaje że dowolnie wymyślone ćwiczenie odblokuje pupilowe nagrody.
export interface TrainingPlanItem {
  id: string;
  name: string;
  linkedExercise?: TrainingExercise;
  targetAmount: number;
  unit: string;
}

export interface TrainingPlan {
  id: string;
  name: string;
  items: TrainingPlanItem[];
  createdAt: string;
}

export function genId(): string {
  return `${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
}

// Klucz logowania pozycji planu — ten sam string wszędzie (sesja/log/sprawdzenie "zrobione"),
// żeby nie rozjechać się między miejscami które go czytają/piszą.
export function planItemLogKey(item: TrainingPlanItem): string {
  return item.linkedExercise ?? item.name;
}

// Czy pozycja planu ma dziś zalogowaną sumę >= jej własnego celu z buildera (NIE
// `targetsFor()` — to osobny cel, patrz komentarz przy `linkedExercise` wyżej: cel questu/
// nagrody pupila i cel pozycji planu to dwa niezależne progi, mogą się różnić).
export function planItemDoneToday(logs: ExerciseLogEntry[], item: TrainingPlanItem, today: string): boolean {
  return amountLoggedOn(logs, planItemLogKey(item), today) >= item.targetAmount;
}
