import { findReimbursementCandidate } from '@/utils/reimbursementMatch';
import { Expense } from '@/types';

const exp = (o: Partial<Expense>): Expense => ({
  id: 'e1', amount: 0, currency: 'PLN', category: 'other' as any, tags: [], note: '',
  date: '2026-09-01', createdAt: '', updatedAt: '', ...o,
} as Expense);

describe('reimbursementMatch — findReimbursementCandidate', () => {
  test('częściowy zwrot od partnerki za wspólne zakupy — user\'s dokładny przykład (50 zł za 116,69 zł)', () => {
    const e = exp({ id: 'shop1', amount: 116.69, note: 'Lidl', date: '2026-09-20T12:00:00.000Z' });
    const cand = findReimbursementCandidate({ amount: 50, dateISO: '2026-09-22T10:00:00.000Z' }, [e]);
    expect(cand?.expense.id).toBe('shop1');
    expect(cand?.remaining).toBe(116.69);
  });

  test('pełny zwrot (dokładna kwota) też się łapie', () => {
    const e = exp({ id: 'shop1', amount: 80, date: '2026-09-20T12:00:00.000Z' });
    const cand = findReimbursementCandidate({ amount: 80, dateISO: '2026-09-21T10:00:00.000Z' }, [e]);
    expect(cand?.expense.id).toBe('shop1');
  });

  test('przelew WIĘKSZY niż wydatek → nie kandyduje (nie da się zwrócić więcej niż wydano)', () => {
    const e = exp({ id: 'shop1', amount: 50, date: '2026-09-20T12:00:00.000Z' });
    expect(findReimbursementCandidate({ amount: 80, dateISO: '2026-09-21T10:00:00.000Z' }, [e])).toBeNull();
  });

  test('poza oknem czasowym (>14 dni) → null', () => {
    const e = exp({ id: 'shop1', amount: 100, date: '2026-09-01T12:00:00.000Z' });
    expect(findReimbursementCandidate({ amount: 50, dateISO: '2026-09-20T10:00:00.000Z' }, [e])).toBeNull();
  });

  test('przelew PRZED zakupem (zła kolejność) → null', () => {
    const e = exp({ id: 'shop1', amount: 100, date: '2026-09-25T12:00:00.000Z' });
    expect(findReimbursementCandidate({ amount: 50, dateISO: '2026-09-20T10:00:00.000Z' }, [e])).toBeNull();
  });

  test('drobna kwota poniżej progu (np. 3 zł) → null, nie każdy BLIK to zwrot za zakupy', () => {
    const e = exp({ id: 'shop1', amount: 100, date: '2026-09-20T12:00:00.000Z' });
    expect(findReimbursementCandidate({ amount: 3, dateISO: '2026-09-21T10:00:00.000Z' }, [e])).toBeNull();
  });

  test('już w pełni zwrócone (reimbursedAmount == amount) → nie kandyduje ponownie', () => {
    const e = exp({ id: 'shop1', amount: 80, reimbursedAmount: 80, date: '2026-09-20T12:00:00.000Z' });
    expect(findReimbursementCandidate({ amount: 20, dateISO: '2026-09-21T10:00:00.000Z' }, [e])).toBeNull();
  });

  test('częściowo już zwrócone → kolejny zwrot dopasowuje się do REMAINING, nie pełnej kwoty', () => {
    const e = exp({ id: 'shop1', amount: 100, reimbursedAmount: 40, date: '2026-09-20T12:00:00.000Z' });
    const cand = findReimbursementCandidate({ amount: 60, dateISO: '2026-09-21T10:00:00.000Z' }, [e]);
    expect(cand?.expense.id).toBe('shop1');
    expect(cand?.remaining).toBe(60);
  });

  test('income wpisy nigdy nie kandydują (tylko wydatki)', () => {
    const e = exp({ id: 'inc1', type: 'income' as any, amount: 100, date: '2026-09-20T12:00:00.000Z' });
    expect(findReimbursementCandidate({ amount: 50, dateISO: '2026-09-21T10:00:00.000Z' }, [e])).toBeNull();
  });

  test('kilka kandydatów → wybiera najbliższy w czasie/kwocie (najwyższy score)', () => {
    const old = exp({ id: 'old', amount: 200, date: '2026-09-10T12:00:00.000Z' });
    const recent = exp({ id: 'recent', amount: 50, date: '2026-09-20T12:00:00.000Z' });
    const cand = findReimbursementCandidate({ amount: 50, dateISO: '2026-09-21T10:00:00.000Z' }, [old, recent]);
    expect(cand?.expense.id).toBe('recent');
  });
});
