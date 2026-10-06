import { usePetStore } from '@/store/petStore';
import { gearInstanceId, GEAR_SLOT_CAP } from '@/utils/gear';

// 2026-09-18: model instancji (patrz grantGear.test.ts) — buyDailyGear() nie blokuje już
// zakup "już masz (lub lepszy)" (ta reguła istniała TYLKO bo stary model miał jeden slot
// per item; teraz duplikat to prawidłowa, osobna instancja). Jedyne pozostałe blokady:
// dzienny slot zakupu (dayClaims) i wystarczające monety.

const ITEM = 'helm_slomiany'; // realny item z katalogu (helm, unlockLevel 1)

function resetStore(coins: number) {
  usePetStore.setState({ coins, ownedGear: {}, dayClaims: {}, pendingGearOverflow: [] });
}

describe('petStore.buyDailyGear', () => {
  beforeEach(() => resetStore(1000));

  test('nowy item (nieposiadany) — udany zakup: pobiera monety, ustawia ownedGear (itemId:001) i dayClaims', () => {
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100, 5);
    expect(ok).toBe(true);
    const s = usePetStore.getState();
    expect(s.coins).toBe(900);
    expect(s.ownedGear[gearInstanceId(ITEM, 1)]).toEqual({ itemId: ITEM, seq: 1, rarity: 'common', value: 5 });
    expect(s.dayClaims['day1:helm_slomiany']).toBe(true);
  });

  test('item JUŻ posiadany w tej samej rzadkości — zakup mimo to się udaje, jako NOWA instancja obok starej', () => {
    const firstId = usePetStore.getState().grantGear(ITEM, 'common', 10);
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100, 6);
    expect(ok).toBe(true);
    const s = usePetStore.getState();
    expect(s.coins).toBe(900);
    expect(s.ownedGear[firstId]).toEqual({ itemId: ITEM, seq: 1, rarity: 'common', value: 10 }); // stara nietknięta
    expect(s.ownedGear[gearInstanceId(ITEM, 2)]).toEqual({ itemId: ITEM, seq: 2, rarity: 'common', value: 6 }); // nowa obok
  });

  test('za mało monet — zakup odrzucony, nic się nie zmienia', () => {
    resetStore(50);
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100, 5);
    expect(ok).toBe(false);
    const s = usePetStore.getState();
    expect(s.coins).toBe(50);
    expect(Object.keys(s.ownedGear)).toHaveLength(0);
  });

  test('slot dnia już zużyty (dayClaims) — zakup odrzucony nawet z wystarczającymi monetami', () => {
    usePetStore.setState({ dayClaims: { 'day1:helm_slomiany': true } });
    const before = usePetStore.getState().coins;
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100, 5);
    expect(ok).toBe(false);
    expect(usePetStore.getState().coins).toBe(before);
  });
});

// Limit slotu ekwipunku (2026-10-06, patrz grantGear.test.ts) — zakup w Sklepie dnia to
// GWARANTOWANY zakup, więc slot pełny NIE blokuje zakup (monety schodzą, dzienny slot się
// zajmuje), tylko kolejkuje przyznanie itemu (ten sam `pendingGearOverflow` co grantGear).
describe('petStore.buyDailyGear — limit slotu (pendingGearOverflow)', () => {
  beforeEach(() => resetStore(100000));

  test('slot pełny — zakup mimo to "udany" (monety+dayClaims), item w kolejce, NIE w ownedGear', () => {
    for (let i = 0; i < GEAR_SLOT_CAP; i++) usePetStore.getState().grantGear(ITEM, 'common', 1);
    const coinsBefore = usePetStore.getState().coins;
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'legendary', 200, 50);
    expect(ok).toBe(true);
    const s = usePetStore.getState();
    expect(s.coins).toBe(coinsBefore - 200); // zapłacone
    expect(s.dayClaims['day1:helm_slomiany']).toBe(true); // dzienny slot zajęty
    expect(Object.keys(s.ownedGear)).toHaveLength(GEAR_SLOT_CAP); // NIE przyznane od razu
    expect(s.pendingGearOverflow).toEqual([{ itemId: ITEM, rarity: 'legendary', value: 50 }]);
  });
});
