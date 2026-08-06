import { weaknessMult, bossGuarded, weaknessMet, bossTier, counterDamage, simulateFight, Bonuses, BOSSES, Boss, WeaknessCtx } from '@/utils/bosses';
import { raidForWeek, raidHpFor } from '@/utils/raid';

const ctx = (o: Partial<WeaknessCtx> = {}): WeaknessCtx => ({
  stepsToday: 0, sweetlessDays: 0, habitsRatio: 0, moodLoggedToday: false,
  boughtSweetToday: false, sleepMinutes: 0, waterRatio: 0, ...o,
});
const boss = (o: Partial<Boss>): Boss => ({
  id: 'x', name: 'x', emoji: 'x', order: 1, unlockLevel: 1, hp: 1000,
  weakness: 'steps', weaknessLabel: 'x', loot: { id: 'l', name: 'l', emoji: 'l', desc: 'l', bonus: {} },
  coins: 0, xp: 0, taunt: 'x', ...o,
});

describe('bosses — słabości sen/woda', () => {
  test('sen 7h+ = pełny bonus ×1.25, brak snu = ×1', () => {
    expect(weaknessMult(boss({ weakness: 'sleep' }), ctx({ sleepMinutes: 420 }))).toBeCloseTo(1.25);
    expect(weaknessMult(boss({ weakness: 'sleep' }), ctx({ sleepMinutes: 0 }))).toBeCloseTo(1);
  });
  test('woda: pełny cel dnia = pełny bonus', () => {
    expect(weaknessMult(boss({ weakness: 'water' }), ctx({ waterRatio: 1 }))).toBeCloseTo(1.25);
  });
});

describe('bosses — mechaniki', () => {
  test('osłona sweets: aktywna gdy dziś słodycze', () => {
    expect(bossGuarded(boss({ guard: 'sweets' }), ctx({ boughtSweetToday: true }))).toBe(true);
    expect(bossGuarded(boss({ guard: 'sweets' }), ctx({ boughtSweetToday: false }))).toBe(false);
  });
  test('osłona poorSleep: sen <6h', () => {
    expect(bossGuarded(boss({ guard: 'poorSleep' }), ctx({ sleepMinutes: 300 }))).toBe(true);
    expect(bossGuarded(boss({ guard: 'poorSleep' }), ctx({ sleepMinutes: 400 }))).toBe(false);
  });
  test('weaknessMet sweetless = dziś bez słodyczy', () => {
    expect(weaknessMet(boss({ weakness: 'sweetless' }), ctx({ boughtSweetToday: false }))).toBe(true);
    expect(weaknessMet(boss({ weakness: 'sweetless' }), ctx({ boughtSweetToday: true }))).toBe(false);
  });
});

describe('bosses — bossTier (derywowana z unlockLevel)', () => {
  test('poniżej 26 = common, od 26 = elite', () => {
    expect(bossTier(boss({ unlockLevel: 2 }))).toBe('common');
    expect(bossTier(boss({ unlockLevel: 22 }))).toBe('common');
    expect(bossTier(boss({ unlockLevel: 26 }))).toBe('elite');
    expect(bossTier(boss({ unlockLevel: 52 }))).toBe('elite');
  });
  test('kampania: pierwsze 8 bossów common, endgame (insomnia+) elite', () => {
    const common = BOSSES.filter(b => bossTier(b) === 'common');
    const elite = BOSSES.filter(b => bossTier(b) === 'elite');
    expect(common.length).toBe(8);
    expect(elite.map(b => b.id)).toEqual(['insomnia', 'compare', 'drought', 'procrast', 'doubt', 'devourer']);
  });
});

describe('bosses — counterDamage (fundament v4, jeszcze niepodpięty)', () => {
  test('skaluje z HP bossa, bez uniku', () => {
    expect(counterDamage(boss({ hp: 300 }), 0)).toBe(12);   // 300 * 0.04
    expect(counterDamage(boss({ hp: 1000 }), 0)).toBe(40);  // 1000 * 0.04
  });
  test('unik redukuje obrażenia, cap 90%', () => {
    expect(counterDamage(boss({ hp: 1000 }), 0.5)).toBe(20);   // połowa
    expect(counterDamage(boss({ hp: 1000 }), 0.9)).toBe(4);    // 10% zostaje
    expect(counterDamage(boss({ hp: 1000 }), 1.5)).toBe(4);    // cap na 0.9, nie ujemne
  });
});

describe('bosses — simulateFight (silnik rund, jeszcze niepodpięty)', () => {
  const noCrit: Bonuses = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };

  test('miażdżąca przewaga energii → wygrana, kotek bez zadrapania', () => {
    const b = boss({ hp: 10 }); // trywialnie mało HP
    const r = simulateFight(100000, 1, noCrit, b, ctx(), 100);
    expect(r.won).toBe(true);
    expect(r.catFainted).toBe(false);
    expect(r.bossHpLeft).toBe(0);
    expect(r.rounds.length).toBeLessThanOrEqual(3); // ubity zanim rundy się skończą
  });

  test('boss za mocny na kontratak → kotek pada, walka przegrana', () => {
    const b = boss({ hp: 1_000_000 }); // gracz go nie zadrapie w 3 rundach
    const r = simulateFight(1, 1, noCrit, b, ctx(), 5); // 5 HP kotka, wielki kontratak
    expect(r.won).toBe(false);
    expect(r.catFainted).toBe(true);
    expect(r.catHpLeft).toBe(0);
  });

  test('walka kończy się natychmiast po zabiciu bossa — brak kontrataku w tej rundzie', () => {
    const b = boss({ hp: 1 }); // padnie na pierwszym ciosie
    const r = simulateFight(1000, 1, noCrit, b, ctx(), 100);
    expect(r.rounds).toHaveLength(1);
    expect(r.rounds[0].counterDmg).toBe(0); // boss umarł, nie zdążył kontratakować
    expect(r.catHpLeft).toBe(100); // kotek nietknięty
  });

  test('remis rund (nikt nie padł) → nie wygrana, kotek żyje — próba nieudana, nie porażka', () => {
    const b = boss({ hp: 1_000_000 });
    const r = simulateFight(1, 1, noCrit, b, ctx(), 1_000_000, 3); // ogromne HP kotka, boss za twardy
    expect(r.won).toBe(false);
    expect(r.catFainted).toBe(false);
    expect(r.rounds).toHaveLength(3);
  });
});

describe('raid — deterministyczny', () => {
  test('ten sam tydzień → ten sam boss i HP', () => {
    expect(raidForWeek('2026-W31').id).toBe(raidForWeek('2026-W31').id);
    expect(raidHpFor(10, '2026-W31')).toBe(raidHpFor(10, '2026-W31'));
  });
  test('HP rośnie z poziomem', () => {
    expect(raidHpFor(20, '2026-W31')).toBeGreaterThan(raidHpFor(1, '2026-W31'));
  });
});
