import { isFixedExpense, fixedVariableMonths, fixedDeviations, topVariableContributors, workBudgetProgress, bucketOf, bucketTransactions, fvSplitOf, FVMonth } from '@/utils/fixedVariable';
import { Expense, ReceiptItem } from '@/types';

const e = (o: Partial<Expense>): Expense => ({
  id: 'x', amount: 0, currency: 'PLN', category: 'other', date: '2026-08-04T10:00:00',
  createdAt: '', updatedAt: '', ...o,
} as Expense);

const item = (o: Partial<ReceiptItem>): ReceiptItem => ({
  name: 'x', price: 0, category: 'groceries', quantity: 1, unitPrice: 0, tags: [], ...o,
});

describe('fixedVariable — isFixedExpense', () => {
  test('housing/subscriptions = stałe; przychód/jedzenie = nie', () => {
    expect(isFixedExpense(e({ category: 'housing', amount: 1000 }))).toBe(true);
    expect(isFixedExpense(e({ category: 'subscriptions', amount: 40 }))).toBe(true);
    expect(isFixedExpense(e({ type: 'income', category: 'housing' }))).toBe(false);
    expect(isFixedExpense(e({ category: 'groceries', note: 'chleb' }))).toBe(false);
  });
});

describe('fixedVariable — fixedVariableMonths', () => {
  test('rozdziela stałe/zmienne/jedzenie w danym miesiącu, pomija przychód i self-transfer', () => {
    const now = new Date(2026, 7, 15); // sierpień 2026
    const exps = [
      e({ category: 'housing', amount: 1000, date: '2026-08-03T09:00:00' }),      // stałe
      e({ category: 'groceries', amount: 200, date: '2026-08-04T09:00:00' }),     // jedzenie
      e({ category: 'entertainment', amount: 50, date: '2026-08-05T09:00:00' }),  // zmienne
      e({ type: 'income', amount: 5000, date: '2026-08-01T09:00:00' }),           // przychód (pomiń)
      e({ category: 'transfer', amount: 999, date: '2026-08-02T09:00:00' }),      // self-transfer (pomiń)
      e({ category: 'housing', amount: 800, date: '2026-07-01T09:00:00' }),       // inny miesiąc
    ];
    const [m] = fixedVariableMonths(exps, 1, now);
    expect(m.month).toBe('2026-08');
    expect(m.fixed).toBe(1000);
    expect(m.food).toBe(200);
    expect(m.variable).toBe(50);
  });
});

// 2026-09-10, user: "rozbudowany widget który pokazywał dane miesięcy porównania wydatków
// stałych (odchylen), jedzenia, i zmiennych pokazujacych np co przeważyło (z odniesieniem)".
describe('fixedVariable — fixedDeviations', () => {
  test('flaguje rachunek wyraźnie wyższy niż jego własna historyczna średnia', () => {
    const exps = [
      e({ category: 'housing', note: 'Prąd', amount: 180, date: '2026-06-05T09:00:00' }),
      e({ category: 'housing', note: 'Prąd', amount: 190, date: '2026-07-05T09:00:00' }),
      e({ category: 'housing', note: 'Prąd', amount: 220, date: '2026-08-05T09:00:00' }), // odchylenie
    ];
    const out = fixedDeviations(exps, '2026-08', 3);
    expect(out).toHaveLength(1);
    expect(out[0].label).toBe('Prąd');
    expect(out[0].amount).toBe(220);
    expect(out[0].avgAmount).toBe(185); // (180+190)/2
    expect(out[0].deltaPct).toBeGreaterThan(0.15);
  });

  test('nie flaguje małej, normalnej różnicy (poniżej progu)', () => {
    const exps = [
      e({ category: 'housing', note: 'Internet', amount: 60, date: '2026-07-05T09:00:00' }),
      e({ category: 'housing', note: 'Internet', amount: 62, date: '2026-08-05T09:00:00' }),
    ];
    expect(fixedDeviations(exps, '2026-08', 3)).toHaveLength(0);
  });

  test('nowy rachunek bez historii (poprzedni miesiąc) NIE jest fałszywie flagowany jako 100% skok', () => {
    const exps = [
      e({ category: 'subscriptions', note: 'Nowy serwis', amount: 40, date: '2026-08-05T09:00:00' }),
    ];
    expect(fixedDeviations(exps, '2026-08', 3)).toHaveLength(0);
  });
});

