import { ageFrom, targetsFor, dailyExercisePool, TRAINING_EXERCISES, DAILY_EXERCISE_COUNT, trainingStreakFrom } from '@/utils/personalQuests';

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
});
