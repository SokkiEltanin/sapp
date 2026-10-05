import { buildPatterns, extractKeywords } from '@/utils/moodPatterns';
import { MoodEntry } from '@/types';

// 2026-10-05, audyt trzech niezsynchronizowanych "silników korelacji" dot. humoru — ta
// trzecia (różnica średnich między grupami dni), wydzielona z `app/(tabs)/mood.tsx`, była
// dotąd ZUPEŁNIE bez testów mimo bycia realnym, user-facing user feature ("Wnioski" w
// zakładce Humor). Te testy pilnują zarówno że wzorce się wykrywają, jak i że progi
// MIN_N=5/D_MOOD=0.45/D_SPEND=60 (podniesione po feedbacku "korelacje w większości błędne")
// wciąż odsiewają szum.

let seq = 0;
const entry = (o: Partial<MoodEntry>): MoodEntry => ({
  id: `e${seq++}`, date: '2026-09-01', mood: 3, energy: 3, tags: [],
  createdAt: '2026-09-01T12:00:00', updatedAt: '2026-09-01T12:00:00', ...o,
});
const empty = {};

describe('moodPatterns — buildPatterns', () => {
  test('praca vs dni wolne: realna różnica nastroju z wystarczającą próbką → wykryta', () => {
    const entries: MoodEntry[] = [];
    const workByDate: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const d = `2026-09-0${i + 1}`;
      entries.push(entry({ date: d, mood: 2 }));
      workByDate[d] = 8;
    }
    for (let i = 0; i < 6; i++) {
      const d = `2026-09-1${i + 1}`;
      entries.push(entry({ date: d, mood: 4 }));
    }
    const out = buildPatterns(entries, workByDate, empty, empty, empty, empty, empty);
    expect(out.some(l => l.includes('W dni wolne masz lepszy humor'))).toBe(true);
  });

  test('za mało próbek po jednej stronie (< MIN_N=5) → NIE wykryte, mimo dużej różnicy', () => {
    const entries: MoodEntry[] = [];
    const workByDate: Record<string, number> = {};
    for (let i = 0; i < 3; i++) {   // tylko 3 < MIN_N
      const d = `2026-09-0${i + 1}`;
      entries.push(entry({ date: d, mood: 1 }));
      workByDate[d] = 8;
    }
    for (let i = 0; i < 6; i++) {
      const d = `2026-09-1${i + 1}`;
      entries.push(entry({ date: d, mood: 5 }));
    }
    const out = buildPatterns(entries, workByDate, empty, empty, empty, empty, empty);
    expect(out.some(l => l.includes('humor'))).toBe(false);
  });

  test('różnica poniżej progu D_MOOD=0.45 → odrzucona jako szum', () => {
    const entries: MoodEntry[] = [];
    const workByDate: Record<string, number> = {};
    const workMoods = [3, 3, 3, 3, 3, 3];
    const offMoods  = [3, 3, 3, 3, 3, 4]; // średnia ≈3.17 — różnica ≈0.17 < 0.45
    workMoods.forEach((mood, i) => {
      const d = `2026-09-0${i + 1}`;
      entries.push(entry({ date: d, mood: mood as MoodEntry['mood'] }));
      workByDate[d] = 8;
    });
    offMoods.forEach((mood, i) => {
      const d = `2026-09-1${i + 1}`;
      entries.push(entry({ date: d, mood: mood as MoodEntry['mood'] }));
    });
    const out = buildPatterns(entries, workByDate, empty, empty, empty, empty, empty);
    expect(out.some(l => l.includes('W dni wolne') || l.includes('W dni pracy'))).toBe(false);
  });

  test('sen: dobrze spane (≥7h) vs krótkie (<6h) noce → wpływ na energię wykryty', () => {
    const entries: MoodEntry[] = [];
    const sleepMinByDate: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const d = `2026-09-0${i + 1}`;
      entries.push(entry({ date: d, energy: 5 }));
      sleepMinByDate[d] = 450; // 7.5h
    }
    for (let i = 0; i < 6; i++) {
      const d = `2026-09-1${i + 1}`;
      entries.push(entry({ date: d, energy: 1 }));
      sleepMinByDate[d] = 300; // 5h
    }
    const out = buildPatterns(entries, empty, empty, empty, sleepMinByDate, empty, empty);
    expect(out.some(l => l.includes('dobrym śnie') && l.includes('więcej energii'))).toBe(true);
  });

  test('kroki: aktywne dni (8k+) vs mało aktywne (<4k) → wpływ na humor wykryty', () => {
    const entries: MoodEntry[] = [];
    const stepsByDate: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const d = `2026-09-0${i + 1}`;
      entries.push(entry({ date: d, mood: 5 }));
      stepsByDate[d] = 10000;
    }
    for (let i = 0; i < 6; i++) {
      const d = `2026-09-1${i + 1}`;
      entries.push(entry({ date: d, mood: 1 }));
      stepsByDate[d] = 2000;
    }
    const out = buildPatterns(entries, empty, empty, empty, empty, stepsByDate, empty);
    expect(out.some(l => l.includes('ruchem') && l.includes('lepszy humor'))).toBe(true);
  });

  test('wydatki: gorsze dni vs dobre dni → różnica w zł powyżej D_SPEND=60 wykryta', () => {
    const entries: MoodEntry[] = [];
    const spendByDate: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const d = `2026-09-0${i + 1}`;
      entries.push(entry({ date: d, mood: 1 }));
      spendByDate[d] = 200;
    }
    for (let i = 0; i < 6; i++) {
      const d = `2026-09-1${i + 1}`;
      entries.push(entry({ date: d, mood: 5 }));
      spendByDate[d] = 50;
    }
    const out = buildPatterns(entries, empty, spendByDate, empty, empty, empty, empty);
    expect(out.some(l => l.includes('W gorsze dni wydajesz więcej'))).toBe(true);
  });

  test('zero wpisów → zero wniosków, nie crash', () => {
    expect(buildPatterns([], empty, empty, empty, empty, empty, empty)).toEqual([]);
  });

  test('limit 6 wniosków nawet gdy wiele wzorców się kwalifikuje', () => {
    const entries: MoodEntry[] = [];
    const workByDate: Record<string, number> = {};
    const spendByDate: Record<string, number> = {};
    const doneTasksByDate: Record<string, number> = {};
    const sleepMinByDate: Record<string, number> = {};
    const stepsByDate: Record<string, number> = {};
    const habitRateByDate: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      const d = `2026-01-0${i + 1}`;
      entries.push(entry({ date: d, mood: 1, energy: 1, note: 'korki stres praca' }));
      workByDate[d] = 10; spendByDate[d] = 300; sleepMinByDate[d] = 250; stepsByDate[d] = 1000; habitRateByDate[d] = 0.1;
    }
    for (let i = 0; i < 6; i++) {
      const d = `2026-02-1${i + 1}`;
      entries.push(entry({ date: d, mood: 5, energy: 5, note: 'relaks spokój radość' }));
      sleepMinByDate[d] = 500; stepsByDate[d] = 12000; habitRateByDate[d] = 0.95;
    }
    const out = buildPatterns(entries, workByDate, spendByDate, doneTasksByDate, sleepMinByDate, stepsByDate, habitRateByDate);
    expect(out.length).toBeLessThanOrEqual(6);
  });
});

describe('moodPatterns — extractKeywords (reużywane przez buildPatterns dla "najczęściej stresują")', () => {
  test('słowo powtórzone w notatkach przy złym nastroju → w negative', () => {
    const entries = [
      entry({ mood: 1, note: 'straszny korek rano' }),
      entry({ mood: 2, note: 'kolejny korek dzisiaj' }),
    ];
    const { negative } = extractKeywords(entries);
    expect(negative.some(k => k.word === 'korek')).toBe(true);
  });
});
