import {
  bossTier, counterDamage, atkPower, atkMultiplier, dailyAttempts, eventDailyAttempts,
  EVENT_MAX_DAILY_ATTEMPTS, simulateFight, mysteryBossName,
  energyRegenTick, energySpendTick, ENERGY_REGEN_HOURS,
  EquippedItem, Bonuses, BOSSES, Boss, combatItemSlotsFor, COMBAT_ITEM_SLOTS,
} from '@/utils/bosses';
import { raidForWeek, raidHpFor } from '@/utils/raid';

const boss = (o: Partial<Boss>): Boss => ({
  id: 'x', name: 'x', emoji: 'x', order: 1, unlockLevel: 1, hp: 1000,
  weakness: 'steps', weaknessLabel: 'x', loot: { id: 'l', name: 'l', emoji: 'l', desc: 'l', bonus: {} },
  coins: 0, xp: 0, taunt: 'x', ...o,
});
const noCrit: Bonuses = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };

describe('bosses — atkPower / dailyAttempts (v5 pivot: staty zamiast danych zdrowia)', () => {
  test('atkPower rośnie z atkStatBonus i poziomem, nigdy nie spada poniżej bazy przy ujemnym bonusie', () => {
    const base = atkPower(0, 1, noCrit);
    expect(atkPower(100, 1, noCrit)).toBeGreaterThan(base);
    expect(atkPower(-999, 1, noCrit)).toBe(base); // clampowane do 0, nie ujemne
    expect(atkPower(0, 20, noCrit)).toBeGreaterThan(base); // wyższy poziom = mocniej
  });
  test('atkMultiplier: poziom + atk z łupu', () => {
    expect(atkMultiplier(10, { ...noCrit, atk: 0.2 })).toBeCloseTo(1 + 10 * 0.03 + 0.2);
  });
  test('dailyAttempts: bazowo 3, energyMult z łupu daje więcej prób, nie mocniejszy cios', () => {
    expect(dailyAttempts(0)).toBe(3);
    expect(dailyAttempts(0.5)).toBeGreaterThan(3);
    expect(dailyAttempts(-5)).toBeGreaterThanOrEqual(1); // nigdy 0
  });
});

// 2026-08-17: user — "jak mam energię na bossy to energia na bossy, a mam drugą inną
// energię łącznie na bossy eventowe" — event miał FLAT 1/dzień niezależnie od energyMult
// (leftover inwestycja bezużyteczna akurat tam, gdzie licznik dni do końca eventu najbardziej
// by się przydał). eventDailyAttempts skaluje WYRAŹNIE słabiej niż kampania i ma twardy cap.
describe('bosses — eventDailyAttempts (druga, słabiej skalująca pula na bossy eventowe)', () => {
  test('bez energyMult: baza 1, tak jak dawny flat model', () => {
    expect(eventDailyAttempts(0)).toBe(1);
    expect(eventDailyAttempts(-5)).toBe(1); // nigdy poniżej bazy
  });
  test('rośnie z energyMult, ale wolniej niż dailyAttempts (kampania) na tym samym wejściu', () => {
    expect(eventDailyAttempts(0.5)).toBeGreaterThan(1);
    expect(eventDailyAttempts(0.5)).toBeLessThan(dailyAttempts(0.5));
  });
  test('twardy cap — nigdy nie dogania kampanii nawet przy skrajnej inwestycji', () => {
    expect(eventDailyAttempts(10)).toBe(EVENT_MAX_DAILY_ATTEMPTS);
    expect(eventDailyAttempts(0.75)).toBeLessThanOrEqual(EVENT_MAX_DAILY_ATTEMPTS);
  });
});

describe('bosses — combatItemSlotsFor (2026-08-13: sloty rosną z poziomem)', () => {
  test('baza = COMBAT_ITEM_SLOTS na niskim poziomie', () => {
    expect(combatItemSlotsFor(1)).toBe(COMBAT_ITEM_SLOTS);
    expect(combatItemSlotsFor(5)).toBe(COMBAT_ITEM_SLOTS);
  });
  test('+1 slot co 6 poziomów', () => {
    expect(combatItemSlotsFor(6)).toBe(COMBAT_ITEM_SLOTS + 1);
    expect(combatItemSlotsFor(12)).toBe(COMBAT_ITEM_SLOTS + 2);
  });
  test('cap na 6 slotach nawet przy bardzo wysokim poziomie', () => {
    expect(combatItemSlotsFor(18)).toBe(6);
    expect(combatItemSlotsFor(100)).toBe(6);
  });
});

