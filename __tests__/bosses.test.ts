import { weaknessMult, bossGuarded, weaknessMet, Boss, WeaknessCtx } from '@/utils/bosses';
import { raidForWeek, raidHpFor } from '@/utils/raid';

const ctx = (o: Partial<WeaknessCtx> = {}): WeaknessCtx => ({
  stepsToday: 0, sweetlessDays: 0, habitsRatio: 0, moodLoggedToday: false,
  boughtSweetToday: false, sleepMinutes: 0, waterRatio: 0, ...o,
});
const boss = (o: Partial<Boss>): Boss => ({
  id: 'x', name: 'x', emoji: 'x', order: 1, unlockLevel: 1, hp: 1000,
  weakness: 'steps', weaknessLabel: 'x', loot: { id: 'l', name: 'l', emoji: 'l', desc: 'l', bonus: {} },
  coins: 0, xp: 0, taunt: 'x', ...o,
});

describe('bosses — słabości sen/woda', () => {
  test('sen 7h+ = pełny bonus ×1.25, brak snu = ×1', () => {
    expect(weaknessMult(boss({ weakness: 'sleep' }), ctx({ sleepMinutes: 420 }))).toBeCloseTo(1.25);
    expect(weaknessMult(boss({ weakness: 'sleep' }), ctx({ sleepMinutes: 0 }))).toBeCloseTo(1);
  });
  test('woda: pełny cel dnia = pełny bonus', () => {
    expect(weaknessMult(boss({ weakness: 'water' }), ctx({ waterRatio: 1 }))).toBeCloseTo(1.25);
  });
});

describe('bosses — mechaniki', () => {
  test('osłona sweets: aktywna gdy dziś słodycze', () => {
    expect(bossGuarded(boss({ guard: 'sweets' }), ctx({ boughtSweetToday: true }))).toBe(true);
    expect(bossGuarded(boss({ guard: 'sweets' }), ctx({ boughtSweetToday: false }))).toBe(false);
  });
  test('osłona poorSleep: sen <6h', () => {
    expect(bossGuarded(boss({ guard: 'poorSleep' }), ctx({ sleepMinutes: 300 }))).toBe(true);
    expect(bossGuarded(boss({ guard: 'poorSleep' }), ctx({ sleepMinutes: 400 }))).toBe(false);
  });
  test('weaknessMet sweetless = dziś bez słodyczy', () => {
    expect(weaknessMet(boss({ weakness: 'sweetless' }), ctx({ boughtSweetToday: false }))).toBe(true);
    expect(weaknessMet(boss({ weakness: 'sweetless' }), ctx({ boughtSweetToday: true }))).toBe(false);
  });
});

describe('raid — deterministyczny', () => {
  test('ten sam tydzień → ten sam boss i HP', () => {
    expect(raidForWeek('2026-W31').id).toBe(raidForWeek('2026-W31').id);
    expect(raidHpFor(10, '2026-W31')).toBe(raidHpFor(10, '2026-W31'));
  });
  test('HP rośnie z poziomem', () => {
    expect(raidHpFor(20, '2026-W31')).toBeGreaterThan(raidHpFor(1, '2026-W31'));
  });
});
