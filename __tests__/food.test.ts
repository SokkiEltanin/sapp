import { purchasedCatForName, buildPurchasedCatIndex } from '@/utils/food';
import { Expense, ReceiptItem } from '@/types';

const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  name: 'x', price: 5, category: 'groceries', quantity: 1, unitPrice: 5, tags: [], ...o,
});

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 10, currency: 'PLN', category: 'groceries', tags: [], note: '',
  date: '2026-05-15T10:00:00', createdAt: '', updatedAt: '', type: 'expense', receiptItems: [], ...o,
} as Expense);

// helper matching the caller convention (build the index once, then look up by name) —
// see `buildPurchasedCatIndex` in utils/food.ts for why this is two steps, not one.
const catFor = (name: string, expenses: Expense[]) => purchasedCatForName(name, buildPurchasedCatIndex(expenses));

// 2026-09-02, user: "kupię drożdżówkę i ją oflaguję że to pieczywo/słodycz - jak zaznaczę że
// zjadłem to trzeba żeby oflagowało że zjadłem słodycz i tracę streak" — bridges wydatki (tagi
// na paragonie) → FoodProduct.cat (dziennik jedzenia), które dotąd były dwoma niepowiązanymi
// systemami mimo wspólnego słownika tagów (FOOD_SUBCATS === wartości w FOOD_TAG_MAP).
//
// Split into `buildPurchasedCatIndex` (sort+scan ONCE) + `purchasedCatForName` (O(1) lookup)
// 2026-09-04 — the original single-function version re-sorted the ENTIRE expense history on
// every call, and `app/food/product.tsx` called it from a `useEffect` keyed on the name TEXT
// INPUT, so it resorted on every keystroke. With a long expense history that's a JS-thread
// freeze severe enough to read as a black screen — the exact "Co zjadłem → Produkty → ciastka
// → Zapisz" grey-screen report from 2026-08-31 that was never actually fixed, just stopped
// reproducing until it did again.
describe('purchasedCatForName', () => {
  test('znajduje tag słodycze z paragonu po dokładnej (znormalizowanej) nazwie', () => {
    const expenses = [e({ receiptItems: [item({ name: 'Milka Alpejskie Mleko', tags: ['słodycze'] })] })];
    expect(catFor('milka alpejskie mleko', expenses)).toBe('słodycze');
  });

  test('brak dopasowania nazwy → undefined (nigdy nie zgaduje)', () => {
    const expenses = [e({ receiptItems: [item({ name: 'Mleko', tags: ['nabiał'] })] })];
    expect(catFor('drożdżówka', expenses)).toBeUndefined();
  });

  test('dopasowanie bez realnego tagu (sam "inne") → undefined, nie "inne"', () => {
    const expenses = [e({ receiptItems: [item({ name: 'Coś tam', tags: [] })] })];
    expect(catFor('coś tam', expenses)).toBeUndefined();
  });

  test('kilka zakupów pod tą samą nazwą — wygrywa NAJNOWSZY (re-tag na późniejszym paragonie)', () => {
    const expenses = [
      e({ date: '2026-05-01T10:00:00', receiptItems: [item({ name: 'Batonik', tags: ['słodycze'] })] }),
      e({ date: '2026-06-01T10:00:00', receiptItems: [item({ name: 'Batonik', tags: ['przekąski'] })] }),
    ];
    expect(catFor('Batonik', expenses)).toBe('przekąski');
  });

  // Ta sama semantyka co pojedyncza-nazwa pętla w oryginale: najnowszy zakup BEZ realnego
  // tagu nie "wygrywa" pustką — indeks patrzy dalej wstecz aż znajdzie użyteczny tag.
  test('najnowszy zakup bez tagu nie blokuje starszego z realnym tagiem', () => {
    const expenses = [
      e({ date: '2026-05-01T10:00:00', receiptItems: [item({ name: 'Batonik', tags: ['słodycze'] })] }),
      e({ date: '2026-06-01T10:00:00', receiptItems: [item({ name: 'Batonik', tags: [] })] }),
    ];
    expect(catFor('Batonik', expenses)).toBe('słodycze');
  });

  test('pusta nazwa lub brak wydatków → undefined', () => {
    expect(catFor('', [])).toBeUndefined();
    expect(catFor('cokolwiek', [])).toBeUndefined();
  });
});
