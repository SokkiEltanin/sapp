import {
  GEAR_ITEMS, GEAR_SLOTS, RARITY_MULT, SLOT_STAT,
  gearById, gearBySlot, gearStatValue, unlockedGearFor,
} from '@/utils/gear';

describe('gear — katalog', () => {
  test('30 itemów total, dokładnie 5 na każdy z 6 slotów', () => {
    expect(GEAR_ITEMS).toHaveLength(30);
    expect(GEAR_SLOTS).toHaveLength(6);
    for (const slot of GEAR_SLOTS) {
      expect(gearBySlot(slot)).toHaveLength(5);
    }
  });

  test('unikalne id dla wszystkich itemów', () => {
    const ids = GEAR_ITEMS.map(g => g.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  test('progresja unlockLevel w każdym slocie: 1, 20, 40, 65, 90 rosnąco', () => {
    for (const slot of GEAR_SLOTS) {
      const levels = gearBySlot(slot).map(g => g.unlockLevel);
      expect(levels).toEqual([1, 20, 40, 65, 90]);
    }
  });

  test('każdy item ma wymaganą ikonę (require się nie wywalił)', () => {
    for (const item of GEAR_ITEMS) expect(item.icon).toBeTruthy();
  });

  test('gearById zwraca poprawny item, nieznane id → undefined', () => {
    expect(gearById('helm_slomiany')?.name).toBe('Słomiany Kapelusz');
    expect(gearById('nonsense')).toBeUndefined();
  });
});

describe('gear — RARITY_MULT (zakotwiczone na przykładzie usera: pancerz +1/+5/+15 hp)', () => {
  test('common ×1, rare ×5, mythic ×15 — dokładnie z przykładu usera', () => {
    expect(RARITY_MULT.common).toBe(1);
    expect(RARITY_MULT.rare).toBe(5);
    expect(RARITY_MULT.mythic).toBe(15);
  });
  test('rosnąca monotonicznie common < rare < epic < legendary < mythic', () => {
    expect(RARITY_MULT.common).toBeLessThan(RARITY_MULT.rare);
    expect(RARITY_MULT.rare).toBeLessThan(RARITY_MULT.epic);
    expect(RARITY_MULT.epic).toBeLessThan(RARITY_MULT.legendary);
    expect(RARITY_MULT.legendary).toBeLessThan(RARITY_MULT.mythic);
  });

  test('gearStatValue: pancerz T1 (zbroja_szmaciana) common=+1hp, rare=+5hp, mythic=+15hp', () => {
    const item = gearById('zbroja_szmaciana')!;
    expect(gearStatValue(item, 'common')).toBe(1);
    expect(gearStatValue(item, 'rare')).toBe(5);
    expect(gearStatValue(item, 'mythic')).toBe(15);
  });
});

describe('gear — SLOT_STAT (jeden slot = jeden stat, bez nakładania)', () => {
  test('każdy slot mapuje na inny stat', () => {
    const stats = GEAR_SLOTS.map(s => SLOT_STAT[s]);
    expect(new Set(stats).size).toBe(stats.length);
  });
});

describe('gear — unlockedGearFor (gating wg poziomu pupila)', () => {
  test('poziom 1: tylko T1 odblokowany w każdym slocie', () => {
    for (const slot of GEAR_SLOTS) {
      const unlocked = unlockedGearFor(slot, 1);
      expect(unlocked).toHaveLength(1);
      expect(unlocked[0].unlockLevel).toBe(1);
    }
  });
  test('poziom 90: wszystkie 5 tierów odblokowane', () => {
    for (const slot of GEAR_SLOTS) {
      expect(unlockedGearFor(slot, 90)).toHaveLength(5);
    }
  });
  test('poziom 39: T1/T2 tak, T3 (unlock 40) jeszcze nie', () => {
    const helm = unlockedGearFor('helm', 39);
    expect(helm.map(g => g.unlockLevel)).toEqual([1, 20]);
  });
});
