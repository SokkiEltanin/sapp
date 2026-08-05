import { matchSubscriptionForPayment, isConfidentSubMatch } from '@/utils/subscriptionAuto';
import { Subscription } from '@/types';

const sub = (o: any): Subscription => ({ active: true, name: 'X', amount: 0, currency: 'PLN', nextBillingDate: '2026-08-01', ...o } as any);

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
