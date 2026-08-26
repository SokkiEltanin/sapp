import { fmtMissionCountdown } from '@/utils/missions';

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
