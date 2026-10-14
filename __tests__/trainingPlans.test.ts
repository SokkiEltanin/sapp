import { planItemLogKey, planItemDoneToday, TrainingPlanItem } from '@/utils/trainingPlans';
import { ExerciseLogEntry } from '@/utils/personalQuests';

describe('trainingPlans — planItemLogKey', () => {
  test('z linkedExercise → klucz to linkedExercise, nie name', () => {
    const item: TrainingPlanItem = { id: 'a', name: 'Pompki rano', linkedExercise: 'pushups', targetAmount: 10, unit: 'powt.' };
    expect(planItemLogKey(item)).toBe('pushups');
  });

  test('bez linkedExercise → klucz to name (dowolna, własna pozycja)', () => {
    const item: TrainingPlanItem = { id: 'a', name: 'Wykroki z hantlami', targetAmount: 10, unit: 'powt.' };
    expect(planItemLogKey(item)).toBe('Wykroki z hantlami');
  });
});

describe('trainingPlans — planItemDoneToday', () => {
  const log = (exercise: ExerciseLogEntry['exercise'], amount: number, date: string): ExerciseLogEntry =>
    ({ id: `${exercise}-${date}-${amount}-${Math.random()}`, exercise, amount, date, createdAt: `${date}T00:00:00.000Z` });

  test('brak logów → nie zrobione', () => {
    const item: TrainingPlanItem = { id: 'a', name: 'Pompki', linkedExercise: 'pushups', targetAmount: 10, unit: 'powt.' };
    expect(planItemDoneToday([], item, '2026-10-14')).toBe(false);
  });

  test('suma dziś >= cel pozycji → zrobione', () => {
    const item: TrainingPlanItem = { id: 'a', name: 'Pompki', linkedExercise: 'pushups', targetAmount: 10, unit: 'powt.' };
    const logs = [log('pushups', 6, '2026-10-14'), log('pushups', 4, '2026-10-14')];
    expect(planItemDoneToday(logs, item, '2026-10-14')).toBe(true);
  });

  test('suma dziś < cel pozycji → nie zrobione', () => {
    const item: TrainingPlanItem = { id: 'a', name: 'Pompki', linkedExercise: 'pushups', targetAmount: 10, unit: 'powt.' };
    const logs = [log('pushups', 5, '2026-10-14')];
    expect(planItemDoneToday(logs, item, '2026-10-14')).toBe(false);
  });

  test('cel pozycji własny (nie targetsFor) — niezależny od innych wpisów tego samego linkedExercise z INNEGO dnia', () => {
    const item: TrainingPlanItem = { id: 'a', name: 'Pompki', linkedExercise: 'pushups', targetAmount: 10, unit: 'powt.' };
    const logs = [log('pushups', 100, '2026-10-13')];
    expect(planItemDoneToday(logs, item, '2026-10-14')).toBe(false);
  });

  test('pozycja własna (bez linkedExercise) liczona pod swoją nazwą, nie myli się z kanonicznym ćwiczeniem o tej samej treści', () => {
    const item: TrainingPlanItem = { id: 'a', name: 'Wykroki z hantlami', targetAmount: 10, unit: 'powt.' };
    const logs = [log('pushups', 100, '2026-10-14')];
    expect(planItemDoneToday(logs, item, '2026-10-14')).toBe(false);
  });
});
