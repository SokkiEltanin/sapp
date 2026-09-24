// Skrzynki z losowaniem (gacha) do sklepu pupila. Kupujesz za monety, otwierasz i
// dostajesz LOSOWĄ nagrodę: item ekwipunku, "umiejętność" (perk bossa), albo monety.
// Droższa skrzynka = lepsze szanse na rzadkie/wysokopoziomowe itemy.
//
// 2026-09-11, user: "ze skrzynek na rynku wywalmy zamrożenie serii oraz kolory i startupy,
// zostaje sam ekwipunek do dropnięcia oraz te ulepszenia ogólne" — kolor futra/startup/
// zamrożenie serii USUNIĘTE z puli dropów skrzynek KUPOWANYCH (`LOOT_BOXES`) i skrzynki dnia
// (`DAILY_BOX`) — to jedyne dwa miejsca wołające `rollBox()` niżej. Kolory/startupy nadal
// kupuje się WPROST (za monety, patrz `PetCustomizeModal`) — to inna, niezmieniona ścieżka;
// zamrożenie serii nie ma już ŻADNEGO źródła w grze (był tylko tutaj) — jeśli user zechce je
// z powrotem, potrzebny nowy, osobny sposób zdobycia. `gearChance` KAŻDEJ skrzynki podniesiona
// o dokładnie tyle, ile zabrały usunięte kategorie (colorChance+startupChance+freezeChance) —
// zachowuje identyczną CAŁKOWITĄ szansę "coś ciekawego wypadło" co przed zmianą, tylko całość
// idzie teraz w ekwipunek zamiast być dzielona z usuniętymi kategoriami; `combatItemChance`
// (umiejętności/"ulepszenia ogólne") ZOSTAJE bez zmian — to świadomie najrzadsza kategoria,
// niezależna od tej korekty.
import { CrateTier } from '@/utils/crates';
import { GearRarity, unlockedGearFor, GEAR_SLOTS, rollGearValue, TIER_LEVELS } from '@/utils/gear';
import { CombatItemId, COMBAT_ITEMS } from '@/utils/combatItems';

export type BoxId = 'sardine' | 'iron' | 'gold' | 'divine';

// Grafiki slotów skrzynek na Rynku (2026-09-09, user dostarczył — "dodałem CI skrzynki
// grafiki: assets/chests/skrzynka_zlota.png itp, dodaj je do rynku naszego"). Oryginały
// 1536×1024 (ChatGPT-owy rozmiar, ~1.5-2.4MB/szt) przeskalowane do 300×200 (ten sam docelowy
// rozmiar co reszta ikon-slotów w `assets/ekwipunek/`, PIL LANCZOS) — ~70-110KB/szt.
export const BOX_ICON: Record<BoxId, any> = {
  sardine: require('../../assets/chests/skrzynka_drewniana.png'),
  iron: require('../../assets/chests/skrzynka_zelazna.png'),
  gold: require('../../assets/chests/skrzynka_zlota.png'),
  divine: require('../../assets/chests/skrzynka_boska.png'),
};

// Grafika Skrzynki dnia (2026-09-11, user: "wrzuciłem ci tam jeszcze daily skrzynkę" —
// `assets/chests/chest_daily.png`, ten sam ChatGPT-owy rozmiar 1536×1024 co reszta,
// przeskalowane tym samym przepisem PIL LANCZOS do 300×200). Osobna stała, bo `DAILY_BOX`
// NIE jest w `LOOT_BOXES`/`BOX_ICON` (nie jest na sprzedaż, patrz komentarz przy `DAILY_BOX`).
export const DAILY_BOX_ICON = require('../../assets/chests/chest_daily.png');

// Ranga skrzynki (0 = najtańsza, rośnie w górę) — zastępuje twarde porównania `box.id ===
// 'gold'` rozsiane po `rollBox()` (2026-09-08, dodanie 4. tieru "Boska" — user: "miała być
// ta nowa, DREWNIANA, ZELAZNA, ZLOTA, BOSKA"). Gdyby kiedyś doszedł 5. tier, wystarczy dopisać
// go tutaj — logika niżej porównuje RANGI, nie konkretne id.
export const BOX_RANK: Record<BoxId, number> = { sardine: 0, iron: 1, gold: 2, divine: 3 };

