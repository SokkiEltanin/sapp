import { useCanvasComponentsStore, CanvasItem } from '@/store/canvasComponentsStore';
import { DEFAULT_NOTES_TILE_STYLE } from '@/store/notesTileStyleDefaults';
import { DEFAULT_RECT_SHAPE_STYLE, DEFAULT_LINE_SHAPE_STYLE } from '@/store/shapeStyleDefaults';

// Grupowanie (Faza 20, 2026-10-17, §349) — user, wcześniej w §333: "grupowanie komponentów".
// Testowane bezpośrednio na store (ten sam wzorzec co battleLayoutDraftStore.test.ts) —
// AsyncStorage zmockowane globalnie w jest.setup.js.
beforeEach(() => {
  useCanvasComponentsStore.setState({ items: [] });
});

describe('canvasComponentsStore — addItem (trzeci typ, notesTile, §350)', () => {
  test('nowa instancja notesTile dostaje poprawny domyślny rozmiar/styl/groupId', () => {
    const { addItem } = useCanvasComponentsStore.getState();
    const id = addItem('food', 'notesTile');
    const item = useCanvasComponentsStore.getState().items.find(i => i.id === id)!;
    expect(item.componentType).toBe('notesTile');
    expect(item.style).toEqual(DEFAULT_NOTES_TILE_STYLE);
    expect(item.width).toBeGreaterThan(0);
    expect(item.height).toBeGreaterThan(0);
    expect(item.bindingKey).toBeNull();
    expect(item.groupId).toBeNull();
  });
});

describe('canvasComponentsStore — addItem (kształty-primitywy, §357)', () => {
  test('rectShape dostaje domyślny styl wypełnienia i bindingKey=null (kształty nie mają podpięcia)', () => {
    const { addItem } = useCanvasComponentsStore.getState();
    const id = addItem('food', 'rectShape');
    const item = useCanvasComponentsStore.getState().items.find(i => i.id === id)!;
    expect(item.style).toEqual(DEFAULT_RECT_SHAPE_STYLE);
    expect(item.bindingKey).toBeNull();
  });

  test('lineShape dostaje spłaszczony domyślny rozmiar (blisko-pozioma linia)', () => {
    const { addItem } = useCanvasComponentsStore.getState();
    const id = addItem('food', 'lineShape');
    const item = useCanvasComponentsStore.getState().items.find(i => i.id === id)!;
    expect(item.style).toEqual(DEFAULT_LINE_SHAPE_STYLE);
    expect(item.height).toBeLessThan(item.width);
  });
});

function addThree(screenKey = 'food') {
  const { addItem } = useCanvasComponentsStore.getState();
  const a = addItem(screenKey, 'streakTile');
  const b = addItem(screenKey, 'countdownTile');
  const c = addItem(screenKey, 'streakTile');
  return [a, b, c];
}

describe('canvasComponentsStore — groupItems', () => {
  test('wymaga co najmniej 2 id — z jednym nic nie robi i zwraca null', () => {
    const [a] = addThree();
    const result = useCanvasComponentsStore.getState().groupItems('food', [a]);
    expect(result).toBeNull();
    expect(useCanvasComponentsStore.getState().items.find(i => i.id === a)!.groupId).toBeNull();
  });

  test('ustawia TEN SAM groupId na wszystkich zaznaczonych itemach, resztę zostawia bez zmian', () => {
    const [a, b, c] = addThree();
    const groupId = useCanvasComponentsStore.getState().groupItems('food', [a, b]);
    expect(groupId).not.toBeNull();
    const items = useCanvasComponentsStore.getState().items;
    expect(items.find(i => i.id === a)!.groupId).toBe(groupId);
    expect(items.find(i => i.id === b)!.groupId).toBe(groupId);
    expect(items.find(i => i.id === c)!.groupId).toBeNull();
  });

  test('ignoruje id spoza podanego screenKey (obrona przed pomyłką wołającego)', () => {
    const [a] = addThree('food');
    const [x] = addThree('exercises');
    const groupId = useCanvasComponentsStore.getState().groupItems('food', [a, x]);
    // tylko 1 id faktycznie należy do 'food' → poniżej progu 2, grupa się nie tworzy
    expect(groupId).toBeNull();
  });
});

