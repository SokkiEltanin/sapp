import { amountMatches, findMatchingExpense, findMatchingIncome, ParsedBankTx } from '@/utils/bankNotification';

// Fix (§366, 2026-10-18, audyt finansowy) — gdy transakcja walutowa (np. 9.99 EUR) jest
// ręcznie zatwierdzana w `bank-review.tsx` z `plnOverride` (np. 43.50 PLN), zapisany Expense
// ma `amount: 43.50` (PLN) + `originalAmount: 9.99` (oryginalna, walutowa kwota — patrz
// `commitBankTx`'s `originalFields`). Redostarczone/zdublowane powiadomienie o TEJ SAMEJ
// płatności wciąż niesie SUROWĄ, walutową kwotę (9.99 EUR) — porównanie WYŁĄCZNIE do `e.amount`
// (43.50) nigdy nie wykrywało takiego duplikatu, tworząc DRUGI wydatek na tę samą płatność.
describe('amountMatches (§366)', () => {
  test('dopasowuje po e.amount, gdy nie ma originalAmount (dotychczasowe zachowanie)', () => {
    expect(amountMatches({ amount: 60 }, 60)).toBe(true);
    expect(amountMatches({ amount: 60 }, 61)).toBe(false);
  });

  test('dopasowuje po originalAmount, gdy e.amount (po konwersji PLN) nie zgadza się z surową kwotą', () => {
    const e = { amount: 43.50, originalAmount: 9.99 };
    expect(amountMatches(e, 9.99)).toBe(true); // redostarczone powiadomienie, wciąż w EUR
    expect(amountMatches(e, 43.50)).toBe(true); // już-PLN też dalej dopasowuje
    expect(amountMatches(e, 15.00)).toBe(false); // zupełnie inna kwota — nie dopasowuje
  });

  test('tolerancja ±1gr działa identycznie dla originalAmount', () => {
    expect(amountMatches({ amount: 43.50, originalAmount: 9.99 }, 10.01)).toBe(false); // różnica 0.02 — za duża
    expect(amountMatches({ amount: 43.50, originalAmount: 9.995 }, 10.00)).toBe(true); // różnica 0.005 — w tolerancji
  });
});

function tx(amount: number, dateISO = '2026-10-18T10:00:00', direction: 'in' | 'out' = 'out'): ParsedBankTx {
  return { amount, currency: 'EUR', dateISO, store: 'TEST', storeKey: 'test', method: 'card', direction, raw: 'test' };
}

describe('findMatchingExpense — redostarczona płatność walutowa z plnOverride (§366)', () => {
  test('wykrywa duplikat po originalAmount, gdy redostarczone powiadomienie niesie surową kwotę walutową', () => {
    const existing = [{ id: 'e1', type: 'expense', amount: 43.50, originalAmount: 9.99, date: '2026-10-18T10:00:00', storeName: 'TEST' }];
    const match = findMatchingExpense(tx(9.99), existing);
    expect(match?.id).toBe('e1');
  });

  test('bez originalAmount zachowanie jak dawniej — brak dopasowania na innej kwocie', () => {
    const existing = [{ id: 'e1', type: 'expense', amount: 43.50, date: '2026-10-18T10:00:00', storeName: 'TEST' }];
    const match = findMatchingExpense(tx(9.99), existing);
    expect(match).toBeNull();
  });
});

describe('findMatchingIncome — redostarczony przychód walutowy z plnOverride (§366)', () => {
  test('wykrywa duplikat po originalAmount', () => {
    const existing = [{ id: 'e1', type: 'income', amount: 43.50, originalAmount: 9.99, date: '2026-10-18T10:00:00' }];
    const match = findMatchingIncome(tx(9.99, '2026-10-18T10:00:00', 'in'), existing);
    expect(match?.id).toBe('e1');
  });
});
