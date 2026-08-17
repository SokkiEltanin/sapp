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

  test('log jest cięty do logLimit i sortowany od najnowszego', () => {
    const s: ProgressReportInput = {
      ...base,
      bossLog: [
        { kind: 'campaign', id: 'a', name: 'A', at: '2026-08-01T00:00:00.000Z', level: 1, coins: 1, xp: 1 },
        { kind: 'campaign', id: 'b', name: 'B', at: '2026-08-05T00:00:00.000Z', level: 1, coins: 1, xp: 1 },
      ],
    };
    const report = buildBossProgressReport(s, 1);
    expect(report).toContain('LOG WALK (ostatnie 1 z 2)');
    expect(report).toContain('· B ·');
    expect(report).not.toContain('· A ·');
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
});