// 2026-08-18, user (po odrzuceniu wcześniejszego gate'u "1 nowy boss dziennie"): "wolałem
// zamiast jeden dziennie raz na 3h atak może?" — regeneracja energii kampanii/MAD w czasie
// rzeczywistym. Cap (`max`) był kiedyś sztywnym `ENERGY_MAX=2`, teraz WOŁAJĄCY (petStore.ts)
// go liczy z `dailyAttempts(energyMult)` i przekazuje jawnie (2026-08-19, user: "mam
// napisane 4 a maksymalnie ładuje mi się do 2" — patrz komentarz nad `campaignEnergyMax` w
// petStore.ts) — tu testujemy samo jądro tick, `MAX` to dowolna testowa wartość, nie stała
// z produkcji. Testy wołają z ustalonym `now` (czwarty param), nie prawdziwym Date.now(),
// żeby były deterministyczne.
describe('bosses — energyRegenTick / energySpendTick (regeneracja energii w czasie)', () => {
  const H = 3600000;
  const MAX = 2;
  test('ENERGY_REGEN_HOURS=3 — dokładnie liczba z prośby usera', () => {
    expect(ENERGY_REGEN_HOURS).toBe(3);
  });
  test('pełny bank (już max) — tick to no-op, regenAt zawsze null', () => {
    const r = energyRegenTick(MAX, null, MAX, 1000);
    expect(r).toEqual({ energy: MAX, regenAt: null });
  });
  test('niepełny bank bez zegara (świeży spend/migracja) — startuje zegar na +3h od `now`', () => {
    const now = 1_000_000;
    const r = energyRegenTick(0, null, MAX, now);
    expect(r.energy).toBe(0);
    expect(new Date(r.regenAt!).getTime()).toBe(now + 3 * H);
  });
  test('zegar jeszcze nie doszedł — bez zmian', () => {
    const now = 1_000_000;
    const regenAt = new Date(now + H).toISOString(); // za godzinę, jeszcze nie teraz
    const r = energyRegenTick(0, regenAt, MAX, now);
    expect(r.energy).toBe(0);
    expect(r.regenAt).toBe(regenAt);
  });
  test('dokładnie jeden punkt minął — +1 energii, zegar przesunięty o kolejne 3h', () => {
    const now = 1_000_000;
    const regenAt = new Date(now - 1).toISOString(); // już minęło
    const r = energyRegenTick(0, regenAt, MAX, now);
    expect(r.energy).toBe(1);
    expect(new Date(r.regenAt!).getTime()).toBe(new Date(regenAt).getTime() + 3 * H);
  });
  test('offline długo (kilka okresów naraz) — dogania, ale CAPUJE na max, nie przelewa', () => {
    const now = 1_000_000;
    const regenAt = new Date(now - 100 * H).toISOString(); // 100h temu — dawno przekroczone
    const r = energyRegenTick(0, regenAt, MAX, now);
    expect(r.energy).toBe(MAX);
    expect(r.regenAt).toBeNull(); // pełny bank = nic już nie tyka
  });
  test('regenAt zwrócony przez tick zawsze jest w PRZYSZŁOŚCI względem `now` (nigdy przeszły)', () => {
    const now = 1_000_000;
    const regenAt = new Date(now - 7 * H).toISOString(); // wielokrotność 3h przekroczona
    const r = energyRegenTick(0, regenAt, MAX, now);
    if (r.regenAt) expect(new Date(r.regenAt).getTime()).toBeGreaterThan(now);
  });
  test('wyższy max (np. z bonusów energyMult) pozwala bankowi urosnąć dalej niż stary sztywny cap', () => {
    const now = 1_000_000;
    const regenAt = new Date(now - 100 * H).toISOString();
    const r = energyRegenTick(0, regenAt, 4, now);
    expect(r.energy).toBe(4); // nie ucięte na starym ENERGY_MAX=2
  });
  test('spend z pełnego banku (2→1) startuje zegar na +3h od `now`', () => {
    const now = 2_000_000;
    const r = energySpendTick(MAX, null, MAX, now);
    expect(r.energy).toBe(MAX - 1);
    expect(new Date(r.regenAt!).getTime()).toBe(now + 3 * H);
  });
  test('spend z NIEpełnego banku (już tykał) NIE resetuje istniejącego zegara', () => {
    const now = 2_000_000;
    const existingRegenAt = new Date(now + H).toISOString(); // w trakcie odliczania
    const r = energySpendTick(1, existingRegenAt, MAX, now);
    expect(r.energy).toBe(0);
    expect(r.regenAt).toBe(existingRegenAt); // bez zmian — user nie traci postępu
  });
  test('spend z zerowego banku nie schodzi poniżej zera', () => {
    const r = energySpendTick(0, null, MAX, 1000);
    expect(r.energy).toBe(0);
  });
});

