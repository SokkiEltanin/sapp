import { isSelfTransfer, dailyValue, metricNumber, metricList, StatCtx } from '@/utils/statWidgets';
import { looksLikeBill, billTagFor } from '@/utils/recurringBills';
import { Expense } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'other', date: '2026-08-04T10:00:00',
  createdAt: '', updatedAt: '', ...o,
} as Expense);

const ctx = (expenses: Expense[]): StatCtx => ({
  expenses, scope: 'all', moodEntries: [], workEvents: [],
  workSettings: {} as StatCtx['workSettings'], ratePerHour: 0, tasks: [],
  habitsTotal: 0, habitsDone: 0, nameAliases: {}, weightMemory: {},
  healthDays: {},
});

describe('statWidgets — isSelfTransfer', () => {
  test('kategoria transfer lub tag oszczędnościowy = self-transfer', () => {
    expect(isSelfTransfer(e({ category: 'transfer' as any, amount: 500 }))).toBe(true);
    expect(isSelfTransfer(e({ category: 'groceries', tags: ['revolut'] }))).toBe(true);
  });
  test('zwykły wydatek = nie', () => {
    expect(isSelfTransfer(e({ category: 'groceries', amount: 30 }))).toBe(false);
    expect(isSelfTransfer(e({ category: 'groceries', tags: ['chleb'] }))).toBe(false);
  });
});

// 2026-09-15, audyt poprawności — self-transfer wyciekał do 'food'/'sweets' w
// `dailyValue` (rok w pixelach) i do 'sweets' w `bucketValue` (dashboard/stats), mimo że
// siostrzane 'spend'/'income' w tych samych funkcjach go już wykluczały (ten sam kształt
// buga co §93, gdzie znaleziono 8 analogicznych miejsc).
describe('statWidgets — self-transfer wykluczony z food/sweets/byCategory', () => {
  const day = '2026-09-10';
  const transferFood = e({
    id: 't1', category: 'transfer' as any, tags: ['revolut'], amount: 100, date: `${day}T09:00:00`,
    receiptItems: [{ name: 'Bułka', price: 100, tags: ['pieczywo'] } as any],
  });
  const transferSweets = e({
    id: 't2', category: 'groceries', tags: ['przelew', 'słodycze'], amount: 50, date: `${day}T09:00:00`,
  });
  const realFood = e({
    id: 'r1', category: 'groceries', amount: 20, date: `${day}T09:00:00`,
    receiptItems: [{ name: 'Chleb', price: 20, tags: ['pieczywo'] } as any],
  });

  test('dailyValue food/sweets pomija self-transfer, ale nie prawdziwe wydatki', () => {
    expect(dailyValue('food', ctx([transferFood]), day)).toBe(0);
    expect(dailyValue('food', ctx([transferFood, realFood]), day)).toBe(20);
    expect(dailyValue('sweets', ctx([transferSweets]), day)).toBe(0);
  });

  test('metricNumber sweets (bucketValue) pomija self-transfer', () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const inMonth = e({ ...transferSweets, date: `${ym}-05T09:00:00` });
    expect(metricNumber('sweets', ctx([inMonth]), 'month').value).toBe(0);
  });

  test('metricList byCategory pomija self-transfer', () => {
    const now = new Date();
    const ym = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const transfer = e({ category: 'transfer' as any, amount: 500, date: `${ym}-05T09:00:00` });
    const real = e({ category: 'groceries', amount: 30, date: `${ym}-05T09:00:00` });
    const rows = metricList('byCategory', ctx([transfer, real]));
    expect(rows.find(r => r.label === 'transfer')).toBeUndefined();
    expect(rows.find(r => r.label === 'groceries')?.value).toBe(30);
  });
});

describe('recurringBills — looksLikeBill', () => {
  test('rozpoznaje rachunki po słowach-kluczach', () => {
    expect(looksLikeBill('czynsz sierpień')).toBe(true);
    expect(looksLikeBill('Internet Orange')).toBe(true);
    expect(looksLikeBill('Prąd Tauron')).toBe(true);
  });
  test('zwykły zakup ≠ rachunek', () => {
    expect(looksLikeBill('chleb masło mleko')).toBe(false);
    expect(looksLikeBill('')).toBe(false);
  });
});

// 2026-08-31 — user: "dodaj mi filtry po tagach np pge itp żeby wiedzieć ile płacę za
// prąd" — Finanse's "Rachunki" filter reuses this to recognize a bill by storeName
// (nie tylko note/tagi jak `looksLikeBill`), bo paragony/ręczne wpisy za prąd zwykle
// mają "PGE"/"Tauron" jako storeName, nie w note.
describe('recurringBills — billTagFor', () => {
  test('rozpoznaje po storeName (np. paragon/ręczny wpis bez note)', () => {
    expect(billTagFor(e({ storeName: 'PGE Obrót' }))).toEqual({ tag: 'prąd', name: 'Prąd', icon: 'Zap' });
    expect(billTagFor(e({ storeName: 'Tauron' }))).toEqual({ tag: 'prąd', name: 'Prąd', icon: 'Zap' });
  });
  test('rozpoznaje po note, jak dawniej', () => {
    expect(billTagFor(e({ note: 'Rachunek za prąd sierpień' }))).toEqual({ tag: 'prąd', name: 'Prąd', icon: 'Zap' });
  });
  test('zwykły zakup → null', () => {
    expect(billTagFor(e({ storeName: 'Biedronka', note: 'zakupy' }))).toBeNull();
  });
  // 2026-09-08, user: "czytelniejsze ikony ze to jest za internet" — każdy typ rachunku
  // ma teraz WŁASNĄ ikonę (lucide-react-native, resolvowana dynamicznie jak CATEGORY_META),
  // nie tylko wspólną ikonę kategorii ('housing' → dom dla wszystkich).
  test('każdy typ rachunku ma własną, różną ikonę', () => {
    expect(billTagFor(e({ note: 'Internet Orange' }))?.icon).toBe('Wifi');
    expect(billTagFor(e({ note: 'Czynsz wrzesień' }))?.icon).toBe('Home');
    expect(billTagFor(e({ note: 'Gaz ' }))?.icon).toBe('Flame');
    expect(billTagFor(e({ note: 'Woda i ścieki' }))?.icon).toBe('Droplet');
    expect(billTagFor(e({ note: 'Ogrzewanie miejskie' }))?.icon).toBe('Thermometer');
    expect(billTagFor(e({ note: 'Ubezpieczenie mieszkania' }))?.icon).toBe('Shield');
    expect(billTagFor(e({ note: 'Abonament telefon' }))?.icon).toBe('Phone');
  });
});
