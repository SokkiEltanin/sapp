import { generateMonthlyReport, getMonthBounds } from '@/utils/monthlyReports';
import { Expense, ReceiptItem, MoodEntry, Task } from '@/types';

const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  name: '', price: 0, category: 'groceries', quantity: 1, unitPrice: 0, tags: [], ...o,
} as ReceiptItem);
const exp = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'groceries', tags: [], note: '',
  date: '2026-08-15T10:00:00', createdAt: '', updatedAt: '', ...o,
} as Expense);
const mood = (o: Partial<MoodEntry>): MoodEntry => ({
  id: 'm', date: '2026-08-15', mood: 3, energy: 3, tags: [], createdAt: '', updatedAt: '', ...o,
} as MoodEntry);
const task = (o: Partial<Task>): Task => ({
  id: 't', title: '', status: 'pending', priority: 'medium', tags: [], createdAt: '', updatedAt: '', ...o,
} as Task);

const MONTH = '2026-08';
const base = () => ({ month: MONTH, moodEntries: [] as MoodEntry[], tasks: [] as Task[], expenses: [] as Expense[], events: [] });

describe('monthlyReports — getMonthBounds (obsługa lat przestępnych / końca miesiąca)', () => {
  test('luty nieprzestępny → 28, przestępny → 29', () => {
    expect(getMonthBounds('2026-02').end).toBe('2026-02-28');
    expect(getMonthBounds('2028-02').end).toBe('2028-02-29');
  });
  test('miesiąc 31-dniowy i 30-dniowy', () => {
    expect(getMonthBounds('2026-08').end).toBe('2026-08-31');
    expect(getMonthBounds('2026-04').end).toBe('2026-04-30');
  });
});

describe('generateMonthlyReport — priorytet wiadomości highlight (izolowane gałęzie)', () => {
  test('A: średni nastrój >=4 → "Dobry miesiąc", wygrywa nade wszystkim', () => {
    const r = generateMonthlyReport({ ...base(), moodEntries: [mood({ mood: 5 })] });
    expect(r.highlight).toMatch(/Dobry miesiąc/);
  });

  test('B: brak wysokiego nastroju, ale produktywność >=80% → "Produktywny miesiąc"', () => {
    const tasks = [
      ...Array.from({ length: 4 }, (_, i) => task({ id: `d${i}`, status: 'done', scheduledDate: '2026-08-10' })),
      task({ id: 'p', status: 'pending', scheduledDate: '2026-08-11' }),
    ]; // 4/5 = 80%
    const r = generateMonthlyReport({ ...base(), tasks });
    expect(r.highlight).toMatch(/Produktywny miesiąc/);
  });

  test('C: brak nastroju/produktywności, ale finanse na plusie → "Finanse na plusie"', () => {
    const expenses = [
      exp({ type: 'income', amount: 500 }),
      exp({ amount: 200 }),
    ];
    const r = generateMonthlyReport({ ...base(), expenses });
    expect(r.highlight).toMatch(/Finanse na plusie/);
  });

  test('D: bez nastroju/produktywności/plusa finansowego, słodycze >30% wydatków na jedzenie → "Słodycze to X%"', () => {
    const expenses = [exp({ amount: 100, category: 'groceries', receiptItems: [item({ price: 40, tags: ['słodycze'] })] })];
    const r = generateMonthlyReport({ ...base(), expenses });
    expect(r.highlight).toMatch(/Słodycze to 40%/);
  });

  test('E: zupełny brak danych (żadnych wpisów nastroju) → "Brak wpisów nastroju"', () => {
    const r = generateMonthlyReport(base());
    expect(r.highlight).toMatch(/Brak wpisów nastroju/);
  });

  test('F: są wpisy nastroju (ale <4 średnio) i nic innego się nie wyróżnia → ogólne podsumowanie', () => {
    const r = generateMonthlyReport({ ...base(), moodEntries: [mood({ mood: 2 })] });
    expect(r.highlight).toMatch(/dni z wpisem nastroju/);
  });
});

describe('generateMonthlyReport — agregacje (nie tylko highlight)', () => {
  test('bestDay/worstDay wybierane po ŚREDNIEJ z danego dnia, nie po pierwszym wpisie', () => {
    const r = generateMonthlyReport({ ...base(), moodEntries: [
      mood({ date: '2026-08-05', mood: 5 }),
      mood({ date: '2026-08-10', mood: 1 }),
      mood({ date: '2026-08-15', mood: 3 }),
    ] });
    expect(r.mood.bestDay).toBe('2026-08-05');
    expect(r.mood.worstDay).toBe('2026-08-10');
  });

  test('wpisy/zadania/wydatki spoza miesiąca są wykluczone z agregacji', () => {
    const r = generateMonthlyReport({
      month: MONTH,
      moodEntries: [mood({ date: '2026-07-31', mood: 5 })], // dzień przed granicą
      tasks: [task({ scheduledDate: '2026-09-01', status: 'done' })], // dzień po granicy
      expenses: [exp({ date: '2026-07-31T23:59:00', amount: 999 })],
      events: [],
    });
    expect(r.mood.loggedDays).toBe(0);
    expect(r.tasks.total).toBe(0);
    expect(r.finances.totalSpend).toBe(0);
  });

  test('zadanie liczone po deadline gdy brak scheduledDate', () => {
    const r = generateMonthlyReport({ ...base(), tasks: [task({ deadline: '2026-08-20T00:00:00', status: 'done' })] });
    expect(r.tasks.total).toBe(1);
    expect(r.tasks.completed).toBe(1);
  });

  test('topCategory to kategoria z najwyższą sumą wydatków, nie pierwsza z brzegu', () => {
    const r = generateMonthlyReport({ ...base(), expenses: [
      exp({ category: 'groceries', amount: 50 }),
      exp({ category: 'transport', amount: 300 }),
    ] });
    expect(r.finances.topCategory).toBe('transport');
  });

  test('przychody nie liczą się do foodSpend/sweetsSpend/totalSpend', () => {
    const r = generateMonthlyReport({ ...base(), expenses: [
      exp({ type: 'income', amount: 1000, category: 'groceries', receiptItems: [item({ price: 500, tags: ['słodycze'] })] }),
    ] });
    expect(r.finances.totalSpend).toBe(0);
    expect(r.finances.foodSpend).toBe(0);
    expect(r.finances.sweetsSpend).toBe(0);
    expect(r.finances.totalIncome).toBe(1000);
  });
});
