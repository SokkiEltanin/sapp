import { computeBoxStats } from '@/utils/boxStatsAnalysis';
import { BoxOpenEvent } from '@/store/boxStatsStore';

// computeBoxStats agreguje log otwarć skrzynek (2026-09-15, patrz NEXT_STEPS.md) — testy
// pilnują dwóch rzeczy, które łatwo zepsuć: (1) darmowa Skrzynka dnia i płatna Drewniana
// skrzynka DZIELĄ TEN SAM BoxId ('sardine') w petBoxes.ts, więc grupowanie musi je
// rozdzielić po `daily`, inaczej ich koszt/zysk by się zmieszał; (2) netCoins = suma monet
// wygranych minus suma zapłacona, per grupa, nie globalnie.
function ev(partial: Partial<BoxOpenEvent>): BoxOpenEvent {
  return { at: Date.now(), boxId: 'sardine', daily: false, cost: 35, rewardType: 'coins', ...partial };
}

describe('computeBoxStats', () => {
  test('rozdziela darmową Skrzynkę dnia od płatnej Drewnianej (ten sam boxId)', () => {
    const events = [
      ev({ daily: false, cost: 35, rewardType: 'coins', coins: 60, rarity: 'basic' }),
      ev({ daily: true, cost: 0, rewardType: 'coins', coins: 10, rarity: 'basic' }),
    ];
    const groups = computeBoxStats(events);
    expect(groups).toHaveLength(2);
    const paid = groups.find(g => !g.daily)!;
    const daily = groups.find(g => g.daily)!;
    expect(paid.opens).toBe(1);
    expect(daily.opens).toBe(1);
    expect(paid.totalCost).toBe(35);
    expect(daily.totalCost).toBe(0);
  });

  test('netCoins = suma wygranych monet minus suma wydanych, per grupa', () => {
    const events = [
      ev({ rewardType: 'coins', coins: 60, rarity: 'basic' }),
      ev({ rewardType: 'coins', coins: 40, rarity: 'legendary' }),
      ev({ rewardType: 'gear', coins: undefined, rarity: 'epic' }),
    ];
    const groups = computeBoxStats(events);
    expect(groups).toHaveLength(1);
    const g = groups[0];
    expect(g.opens).toBe(3);
    expect(g.totalCost).toBe(105);
    expect(g.totalCoinsWon).toBe(100);
    expect(g.netCoins).toBe(100 - 105);
    expect(g.coinsOpens).toBe(2);
    expect(g.gearOpens).toBe(1);
  });

  test('rozkład rzadkości nagród monetowych — basic vs legendary (jackpot)', () => {
    const events = [
      ev({ rewardType: 'coins', coins: 60, rarity: 'basic' }),
      ev({ rewardType: 'coins', coins: 80, rarity: 'basic' }),
      ev({ rewardType: 'coins', coins: 40, rarity: 'legendary' }),
    ];
    const [g] = computeBoxStats(events);
    const basic = g.coinRarityBreakdown.find(r => r.rarity === 'basic')!;
    const legendary = g.coinRarityBreakdown.find(r => r.rarity === 'legendary')!;
    expect(basic.count).toBe(2);
    expect(basic.avgCoins).toBe(70);
    expect(legendary.count).toBe(1);
    expect(legendary.avgCoins).toBe(40);
  });

  test('pusty log → pusta lista grup', () => {
    expect(computeBoxStats([])).toEqual([]);
  });
});
