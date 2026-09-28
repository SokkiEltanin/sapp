import { advanceNextBillingDate, isDurationExpired, rollOverdueSubscription } from '@/utils/recurringBills';

// 2026-09-20, audyt logika/optymalizacja — `setMonth`/`setFullYear` na dzień nieistniejący w
// docelowym miesiącu PRZEWIJA (day overflow), nie przycina. Subskrypcja z `nextBillingDate`
// 31. dnia miesiąca po jednym cichym auto-rollu (subscriptions.tsx's useEffect, bez pytania
// usera) lądowała na 3. dnia DWA miesiące dalej — luty (cały cykl płatności) znikał z
// prognozy po cichu, seria trwale dryfowała od tego momentu.
describe('advanceNextBillingDate — cykle płatności nie gubią miesiąca przy dniu 29-31', () => {
  test('weekly dodaje 7 dni bez zmian', () => {
    expect(advanceNextBillingDate('2026-01-15', 'weekly')).toBe('2026-01-22');
  });

  test('monthly z 31. dnia stycznia → 28 lutego (przycięte), NIE 3 marca (przewinięte)', () => {
    expect(advanceNextBillingDate('2026-01-31', 'monthly')).toBe('2026-02-28');
  });

  test('quarterly z 30. dnia listopada → 28 lutego (przycięte), NIE 2 marca', () => {
    expect(advanceNextBillingDate('2026-11-30', 'quarterly')).toBe('2027-02-28');
  });

  test('yearly z 29. lutego roku przestępnego → 28 lutego roku zwykłego (przycięte)', () => {
    expect(advanceNextBillingDate('2028-02-29', 'yearly')).toBe('2029-02-28');
  });

  test('monthly z bezpiecznego dnia (15.) → zwykłe dodanie miesiąca', () => {
    expect(advanceNextBillingDate('2026-01-15', 'monthly')).toBe('2026-02-15');
  });
});

describe('isDurationExpired — to samo dla durationMonths liczonych od startDate 29-31', () => {
  // startDate 31.01 + 1 miesiąc: PRZYCIĘTY koniec = 28.02, PRZEWINIĘTY (bug) koniec = 3.03 —
  // "dziś" ustawiony fake timerem na 1.03 leży MIĘDZY tymi dwiema datami, więc wynik
  // jednoznacznie rozstrzyga które zachowanie faktycznie działa (nie da się przypadkiem
  // trafić `true` z obu wariantów naraz).
  afterEach(() => { jest.useRealTimers(); });

  test('1.03 (po przyciętym końcu 28.02, ale PRZED przewiniętym 3.03) → wygasła', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-03-01T12:00:00'));
    expect(isDurationExpired({ durationMonths: 1, startDate: '2026-01-31' })).toBe(true);
  });

  test('27.02 (przed przyciętym końcem) → wciąż aktywna', () => {
    jest.useFakeTimers().setSystemTime(new Date('2026-02-27T12:00:00'));
    expect(isDurationExpired({ durationMonths: 1, startDate: '2026-01-31' })).toBe(false);
  });

  test('brak durationMonths/startDate → nigdy nie wygasa', () => {
    expect(isDurationExpired({ durationMonths: undefined, startDate: '2026-01-31' })).toBe(false);
    expect(isDurationExpired({ durationMonths: 1, startDate: undefined })).toBe(false);
    expect(isDurationExpired({ durationMonths: 0, startDate: '2026-01-31' })).toBe(false);
  });
});

describe('rollOverdueSubscription — wykrywanie martwej subskrypcji (2026-09-28)', () => {
  test('nie zaległa → null, missedCycles się nie zmienia', () => {
    expect(rollOverdueSubscription({ nextBillingDate: '2026-10-01', billingCycle: 'monthly', missedCycles: 0 }, '2026-09-28')).toBeNull();
  });

  test('zaległa dwa cykle (od 1.08, dziś 28.09 — 1.08 I 1.09 już minęły) → +2 missedCycles', () => {
    const r = rollOverdueSubscription({ nextBillingDate: '2026-08-01', billingCycle: 'monthly', missedCycles: 0 }, '2026-09-28');
    expect(r).toEqual({ nextBillingDate: '2026-10-01', missedCycles: 2 });
  });

  test('appka nieotwierana kilka miesięcy → wszystkie przegapione cykle liczą się naraz', () => {
    const r = rollOverdueSubscription({ nextBillingDate: '2026-05-01', billingCycle: 'monthly', missedCycles: 0 }, '2026-09-28');
    // maj, czerwiec, lipiec, sierpień, wrzesień — 5 minionych cykli
    expect(r).toEqual({ nextBillingDate: '2026-10-01', missedCycles: 5 });
  });

  test('kumuluje się z istniejącym missedCycles (nie resetuje)', () => {
    const r = rollOverdueSubscription({ nextBillingDate: '2026-08-01', billingCycle: 'monthly', missedCycles: 2 }, '2026-09-28');
    expect(r).toEqual({ nextBillingDate: '2026-10-01', missedCycles: 4 });
  });
});
