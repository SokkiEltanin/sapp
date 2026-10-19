import { useCanvasComponentsStore, CanvasItem, clampItemX } from '@/store/canvasComponentsStore';
import { DEFAULT_NOTES_TILE_STYLE } from '@/store/notesTileStyleDefaults';
import { DEFAULT_RECT_SHAPE_STYLE, DEFAULT_LINE_SHAPE_STYLE } from '@/store/shapeStyleDefaults';
import { DEFAULT_ICON_TILE_STYLE } from '@/store/iconTileStyleDefaults';
import { DEFAULT_STAT_TILE_STYLE } from '@/store/statTileStyleDefaults';
import { DEFAULT_PROGRESS_BAR_STYLE } from '@/store/progressBarStyleDefaults';

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

describe('canvasComponentsStore — addItem (typ "Ikona", §371)', () => {
  test('iconTile dostaje domyślny styl, kwadratowy rozmiar i bindingKey=null (bez podpięcia, jak kształty)', () => {
    const { addItem } = useCanvasComponentsStore.getState();
    const id = addItem('food', 'iconTile');
    const item = useCanvasComponentsStore.getState().items.find(i => i.id === id)!;
    expect(item.componentType).toBe('iconTile');
    expect(item.style).toEqual(DEFAULT_ICON_TILE_STYLE);
    expect(item.width).toBe(item.height); // kwadrat
    expect(item.bindingKey).toBeNull();
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

describe('canvasComponentsStore — removeItem a grupy (fix §360)', () => {
  test('usunięcie jednego z DWÓCH członków grupy rozgrupowuje pozostałego (grupa "z 1 osobą" nie ma sensu)', () => {
    const [a, b, c] = addThree();
    const groupId = useCanvasComponentsStore.getState().groupItems('food', [a, b])!;
    useCanvasComponentsStore.getState().removeItem(a);
    const items = useCanvasComponentsStore.getState().items;
    expect(items.find(i => i.id === b)!.groupId).toBeNull();
    expect(items.find(i => i.id === c)).toBeDefined(); // niepowiązany item nietknięty
  });

  test('usunięcie członka grupy z 3+ osobami NIE rozgrupowuje pozostałych (wciąż ≥2)', () => {
    const [a, b, c, d] = [...addThree(), useCanvasComponentsStore.getState().addItem('food', 'streakTile')];
    const groupId = useCanvasComponentsStore.getState().groupItems('food', [a, b, c])!;
    useCanvasComponentsStore.getState().removeItem(a);
    const items = useCanvasComponentsStore.getState().items;
    expect(items.find(i => i.id === b)!.groupId).toBe(groupId);
    expect(items.find(i => i.id === c)!.groupId).toBe(groupId);
  });

  test('usunięcie itemu BEZ grupy nie rusza żadnych groupId', () => {
    const [a, b, c] = addThree();
    const groupId = useCanvasComponentsStore.getState().groupItems('food', [a, b])!;
    useCanvasComponentsStore.getState().removeItem(c); // c nie jest w grupie
    const items = useCanvasComponentsStore.getState().items;
    expect(items.find(i => i.id === a)!.groupId).toBe(groupId);
    expect(items.find(i => i.id === b)!.groupId).toBe(groupId);
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

describe('clampItemX (§360)', () => {
  test('nie zmienia x, które już mieści się w granicach płótna', () => {
    expect(clampItemX(50, 100, 500)).toBe(50);
  });
  test('klamruje do 0, gdy x jest ujemne', () => {
    expect(clampItemX(-30, 100, 500)).toBe(0);
  });
  test('klamruje do canvasWidth - width, gdy x+width wychodzi za prawą krawędź', () => {
    expect(clampItemX(450, 100, 500)).toBe(400);
  });
  test('gdy width > canvasWidth, klamruje do 0 (brak ujemnego miejsca)', () => {
    expect(clampItemX(50, 600, 500)).toBe(0);
  });
});

describe('canvasComponentsStore — warstwy (zIndex, §359)', () => {
  test('addItem przypisuje kolejne zIndex (pierwszy=0, każdy następny wyżej) na TYM SAMYM screenKey', () => {
    const [a, b, c] = addThree();
    const items = useCanvasComponentsStore.getState().items;
    const za = items.find(i => i.id === a)!.zIndex;
    const zb = items.find(i => i.id === b)!.zIndex;
    const zc = items.find(i => i.id === c)!.zIndex;
    expect(za).toBe(0);
    expect(zb).toBeGreaterThan(za);
    expect(zc).toBeGreaterThan(zb);
  });

  test('bringToFront przenosi item na wierzch stosu (wyżej niż wszyscy inni NA TYM screenKey)', () => {
    const [a, b, c] = addThree();
    useCanvasComponentsStore.getState().bringToFront(a);
    const items = useCanvasComponentsStore.getState().items;
    const za = items.find(i => i.id === a)!.zIndex;
    const zb = items.find(i => i.id === b)!.zIndex;
    const zc = items.find(i => i.id === c)!.zIndex;
    expect(za).toBeGreaterThan(zb);
    expect(za).toBeGreaterThan(zc);
  });

  test('sendToBack przenosi item na spód stosu (niżej niż wszyscy inni NA TYM screenKey)', () => {
    const [a, b, c] = addThree();
    useCanvasComponentsStore.getState().sendToBack(c);
    const items = useCanvasComponentsStore.getState().items;
    const za = items.find(i => i.id === a)!.zIndex;
    const zb = items.find(i => i.id === b)!.zIndex;
    const zc = items.find(i => i.id === c)!.zIndex;
    expect(zc).toBeLessThan(za);
    expect(zc).toBeLessThan(zb);
  });

  test('bringToFront/sendToBack nie widzą itemów z innego screenKey', () => {
    const [a] = addThree('food');
    const [x, y] = addThree('exercises');
    useCanvasComponentsStore.getState().bringToFront(x);
    // x i y mają własny, niezależny zIndex 0/1+ na 'exercises' — bringToFront(x) nie powinno
    // dotknąć 'food' w ŻADEN sposób.
    const aAfter = useCanvasComponentsStore.getState().items.find(i => i.id === a)!;
    expect(aAfter.zIndex).toBe(0);
  });
});

describe('canvasComponentsStore — moveLayer (lista warstw, §365)', () => {
  test('"up" zamienia item z NAJBLIŻSZYM sąsiadem o WYŻSZYM zIndex', () => {
    const [a, b, c] = addThree(); // zIndex: a=0, b=1, c=2 (kolejność dodania)
    useCanvasComponentsStore.getState().moveLayer(b, 'up');
    const items = useCanvasComponentsStore.getState().items;
    const za = items.find(i => i.id === a)!.zIndex;
    const zb = items.find(i => i.id === b)!.zIndex;
    const zc = items.find(i => i.id === c)!.zIndex;
    expect(zb).toBeGreaterThan(zc); // b przeskoczył c, jest teraz NA WIERZCHU
    expect(za).toBeLessThan(zc); // a nietknięte, dalej najniżej
  });

  test('"down" zamienia item z NAJBLIŻSZYM sąsiadem o NIŻSZYM zIndex', () => {
    const [a, b, c] = addThree();
    useCanvasComponentsStore.getState().moveLayer(b, 'down');
    const items = useCanvasComponentsStore.getState().items;
    const za = items.find(i => i.id === a)!.zIndex;
    const zb = items.find(i => i.id === b)!.zIndex;
    const zc = items.find(i => i.id === c)!.zIndex;
    expect(zb).toBeLessThan(za); // b przeskoczył a, jest teraz NA SPODZIE
    expect(zc).toBeGreaterThan(za); // c nietknięte, dalej na wierzchu
  });

  test('"up" na już-najwyższym itemie jest no-opem (brak sąsiada powyżej)', () => {
    const [, , c] = addThree();
    const before = useCanvasComponentsStore.getState().items;
    useCanvasComponentsStore.getState().moveLayer(c, 'up');
    const after = useCanvasComponentsStore.getState().items;
    expect(after).toEqual(before);
  });

  test('"down" na już-najniższym itemie jest no-opem (brak sąsiada poniżej)', () => {
    const [a] = addThree();
    const before = useCanvasComponentsStore.getState().items;
    useCanvasComponentsStore.getState().moveLayer(a, 'down');
    const after = useCanvasComponentsStore.getState().items;
    expect(after).toEqual(before);
  });

  // Fix wykryty przy pisaniu tego testu (§365) — stare/migrowane itemy mogą dzielić TEN SAM
  // fallback zIndex (`?? 0`), więc zamiana dwóch RÓWNYCH wartości byłaby no-opem bez normalizacji.
  test('zamienia poprawnie NAWET gdy sąsiedzi dzielą ten sam zIndex (legacy/migrowane itemy)', () => {
    const [a, b, c] = addThree();
    // Symuluj stan PRZED §359 — wszystkie trzy mają zIndex=0 (fallback), kolejność w tablicy
    // (a,b,c) jest JEDYNYM sygnałem porządku, dokładnie jak przed dodaniem pola.
    useCanvasComponentsStore.setState((s) => ({ items: s.items.map((i): CanvasItem => ({ ...i, zIndex: 0 })) }));
    useCanvasComponentsStore.getState().moveLayer(b, 'up');
    const items = useCanvasComponentsStore.getState().items;
    const za = items.find(i => i.id === a)!.zIndex;
    const zb = items.find(i => i.id === b)!.zIndex;
    const zc = items.find(i => i.id === c)!.zIndex;
    expect(zb).toBeGreaterThan(zc); // zamiana FAKTYCZNIE zaszła, nie zignorowana
    expect(za).toBeLessThan(zc);
  });

  test('nie widzi itemów z innego screenKey', () => {
    const [a, b] = addThree('food');
    const [x] = addThree('exercises');
    const beforeX = useCanvasComponentsStore.getState().items.find(i => i.id === x)!.zIndex;
    useCanvasComponentsStore.getState().moveLayer(b, 'up');
    const afterX = useCanvasComponentsStore.getState().items.find(i => i.id === x)!.zIndex;
    expect(afterX).toBe(beforeX); // 'exercises' nietknięte przez reorder na 'food'
  });
});

describe('canvasComponentsStore — resizeGroupBy (rozszerzone grupowanie, §359)', () => {
  test('skaluje x/y/width/height WSZYSTKICH członków względem WSPÓLNEGO lewego-górnego rogu grupy', () => {
    const [a, b] = addThree();
    // Ustaw znaną geometrię: a=(0,0,100x100), b=(200,0,100x100) — wspólny bounding-box (0,0)-(300,100).
    useCanvasComponentsStore.setState((s) => ({
      items: s.items.map((i): CanvasItem => i.id === a ? { ...i, x: 0, y: 0, width: 100, height: 100 } : i.id === b ? { ...i, x: 200, y: 0, width: 100, height: 100 } : i),
    }));
    const groupId = useCanvasComponentsStore.getState().groupItems('food', [a, b])!;
    useCanvasComponentsStore.getState().resizeGroupBy('food', groupId, 2, 1, 1000);
    const items = useCanvasComponentsStore.getState().items;
    const aAfter = items.find(i => i.id === a)!;
    const bAfter = items.find(i => i.id === b)!;
    // a jest na lewym-górnym rogu grupy (relX=0) — tylko rozmiar się skaluje, pozycja zostaje.
    expect(aAfter.x).toBe(0);
    expect(aAfter.width).toBe(200);
    expect(aAfter.height).toBe(100);
    // b jest 200px od lewej (relX=200) — przy scaleX=2 jego x przesuwa się na 400 (0 + 200*2).
    expect(bAfter.x).toBe(400);
    expect(bAfter.width).toBe(200);
  });

  test('klamruje każdego członka do MIN_ITEM_WIDTH/HEIGHT, nie pozwala skalować pod minimum', () => {
    const [a, b] = addThree();
    useCanvasComponentsStore.setState((s) => ({
      items: s.items.map((i): CanvasItem => i.id === a ? { ...i, x: 0, y: 0, width: 100, height: 100 } : i.id === b ? { ...i, x: 100, y: 0, width: 100, height: 100 } : i),
    }));
    const groupId = useCanvasComponentsStore.getState().groupItems('food', [a, b])!;
    useCanvasComponentsStore.getState().resizeGroupBy('food', groupId, 0.1, 0.1, 1000);
    const items = useCanvasComponentsStore.getState().items;
    expect(items.find(i => i.id === a)!.width).toBeGreaterThanOrEqual(90);
    expect(items.find(i => i.id === a)!.height).toBeGreaterThanOrEqual(64);
  });

  test('nie rusza itemów z innej grupy/screenKey', () => {
    const [a, b, c] = addThree('food');
    const groupId = useCanvasComponentsStore.getState().groupItems('food', [a, b])!;
    const cBefore = useCanvasComponentsStore.getState().items.find(i => i.id === c)!;
    useCanvasComponentsStore.getState().resizeGroupBy('food', groupId, 3, 3, 1000);
    const cAfter = useCanvasComponentsStore.getState().items.find(i => i.id === c)!;
    expect(cAfter.width).toBe(cBefore.width); // c nie jest w grupie — bez zmian
  });
});

// Tryb pełnoekranowy (§381) — user: "chcę od zera budować design... i móc go wdrożyć jako
// jakiś ekran zamiast np. zdrowia". Flaga per `screenKey`, domyślnie wyłączona wszędzie,
// odwracalna, nie rusza `items`.
describe('canvasComponentsStore — fullScreenScreens (§381)', () => {
  beforeEach(() => {
    useCanvasComponentsStore.setState({ items: [], fullScreenScreens: {} });
  });

  test('domyślnie wyłączony dla każdego ekranu', () => {
    expect(useCanvasComponentsStore.getState().fullScreenScreens['health']).toBeUndefined();
  });

  test('setFullScreen(key, true) włącza TYLKO ten jeden screenKey', () => {
    useCanvasComponentsStore.getState().setFullScreen('health', true);
    const s = useCanvasComponentsStore.getState();
    expect(s.fullScreenScreens['health']).toBe(true);
    expect(s.fullScreenScreens['food']).toBeUndefined();
  });

  test('setFullScreen(key, false) wyłącza z powrotem, nie rusza items', () => {
    const { addItem } = useCanvasComponentsStore.getState();
    addItem('health', 'rectShape');
    useCanvasComponentsStore.getState().setFullScreen('health', true);
    useCanvasComponentsStore.getState().setFullScreen('health', false);
    const s = useCanvasComponentsStore.getState();
    expect(s.fullScreenScreens['health']).toBe(false);
    expect(s.items).toHaveLength(1); // nietknięte — wyłączenie nie usuwa zbudowanych komponentów
  });
});

// Wejście do edytora z Ustawień (§390) — jednorazowy, NIEPERSYSTOWANY sygnał (patrz
// `partialize` w store'cie — nie zawiera `pendingAutoEdit`).
describe('canvasComponentsStore — pendingAutoEdit (§390)', () => {
  beforeEach(() => {
    useCanvasComponentsStore.setState({ items: [], fullScreenScreens: {}, pendingAutoEdit: null });
  });

  test('domyślnie null', () => {
    expect(useCanvasComponentsStore.getState().pendingAutoEdit).toBeNull();
  });

  test('setPendingAutoEdit(key) ustawia, setPendingAutoEdit(null) czyści', () => {
    useCanvasComponentsStore.getState().setPendingAutoEdit('health');
    expect(useCanvasComponentsStore.getState().pendingAutoEdit).toBe('health');
    useCanvasComponentsStore.getState().setPendingAutoEdit(null);
    expect(useCanvasComponentsStore.getState().pendingAutoEdit).toBeNull();
  });
});

// Tryb "Dane"/popup (§391) — `onTapAction` domyślnie nieustawione (dotychczasowe zachowanie
// per typ), ustawialne przez `updateItem` jak każde inne pole.
describe('canvasComponentsStore — onTapAction (§391)', () => {
  beforeEach(() => {
    useCanvasComponentsStore.setState({ items: [] });
  });

  test('nowy item nie ma onTapAction (dotychczasowe zachowanie per typ)', () => {
    const id = useCanvasComponentsStore.getState().addItem('health', 'rectShape');
    const item = useCanvasComponentsStore.getState().items.find(i => i.id === id)!;
    expect(item.onTapAction).toBeUndefined();
  });

  test("updateItem(id, { onTapAction: 'openPopup' }) ustawia, nie rusza innych pól", () => {
    const id = useCanvasComponentsStore.getState().addItem('health', 'rectShape');
    useCanvasComponentsStore.getState().updateItem(id, { onTapAction: 'openPopup' });
    const item = useCanvasComponentsStore.getState().items.find(i => i.id === id)!;
    expect(item.onTapAction).toBe('openPopup');
    expect(item.componentType).toBe('rectShape');
  });
});

// Typ "Wykres" (§386) — siódmy componentType, bindingKey = klucz metryki z WIDGET_METRICS
// (statWidgets.ts), style = { period, viz } (NIE pełny CustomTile z dashboardu).
describe('canvasComponentsStore — addItem (statTile, §386)', () => {
  test('statTile dostaje domyślny styl (miesiąc/liczba) i bindingKey=null (jeszcze nie podpięty)', () => {
    const { addItem } = useCanvasComponentsStore.getState();
    const id = addItem('dashboard', 'statTile');
    const item = useCanvasComponentsStore.getState().items.find(i => i.id === id)!;
    expect(item.componentType).toBe('statTile');
    expect(item.style).toEqual(DEFAULT_STAT_TILE_STYLE);
    expect(item.bindingKey).toBeNull();
    expect(item.width).toBeGreaterThan(0);
    expect(item.height).toBeGreaterThan(0);
  });
});

// Navbar Pupila (§392) — user, po wyborze opcji "pełna przebudowa jak Figma": nowy typ
// `navTab`, zamknięta lista opcji (4 stałe taby), i osobna, PERSYSTOWANA flaga
// `customNavbarEnabled` (w przeciwieństwie do jednorazowego `pendingAutoEdit`).
describe('canvasComponentsStore — addItem (navTab, §392)', () => {
  test('navTab dostaje pusty styl i bindingKey=null (jeszcze nie podpięty do żadnego tabu)', () => {
    const { addItem } = useCanvasComponentsStore.getState();
    const id = addItem('navbar', 'navTab');
    const item = useCanvasComponentsStore.getState().items.find(i => i.id === id)!;
    expect(item.componentType).toBe('navTab');
    expect(item.style).toEqual({});
    expect(item.bindingKey).toBeNull();
    expect(item.width).toBeGreaterThan(0);
    expect(item.height).toBeGreaterThan(0);
  });
});

// Pasek progresu (§393) — user: "dodaj... paski progresu... jak kiedyś w KWGT Widgets".
// Podpięcie idzie do TEGO SAMEGO rejestru co countdownTile (zero nowej konfiguracji zakresu).
describe('canvasComponentsStore — addItem (progressBar, §393)', () => {
  test('progressBar dostaje domyślny styl i bindingKey=null (jeszcze nie podpięty)', () => {
    const { addItem } = useCanvasComponentsStore.getState();
    const id = addItem('health', 'progressBar');
    const item = useCanvasComponentsStore.getState().items.find(i => i.id === id)!;
    expect(item.componentType).toBe('progressBar');
    expect(item.style).toEqual(DEFAULT_PROGRESS_BAR_STYLE);
    expect(item.bindingKey).toBeNull();
    expect(item.width).toBeGreaterThan(0);
    expect(item.height).toBeGreaterThan(0);
  });
});

// Szablony (§395) — user: "dodaj... szablony". `applyTemplate` stawia WSZYSTKIE itemy
// szablonu naraz, na ich własnych współrzędnych, bez podpięcia danych.
describe('canvasComponentsStore — applyTemplate (§395)', () => {
  test('stawia wszystkie itemy szablonu, bez bindingKey, z rosnącym zIndex', () => {
    const { applyTemplate } = useCanvasComponentsStore.getState();
    applyTemplate('health', 'header-divider');
    const items = useCanvasComponentsStore.getState().items.filter(i => i.screenKey === 'health');
    expect(items).toHaveLength(2);
    expect(items[0].componentType).toBe('textShape');
    expect(items[1].componentType).toBe('lineShape');
    expect(items.every(i => i.bindingKey === null)).toBe(true);
    expect(items[0].zIndex).toBe(0);
    expect(items[1].zIndex).toBe(1);
  });

  test('scala styl szablonu z domyślnym stylem typu (override, nie zamiana)', () => {
    const { applyTemplate } = useCanvasComponentsStore.getState();
    applyTemplate('health', 'header-divider');
    const text = useCanvasComponentsStore.getState().items.find(i => i.screenKey === 'health' && i.componentType === 'textShape')!;
    expect((text.style as any).text).toBe('Nagłówek');
    expect((text.style as any).color).toBeDefined(); // z DEFAULT_TEXT_SHAPE_STYLE, nie nadpisane
  });

  test('nieznane id szablonu nic nie robi', () => {
    const { applyTemplate } = useCanvasComponentsStore.getState();
    applyTemplate('health', 'nie-istnieje');
    expect(useCanvasComponentsStore.getState().items).toHaveLength(0);
  });
});

describe('canvasComponentsStore — customNavbarEnabled (§392)', () => {
  beforeEach(() => {
    useCanvasComponentsStore.setState({ customNavbarEnabled: false });
  });

  test('domyślnie wyłączony', () => {
    expect(useCanvasComponentsStore.getState().customNavbarEnabled).toBe(false);
  });

  test('setCustomNavbarEnabled(true/false) ustawia flagę', () => {
    useCanvasComponentsStore.getState().setCustomNavbarEnabled(true);
    expect(useCanvasComponentsStore.getState().customNavbarEnabled).toBe(true);
    useCanvasComponentsStore.getState().setCustomNavbarEnabled(false);
    expect(useCanvasComponentsStore.getState().customNavbarEnabled).toBe(false);
  });
});
