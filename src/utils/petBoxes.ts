// Skrzynki z losowaniem (gacha) do sklepu pupila. Kupujesz za monety, otwierasz i
// dostajesz LOSOWĄ nagrodę: kolor futra (im rzadszy tym mniejsza szansa), monety, albo
// zamrożenie serii. Droższa skrzynka = lepsze szanse na rzadkie kolory.
import { CrateTier } from '@/utils/crates';
import { CosmeticTier, ShopColor } from '@/utils/petShop';
import { STARTUPS } from '@/utils/petStartups';

export type BoxId = 'sardine' | 'silver' | 'gold';

export interface LootBox {
  id: BoxId;
  name: string;
  cost: number;
  color: string;   // akcent skrzynki
  emoji: string;
  blurb: string;
  colorChance: number;   // szansa że nagrodą jest KOLOR
  startupChance?: number; // szansa na STARTUP (kosmetyk splasha); tylko lepsze skrzynki
  freezeChance: number;  // szansa na zamrożenie (reszta = monety)
  tierWeight: Record<CosmeticTier, number>;   // wagi losowania koloru wg rzadkości
  coins: { min: number; max: number; jackpot: number; jackpotChance: number };
}

export const LOOT_BOXES: LootBox[] = [
  {
    id: 'sardine', name: 'Skrzynka sardynkowa', cost: 35, color: '#9AA6B2', emoji: '🐟',
    blurb: 'Tania — głównie monety, czasem zwykły kolor',
    colorChance: 0.25, freezeChance: 0.05,
    tierWeight: { basic: 8, rare: 2, epic: 0.4 },
    coins: { min: 3, max: 12, jackpot: 40, jackpotChance: 0.03 },
  },
  {
    id: 'silver', name: 'Srebrna skrzynka', cost: 90, color: '#4DA8FF', emoji: '🥈',
    blurb: 'Lepsze szanse na rzadki kolor, startup + zamrożenie',
    colorChance: 0.38, startupChance: 0.10, freezeChance: 0.14,
    tierWeight: { basic: 4, rare: 4, epic: 1.5 },
    coins: { min: 10, max: 30, jackpot: 90, jackpotChance: 0.04 },
  },
  {
    id: 'gold', name: 'Złota skrzynka', cost: 200, color: '#FBBF24', emoji: '🥇',
    blurb: 'Najlepsze szanse — epicki kolor lub startup',
    colorChance: 0.48, startupChance: 0.16, freezeChance: 0.18,
    tierWeight: { basic: 2, rare: 4, epic: 4.5 },
    coins: { min: 25, max: 70, jackpot: 200, jackpotChance: 0.05 },
  },
];

export function boxById(id: BoxId): LootBox {
  return LOOT_BOXES.find(b => b.id === id) ?? LOOT_BOXES[0];
}

// Darmowa SKRZYNKA DNIA — raz dziennie, za 0 monet (nowe główne źródło monet). Głównie
// monety, mała szansa na nieposiadany kolor lub zamrożenie. NIE w LOOT_BOXES — nie jest
// na sprzedaż; odbierasz ją z hero na górze sklepu. Losowana tym samym rollBox.
export const DAILY_BOX: LootBox = {
  id: 'sardine', name: 'Skrzynka dnia', cost: 0, color: '#FBBF24', emoji: '🎁',
  blurb: 'Za darmo, raz dziennie',
  colorChance: 0.10, freezeChance: 0.10,
  tierWeight: { basic: 9, rare: 2, epic: 0.3 },
  coins: { min: 6, max: 20, jackpot: 60, jackpotChance: 0.06 },
};

export type BoxReward =
  | { type: 'color'; colorId: string; name: string; swatch: string; rarity: CrateTier }
  | { type: 'startup'; startupId: string; name: string; ink: string; rarity: CrateTier }
  | { type: 'coins'; coins: number; rarity: CrateTier }
  | { type: 'freeze'; count: number; rarity: CrateTier };

// Kolor mapuje na „mocniejszą" celebrację niż jego tier sklepowy (zdobycie koloru = święto).
const COLOR_RARITY: Record<CosmeticTier, CrateTier> = { basic: 'rare', rare: 'epic', epic: 'mythic' };

function pickWeighted<T>(items: { item: T; w: number }[]): T | null {
  const total = items.reduce((s, x) => s + Math.max(0, x.w), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const x of items) { r -= Math.max(0, x.w); if (r <= 0) return x.item; }
  return items[items.length - 1].item;
}

// Wylosuj nagrodę. ownedIds = już posiadane (kolory, których nie wylosujemy ponownie).
export function rollBox(box: LootBox, colors: ShopColor[], ownedIds: string[]): BoxReward {
  const owned = new Set(ownedIds);
  const unowned = colors.filter(c => c.cost > 0 && !owned.has(c.id));
  const unownedStartups = STARTUPS.filter(su => su.cost > 0 && !owned.has(`startup:${su.id}`));
  const r = Math.random();
  const colorCut = box.colorChance;
  const startupCut = colorCut + (box.startupChance ?? 0);
  const freezeCut = startupCut + box.freezeChance;
  // 1) KOLOR (jeśli jest jeszcze jakiś nieposiadany) — ważony rzadkością
  if (r < colorCut && unowned.length > 0) {
    const pick = pickWeighted(unowned.map(c => ({ item: c, w: box.tierWeight[c.tier] ?? 0 })));
    if (pick) return { type: 'color', colorId: pick.id, name: pick.name, swatch: pick.palette.coat, rarity: COLOR_RARITY[pick.tier] };
  }
  // 2) STARTUP (kosmetyk splasha; rzadszy = trudniej — ta sama waga tierów co kolory)
  if (r < startupCut && unownedStartups.length > 0) {
    const pick = pickWeighted(unownedStartups.map(su => ({ item: su, w: box.tierWeight[su.tier] ?? 0 })));
    if (pick) return { type: 'startup', startupId: pick.id, name: pick.name, ink: pick.ink, rarity: COLOR_RARITY[pick.tier] };
  }
  // 3) ZAMROŻENIE
  if (r < freezeCut) {
    return { type: 'freeze', count: 1, rarity: box.id === 'gold' ? 'epic' : 'rare' };
  }
  // 4) MONETY (rzadki jackpot = mityczny)
  const jackpot = Math.random() < box.coins.jackpotChance;
  const coins = jackpot ? box.coins.jackpot : box.coins.min + Math.floor(Math.random() * (box.coins.max - box.coins.min + 1));
  return { type: 'coins', coins, rarity: jackpot ? 'mythic' : 'basic' };
}
