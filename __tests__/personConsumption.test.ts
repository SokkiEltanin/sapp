import { buildPersonConsumption } from '@/utils/personConsumption';
import { Expense, ReceiptItem } from '@/types';

const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  name: '', price: 0, category: 'groceries', quantity: 1, unitPrice: 0, tags: [], ...o,
} as ReceiptItem);
const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'groceries', tags: [], note: '',
  date: '2026-08-04T10:00:00', createdAt: '', updatedAt: '', ...o,
} as Expense);
const persons = ['Ja', 'Partnerka'];

describe('buildPersonConsumption — scenariusz główny (podział, licznik, top słodycz)', () => {
  // Czekolada 10zł bez eaters (współdzielona) + Lizak 20zł tylko dla Ja.
  const exps = [e({ receiptItems: [
    item({ name: 'Czekolada', price: 10, tags: ['słodycze'], quantity: 1 }),
    item({ name: 'Lizak', price: 20, tags: ['słodycze'], quantity: 1, eaters: ['Ja'] }),
  ] })];
  const result = buildPersonConsumption(exps, persons, {}, '2026-08');

  test('sweetsSpend: współdzielone dzielone równo, otagowane w całości do osoby', () => {
    const ja = result.people.find(p => p.person === 'Ja')!;
    const partnerka = result.people.find(p => p.person === 'Partnerka')!;
    expect(ja.sweetsSpend).toBe(25);   // 5 (połowa czekolady) + 20 (cały lizak)
    expect(partnerka.sweetsSpend).toBe(5); // tylko połowa czekolady
  });

  test('sortowanie: osoba z większym sweetsSpend jest pierwsza', () => {
    expect(result.people[0].person).toBe('Ja');
  });

  test('sharedPct: udział słodyczy BEZ przypisanej osoby względem total', () => {
    expect(result.sharedPct).toBeCloseTo(10 / 30); // 10 współdzielone z 30 razem
  });

  test('anyTagged: true, bo lizak ma eaters', () => {
    expect(result.anyTagged).toBe(true);
  });

  test('topSweet: najdroższy (po udziale) produkt na osobę, nie pierwszy z brzegu', () => {
    const ja = result.people.find(p => p.person === 'Ja')!;
    const partnerka = result.people.find(p => p.person === 'Partnerka')!;
    expect(ja.topSweet?.name).toBe('Lizak');       // 20 > 5 udziału czekolady
    expect(partnerka.topSweet?.name).toBe('Czekolada'); // jedyny słodycz jaki dostała
  });

  test('sweetsCount: ułamkowe udziały sumowane i zaokrąglone na końcu', () => {
    const ja = result.people.find(p => p.person === 'Ja')!;
    const partnerka = result.people.find(p => p.person === 'Partnerka')!;
    expect(ja.sweetsCount).toBe(2);       // 0.5 (czekolada/2) + 1 (cały lizak, 1 zjadacz) = 1.5 → 2
    expect(partnerka.sweetsCount).toBe(1); // 0.5 → 1 (Math.round)
  });
});

describe('buildPersonConsumption — filtrowanie i klasyfikacja', () => {
  test('produkt BEZ tagu słodyczowego liczy się do foodSpend, ale NIE do sweetsSpend', () => {
    const exps = [e({ receiptItems: [item({ name: 'Ziemniaki', price: 20, tags: ['warzywa'] })] })];
    const result = buildPersonConsumption(exps, persons, {}, '2026-08');
    const ja = result.people.find(p => p.person === 'Ja')!;
    expect(ja.foodSpend).toBe(10); // współdzielone 20/2
    expect(ja.sweetsSpend).toBe(0);
    expect(result.totalSweets).toBe(0);
  });

  test('wydatek spoza wybranego miesiąca jest pomijany', () => {
    const exps = [e({ date: '2026-07-15T00:00:00', receiptItems: [item({ price: 10, tags: ['słodycze'] })] })];
    const result = buildPersonConsumption(exps, persons, {}, '2026-08');
    expect(result.totalSweets).toBe(0);
  });

  test('przychody (income) są pomijane', () => {
    const exps = [e({ type: 'income', receiptItems: [item({ price: 100, tags: ['słodycze'] })] })];
    const result = buildPersonConsumption(exps, persons, {}, '2026-08');
    expect(result.totalSweets).toBe(0);
  });

  test('pozycja wykluczona (excluded) lub kaucja (deposit) NIE liczy się do spożycia', () => {
    const exps = [e({ receiptItems: [
      item({ price: 10, tags: ['słodycze'], excluded: true }),
      item({ price: 5, tags: ['słodycze'], kind: 'deposit' }),
    ] })];
    const result = buildPersonConsumption(exps, persons, {}, '2026-08');
    expect(result.totalSweets).toBe(0);
  });

  test('brak jakichkolwiek danych → zera, nie crash', () => {
    const result = buildPersonConsumption([], persons, {}, '2026-08');
    expect(result.totalSweets).toBe(0);
    expect(result.sharedPct).toBe(0); // dzielenie przez 0 total ustrzeżone
    expect(result.anyTagged).toBe(false);
  });
});
