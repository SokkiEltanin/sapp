import { ageFrom, targetsFor, dailyExercisePool, TRAINING_EXERCISES, DAILY_EXERCISE_COUNT, trainingStreakFrom, amountLoggedOn, exerciseStreakFrom, exerciseJustUnlocked, ExerciseLogEntry } from '@/utils/personalQuests';

describe('personalQuests — ageFrom', () => {
  test('brak daty urodzenia → null', () => {
    expect(ageFrom(null)).toBeNull();
  });

  test('zły format → null (nie rzuca)', () => {
    expect(ageFrom('nie-data')).toBeNull();
  });

  test('urodziny już były w tym roku → pełny wiek', () => {
    const today = new Date(2026, 7, 15); // 2026-08-15
    expect(ageFrom('2000-01-01', today)).toBe(26);
  });

  test('urodziny JESZCZE nie były w tym roku → o rok mniej', () => {
    const today = new Date(2026, 7, 15); // 2026-08-15
    expect(ageFrom('2000-12-31', today)).toBe(25);
  });

  test('urodziny DOKŁADNIE dziś → już liczy nowy rok', () => {
    const today = new Date(2026, 7, 15);
    expect(ageFrom('2000-08-15', today)).toBe(26);
  });
});

describe('personalQuests — targetsFor', () => {
  test('brak poziomu → traktowany jak początkujący', () => {
    expect(targetsFor(null, null, null)).toEqual(targetsFor('poczatkujacy', null, null));
  });

  test('wyższy poziom → wyższe cele pompek/przysiadów, ten sam rower', () => {
    const beg = targetsFor('poczatkujacy', null, null);
    const adv = targetsFor('zaawansowany', null, null);
    expect(adv.pushups).toBeGreaterThan(beg.pushups);
    expect(adv.squats).toBeGreaterThan(beg.squats);
  });

  test('wiek 50+ łagodzi cele, nigdy nie zbija do zera', () => {
    const young = targetsFor('zaawansowany', 25, null);
    const old = targetsFor('zaawansowany', 55, null);
    expect(old.pushups).toBeLessThan(young.pushups);
    expect(old.squats).toBeLessThan(young.squats);
    expect(old.pushups).toBeGreaterThanOrEqual(3);
    expect(old.squats).toBeGreaterThanOrEqual(5);
  });

  test('płeć koryguje TYLKO pompki, nie przysiady/rower', () => {
    const m = targetsFor('sredni', null, 'mężczyzna');
    const k = targetsFor('sredni', null, 'kobieta');
    expect(k.pushups).toBeLessThan(m.pushups);
    expect(k.squats).toBe(m.squats);
    expect(k.bikeMinutes).toBe(m.bikeMinutes);
  });

  test('wszystkie 6 pól obecne i dodatnie na każdym poziomie', () => {
    for (const lvl of ['poczatkujacy', 'sredni', 'zaawansowany'] as const) {
      const t = targetsFor(lvl, null, null);
      expect(t.pushups).toBeGreaterThan(0);
      expect(t.squats).toBeGreaterThan(0);
      expect(t.situps).toBeGreaterThan(0);
      expect(t.plankSeconds).toBeGreaterThan(0);
      expect(t.stretchMinutes).toBeGreaterThan(0);
      expect(t.bikeMinutes).toBeGreaterThan(0);
    }
  });
});

describe('personalQuests — dailyExercisePool (rotacja, user 2026-08-11: "mniej znudzenia")', () => {
  test('ten sam dzień → ten sam zestaw (deterministyczny, nie tasuje się przy re-renderze)', () => {
    expect(dailyExercisePool('2026-08-11')).toEqual(dailyExercisePool('2026-08-11'));
  });

  test('inny dzień → zwykle inny zestaw (nie ta sama stała trójka na zawsze)', () => {
    const days = ['2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17'];
    const sets = days.map(d => dailyExercisePool(d).slice().sort().join(','));
    expect(new Set(sets).size).toBeGreaterThan(1); // przynajmniej jakaś zmienność w tygodniu
  });

  test('domyślnie DAILY_EXERCISE_COUNT elementów, wszystkie z puli, bez duplikatów', () => {
    const pool = dailyExercisePool('2026-08-11');
    expect(pool).toHaveLength(DAILY_EXERCISE_COUNT);
    expect(new Set(pool).size).toBe(pool.length);
    for (const ex of pool) expect(TRAINING_EXERCISES).toContain(ex);
  });

  test('count = cała pula → zwraca wszystko', () => {
    expect(dailyExercisePool('2026-08-11', TRAINING_EXERCISES.length).sort()).toEqual([...TRAINING_EXERCISES].sort());
  });
});

describe('personalQuests — trainingStreakFrom', () => {
  test('brak historii → 0', () => {
    expect(trainingStreakFrom({}, '2026-08-11')).toBe(0);
  });

  test('dziś + wczoraj + przedwczoraj → 3, przerwa 3 dni temu ucina dalej', () => {
    const days = { '2026-08-11': true, '2026-08-10': true, '2026-08-09': true } as Record<string, true>;
    expect(trainingStreakFrom(days, '2026-08-11')).toBe(3);
  });

  test('nie zrobione DZIŚ, ale wczoraj tak → liczy się seria DO wczoraj (dzień jeszcze trwa)', () => {
    const days = { '2026-08-10': true, '2026-08-09': true } as Record<string, true>;
    expect(trainingStreakFrom(days, '2026-08-11')).toBe(2);
  });

  test('dziura w środku → seria liczy się tylko od najnowszej ciągłej reszty', () => {
    const days = { '2026-08-11': true, '2026-08-10': true, '2026-08-08': true, '2026-08-07': true } as Record<string, true>;
    expect(trainingStreakFrom(days, '2026-08-11')).toBe(2); // 11 i 10, 9 brakuje → stop
  });

  // Fix §367 (audyt) — sztywne `-364` w pętli ucinało serię na 364, dokładnie ten sam bug class
  // już dwukrotnie naprawiony w `useHabits.ts`'s `getStreak()` (BUG FIX #1/#2/#4 tam).
  test('nieprzerwana seria DŁUŻSZA niż 364 dni nie jest ucinana (fix §367)', () => {
    const today = '2026-08-11';
    const days: Record<string, true> = {};
    for (let i = 0; i <= 400; i++) days[isoOffset(today, -i)] = true;
    expect(trainingStreakFrom(days, today)).toBe(401);
  });
});

