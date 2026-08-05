import { weekKeyOf } from '@/utils/quests';

const DAY = 86400000;

describe('quests — weekKeyOf (poniedziałek tygodnia)', () => {
  test('klucz to zawsze PONIEDZIAŁEK ≤ podana data i w ciągu 6 dni', () => {
    for (const day of [1, 5, 9, 15, 31]) {
      const d = new Date(2026, 7, day);
      const kd = new Date(weekKeyOf(d) + 'T00:00:00');
      expect(kd.getDay()).toBe(1); // poniedziałek
      const diff = (d.getTime() - kd.getTime()) / DAY;
      expect(diff).toBeGreaterThanOrEqual(0);
      expect(diff).toBeLessThanOrEqual(6);
    }
  });

  test('poniedziałek i niedziela TEGO tygodnia → ten sam klucz; następny poniedziałek → inny', () => {
    const mon = new Date(weekKeyOf(new Date(2026, 7, 15)) + 'T00:00:00');
    const sun = new Date(mon.getTime() + 6 * DAY);
    const nextMon = new Date(mon.getTime() + 7 * DAY);
    expect(weekKeyOf(sun)).toBe(weekKeyOf(mon));
    expect(weekKeyOf(nextMon)).not.toBe(weekKeyOf(mon));
  });
});
