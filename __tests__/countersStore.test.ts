import { matchesAvoid, AVOID_PRESETS, resolveAvoidKeyword, autoDaysWithout, Counter } from '@/store/countersStore';

const sweetsKeyword = AVOID_PRESETS.find(p => p.key === 'sweets')!.keyword;

// 2026-09-02, user: "kupię drożdzówkę i ją oflaguję że to pieczywo/słodycz - jak zaznaczę
// że zjadłem to trzeba żeby oflagowało że zjadłem słodycz i tracę streak". Drożdżówka/rogal/
// croissant są kategoryzowane jako 'pieczywo' w FOOD_TAG_MAP (świadomie, dla podziału
// wydatków), więc kategoria-produktu NIE złapie ich jako słodycze — złapane tu, po nazwie,
// tym samym wzorcem co już istniejące 'pączek'.
describe('matchesAvoid — preset "słodycze" łapie słodkie wypieki po nazwie', () => {
  test.each([
    ['Drożdżówka z serem'],
    ['Rogal marcinski'],
    ['Croissant maślany'],
    ['Kroasan czekoladowy'],
  ])('%s pasuje do keyword słodyczy', (name) => {
    expect(matchesAvoid(name, sweetsKeyword)).toBe(true);
  });

  test('zwykłe pieczywo (chleb) nadal NIE pasuje', () => {
    expect(matchesAvoid('Chleb żytni razowy', sweetsKeyword)).toBe(false);
  });
});

// 2026-09-04, user: "zeby zaliczamy sie do słodyczy jak coś jest słodyczem" — audyt całej
// foodBase.ts znalazł klasyczne polskie słodycze, które NIE łapały się wcale (samo "ciast"/
// "czekolad"/itd nie pokrywało ich nazw). Każdy nowy fragment keyword sprawdzony pod kątem
// fałszywych trafień na CAŁEJ bazie produktów (node -e skrypt) przed dodaniem.
describe('matchesAvoid — preset "słodycze" łapie dobitkę 2026-09-04', () => {
  test.each([
    ['Krówki'],
    ['Ptasie mleczko'],
    ['Sernik'],
    ['Brownie'],
    ['Gofry'],
    ['Delicje (biszkopt)'],
    ['Michałki'],
    ['Kremówka'],
    ['Snickers'],
    ['Kinder Bueno'],
    ['Wafelek'],
    ['Tortik z galaretką'],
  ])('%s pasuje do keyword słodyczy', (name) => {
    expect(matchesAvoid(name, sweetsKeyword)).toBe(true);
  });

  // 'tortik' (nie samo 'tort') i 'wafel' (nie 'wafl') dobrane specjalnie, żeby NIE złapać
  // tych dwóch, realnie istniejących w bazie, niesłodkich produktów.
  test.each([
    ['Tortilla pszenna'],
    ['Wafle ryżowe'],
  ])('%s NIE pasuje (celowo, żeby uniknąć fałszywego trafienia)', (name) => {
    expect(matchesAvoid(name, sweetsKeyword)).toBe(false);
  });
});

// 2026-09-06, user: "zaznaczam Nutella to nie pokazuje i nie resetuje mi się streak" —
// foodBase.ts nie ma pola `cat` w ogóle, więc kategoria produktu nigdy by tego nie złapała;
// nazwa "Nutella" nie zawiera "czekolad" (to krem orzechowo-kakaowy pod marką), złapane po
// nazwie wprost, jak Snickers/Kinder wyżej.
describe('matchesAvoid — preset "słodycze" łapie Nutellę (2026-09-06)', () => {
  test('Nutella pasuje do keyword słodyczy', () => {
    expect(matchesAvoid('Nutella', sweetsKeyword)).toBe(true);
  });

  test('Masło orzechowe nadal NIE pasuje (to nie słodycz, mimo "orzech")', () => {
    expect(matchesAvoid('Masło orzechowe', sweetsKeyword)).toBe(false);
  });
});

// 2026-09-08, user: "w streak wgle nie łapie ze zjadłem dzisiaj nutelle i nadal mam 20 dni" —
// RECURRENCE of the already-fixed 09-06 bug. Root cause: `matchesAvoid` above was always correct
// in isolation, but a real Counter/Habit stores a ONE-TIME COPY of the preset keyword string at
// creation time (`counter.keyword`), so a counter made before "nutella" was appended to
// `AVOID_PRESETS` never sees the new word — `resolveAvoidKeyword` fixes this by resolving the
// LIVE preset string at read time, either via a stored `presetKey` (new counters) or, for
// counters made before this fix (no presetKey), by detecting that the stored keyword's terms are
// a strict subset of a current preset's terms (migration heuristic).
describe('resolveAvoidKeyword — stale preset copy dogania nowe słowa (2026-09-08)', () => {
  test('presetKey obecny → zawsze zwraca AKTUALNY string presetu, nawet jeśli keyword jest stary', () => {
    const staleKeyword = 'słodycz|slodycz|czekolad'; // ancient snapshot, missing "nutella" and much more
    expect(resolveAvoidKeyword(staleKeyword, 'sweets')).toBe(sweetsKeyword);
    expect(matchesAvoid('Nutella', resolveAvoidKeyword(staleKeyword, 'sweets')!)).toBe(true);
  });

  test('brak presetKey, ale stary keyword jest podzbiorem obecnego presetu → migruje do świeżego', () => {
    // A pre-nutella snapshot: every term still exists in the current preset, none are extra.
    const oldTerms = sweetsKeyword.split('|').filter(t => t !== 'nutella');
    const staleKeyword = oldTerms.join('|');
    const resolved = resolveAvoidKeyword(staleKeyword, undefined);
    expect(resolved).toBe(sweetsKeyword);
    expect(matchesAvoid('Nutella', resolved!)).toBe(true);
  });

  test('naprawdę własny keyword (nie podzbiór żadnego presetu) zostaje NIETKNIĘTY', () => {
    const custom = 'cola|fanta|sprite';
    expect(resolveAvoidKeyword(custom, undefined)).toBe(custom);
  });

  test('pojedyncze słowo NIE jest migrowane (za mało pewności, mogło być celowo wąskie)', () => {
    expect(resolveAvoidKeyword('lody', undefined)).toBe('lody');
  });
});

// End-to-end regression for the exact user report: a Counter created BEFORE "nutella" existed in
// AVOID_PRESETS, with today's food log containing "Nutella", must show 0 dni (broken today) — not
// a frozen historical streak.
describe('autoDaysWithout — Nutella zjedzona dziś resetuje streak nawet dla starego licznika', () => {
  test('stary Counter (bez presetKey, pre-nutella keyword) łapie dzisiejszą Nutellę', () => {
    const oldTerms = sweetsKeyword.split('|').filter(t => t !== 'nutella');
    const staleCounter: Counter = {
      id: 'c1', kind: 'since', name: 'Bez słodyczy', mode: 'auto',
      keyword: oldTerms.join('|'), track: 'eat',
      date: '2026-08-01', startDate: '2026-08-01', createdAt: '2026-08-01T00:00:00.000Z',
    };
    const today = new Date().toISOString().slice(0, 10);
    const meals = [{ date: `${today}T12:00:00`, items: [{ name: 'Nutella' }] }];
    expect(autoDaysWithout(staleCounter, [], meals)).toBe(0);
  });
});
