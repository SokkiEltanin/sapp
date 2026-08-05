import { advanceNextBillingDate, isDurationExpired } from '@/utils/dashboard/subs';
import { Subscription } from '@/types';

const sub = (o: Partial<Subscription>): Subscription => (o as any as Subscription);

describe('dashboard/subs — daty rozliczeń', () => {
  test('advanceNextBillingDate: każdy cykl', () => {
    expect(advanceNextBillingDate('2026-08-04', 'weekly')).toBe('2026-08-11');
    expect(advanceNextBillingDate('2026-08-04', 'monthly')).toBe('2026-09-04');
    expect(advanceNextBillingDate('2026-08-04', 'quarterly')).toBe('2026-11-04');
    expect(advanceNextBillingDate('2026-08-04', 'yearly')).toBe('2027-08-04');
  });

  test('advanceNextBillingDate: rollover miesiąca (zachowanie JS Date)', () => {
    expect(advanceNextBillingDate('2026-01-31', 'monthly')).toBe('2026-03-03');
  });

  test('isDurationExpired: brak duration/startDate → false', () => {
    expect(isDurationExpired(sub({ durationMonths: 0, startDate: '2020-01-01' }))).toBe(false);
    expect(isDurationExpired(sub({ durationMonths: 3 }))).toBe(false);
  });

  test('isDurationExpired: dawno miniona → true, w przyszłości → false', () => {
    expect(isDurationExpired(sub({ startDate: '2020-01-01', durationMonths: 1 }))).toBe(true);
    expect(isDurationExpired(sub({ startDate: '2099-01-01', durationMonths: 12 }))).toBe(false);
  });
});
