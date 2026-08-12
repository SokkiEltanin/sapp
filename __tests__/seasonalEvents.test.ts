import {
  easterSunday, activeSeasonalEvent, pickMenace, currentEventBoss, eventPeriodKey, eventBossFromKey, MENACE_POOL,
  eventHpFor, eventAsBoss,
} from '@/utils/seasonalEvents';
import { atkPower, counterDamage } from '@/utils/bosses';

describe('seasonalEvents — easterSunday', () => {
  test('matches known Gregorian Easter dates', () => {
    expect(easterSunday(2024)).toEqual(new Date(2024, 2, 31));  // 31 marca
    expect(easterSunday(2025)).toEqual(new Date(2025, 3, 20));  // 20 kwietnia
    expect(easterSunday(2026)).toEqual(new Date(2026, 3, 5));   // 5 kwietnia
    expect(easterSunday(2027)).toEqual(new Date(2027, 2, 28));  // 28 marca
  });
});

describe('seasonalEvents — activeSeasonalEvent', () => {
  test('Mikołaj active 1–26 grudnia, not after', () => {
    expect(activeSeasonalEvent(new Date(2026, 11, 6))?.id).toBe('mikolaj');
    expect(activeSeasonalEvent(new Date(2026, 11, 26))?.id).toBe('mikolaj');
    expect(activeSeasonalEvent(new Date(2026, 11, 27))).toBeNull();
  });

  test('Wielkanoc active around computed Easter Sunday', () => {
    // Easter 2026 = 5 kwietnia → okno Wielki Czwartek (1 kwi) – Poniedziałek (6 kwi)
    expect(activeSeasonalEvent(new Date(2026, 3, 5))?.id).toBe('wielkanoc');
    expect(activeSeasonalEvent(new Date(2026, 3, 1))?.id).toBe('wielkanoc');
    expect(activeSeasonalEvent(new Date(2026, 3, 6))?.id).toBe('wielkanoc');
    expect(activeSeasonalEvent(new Date(2026, 2, 20))).toBeNull(); // za wcześnie
  });

  test('Wakacje active 15 czerwca – 31 sierpnia', () => {
    expect(activeSeasonalEvent(new Date(2026, 5, 15))?.id).toBe('wakacje');
    expect(activeSeasonalEvent(new Date(2026, 6, 15))?.id).toBe('wakacje');
    expect(activeSeasonalEvent(new Date(2026, 7, 31))?.id).toBe('wakacje');
    expect(activeSeasonalEvent(new Date(2026, 5, 14))).toBeNull();
    expect(activeSeasonalEvent(new Date(2026, 8, 1))).toBeNull();
  });

  test('quiet month → null', () => {
    expect(activeSeasonalEvent(new Date(2026, 0, 15))).toBeNull(); // 15 stycznia
  });
});

describe('seasonalEvents — pickMenace', () => {
  test('below threshold on both → null (nic nie odstaje)', () => {
    expect(pickMenace({ workHoursThisMonth: 100, workHoursAvg: 100, sweetsThisMonth: 50, sweetsAvg: 50 })).toBeNull();
  });

  test('no historical average → ratio 0 → no trigger from that metric', () => {
    expect(pickMenace({ workHoursThisMonth: 300, workHoursAvg: 0, sweetsThisMonth: 0, sweetsAvg: 0 })).toBeNull();
  });

  test('overtime clearly worse → Widmo Nadgodzin', () => {
    const r = pickMenace({ workHoursThisMonth: 200, workHoursAvg: 100, sweetsThisMonth: 50, sweetsAvg: 50 });
    expect(r?.id).toBe(MENACE_POOL.overtime.id);
  });

  test('sweets clearly worse → Demon Słodyczy', () => {
    const r = pickMenace({ workHoursThisMonth: 100, workHoursAvg: 100, sweetsThisMonth: 150, sweetsAvg: 50 });
    expect(r?.id).toBe(MENACE_POOL.sweettooth.id);
  });
});

