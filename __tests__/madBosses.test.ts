import { BOSSES, Bonuses } from '@/utils/bosses';
import { madBossHpFor, madBossId, madCandidate, madBossFor, MAD_UNLOCK_LEVEL, MAD_REWARD_MULT } from '@/utils/madBosses';

const ZERO: Bonuses = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };

describe('madBosses — madCandidate (pierwszy pokonany-ale-nie-MAD, po kolejności)', () => {
  test('brak pokonanych bossów kampanii → brak kandydata', () => {
    expect(madCandidate([], [])).toBeNull();
  });

  test('pokonany pierwszy boss, żaden MAD jeszcze nie ukończony → to on jest kandydatem', () => {
    const c = madCandidate(['sloth'], []);
    expect(c?.id).toBe('sloth');
  });

  test('MAD tego bossa już ukończony → kandydat null (nic więcej nie pokonano normalnie)', () => {
    expect(madCandidate(['sloth'], ['sloth'])).toBeNull();
  });

  test('dwa pokonane normalnie, jeden MAD ukończony → drugi (po kolejności) jest kandydatem', () => {
    const c = madCandidate(['sloth', 'sugar'], ['sloth']);
    expect(c?.id).toBe('sugar');
  });
});

describe('madBosses — balans (rośnie z AKTUALNYM poziomem, nie zamrożone jak kampania)', () => {
  test('HP rośnie z poziomem gracza (na TYM SAMYM bossie)', () => {
    expect(madBossHpFor(0, 100, ZERO, 1)).toBeGreaterThan(madBossHpFor(0, 50, ZERO, 1));
  });

  test('HP rośnie z `order` bossa (późniejszy boss kampanii = trudniejszy MAD)', () => {
    expect(madBossHpFor(0, 50, ZERO, 22)).toBeGreaterThan(madBossHpFor(0, 50, ZERO, 1));
  });

  test('HP rośnie z realną inwestycją gracza (fix 2026-08-15 #2, ta sama poprawka co questBossHpFor)', () => {
    const invested: Bonuses = { atk: 0.20, dodge: 0.10, crit: 0.05, energyMult: 0 };
    expect(madBossHpFor(50, 50, invested, 5)).toBeGreaterThan(madBossHpFor(0, 50, ZERO, 5));
  });

  test('id ma prefiks mad_, nie koliduje z bossem bazowym w defeatedBosses/bossLog', () => {
    expect(madBossId('sloth')).toBe('mad_sloth');
  });

  // 2026-08-18 — user: "daj im o +30% HP więcej niż teraz jest". Throwaway-symulacją
  // sprawdzono że dosłowne +30% łamie winnability dla świeżo Lv15 gracza (MAD_UNLOCK_LEVEL)
  // na order6 (~45% winrate/55% faintRate) — +15% to sprawdzony bezpieczny sufit (order1-6 @
  // Lv15-20 zostaje 100% winrate). Ten test pilnuje że ktoś przypadkiem nie wróci do +30%
  // (albo 0%) bez ponownej walidacji.
  test('HP podbite ~1.15× względem gołej formuły 6→8 ciosów (2026-08-18, nie 1.3× — patrz komentarz w madBosses.ts)', () => {
    const bare1 = 6, bare22 = 8; // stara formuła: 6 + (order-1)*(2/21), order=1→6, order=22→8
    const hp1 = madBossHpFor(0, 50, ZERO, 1);
    const hp22 = madBossHpFor(0, 50, ZERO, 22);
    const bareHp1 = Math.round((40 * (1 + 50 * 0.03)) * bare1);
    const bareHp22 = Math.round((40 * (1 + 50 * 0.03)) * bare22);
    expect(hp1 / bareHp1).toBeGreaterThan(1.1);
    expect(hp1 / bareHp1).toBeLessThan(1.2);
    expect(hp22 / bareHp22).toBeGreaterThan(1.1);
    expect(hp22 / bareHp22).toBeLessThan(1.2);
  });
});

describe('madBosses — madBossFor (kształt gotowy do simulateFight)', () => {
  const sloth = BOSSES.find(b => b.id === 'sloth')!;

  test('nagroda WYŻSZA niż bazowa stawka bossa (MAD_REWARD_MULT)', () => {
    const mad = madBossFor(sloth, 0, 50, ZERO);
    expect(mad.coins).toBe(Math.round(sloth.coins * MAD_REWARD_MULT));
    expect(mad.xp).toBe(Math.round(sloth.xp * MAD_REWARD_MULT));
    expect(MAD_REWARD_MULT).toBeGreaterThan(1);
  });

  test('unlockLevel to FLAT MAD_UNLOCK_LEVEL, nie oryginalny unlockLevel bossa', () => {
    const mad = madBossFor(sloth, 0, 50, ZERO);
    expect(mad.unlockLevel).toBe(MAD_UNLOCK_LEVEL);
    expect(mad.unlockLevel).not.toBe(sloth.unlockLevel);
  });

  test('guard/regenPct NIE są dziedziczone z oryginału (fix 2026-08-15, patrz komentarz)', () => {
    const sugar = BOSSES.find(b => b.id === 'sugar')!; // ma guard: true
    expect(sugar.guard).toBe(true);
    const mad = madBossFor(sugar, 0, 50, ZERO);
    expect(mad.guard).toBeUndefined();
  });

  test('id/name/weakness pochodzą od bossa bazowego, hp od madBossHpFor', () => {
    const mad = madBossFor(sloth, 0, 60, ZERO);
    expect(mad.id).toBe('mad_sloth');
    expect(mad.weakness).toBe(sloth.weakness);
    expect(mad.hp).toBe(madBossHpFor(0, 60, ZERO, sloth.order));
  });
});