// Przebalans ekonomii skrzynek (2026-09-22) — user przysłał realne statystyki: drewniana
// (najtańsza) wychodziła cały czas mocno na plus (ROI liczone z wartością odsprzedaży
// dropniętego ekwipunku, nie tylko surowych monet z ekranu statystyk, ~120-200%+), a boska
// (najdroższa) NIGDY nie dawała monet — prawdziwy bug: `gearChance + combatItemChance` dla
// gold (0.96+0.08=1.04) i divine (0.92+0.16=1.08) PRZEKRACZAŁO 100%, więc `rollBox()`'owy
// branch monet niżej był matematycznie nieosiągalny (los 0-1 zawsze łapał się w
// ekwipunek/umiejętność zanim dotarł do monet) — potwierdzone realnymi danymi usera (40
// otwarć boskiej, dokładnie 0% monet). Korzeń DRUGIEGO problemu (drewniana zbyt op): pula
// itemów do wylosowania w `rollBox()` była capowana WYŁĄCZNIE poziomem gracza
// (`unlockedGearFor(slot, level)`), NIE tierem skrzynki — przy wysokim poziomie pupila tania
// skrzynka miała dokładnie ten sam dostęp do itemów co droga, różniły się tylko WAGI
// rzadkości (i to niewiele: śr. mnożnik rzadkości drewniana ×1.2 → boska ×2.6, ledwie 2.1×
// różnicy), podczas gdy cena rosła 35→450 (12.9× różnicy) — płacenie więcej dawało
// nieproporcjonalnie mało.
//
// Fix: (1) `gearChance`/`combatItemChance` przycięte tak, żeby suma zawsze < 1 (monety
// realnie osiągalne we WSZYSTKICH skrzynkach); (2) `BOX_MAX_GEAR_TIER` niżej — PRAWDZIWY cap
// puli itemów per skrzynka (nie tylko poziom gracza), więc drewniana/żelazna fizycznie nie
// mogą wylosować topowych tierów niezależnie jak wysoko jest gracz; (3) zasięg monet
// drewnianej przycięty (była najbardziej dysproporcjonalna). Reszta zakresów monet
// (iron/gold/divine) BEZ ZMIAN — to było zawsze poprawnie zaprojektowane (50-300% własnego
// kosztu), tylko nieosiągalne przez bug wyżej. Zweryfikowane node'ową symulacją EV (coins
// branch + gear branch przez `gearSellValue`) na reprezentatywnych poziomach gracza przed
// wdrożeniem — drewniana spadła z ~120-200%+ ROI do ~90-105% (break-even, zgodnie z
// życzeniem usera), reszta rośnie w górę bez skoku do zera przy boskiej.
export const BOX_MAX_GEAR_TIER: Record<BoxId, number> = { sardine: 1, iron: 2, gold: 3, divine: 4 };

export interface LootBox {
  id: BoxId;
  name: string;
  cost: number;
  color: string;   // akcent skrzynki
  emoji: string;
  icon?: any;       // opcjonalna grafika slotu (Rynek) — brak = `emoji` jako fallback (DAILY_BOX)
  blurb: string;
  gearChance: number;    // szansa na item EKWIPUNKU (reszta = monety)
  gearRarityWeight: Record<GearRarity, number>;   // wagi losowania rzadkości itemu ekwipunku
  combatItemChance?: number; // szansa na "umiejętność"/PERK BOSSA (patrz komentarz przy LOOT_BOXES) — brak/0 = niedostępne (DAILY_BOX)
  coins: { min: number; max: number; jackpot: number; jackpotChance: number };
}

