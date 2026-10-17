import { normalizeHex } from '@/utils/color';

describe('normalizeHex', () => {
  test('akceptuje 6-cyfrowy hex z # i bez, zwraca znormalizowany z # i wielkimi literami', () => {
    expect(normalizeHex('#ff8800')).toBe('#FF8800');
    expect(normalizeHex('ff8800')).toBe('#FF8800');
    expect(normalizeHex('FF8800')).toBe('#FF8800');
  });

  test('ucina białe znaki dookoła', () => {
    expect(normalizeHex('  #38bdf8  ')).toBe('#38BDF8');
  });

  test('odrzuca złą długość/niehex znaki', () => {
    expect(normalizeHex('#fff')).toBeNull();
    expect(normalizeHex('#ff88000')).toBeNull();
    expect(normalizeHex('#gggggg')).toBeNull();
    expect(normalizeHex('')).toBeNull();
    expect(normalizeHex('nie hex')).toBeNull();
  });
});
