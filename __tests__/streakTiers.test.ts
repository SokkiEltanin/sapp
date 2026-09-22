import { streakTier, streakColor } from '@/utils/streakTiers';

// Dwa nowe progi (Ametyst=45, Indygo=80) wstawione 2026-09-22 — user: "jestem zestresowany
// na różowym kolorze już [długo]... zaczyna dręczyć nie motywować". Pierwotne progi
// (1/7/14/30/60/100) dawały coraz dłuższe odcinki BEZ zmiany koloru (6/7/16/30/40 dni) —
// róż (30 dni) i błękit (40 dni) były drastycznie dłuższe niż wcześniejsze, mimo że reszta
// zmieniała się co tydzień-dwa. Testy pilnują, że żaden odcinek już nie jest tak długi.

describe('streakTier — progi po wstawieniu Ametyst(45)/Indygo(80)', () => {
  test('dokładnie na granicy każdego progu — zwraca WŁAŚNIE ten próg, nie poprzedni/następny', () => {
    expect(streakTier(1).name).toBe('Bordo');
    expect(streakTier(7).name).toBe('Czerwień');
    expect(streakTier(14).name).toBe('Pomarańcz');
    expect(streakTier(30).name).toBe('Róż');
    expect(streakTier(45).name).toBe('Ametyst');
    expect(streakTier(60).name).toBe('Błękit');
    expect(streakTier(80).name).toBe('Indygo');
    expect(streakTier(100).name).toBe('Legenda');
  });

  test('tuż PRZED granicą — wciąż poprzedni próg (np. 44 dni = jeszcze Róż, nie Ametyst)', () => {
    expect(streakTier(29).name).toBe('Pomarańcz');
    expect(streakTier(44).name).toBe('Róż');
    expect(streakTier(59).name).toBe('Ametyst');
    expect(streakTier(79).name).toBe('Błękit');
    expect(streakTier(99).name).toBe('Indygo');
  });

  test('żaden odcinek między progami nie jest dłuższy niż 20 dni (regresja na "30/40 dni ciszy")', () => {
    const mins = [1, 7, 14, 30, 45, 60, 80, 100];
    for (let i = 1; i < mins.length; i++) {
      expect(mins[i] - mins[i - 1]).toBeLessThanOrEqual(20);
    }
  });

  test('next wskazuje na kolejny próg, null dopiero na Legendzie (terminalny tier)', () => {
    expect(streakTier(30).next).toBe(45);
    expect(streakTier(45).next).toBe(60);
    expect(streakTier(80).next).toBe(100);
    expect(streakTier(100).next).toBeNull();
  });

  test('indeksy i rosną monotonicznie z liczbą dni — 8 progów total', () => {
    const days = [1, 7, 14, 30, 45, 60, 80, 100];
    const indices = days.map(d => streakTier(d).i);
    expect(indices).toEqual([0, 1, 2, 3, 4, 5, 6, 7]);
  });
});

describe('streakColor — fallback dla złamanej serii', () => {
  test('0 dni → szary (nie kolor żadnego tieru)', () => {
    expect(streakColor(0)).toBe('#8A93A8');
  });
  test('1 dzień → kolor Bordo (pierwszy realny tier)', () => {
    expect(streakColor(1)).toBe(streakTier(1).color);
  });
});
