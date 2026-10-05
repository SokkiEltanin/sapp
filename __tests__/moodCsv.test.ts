import { moodToCsv } from '@/utils/moodCsv';
import { MoodEntry } from '@/types';

const e = (o: Partial<MoodEntry>): MoodEntry => ({
  id: 'x', date: '2026-08-04', mood: 3, energy: 3, tags: [], note: '',
  createdAt: '', updatedAt: '', ...o,
});

describe('moodCsv — moodToCsv', () => {
  test('nagłówek po polsku + BOM na początku', () => {
    const csv = moodToCsv([]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Data,Nastrój,Energia,Tagi,Notatka');
  });

  test('sortuje rosnąco po dacie, tłumaczy poziomy na etykiety po polsku', () => {
    const csv = moodToCsv([
      e({ date: '2026-08-10', mood: 5, energy: 1 }),
      e({ date: '2026-08-01', mood: 1, energy: 5 }),
    ]);
    const lines = csv.split('\n').slice(1);
    expect(lines[0]).toContain('2026-08-01');
    expect(lines[0]).toContain('Fatalnie');
    expect(lines[0]).toContain('Pełna energia');
    expect(lines[1]).toContain('2026-08-10');
    expect(lines[1]).toContain('Świetnie');
    expect(lines[1]).toContain('Bez energii');
  });

  test('eskejpuje pola z przecinkiem/cudzysłowem w notatce', () => {
    const csv = moodToCsv([e({ note: 'Dzień "specjalny", stresujący' })]);
    expect(csv).toContain('"Dzień ""specjalny"", stresujący"');
  });

  test('tagi łączone średnikiem', () => {
    const csv = moodToCsv([e({ tags: ['szczęśliwy', 'wyczerpany'] })]);
    expect(csv).toContain('szczęśliwy; wyczerpany');
  });
});