describe('fixedVariable — topVariableContributors', () => {
  test('zwraca największe zmienne zakupy tego miesiąca, pomija stałe i jedzenie', () => {
    const exps = [
      e({ category: 'housing', note: 'Czynsz', amount: 1200, date: '2026-08-03T09:00:00' }),
      e({ category: 'groceries', note: 'Biedronka', amount: 300, date: '2026-08-04T09:00:00' }),
      e({ category: 'other', note: 'Wiatrak', amount: 120, date: '2026-08-10T09:00:00' }),
      e({ category: 'entertainment', note: 'Kino', amount: 40, date: '2026-08-12T09:00:00' }),
    ];
    const out = topVariableContributors(exps, '2026-08', 2);
    expect(out).toEqual([{ label: 'Wiatrak', amount: 120 }, { label: 'Kino', amount: 40 }]);
  });

  test('sumuje powtórzone zakupy w tym samym miejscu/nazwie', () => {
    const exps = [
      e({ category: 'entertainment', note: 'Steam', amount: 30, date: '2026-08-02T09:00:00' }),
      e({ category: 'entertainment', note: 'Steam', amount: 20, date: '2026-08-15T09:00:00' }),
    ];
    expect(topVariableContributors(exps, '2026-08', 1)).toEqual([{ label: 'Steam', amount: 50 }]);
  });
});

// 2026-09-12, user: "zebym mógł kliknąć ze np cos sie zle liczy... zeby sie uczyło" — ręczne
// przeklasyfikowanie (`fvOverride`) MUSI mieć pierwszeństwo przed heurystyką kategorii/tagów,
// we WSZYSTKICH funkcjach niżej (przez wspólny `bucketOf`).
describe('fixedVariable — bucketOf (fvOverride ma pierwszeństwo)', () => {
  test('bez override: standardowa heurystyka (housing=fixed, groceries=food, reszta=variable)', () => {
    expect(bucketOf(e({ category: 'housing', amount: 1000 }))).toBe('fixed');
    expect(bucketOf(e({ category: 'groceries', amount: 100 }))).toBe('food');
    expect(bucketOf(e({ category: 'entertainment', amount: 50 }))).toBe('variable');
  });

  test('fvOverride nadpisuje heurystykę w obie strony', () => {
    expect(bucketOf(e({ category: 'housing', amount: 1000, fvOverride: 'variable' }))).toBe('variable');
    expect(bucketOf(e({ category: 'entertainment', amount: 50, fvOverride: 'fixed' }))).toBe('fixed');
    expect(bucketOf(e({ category: 'groceries', amount: 50, fvOverride: 'variable' }))).toBe('variable');
  });

  test('fvOverride: null (wyczyszczone) wraca do heurystyki', () => {
    expect(bucketOf(e({ category: 'housing', amount: 1000, fvOverride: null }))).toBe('fixed');
  });

  test('fixedVariableMonths respektuje fvOverride', () => {
    const exps = [
      e({ category: 'housing', amount: 1000, date: '2026-08-03T09:00:00', fvOverride: 'variable' }),
      e({ category: 'entertainment', amount: 50, date: '2026-08-05T09:00:00' }),
    ];
    const [m] = fixedVariableMonths(exps, 1, new Date(2026, 7, 15));
    expect(m.fixed).toBe(0);
    expect(m.variable).toBe(1050);
  });
});

