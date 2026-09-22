import { levelFromXp } from '@/store/petStore';

// 2026-09-22, user po realnym eksporcie 4. rundy testowej (poziom 617): "za dużo tego się
// dostaje przez co jest skok mnóstwo w górę lvl" — jedna walka MAD dała 697500 XP = ~28
// poziomów W JEDNEJ WALCE pod starą (czysto liniową) krzywą. User: "a może po prostu zamiast
// skakać level tak bardzo to zwiększymy XP później per level" — krzywa POD 116 (koniec
// kampanii) zostaje identyczna (cała wcześniejsza kalibracja balansu nadal ważna), PO 116
// krok XP/poziom rośnie dodatkowo, więc te same duże zastrzyki XP z endgame'u (MAD/raid) dają
// mniej poziomów, nie mniej XP.

describe('levelFromXp — krzywa BEZ zmian do poziomu 116 (koniec kampanii)', () => {
  test('poziom 1 od 0 XP', () => {
    expect(levelFromXp(0).level).toBe(1);
  });
  test('dokładnie na granicy — 100 XP = start poziomu 2', () => {
    const r = levelFromXp(100);
    expect(r.level).toBe(2);
    expect(r.inLevel).toBe(0);
  });
  test('poziom 116 (unlockLevel finałowego bossa kampanii) — needed = 100+115*40 = 4700', () => {
    // suma XP potrzebna DO poziomu 116 pod czysto liniową formułą 100+(L-1)*40
    let acc = 0, need = 100;
    for (let level = 1; level < 116; level++) { acc += need; need = 100 + level * 40; }
    const r = levelFromXp(acc);
    expect(r.level).toBe(116);
    expect(r.needed).toBe(4700);
  });
});

describe('levelFromXp — krok XP/poziom przyspiesza PO poziomie 116', () => {
  test('XP potrzebne żeby dojść z poziomu 116 do 200 jest WYRAŹNIE wyższe niż pod czysto liniową formułą', () => {
    // XP do poziomu 116 (identyczne w obu formułach — kampania nietknięta).
    let accTo116 = 0, need = 100;
    for (let level = 1; level < 116; level++) { accTo116 += need; need = 100 + level * 40; }
    // Ile DODATKOWO trzeba pod nową krzywą, żeby dojść do poziomu 200 (levelFromXp).
    let xp = accTo116;
    while (levelFromXp(xp).level < 200) xp += 1000;
    const newXpFor200 = xp;
    // Ile pod starą, czysto liniową formułą (100+(L-1)*40 bez przyspieszenia).
    let accOld = accTo116, needOld = 100 + 115 * 40;
    for (let level = 116; level < 200; level++) { accOld += needOld; needOld = 100 + level * 40; }
    expect(newXpFor200).toBeGreaterThan(accOld);
  });

  test('realny scenariusz usera: 697500 XP zastrzyk przy poziomie ~588 (stara krzywa) daje', () => {
    // Ta sama para punktów co w throwaway-symulacji przed wdrożeniem (patrz komentarz w
    // petStore.ts): total XP z eksportu usera, minus ostatnia walka MAD, żeby zmierzyć SAM
    // skok tej jednej walki, nie całą rundę.
    const totalXp = 7639273;
    const bigFightXp = 697500;
    const before = levelFromXp(totalXp - bigFightXp).level;
    const after = levelFromXp(totalXp).level;
    const jump = after - before;
    // Stara (czysto liniowa) krzywa dawała tu ~29 poziomów w JEDNEJ walce — to i było
    // zgłoszonym problemem. Nowa krzywa ma trzymać to w rozsądnym zakresie.
    expect(jump).toBeGreaterThan(0);
    expect(jump).toBeLessThan(10);
  });
});
