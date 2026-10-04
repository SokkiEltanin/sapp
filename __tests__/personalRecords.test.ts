import { buildRecords } from '@/utils/personalRecords';
import { Expense, MoodEntry } from '@/types';

const mood = (date: string, m: number): MoodEntry => ({ date, mood: m, energy: m } as any);
const sweetsExpense = (date: string): Expense => ({
  id: date, amount: 10, currency: 'PLN', category: 'groceries', tags: [], note: '',
  date, createdAt: '', updatedAt: '', type: 'expense',
  receiptItems: [{ name: 'Ciastka', price: 10, quantity: 1, tags: ['słodycze'] } as any],
} as Expense);

describe('personalRecords — buildRecords', () => {
  test('kroki/sen/waga — wartości + lowerIsBetter + DATA dnia rekordu', () => {
    const recs = buildRecords({
      '2026-08-01': { steps: 12000, sleepMinutes: 430, weightKg: 72 },
      '2026-08-02': { steps: 8000, sleepMinutes: 500, weightKg: 71.2 },
    }, [], []);
    const byKey = Object.fromEntries(recs.map(r => [r.key, r]));
    expect(byKey.steps.num).toBe(12000);
    expect(byKey.steps.date).toBe('2026-08-01');
    expect(byKey.sleep.num).toBe(500);
    expect(byKey.sleep.value).toBe('8h 20m');
    expect(byKey.sleep.date).toBe('2026-08-02');
    expect(byKey.weight.num).toBe(71.2);
    expect(byKey.weight.lowerIsBetter).toBe(true);
    expect(byKey.weight.date).toBe('2026-08-02');
  });

  test('najdłużej bez słodyczy — luka MIĘDZY zakupami, data = dzień przed kolejnym zakupem', () => {
    // Zakup 2026-08-01, potem cisza, kolejny zakup 2026-08-20 → luka 18 dni (01→20 minus
    // oba dni zakupu), kończąca się dzień przed drugim zakupem. Reszta zakupów co 10 dni
    // od 08-20 AŻ DO WCZORAJ (dynamicznie, niezależnie od realnego "dziś" testu) — żeby
    // żadna PÓŹNIEJSZA luka (w tym "seria wciąż trwa" od ostatniego zakupu do dziś) nie
    // wypadła przypadkiem dłuższa niż 18 dni i nie wygrała zamiast luki w środku.
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const filler: string[] = [];
    const cursor = new Date('2026-08-20T00:00:00');
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    while (cursor < yesterday) { cursor.setDate(cursor.getDate() + 10); filler.push(fmt(cursor)); }
    filler.push(fmt(yesterday));
    const recs = buildRecords({}, [sweetsExpense('2026-08-01'), sweetsExpense('2026-08-20'), ...filler.map(sweetsExpense)], []);
    const r = recs.find(x => x.key === 'sweetless');
    expect(r?.num).toBe(18);
    expect(r?.date).toBe('2026-08-19');
  });

  test('najdłużej bez słodyczy — seria WCIĄŻ TRWA, data = dziś', () => {
    const recs = buildRecords({}, [sweetsExpense('2026-08-01')], []);
    const r = recs.find(x => x.key === 'sweetless');
    expect(r?.date).toEqual(expect.any(String));
    // "dziś" w formacie YYYY-MM-DD — nie zgadujemy dokładnej daty (zależna od zegara testu),
    // tylko że to poprawny format i że num > 0 (seria faktycznie trwa).
    expect(r?.date).toMatch(/^\d{4}-\d{2}-\d{2}$/);
    expect(r!.num).toBeGreaterThan(0);
  });

  // 2026-10-04, user: "jak zjem i wpisze toffieffie to mi nie lapie ze to slodycz i nie
  // zeruje streaka" — `longestSweetless` tylko patrzyło na tagowane ZAKUPY, nigdy na jedzenie
  // zalogowane w "Co zjadłem" (ten sam eat-vs-buy gap co quests.ts's `sweetlessDaysFrom`,
  // naprawiony tym samym fixem).
  test('najdłużej bez słodyczy — zjedzenie (bez zakupu) też przerywa serię', () => {
    // Ten sam wzorzec co test zakupowy wyżej, ale luka kończy się na JEDZENIU (nie zakupie):
    // zakup 2026-08-01, potem cisza, zjedzony (nigdy nie kupiony/zeskanowany) słodycz
    // 2026-08-18 → luka 16 dni, kończąca się dzień przed tym jedzeniem. Reszta jedzenia co
    // 10 dni AŻ DO WCZORAJ (ten sam filler-wzorzec co wyżej) — żeby żadna PÓŹNIEJSZA luka (w
    // tym "seria wciąż trwa") nie wypadła przypadkiem dłuższa i nie wygrała zamiast tej.
    const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    const filler: string[] = [];
    const cursor = new Date('2026-08-18T00:00:00');
    const yesterday = new Date(); yesterday.setDate(yesterday.getDate() - 1);
    while (cursor < yesterday) { cursor.setDate(cursor.getDate() + 10); filler.push(fmt(cursor)); }
    filler.push(fmt(yesterday));
    const meals = ['2026-08-18', ...filler].map(date => ({ date, items: [{ name: 'Toffieffie' }] }));
    const recs = buildRecords({}, [sweetsExpense('2026-08-01')], [], meals);
    const r = recs.find(x => x.key === 'sweetless');
    expect(r?.num).toBe(16);
    expect(r?.date).toBe('2026-08-17');
  });

  test('waga wymaga ≥2 odczytów', () => {
    const recs = buildRecords({ '2026-08-01': { steps: 0, sleepMinutes: 0, weightKg: 70 } }, [], []);
    expect(recs.find(r => r.key === 'weight')).toBeUndefined();
  });

  test('najlepszy tydzień nastroju (≥4 dni) — data = OSTATNI dzień najlepszego okna', () => {
    const entries = ['2026-08-01', '2026-08-02', '2026-08-03', '2026-08-04'].map(d => mood(d, 5));
    const r = buildRecords({}, [], entries).find(x => x.key === 'mood');
    expect(r?.num).toBeCloseTo(5);
    expect(r?.value).toBe('5.0/5');
    expect(r?.date).toBe('2026-08-04');
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
