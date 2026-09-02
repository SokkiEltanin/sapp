import { purchasedCatForName } from '@/utils/food';
import { Expense, ReceiptItem } from '@/types';

const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  name: 'x', price: 5, category: 'groceries', quantity: 1, unitPrice: 5, tags: [], ...o,
});

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 10, currency: 'PLN', category: 'groceries', tags: [], note: '',
  date: '2026-05-15T10:00:00', createdAt: '', updatedAt: '', type: 'expense', receiptItems: [], ...o,
} as Expense);

// 2026-09-02, user: "kupię drożdżówkę i ją oflaguję że to pieczywo/słodycz - jak zaznaczę że
// zjadłem to trzeba żeby oflagowało że zjadłem słodycz i tracę streak" — bridges wydatki (tagi
// na paragonie) → FoodProduct.cat (dziennik jedzenia), które dotąd były dwoma niepowiązanymi
// systemami mimo wspólnego słownika tagów (FOOD_SUBCATS === wartości w FOOD_TAG_MAP).
describe('purchasedCatForName', () => {
  test('znajduje tag słodycze z paragonu po dokładnej (znormalizowanej) nazwie', () => {
    const expenses = [e({ receiptItems: [item({ name: 'Milka Alpejskie Mleko', tags: ['słodycze'] })] })];
    expect(purchasedCatForName('milka alpejskie mleko', expenses)).toBe('słodycze');
  });

  test('brak dopasowania nazwy → undefined (nigdy nie zgaduje)', () => {
    const expenses = [e({ receiptItems: [item({ name: 'Mleko', tags: ['nabiał'] })] })];
    expect(purchasedCatForName('drożdżówka', expenses)).toBeUndefined();
  });

  test('dopasowanie bez realnego tagu (sam "inne") → undefined, nie "inne"', () => {
    const expenses = [e({ receiptItems: [item({ name: 'Coś tam', tags: [] })] })];
    expect(purchasedCatForName('coś tam', expenses)).toBeUndefined();
  });

  test('kilka zakupów pod tą samą nazwą — wygrywa NAJNOWSZY (re-tag na późniejszym paragonie)', () => {
    const expenses = [
      e({ date: '2026-05-01T10:00:00', receiptItems: [item({ name: 'Batonik', tags: ['słodycze'] })] }),
      e({ date: '2026-06-01T10:00:00', receiptItems: [item({ name: 'Batonik', tags: ['przekąski'] })] }),
    ];
    expect(purchasedCatForName('Batonik', expenses)).toBe('przekąski');
  });

  test('pusta nazwa lub brak wydatków → undefined', () => {
    expect(purchasedCatForName('', [])).toBeUndefined();
    expect(purchasedCatForName('cokolwiek', [])).toBeUndefined();
  });
});