// 2026-09-13, user: "tak jak w jedzeniu mogę zaznaczyć że to nie jedzenie każdego
// produktu osobno (tak jest teraz)" — chce tego samego dla stałe/zmienne. `fvSplitOf`
// reużywa `foodAmountOf()` (per-produkt, już respektuje ręczne "nie jedzenie" z edycji
// paragonu) zamiast traktować CAŁY paragon jako jeden kubeł po samej kategorii.
describe('fixedVariable — fvSplitOf (rozbicie mieszanego paragonu jedzenie/zmienne per produkt)', () => {
  test('paragon spożywczy BEZ pozycji: cała kwota to jedzenie (jak dawny bucketOf)', () => {
    expect(fvSplitOf(e({ category: 'groceries', amount: 100 }))).toEqual({ fixed: 0, variable: 0, food: 100 });
  });

  test('mieszany paragon (jedzenie + chemia) dzieli kwotę PROPORCJONALNIE do produktów', () => {
    const mixed = e({
      category: 'groceries', amount: 100,
      receiptItems: [
        item({ name: 'chleb', price: 30, tags: ['pieczywo'] }),
        item({ name: 'proszek do prania', price: 70, tags: ['nie jedzenie'] }),
      ],
    });
    expect(fvSplitOf(mixed)).toEqual({ fixed: 0, variable: 70, food: 30 });
  });

  test('oznaczenie produktu "nie jedzenie" przesuwa jego udział z food do variable, nie zmieniając reszty', () => {
    const beforeTag = e({
      category: 'groceries', amount: 50,
      receiptItems: [item({ name: 'cukierki', price: 50, tags: ['słodycze'] })],
    });
    const afterTag = e({
      category: 'groceries', amount: 50,
      receiptItems: [item({ name: 'cukierki', price: 50, tags: ['nie jedzenie'] })],
    });
    expect(fvSplitOf(beforeTag)).toEqual({ fixed: 0, variable: 0, food: 50 });
    expect(fvSplitOf(afterTag)).toEqual({ fixed: 0, variable: 50, food: 0 });
  });

  test('fvOverride na CAŁYM wydatku wygrywa ze wszystkim, nawet z mieszanym paragonem', () => {
    const mixed = e({
      category: 'groceries', amount: 100, fvOverride: 'variable',
      receiptItems: [item({ name: 'chleb', price: 30, tags: ['pieczywo'] }), item({ name: 'mydło', price: 70, tags: ['nie jedzenie'] })],
    });
    expect(fvSplitOf(mixed)).toEqual({ fixed: 0, variable: 100, food: 0 });
  });

  test('rachunek stały (housing) idzie w 100% do fixed, ignorując ewentualne pozycje', () => {
    expect(fvSplitOf(e({ category: 'housing', amount: 1000 }))).toEqual({ fixed: 1000, variable: 0, food: 0 });
  });

  test('bucketOf na mieszanym paragonie zwraca dominujący kubeł (większy udział)', () => {
    const mostlyFood = e({
      category: 'groceries', amount: 100,
      receiptItems: [item({ name: 'chleb', price: 80, tags: ['pieczywo'] }), item({ name: 'mydło', price: 20, tags: ['nie jedzenie'] })],
    });
    expect(bucketOf(mostlyFood)).toBe('food');
  });

  test('fixedVariableMonths poprawnie sumuje mieszany paragon do OBU kubłów naraz', () => {
    const mixed = e({
      category: 'groceries', amount: 100, date: '2026-08-04T09:00:00',
      receiptItems: [item({ name: 'chleb', price: 30, tags: ['pieczywo'] }), item({ name: 'proszek', price: 70, tags: ['nie jedzenie'] })],
    });
    const [m] = fixedVariableMonths([mixed], 1, new Date(2026, 7, 15));
    expect(m.food).toBe(30);
    expect(m.variable).toBe(70);
  });

  test('bucketTransactions pokazuje mieszany paragon w OBU zakładkach, każda tylko ze swoją częścią kwoty', () => {
    const mixed = e({
      id: 'm1', category: 'groceries', amount: 100, date: '2026-08-04T09:00:00', note: 'Biedronka',
      receiptItems: [item({ name: 'chleb', price: 30, tags: ['pieczywo'] }), item({ name: 'proszek', price: 70, tags: ['nie jedzenie'] })],
    });
    const foodTx = bucketTransactions([mixed], '2026-08', 'food');
    const varTx = bucketTransactions([mixed], '2026-08', 'variable');
    expect(foodTx).toEqual([{ id: 'm1', label: 'Biedronka', amount: 30, date: '2026-08-04T09:00:00', overridden: false }]);
    expect(varTx).toEqual([{ id: 'm1', label: 'Biedronka', amount: 70, date: '2026-08-04T09:00:00', overridden: false }]);
  });
});

