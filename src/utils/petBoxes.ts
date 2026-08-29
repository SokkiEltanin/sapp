// Skrzynki z losowaniem (gacha) do sklepu pupila. Kupujesz za monety, otwierasz i
// dostajesz LOSOWĄ nagrodę: kolor futra (im rzadszy tym mniejsza szansa), monety, albo
// zamrożenie serii. Droższa skrzynka = lepsze szanse na rzadkie kolory.
import { CrateTier } from '@/utils/crates';
import { CosmeticTier, ShopColor } from '@/utils/petShop';
import { STARTUPS } from '@/utils/petStartups';
import { GearRarity, unlockedGearFor, GEAR_SLOTS } from '@/utils/gear';
import { CombatItemId, COMBAT_ITEMS } from '@/utils/combatItems';

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
  freezeChance: number;  // szansa na zamrożenie
  gearChance: number;    // szansa na item EKWIPUNKU (reszta = monety)
  gearRarityWeight: Record<GearRarity, number>;   // wagi losowania rzadkości itemu ekwipunku
  tierWeight: Record<CosmeticTier, number>;   // wagi losowania koloru wg rzadkości
  combatItemChance?: number; // szansa na PERK BOSSA (patrz komentarz przy LOOT_BOXES) — brak/0 = niedostępne (DAILY_BOX)
  coins: { min: number; max: number; jackpot: number; jackpotChance: number };
}

