import { exerciseDayCell, exerciseMonthSummary } from '@/utils/exerciseCalendar';
import { ExerciseLogEntry } from '@/utils/personalQuests';

const log = (exercise: string, amount: number, date: string): ExerciseLogEntry =>
  ({ id: `${exercise}-${date}-${amount}-${Math.random()}`, exercise, amount, date, createdAt: `${date}T00:00:00.000Z` });

describe('exerciseCalendar — exerciseDayCell', () => {
  test('brak wpisów danego dnia → wszystko zero', () => {
    expect(exerciseDayCell([], '2026-10-14')).toEqual({ ds: '2026-10-14', distinctCount: 0, totalAmount: 0, entryCount: 0 });
  });

  test('kilka różnych ćwiczeń tego samego dnia → distinctCount liczy UNIKALNE', () => {
    const logs = [log('pushups', 10, '2026-10-14'), log('squats', 20, '2026-10-14'), log('pushups', 5, '2026-10-14')];
    const cell = exerciseDayCell(logs, '2026-10-14');
    expect(cell.distinctCount).toBe(2);
    expect(cell.entryCount).toBe(3);
    expect(cell.totalAmount).toBe(35);
  });

  test('wpisy z innego dnia nie wliczają się', () => {
    const logs = [log('pushups', 10, '2026-10-13'), log('pushups', 10, '2026-10-14')];
    expect(exerciseDayCell(logs, '2026-10-14').entryCount).toBe(1);
  });
});

describe('exerciseCalendar — exerciseMonthSummary', () => {
  test('brak wpisów → wszystko zero', () => {
    expect(exerciseMonthSummary([], '2026-10')).toEqual({ activeDays: 0, totalEntries: 0, totalAmount: 0, distinctExercises: 0 });
  });

  test('liczy tylko wpisy z danego miesiąca (prefiks YYYY-MM)', () => {
    const logs = [
      log('pushups', 10, '2026-10-01'),
      log('squats', 20, '2026-10-14'),
      log('pushups', 15, '2026-09-30'), // inny miesiąc, nie liczy się
      log('bike', 5, '2026-11-01'),     // inny miesiąc, nie liczy się
    ];
    const summary = exerciseMonthSummary(logs, '2026-10');
    expect(summary.totalEntries).toBe(2);
    expect(summary.totalAmount).toBe(30);
    expect(summary.distinctExercises).toBe(2);
  });

  test('activeDays liczy UNIKALNE dni, nie wpisy', () => {
    const logs = [log('pushups', 10, '2026-10-01'), log('squats', 5, '2026-10-01'), log('bike', 20, '2026-10-02')];
    expect(exerciseMonthSummary(logs, '2026-10').activeDays).toBe(2);
  });
});