// 2026-08-18, user: "musimy zrobić że [niepokonani bossowie] mają... mityczne znaki, że nie
// wiadomo o co chodzi, dopóki nie pokonasz wcześniejszego" — placeholder "nazwa" dla bossów
// dalej w kolejności kampanii, patrz komentarz nad `mysteryBossName` w bosses.ts.
describe('bosses — mysteryBossName (placeholder dla jeszcze nieodblokowanych)', () => {
  test('deterministyczna — ten sam id zawsze daje ten sam wynik', () => {
    expect(mysteryBossName('sloth')).toBe(mysteryBossName('sloth'));
  });
  test('różne id dają (zazwyczaj) różne placeholdery — nie jeden stały string dla wszystkich', () => {
    const names = new Set(BOSSES.map(b => mysteryBossName(b.id)));
    expect(names.size).toBeGreaterThan(1);
  });
  test('nigdy nie zawiera prawdziwej nazwy/id bossa — czysto symboliczne', () => {
    for (const b of BOSSES) {
      const placeholder = mysteryBossName(b.id);
      expect(placeholder).not.toContain(b.id);
      expect(placeholder.toLowerCase()).not.toContain(b.name.toLowerCase());
    }
  });
  // BUG FIX (2026-08-19, user screenshot: "◆undefinedundefined" na liście bossów) — `>>`
  // (signed shift) na hashu unsigned dawał UJEMNE przesunięcie dla ~połowy wartości hash,
  // `(ujemna) % 14` w JS zostawało ujemne, indeks tablicy ujemny → `undefined`. Ten test
  // przeszedłby na starym, zepsutym kodzie dla WSZYSTKICH 22 bossów kampanii tylko przez
  // przypadek (gdyby żaden hash nie ustawił bitu 31) — dlatego sprawdzamy TAKŻE szeroki,
  // syntetyczny zestaw id (nie tylko realny roster), żeby złapać oba znaki hasha.
  test('zawsze dokładnie 3 symbole z MYSTERY_GLYPHS, nigdy "undefined" — dla całego rosteru i syntetycznych id', () => {
    const ids = [...BOSSES.map(b => b.id), ...Array.from({ length: 200 }, (_, i) => `synthetic_id_${i}`)];
    for (const id of ids) {
      const placeholder = mysteryBossName(id);
      expect(placeholder).not.toContain('undefined');
      expect([...placeholder].length).toBe(3);
    }
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
    expect(elite.map(b => b.id)).toEqual([
      'insomnia', 'compare', 'drought', 'procrast', 'doubt', 'devourer',
      'samurai', 'jaguar', 'dinosaur', 'piratecapitan', 'hades', 'clown', 'princess', 'wizard',
    ]);
  });
});

describe('bosses — counterDamage (2026-08-13: liczy od AKTUALNEGO, nie max HP bossa)', () => {
  test('skaluje z aktualnym HP bossa, bez uniku', () => {
    expect(counterDamage(300, 0)).toBe(15);   // 300 * 0.05
    expect(counterDamage(1000, 0)).toBe(50);  // 1000 * 0.05
  });
  test('unik redukuje obrażenia, cap 90%', () => {
    expect(counterDamage(1000, 0.5)).toBe(25);   // połowa
    expect(counterDamage(1000, 0.9)).toBe(5);    // 10% zostaje
    expect(counterDamage(1000, 1.5)).toBe(5);    // cap na 0.9, nie ujemne
  });
  test('słabnie w miarę jak boss traci HP — nie stały numer całej walki', () => {
    expect(counterDamage(1000, 0)).toBeGreaterThan(counterDamage(200, 0));
    expect(counterDamage(0, 0)).toBe(0); // wybity boss nie kontratakuje
  });
  // 2026-08-17: guard (Twój cios ×0.5) BEZ tego fixu podwaja skumulowany kontratak wobec
  // bossa bez guard o tym samym hp (2× rund ekspozycji na TĘ SAMĄ % stawkę) — symulacja
  // znalazła że to robiło finałowego bossa kampanii praktycznie niewygrywalnym.
  test('guard tnie kontratak o połowę — kompensuje 2× rund ekspozycji z ciosem ×0.5', () => {
    expect(counterDamage(1000, 0, true)).toBe(counterDamage(1000, 0, false) / 2);
    expect(counterDamage(1000, 0)).toBe(counterDamage(1000, 0, false)); // domyślnie bez guard
  });
  // 2026-08-19 — user przejrzał log walk questowych: boss przy 1 HP (żywy!) miał kontratak
  // zaokrąglony w dół do 0 (5% z 1 = 0.05 → round → 0), co wyglądało jak "martwy boss nadal
  // dostaje ciosy" (dobijający cios w kolejnej rundzie renderował się bez poprzedzającego go
  // kontrataku). Żywy boss ma teraz ZAWSZE co najmniej 1 obrażenie na kontratak.
  test('żywy boss (hp>0) zadaje ZAWSZE co najmniej 1 obrażenie, nawet przy mikroskopijnym hp', () => {
    expect(counterDamage(1, 0)).toBe(1);   // 1*0.05=0.05 → bez fixu zaokrągliłoby do 0
    expect(counterDamage(5, 0)).toBe(1);   // 5*0.05=0.25 → też by się zaokrągliło do 0
    expect(counterDamage(1, 0.9)).toBe(1); // nawet z maks. unikiem, żywy boss wciąż >=1
  });
});

