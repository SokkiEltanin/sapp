import { usePetStore } from '@/store/petStore';

// 2026-08-26: user zgłosił realną utratę monet — "kupiłem item który już miałem przez co
// zniknęły mi pieniądze i nic nie dostałem". buyDailyGear() ZAWSZE pobierało `cost` i zużywało
// dzienny slot zakupu, nawet gdy posiadana rzadkość była już równa/lepsza od oferowanej (tylko
// aktualizacja `ownedGear` była wtedy pomijana). Fix: cały zakup jest odrzucany WCZEŚNIEJ
// (return false, przed jakąkolwiek zmianą stanu) gdy user już ma ten item w tej rzadkości lub
// lepszej.

const ITEM = 'helm_slomiany'; // realny item z katalogu (helm, unlockLevel 1)

function resetStore(coins: number) {
  usePetStore.setState({ coins, ownedGear: {}, dayClaims: {} });
}

describe('petStore.buyDailyGear', () => {
  beforeEach(() => resetStore(1000));

  test('nowy item (nieposiadany) — udany zakup: pobiera monety, ustawia ownedGear i dayClaims', () => {
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100);
    expect(ok).toBe(true);
    const s = usePetStore.getState();
    expect(s.coins).toBe(900);
    expect(s.ownedGear[ITEM]).toBe('common');
    expect(s.dayClaims['day1:helm_slomiany']).toBe(true);
  });

  test('BUG FIX: item JUŻ posiadany w TEJ SAMEJ rzadkości — zakup odrzucony, monety NIE znikają', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: 'common' } });
    const before = usePetStore.getState().coins;
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100);
    expect(ok).toBe(false);
    const s = usePetStore.getState();
    expect(s.coins).toBe(before); // <- to jest sedno buga: monety NIE mogą zniknąć
    expect(s.dayClaims['day1:helm_slomiany']).toBeUndefined(); // dzienny slot NIE zużyty
  });

  test('BUG FIX: item posiadany w LEPSZEJ rzadkości niż oferowana — zakup gorszej wersji odrzucony', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: 'epic' } });
    const before = usePetStore.getState().coins;
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100);
    expect(ok).toBe(false);
    const s = usePetStore.getState();
    expect(s.coins).toBe(before);
    expect(s.ownedGear[ITEM]).toBe('epic'); // nie zdegradowane
  });

  test('upgrade: item posiadany w GORSZEJ rzadkości — zakup lepszej wersji się udaje', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: 'common' } });
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'rare', 200);
    expect(ok).toBe(true);
    const s = usePetStore.getState();
    expect(s.coins).toBe(800);
    expect(s.ownedGear[ITEM]).toBe('rare');
  });

  test('za mało monet — zakup odrzucony, nic się nie zmienia', () => {
    resetStore(50);
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100);
    expect(ok).toBe(false);
    const s = usePetStore.getState();
    expect(s.coins).toBe(50);
    expect(s.ownedGear[ITEM]).toBeUndefined();
  });

  test('slot dnia już zużyty (dayClaims) — zakup odrzucony nawet z wystarczającymi monetami', () => {
    usePetStore.setState({ dayClaims: { 'day1:helm_slomiany': true } });
    const before = usePetStore.getState().coins;
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100);
    expect(ok).toBe(false);
    expect(usePetStore.getState().coins).toBe(before);
  });
});
