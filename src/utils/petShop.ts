// Shop catalogue. Rooms, hats, glasses, collars and held items are GONE — the user cut
// them all: "skupiamy się na lepszych animacjach, lepszych interakcjach; jedyne co będzie
// w sklepie za punkty to zmiana koloru kotka". The only things coins buy now are coat
// colours and the tail stripes.
//
// Kept as its own module (rather than folding into catPalettes) so the shop screen has a
// single import and the tier colours stay in one place.

import { CAT_PALETTES, CatPalette, STRIPES_ID, STRIPES_COST } from '@/utils/catPalettes';

export type CosmeticTier = 'basic' | 'rare' | 'epic';

export const TIER_META: Record<CosmeticTier, { label: string; color: string }> = {
  basic: { label: 'Zwykły', color: '#8A94A6' },
  rare:  { label: 'Rzadki', color: '#4DA8FF' },
  epic:  { label: 'Epicki', color: '#B061FF' },
};

export interface ShopColor {
  id: string;
  name: string;
  cost: number;
  tier: CosmeticTier;
  palette: CatPalette;
}

function tierFor(cost: number): CosmeticTier {
  if (cost >= 120) return 'epic';
  if (cost >= 60) return 'rare';
  return 'basic';
}

export const SHOP_COLORS: ShopColor[] = CAT_PALETTES.map(p => ({
  id: p.id, name: p.name, cost: p.cost, tier: tierFor(p.cost), palette: p,
}));

export const STRIPES = { id: STRIPES_ID, name: 'Prążki na ogonie', cost: STRIPES_COST, tier: 'rare' as CosmeticTier };

export function shopColorById(id?: string): ShopColor | undefined {
  return id ? SHOP_COLORS.find(c => c.id === id) : undefined;
}