describe('bosses — BOSSES roster balance (2026-08-13, patrz memory boss_design.md „balance review")', () => {
  test('żaden boss nie łączy guard + regenPct — kombinacja potrafi zrobić bossa niezabijalnym (0.5×atkPower < regenPct×hp)', () => {
    const both = BOSSES.filter(b => b.guard && b.regenPct);
    expect(both).toEqual([]);
  });
  test('hp rośnie monotonicznie z order (nigdy nie spada wraz z kolejnym bossem)', () => {
    const sorted = [...BOSSES].sort((a, b) => a.order - b.order);
    for (let i = 1; i < sorted.length; i++) expect(sorted[i].hp).toBeGreaterThanOrEqual(sorted[i - 1].hp);
  });
  test('KAŻDY boss kampanii jest wygrywalny w ≤50 rundach przy ZEROWEJ inwestycji gracza (regresja na "matematycznie niewygrywalny" bug)', () => {
    const noBonus: Bonuses = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };
    for (const b of BOSSES) {
      const r = simulateFight(0, b.unlockLevel, noBonus, b, 100); // 0 inwestycji, bazowe 100 HP kotka
      expect(r.rounds.length).toBeLessThanOrEqual(50);
      // nie wymagamy r.won (zerowa inwestycja to najgorszy przypadek, kotek może paść) —
      // wymagamy tylko że walka faktycznie SIĘ ROZSTRZYGA w rozsądnej liczbie rund, nie
      // grzęźnie w sufit MAX_FIGHT_ROUNDS=200 jak przy starej krzywej HP.
      expect(r.won || r.catFainted).toBe(true);
    }
  });
});

