import {
  missionMinutesFor, missionRewardFor, minibossForMission,
  MISSION_BASE_MIN, MISSION_MIN_PER_LEVEL, MISSION_MAX_MIN,
  MISSION_PROFILE_ORDER, MISSION_PROFILE_LABEL,
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

  // 2026-08-21, user: "misje wyprawy sa absurdalnie długie" — MISSION_MIN_PER_LEVEL
  // przepisane 6→1 (patrz komentarz w missions.ts), więc Lv50 dawne ~5h (300min) skróciło
  // się do ok. godziny, nie kilku.
  test('lvl 50 daje ok. 1h (skrócone z dawnych ~5h, 2026-08-21)', () => {
    const min = missionMinutesFor(50);
    expect(min).toBeGreaterThan(45);
    expect(min).toBeLessThan(75);
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

// 2026-08-18, user: "trzeba zrobić że mam jak w sfgame że mogę wybrać misję czy pod złoto
// czy pod XP że jedna ma trochę więcej gold a druga XP i mogą być 3 do wyboru".
describe('missions — profile misji (balanced/gold/xp, S&F-style trade-off)', () => {
  test('brak argumentu = balanced (wsteczna kompatybilność, stare wywołania bez zmian)', () => {
    expect(missionRewardFor(20)).toEqual(missionRewardFor(20, 'balanced'));
  });
  test('gold daje więcej monet ale mniej XP niż balanced, przy tym samym poziomie', () => {
    const balanced = missionRewardFor(20, 'balanced');
    const gold = missionRewardFor(20, 'gold');
    expect(gold.coins).toBeGreaterThan(balanced.coins);
    expect(gold.xp).toBeLessThan(balanced.xp);
  });
  test('xp daje więcej XP ale mniej monet niż balanced, przy tym samym poziomie', () => {
    const balanced = missionRewardFor(20, 'balanced');
    const xpProfile = missionRewardFor(20, 'xp');
    expect(xpProfile.xp).toBeGreaterThan(balanced.xp);
    expect(xpProfile.coins).toBeLessThan(balanced.coins);
  });
  test('MISSION_PROFILE_ORDER/LABEL mają wpis dla każdego z 3 profili, bez duplikatów etykiet', () => {
    expect(MISSION_PROFILE_ORDER.length).toBe(3);
    const labels = MISSION_PROFILE_ORDER.map(p => MISSION_PROFILE_LABEL[p]);
    expect(new Set(labels).size).toBe(3);
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
