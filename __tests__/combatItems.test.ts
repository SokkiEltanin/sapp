import {
  COMBAT_ITEMS, HEADSHOT_CHANCE, HEAL_ONCE_PCT, dodgeChanceAt, reflectPctAt,
  executeThresholdAt, fireProcChanceAt, FIRE_DOT_PCT, itemById,
} from '@/utils/combatItems';

describe('combatItems — katalog', () => {
  test('każdy item ma tyle ikon ile maxLevel', () => {
    for (const item of Object.values(COMBAT_ITEMS)) {
      expect(item.icons).toHaveLength(item.maxLevel);
    }
  });

  test('itemById zwraca poprawny wpis', () => {
    expect(itemById('headshot').name).toBe('Strzał w Łeb');
    expect(itemById('dodge').maxLevel).toBe(4);
  });
});

describe('combatItems — formuły zgodne z opisem usera', () => {
  test('headshot: 0,5% szansy na cios ×2', () => {
    expect(HEADSHOT_CHANCE).toBe(0.005);
  });

  test('heal: jednorazowo +5% <50% hp', () => {
    expect(HEAL_ONCE_PCT).toBe(0.05);
  });

  test('execute (egzekucja): poziom 2 (knives) = 3% próg', () => {
    expect(executeThresholdAt(2)).toBeCloseTo(0.03);
  });

  test('fire (podpalenie): poziom 2 (ghost) = 4% szansy, +2% dmg/rundę', () => {
    expect(fireProcChanceAt(2)).toBeCloseTo(0.04);
    expect(FIRE_DOT_PCT).toBe(0.02);
  });

  test('reflect (odbicie): zakres 1-5% na 4 poziomach, rosnący', () => {
    expect(reflectPctAt(1)).toBeCloseTo(0.01);
    expect(reflectPctAt(4)).toBeCloseTo(0.05);
    expect(reflectPctAt(2)).toBeGreaterThan(reflectPctAt(1));
    expect(reflectPctAt(3)).toBeGreaterThan(reflectPctAt(2));
  });

  test('dodge: rośnie z poziomem, mieści się w rozsądnym zakresie (TODO-balance)', () => {
    expect(dodgeChanceAt(1)).toBeLessThan(dodgeChanceAt(4));
    expect(dodgeChanceAt(4)).toBeLessThan(1); // nigdy pewny unik
  });
});
