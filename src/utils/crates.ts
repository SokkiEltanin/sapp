// Mini "sardynki" loot crate the cat gives you for petting it to a full affection
// bar. Open it for coins at a random rarity — mostly small, rarely a jackpot.
// 'legendary' (was 'mythic') is the UNIFIED top rarity shared with the shop's loot
// boxes (petBoxes.ts) — once the boss combat item system exists, this is the tier
// that occasionally drops an item instead of/alongside coins (user 2026-08-06: rare
// on purpose, main effort goes into the boss system first). rollCrate itself doesn't
// need to change shape for that later — just add an item branch inside the same
// `r < 0.02` bucket.
export type CrateTier = 'basic' | 'rare' | 'epic' | 'legendary';

// Szansa (NIEZALEŻNA od tieru monet powyżej — ten sam `rollCrate()` roll decyduje o OBU,
// ale to dwa osobne progi) że otwarcie skrzynki DODATKOWO przyzna coś z itemów bojowych.
//
// PRZEBALANSOWANE (2026-08-18, user: "zrob zeby itemy z bossów miały większy droprate...
// że te itemy mają poziomy, najsłabsze niech lecą na niższych gorszych boksach a lepsze
// poziomy czyli ulepszanie itemów na trudniejszych") — dotąd FLAT 1% niezależnie od tieru
// skrzynki, zawsze nowy nieposiadany item na poziomie 1 (nigdy level-up). Teraz TIEROWANE:
// niższe/gorsze skrzynki (`basic`/`rare`) dalej dają TYLKO pierwsze zdobycie (nowy item,
// poziom 1, "najsłabszy poziom"). Wyższe/trudniejsze skrzynki (`epic`/`legendary`, same z
// definicji rzadsze — `rollCrate()` daje je w 10%/2% przypadków) dostają WYŻSZĄ szansę I mogą
// zamiast nowego itemu ULEPSZYĆ już posiadany (patrz gałąź w `openCrate()` w petStore.ts —
// `legendary` PREFERUJE level-up nad nowym itemem, gdy masz cokolwiek jeszcze nie na maksie).
// Osiągalne przez zwykłe codzienne skrzynki (głaskanie do pełnego paska afekcji) — bez
// potrzeby realnego grindu.
//
// PODBITE (2026-09-08, user: "te umiejętności nie mogę dropnąć nie wiem czemu") — zbadane:
// to NIE był bug, tylko `basic` (60% wszystkich otwarć wg `rollCrate()` niżej) miał TWARDE
// 0% — więc licząc łączną szansę na CAŁYM rozkładzie tierów: 0.60×0 + 0.28×0.03 + 0.10×0.08 +
// 0.02×0.18 = tylko ~2.0% na jedno otwarcie skrzynki. Przy takiej rzadkości ponad 50% szans
// jest na ZERO dropów nawet po 30 otwarciach — statystycznie zgodne z frustracją usera, nie
// błąd w kodzie. Skoro `basic` to WIĘKSZOŚĆ otwarć, zerowa szansa akurat tam dominowała cały
// łączny wynik. Naprawa (balans, nie bugfix): `basic` dostaje małą, ale NIEZEROWĄ szansę,
// reszta tierów podbita proporcjonalnie — nowa łączna szansa ≈3.7% na otwarcie (prawie 2×
// więcej), `legendary` dalej wyraźnie najlepsza. Do dalszej korekty, jeśli user uzna że
// nadal za rzadko.
export const COMBAT_ITEM_DROP_CHANCE_BY_TIER: Record<CrateTier, number> = {
  basic: 0.01,
  rare: 0.05,
  epic: 0.12,
  legendary: 0.25,
};

export const CRATE_META: Record<CrateTier, { label: string; color: string }> = {
  basic:     { label: 'Zwykła',      color: '#9AA6B2' },
  rare:      { label: 'Rzadka',      color: '#4DA8FF' },
  epic:      { label: 'Epicka',      color: '#B061FF' },
  legendary: { label: 'Legendarna',  color: '#FBBF24' },
};

// Roll a crate: legendary 2%, epic 10%, rare 28%, basic 60%.
export function rollCrate(): { tier: CrateTier; coins: number } {
  const r = Math.random();
  if (r < 0.02) return { tier: 'legendary', coins: 100 };
  if (r < 0.12) return { tier: 'epic',   coins: 20 + Math.floor(Math.random() * 16) }; // 20–35
  if (r < 0.40) return { tier: 'rare',   coins: 5 + Math.floor(Math.random() * 6) };   // 5–10
  return { tier: 'basic', coins: 1 + Math.floor(Math.random() * 2) };                   // 1–2
}
