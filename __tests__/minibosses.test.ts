import {
  minibossForDay, minibossAsBoss, minibossHpFor, minibossCoins, minibossXp,
  WATER_MINIBOSSES, STEPS_MINIBOSSES, STEPS_MILESTONE,
} from '@/utils/minibosses';

describe('minibosses — minibossForDay (deterministyczny wybór na dzień/tor)', () => {
  test('ten sam dzień+tor → zawsze ten sam miniboss', () => {
    const a = minibossForDay('2026-08-14', 'water');
    const b = minibossForDay('2026-08-14', 'water');
    expect(a.id).toBe(b.id);
  });

  test('water i steps ciągną z osobnych, nienachodzących na siebie pul', () => {
    const waterIds = new Set(WATER_MINIBOSSES.map(m => m.id));
    const stepsIds = new Set(STEPS_MINIBOSSES.map(m => m.id));
    for (const id of waterIds) expect(stepsIds.has(id)).toBe(false);
  });

  test('zwraca kompletny obiekt z właściwej puli dla danego toru', () => {
    const w = minibossForDay('2026-08-14', 'water');
    const st = minibossForDay('2026-08-14', 'steps');
    expect(WATER_MINIBOSSES.map(m => m.id)).toContain(w.id);
    expect(STEPS_MINIBOSSES.map(m => m.id)).toContain(st.id);
  });

  test('różne dni dają realnie różnych minibossów (nie utknięte na jednym)', () => {
    const days = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17'];
    const ids = new Set(days.map(d => minibossForDay(d, 'water').id));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('minibosses — balans (dużo niżej niż wydarzenia/kampania, "stosunkowo łatwy")', () => {
  test('HP rośnie z poziomem, ale zostaje niskie', () => {
    expect(minibossHpFor(1)).toBeLessThan(100);
    expect(minibossHpFor(20)).toBeGreaterThan(minibossHpFor(1));
  });

  test('coins/xp rosną z poziomem', () => {
    expect(minibossCoins(10)).toBeGreaterThan(minibossCoins(1));
    expect(minibossXp(10)).toBeGreaterThan(minibossXp(1));
  });

  test('próg kroków zgodny z istniejącym questem d_steps10 (10k)', () => {
    expect(STEPS_MILESTONE).toBe(10000);
  });
});

describe('minibosses — minibossAsBoss (kształt gotowy do simulateFight)', () => {
  test('HP w Boss-obiekcie zgodne z minibossHpFor na danym poziomie', () => {
    const mb = WATER_MINIBOSSES[0];
    const boss = minibossAsBoss(mb, 5);
    expect(boss.hp).toBe(minibossHpFor(5));
    expect(boss.id).toBe(mb.id);
    expect(boss.name).toBe(mb.name);
  });
});