describe('seasonalEvents — currentEventBoss priority', () => {
  test('seasonal wins over an active menace', () => {
    const menaceCtx = { workHoursThisMonth: 300, workHoursAvg: 100, sweetsThisMonth: 0, sweetsAvg: 0 };
    const r = currentEventBoss(new Date(2026, 11, 10), menaceCtx); // grudnia → Mikołaj
    expect(r?.id).toBe('mikolaj');
  });

  test('falls back to menace outside any season', () => {
    const menaceCtx = { workHoursThisMonth: 300, workHoursAvg: 100, sweetsThisMonth: 0, sweetsAvg: 0 };
    const r = currentEventBoss(new Date(2026, 0, 15), menaceCtx);
    expect(r?.id).toBe(MENACE_POOL.overtime.id);
  });

  test('null when neither applies', () => {
    const menaceCtx = { workHoursThisMonth: 100, workHoursAvg: 100, sweetsThisMonth: 50, sweetsAvg: 50 };
    expect(currentEventBoss(new Date(2026, 0, 15), menaceCtx)).toBeNull();
  });
});

describe('seasonalEvents — eventPeriodKey', () => {
  test('seasonal keyed by year, menace keyed by year-month', () => {
    const seasonal = activeSeasonalEvent(new Date(2026, 11, 10))!;
    expect(eventPeriodKey(seasonal, new Date(2026, 11, 10))).toBe('mikolaj-2026');
    expect(eventPeriodKey(MENACE_POOL.overtime, new Date(2026, 0, 15))).toBe('overtime-2026-01');
  });
});

describe('seasonalEvents — eventBossFromKey', () => {
  test('resolves a saved eventKey back to its EventBoss', () => {
    expect(eventBossFromKey('mikolaj-2026')?.id).toBe('mikolaj');
    expect(eventBossFromKey('overtime-2026-01')?.id).toBe('overtime');
    expect(eventBossFromKey('nieznany-2026')).toBeUndefined();
  });
});

// 2026-08-12: walki eventowe przeszły z "jedno uderzenie/próbę w trwały bank HP rozłożony na
// cały okres" na "identyczne jak kampania — pełna round-based walka, 1 próba/dzień". eventHpFor
// zostało przebalansowane pod TEN model — testy pilnują, żeby ktoś przypadkiem nie wrócił do
// starej (o rząd wielkości większej) skali, która przy nowym modelu byłaby praktycznie
// niewygrywalna (patrz komentarz przy eventHpFor w seasonalEvents.ts).
describe('seasonalEvents — eventHpFor / eventAsBoss (round-based rebalance 2026-08-12)', () => {
  test('rośnie z poziomem, nigdy nie spada poniżej bazy', () => {
    expect(eventHpFor(0)).toBeGreaterThan(0);
    expect(eventHpFor(50)).toBeGreaterThan(eventHpFor(1));
  });

  test('zabijalny w rozsądnej liczbie ciosów (~5-6) na bazowych statach, na kilku poziomach', () => {
    const noBonus = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };
    for (const level of [2, 25, 50, 100]) {
      const hp = eventHpFor(level);
      const hit = atkPower(0, level, noBonus); // dolna granica (bez wariancji/krytu)
      const hitsNeeded = hp / hit;
      expect(hitsNeeded).toBeGreaterThan(2);   // nie trywialne
      expect(hitsNeeded).toBeLessThan(10);     // ale realnie kończy się w jednej walce
    }
  });

  test('kontratak nie zabija kotka (base 100 HP) w 1 rundzie na żadnym z tych poziomów', () => {
    for (const level of [2, 25, 50, 100]) {
      const hp = eventHpFor(level);
      const counter = counterDamage({ hp } as any, 0);
      expect(counter).toBeLessThan(100);
    }
  });

  test('eventAsBoss przenosi tożsamość eventBossa i podpina hp z eventHpFor', () => {
    const eb = MENACE_POOL.overtime;
    const boss = eventAsBoss(eb, 40);
    expect(boss.id).toBe(eb.id);
    expect(boss.name).toBe(eb.name);
    expect(boss.weakness).toBe(eb.weakness);
    expect(boss.hp).toBe(eventHpFor(40));
    expect(boss.guard).toBeUndefined();
    expect(boss.regenPct).toBeUndefined();
  });
});
