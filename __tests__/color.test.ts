import { normalizeHex, hexToHsv, hsvToHex } from '@/utils/color';

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

describe('hexToHsv/hsvToHex (§388 — panel koloru)', () => {
  test('czyste kolory podstawowe', () => {
    expect(hexToHsv('#FF0000')).toEqual({ h: 0, s: 1, v: 1 });
    expect(hexToHsv('#00FF00')).toEqual({ h: 120, s: 1, v: 1 });
    expect(hexToHsv('#0000FF')).toEqual({ h: 240, s: 1, v: 1 });
  });

  test('biały/czarny/szary — nasycenie 0, odcień niezdefiniowany (0)', () => {
    expect(hexToHsv('#FFFFFF')).toEqual({ h: 0, s: 0, v: 1 });
    expect(hexToHsv('#000000')).toEqual({ h: 0, s: 0, v: 0 });
    expect(hexToHsv('#808080')).toMatchObject({ s: 0 });
  });

  test('hsvToHex odwraca hexToHsv (round-trip) dla kilku kolorów', () => {
    for (const hex of ['#3B82F6', '#EF4444', '#22C55E', '#F59E0B', '#8B5CF6', '#FFFFFF', '#000000']) {
      const { h, s, v } = hexToHsv(hex);
      expect(hsvToHex(h, s, v)).toBe(hex);
    }
  });

  test('hsvToHex — odcień zawija się (ujemny/>360 daje ten sam kolor co znormalizowany)', () => {
    expect(hsvToHex(-120, 1, 1)).toBe(hsvToHex(240, 1, 1));
    expect(hsvToHex(480, 1, 1)).toBe(hsvToHex(120, 1, 1));
  });
});
