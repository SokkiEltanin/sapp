import { raidForWeek, raidHpFor, raidCoins, raidXp, raidSessionHpFor, raidAsBoss, RAID_SESSION_HITS, RAID_POOL } from '@/utils/raid';
import { simulateFight, counterDamage, atkPower, Bonuses } from '@/utils/bosses';

const ZERO: Bonuses = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };

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

// 2026-08-17: raid dostał pełną rundową walkę (attackRoundBased w boss-fight.tsx) zamiast
// jednego kliknięcia — user: "miała być zwykła walka tylko taka która nie restartuje jego HP".
// Każda próba to sesja wobec raidSessionHpFor, NIE wobec surowej raidHpFor (za duża — patrz
// komentarz w raid.ts: counterDamage() liczy % od AKTUALNEGO hp bossa, więc surowa tygodniowa
// pula zabiłaby kotka jednym kontratakiem). Te testy pilnują że sesja jest bezpiecznie
// skalowana jak reszta trybów (ten sam wzorzec co questBossHpFor/madBossHpFor).
describe('raid — raidSessionHpFor / raidAsBoss (sesja rundowa, 2026-08-17)', () => {
  test('sesyjne hp rośnie z realną mocą gracza (poziom + staty + łup), nie stała liczba', () => {
    const low = raidSessionHpFor(0, 1, ZERO);
    const high = raidSessionHpFor(200, 50, { atk: 0.3, dodge: 0.1, crit: 0.1, energyMult: 0.2 });
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(0);
  });

  test('sesja jest RZĘDU wielkości mniejsza niż surowa tygodniowa pula na wyższych poziomach — to sedno fixu', () => {
    const level = 40;
    const session = raidSessionHpFor(0, level, ZERO);
    const weekly = raidHpFor(level, '2026-08-10');
    expect(session).toBeLessThan(weekly);
  });

  test('zabijalny w ~RAID_SESSION_HITS ciosów na kilku poziomach, przy zerowej inwestycji', () => {
    const raid = RAID_POOL[0];
    for (const level of [2, 10, 30, 60]) {
      const sessionHp = raidSessionHpFor(0, level, ZERO);
      const hit = atkPower(0, level, ZERO);
      const hitsNeeded = sessionHp / hit;
      expect(hitsNeeded).toBeCloseTo(RAID_SESSION_HITS, 0);
    }
  });

  test('kontratak sesji NIE zabija kotka (base 100 HP) w 1 rundzie na żadnym z tych poziomów', () => {
    for (const level of [2, 30, 60, 100]) {
      const sessionHp = raidSessionHpFor(0, level, ZERO);
      const counter = counterDamage(sessionHp, 0); // round 1: aktualne hp = max sesji
      expect(counter).toBeLessThan(100);
    }
  });

  test('kontrast: surowa tygodniowa pula NA WYŻSZYCH poziomach BY zabiła w 1 rundzie — dowód że sesja jest naprawdę potrzebna, nie kosmetyczna', () => {
    const weeklyCounter = counterDamage(raidHpFor(60, '2026-08-10'), 0);
    expect(weeklyCounter).toBeGreaterThan(100);
  });

  test('raidAsBoss przenosi tożsamość raidu i podpina hp z argumentu (sesja, nie surowa pula)', () => {
    const raid = RAID_POOL[0];
    const boss = raidAsBoss(raid, 500);
    expect(boss.id).toBe(raid.id);
    expect(boss.name).toBe(raid.name);
    expect(boss.weakness).toBe(raid.weakness);
    expect(boss.attackKind).toBe(raid.attackKind);
    expect(boss.hp).toBe(500);
    expect(boss.guard).toBeUndefined();
    expect(boss.regenPct).toBeUndefined();
  });

  // Kotek MOŻE zemdleć w środku sesji przy pechu (wariancja) — to NIE jest bug: raid jest
  // z założenia bez stanu porażki (finish() w boss-fight.tsx ignoruje catFainted dla raid),
  // każda próba i tak dopisuje część postępu do trwałej puli, więc "słabsza sesja" po prostu
  // znaczy mniej dobitego HP tym razem, nie przegraną. Test pilnuje właściwej niezmienniczości:
  // walka zawsze robi RZECZYWISTY postęp (przynajmniej jeden cios trafia zanim cokolwiek się
  // wydarzy) i nigdy nie ucieka w setki rund.
  test('pełna symulacja sesji zawsze robi realny postęp i kończy się w rozsądnej liczbie rund (wiele prób, żeby złapać wariancję)', () => {
    const raid = RAID_POOL[0];
    const level = 25;
    const bonuses: Bonuses = { atk: 0.1, dodge: 0.05, crit: 0.05, energyMult: 0.1 };
    const atkStatBonus = 80;
    const sessionHp = raidSessionHpFor(atkStatBonus, level, bonuses);
    const boss = raidAsBoss(raid, sessionHp);
    for (let t = 0; t < 50; t++) {
      const result = simulateFight(atkStatBonus, level, bonuses, boss, 100 + 30, 200);
      expect(result.rounds.length).toBeLessThan(RAID_SESSION_HITS * 3);
      expect(result.bossHpLeft).toBeLessThan(sessionHp); // zawsze przynajmniej jeden cios trafia
    }
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
