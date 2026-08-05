import { kcalPer100g, estimateItemKcal, looksLikeFood, expenseFoodKcal, foodKcalForDate } from '@/utils/calories';
import { Expense } from '@/types';

// pozycje bez NAZWY (żeby wynik zależał od TAGU — deterministyczny; nazwy idą przez FOOD_KCAL).
const item = (o: any) => ({ name: '', price: 0, quantity: 1, tags: [], ...o });
const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'groceries', date: '2026-08-04T10:00:00',
  createdAt: '', updatedAt: '', ...o,
} as Expense);

describe('calories — kcalPer100g (po tagu)', () => {
  test('rozpoznaje tag (case-insensitive), 0 dla nie-jedzenia', () => {
    expect(kcalPer100g({ tags: ['słodycze'] })).toBe(450);
    expect(kcalPer100g({ tags: ['Warzywa'] })).toBe(35);
    expect(kcalPer100g({ tags: ['chemia'] })).toBe(0);
    expect(kcalPer100g({ tags: [] })).toBe(0);
  });
});

describe('calories — estimateItemKcal', () => {
  test('gramy z wagi × gęstość tagu', () => {
    expect(estimateItemKcal(item({ tags: ['słodycze'], weightKg: 0.1, quantity: 1 }))).toBe(450);
    expect(estimateItemKcal(item({ tags: ['warzywa'], weightKg: 0.2 }))).toBe(70);
  });
  test('brak wagi → 150 g na sztukę', () => {
    expect(estimateItemKcal(item({ tags: ['słodycze'], quantity: 2 }))).toBe(1350);
  });
  test('nierozpoznane / excluded / zjedzone przez kogoś innego → 0', () => {
    expect(estimateItemKcal(item({ tags: [], quantity: 1 }))).toBe(0);
    expect(estimateItemKcal(item({ tags: ['słodycze'], weightKg: 0.1, excluded: true }))).toBe(0);
    expect(estimateItemKcal(item({ tags: ['słodycze'], weightKg: 0.1, eaters: ['Partnerka'] }))).toBe(0);
  });
});

describe('calories — looksLikeFood', () => {
  test('tag jedzeniowy / groceries = true, śmieci = false', () => {
    expect(looksLikeFood({ tags: ['warzywa'] })).toBe(true);
    expect(looksLikeFood({ category: 'groceries' })).toBe(true);
    expect(looksLikeFood({ name: 'xyznonfood', tags: [], category: 'other' })).toBe(false);
  });
});

describe('calories — expenseFoodKcal / foodKcalForDate', () => {
  test('przychód lub brak paragonu → 0', () => {
    expect(expenseFoodKcal(e({ type: 'income', receiptItems: [item({ tags: ['słodycze'], weightKg: 0.1 })] as any }))).toBe(0);
    expect(expenseFoodKcal(e({ receiptItems: [] }))).toBe(0);
  });
  test('foodKcalForDate sumuje tylko dany dzień (bez przychodów)', () => {
    const exps = [
      e({ date: '2026-08-04T09:00:00', receiptItems: [item({ tags: ['słodycze'], weightKg: 0.1 }), item({ tags: ['warzywa'], weightKg: 0.2 })] as any }),
      e({ date: '2026-08-05T09:00:00', receiptItems: [item({ tags: ['słodycze'], weightKg: 0.1 })] as any }), // inny dzień
      e({ date: '2026-08-04T09:00:00', type: 'income', receiptItems: [item({ tags: ['słodycze'], weightKg: 1 })] as any }), // przychód
    ];
    expect(foodKcalForDate(exps, '2026-08-04')).toBe(520); // 450 + 70
  });
});
