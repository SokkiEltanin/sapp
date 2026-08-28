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

const ITEM = 'helm_slomiany'; // realny item z katalogu (helm, unlockLevel 1)

function resetStore(coins: number) {
  usePetStore.setState({ coins, ownedGear: {} });
}

describe('petStore.grantGear', () => {
  beforeEach(() => resetStore(0));

  test('nowy item (nieposiadany) — przyznany normalnie, zwraca 0 (brak kompensaty)', () => {
    const compensated = usePetStore.getState().grantGear(ITEM, 'common');
    expect(compensated).toBe(0);
    const s = usePetStore.getState();
    expect(s.ownedGear[ITEM]).toBe('common');
    expect(s.coins).toBe(0);
  });

  test('BUG FIX: duplikat w TEJ SAMEJ rzadkości — NIE ginie, kompensowany monetami', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: 'common' } });
    const compensated = usePetStore.getState().grantGear(ITEM, 'common');
    const item = gearById(ITEM)!;
    const expected = gearSellValue(item, 'common');
    expect(compensated).toBe(expected);
    expect(compensated).toBeGreaterThan(0);
    const s = usePetStore.getState();
    expect(s.coins).toBe(expected);
    expect(s.ownedGear[ITEM]).toBe('common'); // niezmienione, nie duplikat w slocie
  });

  test('BUG FIX: drop w GORSZEJ rzadkości niż posiadana — też kompensowany, nie degraduje', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: 'epic' } });
    const compensated = usePetStore.getState().grantGear(ITEM, 'common');
    expect(compensated).toBeGreaterThan(0);
    const s = usePetStore.getState();
    expect(s.ownedGear[ITEM]).toBe('epic'); // nie zdegradowane
    expect(s.coins).toBe(compensated);
  });

  test('upgrade: drop w LEPSZEJ rzadkości niż posiadana — przyznany normalnie, zwraca 0', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: 'common' } });
    const compensated = usePetStore.getState().grantGear(ITEM, 'rare');
    expect(compensated).toBe(0);
    const s = usePetStore.getState();
    expect(s.ownedGear[ITEM]).toBe('rare');
    expect(s.coins).toBe(0);
  });
});
