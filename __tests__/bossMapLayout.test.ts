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

  test('kolejne węzły są dokładnie STEP (170) od siebie — pojedynczy, ciągły szlak', () => {
    const { nodes } = layoutBossMap(22);
    for (let i = 1; i < nodes.length; i++) {
      const dx = nodes[i].x - nodes[i - 1].x;
      const dy = nodes[i].y - nodes[i - 1].y;
      const dist = Math.sqrt(dx * dx + dy * dy);
      expect(dist).toBeCloseTo(170, 5);
    }
  });

  test('wszystkie węzły mieszczą się w zwróconym width/height (z marginesem)', () => {
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