describe('canvasComponentsStore — ungroupItems', () => {
  test('czyści groupId na wszystkich członkach danej grupy, nie rusza innych grup', () => {
    const [a, b, c] = addThree();
    const groupId1 = useCanvasComponentsStore.getState().groupItems('food', [a, b])!;
    const [d, e] = addThree('exercises');
    const groupId2 = useCanvasComponentsStore.getState().groupItems('exercises', [d, e])!;

    useCanvasComponentsStore.getState().ungroupItems(groupId1);
    const items = useCanvasComponentsStore.getState().items;
    expect(items.find(i => i.id === a)!.groupId).toBeNull();
    expect(items.find(i => i.id === b)!.groupId).toBeNull();
    expect(items.find(i => i.id === d)!.groupId).toBe(groupId2); // inna grupa nietknięta
  });
});

describe('canvasComponentsStore — moveGroupBy', () => {
  test('przesuwa WSZYSTKICH członków grupy o ten sam delta', () => {
    const [a, b, c] = addThree();
    const groupId = useCanvasComponentsStore.getState().groupItems('food', [a, b])!;
    const before = useCanvasComponentsStore.getState().items;
    const ax = before.find(i => i.id === a)!;
    const bx = before.find(i => i.id === b)!;

    useCanvasComponentsStore.getState().moveGroupBy('food', groupId, 40, -10, 500);

    const after = useCanvasComponentsStore.getState().items;
    expect(after.find(i => i.id === a)!.x).toBe(ax.x + 40);
    expect(after.find(i => i.id === a)!.y).toBe(ax.y - 10);
    expect(after.find(i => i.id === b)!.x).toBe(bx.x + 40);
    expect(after.find(i => i.id === b)!.y).toBe(bx.y - 10);
    expect(after.find(i => i.id === c)!.x).toBe(before.find(i => i.id === c)!.x); // nie w grupie, bez zmian
  });

  test('klamruje KAŻDEGO członka osobno do granic płótna, nie całą grupę jako jeden blok', () => {
    const [a, b] = addThree();
    const groupId = useCanvasComponentsStore.getState().groupItems('food', [a, b])!;
    // Rozsuń ich daleko od siebie w X przed przesunięciem, żeby klamrowanie było różne dla każdego.
    useCanvasComponentsStore.setState((s) => ({
      items: s.items.map((i): CanvasItem => i.id === a ? { ...i, x: 0, width: 100 } : i.id === b ? { ...i, x: 300, width: 100 } : i),
    }));
    useCanvasComponentsStore.getState().moveGroupBy('food', groupId, -50, 0, 400);
    const items = useCanvasComponentsStore.getState().items;
    expect(items.find(i => i.id === a)!.x).toBe(0); // klamrowane do 0, nie poszło na ujemne
    expect(items.find(i => i.id === b)!.x).toBe(250); // 300 - 50, zmieściło się swobodnie
  });

  test('nie rusza itemów z innego screenKey, nawet z tym samym groupId (teoretycznie niemożliwe, ale obrona)', () => {
    const [a, b] = addThree('food');
    const groupId = useCanvasComponentsStore.getState().groupItems('food', [a, b])!;
    useCanvasComponentsStore.getState().moveGroupBy('exercises', groupId, 100, 100, 500);
    const items = useCanvasComponentsStore.getState().items;
    const aAfter = items.find(i => i.id === a)!;
    expect(aAfter.x).toBe(12); // addItem domyślne x — nieruszone, bo screenKey się nie zgadza
  });
});
