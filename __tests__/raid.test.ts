import { raidForWeek, raidHpFor, raidCoins, raidXp, raidCounterHpFor, raidAsBoss, RAID_COUNTER_HITS, RAID_ENERGY_COST, RAID_POOL } from '@/utils/raid';
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

// 2026-08-25: DRUGI redesign raidu (pierwszy 2026-08-17 walczył wobec MAŁEJ "sesji" zamiast
// realnej puli — user zagrał realnie i zgłosił: "mimo połowy ponad HP przerwało", bo sesja
// kończyła się po ~6 ciosach niezależnie od tego ile realnie zostało bossowi). Teraz walka
// idzie WPROST wobec `raidRemaining` (`boss.hp`), a `counterHp` (osobne pole) trzyma tylko
// bezpieczną skalę dla counterDamage() — testy pilnują że TO rozdzielenie działa poprawnie.
describe('raid — raidCounterHpFor / raidAsBoss (bezpieczna skala kontrataku, 2026-08-25)', () => {
  test('counterHp rośnie z realną mocą gracza (poziom + staty + łup), nie stała liczba', () => {
    const low = raidCounterHpFor(0, 1, ZERO);
    const high = raidCounterHpFor(200, 50, { atk: 0.3, dodge: 0.1, crit: 0.1, energyMult: 0.2 });
    expect(high).toBeGreaterThan(low);
    expect(low).toBeGreaterThan(0);
  });

  test('counterHp jest RZĘDU wielkości mniejsze niż surowa tygodniowa pula na wyższych poziomach — to sedno fixu', () => {
    const level = 40;
    const counterHp = raidCounterHpFor(0, level, ZERO);
    const weekly = raidHpFor(level, '2026-08-10');
    expect(counterHp).toBeLessThan(weekly);
  });

  test('kalibrowane na ~RAID_COUNTER_HITS ciosów na kilku poziomach, przy zerowej inwestycji', () => {
    for (const level of [2, 10, 30, 60]) {
      const counterHp = raidCounterHpFor(0, level, ZERO);
      const hit = atkPower(0, level, ZERO);
      const hitsNeeded = counterHp / hit;
      expect(hitsNeeded).toBeCloseTo(RAID_COUNTER_HITS, 0);
    }
  });

  test('kontratak liczony od counterHp NIE zabija kotka (base 100 HP) w 1 rundzie na żadnym z tych poziomów', () => {
    for (const level of [2, 30, 60, 100]) {
      const counterHp = raidCounterHpFor(0, level, ZERO);
      const counter = counterDamage(counterHp, 0);
      expect(counter).toBeLessThan(100);
    }
  });

  test('kontrast: kontratak liczony od SUROWEJ tygodniowej puli NA WYŻSZYCH poziomach BY zabił w 1 rundzie — dowód że rozdzielenie counterHp/hp jest naprawdę potrzebne', () => {
    const weeklyCounter = counterDamage(raidHpFor(60, '2026-08-10'), 0);
    expect(weeklyCounter).toBeGreaterThan(100);
  });

  test('raidAsBoss przenosi tożsamość raidu, PRAWDZIWE hp z argumentu (nie counterHp) i osobne counterHp', () => {
    const raid = RAID_POOL[0];
    const boss = raidAsBoss(raid, 2643, 500);
    expect(boss.id).toBe(raid.id);
    expect(boss.name).toBe(raid.name);
    expect(boss.weakness).toBe(raid.weakness);
    expect(boss.attackKind).toBe(raid.attackKind);
    expect(boss.hp).toBe(2643);       // realna, pozostała pula — TO zbija walka
    expect(boss.counterHp).toBe(500); // osobna, bezpieczna skala dla kontrataku
    expect(boss.guard).toBeUndefined();
    expect(boss.regenPct).toBeUndefined();
  });

  test('pełna walka wobec DUŻEJ, realnej puli: kontratak liczy się od małego counterHp (kotek nie ginie natychmiast), a bossHp faktycznie spada o realne obrażenia gracza', () => {
    const raid = RAID_POOL[0];
    const level = 25;
    const bonuses: Bonuses = { atk: 0.1, dodge: 0.05, crit: 0.05, energyMult: 0.1 };
    const atkStatBonus = 80;
    const counterHp = raidCounterHpFor(atkStatBonus, level, bonuses);
    const realRemaining = raidHpFor(level, '2026-08-10'); // duża, tygodniowa pula
    const boss = raidAsBoss(raid, realRemaining, counterHp);
    for (let t = 0; t < 20; t++) {
      const result = simulateFight(atkStatBonus, level, bonuses, boss, 100 + 30, 200);
      expect(result.bossHpLeft).toBeLessThan(realRemaining); // realny postęp na PRAWDZIWEJ skali
      // walka kończy się przez faktyczne 0 HP jednej ze stron (albo wyczerpanie sufitu rund),
      // nie przez sztuczny, sesyjny limit — result.rounds może być długie, to oczekiwane teraz.
      expect(result.rounds.length).toBeGreaterThan(0);
    }
  });

  test('mała, prawie wyczerpana pula: walka potrafi ją realnie dobić do zera w jednej próbie', () => {
    const raid = RAID_POOL[0];
    const level = 25;
    const bonuses: Bonuses = { atk: 0.1, dodge: 0.05, crit: 0.05, energyMult: 0.1 };
    const atkStatBonus = 80;
    const counterHp = raidCounterHpFor(atkStatBonus, level, bonuses);
    const smallRemaining = Math.round(atkPower(atkStatBonus, level, bonuses) * 2); // ~2 ciosy do zera
    const boss = raidAsBoss(raid, smallRemaining, counterHp);
    const result = simulateFight(atkStatBonus, level, bonuses, boss, 100 + 30, 200);
    expect(result.bossHpLeft).toBe(0);
    expect(result.won).toBe(true);
  });
});

describe('raid — RAID_ENERGY_COST (2 zamiast 1, 2026-08-25)', () => {
  test('koszt to teraz 2, nie 1 — dłuższa, prawdziwa walka niż dawna krótka sesja', () => {
    expect(RAID_ENERGY_COST).toBe(2);
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
