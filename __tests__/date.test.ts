import { ymd, todayISO, localISO } from '@/utils/date';

// Zamraża regułę „północ to nie północ": kubełki dnia MUSZĄ być liczone lokalnie, nie w UTC.
// Gdyby ktoś wrócił do new Date().toISOString() jako daty wpisu, te testy się wywalą.
describe('date — LOKALNE kubełki dnia', () => {
  test('ymd formatuje datę jako lokalne YYYY-MM-DD (miesiąc 0-based)', () => {
    expect(ymd(new Date(2026, 7, 3, 12, 0, 0))).toBe('2026-08-03'); // 7 = sierpień
  });

  test('ymd dopełnia zerami miesiąc i dzień', () => {
    expect(ymd(new Date(2026, 0, 5, 9, 0, 0))).toBe('2026-01-05');
  });

  test('localISO NIE ma końcowego Z, a jego 10 pierwszych znaków = lokalny dzień', () => {
    const d = new Date(2026, 7, 3, 0, 30, 15); // 00:30 lokalnie — tuż po północy
    const iso = localISO(d);
    expect(iso).toBe('2026-08-03T00:30:15');
    expect(iso.endsWith('Z')).toBe(false);
    expect(iso.slice(0, 10)).toBe(ymd(d)); // cała apka kubełkuje przez slice(0,10)
  });

  test('localISO tuż po północy NIE przeskakuje na wczoraj (istota buga)', () => {
    const d = new Date(2026, 7, 3, 0, 30, 0);
    expect(localISO(d).slice(0, 10)).toBe('2026-08-03');
  });

  test('todayISO == ymd(teraz)', () => {
    expect(todayISO()).toBe(ymd(new Date()));
  });
});
