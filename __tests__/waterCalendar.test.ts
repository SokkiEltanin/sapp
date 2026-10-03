import { ymd, fmtDay, tierAlpha } from '@/utils/waterCalendar';

describe('ymd', () => {
  it('formatuje datę jako YYYY-MM-DD z zerami wiodącymi', () => {
    expect(ymd(new Date(2026, 0, 5))).toBe('2026-01-05');
    expect(ymd(new Date(2026, 11, 31))).toBe('2026-12-31');
  });
});

describe('fmtDay', () => {
  it('"Dziś" dla daty równej today', () => {
    expect(fmtDay('2026-10-03', '2026-10-03')).toBe('Dziś');
  });
  it('"Wczoraj" dla dnia poprzedniego', () => {
    expect(fmtDay('2026-10-02', '2026-10-03')).toBe('Wczoraj');
  });
  it('"Wczoraj" poprawnie na przełomie miesiąca', () => {
    expect(fmtDay('2026-09-30', '2026-10-01')).toBe('Wczoraj');
  });
  it('"Wczoraj" poprawnie na przełomie roku', () => {
    expect(fmtDay('2025-12-31', '2026-01-01')).toBe('Wczoraj');
  });
  it('zwykła data jako D.MM.RRRR dla reszty dni', () => {
    expect(fmtDay('2026-09-15', '2026-10-03')).toBe('15.09.2026');
  });
});

describe('tierAlpha', () => {
  it('pusty string dla 0 lub ujemnej ilości', () => {
    expect(tierAlpha(0, 8)).toBe('');
    expect(tierAlpha(-1, 8)).toBe('');
  });
  it('najniższy tier dla niewielkiego ułamka celu', () => {
    expect(tierAlpha(1, 8)).toBe('22');
  });
  it('pełna alpha dokładnie przy osiągnięciu celu', () => {
    expect(tierAlpha(8, 8)).toBe('FF');
  });
  it('pełna alpha przy przekroczeniu celu (capped, nie wychodzi poza FF)', () => {
    expect(tierAlpha(20, 8)).toBe('FF');
  });
  it('środkowe kwintyle rosną monotonicznie z ilością', () => {
    const tiers = [1, 2, 3, 4, 5, 6, 7, 8].map(n => tierAlpha(n, 8));
    const idx = (a: string) => ['22', '55', '88', 'BB', 'FF'].indexOf(a);
    for (let i = 1; i < tiers.length; i++) expect(idx(tiers[i])).toBeGreaterThanOrEqual(idx(tiers[i - 1]));
  });
  it('cel=0 nie dzieli przez zero (traktuje jak cel=1)', () => {
    expect(() => tierAlpha(1, 0)).not.toThrow();
    expect(tierAlpha(1, 0)).toBe('FF');
  });
});
