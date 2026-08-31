import { isSelfTransfer } from '@/utils/statWidgets';
import { looksLikeBill, billTagFor } from '@/utils/recurringBills';
import { Expense } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'other', date: '2026-08-04T10:00:00',
  createdAt: '', updatedAt: '', ...o,
} as Expense);

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
    expect(billTagFor(e({ storeName: 'PGE Obrót' }))).toEqual({ tag: 'prąd', name: 'Prąd' });
    expect(billTagFor(e({ storeName: 'Tauron' }))).toEqual({ tag: 'prąd', name: 'Prąd' });
  });
  test('rozpoznaje po note, jak dawniej', () => {
    expect(billTagFor(e({ note: 'Rachunek za prąd sierpień' }))).toEqual({ tag: 'prąd', name: 'Prąd' });
  });
  test('zwykły zakup → null', () => {
    expect(billTagFor(e({ storeName: 'Biedronka', note: 'zakupy' }))).toBeNull();
  });
});
