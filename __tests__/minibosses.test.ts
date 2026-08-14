import {
  minibossForQuest, minibossAsBoss, questBossHpFor, questFightCoins, questFightXp,
  FIGHT_BONUS, MINIBOSSES,
} from '@/utils/minibosses';

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
    expect(questBossHpFor(20)).toBeGreaterThan(questBossHpFor(1));
  });

  test('nagroda za wygraną walkę jest WYŻSZA niż bazowa stawka questu (user: "dają więcej monet i XP")', () => {
    expect(questFightCoins(10)).toBeGreaterThan(10);
    expect(questFightXp(20)).toBeGreaterThan(20);
    expect(FIGHT_BONUS).toBeGreaterThan(1);
  });
});

describe('minibosses — minibossAsBoss (kształt gotowy do simulateFight)', () => {
  test('HP w Boss-obiekcie zgodne z questBossHpFor na danym poziomie', () => {
    const mb = MINIBOSSES[0];
    const boss = minibossAsBoss(mb, 5);
    expect(boss.hp).toBe(questBossHpFor(5));
    expect(boss.id).toBe(mb.id);
    expect(boss.name).toBe(mb.name);
  });
});
