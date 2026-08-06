// Mini "sardynki" loot crate the cat gives you for petting it to a full affection
// bar. Open it for coins at a random rarity — mostly small, rarely a jackpot.
// 'legendary' (was 'mythic') is the UNIFIED top rarity shared with the shop's loot
// boxes (petBoxes.ts) — once the boss combat item system exists, this is the tier
// that occasionally drops an item instead of/alongside coins (user 2026-08-06: rare
// on purpose, main effort goes into the boss system first). rollCrate itself doesn't
// need to change shape for that later — just add an item branch inside the same
// `r < 0.02` bucket.
export type CrateTier = 'basic' | 'rare' | 'epic' | 'legendary';

// Niezależna szansa (osobna od tieru monet powyżej), że otwarcie skrzynki DODATKOWO
// przyzna item bojowy (v4.1 — patrz memory boss_design.md). User 2026-08-06: "bardzo
// rzadko". Osobna od kolorowego tieru = prościej — monety zostają jak były, item to
// bonus na wierzchu, nie zależny od tego czy akurat wylosowało 'legendary'.
export const COMBAT_ITEM_DROP_CHANCE = 0.01;

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
