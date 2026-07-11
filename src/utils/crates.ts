// Mini "sardynki" loot crate the cat gives you for petting it to a full affection
// bar. Open it for coins at a random rarity — mostly small, rarely a jackpot.
export type CrateTier = 'basic' | 'rare' | 'epic' | 'mythic';

export const CRATE_META: Record<CrateTier, { label: string; color: string }> = {
  basic:  { label: 'Zwykła',   color: '#9AA6B2' },
  rare:   { label: 'Rzadka',   color: '#4DA8FF' },
  epic:   { label: 'Epicka',   color: '#B061FF' },
  mythic: { label: 'Mityczna', color: '#FBBF24' },
};

// Roll a crate: mythic 2%, epic 10%, rare 28%, basic 60%.
export function rollCrate(): { tier: CrateTier; coins: number } {
  const r = Math.random();
  if (r < 0.02) return { tier: 'mythic', coins: 100 };
  if (r < 0.12) return { tier: 'epic',   coins: 20 + Math.floor(Math.random() * 16) }; // 20–35
  if (r < 0.40) return { tier: 'rare',   coins: 5 + Math.floor(Math.random() * 6) };   // 5–10
  return { tier: 'basic', coins: 1 + Math.floor(Math.random() * 2) };                   // 1–2
}
