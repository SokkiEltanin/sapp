import { weaknessMult, bossGuarded, weaknessMet, bossTier, counterDamage, simulateFight, EquippedItem, Bonuses, BOSSES, Boss, WeaknessCtx } from '@/utils/bosses';
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

  test('OSŁONA: dziś zrobiłeś złą rzecz → Twoje ciosy w całej walce ×0.5', () => {
    const b = boss({ hp: 1000, guard: 'sweets' });
    const guardedCtx = ctx({ boughtSweetToday: true });
    const freeCtx = ctx({ boughtSweetToday: false });
    const guardedFight = simulateFight(100, 1, noCrit, b, guardedCtx, 100, 1);
    const freeFight = simulateFight(100, 1, noCrit, b, freeCtx, 100, 1);
    expect(guardedFight.guarded).toBe(true);
    expect(freeFight.guarded).toBe(false);
    expect(guardedFight.rounds[0].playerDmg).toBe(Math.round(freeFight.rounds[0].playerDmg / 2));
  });

  test('REGENERACJA: zaniedbana słabość → boss leczy się co rundę, którą przeżyje', () => {
    const b = boss({ hp: 10000, regenPct: 0.1 }); // 10% za rundę, nie zabijemy w 1 ciosie
    const r = simulateFight(50, 1, noCrit, b, ctx({ moodLoggedToday: false }), 100, 2);
    // słaby cios (energia 50) nie zabija bossa 10000 hp → boss przeżywa → leczy się
    expect(r.rounds.some(rd => rd.healed > 0)).toBe(true);
  });
});

describe('bosses — simulateFight z itemami bojowymi (v4.1, jeszcze bez UI do zakładania)', () => {
  const noCrit: Bonuses = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };
  const item = (id: EquippedItem['id'], level = 1): EquippedItem[] => [{ id, level }];
  let randSpy: jest.SpyInstance;
  afterEach(() => { randSpy?.mockRestore(); });

  test('bez itemów (domyślne []) — zachowanie identyczne jak przed itemami', () => {
    const b = boss({ hp: 10 });
    const withDefault = simulateFight(100000, 1, noCrit, b, ctx(), 100);
    const withEmpty = simulateFight(100000, 1, noCrit, b, ctx(), 100, 3, []);
    expect(withDefault.won).toBe(withEmpty.won);
    expect(withDefault.bossHpLeft).toBe(withEmpty.bossHpLeft);
  });

  test('headshot: gdy proc — cios ×2', () => {
    const b = boss({ hp: 1_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0); // < każdy próg → zawsze proc
    const withItem = simulateFight(100, 1, noCrit, b, ctx(), 100, 1, item('headshot'));
    randSpy.mockRestore();
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999); // nigdy nie proc
    const without = simulateFight(100, 1, noCrit, b, ctx(), 100, 1, item('headshot'));
    expect(withItem.rounds[0].playerDmg).toBe(without.rounds[0].playerDmg * 2);
  });

  test('dodge: gdy proc — kontratak w pełni unikany (0 obrażeń kotka)', () => {
    const b = boss({ hp: 1_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const r = simulateFight(1, 1, noCrit, b, ctx(), 1000, 1, item('dodge'));
    expect(r.rounds[0].counterDmg).toBe(0);
    expect(r.catHpLeft).toBe(1000);
  });

  test('mindcontrol: gdy proc — boss w ogóle nie kontratakuje tej rundy', () => {
    const b = boss({ hp: 1_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const r = simulateFight(1, 1, noCrit, b, ctx(), 1000, 1, item('mindcontrol'));
    expect(r.rounds[0].counterDmg).toBe(0);
  });

  test('shield: redukuje obrażenia kontrataku o stały procent', () => {
    const b = boss({ hp: 1_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999); // bez shield-niezwiązanych procków
    const withItem = simulateFight(1, 1, noCrit, b, ctx(), 100000, 1, item('shield'));
    const without = simulateFight(1, 1, noCrit, b, ctx(), 100000, 1, []);
    expect(withItem.rounds[0].counterDmg).toBeLessThan(without.rounds[0].counterDmg);
  });

  test('thorn: gwarantowane odbicie co rundę, NIEZALEŻNIE od losowania', () => {
    const b = boss({ hp: 1_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999); // wszystkie SZANSOWE efekty nie procują
    const withItem = simulateFight(1, 1, noCrit, b, ctx(), 100000, 1, item('thorn'));
    const without = simulateFight(1, 1, noCrit, b, ctx(), 100000, 1, []);
    expect(withItem.bossHpLeft).toBeLessThan(without.bossHpLeft); // thorn ugryzł bossa mimo braku procków
  });

  test('reflect: gdy proc — kontratak przekierowany na bossa, kotek nietknięty', () => {
    const b = boss({ hp: 1_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const r = simulateFight(1, 1, noCrit, b, ctx(), 1000, 1, item('reflect'));
    expect(r.rounds[0].counterDmg).toBe(0);
    expect(r.catHpLeft).toBe(1000);
    expect(r.bossHpLeft).toBeLessThan(b.hp); // boss dostał odbite obrażenia
  });

  test('execute: HP bossa poniżej progu → instakill', () => {
    // dobrany tak, że sam cios zbija bossa do 0,09% HP (NIE zabija go samym atakiem —
    // zostaje 90/100000), a execute (próg 4,5% na poziomie 3) dobija resztę.
    const b = boss({ hp: 100000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999);
    const r = simulateFight(97000, 1, noCrit, b, ctx(), 1000, 1, item('execute', 3));
    expect(r.won).toBe(true);
  });

  test('fire: po podpaleniu, DoT działa w KOLEJNYCH rundach', () => {
    const b = boss({ hp: 1_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0); // podpala się od razu
    const r = simulateFight(1, 1, noCrit, b, ctx(), 100000, 3, item('fire'));
    expect(r.rounds.length).toBeGreaterThan(1);
    // każda kolejna runda boss traci dodatkowo z DoT — HP spada bardziej niż samym atakiem
    expect(r.rounds[1].bossHpAfter).toBeLessThan(r.rounds[0].bossHpAfter);
  });

  test('heal: pierwszy raz <50% HP kotka w walce → jednorazowe leczenie', () => {
    // boss.hp dobrany tak, żeby kontratak (round(1000*0.04)=40) obniżał HP kotka (100)
    // STOPNIOWO przez próg 50% (100→60→20), zamiast zabić go od razu jednym ciosem —
    // wtedy nigdy nie złapalibyśmy stanu "<50% i wciąż żywy", który uruchamia heal.
    const b = boss({ hp: 1000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999); // bez innych procków
    const r = simulateFight(1, 1, noCrit, b, ctx(), 100, 3, item('heal'));
    const healedRound = r.rounds.find(rd => rd.catHealed > 0);
    expect(healedRound).toBeDefined();
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
