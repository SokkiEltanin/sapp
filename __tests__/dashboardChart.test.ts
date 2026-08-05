import { carryForward, lastNonZero, zoomFloor, compareVerdict } from '@/utils/dashboard/chart';

describe('dashboard/chart — transformacje serii', () => {
  test('carryForward przeciąga ostatnią znaną wartość przez zera', () => {
    expect(carryForward([0, 72, 0, 0, 73, 0])).toEqual([72, 72, 72, 72, 73, 73]);
  });
  test('carryForward: wiodące zera dostają pierwszą niezerową', () => {
    expect(carryForward([0, 0, 5])).toEqual([5, 5, 5]);
  });
  test('carryForward: same zera → same zera', () => {
    expect(carryForward([0, 0, 0])).toEqual([0, 0, 0]);
  });

  test('lastNonZero zwraca ostatnią wartość > 0', () => {
    expect(lastNonZero([1, 5, 0, 3, 0])).toBe(3);
    expect(lastNonZero([0, 0])).toBe(0);
    expect(lastNonZero([])).toBe(0);
  });

  test('zoomFloor przybliża wąskie wysokie pasmo', () => {
    // 71..73: hi=73, lo=71, lo > hi*0.3 → floor = 71 - (2)*0.5 = 70
    expect(zoomFloor([71, 72, 73])).toBeCloseTo(70);
  });
  test('zoomFloor: pasmo od zera / mało punktów → 0 (brak zoomu)', () => {
    expect(zoomFloor([0, 50])).toBe(0);   // <2 niezerowe
    expect(zoomFloor([1, 100])).toBe(0);  // lo nie > hi*0.3
    expect(zoomFloor([5])).toBe(0);
  });
});

describe('dashboard/chart — compareVerdict (Pearson)', () => {
  const M = '#888';
  test('dodatnia korelacja → idą w parze', () => {
    const v = compareVerdict([1, 2, 3, 4], [2, 4, 6, 8], M);
    expect(v?.text).toMatch(/w parze/);
    expect(v?.color).toBe('#2AC68F');
  });
  test('ujemna korelacja → przeciwnie', () => {
    const v = compareVerdict([1, 2, 3, 4], [8, 6, 4, 2], M);
    expect(v?.text).toMatch(/przeciwnie/);
    expect(v?.color).toBe('#F87171');
  });
  test('mniej niż 3 dopasowane pary → null', () => {
    expect(compareVerdict([1, 0, 0], [1, 0, 0], M)).toBeNull();
  });
});
