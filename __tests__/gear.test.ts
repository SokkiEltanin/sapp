import {
  GEAR_ITEMS, GEAR_SLOTS, RARITY_MULT, SLOT_STAT,
  gearById, gearBySlot, gearStatValue, unlockedGearFor, dailyShopSlots, gearSellValue,
  gearCombatBonuses, gearFlatHp, gearCoinsMult,
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

describe('gear — dailyShopSlots (sklep dnia, deterministyczny wg daty)', () => {
  test('poziom 1: 4 sloty (domyślny count, ograniczony przez 6 dostępnych T1 itemów)', () => {
    const slots = dailyShopSlots('2026-08-19', 1);
    expect(slots).toHaveLength(4);
    for (const slot of slots) expect(slot.item.unlockLevel).toBe(1);
  });

  test('ten sam dzień + poziom → identyczny zestaw (deterministyczne, nie tasuje się)', () => {
    const a = dailyShopSlots('2026-08-19', 50);
    const b = dailyShopSlots('2026-08-19', 50);
    expect(a.map(x => x.item.id)).toEqual(b.map(x => x.item.id));
    expect(a.map(x => x.rarity)).toEqual(b.map(x => x.rarity));
    expect(a.map(x => x.cost)).toEqual(b.map(x => x.cost));
  });

  test('inny dzień → inny zestaw (w praktyce, nie gwarancja matematyczna, ale sprawdzamy że coś się różni)', () => {
    const a = dailyShopSlots('2026-08-19', 90).map(x => x.item.id).join(',');
    const b = dailyShopSlots('2026-08-20', 90).map(x => x.item.id).join(',');
    expect(a).not.toBe(b);
  });

  test('cost > 0 dla każdego slotu, zero itemów bez odblokowania na tym poziomie', () => {
    const slots = dailyShopSlots('2026-08-19', 90);
    for (const slot of slots) {
      expect(slot.cost).toBeGreaterThan(0);
      expect(slot.item.unlockLevel).toBeLessThanOrEqual(90);
    }
  });

  test('poziom 0 (teoretyczny, brak odblokowanych itemów) → pusta lista, nie crash', () => {
    expect(dailyShopSlots('2026-08-19', 0)).toEqual([]);
  });
});

// Sprzedaż zbędnego/słabszego itemu (2026-08-20, user: "co robimy z itemami co sa słabsze
// ale je mamy w eq? mozna je sprzedać?") — wartość = 40% ceny sklepu dnia dla TEGO SAMEGO
// tier/rarity, żeby kup-i-sprzedaj nie było darmowym arbitrażem.
describe('gear — gearSellValue (sprzedaż, 2026-08-20)', () => {
  const helm = gearById('helm_slomiany')!; // T1, unlockLevel 1

  test('T1 common = 40% z bazowego kosztu sklepu dnia (40 × 1 × 0.4 = 16)', () => {
    expect(gearSellValue(helm, 'common')).toBe(16);
  });

  test('rośnie z rzadkością (mythic > legendary > ... > common)', () => {
    const order = ['common', 'rare', 'epic', 'legendary', 'mythic'] as const;
    const values = order.map(r => gearSellValue(helm, r));
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThan(values[i - 1]);
  });

  test('minimum 1 moneta nawet dla najsłabszego T1 common', () => {
    expect(gearSellValue(helm, 'common')).toBeGreaterThanOrEqual(1);
  });

  test('wyraźnie mniejsza wartość niż item o wyższym tier tej samej rzadkości', () => {
    const tier5 = gearById('helm_koronaBurzy')!; // T5
    expect(gearSellValue(tier5, 'common')).toBeGreaterThan(gearSellValue(helm, 'common'));
  });
});

describe('gear — wpięcie w walkę/ekonomię (krok 8)', () => {
  test('gearCombatBonuses: pusty ekwipunek → same zera', () => {
    expect(gearCombatBonuses({}, {})).toEqual({ atk: 0, dodge: 0, crit: 0, energyMult: 0 });
  });

  test('gearCombatBonuses: jeden założony item dokłada się do właściwego statu', () => {
    const b = gearCombatBonuses({ helm: 'helm_slomiany' }, { helm_slomiany: 'common' });
    expect(b).toEqual({ atk: 0, dodge: 0, crit: 0.0015, energyMult: 0 });
  });

  // Kalibracja balansu (patrz komentarz nad GEAR_ITEMS w gear.ts): pełny mityczny T5
  // loadout na WSZYSTKICH 4 slotach walki NIE MOŻE przebić sumy bonusów z całej kampanii
  // (22 bossy, policzone raz node'em z bosses.ts: atk 0.92, dodge 0.72, crit 0.36,
  // energyMult 0.75) — jeśli ten test kiedyś zacznie failować po zmianie baseValue w
  // gear.ts, to sygnał że ktoś przypadkiem złamał tę kalibrację, nie "false positive".
  test('pełny mityczny T5 loadout (wszystkie 4 sloty walki) zostaje WYRAŹNIE poniżej sumy bonusów z całej kampanii', () => {
    const equipped = { helm: 'helm_koronaBurzy', buty: 'buty_kometa', obroza: 'obroza_tytan', talizman: 'talizman_nieskonczonosc' };
    const owned = { helm_koronaBurzy: 'mythic', buty_kometa: 'mythic', obroza_tytan: 'mythic', talizman_nieskonczonosc: 'mythic' } as const;
    const b = gearCombatBonuses(equipped as any, owned as any);
    const CAMPAIGN_SUM = { atk: 0.92, dodge: 0.72, crit: 0.36, energyMult: 0.75 };
    expect(b.crit).toBeLessThan(CAMPAIGN_SUM.crit);
    expect(b.dodge).toBeLessThan(CAMPAIGN_SUM.dodge);
    expect(b.atk).toBeLessThan(CAMPAIGN_SUM.atk);
    expect(b.energyMult).toBeLessThan(CAMPAIGN_SUM.energyMult);
    // I nie jest to śladowa wartość — powinno być zauważalne (>5% dla każdego statu).
    expect(b.crit).toBeGreaterThan(0.05);
    expect(b.dodge).toBeGreaterThan(0.05);
    expect(b.atk).toBeGreaterThan(0.05);
    expect(b.energyMult).toBeGreaterThan(0.05);
  });

  test('gearFlatHp: mityczna T5 zbroja zostaje wyraźnie poniżej CAT_BASE_MAX_HP (100)', () => {
    const hp = gearFlatHp({ zbroja: 'zbroja_aegis' }, { zbroja_aegis: 'mythic' });
    expect(hp).toBeLessThan(100);
    expect(hp).toBeGreaterThan(0);
  });
  test('gearFlatHp: brak zbroi → 0', () => {
    expect(gearFlatHp({}, {})).toBe(0);
  });

  test('gearCoinsMult: brak kolczyków → mnożnik 1 (bez zmiany)', () => {
    expect(gearCoinsMult({}, {})).toBe(1);
  });
  test('gearCoinsMult: mityczne T5 kolczyki dają rozsądny, nie absurdalny bonus', () => {
    const mult = gearCoinsMult({ kolczyki: 'kolczyki_krezus' }, { kolczyki_krezus: 'mythic' });
    expect(mult).toBeGreaterThan(1);
    expect(mult).toBeLessThan(1.5); // +50% złota z jednego itemu byłoby już za dużo
  });

  test('gearCombatBonuses ignoruje sloty bez odpowiednika w Bonuses (zbroja/kolczyki)', () => {
    const b = gearCombatBonuses(
      { zbroja: 'zbroja_szmaciana', kolczyki: 'kolczyki_drewniane' },
      { zbroja_szmaciana: 'common', kolczyki_drewniane: 'common' },
    );
    expect(b).toEqual({ atk: 0, dodge: 0, crit: 0, energyMult: 0 });
  });
});
