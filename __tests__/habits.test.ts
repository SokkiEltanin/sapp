import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  stepFor, getHabits, saveHabits, getCounts, setCounts, getCountsRange,
  getWaterHabit, feedWaterHabit, getStepsHabit, feedStepsHabit, getWaterGlasses,
} from '@/utils/habits';
import { Habit } from '@/types';

beforeEach(async () => { await AsyncStorage.clear(); });

const habit = (o: Partial<Habit>): Habit => ({
  id: 'h1', title: 'Test', type: 'count', createdAt: '', ...o,
} as Habit);

describe('habits — stepFor (rozmiar jednego kliknięcia)', () => {
  test('jawnie ustawiony step wygrywa', () => {
    expect(stepFor(habit({ step: 5 }))).toBe(5);
  });
  test('jednostka "ml" (bez jawnego step) → skacze o 250', () => {
    expect(stepFor(habit({ unit: 'ml' }))).toBe(250);
    expect(stepFor(habit({ unit: ' ML ' }))).toBe(250); // wielkość liter/spacje bez znaczenia
  });
  test('bez step i bez jednostki ml → domyślnie 1', () => {
    expect(stepFor(habit({}))).toBe(1);
    expect(stepFor(habit({ unit: 'szkl.' }))).toBe(1);
  });
});

describe('habits — getCounts / setCounts (z migracją starego formatu)', () => {
  test('round-trip w nowym formacie', async () => {
    await setCounts('2026-08-15', { h1: 3 });
    expect(await getCounts('2026-08-15')).toEqual({ h1: 3 });
  });

  test('brak nowego formatu, ale jest stary (string[] zaznaczonych id) → migrowane do {id:1}', async () => {
    await AsyncStorage.setItem('habits_done_2026-08-01', JSON.stringify(['h1', 'h2']));
    expect(await getCounts('2026-08-01')).toEqual({ h1: 1, h2: 1 });
  });

  test('nowy format ma pierwszeństwo nad starym, gdy oba istnieją', async () => {
    await AsyncStorage.setItem('habits_done_2026-08-01', JSON.stringify(['h1']));
    await setCounts('2026-08-01', { h1: 5 });
    expect(await getCounts('2026-08-01')).toEqual({ h1: 5 });
  });

  test('brak jakichkolwiek danych na dany dzień → pusty obiekt', async () => {
    expect(await getCounts('2026-01-01')).toEqual({});
  });
});

// 2026-08-27, user ze screenshotem: "dashboard pokazuje 29 mimo że mam 33 jak wejdę [w
// habit-year]" — useHabits.ts's load() wczytywało do `completions` TYLKO 30 dni, więc
// getStreak() (nieograniczona pętla od BUG FIX #2) i tak nie widziała danych starszych — okno
// rozszerzone do 371 dni (LOAD_WINDOW_DAYS), efektywnie przez ten nowy multiGet-batchowany
// odczyt zamiast 371 pojedynczych getCounts().
describe('habits — getCountsRange (batchowany odczyt wielu dni, 2026-08-27)', () => {
  test('zwraca dane dla dat z nowym formatem', async () => {
    await setCounts('2026-08-01', { h1: 2 });
    await setCounts('2026-08-02', { h1: 3 });
    const out = await getCountsRange(['2026-08-01', '2026-08-02']);
    expect(out['2026-08-01']).toEqual({ h1: 2 });
    expect(out['2026-08-02']).toEqual({ h1: 3 });
  });

  test('dzień bez żadnych danych po prostu nie ma wpisu (nie {})', async () => {
    const out = await getCountsRange(['2026-08-01', '2026-08-02']);
    expect(out['2026-08-01']).toBeUndefined();
  });

  test('legacy format (string[]) migrowany tak samo jak w getCounts, batchowo', async () => {
    await AsyncStorage.setItem('habits_done_2026-08-01', JSON.stringify(['h1', 'h2']));
    await setCounts('2026-08-02', { h1: 5 });
    const out = await getCountsRange(['2026-08-01', '2026-08-02']);
    expect(out['2026-08-01']).toEqual({ h1: 1, h2: 1 });
    expect(out['2026-08-02']).toEqual({ h1: 5 });
  });

  test('okno 33+ dni (regresja na "dashboard 29 vs habit-year 33") — wszystkie dni czytelne, nie tylko pierwsze 30', async () => {
    const dates: string[] = [];
    for (let i = 0; i < 35; i++) {
      const d = `2026-07-${String(i + 1).padStart(2, '0')}`;
      dates.push(d);
      await setCounts(d, { h1: 1 });
    }
    const out = await getCountsRange(dates);
    expect(Object.keys(out).length).toBe(35);
    expect(out['2026-07-01']).toEqual({ h1: 1 });
    expect(out['2026-07-31']).toEqual({ h1: 1 }); // dzień #31 — poza starym 30-dniowym oknem
  });
});

