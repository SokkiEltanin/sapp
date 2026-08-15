import {
  missionMinutesFor, missionRewardFor, minibossForMission,
  MISSION_BASE_MIN, MISSION_MIN_PER_LEVEL, MISSION_MAX_MIN,
} from '@/utils/missions';
import { MINIBOSSES } from '@/utils/minibosses';

describe('missions — missionMinutesFor (rośnie z levelem, user: "od 10 min, im większy lvl tym dłużej")', () => {
  test('lvl 1 = dokładnie MISSION_BASE_MIN (10 min)', () => {
    expect(missionMinutesFor(1)).toBe(MISSION_BASE_MIN);
  });

  test('rośnie liniowo z levelem', () => {
    expect(missionMinutesFor(10)).toBeGreaterThan(missionMinutesFor(1));
    expect(missionMinutesFor(50)).toBeGreaterThan(missionMinutesFor(10));
  });

  test('capowane na MISSION_MAX_MIN — nie rośnie w nieskończoność', () => {
    expect(missionMinutesFor(10000)).toBe(MISSION_MAX_MIN);
  });

  test('lvl 50 (próg MAD) daje ok. 5h — user\'s own przykład z pierwszej wiadomości', () => {
    const min = missionMinutesFor(50);
    expect(min).toBeGreaterThan(250);
    expect(min).toBeLessThan(350);
  });
});

describe('missions — missionRewardFor (więcej niż daily quest, skaluje z levelem)', () => {
  test('rośnie z levelem (ten sam mnożnik co reszta questów)', () => {
    const low = missionRewardFor(1);
    const high = missionRewardFor(60);
    expect(high.coins).toBeGreaterThan(low.coins);
    expect(high.xp).toBeGreaterThan(low.xp);
  });

  test('bazowa nagroda (lvl 1) wyraźnie wyższa niż typowy daily quest (np. d_mood: 2 coins/5 xp)', () => {
    const r = missionRewardFor(1);
    expect(r.coins).toBeGreaterThan(2);
    expect(r.xp).toBeGreaterThan(5);
  });
});

describe('missions — minibossForMission (seedowane DOKŁADNYM czasem, nie datą)', () => {
  test('ten sam timestamp → zawsze ten sam miniboss', () => {
    const a = minibossForMission('2026-08-15T10:00:00.000Z');
    const b = minibossForMission('2026-08-15T10:00:00.000Z');
    expect(a.id).toBe(b.id);
  });

  test('zwraca kompletny obiekt z rostera', () => {
    const mb = minibossForMission('2026-08-15T10:00:00.000Z');
    expect(MINIBOSSES.map(m => m.id)).toContain(mb.id);
  });

  test('różne dokładne timestampy tego samego dnia dają realnie różnych minibossów (dziennego cappingu brak)', () => {
    const ids = new Set(
      Array.from({ length: 10 }, (_, i) => minibossForMission(`2026-08-15T10:${String(i * 5).padStart(2, '0')}:00.000Z`).id),
    );
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('missions — MISSION_MIN_PER_LEVEL exported and consistent with missionMinutesFor', () => {
  test('lvl 2 = base + 1x per-level step', () => {
    expect(missionMinutesFor(2)).toBe(MISSION_BASE_MIN + MISSION_MIN_PER_LEVEL);
  });
});
