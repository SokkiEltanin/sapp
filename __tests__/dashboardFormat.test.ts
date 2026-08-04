import { moodColor, plTasks } from '@/utils/dashboard/format';
import { MOOD_COLORS } from '@/types';

describe('dashboard/format', () => {
  test('moodColor mapuje progi nastroju na kolory', () => {
    expect(moodColor(5)).toBe(MOOD_COLORS[5]);
    expect(moodColor(4)).toBe(MOOD_COLORS[4]);
    expect(moodColor(3)).toBe(MOOD_COLORS[3]);
    expect(moodColor(2)).toBe(MOOD_COLORS[2]);
    expect(moodColor(1)).toBe(MOOD_COLORS[1]);
    expect(moodColor(4.5)).toBe(MOOD_COLORS[5]);   // granica w górę
    expect(moodColor(0)).toBe(MOOD_COLORS[1]);      // poniżej skali
  });

  test('plTasks — polska odmiana zadanie/zadania/zadań', () => {
    expect(plTasks(1)).toBe('zadanie');
    expect(plTasks(2)).toBe('zadania');
    expect(plTasks(3)).toBe('zadania');
    expect(plTasks(4)).toBe('zadania');
    expect(plTasks(5)).toBe('zadań');
    expect(plTasks(11)).toBe('zadań');
    expect(plTasks(12)).toBe('zadań');   // wyjątek 12–14
    expect(plTasks(14)).toBe('zadań');
    expect(plTasks(22)).toBe('zadania');
    expect(plTasks(0)).toBe('zadań');
  });
});