// Generuje ISO datę `n` dni przed/po `iso` — lokalny helper testu (fix §367), bez zależności od
// prywatnej `offsetDate` z `personalQuests.ts`.
function isoOffset(iso: string, n: number): string {
  const [y, m, d] = iso.split('-').map(Number);
  const dt = new Date(y, m - 1, d + n);
  const p = (v: number) => String(v).padStart(2, '0');
  return `${dt.getFullYear()}-${p(dt.getMonth() + 1)}-${p(dt.getDate())}`;
}

describe('personalQuests — amountLoggedOn (log ćwiczeń, fundament ekranu Zdrowie)', () => {
  const log = (exercise: ExerciseLogEntry['exercise'], amount: number, date: string): ExerciseLogEntry =>
    ({ id: `${exercise}-${date}-${amount}-${Math.random()}`, exercise, amount, date, createdAt: `${date}T00:00:00.000Z` });

  test('brak wpisów → 0', () => {
    expect(amountLoggedOn([], 'pushups', '2026-08-11')).toBe(0);
  });

  test('kilka wpisów tego samego ćwiczenia tego samego dnia → SUMUJĄ się', () => {
    const logs = [log('pushups', 10, '2026-08-11'), log('pushups', 5, '2026-08-11')];
    expect(amountLoggedOn(logs, 'pushups', '2026-08-11')).toBe(15);
  });

  test('inne ćwiczenie / inny dzień nie wlicza się', () => {
    const logs = [log('pushups', 10, '2026-08-11'), log('squats', 10, '2026-08-11'), log('pushups', 10, '2026-08-10')];
    expect(amountLoggedOn(logs, 'pushups', '2026-08-11')).toBe(10);
  });
});

describe('personalQuests — exerciseStreakFrom (log-based, zastępuje trainingDays dla kafelka dashboardu)', () => {
  const log = (exercise: ExerciseLogEntry['exercise'], date: string): ExerciseLogEntry =>
    ({ id: `${exercise}-${date}-${Math.random()}`, exercise, amount: 1, date, createdAt: `${date}T00:00:00.000Z` });

  test('brak logów → 0', () => {
    expect(exerciseStreakFrom([], '2026-08-11')).toBe(0);
  });

  test('dziś + wczoraj + przedwczoraj, RÓŻNE ćwiczenia każdego dnia → wciąż liczy się 3 (dowolne ćwiczenie)', () => {
    const logs = [log('pushups', '2026-08-11'), log('squats', '2026-08-10'), log('bike', '2026-08-09')];
    expect(exerciseStreakFrom(logs, '2026-08-11')).toBe(3);
  });

  test('nie zalogowane DZIŚ, ale wczoraj tak → liczy się seria do wczoraj', () => {
    const logs = [log('plank', '2026-08-10')];
    expect(exerciseStreakFrom(logs, '2026-08-11')).toBe(1);
  });

  test('kilka wpisów tego samego dnia liczy się jako JEDEN dzień streaka', () => {
    const logs = [log('pushups', '2026-08-11'), log('situps', '2026-08-11'), log('plank', '2026-08-11')];
    expect(exerciseStreakFrom(logs, '2026-08-11')).toBe(1);
  });

  test('dziura w środku → seria tylko od najnowszej ciągłej reszty', () => {
    const logs = [log('pushups', '2026-08-11'), log('squats', '2026-08-10'), log('bike', '2026-08-08')];
    expect(exerciseStreakFrom(logs, '2026-08-11')).toBe(2);
  });

  // Fix §367 — ten sam bug class co `trainingStreakFrom` wyżej.
  test('nieprzerwana seria DŁUŻSZA niż 364 dni nie jest ucinana (fix §367)', () => {
    const today = '2026-08-11';
    const logs = Array.from({ length: 401 }, (_, i) => log('plank', isoOffset(today, -i)));
    expect(exerciseStreakFrom(logs, today)).toBe(401);
  });
});

describe('personalQuests — exerciseJustUnlocked (wyodrębnione z ekranu Ćwiczenia pod builder planów, §320)', () => {
  test('brak celu (null) → nigdy nie odblokowuje', () => {
    expect(exerciseJustUnlocked(0, 10, null)).toBe(false);
  });

  test('przed wpisem już >= cel → nie "just" unlocked (był odblokowany wcześniej)', () => {
    expect(exerciseJustUnlocked(10, 5, 10)).toBe(false);
  });

  test('wpis przeprowadza przez próg → true', () => {
    expect(exerciseJustUnlocked(5, 10, 10)).toBe(true);
  });

  test('wpis dokładnie trafia w próg → true (>=, nie >)', () => {
    expect(exerciseJustUnlocked(0, 10, 10)).toBe(true);
  });

  test('wpis wciąż poniżej progu → false', () => {
    expect(exerciseJustUnlocked(0, 5, 10)).toBe(false);
  });
});
