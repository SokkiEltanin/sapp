import { usePetStore } from '@/store/petStore';
import { gearById, gearSellValue } from '@/utils/gear';

// 2026-08-27: user zgłosił zniknięcie dropu — "jak w skrzynce daily wydropiłem to mi zniknął
// po prostu nic nie dostałem bo chyba miałem podobny albo wgle zniknął". grantGear() (wołane
// przez onBuyBox/onDailyBox w pet-shop.tsx i pet.tsx po wylosowaniu nagrody) było CICHYM
// no-opem gdy trafił się duplikat (item już posiadany w ≥ tej rzadkości) — BoxRevealModal i
// tak pokazywał kartę "wygranej", ale ownedGear się nie zmieniało i user faktycznie nie
// dostawał NIC. Fix: duplikat kompensowany monetami (ta sama stawka co ręczna sprzedaż w
// sellGear) zamiast wyrzucany w próżnię; grantGear zwraca skompensowaną kwotę (0 = normalny
// przyznany item) żeby UI mogło pokazać to uczciwie (patrz BoxRevealModal prop `dupeCoins`).
//
// 2026-08-31: `ownedGear` przechowuje teraz `{ rarity, value }` (roll w przedziale, patrz
// gear.ts GEAR_ROLL_SPREAD) i `grantGear` przyjmuje `value` jako 3. argument — "duplikat" jest
// TERAZ ustalane przez `isGearUpgrade` (rarity najpierw, przy remisie wygrywa wyższy `value`),
// nie samą rzadkość.

const ITEM = 'helm_slomiany'; // realny item z katalogu (helm, unlockLevel 1)

function resetStore(coins: number) {
  usePetStore.setState({ coins, ownedGear: {} });
}

describe('petStore.grantGear', () => {
  beforeEach(() => resetStore(0));

  test('nowy item (nieposiadany) — przyznany normalnie, zwraca 0 (brak kompensaty)', () => {
    const compensated = usePetStore.getState().grantGear(ITEM, 'common', 5);
    expect(compensated).toBe(0);
    const s = usePetStore.getState();
    expect(s.ownedGear[ITEM]).toEqual({ rarity: 'common', value: 5 });
    expect(s.coins).toBe(0);
  });

  test('BUG FIX: duplikat w TEJ SAMEJ rzadkości z RÓWNYM LUB GORSZYM rollem — NIE ginie, kompensowany monetami', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: { rarity: 'common', value: 10 } } });
    const compensated = usePetStore.getState().grantGear(ITEM, 'common', 6);
    const item = gearById(ITEM)!;
    const expected = gearSellValue(item, 'common');
    expect(compensated).toBe(expected);
    expect(compensated).toBeGreaterThan(0);
    const s = usePetStore.getState();
    expect(s.coins).toBe(expected);
    expect(s.ownedGear[ITEM]).toEqual({ rarity: 'common', value: 10 }); // niezmienione, nie duplikat w slocie
  });

  test('BUG FIX: drop w GORSZEJ rzadkości niż posiadana — też kompensowany, nie degraduje', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: { rarity: 'epic', value: 40 } } });
    const compensated = usePetStore.getState().grantGear(ITEM, 'common', 6);
    expect(compensated).toBeGreaterThan(0);
    const s = usePetStore.getState();
    expect(s.ownedGear[ITEM]).toEqual({ rarity: 'epic', value: 40 }); // nie zdegradowane
    expect(s.coins).toBe(compensated);
  });

  test('upgrade: drop w LEPSZEJ rzadkości niż posiadana — przyznany normalnie, zwraca 0', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: { rarity: 'common', value: 6 } } });
    const compensated = usePetStore.getState().grantGear(ITEM, 'rare', 20);
    expect(compensated).toBe(0);
    const s = usePetStore.getState();
    expect(s.ownedGear[ITEM]).toEqual({ rarity: 'rare', value: 20 });
    expect(s.coins).toBe(0);
  });

  // 2026-08-31 — user: "lepszy roll w tej samej rzadkości to realny upgrade" — TA SAMA
  // rzadkość, ale WYŻSZY `value` niż posiadany, dalej liczy się jako ulepszenie (przyznany
  // normalnie, zwraca 0), nie duplikat.
  test('upgrade: LEPSZY roll w TEJ SAMEJ rzadkości — przyznany normalnie, zwraca 0', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: { rarity: 'common', value: 5 } } });
    const compensated = usePetStore.getState().grantGear(ITEM, 'common', 9);
    expect(compensated).toBe(0);
    const s = usePetStore.getState();
    expect(s.ownedGear[ITEM]).toEqual({ rarity: 'common', value: 9 });
    expect(s.coins).toBe(0);
  });
});
