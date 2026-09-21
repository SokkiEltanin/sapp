import { buildBossProgressReport, ProgressReportInput } from '@/utils/bossProgressReport';

const base: ProgressReportInput = {
  xp: 0,
  coins: 0,
  atkStatBonus: 0,
  catMaxHpBonus: 0,
  ownedItems: [],
  defeatedBosses: [],
  ownedCombatItems: {},
  equippedCombatItems: [],
  raidWon: [],
  eventWon: [],
  bossLog: [],
};

// 2026-09-21, user: eksport postępu pupila pokazał "HP kotka: 6558.331368923098" — brzydki,
// niezaokrąglony float zamiast czystej liczby jak wszędzie indziej w apce (na ekranie
// Pupila/w walce HP zawsze przechodzi przez `effectiveCatMaxHp`'s `Math.round`). Przyczyna:
// `rollGearValue` (gear.ts) losuje `OwnedGear.value` jako SUROWY float
// (`min + rand()*(max-min)`, nigdy nie zaokrąglany — świadomie, bo inne miejsca liczą na tej
// precyzji), a raport dotąd sumował `catMaxHp(...) + gearFlatHp(...)` RĘCZNIE, pomijając i
// zaokrąglenie, i `potionFlatHp` (aktywna mikstura HP). Fix: raport woła `effectiveCatMaxHp`
// wprost, jak walka.
describe('bossProgressReport — HP kotka liczone tak samo jak w walce', () => {
  test('gear z ułamkowym wylosowanym `.value` → HP w raporcie i tak zaokrąglone', () => {
    const s: ProgressReportInput = {
      ...base,
      catMaxHpBonus: 50,
      equippedGear: { zbroja: 'zbroja_szmaciana' },
      ownedGear: { zbroja_szmaciana: { rarity: 'common', value: 12.7291834 } },
    };
    const report = buildBossProgressReport(s);
    expect(report).toMatch(/HP kotka: \d+ \(/);       // liczba całkowita, żadnej kropki dziesiętnej
    expect(report).not.toContain('.729');
  });

  test('aktywna mikstura HP wliczona (dotąd całkowicie pomijana w raporcie)', () => {
    const withoutPotion = buildBossProgressReport({ ...base, catMaxHpBonus: 0 });
    const withPotion = buildBossProgressReport({
      ...base,
      catMaxHpBonus: 0,
      activePotion: { kind: 'hp', endsAt: new Date(Date.now() + 3600_000).toISOString() },
    });
    const hpOf = (report: string) => Number(report.match(/HP kotka: (\d+)/)?.[1]);
    expect(hpOf(withPotion)).toBeGreaterThan(hpOf(withoutPotion));
  });
});

describe('bossProgressReport', () => {
  test('pusty stan nie wybucha i wypisuje poziom 1', () => {
    const report = buildBossProgressReport(base);
    expect(report).toContain('Poziom: 1');
    expect(report).toContain('BOSSOWIE KAMPANII: 0/');
    expect(report).toContain('(brak zapisanych walk)');
  });

  test('pokonany boss oznaczony ✓, log walk pokazuje nazwę/poziom/nagrody', () => {
    const s: ProgressReportInput = {
      ...base,
      xp: 500,
      coins: 30,
      defeatedBosses: ['sloth'],
      ownedItems: ['loot_pillow'],
      bossLog: [
        { kind: 'campaign', id: 'sloth', name: 'Kanapowy Leniwiec', at: '2026-08-14T10:00:00.000Z', level: 2, coins: 8, xp: 60 },
      ],
    };
    const report = buildBossProgressReport(s);
    expect(report).toContain('✓ 🦥 Kanapowy Leniwiec');
    expect(report).toMatch(/kampania · Kanapowy Leniwiec · Lv2 · \+8 monet, \+60 XP/);
  });

  // 2026-09-19, user: "zrob potem pełna historie eksportu pupila... z dnia na dzień wbiłem z
  // 51 lvl na 270" — stary `logLimit` UCINAŁ starsze wpisy z raportu całkowicie (niewidoczne,
  // nie tylko skrócone). Teraz nic nie znika: `detailLimit` kontroluje tylko ile NAJNOWSZYCH
  // wpisów dostaje pełny przebieg runda-po-rundzie, reszta trafia do zwięzłej sekcji "STARSZE
  // WALKI" (bez rund/HP, ale wciąż widoczna — level/nagroda/wynik).
  test('detailLimit ogranicza SZCZEGÓŁY (najnowsze), ale starsze wpisy zostają widoczne w skrócie', () => {
    const s: ProgressReportInput = {
      ...base,
      bossLog: [
        { kind: 'campaign', id: 'a', name: 'A', at: '2026-08-01T00:00:00.000Z', level: 1, coins: 1, xp: 1 },
        { kind: 'campaign', id: 'b', name: 'B', at: '2026-08-05T00:00:00.000Z', level: 1, coins: 1, xp: 1 },
      ],
    };
    const report = buildBossProgressReport(s, 1);
    expect(report).toContain('LOG WALK — pełna historia (2 łącznie, szczegóły ostatnich 1)');
    expect(report).toContain('· B ·');
    expect(report).toContain('STARSZE WALKI, skrót (1)');
    expect(report).toMatch(/STARSZE WALKI[\s\S]*· A ·/); // "A" jest w sekcji skrótu, nie w szczegółach
  });

  test('posiadany item bojowy pokazuje poziom i status założenia', () => {
    const s: ProgressReportInput = { ...base, ownedCombatItems: { dodge: 2 }, equippedCombatItems: ['dodge'] };
    const report = buildBossProgressReport(s);
    expect(report).toMatch(/Unik — poziom 2\/4 \[ZAŁOŻONY\]/);
  });

  // 2026-08-17: po usunięciu progu poziomu z odblokowania kampanii (patrz NEXT_STEPS.md),
  // status ikony w raporcie musiały przestać obiecywać 🔒 na podstawie levelu — jedyne stany
  // to pokonany (✓) / aktualny cel (▶) / jeszcze nie w kolejce (·). Do tego każdy wiersz
  // dostał szacunek ciosów PRZY REALNYCH statach gracza, nie gołe hp — dokładnie dane
  // przydatne do throwaway-symulacji balansu bez ręcznego liczenia z surowych liczb.
  test('pierwszy niepokonany boss oznaczony ▶ (aktualny cel), nie 🔒 — poziom już nie blokuje', () => {
    const report = buildBossProgressReport(base); // xp=0 -> level 1, żaden boss nie pokonany
    expect(report).toContain('▶');
    expect(report).not.toContain('🔒');
  });

  test('każdy wiersz bossa pokazuje szacunek ciosów przy aktualnych statach gracza', () => {
    const report = buildBossProgressReport({ ...base, atkStatBonus: 500 });
    expect(report).toMatch(/ciosów przy Twoich statach/);
  });

  // 2026-08-17: user — "niech reset pupila tworzy nowy log danych żeby było wiadomo które od
  // czego" — resetGeneration/lastResetAt (petStore.ts) rosną z każdym resetem zamiast wracać
  // do zera, żeby kolejne eksporty dało się jednoznacznie odróżnić w rozmowie.
  describe('runda testowa (resetGeneration/lastResetAt)', () => {
    test('brak pól = brak linii (stare wywołania/testy bez zmian)', () => {
      const report = buildBossProgressReport(base);
      expect(report).not.toContain('Runda testowa');
    });
    test('resetGeneration bez lastResetAt (nigdy nie resetowano) — "jeszcze bez resetu"', () => {
      const report = buildBossProgressReport({ ...base, resetGeneration: 1, lastResetAt: null });
      expect(report).toContain('Runda testowa: #1 (jeszcze bez resetu)');
    });
    test('resetGeneration + lastResetAt po resecie — numer i data w nagłówku', () => {
      const report = buildBossProgressReport({ ...base, resetGeneration: 3, lastResetAt: '2026-08-17T10:00:00.000Z' });
      expect(report).toContain('Runda testowa: #3');
      expect(report).toContain('ostatni reset:');
    });
  });

  // 2026-08-17: user — "nie zapisujesz do logowania z pupila dokładnie walk z ilością HP w
  // czasie i dmg zadanego mi i którego zadał bossowi... nie wiesz jak bardzo łatwo pokonuje
  // bossy". bossLog dostał opcjonalny przebieg runda-po-rundzie (BossFightDetail) — te testy
  // pilnują że report faktycznie go pokazuje, i że wpisy sprzed tego fixu (bez `rounds`) dalej
  // renderują się jak wcześniej (nie wybuchają, nie zmieniają formatu).
  describe('przebieg walki runda po rundzie (BossFightDetail w bossLog)', () => {
    test('wygrana z pełnym przebiegiem — pokazuje HP bossa/kotka w czasie i dmg/rundę', () => {
      const s: ProgressReportInput = {
        ...base,
        bossLog: [{
          kind: 'campaign', id: 'sloth', name: 'Kanapowy Leniwiec', at: '2026-08-17T10:00:00.000Z',
          level: 4, coins: 8, xp: 60,
          won: true, catFainted: false, bossMaxHp: 382, catMaxHpAtFight: 120,
          rounds: [
            { p: 61, c: 12, bhp: 321, chp: 108 },
            { p: 58, c: 0, bhp: 263, chp: 108 },
          ],
        }],
      };
      const report = buildBossProgressReport(s);
      // 2026-09-19, agent-audyt: było "2 rund" (błędna odmiana — 2 to "few", powinno być
      // "rundy", nie dopełniacz l.mn. "rund" zarezerwowany dla 0/5+).
      expect(report).toContain('WYGRANA (2 rundy)');
      expect(report).toContain('boss HP: 382→321→263');
      expect(report).toContain('kotek HP: 120→108→108');
      expect(report).toContain('Twój dmg/rundę: 61,58');
      expect(report).toContain('kontratak/rundę: 12,0');
    });

    test('przegrana bo kotek zemdlał — oznaczona osobno od przegranej limitem rund', () => {
      const s: ProgressReportInput = {
        ...base,
        bossLog: [{
          kind: 'campaign', id: 'sugar', name: 'Cukrowy Potwór', at: '2026-08-17T10:05:00.000Z',
          level: 4, coins: 0, xp: 0,
          won: false, catFainted: true, bossMaxHp: 414, catMaxHpAtFight: 120,
          rounds: [{ p: 30, c: 120, bhp: 384, chp: 0 }],
        }],
      };
      const report = buildBossProgressReport(s);
      expect(report).toContain('PRZEGRANA (kotek zemdlał)');
      expect(report).toContain('+0 monet, +0 XP');
    });

    test('stary wpis bez `rounds` (sprzed fixu) dalej renderuje samą linię z nagrodą, bez wybuchu', () => {
      const s: ProgressReportInput = {
        ...base,
        bossLog: [
          { kind: 'campaign', id: 'sloth', name: 'Kanapowy Leniwiec', at: '2026-08-14T10:00:00.000Z', level: 2, coins: 8, xp: 60 },
        ],
      };
      const report = buildBossProgressReport(s);
      expect(report).toMatch(/kampania · Kanapowy Leniwiec · Lv2 · \+8 monet, \+60 XP/);
      expect(report).not.toContain('WYGRANA');
      expect(report).not.toContain('boss HP:');
    });
  });
});
