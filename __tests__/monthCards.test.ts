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
