import { usePetStore } from '@/store/petStore';
import { gearInstanceId, GEAR_SLOT_CAP } from '@/utils/gear';

// 2026-09-18: model instancji (user: "musimy operować inaczej z itemami bo w eq sie nie
// mieszczą... moze każdy item bedzie miał id swoje np id itemi to 1222 a po dwukropku numer
// od resetu... 1222:001, 1233:035"). Zastępuje dawny "jeden slot w ownedGear = najlepsza
// dotąd zdobyta kopia" — grantGear() teraz ZAWSZE przyznaje NOWĄ, trwałą instancję pod
// złożonym kluczem `itemId:seq`, nic już nie jest po cichu odrzucane/kompensowane monetami
// (dawny bug: "jak w skrzynce daily wydropiłem to mi zniknął po prostu nic nie dostałem" —
// jedna ze ścieżek dropu, `openCrate()`, miała WŁASNĄ kopię tej samej logiki i wcale nie
// kompensowała, patrz ARCHITECTURE.md §124).

const ITEM = 'helm_slomiany'; // realny item z katalogu (helm, unlockLevel 1)

function resetStore(coins: number) {
  usePetStore.setState({ coins, ownedGear: {}, equippedGear: {}, pendingGearOverflow: [] });
}

describe('petStore.grantGear', () => {
  beforeEach(() => resetStore(0));

  test('pierwszy drop — zapisany pod itemId:001, id zwrócone', () => {
    const id = usePetStore.getState().grantGear(ITEM, 'common', 5);
    expect(id).toBe(gearInstanceId(ITEM, 1));
    const s = usePetStore.getState();
    expect(s.ownedGear[id]).toEqual({ itemId: ITEM, seq: 1, rarity: 'common', value: 5 });
    expect(s.coins).toBe(0); // nigdy kompensaty monetami
  });

  test('drugi drop TEGO SAMEGO itemu — NOWA instancja (:002), pierwsza NIETKNIĘTA', () => {
    const id1 = usePetStore.getState().grantGear(ITEM, 'common', 10);
    const id2 = usePetStore.getState().grantGear(ITEM, 'common', 6); // "gorszy" roll — mimo to zachowany
    expect(id1).toBe(gearInstanceId(ITEM, 1));
    expect(id2).toBe(gearInstanceId(ITEM, 2));
    const s = usePetStore.getState();
    expect(Object.keys(s.ownedGear)).toHaveLength(2);
    expect(s.ownedGear[id1]).toEqual({ itemId: ITEM, seq: 1, rarity: 'common', value: 10 });
    expect(s.ownedGear[id2]).toEqual({ itemId: ITEM, seq: 2, rarity: 'common', value: 6 });
  });

  test('drop w GORSZEJ rzadkości niż posiadana — dalej NOWA instancja, stara nietknięta', () => {
    const id1 = usePetStore.getState().grantGear(ITEM, 'epic', 40);
    const id2 = usePetStore.getState().grantGear(ITEM, 'common', 6);
    const s = usePetStore.getState();
    expect(s.ownedGear[id1]).toEqual({ itemId: ITEM, seq: 1, rarity: 'epic', value: 40 });
    expect(s.ownedGear[id2]).toEqual({ itemId: ITEM, seq: 2, rarity: 'common', value: 6 });
  });

  test('seq liczy się po MAX dotychczasowym, nie po liczbie wpisów — sprzedanie środkowej instancji nie powtarza jej numeru', () => {
    const id1 = usePetStore.getState().grantGear(ITEM, 'common', 5);
    usePetStore.getState().grantGear(ITEM, 'common', 6); // :002
    usePetStore.getState().sellGear(id1); // usuwa :001, zostaje tylko :002
    const id3 = usePetStore.getState().grantGear(ITEM, 'common', 7);
    expect(id3).toBe(gearInstanceId(ITEM, 3)); // nie :001 z powrotem
  });
});

