import { correlationInsights, DailyPoint } from '@/utils/correlations';

// Punkty izolujące JEDNĄ parę metryk naraz (reszta pól niedopełniona), żeby korelacja
// jednej pary nie "przeciekała" do innej przez wspólne pole. xs=1..8, ys skalowane liniowo
// (idealna korelacja) albo wymieszane w konkretnym stopniu — wartości r zweryfikowane
// ręcznie (node -e) przed napisaniem asercji, nie zgadywane.
const points = (a: keyof DailyPoint, avals: number[], b: keyof DailyPoint, bvals: number[]): DailyPoint[] =>
  avals.map((av, i) => ({ [a]: av, [b]: bvals[i] } as DailyPoint));

describe('correlationInsights — wykrywanie i próg siły (MIN_R=0.35, MIN_N=8)', () => {
  test('idealna dodatnia korelacja (r=1) → wykryta, treść "pozytywna", etykieta "wyraźnie"', () => {
    const pts = points('sleepH', [1, 2, 3, 4, 5, 6, 7, 8], 'mood', [1, 2, 3, 4, 5, 6, 7, 8]);
    const res = correlationInsights(pts);
    expect(res).toHaveLength(1);
    expect(res[0].text).toContain('Gdy śpisz dłużej, masz lepszy nastrój');
    expect(res[0].text).toContain('wyraźnie');
    expect(res[0].strength).toBeCloseTo(1);
  });

  test('idealna UJEMNA korelacja → używa wariantu "neg" opisu, nie "pos"', () => {
    const pts = points('sleepH', [1, 2, 3, 4, 5, 6, 7, 8], 'mood', [8, 7, 6, 5, 4, 3, 2, 1]);
    const res = correlationInsights(pts);
    expect(res[0].text).toContain('Dłuższy sen idzie u Ciebie w parze z gorszym nastrojem');
  });

  test('za mało nakładających się dni (7 < MIN_N=8) → odrzucone mimo idealnej korelacji', () => {
    const pts = points('sleepH', [1, 2, 3, 4, 5, 6, 7], 'mood', [1, 2, 3, 4, 5, 6, 7]);
    expect(correlationInsights(pts)).toEqual([]);
  });

  test('dokładnie 8 nakładających się dni → już wystarcza (granica włączona)', () => {
    const pts = points('sleepH', [1, 2, 3, 4, 5, 6, 7, 8], 'mood', [1, 2, 3, 4, 5, 6, 7, 8]);
    expect(correlationInsights(pts)).toHaveLength(1);
  });

  test('brakujące/niefinitne wartości nie liczą się do "nakładających się dni"', () => {
    // 10 dni, ale tylko 8 mają OBIE wartości (2 mają braki/NaN) — powinno się nadal łapać,
    // bo licznik nakładania patrzy na PARY, nie na długość tablicy wejściowej.
    const pts: DailyPoint[] = [
      ...points('sleepH', [1, 2, 3, 4, 5, 6, 7, 8], 'mood', [1, 2, 3, 4, 5, 6, 7, 8]),
      { sleepH: 9 }, // brak mood
      { mood: 9, sleepH: NaN }, // niefinitne sleepH
    ];
    const res = correlationInsights(pts);
    expect(res).toHaveLength(1);
    expect(res[0].text).toContain('8 dni'); // nie 10 — braki wykluczone z licznika
  });

  test('słaba korelacja (|r| < 0.35) → odrzucona jako szum', () => {
    const pts = points('sleepH', [1, 2, 3, 4, 5, 6, 7, 8], 'mood', [8, 1, 6, 2, 7, 3, 5, 4]);
    expect(correlationInsights(pts)).toEqual([]);
  });
});

describe('correlationInsights — etykiety siły (progi 0.45 / 0.6, MIN_R=0.35 już przeszedł)', () => {
  test('r≈0.39 (pasmo [0.35,0.45)) → etykieta "lekko"', () => {
    const pts = points('sleepH', [1, 2, 3, 4, 5, 6, 7, 8], 'mood', [5.48, 1.36, 4.92, 2.72, 6.28, 4.08, 5.72, 5.44]);
    const res = correlationInsights(pts);
    expect(res[0].text).toContain('lekko');
  });

  test('r≈0.47 (pasmo [0.45,0.6)) → etykieta "zauważalnie"', () => {
    const pts = points('sleepH', [1, 2, 3, 4, 5, 6, 7, 8], 'mood', [5.2, 1.4, 4.8, 2.8, 6.2, 4.2, 5.8, 5.6]);
    const res = correlationInsights(pts);
    expect(res[0].text).toContain('zauważalnie');
  });
});

describe('correlationInsights — sortowanie i limit top-3', () => {
  test('gdy kwalifikuje się więcej niż 3 pary, zwraca dokładnie 3, posortowane malejąco po sile', () => {
    // Zestaw dni, gdzie WSZYSTKIE 5 par metryk koreluje (nieuniknione przy współdzielonych
    // kolumnach) — test sprawdza NIEZMIENNIK (limit + malejąca kolejność), nie konkretne
    // pary, bo przy remisach siły dokładny skład zależy od stabilności sortowania.
    const pts: DailyPoint[] = [1, 2, 3, 4, 5, 6, 7, 8].map((_, i) => ({
      sleepH: [5, 6, 7, 8, 6, 7, 5, 8][i],
      steps: [3000, 5000, 9000, 12000, 6000, 8000, 4000, 11000][i],
      mood: [2, 3, 4, 5, 3, 4, 2, 5][i],
      spend: [80, 60, 40, 20, 55, 45, 90, 25][i],
    }));
    const res = correlationInsights(pts);
    expect(res).toHaveLength(3);
    expect(res[0].strength).toBeGreaterThanOrEqual(res[1].strength);
    expect(res[1].strength).toBeGreaterThanOrEqual(res[2].strength);
  });

  test('brak punktów → pusta lista, nie crash', () => {
    expect(correlationInsights([])).toEqual([]);
  });
});
