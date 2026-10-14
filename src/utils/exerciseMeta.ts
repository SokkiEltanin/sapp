import { PersonalQuestTargets, TrainingExercise } from '@/utils/personalQuests';

// Wspólna tabela label/jednostka/cel dla 6 kanonicznych ćwiczeń — wyodrębniona z
// app/exercises.tsx (2026-10-14, przy budowie buildera planów treningowych) żeby builder
// (wybór "podepnij pod istniejące ćwiczenie" przy pozycji planu) i `useExerciseLogging.ts`
// (nagrody/quest) czytały TĘ SAMĄ definicję co ekran Ćwiczenia, zamiast dwóch kopii, które
// mogłyby się z czasem rozjechać (np. zmiana jednostki pompek w jednym miejscu, nie w drugim).
// Ikony NIE są tu — zostają per-ekran (lucide fallbacki różnią się kontekstem), prawdziwe
// grafiki i tak idą przez `ExerciseIcon`/`exercisePng` kluczowane samym `id`.
export interface ExerciseMeta {
  id: TrainingExercise;
  label: string;
  unit: string;
  target: (t: PersonalQuestTargets) => number;
}

export const EXERCISE_META: ExerciseMeta[] = [
  { id: 'pushups', label: 'Pompki',      unit: 'powt.', target: t => t.pushups },
  { id: 'squats',  label: 'Przysiady',   unit: 'powt.', target: t => t.squats },
  { id: 'situps',  label: 'Brzuszki',    unit: 'powt.', target: t => t.situps },
  { id: 'plank',   label: 'Deska',       unit: 's',     target: t => t.plankSeconds },
  { id: 'stretch', label: 'Rozciąganie', unit: 'min',   target: t => t.stretchMinutes },
  { id: 'bike',    label: 'Rower',       unit: 'min',   target: t => t.bikeMinutes },
];

export function exerciseMetaById(id: TrainingExercise): ExerciseMeta | undefined {
  return EXERCISE_META.find(m => m.id === id);
}
