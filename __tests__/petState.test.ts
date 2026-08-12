import { computePetState, petStatusLine, PetInput, PetState } from '@/utils/petState';

const input = (o: Partial<PetInput> = {}): PetInput => ({
  stepsToday: 0, stepGoal: 10000, sleepMinutes: 0, habitsDone: 0, habitsTotal: 0,
  moodLoggedToday: false, avgMoodToday: null, hour: 12, ...o,
});

describe('computePetState — nieznane vs zerowe metryki (kluczowe rozróżnienie)', () => {
  test('kompletny brak danych (dopiero otwarta apka) → neutralne wellbeing=60, NIE smutny pupil', () => {
    const st = computePetState(input());
    expect(st.wellbeing).toBe(60);
    expect(st.expression).toBe('content'); // 60 mieści się w progu "content" (>=60)
  });

  test('każda metryka bez danych ma unknown=true i met=true (nie liczy się jako "niespełniona")', () => {
    const st = computePetState(input());
    for (const need of st.needs) {
      expect(need.unknown).toBe(true);
      expect(need.met).toBe(true);
    }
  });

  test('kroki=0 przy ustawionym celu traktowane jako "jeszcze nie zsynchronizowane", NIE jako 0%', () => {
    const st = computePetState(input({ stepsToday: 0, stepGoal: 10000, sleepMinutes: 420, habitsDone: 1, habitsTotal: 1 }));
    const activity = st.needs.find(n => n.key === 'activity')!;
    expect(activity.unknown).toBe(true); // nie wliczone do wellbeing jako porażka
  });
});

describe('computePetState — znane metryki liczą się do średniej, nieznane są pomijane', () => {
  test('wellbeing to średnia TYLKO ze znanych metryk, nie karana za brakujące', () => {
    // sen=100% (450min), reszta nieznana → wellbeing powinno być ~100 (średnia z JEDNEJ
    // znanej metryki), a nie rozwodnione przez 3 nieznane potraktowane jako 0.
    const st = computePetState(input({ sleepMinutes: 450 }));
    expect(st.wellbeing).toBe(100);
  });

  test('próg "met": dokładnie 55% → spełnione; poniżej → niespełnione', () => {
    const stAt55 = computePetState(input({ sleepMinutes: 450 * 0.55 })); // energy=55
    expect(stAt55.needs.find(n => n.key === 'energy')!.met).toBe(true);
    const stBelow = computePetState(input({ sleepMinutes: 450 * 0.54 }));
    expect(stBelow.needs.find(n => n.key === 'energy')!.met).toBe(false);
  });
});

describe('computePetState — progi wyrazu twarzy (granice wellbeing)', () => {
  const withWellbeing = (target: number) => computePetState(input({
    sleepMinutes: 450 * (target / 100), habitsDone: 0, habitsTotal: 0, // sen = jedyna znana metryka, ustawia wellbeing wprost
  }));
  test('>=80 → happy', () => expect(withWellbeing(80).expression).toBe('happy'));
  test('60..79 → content', () => expect(withWellbeing(60).expression).toBe('content'));
  test('42..59 → meh', () => expect(withWellbeing(42).expression).toBe('meh'));
  test('22..41 → sad', () => expect(withWellbeing(22).expression).toBe('sad'));
  test('<22 → sick', () => expect(withWellbeing(10).expression).toBe('sick'));
});

describe('computePetState — "śpi" zależy od pory dnia, chyba że aktywność jest wysoka', () => {
  test('noc (22-5) bez wysokiej aktywności → sleeping, niezależnie od wellbeing', () => {
    const st = computePetState(input({ hour: 23, sleepMinutes: 450 })); // wellbeing byłoby "happy"
    expect(st.expression).toBe('sleeping');
  });
  test('noc, ALE wysoka aktywność (>=80%) → NIE sleeping, liczy się normalny próg wellbeing', () => {
    const st = computePetState(input({ hour: 23, stepGoal: 10000, stepsToday: 9000, sleepMinutes: 450 }));
    expect(st.expression).not.toBe('sleeping');
  });
  test('granica godzin: 22 i 5 to już noc, 21 i 6 to już nie', () => {
    expect(computePetState(input({ hour: 22 })).expression).toBe('sleeping');
    expect(computePetState(input({ hour: 5 })).expression).toBe('sleeping');
    expect(computePetState(input({ hour: 21 })).expression).not.toBe('sleeping');
    expect(computePetState(input({ hour: 6 })).expression).not.toBe('sleeping');
  });
});

describe('computePetState — overBudget to osobna flaga, nie wpływa na nastrój', () => {
  test('przekazywana wprost jako bool (w tym niezdefiniowane → false)', () => {
    expect(computePetState(input({ overBudget: true })).overBudget).toBe(true);
    expect(computePetState(input({})).overBudget).toBe(false);
  });
});

describe('petStatusLine — priorytet komunikatów', () => {
  const state = (o: Partial<PetState>): PetState => ({
    needs: [], wellbeing: 60, expression: 'content', label: '', color: '', ...o,
  });

  test('sleeping wygrywa nad wszystkim, nawet overBudget', () => {
    const line = petStatusLine(state({ expression: 'sleeping', overBudget: true }));
    expect(line).toMatch(/śpi/i);
    expect(line).not.toMatch(/budżet/i);
  });
  test('sick wygrywa nad overBudget', () => {
    const line = petStatusLine(state({ expression: 'sick', overBudget: true }));
    expect(line).not.toMatch(/budżet/i);
  });
  test('overBudget wygrywa nad zwykłymi (happy/content/meh/sad) komunikatami', () => {
    const line = petStatusLine(state({ expression: 'happy', overBudget: true }));
    expect(line).toMatch(/budżet/i);
  });
  test('bez overBudget, każdy zwykły expression ma własny, niepusty tekst', () => {
    for (const expr of ['happy', 'content', 'meh', 'sad'] as const) {
      expect(petStatusLine(state({ expression: expr, overBudget: false }))).toBeTruthy();
    }
  });
});
