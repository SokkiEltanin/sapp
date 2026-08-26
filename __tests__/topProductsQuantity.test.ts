import { metricList, StatCtx } from '@/utils/statWidgets';
import { Expense, ReceiptItem } from '@/types';

// 2026-08-26: user zgłosił, że "NAJCZĘŚCIEJ KUPOWANE" na dashboardzie liczy ile razy produkt
// pojawił się na paragonie (+1 za linię), a nie ile sztuk faktycznie kupiono (`it.quantity`).
// Ten sam bug żył w 3 miejscach: `app/(tabs)/index.tsx`'s `topProducts` (sam dashboard),
// `statWidgets.ts`'s `metricList` (widget "Top produkty" w kreatorze statystyk — ta sama
// grupujaca logika, celowo trzymana w sync z dashboardem) i `app/products.tsx` (katalog
// produktów). Ten test pokrywa `metricList`, bo tylko ono jest eksportowane/testowalne bez
// renderowania komponentu.

function item(name: string, quantity: number, overrides: Partial<ReceiptItem> = {}): ReceiptItem {
  return { name, price: 1, category: 'groceries', quantity, unitPrice: 1, tags: [], ...overrides };
}

function expense(id: string, items: ReceiptItem[]): Expense {
  return {
    id, amount: 1, currency: 'PLN', category: 'groceries', tags: [], note: '',
    date: '2026-08-01T00:00:00.000Z', createdAt: '2026-08-01T00:00:00.000Z',
    updatedAt: '2026-08-01T00:00:00.000Z', receiptItems: items,
  };
}

function baseCtx(expenses: Expense[]): StatCtx {
  return {
    expenses, scope: 'all', moodEntries: [], workEvents: [],
    workSettings: {} as any, ratePerHour: 0, tasks: [], habitsTotal: 0, habitsDone: 0,
    nameAliases: {}, weightMemory: {}, healthDays: {},
  };
}

describe('metricList topProducts — liczy sztuki (quantity), nie linie paragonu', () => {
  test('jeden paragon, 5 sztuk tego samego produktu → count 5, nie 1', () => {
    const ctx = baseCtx([expense('e1', [item('Mleko', 5)])]);
    const rows = metricList('topProducts', ctx);
    expect(rows.find(r => r.label === 'Mleko')?.value).toBe(5);
  });

  test('kilka paragonów z różną ilością → sumuje quantity ze wszystkich', () => {
    const ctx = baseCtx([
      expense('e1', [item('Jogurt', 3)]),
      expense('e2', [item('Jogurt', 2)]),
    ]);
    const rows = metricList('topProducts', ctx);
    expect(rows.find(r => r.label === 'Jogurt')?.value).toBe(5);
  });

  test('quantity 0/ujemne/brak traktowane jako 1 sztuka (nie zeruje ani nie odejmuje)', () => {
    const ctx = baseCtx([expense('e1', [item('Chleb', 0)])]);
    const rows = metricList('topProducts', ctx);
    expect(rows.find(r => r.label === 'Chleb')?.value).toBe(1);
  });
});
