import { isSelfTransfer } from '@/utils/statWidgets';
import { looksLikeBill } from '@/utils/recurringBills';
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