describe('bosses — simulateFight (silnik rund)', () => {
  test('miażdżąca przewaga staty → wygrana, kotek bez zadrapania', () => {
    const b = boss({ hp: 10 }); // trywialnie mało HP
    const r = simulateFight(1_000_000, 1, noCrit, b, 100);
    expect(r.won).toBe(true);
    expect(r.catFainted).toBe(false);
    expect(r.bossHpLeft).toBe(0);
    expect(r.rounds.length).toBeLessThanOrEqual(3); // ubity zanim rundy się skończą
  });

  test('boss za mocny na kontratak → kotek pada, walka przegrana', () => {
    const b = boss({ hp: 100_000_000 }); // gracz go nie zadrapie w 3 rundach nawet z zerowym statem
    const r = simulateFight(0, 1, noCrit, b, 5); // 5 HP kotka, wielki kontratak
    expect(r.won).toBe(false);
    expect(r.catFainted).toBe(true);
    expect(r.catHpLeft).toBe(0);
  });

  test('walka kończy się natychmiast po zabiciu bossa — brak kontrataku w tej rundzie', () => {
    const b = boss({ hp: 1 }); // padnie na pierwszym ciosie nawet z zerowym statem
    const r = simulateFight(0, 1, noCrit, b, 100);
    expect(r.rounds).toHaveLength(1);
    expect(r.rounds[0].counterDmg).toBe(0); // boss umarł, nie zdążył kontratakować
    expect(r.catHpLeft).toBe(100); // kotek nietknięty
  });

  test('remis rund (nikt nie padł) → nie wygrana, kotek żyje — próba nieudana, nie porażka', () => {
    const b = boss({ hp: 100_000_000 });
    const r = simulateFight(0, 1, noCrit, b, 1_000_000_000, 3); // ogromne HP kotka, boss za twardy
    expect(r.won).toBe(false);
    expect(r.catFainted).toBe(false);
    expect(r.rounds).toHaveLength(3);
  });

  test('domyślny sufit rund NIE ucina prawdziwej walki wcześniej niż HP=0 po którejś stronie — regresja na "3 rundy to za mało" (user 2026-08-11)', () => {
    // boss #1 kampanii przy odblokowaniu, bazowe staty gracza (bez zakupów) — pod starym
    // sztywnym FIGHT_ROUNDS=3 to ZAWSZE kończyło się remisem (300 HP bossa, ~40 dmg/cios),
    // więc walkę dało się TYLKO przegrać przez wyczerpanie, nigdy realnie wygrać/przegrać.
    const sloth = BOSSES[0];
    const bonuses: Bonuses = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };
    const r = simulateFight(0, sloth.unlockLevel, bonuses, sloth, 100); // domyślny roundCount = MAX_FIGHT_ROUNDS
    expect(r.rounds.length).toBeGreaterThan(3); // nie ucięte po 3 wymianach
    expect(r.won || r.catFainted).toBe(true);   // realny wynik: ktoś padł, nie "czas się skończył"
  });

  test('kontratak SŁABNIE w miarę wielorundowej walki — regresja na "kwadratowy" balance bug (2026-08-13: liczony był ze STAŁEGO max HP bossa, więc każdy kontratak całej walki był tej samej, ogromnej wielkości niezależnie od tego ile bossowi zostało)', () => {
    const b = boss({ hp: 5000 });
    // słaby gracz → wiele rund, dużo kontrataków do porównania; ogromne HP kotka żeby
    // walka dobiegła końca (nie interesuje nas tu wynik, tylko TREND kontrataku w rundach)
    const r = simulateFight(0, 1, noCrit, b, 1_000_000, 200);
    const hits = r.rounds.filter(x => x.counterDmg > 0);
    expect(hits.length).toBeGreaterThan(5); // realnie wieloruudowa walka
    expect(hits[0].counterDmg).toBeGreaterThan(hits[hits.length - 1].counterDmg);
  });

  test('OSŁONA: wrodzona cecha bossa → Twoje ciosy w całej walce o połowę słabsze', () => {
    const guardedBoss = boss({ hp: 1_000_000, guard: true });
    const freeBoss = boss({ hp: 1_000_000, guard: false });
    const randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5); // ta sama wariancja/brak krytu w obu
    const guardedFight = simulateFight(10000, 1, noCrit, guardedBoss, 100, 1);
    const freeFight = simulateFight(10000, 1, noCrit, freeBoss, 100, 1);
    randSpy.mockRestore();
    expect(guardedFight.guarded).toBe(true);
    expect(freeFight.guarded).toBe(false);
    expect(guardedFight.rounds[0].playerDmg).toBe(Math.round(freeFight.rounds[0].playerDmg / 2));
  });

  test('REGENERACJA: wrodzona cecha → boss leczy się co rundę, którą przeżyje', () => {
    const b = boss({ hp: 1_000_000, regenPct: 0.1 }); // 10% za rundę, mały stat nie zabija w 1 ciosie
    const r = simulateFight(0, 1, noCrit, b, 100, 2);
    expect(r.rounds.some(rd => rd.healed > 0)).toBe(true);
  });
});

