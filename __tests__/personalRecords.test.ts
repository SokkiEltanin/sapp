import { buildRecords } from '@/utils/personalRecords';
import { MoodEntry } from '@/types';

const mood = (date: string, m: number): MoodEntry => ({ date, mood: m, energy: m } as any);

describe('personalRecords — buildRecords', () => {
  test('kroki/sen/waga — wartości + lowerIsBetter', () => {
    const recs = buildRecords({
      '2026-08-01': { steps: 12000, sleepMinutes: 430, weightKg: 72 },
      '2026-08-02': { steps: 8000, sleepMinutes: 500, weightKg: 71.2 },
    }, [], []);
    const byKey = Object.fromEntries(recs.map(r => [r.key, r]));
    expect(byKey.steps.num).toBe(12000);
    expect(byKey.sleep.num).toBe(500);
    expect(byKey.sleep.value).toBe('8h 20m');
    expect(byKey.weight.num).toBe(71.2);
    expect(byKey.weight.lowerIsBetter).toBe(true);
  });

  test('waga wymaga ≥2 odczytów', () => {
    const recs = buildRecords({ '2026-08-01': { steps: 0, sleepMinutes: 0, weightKg: 70 } }, [], []);
    expect(recs.find(r => r.key === 'weight')).toBeUndefined();
  });

  test('najlepszy tydzień nastroju (≥4 dni)', () => {
    const entries = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'].map(d => mood(d, 5));
    const r = buildRecords({}, [], entries).find(x => x.key === 'mood');
    expect(r?.num).toBeCloseTo(5);
    expect(r?.value).toBe('5.0/5');
  });

  test('<4 dni nastroju → brak rekordu nastroju', () => {
    const entries = ['2026-08-01', '2026-08-02', '2026-08-03'].map(d => mood(d, 5));
    expect(buildRecords({}, [], entries).find(r => r.key === 'mood')).toBeUndefined();
  });

  test('puste dane → brak rekordów', () => {
    expect(buildRecords({}, [], [])).toEqual([]);
  });

  // 2026-08-25: bestMoodWeek przepisane z O(n²) (re-filtrowanie całej listy dni dla
  // KAŻDEGO dnia) na O(n) (dwuwskaźnikowe okno). Te testy pilnują, że wynik się NIE
  // zmienił — porównanie z naiwną referencyjną implementacją tej samej logiki.
  describe('najlepszy tydzień nastroju — okno z lukami (nie tylko dni pod rząd)', () => {
    function naiveBestMoodWeek(entries: MoodEntry[]): number {
      const byDay = new Map<string, number[]>();
      for (const e of entries) {
        const d = (e.date ?? '').slice(0, 10);
        if (!d || !(e.mood > 0)) continue;
        (byDay.get(d) ?? byDay.set(d, []).get(d)!).push(e.mood);
      }
      const days = [...byDay.keys()].sort();
      if (days.length < 4) return 0;
      const avgOf = (d: string) => { const a = byDay.get(d)!; return a.reduce((s, v) => s + v, 0) / a.length; };
      let best = 0;
      for (const end of days) {
        const start = new Date(new Date(end + 'T00:00:00').getTime() - 6 * 86400000);
        const startStr = `${start.getFullYear()}-${String(start.getMonth() + 1).padStart(2, '0')}-${String(start.getDate()).padStart(2, '0')}`;
        const win = days.filter(d => d >= startStr && d <= end);
        if (win.length < 4) continue;
        best = Math.max(best, win.reduce((s, d) => s + avgOf(d), 0) / win.length);
      }
      return best;
    }

    test('gęste dni pod rząd (bez luk) — okno przesuwa się poprawnie', () => {
      const entries = Array.from({ length: 20 }, (_, i) => {
        const d = new Date(2026, 0, 1 + i);
        const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
        return mood(day, 1 + (i % 5));
      });
      const r = buildRecords({}, [], entries).find(x => x.key === 'mood');
      // buildRecords zaokrągla `num` do 2 miejsc (Math.round(mood * 100) / 100) — porównanie
      // musi to uwzględnić, inaczej rozjeżdża się na czystej precyzji zaokrąglenia.
      expect(r?.num).toBeCloseTo(Math.round(naiveBestMoodWeek(entries) * 100) / 100, 5);
    });

    test('dni z dużymi lukami (klastry oddzielone >6 dniami) — lewy wskaźnik nie "zgubi" okna', () => {
      const days = [
        '2026-01-01', '2026-01-02', '2026-01-03', '2026-01-04', // klaster 1, gęsty
        '2026-02-01', '2026-02-02', '2026-02-03', // luka >6 dni, klaster 2 za krótki (3 dni)
        '2026-03-01', '2026-03-02', '2026-03-03', '2026-03-04', '2026-03-05', // klaster 3, 5 dni w 7-dniowym oknie
      ];
      const entries = days.map((d, i) => mood(d, 1 + (i % 5)));
      const r = buildRecords({}, [], entries).find(x => x.key === 'mood');
      const expected = naiveBestMoodWeek(entries);
      expect(expected).toBeGreaterThan(0); // sanity: test rzeczywiście ćwiczy klaster ≥4 dni
      expect(r?.num).toBeCloseTo(Math.round(expected * 100) / 100, 5);
    });

    test('losowe dane (wiele losowych zestawów dni z lukami) — wynik zawsze zgodny z naiwną implementacją', () => {
      let seed = 42;
      const rand = () => { seed = (seed * 1103515245 + 12345) & 0x7fffffff; return seed / 0x7fffffff; };
      for (let trial = 0; trial < 15; trial++) {
        let cursor = 0;
        const entries: MoodEntry[] = [];
        const n = 15 + Math.floor(rand() * 30);
        for (let i = 0; i < n; i++) {
          cursor += Math.floor(rand() * 10); // losowa luka 0..9 dni
          const d = new Date(2026, 0, 1 + cursor);
          const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
          entries.push(mood(day, 1 + Math.floor(rand() * 5)));
        }
        const r = buildRecords({}, [], entries).find(x => x.key === 'mood');
        const expected = naiveBestMoodWeek(entries);
        expect(r?.num ?? 0).toBeCloseTo(Math.round(expected * 100) / 100, 5);
      }
    });
  });
});
