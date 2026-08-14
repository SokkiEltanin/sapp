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
});