describe('habits — getWaterHabit (priorytet: kind=water > count-type nazwany "woda")', () => {
  test('kind=water wygrywa nawet jeśli jest też count-habit "Woda"', async () => {
    await saveHabits([
      habit({ id: 'legacy', title: 'Woda', type: 'count' }),
      habit({ id: 'new', title: 'Nawodnienie', kind: 'water' }),
    ]);
    expect((await getWaterHabit())?.id).toBe('new');
  });

  test('brak kind=water → fallback do count-type nazwanego dokładnie "woda" (bez uwzgl. wielkości liter)', async () => {
    await saveHabits([habit({ id: 'w', title: '  WODA  ', type: 'count' })]);
    expect((await getWaterHabit())?.id).toBe('w');
  });

  test('nawyk "Woda" typu check (nie count) NIE trafia we fallback', async () => {
    await saveHabits([habit({ id: 'w', title: 'Woda', type: 'check' })]);
    expect(await getWaterHabit()).toBeNull();
  });

  test('brak dopasowania → null', async () => {
    await saveHabits([habit({ id: 'x', title: 'Coś innego' })]);
    expect(await getWaterHabit()).toBeNull();
  });
});

describe('habits — feedWaterHabit (MAX-merge, nigdy nie cofa ręcznego zapisu)', () => {
  test('brak nawyku wody → false, nic nie zapisuje', async () => {
    expect(await feedWaterHabit(5, '2026-08-15')).toBe(false);
  });

  test('podnosi licznik gdy wartość z zegarka jest wyższa', async () => {
    await saveHabits([habit({ id: 'w', title: 'Woda', type: 'count' })]);
    await setCounts('2026-08-15', { w: 2 });
    expect(await feedWaterHabit(5, '2026-08-15')).toBe(true);
    expect(await getCounts('2026-08-15')).toEqual({ w: 5 });
  });

  test('NIE cofa licznika gdy wartość z zegarka jest niższa niż już zapisana ręcznie', async () => {
    await saveHabits([habit({ id: 'w', title: 'Woda', type: 'count' })]);
    await setCounts('2026-08-15', { w: 8 });
    expect(await feedWaterHabit(3, '2026-08-15')).toBe(false);
    expect(await getCounts('2026-08-15')).toEqual({ w: 8 }); // nietknięte
  });

  test('powtórne podanie tej samej wartości → false (nic realnie się nie zmieniło)', async () => {
    await saveHabits([habit({ id: 'w', title: 'Woda', type: 'count' })]);
    await feedWaterHabit(5, '2026-08-15');
    expect(await feedWaterHabit(5, '2026-08-15')).toBe(false);
  });
});

describe('habits — getStepsHabit (dopasowanie po dokładnej, znanej nazwie)', () => {
  test('rozpoznaje kilka wariantów nazwy, bez uwzgl. wielkości liter', async () => {
    await saveHabits([habit({ id: 's', title: ' Kroki ' })]);
    expect((await getStepsHabit())?.id).toBe('s');
  });
  test('nierozpoznana nazwa → null', async () => {
    await saveHabits([habit({ id: 's', title: 'Trening' })]);
    expect(await getStepsHabit()).toBeNull();
  });
});

describe('habits — feedStepsHabit (zalicza dzień TYLKO gdy cel realnie trafiony)', () => {
  test('cel NIE trafiony (steps<goal) → false, nawet gdy nawyk istnieje', async () => {
    await saveHabits([habit({ id: 's', title: 'Kroki', dailyGoal: 10000 })]);
    expect(await feedStepsHabit(5000, 10000, '2026-08-15')).toBe(false);
  });

  test('cel trafiony → zalicza dzień do dailyGoal nawyku (nie do surowej liczby kroków)', async () => {
    await saveHabits([habit({ id: 's', title: 'Kroki', dailyGoal: 3 })]);
    expect(await feedStepsHabit(12000, 10000, '2026-08-15')).toBe(true);
    expect(await getCounts('2026-08-15')).toEqual({ s: 3 });
  });

  test('nigdy nie ODZNACZA dnia już ręcznie zaliczonego wyżej niż dailyGoal', async () => {
    await saveHabits([habit({ id: 's', title: 'Kroki', dailyGoal: 1 })]);
    await setCounts('2026-08-15', { s: 5 });
    expect(await feedStepsHabit(12000, 10000, '2026-08-15')).toBe(false);
    expect(await getCounts('2026-08-15')).toEqual({ s: 5 });
  });
});

describe('habits — getWaterGlasses', () => {
  test('brak nawyku wody → 0', async () => {
    expect(await getWaterGlasses('2026-08-15')).toBe(0);
  });
  test('zwraca zapisaną liczbę szklanek dla dnia', async () => {
    await saveHabits([habit({ id: 'w', title: 'Woda', type: 'count' })]);
    await setCounts('2026-08-15', { w: 6 });
    expect(await getWaterGlasses('2026-08-15')).toBe(6);
  });
});
