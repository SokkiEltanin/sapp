import { toYMD, mondayOf, fmtWeekRange, addDays, fmtDayLabel, fmtMonthLabel, monthGrid } from '@/utils/weekGrid';

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

describe('addDays — przesunięcie o N dni', () => {
  test('do przodu', () => {
    expect(toYMD(addDays(new Date('2026-09-23T12:00:00'), 1))).toBe('2026-09-24');
  });
  test('wstecz', () => {
    expect(toYMD(addDays(new Date('2026-09-23T12:00:00'), -1))).toBe('2026-09-22');
  });
  test('przez granicę miesiąca', () => {
    expect(toYMD(addDays(new Date('2026-09-30T12:00:00'), 1))).toBe('2026-10-01');
  });
});

describe('fmtDayLabel — nagłówek widoku dziennego (dopełniacz miesiąca)', () => {
  test('"Środa, 23 września"', () => {
    expect(fmtDayLabel(new Date('2026-09-23T12:00:00'))).toBe('Środa, 23 września');
  });
  test('niedziela', () => {
    expect(fmtDayLabel(new Date('2026-10-11T12:00:00'))).toBe('Niedziela, 11 października');
  });
});

describe('fmtMonthLabel — nagłówek widoku miesięcznego (mianownik)', () => {
  test('"Wrzesień 2026"', () => {
    expect(fmtMonthLabel(new Date('2026-09-23T12:00:00'))).toBe('Wrzesień 2026');
  });
});

describe('monthGrid — siatka kalendarza miesiąca, pełne tygodnie Pon-Nie', () => {
  test('wrzesień 2026 → 5 pełnych tygodni (35 komórek), doklejone dni sierpnia/października', () => {
    const weeks = monthGrid(new Date('2026-09-15T12:00:00'));
    expect(weeks).toHaveLength(5);
    const flat = weeks.flat();
    expect(flat).toHaveLength(35);
    expect(flat[0]).toEqual({ ymd: '2026-08-31', inMonth: false }); // pon, doklejony z sierpnia
    expect(flat[flat.length - 1]).toEqual({ ymd: '2026-10-04', inMonth: false }); // nie, doklejony z października
    expect(flat.filter(c => c.inMonth)).toHaveLength(30); // wrzesień ma 30 dni
  });

  test('listopad 2026 → 6 pełnych tygodni (42 komórki) — 1 listopada wypada w niedzielę', () => {
    const weeks = monthGrid(new Date('2026-11-15T12:00:00'));
    expect(weeks).toHaveLength(6);
    const flat = weeks.flat();
    expect(flat).toHaveLength(42);
    expect(flat[0]).toEqual({ ymd: '2026-10-26', inMonth: false });
    expect(flat[flat.length - 1]).toEqual({ ymd: '2026-12-06', inMonth: false });
    expect(flat.filter(c => c.inMonth)).toHaveLength(30); // listopad ma 30 dni
  });

  test('każdy tydzień ma dokładnie 7 komórek, zaczyna się w poniedziałek', () => {
    const weeks = monthGrid(new Date('2026-09-15T12:00:00'));
    for (const week of weeks) {
      expect(week).toHaveLength(7);
      expect(toYMD(mondayOf(new Date(week[0].ymd + 'T12:00:00')))).toBe(week[0].ymd);
    }
  });
});
