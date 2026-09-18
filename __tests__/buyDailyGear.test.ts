import { usePetStore } from '@/store/petStore';
import { gearInstanceId } from '@/utils/gear';

// 2026-09-18: model instancji (patrz grantGear.test.ts) — buyDailyGear() nie blokuje już
// zakup "już masz (lub lepszy)" (ta reguła istniała TYLKO bo stary model miał jeden slot
// per item; teraz duplikat to prawidłowa, osobna instancja). Jedyne pozostałe blokady:
// dzienny slot zakupu (dayClaims) i wystarczające monety.

const ITEM = 'helm_slomiany'; // realny item z katalogu (helm, unlockLevel 1)

function resetStore(coins: number) {
  usePetStore.setState({ coins, ownedGear: {}, dayClaims: {} });
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
