import { BoxOpenEvent } from '@/store/boxStatsStore';
import { BoxId, BOX_RANK } from '@/utils/petBoxes';
import { gearById, gearSellValue, GearRarity } from '@/utils/gear';

// Agregacja logu otwarć skrzynek (boxStatsStore.ts) do statystyk per typ skrzynki —
// procent dropów wg typu/rzadkości + zysk/strata w monetach. Czysto obliczeniowe, nic tu
// nie zmienia żadnej wartości ekonomii z petBoxes.ts, tylko liczy co faktycznie wypadło.
export interface RarityCount {
  rarity: string;
  count: number;
  pct: number; // 0-100, względem WSZYSTKICH otwarć tej skrzynki (nie tylko tego typu nagrody)
  avgCoins?: number; // gdy to rarity monetowej nagrody (coins)
}

export interface BoxTypeStats {
  boxId: BoxId;
  daily: boolean;
  opens: number;
  totalCost: number;
  totalCoinsWon: number;
  netCoins: number; // totalCoinsWon - totalCost — TYLKO surowe monety, bez wartości dropniętego ekwipunku
  // Potencjał (2026-10-12, user: "musze widzieć czy skrzynka jest opłacalna jak kupię za 35 a
  // dropnę item wart 69 to jestem na plusie, nie na minusie, bo mam potencjał") — `netCoins`
  // wyżej liczył SAME monety z nagród typu 'coins', ignorując że dropnięty ekwipunek też ma
  // realną wartość (dokładnie tę, za którą dałoby się go sprzedać — ten sam `gearSellValue`
  // co przycisk "Sprzedaj" na odsłonie skrzynki). `totalGearSellValue` sumuje tę potencjalną
  // wartość WSZYSTKICH dropów ekwipunku (niezależnie czy user faktycznie je sprzedał, czy
  // założył — "potencjał" to wartość W MOMENCIE dropu, nie to co user z nią później zrobił).
  // `totalPotentialCoins`/`netPotential` to WŁAŚCIWA miara opłacalności skrzynki.
  totalGearSellValue: number;
  totalPotentialCoins: number; // totalCoinsWon + totalGearSellValue
  netPotential: number; // totalPotentialCoins - totalCost — dodatnie = skrzynka realnie się opłaca
  coinsOpens: number;
  gearOpens: number;
  combatItemOpens: number;
  coinsPct: number;
  gearPct: number;
  combatItemPct: number;
  coinRarityBreakdown: RarityCount[]; // np. basic vs legendary (jackpot) w obrębie nagród monetowych
  gearRarityBreakdown: RarityCount[]; // common/rare/epic/legendary/mythic
}

function groupKey(boxId: BoxId, daily: boolean): string {
  return `${daily ? 'daily' : 'paid'}:${boxId}`;
}

export function computeBoxStats(events: BoxOpenEvent[]): BoxTypeStats[] {
  const groups = new Map<string, BoxOpenEvent[]>();
  for (const e of events) {
    const key = groupKey(e.boxId, e.daily);
    const arr = groups.get(key);
    if (arr) arr.push(e);
    else groups.set(key, [e]);
  }

  const result: BoxTypeStats[] = [];
  for (const [, evs] of groups) {
    const { boxId, daily } = evs[0];
    const opens = evs.length;
    const totalCost = evs.reduce((sum, e) => sum + e.cost, 0);
    const coinEvs = evs.filter(e => e.rewardType === 'coins');
    const gearEvs = evs.filter(e => e.rewardType === 'gear');
    const combatItemEvs = evs.filter(e => e.rewardType === 'combatItem');
    const totalCoinsWon = coinEvs.reduce((sum, e) => sum + (e.coins ?? 0), 0);

    const coinRarityMap = new Map<string, { count: number; coins: number }>();
    for (const e of coinEvs) {
      const r = e.rarity ?? 'basic';
      const prev = coinRarityMap.get(r) ?? { count: 0, coins: 0 };
      coinRarityMap.set(r, { count: prev.count + 1, coins: prev.coins + (e.coins ?? 0) });
    }
    const coinRarityBreakdown: RarityCount[] = [...coinRarityMap.entries()]
      .map(([rarity, v]) => ({ rarity, count: v.count, pct: (v.count / opens) * 100, avgCoins: v.coins / v.count }))
      .sort((a, b) => b.count - a.count);

    const gearRarityMap = new Map<string, number>();
    // Potencjalna wartość WSZYSTKICH dropów ekwipunku (patrz komentarz przy `totalGearSellValue`
    // w interfejsie) — `gearSellValue` zależy TYLKO od tieru itemu (unlockLevel) i rzadkości,
    // nie od konkretnego rolla statu, więc nie trzeba było logować `value` w BoxOpenEvent,
    // wystarczy `itemId`+`rarity`. Starsze wpisy sprzed 2026-10-12 nie mają `itemId` (jeszcze
    // nie logowanego) — liczą się jako 0 potencjału, nie crashują (graceful degradation na
    // historycznym logu, nie da się go dociągnąć wstecz bez tej informacji).
    let totalGearSellValue = 0;
    for (const e of gearEvs) {
      const r = e.rarity ?? 'common';
      gearRarityMap.set(r, (gearRarityMap.get(r) ?? 0) + 1);
      const item = e.itemId ? gearById(e.itemId) : undefined;
      if (item) totalGearSellValue += gearSellValue(item, r as GearRarity);
    }
    const gearRarityBreakdown: RarityCount[] = [...gearRarityMap.entries()]
      .map(([rarity, count]) => ({ rarity, count, pct: (count / opens) * 100 }))
      .sort((a, b) => b.count - a.count);

    const totalPotentialCoins = totalCoinsWon + totalGearSellValue;

    result.push({
      boxId, daily, opens, totalCost, totalCoinsWon, netCoins: totalCoinsWon - totalCost,
      totalGearSellValue, totalPotentialCoins, netPotential: totalPotentialCoins - totalCost,
      coinsOpens: coinEvs.length, gearOpens: gearEvs.length, combatItemOpens: combatItemEvs.length,
      coinsPct: (coinEvs.length / opens) * 100, gearPct: (gearEvs.length / opens) * 100, combatItemPct: (combatItemEvs.length / opens) * 100,
      coinRarityBreakdown, gearRarityBreakdown,
    });
  }

  return result.sort((a, b) => {
    if (a.daily !== b.daily) return a.daily ? 1 : -1; // płatne skrzynki przed darmową
    return BOX_RANK[a.boxId] - BOX_RANK[b.boxId];
  });
}