// SYSTEM EKWIPUNKU (2026-08-19) — user: "skrzynki są 3 drewniana, srebrna, złota [tu
// jedyne co się różni to szansa na lepsze statystyki]". To DOKŁADNIE te same 3 skrzynki co
// już były w sklepie (id zostają sardine/silver/gold żeby nie migrować zapisanych danych —
// zmienia się tylko wyświetlana `name`), rozszerzone o `gearChance`/`gearRarityWeight`.
//
// PERKI BOSSÓW ze skrzynek kupowanych + monety wg kosztu skrzynki (2026-08-29) — `rollBox()`
// (ta funkcja, wołana przez skrzynki SKLEPOWE) dostała gałąź dla itemów bojowych/umiejętności
// obok istniejącej ścieżki w `openCrate()`/`menaceClaim()` w petStore.ts (NIEZALEŻNA, osobna
// pula, nie ta funkcja). `combatItemChance` to NAJRZADSZA kategoria w każdej skrzynce —
// celowo mniejsza niż `gearChance`. Monety: `coins.min/max` = DOKŁADNIE 50%-300% WŁASNEGO
// kosztu skrzynki.
//
// `gearChance` PODNIESIONA (2026-09-11, patrz komentarz na górze pliku — usunięcie koloru/
// startupu/zamrożenia z puli) o dokładnie tyle, ile te trzy kategorie razem zabierały —
// CAŁKOWITA szansa "coś ciekawego wypadło" (gear+combatItem) per skrzynka jest identyczna jak
// PRZED zmianą, tylko cała idzie teraz w ekwipunek zamiast być dzielona z usuniętymi
// kategoriami. `combatItemChance` NIETKNIĘTA.
export const LOOT_BOXES: LootBox[] = [
  {
    id: 'sardine', name: 'Drewniana skrzynka', cost: 35, color: '#9AA6B2', emoji: '🪵', icon: BOX_ICON.sardine,
    blurb: 'Tania — głównie monety, czasem item ekwipunku',
    // gearChance BEZ ZMIAN (nigdy nie było buga tutaj — suma z combatItemChance zawsze <1).
    // Zasięg monet PRZYCIĘTY (2026-09-22, patrz komentarz przy BOX_MAX_GEAR_TIER wyżej) —
    // było 18-105 (51-300% kosztu), za dużo w połączeniu z niecapowaną wcześniej pulą itemów.
    gearChance: 0.40, combatItemChance: 0.02,
    gearRarityWeight: { common: 70, rare: 25, epic: 4, legendary: 0.9, mythic: 0.1 },
    // jackpot x5 (2026-09-24, user zrzutem: "legendarne dropy muszą byc op bo sa zupełnie
    // rzadkie, a tutaj wychodzę na -5 xddd monet" — dawne 30 przy koszcie 35 było GORSZE niż
    // cena własnej skrzynki nawet przy najrzadszym możliwym trafieniu). 30→150.
    coins: { min: 12, max: 70, jackpot: 150, jackpotChance: 0.02 },
  },
  {
    // Dawniej "silver"/"Srebrna skrzynka" — PRZEMIANOWANA (2026-09-08, user: "miała być ta
    // nowa, DREWNIANA, ZELAZNA, ZLOTA, BOSKA"). `gearChance` PRZYCIĘTE 0.76→0.65 (2026-09-22,
    // patrz komentarz przy BOX_MAX_GEAR_TIER wyżej) — zostawia więcej miejsca na monety, które
    // reszta ekonomii teraz faktycznie potrzebuje (box-tier cap zabrał części dawnej
    // "przewagi" gearChance nad drewnianą). Zasięg monet BEZ ZMIAN.
    id: 'iron', name: 'Żelazna skrzynka', cost: 90, color: '#8A93A8', emoji: '⚙️', icon: BOX_ICON.iron,
    blurb: 'Lepsze szanse na item ekwipunku wyższej rzadkości',
    gearChance: 0.65, combatItemChance: 0.05,
    gearRarityWeight: { common: 40, rare: 35, epic: 18, legendary: 6, mythic: 1 },
    coins: { min: 45, max: 270, jackpot: 450, jackpotChance: 0.04 }, // jackpot x5, patrz sardine
  },
  {
    // `gearChance` PRZYCIĘTE 0.96→0.70 (2026-09-22) — realny BUG: 0.96+combatItemChance(0.08)
    // = 1.04 > 1, więc branch monet w `rollBox()` był matematycznie nieosiągalny (potwierdzone
    // statystykami usera). Zasięg monet BEZ ZMIAN, teraz wreszcie realnie osiągalny.
    id: 'gold', name: 'Złota skrzynka', cost: 200, color: '#FBBF24', emoji: '🥇', icon: BOX_ICON.gold,
    blurb: 'Bardzo dobre szanse — wysokiej rzadkości ekwipunek',
    gearChance: 0.70, combatItemChance: 0.08,
    gearRarityWeight: { common: 15, rare: 30, epic: 30, legendary: 18, mythic: 7 },
    coins: { min: 100, max: 600, jackpot: 1000, jackpotChance: 0.05 }, // jackpot x5, patrz sardine
  },
  {
    // NOWY 4. tier (2026-09-08, user: "miała być ta nowa, DREWNIANA, ZELAZNA, ZLOTA, BOSKA")
    // — najdroższa, najlepsze szanse ze wszystkich. Koszt/monety wg tej samej skali co reszta
    // (50%-300% WŁASNEGO kosztu). `gearChance` PRZYCIĘTE 0.92→0.65 (2026-09-22) — TEN SAM
    // bug co gold, drastyczniejszy (0.92+0.16=1.08>1): user przysłał realne statystyki, 40
    // otwarć boskiej, DOKŁADNIE 0% monet — branch w kodzie był całkowicie nieosiągalny.
    // `combatItemChance` (0.16) teraz wreszcie realnie DWA razy wyższe niż gold (dawniej,
    // przez przepełnienie, efektywnie działało jak ~0.08 — połowa deklarowanej wartości).
    id: 'divine', name: 'Boska skrzynka', cost: 450, color: '#C4B5FD', emoji: '👑', icon: BOX_ICON.divine,
    blurb: 'Absolutny szczyt — mitycznej jakości ekwipunek i umiejętności bossów',
    gearChance: 0.65, combatItemChance: 0.16,
    gearRarityWeight: { common: 5, rare: 20, epic: 30, legendary: 30, mythic: 15 },
    coins: { min: 225, max: 1350, jackpot: 4500, jackpotChance: 0.07 }, // jackpot x5, patrz sardine
  },
];

