import { ymd, todayISO, localISO, nextDeadline } from '@/utils/date';

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

// 2026-09-20, audyt logika/optymalizacja — `setMonth` na dzień nieistniejący w kolejnym
// miesiącu PRZEWIJA (day overflow), nie przycina. Zadanie cykliczne "monthly" z deadline'em
// 31. dnia miesiąca po ukończeniu skakało na 3. dnia DWA miesiące dalej (luty pomijany
// całkowicie), a seria trwale dryfowała od tego momentu.
describe('nextDeadline — cykliczne zadania nie gubią miesiąca przy dniu 29-31', () => {
  test('daily/weekly dodają dni bez zmian', () => {
    expect(nextDeadline('2026-01-15T10:00:00', 'daily').slice(0, 10)).toBe('2026-01-16');
    expect(nextDeadline('2026-01-15T10:00:00', 'weekly').slice(0, 10)).toBe('2026-01-22');
  });

  test('monthly z 31. dnia stycznia → 28 lutego (przycięte), NIE 3 marca (przewinięte)', () => {
    expect(nextDeadline('2026-01-31T10:00:00', 'monthly').slice(0, 10)).toBe('2026-02-28');
  });

  test('monthly z 30. dnia listopada → 30 grudnia (zwykły przypadek, dzień istnieje)', () => {
    expect(nextDeadline('2026-11-30T10:00:00', 'monthly').slice(0, 10)).toBe('2026-12-30');
  });

  test('monthly z 15. dnia (bezpieczny środek miesiąca) → bez zmian w zachowaniu', () => {
    expect(nextDeadline('2026-01-15T10:00:00', 'monthly').slice(0, 10)).toBe('2026-02-15');
  });
});
