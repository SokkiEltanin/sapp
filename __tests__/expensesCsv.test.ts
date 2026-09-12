import { expensesToCsv } from '@/utils/expensesCsv';
import { Expense } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'other', tags: [], note: '',
  date: '2026-08-04T10:00:00', createdAt: '', updatedAt: '', ...o,
} as Expense);

describe('expensesCsv — expensesToCsv', () => {
  test('nagłówek po polsku + BOM na początku', () => {
    const csv = expensesToCsv([]);
    expect(csv.startsWith('﻿')).toBe(true);
    expect(csv).toContain('Data,Typ,Kwota,Waluta,Kategoria,Tagi,Notatka,Sklep,Płatnik,Metoda płatności');
  });

  test('sortuje rosnąco po dacie, formatuje kwotę z kropką', () => {
    const csv = expensesToCsv([
      e({ date: '2026-08-10T09:00:00', amount: 12.5, category: 'groceries' }),
      e({ date: '2026-08-01T09:00:00', amount: 3, category: 'transport' }),
    ]);
    const lines = csv.split('\n').slice(1);
    expect(lines[0]).toContain('2026-08-01');
    expect(lines[0]).toContain('3.00');
    expect(lines[1]).toContain('2026-08-10');
    expect(lines[1]).toContain('12.50');
  });

  test('przychód vs wydatek, gotówka vs karta', () => {
    const csv = expensesToCsv([
      e({ type: 'income', amount: 100, category: 'salary' }),
      e({ amount: 50, category: 'other', paymentMethod: 'cash' }),
    ]);
    expect(csv).toContain('Przychód');
    expect(csv).toContain('Wydatek');
    expect(csv).toContain('Gotówka');
    expect(csv).toContain('Karta');
  });

  test('eskejpuje pola z przecinkiem/cudzysłowem w notatce', () => {
    const csv = expensesToCsv([e({ note: 'Zakup "specjalny", promocja' })]);
    expect(csv).toContain('"Zakup ""specjalny"", promocja"');
  });

  test('tagi łączone średnikiem', () => {
    const csv = expensesToCsv([e({ tags: ['jedzenie', 'słodycze'] })]);
    expect(csv).toContain('jedzenie; słodycze');
  });
});
