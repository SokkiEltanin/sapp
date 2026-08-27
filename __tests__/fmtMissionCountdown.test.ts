import { fmtMissionCountdown, missionBarFillPx } from '@/utils/missions';

// 2026-08-26: nowy licznik na pasku misji (user: "zamiast niego w pasku będzie dokładny czas w
// minutach i sekundach jakiś ładny licznik") — zastępuje `fmtMissionDuration` (zaokrągla do
// minut) tam, gdzie ma faktycznie tykać co sekundę.
describe('fmtMissionCountdown', () => {
  test('poniżej minuty: M:SS', () => {
    expect(fmtMissionCountdown(5000)).toBe('0:05');
  });

  test('pełne minuty i sekundy: M:SS', () => {
    expect(fmtMissionCountdown(65000)).toBe('1:05');
  });

  test('godziny: H:MM:SS z paddingiem minut', () => {
    expect(fmtMissionCountdown(3661000)).toBe('1:01:01');
  });

  test('zero/ujemne traktowane jako 0:00 (nie NaN, nie ujemne)', () => {
    expect(fmtMissionCountdown(0)).toBe('0:00');
    expect(fmtMissionCountdown(-5000)).toBe('0:00');
  });

  test('zaokrągla do pełnej sekundy', () => {
    expect(fmtMissionCountdown(59600)).toBe('1:00');
  });
});

// 2026-08-27, user ze screenshotem: "pasek misji w trakcie wychodzi poza [ramkę], dziwnie się
// rozciąga zamiast wypełniać" — wypełnienie liczone w %, przy małym progresie przeliczało się
// na węższe wypełnienie niż promień zaokrąglenia lewego kapsla, Android nie przycinał tego
// poprawnie. `missionBarFillPx` liczy wypełnienie w PX z twardym minimum, żeby kapsel zawsze
// miał miejsce na poprawne zaokrąglenie.
describe('missionBarFillPx', () => {
  test('progres 0 → 0px, niezależnie od szerokości paska (nie sugerujemy fałszywego postępu)', () => {
    expect(missionBarFillPx(0, 400, 34)).toBe(0);
  });

  test('bardzo mały realny progres → podłoga minPx, nie węższy ułamek px', () => {
    expect(missionBarFillPx(0.001, 400, 34)).toBe(34); // 0.001×400=0.4px, ucięte do minPx
  });

  test('duży progres → realna szerokość, minPx nie ogranicza od góry', () => {
    expect(missionBarFillPx(0.5, 400, 34)).toBe(200);
  });

  test('progres 1 → pełna szerokość paska', () => {
    expect(missionBarFillPx(1, 400, 34)).toBe(400);
  });

  test('brak zmierzonej szerokości paska (jeszcze przed onLayout) → 0', () => {
    expect(missionBarFillPx(0.5, 0, 34)).toBe(0);
  });
});
