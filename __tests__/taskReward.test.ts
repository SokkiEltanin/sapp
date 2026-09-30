import { taskReward } from '@/utils/taskReward';

// "Trudność" zadania (2026-09-30, user: "trochę jest bez sensu") zastąpiona automatyczną
// nagrodą liczoną z dwóch sygnałów appka już zna: priorytet (poziom) + pilność/tempo
// wykonania (user: "im pilniejszy i szybciej wykonany tym więcej XP i coinów").

describe('taskReward — sam priorytet (bez terminu, dawno utworzone → brak bonusów)', () => {
  const oldCreated = '2020-01-01T00:00:00.000Z';
  const at = new Date('2026-06-01T12:00:00.000Z');

  test('low < normal < high', () => {
    const low = taskReward({ priority: 'low', createdAt: oldCreated }, at);
    const normal = taskReward({ priority: 'normal', createdAt: oldCreated }, at);
    const high = taskReward({ priority: 'high', createdAt: oldCreated }, at);
    expect(low.coins).toBeLessThan(normal.coins);
    expect(normal.coins).toBeLessThan(high.coins);
    expect(low.xp).toBeLessThan(normal.xp);
    expect(normal.xp).toBeLessThan(high.xp);
  });

  test('nigdy poniżej 1 monety/XP', () => {
    const r = taskReward({ priority: 'low', createdAt: oldCreated }, at);
    expect(r.coins).toBeGreaterThanOrEqual(1);
    expect(r.xp).toBeGreaterThanOrEqual(1);
  });
});

describe('taskReward — bonus za tempo (utworzone → ukończone)', () => {
  test('ukończone tego samego dnia > dzień później > 3 dni później > tydzień później', () => {
    const created = '2026-06-01T09:00:00.000Z';
    const sameDay = taskReward({ priority: 'normal', createdAt: created }, new Date('2026-06-01T18:00:00.000Z'));
    const nextDay = taskReward({ priority: 'normal', createdAt: created }, new Date('2026-06-02T18:00:00.000Z'));
    const threeDays = taskReward({ priority: 'normal', createdAt: created }, new Date('2026-06-04T18:00:00.000Z'));
    const weekLater = taskReward({ priority: 'normal', createdAt: created }, new Date('2026-06-08T18:00:00.000Z'));
    expect(sameDay.xp).toBeGreaterThan(nextDay.xp);
    expect(nextDay.xp).toBeGreaterThan(threeDays.xp);
    expect(threeDays.xp).toBeGreaterThan(weekLater.xp);
  });
});

describe('taskReward — bonus za pilność (termin vs moment ukończenia)', () => {
  const created = '2020-01-01T00:00:00.000Z'; // dawno, żeby nie mieszał się bonus za tempo

  test('termin dziś > termin jutro > termin za tydzień', () => {
    const at = new Date('2026-06-10T12:00:00.000Z');
    const dueToday = taskReward({ priority: 'normal', createdAt: created, deadline: '2026-06-10' }, at);
    const dueTomorrow = taskReward({ priority: 'normal', createdAt: created, deadline: '2026-06-11' }, at);
    const dueLater = taskReward({ priority: 'normal', createdAt: created, deadline: '2026-06-20' }, at);
    expect(dueToday.xp).toBeGreaterThan(dueTomorrow.xp);
    expect(dueTomorrow.xp).toBeGreaterThan(dueLater.xp);
  });

  test('ukończone PO terminie — bez bonusu, ale i bez kary (tyle co bez terminu)', () => {
    const at = new Date('2026-06-15T12:00:00.000Z');
    const overdue = taskReward({ priority: 'normal', createdAt: created, deadline: '2026-06-10' }, at);
    const noDeadline = taskReward({ priority: 'normal', createdAt: created }, at);
    expect(overdue).toEqual(noDeadline);
  });

  test('brak terminu — neutralne, tyle co termin dawno miniony', () => {
    const at = new Date('2026-06-01T12:00:00.000Z');
    const r = taskReward({ priority: 'high', createdAt: created }, at);
    expect(r.coins).toBe(3); // waga priorytetu 'high', mnożnik ×1
  });
});

describe('taskReward — bonusy się mnożą (pilny priorytet + termin dziś + zrobione od razu)', () => {
  test('maksymalny scenariusz daje wyraźnie więcej niż sam priorytet', () => {
    const created = '2026-06-01T08:00:00.000Z';
    const at = new Date('2026-06-01T20:00:00.000Z'); // ten sam dzień
    const best = taskReward({ priority: 'high', createdAt: created, deadline: '2026-06-01' }, at);
    const baseline = taskReward({ priority: 'high', createdAt: '2020-01-01T00:00:00.000Z' }, at);
    expect(best.coins).toBeGreaterThan(baseline.coins);
    expect(best.xp).toBeGreaterThan(baseline.xp);
  });
});
