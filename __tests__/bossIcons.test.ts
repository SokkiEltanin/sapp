import { BOSSES } from '@/utils/bosses';
import { BOSS_PNG, BOSS_ELEMENT, bossArenaBg, ARENA_ELEMENT_BG } from '@/utils/bossIcons';

// Pełny reskin rosteru kampanii (§399, 2026-10-19) — user: "wywal stare lokalizacje
// wszystkie i stare bossy wszystkie (z kampanii i inne)... każdy rodzaj bossów ma swoją
// arenę (wodne/mroczne/lavowe/boskie/leśne)". Testy bezpośrednio na mapach, nie na
// require()-owanych plikach (zmockowane przez jest.config.js's fileMock) — sprawdzają
// SPÓJNOŚĆ danych, nie że pliki fizycznie istnieją (to łapie tsc przy require() ze złą
// ścieżką, nie jest).
describe('bossIcons — reskin rosteru kampanii (§399)', () => {
  test('KAŻDY z 22 bossów kampanii ma wpis portretu w BOSS_PNG', () => {
    for (const b of BOSSES) expect(BOSS_PNG[b.id]).toBeDefined();
  });

  test('KAŻDY z 22 bossów kampanii ma przypisany żywioł/arenę', () => {
    for (const b of BOSSES) expect(BOSS_ELEMENT[b.id]).toBeDefined();
  });

  test('żaden boss kampanii nie jest przypisany do areny "mrok" (user: zostaje pusta na razie)', () => {
    const inMrok = BOSSES.filter(b => BOSS_ELEMENT[b.id] === 'mrok');
    expect(inMrok).toEqual([]);
  });
});

describe('bossIcons — bossArenaBg (§399)', () => {
  test('zwraca tło areny dla bossa z przypisanym żywiołem', () => {
    expect(bossArenaBg('dragon')).toBe(ARENA_ELEMENT_BG.lawa);
    expect(bossArenaBg('drought')).toBe(ARENA_ELEMENT_BG.woda);
  });

  test('"mad_<id>" pożycza arenę SWOJEGO bazowego bossa (ten sam wzorzec co bossPng)', () => {
    expect(bossArenaBg('mad_dragon')).toBe(bossArenaBg('dragon'));
  });

  test('boss BEZ przypisanego żywiołu (np. miniboss/raid) zwraca undefined — spada na fallback wołającego', () => {
    expect(bossArenaBg('mb_capybara')).toBeUndefined();
    expect(bossArenaBg('kraken')).toBeUndefined();
    expect(bossArenaBg(undefined)).toBeUndefined();
  });
});
