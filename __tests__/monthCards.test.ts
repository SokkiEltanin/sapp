import { buildMonthCards, MonthCardCtx } from '@/utils/monthCards';
import { Expense, MoodEntry } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 10, currency: 'PLN', category: 'groceries', tags: [], note: '',
  date: '2026-05-15T10:00:00', createdAt: '', updatedAt: '', type: 'expense', receiptItems: [], ...o,
} as Expense);

const mood = (o: Partial<MoodEntry>): MoodEntry => ({
  id: 'm', mood: 4, date: '2026-05-15', createdAt: '', updatedAt: '', ...o,
} as MoodEntry);

const baseCtx = (over: Partial<MonthCardCtx> = {}): MonthCardCtx => ({
  expenses: [], moodEntries: [], healthDays: {}, payMonths: [], nameAliases: {}, ...over,
});

// 2026-08-31, user (realny eksport danych): 39 z ~48 kandydujących miesięcy to były
// prawie puste karty "same kroki" — Health Connect synchronizuje historię kroków z LAT
// zanim user zaczął używać reszty apki (wydatki/nastrój), więc `healthDays` samo w sobie
// obejmuje dużo szerszy zakres niż realne "miesiące z Sapp". Karta ma powstawać TYLKO gdy
// miesiąc ma realny sygnał (wydatek/nastrój/wypłata), kroki tylko WZBOGACAJĄ już
// kwalifikujący się miesiąc.
describe('monthCards — buildMonthCards (odcięcie pustych miesięcy tylko-z-krokami)', () => {
  test('miesiąc TYLKO z krokami (bez wydatku/nastroju) NIE dostaje karty', () => {
    const cards = buildMonthCards(baseCtx({
      healthDays: { '2026-05-10': { steps: 15000, sleepMinutes: 400, weightKg: null } },
    }));
    expect(cards).toHaveLength(0);
  });

  test('miesiąc z wydatkiem dostaje kartę i jest WZBOGACONY krokami z tego samego miesiąca', () => {
    const cards = buildMonthCards(baseCtx({
      expenses: [e({ date: '2026-05-15T10:00:00' })],
      healthDays: { '2026-05-10': { steps: 15000, sleepMinutes: 400, weightKg: null } },
    }));
    expect(cards).toHaveLength(1);
    expect(cards[0].month).toBe('2026-05');
    expect(cards[0].steps).toBe(15000);
  });

  test('miesiąc z samym wpisem nastroju (bez wydatku) też dostaje kartę', () => {
    const cards = buildMonthCards(baseCtx({ moodEntries: [mood({ date: '2026-05-15' })] }));
    expect(cards).toHaveLength(1);
    expect(cards[0].month).toBe('2026-05');
  });

  test('mieszany zbiór: tylko miesiące z realnym sygnałem trafiają do kolekcji', () => {
    const cards = buildMonthCards(baseCtx({
      expenses: [e({ date: '2026-06-01T10:00:00' })],
      healthDays: {
        '2022-10-01': { steps: 12000, sleepMinutes: 400, weightKg: null },  // tylko kroki — pomijany
        '2026-06-05': { steps: 8000, sleepMinutes: 400, weightKg: null },   // wzbogaca 2026-06
      },
    }));
    expect(cards.map(c => c.month)).toEqual(['2026-06']);
    expect(cards[0].steps).toBe(8000);
  });

  test('brak jakichkolwiek danych → pusta kolekcja', () => {
    expect(buildMonthCards(baseCtx())).toEqual([]);
  });
});

// 2026-09-01, user: "dodałeś do tych kart więcej danych żeby nie były takie nudne???" —
// `healthDays` niosło sen/wagę od początku (MonthCardCtx), ale karta czytała z niego tylko
// kroki. `avgSleepH`/`weightStartKg`/`weightEndKg`/`weightChangeKg` teraz też liczone.
describe('monthCards — buildMonthCards (sen i waga)', () => {
  test('avgSleepH: średnia z dni, które MAJĄ dane o śnie (0 traktowane jako brak danych)', () => {
    const cards = buildMonthCards(baseCtx({
      expenses: [e({ date: '2026-05-15T10:00:00' })],
      healthDays: {
        '2026-05-10': { steps: 0, sleepMinutes: 420, weightKg: null },  // 7h
        '2026-05-11': { steps: 0, sleepMinutes: 480, weightKg: null },  // 8h
        '2026-05-12': { steps: 0, sleepMinutes: 0, weightKg: null },    // brak danych — pomijany
      },
    }));
    expect(cards[0].avgSleepH).toBeCloseTo(7.5, 5);
  });

  test('brak jakichkolwiek dni ze snem → avgSleepH: null', () => {
    const cards = buildMonthCards(baseCtx({ expenses: [e({ date: '2026-05-15T10:00:00' })] }));
    expect(cards[0].avgSleepH).toBeNull();
  });

  test('waga: pierwszy/ostatni pomiar W KOLEJNOŚCI DAT (nie kolejności wstawiania) i ich różnica', () => {
    const cards = buildMonthCards(baseCtx({
      expenses: [e({ date: '2026-05-15T10:00:00' })],
      healthDays: {
        '2026-05-20': { steps: 0, sleepMinutes: 0, weightKg: 70 },   // wstawione pierwsze, ale to NIE jest pierwsza data
        '2026-05-01': { steps: 0, sleepMinutes: 0, weightKg: 72 },
        '2026-05-10': { steps: 0, sleepMinutes: 0, weightKg: 71 },   // środek miesiąca — nie liczy się
      },
    }));
    expect(cards[0].weightStartKg).toBe(72);
    expect(cards[0].weightEndKg).toBe(70);
    expect(cards[0].weightChangeKg).toBeCloseTo(-2, 5);
  });

  test('tylko JEDEN pomiar wagi w miesiącu → weightChangeKg: null (brak dwóch punktów do porównania)', () => {
    const cards = buildMonthCards(baseCtx({
      expenses: [e({ date: '2026-05-15T10:00:00' })],
      healthDays: { '2026-05-10': { steps: 0, sleepMinutes: 0, weightKg: 70 } },
    }));
    expect(cards[0].weightStartKg).toBe(70);
    expect(cards[0].weightEndKg).toBe(70);
    expect(cards[0].weightChangeKg).toBeNull();
  });
});
