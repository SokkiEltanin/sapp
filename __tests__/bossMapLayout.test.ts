import { layoutBossMap } from '@/utils/bossMapLayout';

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
