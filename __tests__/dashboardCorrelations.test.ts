import { pearson, strongestLinks, DailyMetrics } from '@/utils/dashboard/correlations';

describe('dashboard/correlations — pearson', () => {
  test('doskonała dodatnia/ujemna korelacja', () => {
    expect(pearson([[1, 2], [2, 4], [3, 6], [4, 8], [5, 10]])).toBeCloseTo(1);
    expect(pearson([[1, 10], [2, 8], [3, 6], [4, 4], [5, 2]])).toBeCloseTo(-1);
  });
  test('za mało par → null', () => {
    expect(pearson([[1, 1], [2, 2], [3, 3]])).toBeNull();
  });
  test('brak wariancji (płaska seria) → null', () => {
    expect(pearson([[1, 5], [2, 5], [3, 5], [4, 5], [5, 5]])).toBeNull();
  });
});

describe('dashboard/correlations — strongestLinks', () => {
  test('wykrywa silne sen→energia i sortuje wg siły', () => {
    // sen rośnie → energia rośnie (idealnie); słodycze bez związku
    const days: DailyMetrics[] = [
      { sleep: 300, energy: 1, sweets: 2 },
      { sleep: 360, energy: 2, sweets: 1 },
      { sleep: 420, energy: 3, sweets: 3 },
      { sleep: 480, energy: 4, sweets: 0 },
      { sleep: 540, energy: 5, sweets: 2 },
    ];
    const links = strongestLinks(days);
    expect(links.length).toBeGreaterThanOrEqual(1);
    expect(links[0].a).toBe('sleep');
    expect(links[0].b).toBe('energy');
    expect(links[0].positive).toBe(true);
    expect(links[0].strength).toBe('silna');
  });

  test('słabe/brak danych → brak linków', () => {
    expect(strongestLinks([{ sleep: 400 }, { mood: 3 }])).toEqual([]);
    expect(strongestLinks([])).toEqual([]);
  });

  test('ujemna korelacja słodycze→humor wykryta jako positive=false', () => {
    const days: DailyMetrics[] = [
      { sweets: 0, mood: 5 },
      { sweets: 1, mood: 4 },
      { sweets: 2, mood: 3 },
      { sweets: 3, mood: 2 },
      { sweets: 4, mood: 1 },
    ];
    const link = strongestLinks(days).find(l => l.a === 'sweets' && l.b === 'mood');
    expect(link?.positive).toBe(false);
    expect(link?.strength).toBe('silna');
  });
});