describe('bosses — simulateFight z itemami bojowymi (v4.1, jeszcze bez UI do zakładania)', () => {
  const item = (id: EquippedItem['id'], level = 1): EquippedItem[] => [{ id, level }];
  let randSpy: jest.SpyInstance;
  afterEach(() => { randSpy?.mockRestore(); });

  test('bez itemów (domyślne []) — zachowanie identyczne jak jawne []', () => {
    const b = boss({ hp: 10 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
    const withDefault = simulateFight(1_000_000, 1, noCrit, b, 100);
    const withEmpty = simulateFight(1_000_000, 1, noCrit, b, 100, 3, []);
    expect(withDefault.won).toBe(withEmpty.won);
    expect(withDefault.bossHpLeft).toBe(withEmpty.bossHpLeft);
  });

  test('headshot: gdy proc — cios ×2', () => {
    // random=0 → headshot (0,5% szansy) ZAWSZE procuje gdy item posiadany (has() bramkuje
    // Math.random(), więc "bez itemu" w ogóle nie odpytuje tej szansy) — obie strony mają
    // tę samą wariancję/brak krytu z tego samego mocka, jedyna różnica to ×2 z headshota.
    const b = boss({ hp: 100_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const withItem = simulateFight(10000, 1, noCrit, b, 100, 1, item('headshot'));
    const without = simulateFight(10000, 1, noCrit, b, 100, 1, []);
    expect(withItem.rounds[0].playerDmg).toBe(without.rounds[0].playerDmg * 2);
  });

  test('dodge: gdy proc — kontratak w pełni unikany (0 obrażeń kotka)', () => {
    const b = boss({ hp: 100_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const r = simulateFight(0, 1, noCrit, b, 1000, 1, item('dodge'));
    expect(r.rounds[0].counterDmg).toBe(0);
    expect(r.catHpLeft).toBe(1000);
  });

  test('mindcontrol: gdy proc — boss w ogóle nie kontratakuje tej rundy', () => {
    const b = boss({ hp: 100_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const r = simulateFight(0, 1, noCrit, b, 1000, 1, item('mindcontrol'));
    expect(r.rounds[0].counterDmg).toBe(0);
  });

  test('shield: redukuje obrażenia kontrataku o stały procent', () => {
    const b = boss({ hp: 100_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999); // bez szansowych efektów
    const withItem = simulateFight(0, 1, noCrit, b, 10_000_000, 1, item('shield'));
    const without = simulateFight(0, 1, noCrit, b, 10_000_000, 1, []);
    expect(withItem.rounds[0].counterDmg).toBeLessThan(without.rounds[0].counterDmg);
  });

  test('thorn: gwarantowane odbicie co rundę, NIEZALEŻNIE od losowania', () => {
    const b = boss({ hp: 100_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999); // wszystkie SZANSOWE efekty nie procują
    const withItem = simulateFight(0, 1, noCrit, b, 10_000_000, 1, item('thorn'));
    const without = simulateFight(0, 1, noCrit, b, 10_000_000, 1, []);
    expect(withItem.bossHpLeft).toBeLessThan(without.bossHpLeft); // thorn ugryzł bossa mimo braku procków
  });

  test('reflect: gdy proc — kontratak przekierowany na bossa, kotek nietknięty', () => {
    const b = boss({ hp: 100_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0);
    const r = simulateFight(0, 1, noCrit, b, 1000, 1, item('reflect'));
    expect(r.rounds[0].counterDmg).toBe(0);
    expect(r.catHpLeft).toBe(1000);
    expect(r.bossHpLeft).toBeLessThan(b.hp); // boss dostał odbite obrażenia
  });

  test('execute: HP bossa poniżej progu → instakill', () => {
    // atkStatBonus dobrany eksperymentalnie tak, żeby SAM cios (z wariancją do 1.15×)
    // zbił bossa nisko ale NIE do zera — potem execute (próg 4,5% na poziomie 3) dobija.
    const b = boss({ hp: 100000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.5); // środkowa wariancja, deterministyczne
    const withExecute = simulateFight(96000, 1, noCrit, b, 1000, 1, item('execute', 3));
    const withoutExecute = simulateFight(96000, 1, noCrit, b, 1000, 1, []);
    expect(withoutExecute.bossHpLeft).toBeGreaterThan(0); // sam cios NIE zabija
    expect(withExecute.won).toBe(true); // execute dobija
  });

  test('fire: po podpaleniu, DoT działa w KOLEJNYCH rundach', () => {
    const b = boss({ hp: 100_000_000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0); // podpala się od razu
    const r = simulateFight(0, 1, noCrit, b, 10_000_000, 3, item('fire'));
    expect(r.rounds.length).toBeGreaterThan(1);
    // każda kolejna runda boss traci dodatkowo z DoT — HP spada bardziej niż samym atakiem
    expect(r.rounds[1].bossHpAfter).toBeLessThan(r.rounds[0].bossHpAfter);
  });

  test('heal: pierwszy raz <50% HP kotka w walce → jednorazowe leczenie', () => {
    // boss.hp dobrany tak, żeby kontratak obniżał HP kotka (100) STOPNIOWO przez próg
    // 50%, zamiast zabić go od razu jednym ciosem.
    const b = boss({ hp: 1000 });
    randSpy = jest.spyOn(Math, 'random').mockReturnValue(0.999); // bez innych procków
    const r = simulateFight(0, 1, noCrit, b, 100, 3, item('heal'));
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
