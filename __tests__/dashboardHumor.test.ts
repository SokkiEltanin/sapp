import { humorLine, HUMOR } from '@/utils/dashboard/humor';

describe('dashboard/humor', () => {
  test('brak nastroju → stała zachęta', () => {
    expect(humorLine(undefined)).toBe('Czysty start. Jak się czujesz?');
  });

  test('znany nastrój → linia z właściwego koszyka', () => {
    for (const mood of [1, 2, 3, 4, 5]) {
      expect(HUMOR[mood]).toContain(humorLine(mood));
    }
  });

  test('nieznany nastrój → fallback do koszyka neutralnego (3)', () => {
    expect(HUMOR[3]).toContain(humorLine(99));
  });
});