export function boxById(id: BoxId): LootBox {
  return LOOT_BOXES.find(b => b.id === id) ?? LOOT_BOXES[0];
}

// Darmowa SKRZYNKA DNIA — raz dziennie, za 0 monet (nowe główne źródło monet). Głównie
// monety, mała szansa na item ekwipunku. NIE w LOOT_BOXES — nie jest na sprzedaż; odbierasz
// ją z hero na górze sklepu. Losowana tym samym rollBox. `gearChance` podniesiona (2026-09-11,
// patrz komentarz na górze pliku) z 0.10 do 0.28 — dokładnie o tyle, ile zabierały usunięte
// colorChance(0.10)+freezeChance(0.08).
export const DAILY_BOX: LootBox = {
  id: 'sardine', name: 'Skrzynka dnia', cost: 0, color: '#FBBF24', emoji: '🎁', icon: DAILY_BOX_ICON,
  blurb: 'Za darmo, raz dziennie',
  gearChance: 0.28,
  gearRarityWeight: { common: 75, rare: 20, epic: 4, legendary: 0.9, mythic: 0.1 },
  coins: { min: 6, max: 20, jackpot: 60, jackpotChance: 0.06 },
};

export type BoxReward =
  | { type: 'coins'; coins: number; rarity: CrateTier }
  | { type: 'gear'; itemId: string; name: string; slot: string; rarity: GearRarity; value: number }
  | { type: 'combatItem'; itemId: CombatItemId; name: string; level: number; isUpgrade: boolean; rarity: CrateTier };

// Eksportowane (2026-08-20) — petStore.ts's openCrate() reużywa tego samego ważonego losowania
// dla itemów ekwipunku ze skrzynki sardynek (patrz komentarz przy `gearDropped` tam).
export function pickWeighted<T>(items: { item: T; w: number }[]): T | null {
  const total = items.reduce((s, x) => s + Math.max(0, x.w), 0);
  if (total <= 0) return null;
  let r = Math.random() * total;
  for (const x of items) { r -= Math.max(0, x.w); if (r <= 0) return x.item; }
  return items[items.length - 1].item;
}

