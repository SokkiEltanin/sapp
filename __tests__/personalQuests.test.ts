import { ageFrom, targetsFor } from '@/utils/personalQuests';

describe('personalQuests — ageFrom', () => {
  test('brak daty urodzenia → null', () => {
    expect(ageFrom(null)).toBeNull();
  });

  test('zły format → null (nie rzuca)', () => {
    expect(ageFrom('nie-data')).toBeNull();
  });

  test('urodziny już były w tym roku → pełny wiek', () => {
    const today = new Date(2026, 7, 15); // 2026-08-15
    expect(ageFrom('2000-01-01', today)).toBe(26);
  });

  test('urodziny JESZCZE nie były w tym roku → o rok mniej', () => {
    const today = new Date(2026, 7, 15); // 2026-08-15
    expect(ageFrom('2000-12-31', today)).toBe(25);
  });

  test('urodziny DOKŁADNIE dziś → już liczy nowy rok', () => {
    const today = new Date(2026, 7, 15);
    expect(ageFrom('2000-08-15', today)).toBe(26);
  });
});

describe('personalQuests — targetsFor', () => {
  test('brak poziomu → traktowany jak początkujący', () => {
    expect(targetsFor(null, null, null)).toEqual(targetsFor('poczatkujacy', null, null));
  });

  test('wyższy poziom → wyższe cele pompek/przysiadów, ten sam rower', () => {
    const beg = targetsFor('poczatkujacy', null, null);
    const adv = targetsFor('zaawansowany', null, null);
    expect(adv.pushups).toBeGreaterThan(beg.pushups);
    expect(adv.squats).toBeGreaterThan(beg.squats);
  });

  test('wiek 50+ łagodzi cele, nigdy nie zbija do zera', () => {
    const young = targetsFor('zaawansowany', 25, null);
    const old = targetsFor('zaawansowany', 55, null);
    expect(old.pushups).toBeLessThan(young.pushups);
    expect(old.squats).toBeLessThan(young.squats);
    expect(old.pushups).toBeGreaterThanOrEqual(3);
    expect(old.squats).toBeGreaterThanOrEqual(5);
  });

  test('płeć koryguje TYLKO pompki, nie przysiady/rower', () => {
    const m = targetsFor('sredni', null, 'mężczyzna');
    const k = targetsFor('sredni', null, 'kobieta');
    expect(k.pushups).toBeLessThan(m.pushups);
    expect(k.squats).toBe(m.squats);
    expect(k.bikeMinutes).toBe(m.bikeMinutes);
  });
});
