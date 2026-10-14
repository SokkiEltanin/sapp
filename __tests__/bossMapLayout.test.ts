import { layoutBossMap, applyLayoutOverrides, catmullRomPath } from '@/utils/bossMapLayout';

describe('bossMapLayout — layoutBossMap', () => {
  test('count 0 → brak węzłów', () => {
    expect(layoutBossMap(0).nodes).toEqual([]);
  });

  test('count 1 → jeden węzeł, mieści się w width/height', () => {
    const { nodes, width, height } = layoutBossMap(1);
    expect(nodes).toHaveLength(1);
    expect(nodes[0].x).toBeGreaterThanOrEqual(0);
    expect(nodes[0].x).toBeLessThanOrEqual(width);
    expect(nodes[0].y).toBeGreaterThanOrEqual(0);
    expect(nodes[0].y).toBeLessThanOrEqual(height);
  });

  test('deterministyczne — ten sam count zawsze daje ten sam układ', () => {
    const a = layoutBossMap(22);
    const b = layoutBossMap(22);
    expect(a.nodes).toEqual(b.nodes);
    expect(a.width).toBe(b.width);
    expect(a.height).toBe(b.height);
  });

  // Gwarancja braku samoprzecięć trasy (2026-10-14, przebudowa #2 — user: "boss niektóre sa
  // porozrzucane zle", "od zera") — Y MUSI ściśle rosnąć z indeksem, więc połączenie
  // kolejnych punktów nigdy nie może się cofnąć/zapętlić na siebie, niezależnie od tego co
  // robi X. To jedyna własność konieczna do matematycznego wykluczenia samoprzecięć.
  test('Y ściśle rośnie z indeksem — trasa nigdy nie zawraca w górę (brak samoprzecięć)', () => {
    const { nodes } = layoutBossMap(100);
    for (let i = 1; i < nodes.length; i++) {
      expect(nodes[i].y).toBeGreaterThan(nodes[i - 1].y);
    }
  });

  test('X zawsze w wąskim, stałym paśmie torów (bez swobodnego pan — mapa przewija się tylko pionowo)', () => {
    const { nodes, width } = layoutBossMap(100);
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(width);
    }
  });

  test('kolejne węzły nigdy nie zmieniają toru o więcej niż jeden — brak gwałtownych skoków w poziomie', () => {
    const areaWidth = 340;
    const { nodes } = layoutBossMap(100, areaWidth);
    const laneWidth = areaWidth / 5; // LANES w bossMapLayout.ts
    for (let i = 1; i < nodes.length; i++) {
      const dx = Math.abs(nodes[i].x - nodes[i - 1].x);
      // odległość między środkami sąsiednich torów — krok w poziomie nie może przekroczyć TEJ wartości
      expect(dx).toBeLessThanOrEqual(laneWidth + 0.001);
    }
  });

  test('płótno mieści się dokładnie w podanej szerokości viewportu (bez poziomego przycinania)', () => {
    const { nodes, width } = layoutBossMap(30, 400);
    expect(width).toBe(400);
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(400);
    }
  });

  test('wszystkie węzły mieszczą się w zwróconym width/height', () => {
    const { nodes, width, height } = layoutBossMap(44);
    for (const n of nodes) {
      expect(n.x).toBeGreaterThanOrEqual(0);
      expect(n.x).toBeLessThanOrEqual(width);
      expect(n.y).toBeGreaterThanOrEqual(0);
      expect(n.y).toBeLessThanOrEqual(height);
    }
  });

  test('liczba węzłów zawsze równa count', () => {
    for (const n of [1, 2, 5, 22, 44, 100]) {
      expect(layoutBossMap(n).nodes).toHaveLength(n);
    }
  });
});

describe('bossMapLayout — applyLayoutOverrides (edytor mapy, §322)', () => {
  test('brak nadpisań → węzły bez zmian (procedural zostaje)', () => {
    const base = layoutBossMap(5, 300);
    const ids = ['a', 'b', 'c', 'd', 'e'];
    const out = applyLayoutOverrides(base.nodes, ids, {}, 300);
    expect(out.nodes).toEqual(base.nodes);
  });

  test('nadpisanie konkretnego id zmienia TYLKO ten węzeł', () => {
    const base = layoutBossMap(3, 300);
    const ids = ['a', 'b', 'c'];
    const out = applyLayoutOverrides(base.nodes, ids, { b: { x: 123, y: 456 } }, 300);
    expect(out.nodes[0]).toEqual(base.nodes[0]);
    expect(out.nodes[1]).toEqual({ x: 123, y: 456 });
    expect(out.nodes[2]).toEqual(base.nodes[2]);
  });

  test('nadpisane x przycinane do [0, areaWidth] — pozycja z innego rozmiaru ekranu nie wyjeżdża poza płótno', () => {
    const base = layoutBossMap(2, 300);
    const out = applyLayoutOverrides(base.nodes, ['a', 'b'], { a: { x: 999, y: 10 }, b: { x: -50, y: 10 } }, 300);
    expect(out.nodes[0].x).toBe(300);
    expect(out.nodes[1].x).toBe(0);
  });

  test('wysokość płótna rośnie, żeby pomieścić węzeł przeciągnięty niżej niż domyślny układ', () => {
    const base = layoutBossMap(3, 300);
    const out = applyLayoutOverrides(base.nodes, ['a', 'b', 'c'], { c: { x: 10, y: 99999 } }, 300);
    expect(out.height).toBeGreaterThan(99999);
  });
});

describe('bossMapLayout — catmullRomPath (wygładzona ścieżka, §322)', () => {
  test('mniej niż 2 punkty → pusty string', () => {
    expect(catmullRomPath([])).toBe('');
    expect(catmullRomPath([{ x: 0, y: 0 }])).toBe('');
  });

  test('dokładnie 2 punkty → prosta linia (nie ma czego wygładzać)', () => {
    expect(catmullRomPath([{ x: 0, y: 0 }, { x: 10, y: 20 }])).toBe('M 0 0 L 10 20');
  });

  test('zaczyna się dokładnie w pierwszym punkcie', () => {
    const d = catmullRomPath([{ x: 5, y: 5 }, { x: 50, y: 10 }, { x: 100, y: 5 }]);
    expect(d.startsWith('M 5 5')).toBe(true);
  });

  test('krzywa kończy się dokładnie w ostatnim punkcie (ostatnia krzywa Beziera trafia w niego)', () => {
    const pts = [{ x: 0, y: 0 }, { x: 40, y: 10 }, { x: 80, y: -10 }, { x: 120, y: 0 }];
    const d = catmullRomPath(pts);
    const last = pts[pts.length - 1];
    expect(d.trim().endsWith(`${last.x} ${last.y}`)).toBe(true);
  });

  test('deterministyczna — te same punkty zawsze dają tę samą ścieżkę', () => {
    const pts = [{ x: 1, y: 2 }, { x: 3, y: 9 }, { x: 7, y: 4 }];
    expect(catmullRomPath(pts)).toBe(catmullRomPath(pts));
  });
});
