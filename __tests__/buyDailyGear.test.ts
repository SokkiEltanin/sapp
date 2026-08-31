import { usePetStore } from '@/store/petStore';

// 2026-08-26: user zgłosił realną utratę monet — "kupiłem item który już miałem przez co
// zniknęły mi pieniądze i nic nie dostałem". buyDailyGear() ZAWSZE pobierało `cost` i zużywało
// dzienny slot zakupu, nawet gdy posiadana rzadkość była już równa/lepsza od oferowanej (tylko
// aktualizacja `ownedGear` była wtedy pomijana). Fix: cały zakup jest odrzucany WCZEŚNIEJ
// (return false, przed jakąkolwiek zmianą stanu) gdy user już ma ten item w tej rzadkości lub
// lepszej.
//
// 2026-08-31: `ownedGear` przechowuje teraz `{ rarity, value }` zamiast samej rzadkości (roll w
// przedziale, patrz gear.ts GEAR_ROLL_SPREAD) i `buyDailyGear` przyjmuje `value` jako 5. argument
// — "posiadam już (lub lepiej)" porównuje TERAZ przez `isGearUpgrade` (rarity najpierw, przy
// remisie wygrywa wyższy `value`), nie samą rzadkość.

const ITEM = 'helm_slomiany'; // realny item z katalogu (helm, unlockLevel 1)

function resetStore(coins: number) {
  usePetStore.setState({ coins, ownedGear: {}, dayClaims: {} });
}

describe('petStore.buyDailyGear', () => {
  beforeEach(() => resetStore(1000));

  test('nowy item (nieposiadany) — udany zakup: pobiera monety, ustawia ownedGear i dayClaims', () => {
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100, 5);
    expect(ok).toBe(true);
    const s = usePetStore.getState();
    expect(s.coins).toBe(900);
    expect(s.ownedGear[ITEM]).toEqual({ rarity: 'common', value: 5 });
    expect(s.dayClaims['day1:helm_slomiany']).toBe(true);
  });

  test('BUG FIX: item JUŻ posiadany w TEJ SAMEJ rzadkości z RÓWNYM LUB LEPSZYM rollem — zakup odrzucony, monety NIE znikają', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: { rarity: 'common', value: 10 } } });
    const before = usePetStore.getState().coins;
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100, 6);
    expect(ok).toBe(false);
    const s = usePetStore.getState();
    expect(s.coins).toBe(before); // <- to jest sedno buga: monety NIE mogą zniknąć
    expect(s.dayClaims['day1:helm_slomiany']).toBeUndefined(); // dzienny slot NIE zużyty
  });

  test('BUG FIX: item posiadany w LEPSZEJ rzadkości niż oferowana — zakup gorszej wersji odrzucony', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: { rarity: 'epic', value: 40 } } });
    const before = usePetStore.getState().coins;
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100, 6);
    expect(ok).toBe(false);
    const s = usePetStore.getState();
    expect(s.coins).toBe(before);
    expect(s.ownedGear[ITEM]).toEqual({ rarity: 'epic', value: 40 }); // nie zdegradowane
  });

  test('upgrade: item posiadany w GORSZEJ rzadkości — zakup lepszej wersji się udaje', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: { rarity: 'common', value: 6 } } });
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'rare', 200, 20);
    expect(ok).toBe(true);
    const s = usePetStore.getState();
    expect(s.coins).toBe(800);
    expect(s.ownedGear[ITEM]).toEqual({ rarity: 'rare', value: 20 });
  });

  // 2026-08-31 — user: "lepszy roll w tej samej rzadkości to realny upgrade" (odpowiedź na
  // pytanie doprecyzowujące) — TA SAMA rzadkość, ale WYŻSZY `value` niż posiadany, dalej liczy
  // się jako ulepszenie i zakup się udaje.
  test('upgrade: LEPSZY roll w TEJ SAMEJ rzadkości — zakup się udaje (ARPG-style min-maxing)', () => {
    usePetStore.setState({ ownedGear: { [ITEM]: { rarity: 'common', value: 5 } } });
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100, 9);
    expect(ok).toBe(true);
    const s = usePetStore.getState();
    expect(s.coins).toBe(900);
    expect(s.ownedGear[ITEM]).toEqual({ rarity: 'common', value: 9 });
  });

  test('za mało monet — zakup odrzucony, nic się nie zmienia', () => {
    resetStore(50);
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100, 5);
    expect(ok).toBe(false);
    const s = usePetStore.getState();
    expect(s.coins).toBe(50);
    expect(s.ownedGear[ITEM]).toBeUndefined();
  });

  test('slot dnia już zużyty (dayClaims) — zakup odrzucony nawet z wystarczającymi monetami', () => {
    usePetStore.setState({ dayClaims: { 'day1:helm_slomiany': true } });
    const before = usePetStore.getState().coins;
    const ok = usePetStore.getState().buyDailyGear('day1:helm_slomiany', ITEM, 'common', 100, 5);
    expect(ok).toBe(false);
    expect(usePetStore.getState().coins).toBe(before);
  });
});