// Wylosuj nagrodę. `level` = poziom pupila, ogranicza pulę itemów ekwipunku do odblokowanych
// (unlockLevel) — dodatkowo capowana przez `BOX_MAX_GEAR_TIER` wg TIERU SKRZYNKI (2026-09-22,
// patrz komentarz tam), więc drewniana/żelazna nie mogą wylosować topowych itemów nawet przy
// bardzo wysokim poziomie gracza. `ownedCombatItems` (2026-08-29) = posiadane perki bossów wg
// poziomu — decyduje, czy trafienie w strefę `combatItemChance` da NOWY perk czy ULEPSZENIE
// już posiadanego (patrz niżej).
export function rollBox(
  box: LootBox, level: number,
  ownedCombatItems: Partial<Record<CombatItemId, number>> = {},
): BoxReward {
  const r = Math.random();
  const gearCut = box.gearChance;
  const combatItemCut = gearCut + (box.combatItemChance ?? 0);
  const gearLevelCap = Math.min(level, TIER_LEVELS[BOX_MAX_GEAR_TIER[box.id]]);
  // 1) EKWIPUNEK (dowolny slot, tylko odblokowane wg poziomu ORAZ tieru skrzynki; rzadkość
  // ważona wg skrzynki)
  if (r < gearCut) {
    const unlocked = GEAR_SLOTS.flatMap(slot => unlockedGearFor(slot, gearLevelCap));
    if (unlocked.length > 0) {
      const item = unlocked[Math.floor(Math.random() * unlocked.length)];
      const rarity = pickWeighted((Object.keys(box.gearRarityWeight) as GearRarity[]).map(g => ({ item: g, w: box.gearRarityWeight[g] })));
      // Prawdziwa loteria (skrzynka) → domyślny Math.random w rollGearValue, NIE seedowany
      // jak w Sklepie dnia (2026-08-31, "itemy mogą dropić w przedziałach" — patrz gear.ts).
      if (rarity) return { type: 'gear', itemId: item.id, name: item.name, slot: item.slot, rarity, value: rollGearValue(item, rarity) };
    }
  }
  // 2) PERKI BOSSÓW / "umiejętności" (itemy z assets/itemybossy — user: "to ogólnie nie są
  // itemy tylko bardziej UMIEJĘTNOŚCI"). Najrzadsza kategoria celowo (`combatItemChance` <
  // `gearChance` w każdej skrzynce, patrz komentarz przy LOOT_BOXES). Niższe skrzynki dają TYLKO
  // nowy nieposiadany perk na poziomie 1 — ten sam "najsłabsze na niższych" wzorzec co
  // `COMBAT_ITEM_DROP_CHANCE_BY_TIER` w crates.ts; gold PREFERUJE ulepszenie już posiadanego
  // perku (jeśli masz cokolwiek jeszcze nie na max poziomie), nowy perk to tam fallback — jak
  // `openCrate()` w petStore.ts dla NIEZALEŻNEJ, drugiej ścieżki dropu tych samych itemów.
  // Gdy nic nie da się przyznać (np. wszystko już posiadane i na maksie) — brak `return`,
  // spada do monet niżej, tak jak gałąź ekwipunku wyżej w tej samej sytuacji.
  if (r < combatItemCut) {
    const preferUpgrade = BOX_RANK[box.id] >= BOX_RANK.gold;
    const upgradeable = (Object.keys(ownedCombatItems) as CombatItemId[])
      .filter(id => (ownedCombatItems[id] ?? 0) < COMBAT_ITEMS[id].maxLevel);
    const perkRarity: CrateTier = BOX_RANK[box.id] >= BOX_RANK.gold ? 'legendary' : BOX_RANK[box.id] >= BOX_RANK.iron ? 'epic' : 'rare';
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
  // 3) MONETY (rzadki jackpot = mityczny)
  const jackpot = Math.random() < box.coins.jackpotChance;
  const coins = jackpot ? box.coins.jackpot : box.coins.min + Math.floor(Math.random() * (box.coins.max - box.coins.min + 1));
  return { type: 'coins', coins, rarity: jackpot ? 'legendary' : 'basic' };
}
