import { computeSavings } from '@/utils/savings';
import { Expense, ReceiptItem } from '@/types';

const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  name: '', price: 0, category: 'groceries', quantity: 1, unitPrice: 0, tags: [], ...o,
} as ReceiptItem);
const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'groceries', tags: [], note: '',
  date: '2026-08-04T10:00:00', createdAt: '', updatedAt: '', ...o,
} as Expense);
const NOW = new Date('2026-08-15T12:00:00');

describe('computeSavings — sumowanie rabatów z pozycji paragonu', () => {
  test('brak paragonów / brak rabatów → same zera, nie crash', () => {
    expect(computeSavings([], NOW)).toEqual({ total: 0, thisMonth: 0, lidlTotal: 0, count: 0 });
    expect(computeSavings([e({ receiptItems: [item({ discount: 0 })] })], NOW).total).toBe(0);
  });

  test('sumuje tylko pozycje z rabatem > 0, ignoruje resztę', () => {
    const exps = [e({ receiptItems: [
      item({ discount: 5 }), item({ discount: 0 }), item({}), item({ discount: 2.5 }),
    ] })];
    const s = computeSavings(exps, NOW);
    expect(s.total).toBe(7.5);
    expect(s.count).toBe(2); // tylko pozycje z discount>0 liczą się do count
  });

  test('przychody (income) nigdy nie wliczają się, nawet jeśli mają receiptItems', () => {
    const exps = [e({ type: 'income', receiptItems: [item({ discount: 100 })] })];
    expect(computeSavings(exps, NOW).total).toBe(0);
  });

  test('zaokrąglanie do 2 miejsc bez błędów zmiennoprzecinkowych (0.1+0.2)', () => {
    const exps = [e({ receiptItems: [item({ discount: 0.1 }), item({ discount: 0.2 })] })];
    expect(computeSavings(exps, NOW).total).toBe(0.3); // nie 0.30000000000000004
  });
});

describe('computeSavings — thisMonth (względem wstrzykniętego "now")', () => {
  test('paragon z bieżącego miesiąca liczy się do thisMonth', () => {
    const exps = [e({ date: '2026-08-01T00:00:00', receiptItems: [item({ discount: 10 })] })];
    expect(computeSavings(exps, NOW).thisMonth).toBe(10);
  });
  test('paragon z INNEGO miesiąca liczy się do total, ale NIE do thisMonth', () => {
    const exps = [e({ date: '2026-07-31T23:59:00', receiptItems: [item({ discount: 10 })] })];
    const s = computeSavings(exps, NOW);
    expect(s.total).toBe(10);
    expect(s.thisMonth).toBe(0);
  });
});

describe('computeSavings — lidlTotal (rozpoznawanie sklepu bez uwzględniania wielkości liter)', () => {
  test('storeName zawierający "lidl" (dowolna wielkość liter) liczy się do lidlTotal', () => {
    const exps = [
      e({ storeName: 'LIDL Hetmańska', receiptItems: [item({ discount: 3 })] }),
      e({ storeName: 'Biedronka', receiptItems: [item({ discount: 7 })] }),
    ];
    const s = computeSavings(exps, NOW);
    expect(s.lidlTotal).toBe(3);
    expect(s.total).toBe(10); // total liczy oba sklepy
  });
  test('brak storeName → nie crashuje, po prostu nie Lidl', () => {
    const exps = [e({ receiptItems: [item({ discount: 5 })] })];
    expect(computeSavings(exps, NOW).lidlTotal).toBe(0);
  });
});
