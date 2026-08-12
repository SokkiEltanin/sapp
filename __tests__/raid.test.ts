import { raidForWeek, raidHpFor, raidCoins, raidXp, RAID_POOL } from '@/utils/raid';

describe('raid — raidForWeek (deterministyczny wybór bossa tygodnia)', () => {
  test('ten sam klucz tygodnia → zawsze ten sam raid (nie losowy przy każdym wywołaniu)', () => {
    const a = raidForWeek('2026-08-10');
    const b = raidForWeek('2026-08-10');
    expect(a.id).toBe(b.id);
  });

  test('zwraca kompletny obiekt z puli, nie jakiś pusty fallback', () => {
    const r = raidForWeek('2026-08-10');
    expect(RAID_POOL.map(x => x.id)).toContain(r.id);
    expect(r.name).toBeTruthy();
    expect(r.weakness).toBeTruthy();
  });

  test('różne tygodnie dają realnie różne bossy (nie utknięte zawsze na tym samym)', () => {
    const weeks = ['2026-08-10', '2026-08-17', '2026-08-24', '2026-08-31', '2026-09-07', '2026-09-14', '2026-09-21', '2026-09-28'];
    const ids = new Set(weeks.map(w => raidForWeek(w).id));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('raid — raidHpFor (HP skaluje z poziomem, zaokrąglone do 100)', () => {
  test('wyższy poziom → wyższe HP dla tego samego tygodnia', () => {
    expect(raidHpFor(10, '2026-08-10')).toBeGreaterThan(raidHpFor(0, '2026-08-10'));
  });
  test('wynik zawsze zaokrąglony do pełnej setki', () => {
    for (const level of [0, 1, 5, 10, 25, 50]) {
      expect(raidHpFor(level, '2026-08-10') % 100).toBe(0);
    }
  });
  test('ujemny poziom potraktowany jak 0 (bez ujemnego HP)', () => {
    expect(raidHpFor(-5, '2026-08-10')).toBe(raidHpFor(0, '2026-08-10'));
  });
  test('ten sam poziom, różne tygodnie → wariacja tygodniowa daje różne (ale bliskie) HP', () => {
    const a = raidHpFor(0, '2026-08-10');
    const b = raidHpFor(0, '2026-08-17');
    // wariancja to 100..119% base — więc różnica jest ograniczona, nie dowolna
    expect(Math.abs(a - b) / a).toBeLessThan(0.2);
  });
});

describe('raid — raidCoins / raidXp (liniowe skalowanie nagrody)', () => {
  test('poziom 0 → wartość bazowa', () => {
    expect(raidCoins(0)).toBe(60);
    expect(raidXp(0)).toBe(400);
  });
  test('rosną liniowo z poziomem', () => {
    expect(raidCoins(10)).toBe(120); // 60 + 10*6
    expect(raidXp(10)).toBe(800);    // 400 + 10*40
  });
  test('ujemny poziom potraktowany jak 0', () => {
    expect(raidCoins(-3)).toBe(60);
    expect(raidXp(-3)).toBe(400);
  });
});
