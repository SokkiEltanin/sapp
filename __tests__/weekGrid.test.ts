import { toYMD, mondayOf, fmtWeekRange } from '@/utils/weekGrid';

describe('mondayOf — poniedziałek tygodnia, w tym przypadek niedzieli (getDay()===0)', () => {
  test('środa → poniedziałek TEGO SAMEGO tygodnia (wstecz)', () => {
    expect(toYMD(mondayOf(new Date('2026-10-07T12:00:00')))).toBe('2026-10-05'); // śr → pon
  });
  test('poniedziałek → sam siebie', () => {
    expect(toYMD(mondayOf(new Date('2026-10-05T12:00:00')))).toBe('2026-10-05');
  });
  test('niedziela → poniedziałek TEGO SAMEGO (kończącego się) tygodnia, NIE tydzień naprzód', () => {
    // 2026-10-11 to niedziela — poniedziałek tego tygodnia to 2026-10-05, nie 2026-10-12.
    expect(toYMD(mondayOf(new Date('2026-10-11T12:00:00')))).toBe('2026-10-05');
  });
  test('sobota → poniedziałek tego samego tygodnia', () => {
    expect(toYMD(mondayOf(new Date('2026-10-10T12:00:00')))).toBe('2026-10-05');
  });
  test('przejście przez granicę miesiąca (niedziela 1 listopada → poniedziałek 26 października)', () => {
    expect(toYMD(mondayOf(new Date('2026-11-01T12:00:00')))).toBe('2026-10-26');
  });
});

describe('fmtWeekRange — czytelny zakres tygodnia', () => {
  test('tydzień w obrębie jednego miesiąca — data początku bez nazwy miesiąca', () => {
    const monday = new Date('2026-10-05T00:00:00');
    expect(fmtWeekRange(monday)).toBe('5 – 11 paź 2026');
  });
  test('tydzień na granicy miesięcy — obie daty z nazwą miesiąca', () => {
    const monday = new Date('2026-10-26T00:00:00'); // pon 26.10 → nie 1.11
    expect(fmtWeekRange(monday)).toBe('26 paź – 1 lis 2026');
  });
});

describe('toYMD — format YYYY-MM-DD z zero-paddingiem', () => {
  test('pojedyncze cyfry miesiąca/dnia dopełnione zerem', () => {
    expect(toYMD(new Date('2026-01-05T00:00:00'))).toBe('2026-01-05');
  });
});
