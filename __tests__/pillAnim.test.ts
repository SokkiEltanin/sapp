import { isLive, animKeyFor } from '@/utils/pillAnim';

// 2026-10-06, user: "ogarnij dynamic pilla naszego zeby nie byl taki hukowy zlagowany
// znikający" — root cause: pomodoro/praca tykają co 1000ms (pomodoroStore.ts/
// useWorkEarnings.ts), a `item.key` dla tych stanów wplatał tykającą wartość WPROST
// (`pom-${sekundy}`, `earn-${zarobek}`), więc efekty animacji w TopPill.tsx (keyowane
// surowym `item.key`) restartowały CAŁĄ animację co sekundę. `animKeyFor` ścina tykający
// sufiks do jednej stabilnej wartości kategorii — te testy pilnują że to ścinanie
// faktycznie się dzieje (regression-guard na dokładnie ten bug).

describe('isLive — stany "na żywo" (tykają co sekundę)', () => {
  test('pomodoro i zarobki z pracy są "na żywo"', () => {
    expect(isLive('pom-125')).toBe(true);
    expect(isLive('earn-42')).toBe(true);
  });
  test('reszta kluczy NIE jest "na żywo"', () => {
    expect(isLive('shift-today')).toBe(false);
    expect(isLive('class-abc123')).toBe(false);
    expect(isLive('overdue')).toBe(false);
    expect(isLive('all-clear')).toBe(false);
  });
});

describe('animKeyFor — stabilna kategoria do wyzwalania animacji (regresja "hukowy pill")', () => {
  test('pomodoro: różne sekundy odliczania → TA SAMA kategoria (animacja nie restartuje się co tyknięcie)', () => {
    expect(animKeyFor('pom-125')).toBe('pom');
    expect(animKeyFor('pom-124')).toBe('pom');
    expect(animKeyFor('pom-1')).toBe('pom');
    expect(animKeyFor('pom-125')).toBe(animKeyFor('pom-1'));
  });
  test('zarobki z pracy: różne kwoty → TA SAMA kategoria', () => {
    expect(animKeyFor('earn-10')).toBe('earn');
    expect(animKeyFor('earn-11')).toBe('earn');
    expect(animKeyFor('earn-10')).toBe(animKeyFor('earn-11'));
  });
  test('wszystkie inne klucze przechodzą bez zmian (realna zmiana treści dalej crossfade\'uje)', () => {
    expect(animKeyFor('shift-today')).toBe('shift-today');
    expect(animKeyFor('class-abc123')).toBe('class-abc123');
    expect(animKeyFor('today-xyz')).toBe('today-xyz');
    expect(animKeyFor('all-clear')).toBe('all-clear');
  });
  test('przejście pom→inna kategoria i z powrotem NADAL daje różne animKey (pop-in nadal działa)', () => {
    expect(animKeyFor('pom-60')).not.toBe(animKeyFor('all-clear'));
    expect(animKeyFor('earn-5')).not.toBe(animKeyFor('shift-today'));
  });
});