// Limit slotu ekwipunku (2026-10-06, user: "Limit ekwipunku: pytaj który sprzedać gdy
// pełne") — patrz GEAR_SLOT_CAP/isSlotFull w gear.ts. Slot PEŁNY → grantGear NIE przyznaje
// od razu, item czeka w `pendingGearOverflow` aż user sprzeda coś z tego slotu
// (resolveGearOverflow) albo go odrzuci (discardGearOverflow).
describe('petStore.grantGear — limit slotu (pendingGearOverflow)', () => {
  beforeEach(() => resetStore(0));

  function fillSlot() {
    for (let i = 0; i < GEAR_SLOT_CAP; i++) usePetStore.getState().grantGear(ITEM, 'common', 1);
  }

  test('slot pełny → grantGear zwraca "" i NIE dodaje do ownedGear, item ląduje w kolejce', () => {
    fillSlot();
    const before = Object.keys(usePetStore.getState().ownedGear).length;
    const id = usePetStore.getState().grantGear(ITEM, 'mythic', 99);
    expect(id).toBe('');
    const s = usePetStore.getState();
    expect(Object.keys(s.ownedGear)).toHaveLength(before); // nic nowego nie przyznane
    expect(s.pendingGearOverflow).toEqual([{ itemId: ITEM, rarity: 'mythic', value: 99 }]);
  });

  test('resolveGearOverflow sprzedaje wskazaną instancję i OD RAZU przyznaje czekający item', () => {
    fillSlot();
    usePetStore.getState().grantGear(ITEM, 'mythic', 99); // → overflow
    const sellId = gearInstanceId(ITEM, 1); // najstarsza, common value=1
    const coinsBefore = usePetStore.getState().coins;
    const ok = usePetStore.getState().resolveGearOverflow(sellId);
    expect(ok).toBe(true);
    const s = usePetStore.getState();
    expect(s.ownedGear[sellId]).toBeUndefined(); // sprzedana, usunięta
    expect(s.coins).toBeGreaterThan(coinsBefore); // dostał monety ze sprzedaży
    expect(s.pendingGearOverflow).toHaveLength(0); // kolejka opróżniona
    expect(Object.values(s.ownedGear).some(g => g?.rarity === 'mythic' && g.value === 99)).toBe(true); // nowy item przyznany
    expect(Object.keys(s.ownedGear)).toHaveLength(GEAR_SLOT_CAP); // slot dalej na limicie, nie nad nim
  });

  test('resolveGearOverflow odmawia, gdy sprzedawana instancja jest z INNEGO slotu', () => {
    fillSlot();
    usePetStore.getState().grantGear(ITEM, 'mythic', 99); // helm overflow
    usePetStore.getState().grantGear('zbroja_szmaciana', 'common', 1); // inny slot, mieści się
    const wrongSlotId = gearInstanceId('zbroja_szmaciana', 1);
    const ok = usePetStore.getState().resolveGearOverflow(wrongSlotId);
    expect(ok).toBe(false);
    expect(usePetStore.getState().pendingGearOverflow).toHaveLength(1); // kolejka nietknięta
  });

  test('resolveGearOverflow z nieistniejącą instancją → false, kolejka nietknięta', () => {
    fillSlot();
    usePetStore.getState().grantGear(ITEM, 'mythic', 99);
    expect(usePetStore.getState().resolveGearOverflow('nonsense:001')).toBe(false);
    expect(usePetStore.getState().pendingGearOverflow).toHaveLength(1);
  });

  test('discardGearOverflow odrzuca czoło kolejki bez sprzedawania niczego', () => {
    fillSlot();
    usePetStore.getState().grantGear(ITEM, 'mythic', 99);
    const before = Object.keys(usePetStore.getState().ownedGear).length;
    usePetStore.getState().discardGearOverflow();
    const s = usePetStore.getState();
    expect(s.pendingGearOverflow).toHaveLength(0);
    expect(Object.keys(s.ownedGear)).toHaveLength(before); // nic sprzedane, nic przyznane
  });

  test('równoległy drop w slocie z miejscem — bez wpływu na pełny slot innego itemu', () => {
    fillSlot(); // helm pełny
    const id = usePetStore.getState().grantGear('zbroja_szmaciana', 'rare', 5); // inny slot
    expect(id).not.toBe('');
    expect(usePetStore.getState().pendingGearOverflow).toHaveLength(0);
  });
});
