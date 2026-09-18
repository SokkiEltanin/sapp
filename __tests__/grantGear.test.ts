import { usePetStore } from '@/store/petStore';
import { gearInstanceId } from '@/utils/gear';

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
  usePetStore.setState({ coins, ownedGear: {} });
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
