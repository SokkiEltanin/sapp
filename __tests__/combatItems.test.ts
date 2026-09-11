import {
  COMBAT_ITEMS, HEADSHOT_CHANCE, HEAL_ONCE_PCT, dodgeChanceAt, reflectPctAt,
  executeThresholdAt, fireProcChanceAt, FIRE_DOT_PCT, itemById, combatItemStatText,
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

// 2026-09-11, user (ekran Pupil): "żeby pokazywało co one robią lepiej ze statystykami
// dokładnie ile czego" — `def.desc` był generyczny i nie zmieniał się z poziomem.
describe('combatItems — combatItemStatText (opis z DOKŁADNĄ, aktualną wartością)', () => {
  test('poziom-niezależne itemy pokazują stałą wartość', () => {
    expect(combatItemStatText('headshot', 1)).toContain('0.5%');
    expect(combatItemStatText('heal', 1)).toContain('5%');
    expect(combatItemStatText('shield', 1)).toContain('5%');
    expect(combatItemStatText('thorn', 1)).toContain('2%');
    expect(combatItemStatText('mindcontrol', 1)).toContain('3%');
  });

  test('dodge: tekst zmienia się z poziomem (5% → 17%), zgodnie z dodgeChanceAt', () => {
    expect(combatItemStatText('dodge', 1)).toContain('5%');
    expect(combatItemStatText('dodge', 4)).toContain('17%');
    expect(combatItemStatText('dodge', 1)).not.toBe(combatItemStatText('dodge', 4));
  });

  test('reflect: tekst rośnie z poziomem (1% → 5%), zgodnie z reflectPctAt', () => {
    expect(combatItemStatText('reflect', 1)).toContain('1%');
    expect(combatItemStatText('reflect', 4)).toContain('5%');
  });

  test('execute: próg rośnie z poziomem (poziom 2 = 3%, jak w opisie usera)', () => {
    expect(combatItemStatText('execute', 2)).toContain('3%');
  });

  test('fire: szansa rośnie z poziomem (poziom 2 = 4%) i zawiera stały DoT (2%)', () => {
    const t = combatItemStatText('fire', 2);
    expect(t).toContain('4%');
    expect(t).toContain('2%');
  });
});
