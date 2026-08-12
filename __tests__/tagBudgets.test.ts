import { ruleTags, ruleLabel, attributedPrice, computeTagSpend, getBudgetStatus, TagBudgetRule } from '@/utils/tagBudgets';

const rule = (o: Partial<TagBudgetRule>): TagBudgetRule => ({
  id: 'r1', tag: 'słodycze', limit: 100, period: 'month', createdAt: '', ...o,
});

describe('tagBudgets — ruleTags / ruleLabel', () => {
  test('tags[] ustawione i niepuste → używane zamiast pojedynczego tag', () => {
    expect(ruleTags(rule({ tags: ['słodycze', 'przekąski'] }))).toEqual(['słodycze', 'przekąski']);
  });
  test('brak tags[] lub puste → fallback do pojedynczego tag', () => {
    expect(ruleTags(rule({}))).toEqual(['słodycze']);
    expect(ruleTags(rule({ tags: [] }))).toEqual(['słodycze']);
  });

  test('etykieta: pojedynczy tag bez osoby', () => {
    expect(ruleLabel(rule({}))).toBe('#słodycze');
  });
  test('etykieta: kilka tagów łączonych "+"', () => {
    expect(ruleLabel(rule({ tags: ['słodycze', 'przekąski'] }))).toBe('#słodycze + #przekąski');
  });
  test('etykieta z osobą dokleja "· Osoba"', () => {
    expect(ruleLabel(rule({ person: 'Ja' }))).toBe('#słodycze · Ja');
  });
});

describe('tagBudgets — attributedPrice (podział kosztu pozycji między osoby)', () => {
  const persons = ['Ja', 'Partnerka'];

  test('brak wybranej osoby (pasek łączony) → pełna cena', () => {
    expect(attributedPrice({ price: 100 }, undefined, persons)).toBe(100);
  });
  test('pozycja BEZ eaters (nieotagowana) → dzielona równo między WSZYSTKICH', () => {
    expect(attributedPrice({ price: 100 }, 'Ja', persons)).toBe(50);
  });
  test('pozycja z eaters, osoba WŚRÓD nich → dzielona tylko między eaters', () => {
    expect(attributedPrice({ price: 90, eaters: ['Ja', 'Partnerka', 'Gość'] }, 'Ja', persons)).toBe(30);
  });
  test('pozycja z eaters, osoba POZA nimi → 0', () => {
    expect(attributedPrice({ price: 100, eaters: ['Partnerka'] }, 'Ja', persons)).toBe(0);
  });
  test('brak eaters i pusta lista osób → nie dzieli przez 0, pełna cena', () => {
    expect(attributedPrice({ price: 100 }, 'Ja', [])).toBe(100);
  });
});

describe('tagBudgets — getBudgetStatus (progi 0.8 / 1.0, oba włączone)', () => {
  test('poniżej 80% → ok', () => {
    expect(getBudgetStatus(79, 100)).toBe('ok');
  });
  test('dokładnie 80% → warning (granica włączona)', () => {
    expect(getBudgetStatus(80, 100)).toBe('warning');
  });
  test('między 80% a 100% → warning', () => {
    expect(getBudgetStatus(99, 100)).toBe('warning');
  });
  test('dokładnie 100% → exceeded (granica włączona)', () => {
    expect(getBudgetStatus(100, 100)).toBe('exceeded');
  });
  test('powyżej 100% → exceeded', () => {
    expect(getBudgetStatus(150, 100)).toBe('exceeded');
  });
  test('limit=0 bez wydatków → NaN nie przechodzi żadnego progu, spada do ok (nie crash)', () => {
    expect(getBudgetStatus(0, 0)).toBe('ok');
  });
});

describe('tagBudgets — computeTagSpend (zakres dat: tydzień od poniedziałku / miesiąc od 1.)', () => {
  // Testujemy KONTRAKT (dziś zawsze w zakresie, 8 dni temu / poprzedni miesiąc nigdy) zamiast
  // kopiować dokładny algorytm wyznaczania poniedziałku do testu — inaczej test powtórzyłby
  // ewentualnego buga zamiast go złapać. Sprawdzone ręcznie (node -e) że ta własność zachodzi
  // niezależnie od tego, na jaki dzień tygodnia wypada "dziś" w momencie odpalenia testu.
  const now = new Date();
  const fmt = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}T12:00:00`;
  const today = fmt(now);
  const eightDaysAgo = fmt(new Date(now.getFullYear(), now.getMonth(), now.getDate() - 8));
  const firstOfThisMonth = fmt(new Date(now.getFullYear(), now.getMonth(), 1));
  const lastOfPrevMonth = fmt(new Date(now.getFullYear(), now.getMonth(), 0));

  test('tydzień: dzisiejszy wydatek liczy się, sprzed 8 dni już nie', () => {
    const exps = [
      { tags: ['słodycze'], amount: 10, date: today },
      { tags: ['słodycze'], amount: 999, date: eightDaysAgo },
    ];
    expect(computeTagSpend(exps, 'słodycze', 'week')).toBe(10);
  });

  test('miesiąc: 1. dzień tego miesiąca liczy się, ostatni dzień POPRZEDNIEGO już nie', () => {
    const exps = [
      { tags: ['słodycze'], amount: 20, date: firstOfThisMonth },
      { tags: ['słodycze'], amount: 999, date: lastOfPrevMonth },
    ];
    expect(computeTagSpend(exps, 'słodycze', 'month')).toBe(20);
  });

  test('przychody (income) nigdy nie liczą się do wydanego budżetu', () => {
    const exps = [{ tags: ['słodycze'], amount: 500, date: today, type: 'income' }];
    expect(computeTagSpend(exps, 'słodycze', 'month')).toBe(0);
  });

  test('liczy tylko pozycje z dokładnie tym tagiem', () => {
    const exps = [
      { tags: ['słodycze'], amount: 10, date: today },
      { tags: ['warzywa'], amount: 999, date: today },
    ];
    expect(computeTagSpend(exps, 'słodycze', 'month')).toBe(10);
  });
});