describe('fixedVariable — bucketTransactions', () => {
  test('zwraca surową, chronologiczną (najnowsze pierwsze) listę transakcji danego kubła', () => {
    const exps = [
      e({ id: 'a', category: 'entertainment', note: 'Kino', amount: 40, date: '2026-08-05T09:00:00' }),
      e({ id: 'b', category: 'other', note: 'Wiatrak', amount: 120, date: '2026-08-10T09:00:00' }),
      e({ id: 'c', category: 'housing', note: 'Czynsz', amount: 1200, date: '2026-08-03T09:00:00' }),
    ];
    const out = bucketTransactions(exps, '2026-08', 'variable');
    expect(out.map(t => t.id)).toEqual(['b', 'a']);
    expect(out.every(t => t.overridden === false)).toBe(true);
  });

  test('flaguje overridden i respektuje przeklasyfikowanie', () => {
    const exps = [
      e({ id: 'a', category: 'housing', note: 'Coś', amount: 100, date: '2026-08-05T09:00:00', fvOverride: 'variable' }),
    ];
    expect(bucketTransactions(exps, '2026-08', 'fixed')).toHaveLength(0);
    const out = bucketTransactions(exps, '2026-08', 'variable');
    expect(out).toEqual([{ id: 'a', label: 'Coś', amount: 100, date: '2026-08-05T09:00:00', overridden: true }]);
  });
});

// 2026-09-10, user: "w pracy dodać widget jak zarabiam na ten moment... ile muszę uzbierać na
// stałych wydatkach i śr. jedzenia... paski wypełniające się jakby skarbonki".
describe('fixedVariable — workBudgetProgress', () => {
  const months: FVMonth[] = [
    { month: '2026-06', fixed: 1000, variable: 200, food: 400 },
    { month: '2026-07', fixed: 1000, variable: 300, food: 500 },
    { month: '2026-08', fixed: 1050, variable: 100, food: 100 }, // bieżący (cel liczony z 06/07)
  ];

  test('rozdziela zarobek PO KOLEI: najpierw stałe, potem jedzenie, potem zmienne', () => {
    // cele = śr(06,07): stałe 1000, jedzenie 450, zmienne 250
    const out = workBudgetProgress(1200, months);
    expect(out[0].target).toBe(1000);
    expect(out[0].filled).toBe(1000); // stałe w pełni pokryte
    expect(out[1].target).toBe(450);
    expect(out[1].filled).toBe(200);  // reszta (1200-1000) idzie w jedzenie, nie starcza do celu
    expect(out[2].filled).toBe(0);    // nic nie zostało na zmienne
  });

  test('zarobek pokrywający wszystko → każda skarbonka pełna (pct ≥ 1)', () => {
    const out = workBudgetProgress(999999, months);
    for (const b of out) expect(b.pct).toBeGreaterThanOrEqual(1);
  });

  test('brak historii (tylko bieżący miesiąc) → cel = ten miesiąc, nie dzieli przez zero', () => {
    const out = workBudgetProgress(500, [months[2]]);
    expect(out[0].target).toBe(1050);
    expect(Number.isFinite(out[0].pct)).toBe(true);
  });
});
