import { matchSubscriptionForPayment, isConfidentSubMatch, subscriptionPriceChanged, subscriptionLifetimeTotal } from '@/utils/subscriptionAuto';
import { Subscription, Expense } from '@/types';

const sub = (o: any): Subscription => ({ active: true, name: 'X', amount: 0, currency: 'PLN', nextBillingDate: '2026-08-01', ...o } as any);
const exp = (o: any): Expense => ({ id: 'e', amount: 0, currency: 'PLN', category: 'other', tags: [], note: '', date: '2026-08-01', createdAt: '', updatedAt: '', ...o } as any);

describe('subscriptionAuto — matchSubscriptionForPayment', () => {
  test('nazwa + termin (due) → dopasowanie (kwota nieistotna, np. obca waluta)', () => {
    const s = sub({ name: 'Netflix', amount: 43, nextBillingDate: '2026-08-01' });
    expect(matchSubscriptionForPayment({ store: 'NETFLIX.COM', amount: 999, dateISO: '2026-08-04' }, [s])).toBe(s);
  });
  test('nie w terminie → null', () => {
    const s = sub({ name: 'Netflix', amount: 43, nextBillingDate: '2026-12-01' });
    expect(matchSubscriptionForPayment({ store: 'Netflix', amount: 43, dateISO: '2026-08-04' }, [s])).toBeNull();
  });
  test('fallback: unikalna kwota due bez nazwy sklepu → dopasowanie', () => {
    const s = sub({ name: 'Spotify', amount: 29.99, nextBillingDate: '2026-08-03' });
    expect(matchSubscriptionForPayment({ amount: 29.99, dateISO: '2026-08-04' }, [s])).toBe(s);
  });
  test('fallback niejednoznaczny (2 subskrypcje tej samej kwoty) → null', () => {
    const a = sub({ name: 'A', amount: 20, nextBillingDate: '2026-08-03' });
    const b = sub({ name: 'B', amount: 20, nextBillingDate: '2026-08-03' });
    expect(matchSubscriptionForPayment({ amount: 20, dateISO: '2026-08-04' }, [a, b])).toBeNull();
  });
  test('nieaktywne subskrypcje pomijane', () => {
    const s = sub({ name: 'Netflix', amount: 43, active: false, nextBillingDate: '2026-08-01' });
    expect(matchSubscriptionForPayment({ store: 'Netflix', amount: 43, dateISO: '2026-08-04' }, [s])).toBeNull();
  });
});

describe('subscriptionAuto — isConfidentSubMatch', () => {
  test('ta sama waluta + bliska kwota → true', () => {
    expect(isConfidentSubMatch({ amount: 43, currency: 'PLN', dateISO: '2026-08-04' }, sub({ amount: 43 }))).toBe(true);
  });
  test('inna waluta → false (kwota pływa z kursem)', () => {
    expect(isConfidentSubMatch({ amount: 43, currency: 'EUR', dateISO: '2026-08-04' }, sub({ amount: 43 }))).toBe(false);
  });
  test('kwota za daleko → false', () => {
    expect(isConfidentSubMatch({ amount: 100, currency: 'PLN', dateISO: '2026-08-04' }, sub({ amount: 43 }))).toBe(false);
  });
});

describe('subscriptionAuto — subscriptionPriceChanged', () => {
  test('ta sama kwota → false', () => {
    expect(subscriptionPriceChanged({ amount: 43, currency: 'PLN', dateISO: '2026-08-04' }, sub({ amount: 43 }))).toBe(false);
  });
  test('drobne zaokrąglenie (poniżej progu 5%/2zł) → false, NIE alarmuj', () => {
    expect(subscriptionPriceChanged({ amount: 43.5, currency: 'PLN', dateISO: '2026-08-04' }, sub({ amount: 43 }))).toBe(false);
  });
  test('realna podwyżka (>5% i >2zł) → true', () => {
    expect(subscriptionPriceChanged({ amount: 52, currency: 'PLN', dateISO: '2026-08-04' }, sub({ amount: 43 }))).toBe(true);
  });
  test('podwyżka na małej kwocie — próg absolutny (2 zł) chroni przed szumem na groszach', () => {
    // 10% z 10zł = 1zł, poniżej absolutnego progu 2zł → NIE alarmuj mimo że isConfidentSubMatch
    // (próg 15%) i tak by to przepuściło jako "tę samą" subskrypcję.
    expect(subscriptionPriceChanged({ amount: 11, currency: 'PLN', dateISO: '2026-08-04' }, sub({ amount: 10 }))).toBe(false);
    expect(subscriptionPriceChanged({ amount: 13, currency: 'PLN', dateISO: '2026-08-04' }, sub({ amount: 10 }))).toBe(true);
  });
  test('inna waluta → false (kwota pływa z kursem, nie da się porównać wprost)', () => {
    expect(subscriptionPriceChanged({ amount: 52, currency: 'EUR', dateISO: '2026-08-04' }, sub({ amount: 43 }))).toBe(false);
  });
  test('cena spadła (obniżka) też jest wykrywana — |diff|, nie tylko podwyżka w górę', () => {
    expect(subscriptionPriceChanged({ amount: 30, currency: 'PLN', dateISO: '2026-08-04' }, sub({ amount: 43 }))).toBe(true);
  });
});

describe('subscriptionAuto — subscriptionLifetimeTotal', () => {
  test('sumuje wszystkie historyczne wydatki dopasowane po nazwie, nie tylko najnowszy', () => {
    const s = sub({ name: 'Netflix' });
    const es = [
      exp({ note: 'NETFLIX.COM', amount: 43, date: '2026-06-01' }),
      exp({ note: 'Netflix', amount: 43, date: '2026-07-01' }),
      exp({ note: 'Netflix', amount: 52, date: '2026-08-01' }),
    ];
    const r = subscriptionLifetimeTotal(s, es);
    expect(r).toEqual({ total: 138, count: 3, firstDate: '2026-06-01' });
  });

  test('dopasowanie po nazwie w storeName też się liczy', () => {
    const s = sub({ name: 'Spotify Premium' });
    const es = [exp({ storeName: 'SPOTIFY', note: '', amount: 19.99, date: '2026-05-10' })];
    expect(subscriptionLifetimeTotal(s, es)).toEqual({ total: 19.99, count: 1, firstDate: '2026-05-10' });
  });

  test('niedopasowane wydatki (inny sklep) pomijane', () => {
    const s = sub({ name: 'Netflix' });
    const es = [exp({ note: 'Lidl', amount: 100, date: '2026-06-01' })];
    expect(subscriptionLifetimeTotal(s, es)).toEqual({ total: 0, count: 0, firstDate: null });
  });

  test('income nigdy nie liczy się do sumy', () => {
    const s = sub({ name: 'Netflix' });
    const es = [exp({ type: 'income', note: 'Netflix', amount: 500, date: '2026-06-01' })];
    expect(subscriptionLifetimeTotal(s, es)).toEqual({ total: 0, count: 0, firstDate: null });
  });

  test('brak żadnych wydatków → zera, firstDate null', () => {
    expect(subscriptionLifetimeTotal(sub({ name: 'Netflix' }), [])).toEqual({ total: 0, count: 0, firstDate: null });
  });
});
