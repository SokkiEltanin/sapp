import { mondayOf, weekChipInfo, fmtDateStr } from '@/utils/weekChips';

describe('mondayOf', () => {
  test('środa → poniedziałek tego samego tygodnia', () => {
    const wed = new Date(2026, 8, 30); // 2026-09-30 (śr)
    expect(fmtDateStr(mondayOf(wed))).toBe('2026-09-28');
  });

  test('poniedziałek → zostaje tym samym dniem', () => {
    const mon = new Date(2026, 8, 28); // 2026-09-28 (pon)
    expect(fmtDateStr(mondayOf(mon))).toBe('2026-09-28');
  });

  test('niedziela → poniedziałek POPRZEDNIEGO tygodnia (nie następnego)', () => {
    const sun = new Date(2026, 9, 4); // 2026-10-04 (nd)
    expect(fmtDateStr(mondayOf(sun))).toBe('2026-09-28');
  });
});

describe('weekChipInfo', () => {
  const wed = new Date(2026, 8, 30); // 2026-09-30 (śr) — tydzień 28 wrz–4 paź

  test('ten tydzień (weeksFromNow=0) — niedziela tego tygodnia', () => {
    const { sundayStr } = weekChipInfo(0, wed);
    expect(sundayStr).toBe('2026-10-04');
  });

  test('przyszły tydzień (weeksFromNow=1) — 7 dni dalej', () => {
    const { sundayStr } = weekChipInfo(1, wed);
    expect(sundayStr).toBe('2026-10-11');
  });

  test('zakres przecinający miesiąc pokazuje obie nazwy miesięcy', () => {
    const { range } = weekChipInfo(0, wed);
    expect(range).toBe('28 wrz–4 paź');
  });

  test('zakres w tym samym miesiącu pokazuje nazwę miesiąca raz', () => {
    const midMonth = new Date(2026, 9, 14); // 2026-10-14 (śr) — tydzień 12–18 paź
    const { range } = weekChipInfo(0, midMonth);
    expect(range).toBe('12–18 paź');
  });

  test('ten i przyszły tydzień nigdy się nie pokrywają', () => {
    const a = weekChipInfo(0, wed);
    const b = weekChipInfo(1, wed);
    expect(a.sundayStr).not.toBe(b.sundayStr);
  });
});
