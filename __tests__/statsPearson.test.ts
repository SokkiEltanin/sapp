import { pearsonCoeff } from '@/utils/statsPearson';

// 2026-10-05, audyt trzech niezsynchronizowanych "silników korelacji" dot. humoru —
// `dashboard/correlations.ts` i `correlations.ts` miały dwie osobne, prawie identyczne
// implementacje tej samej matematyki. Ten plik pilnuje JEDYNEJ, wspólnej teraz wersji.
describe('statsPearson — pearsonCoeff', () => {
  test('doskonała dodatnia/ujemna korelacja', () => {
    expect(pearsonCoeff([1, 2, 3, 4, 5], [2, 4, 6, 8, 10])).toBeCloseTo(1);
    expect(pearsonCoeff([1, 2, 3, 4, 5], [10, 8, 6, 4, 2])).toBeCloseTo(-1);
  });

  test('brak wariancji (płaska seria) → null, nie 0 czy NaN', () => {
    expect(pearsonCoeff([1, 2, 3, 4, 5], [5, 5, 5, 5, 5])).toBeNull();
  });

  test('pusta lista → null', () => {
    expect(pearsonCoeff([], [])).toBeNull();
  });

  test('niezgodne długości → null (nigdy fałszywego wyniku)', () => {
    expect(pearsonCoeff([1, 2, 3], [1, 2])).toBeNull();
  });
});