// SYSTEM EKWIPUNKU (2026-08-19) — user: "skrzynki są 3 drewniana, srebrna, złota [tu
// jedyne co się różni to szansa na lepsze statystyki]". To DOKŁADNIE te same 3 skrzynki co
// już były w sklepie (id zostają sardine/silver/gold żeby nie migrować zapisanych danych —
// zmienia się tylko wyświetlana `name`), rozszerzone o `gearChance`/`gearRarityWeight`.
// Cosmetics (colorChance/startupChance) ZOSTAJĄ bez zmian — user przenosi tylko RĘCZNE
// kupno kolorów z shopu do modala imienia, skrzynki nadal mogą je losowo dawać jako bonus.
//
// PERKI BOSSÓW ze skrzynek kupowanych + monety wg kosztu skrzynki (2026-08-29) — user: "te
// itemy bossów co miały być te pierwsze pierwsze co są w assets/itemybossy to wgle ich nie da
// się dropnąć... to są bardziej UMIEJĘTNOŚCI. te kupowane skrzynki zrobiłbym tak że można
// dropnąć BASIC ITEMY > STREAK FREEZE > COINY 50-300% skrzynki > i TE ITEMY BOSSÓW". Do teraz
// `rollBox()` (ta funkcja, wołana przez skrzynki SKLEPOWE) w ogóle nie miała gałęzi dla
// itemów bojowych — jedyna dropowalna ścieżka była w petStore.ts's `openCrate()` (osobna,
// DARMOWA skrzynka z głaskania kotka) i `menaceClaim()` (pokonanie nemesis). Nowe
// `combatItemChance` to NAJRZADSZA z czterech kategorii w każdej skrzynce — celowo mniejsze
// niż `freezeChance` w KAŻDEJ z trzech (0.02<0.05, 0.05<0.10, 0.08<0.10), które z kolei są
// mniejsze niż `gearChance` — realizuje dokładnie żądaną kolejność BASIC ITEMY > STREAK
// FREEZE > ... > PERKI. Monety: `coins.min/max` zmienione z płaskich zakresów (był
// 3-12/10-30/25-70 — realnie 8-34% kosztu skrzynki) na DOKŁADNIE 50%-300% WŁASNEGO kosztu
// skrzynki, jak zażądano — `rollBox()`'s logika monet (na samym dole funkcji) NIE zmienia się,
// czyta te same pola, więc to czysto zmiana DANYCH. DAILY_BOX (cost=0, darmowa) zostaje przy
// starych stałych wartościach i BEZ combatItemChance — user mówił wyraźnie o „skrzynkach
// kupowanych", procent-od-kosztu nie miałby sensu przy koszcie 0.
export const LOOT_BOXES: LootBox[] = [
  {
    id: 'sardine', name: 'Drewniana skrzynka', cost: 35, color: '#9AA6B2', emoji: '🪵',
    blurb: 'Tania — głównie monety, czasem zwykły kolor lub item ekwipunku',
    colorChance: 0.20, freezeChance: 0.05, gearChance: 0.15, combatItemChance: 0.02,
    tierWeight: { basic: 8, rare: 2, epic: 0.4 },
    gearRarityWeight: { common: 70, rare: 25, epic: 4, legendary: 0.9, mythic: 0.1 },
    coins: { min: 18, max: 105, jackpot: 40, jackpotChance: 0.03 },
  },
  {
    id: 'silver', name: 'Srebrna skrzynka', cost: 90, color: '#4DA8FF', emoji: '🥈',
    blurb: 'Lepsze szanse na rzadki kolor, item ekwipunku, startup + zamrożenie',
    colorChance: 0.28, startupChance: 0.10, freezeChance: 0.10, gearChance: 0.28, combatItemChance: 0.05,
    tierWeight: { basic: 4, rare: 4, epic: 1.5 },
    gearRarityWeight: { common: 40, rare: 35, epic: 18, legendary: 6, mythic: 1 },
    coins: { min: 45, max: 270, jackpot: 90, jackpotChance: 0.04 },
  },
  {
    id: 'gold', name: 'Złota skrzynka', cost: 200, color: '#FBBF24', emoji: '🥇',
    blurb: 'Najlepsze szanse — epicki kolor, wysokiej rzadkości ekwipunek lub startup',
    colorChance: 0.32, startupChance: 0.16, freezeChance: 0.10, gearChance: 0.38, combatItemChance: 0.08,
    tierWeight: { basic: 2, rare: 4, epic: 4.5 },
    gearRarityWeight: { common: 15, rare: 30, epic: 30, legendary: 18, mythic: 7 },
    coins: { min: 100, max: 600, jackpot: 200, jackpotChance: 0.05 },
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
  colorChance: 0.10, freezeChance: 0.08, gearChance: 0.10,
  tierWeight: { basic: 9, rare: 2, epic: 0.3 },
  gearRarityWeight: { common: 75, rare: 20, epic: 4, legendary: 0.9, mythic: 0.1 },
  coins: { min: 6, max: 20, jackpot: 60, jackpotChance: 0.06 },
};

export type BoxReward =
  | { type: 'color'; colorId: string; name: string; swatch: string; rarity: CrateTier }
  | { type: 'startup'; startupId: string; name: string; ink: string; rarity: CrateTier }
  | { type: 'coins'; coins: number; rarity: CrateTier }
  | { type: 'freeze'; count: number; rarity: CrateTier }
  | { type: 'gear'; itemId: string; name: string; slot: string; rarity: GearRarity }
  | { type: 'combatItem'; itemId: CombatItemId; name: string; level: number; isUpgrade: boolean; rarity: CrateTier };

// Kolor mapuje na „mocniejszą" celebrację niż jego tier sklepowy (zdobycie koloru = święto).
const COLOR_RARITY: Record<CosmeticTier, CrateTier> = { basic: 'rare', rare: 'epic', epic: 'legendary' };

// Eksportowane (2026-08-20) — petStore.ts's openCrate() reużywa tego samego ważonego losowania
// dla itemów ekwipunku ze skrzynki sardynek (patrz komentarz przy `gearDropped` tam).
export function pickWeighted<T>(items: { item: T; w: number }[]): T | null {
  const total = items.reduce((s, x) => s + Math.max(0, x.w), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const x of items) { r -= Math.max(0, x.w); if (r <= 0) return x.item; }
  return items[items.length - 1].item;
}

// Wylosuj nagrodę. ownedIds = już posiadane (kolory, których nie wylosujemy ponownie).
// `level` = poziom pupila, ogranicza pulę itemów ekwipunku do odblokowanych (unlockLevel).
// `ownedCombatItems` (2026-08-29) = posiadane perki bossów wg poziomu — decyduje, czy trafienie
// w strefę `combatItemChance` da NOWY perk czy ULEPSZENIE już posiadanego (patrz niżej).
export function rollBox(
  box: LootBox, colors: ShopColor[], ownedIds: string[], level: number,
  ownedCombatItems: Partial<Record<CombatItemId, number>> = {},
): BoxReward {
  const owned = new Set(ownedIds);
  const unowned = colors.filter(c => c.cost > 0 && !owned.has(c.id));
  const unownedStartups = STARTUPS.filter(su => su.cost > 0 && !owned.has(`startup:${su.id}`));
  const r = Math.random();
  const colorCut = box.colorChance;
  const startupCut = colorCut + (box.startupChance ?? 0);
  const freezeCut = startupCut + box.freezeChance;
  const gearCut = freezeCut + box.gearChance;
  const combatItemCut = gearCut + (box.combatItemChance ?? 0);
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
  // 4) EKWIPUNEK (dowolny slot, tylko odblokowane wg poziomu; rzadkość ważona wg skrzynki)
  if (r < gearCut) {
    const unlocked = GEAR_SLOTS.flatMap(slot => unlockedGearFor(slot, level));
    if (unlocked.length > 0) {
      const item = unlocked[Math.floor(Math.random() * unlocked.length)];
      const rarity = pickWeighted((Object.keys(box.gearRarityWeight) as GearRarity[]).map(g => ({ item: g, w: box.gearRarityWeight[g] })));
      if (rarity) return { type: 'gear', itemId: item.id, name: item.name, slot: item.slot, rarity };
    }
  }
  // 5) PERKI BOSSÓW (itemy z assets/itemybossy — user: "to ogólnie nie są itemy tylko bardziej
  // UMIEJĘTNOŚCI"). Najrzadsza kategoria celowo (`combatItemChance` < `freezeChance` w każdej
  // skrzynce, patrz komentarz przy LOOT_BOXES). Niższe skrzynki (sardine/silver) dają TYLKO
  // nowy nieposiadany perk na poziomie 1 — ten sam "najsłabsze na niższych" wzorzec co
  // `COMBAT_ITEM_DROP_CHANCE_BY_TIER` w crates.ts; gold PREFERUJE ulepszenie już posiadanego
  // perku (jeśli masz cokolwiek jeszcze nie na max poziomie), nowy perk to tam fallback — jak
  // `openCrate()` w petStore.ts dla NIEZALEŻNEJ, drugiej ścieżki dropu tych samych itemów.
  // Gdy nic nie da się przyznać (np. wszystko już posiadane i na maksie) — brak `return`,
  // spada do monet niżej, tak jak gałąź ekwipunku wyżej w tej samej sytuacji.
  if (r < combatItemCut) {
    const preferUpgrade = box.id === 'gold';
    const upgradeable = (Object.keys(ownedCombatItems) as CombatItemId[])
      .filter(id => (ownedCombatItems[id] ?? 0) < COMBAT_ITEMS[id].maxLevel);
    const perkRarity: CrateTier = box.id === 'gold' ? 'legendary' : box.id === 'silver' ? 'epic' : 'rare';
    if (preferUpgrade && upgradeable.length > 0) {
      const id = upgradeable[Math.floor(Math.random() * upgradeable.length)];
      const nextLevel = (ownedCombatItems[id] ?? 0) + 1;
      return { type: 'combatItem', itemId: id, name: COMBAT_ITEMS[id].name, level: nextLevel, isUpgrade: true, rarity: perkRarity };
    }
    const candidates = (Object.keys(COMBAT_ITEMS) as CombatItemId[]).filter(id => !ownedCombatItems[id]);
    if (candidates.length > 0) {
      const id = candidates[Math.floor(Math.random() * candidates.length)];
      return { type: 'combatItem', itemId: id, name: COMBAT_ITEMS[id].name, level: 1, isUpgrade: false, rarity: perkRarity };
    }
  }
  // 4) MONETY (rzadki jackpot = mityczny)
  const jackpot = Math.random() < box.coins.jackpotChance;
  const coins = jackpot ? box.coins.jackpot : box.coins.min + Math.floor(Math.random() * (box.coins.max - box.coins.min + 1));
  return { type: 'coins', coins, rarity: jackpot ? 'legendary' : 'basic' };
}
