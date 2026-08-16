import {
  minibossForQuest, minibossAsBoss, questBossHpFor, questFightCoins, questFightXp,
  FIGHT_BONUS, MINIBOSSES,
} from '@/utils/minibosses';
import { Bonuses } from '@/utils/bosses';

const ZERO: Bonuses = { atk: 0, dodge: 0, crit: 0, energyMult: 0 };

describe('minibosses — minibossForQuest (deterministyczny wybór na dzień/quest)', () => {
  test('ten sam dzień+quest → zawsze ten sam miniboss', () => {
    const a = minibossForQuest('2026-08-14', 'd_mood');
    const b = minibossForQuest('2026-08-14', 'd_mood');
    expect(a.id).toBe(b.id);
  });

  test('zwraca kompletny obiekt z rostera', () => {
    const mb = minibossForQuest('2026-08-14', 'd_mood');
    expect(MINIBOSSES.map(m => m.id)).toContain(mb.id);
    expect(mb.name).toBeTruthy();
    expect(mb.taunt).toBeTruthy();
  });

  test('różne questy tego samego dnia dają realnie różnych minibossów (nie utknięte na jednym)', () => {
    const quests = ['d_mood', 'd_steps10', 'd_steps20', 'd_habits', 'd_pet', 'b_water', 'b_sleep', 'b_stepbeat'];
    const ids = new Set(quests.map(q => minibossForQuest('2026-08-14', q).id));
    expect(ids.size).toBeGreaterThan(1);
  });

  test('różne dni dla tego samego questu też dają realnie różnych minibossów', () => {
    const days = ['2026-08-10', '2026-08-11', '2026-08-12', '2026-08-13', '2026-08-14', '2026-08-15', '2026-08-16', '2026-08-17'];
    const ids = new Set(days.map(d => minibossForQuest(d, 'd_mood').id));
    expect(ids.size).toBeGreaterThan(1);
  });
});

describe('minibosses — balans (rośnie z poziomem, nagroda > standardowy claim)', () => {
  test('HP rośnie z poziomem', () => {
    expect(questBossHpFor(0, 20, ZERO)).toBeGreaterThan(questBossHpFor(0, 1, ZERO));
  });

  test('HP rośnie z realną inwestycją gracza (fix 2026-08-15 #2, user: "ja im ponad 100, oni mi ledwo 1%")', () => {
    // Przed fixem questBossHpFor ignorował atkStatBonus/bonuses — gracz z realną inwestycją
    // zadawał dmg policzony na "vanilla" moc, więc bossy padały w 1-2 ciosy niezależnie od
    // tego ile faktycznie zainwestował. Teraz musi rosnąć razem z atkStatBonus/bonuses.atk,
    // tak samo jak rośnie realny cios gracza (computeDamage bierze te same argumenty).
    const invested: Bonuses = { atk: 0.20, dodge: 0.10, crit: 0.05, energyMult: 0 };
    expect(questBossHpFor(50, 20, invested)).toBeGreaterThan(questBossHpFor(0, 20, ZERO));
  });

  test('nagroda za wygraną walkę jest WYŻSZA niż bazowa stawka questu (user: "dają więcej monet i XP")', () => {
    expect(questFightCoins(10)).toBeGreaterThan(10);
    expect(questFightXp(20)).toBeGreaterThan(20);
    expect(FIGHT_BONUS).toBeGreaterThan(1);
  });
});

describe('minibosses — minibossAsBoss (kształt gotowy do simulateFight)', () => {
  test('HP w Boss-obiekcie zgodne z questBossHpFor na danych argumentach', () => {
    const mb = MINIBOSSES[0];
    const boss = minibossAsBoss(mb, 10, 5, ZERO);
    expect(boss.hp).toBe(questBossHpFor(10, 5, ZERO));
    expect(boss.id).toBe(mb.id);
    expect(boss.name).toBe(mb.name);
  });
});
