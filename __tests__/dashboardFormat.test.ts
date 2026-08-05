import { moodColor, plTasks, tagLimitMsg, metricTagLabel, fmtChartPt } from '@/utils/dashboard/format';
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

  test('tagLimitMsg — eskalacja progami', () => {
    expect(tagLimitMsg(0)).toBe('Czysto, zero wydatków');
    expect(tagLimitMsg(0.1)).toBe('Na razie idzie dobrze');
    expect(tagLimitMsg(0.2)).toBe('Kurde, raz Cię pokusiło');
    expect(tagLimitMsg(0.5)).toBe('Powoli, powoli');
    expect(tagLimitMsg(0.7)).toBe('Robi się gorąco');
    expect(tagLimitMsg(0.9)).toBe('Hamuj! Limit prawie wyczerpany');
    expect(tagLimitMsg(1)).toBe('Przekroczono limit');
    expect(tagLimitMsg(1.5)).toBe('Przekroczono limit');
  });

  test('fmtChartPt — puste/dziesiętne/k-notacja', () => {
    expect(fmtChartPt(0, 'zł')).toBe('');
    expect(fmtChartPt(-5, 'zł')).toBe('');
    expect(fmtChartPt(72.5, 'kg')).toBe('72,5');
    expect(fmtChartPt(3.2, '/5')).toBe('3,2');
    expect(fmtChartPt(120000, 'zł')).toBe('120k');
  });

  test('metricTagLabel — nazwa konkretnego tagu wg jednostki', () => {
    expect(metricTagLabel(undefined)).toBe('');
    expect(metricTagLabel({ label: 'Wydatki', unit: 'zł' })).toBe('Wydatki');
    expect(metricTagLabel({ label: 'X', unit: 'zł', needsTag: true }, 'słodycze')).toBe('Słodycze (wydatki)');
    expect(metricTagLabel({ label: 'X', unit: 'kg', needsTag: true }, 'mięso')).toBe('Mięso (kg)');
    expect(metricTagLabel({ label: 'X', unit: 'szt', needsTag: true }, 'jajka')).toBe('Jajka (szt.)');
  });
});
