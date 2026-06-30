import { ImageSourcePropType } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Custom badge artwork (PNG 512×512, transparent). Maps achievement id → file in
// assets/badges/. require() paths must be static literals, so one line per badge.
// The gablota greys a badge out while it's still locked. Ids without an entry fall
// back to a lucide placeholder (see BadgeArt).
// ─────────────────────────────────────────────────────────────────────────────
export const BADGE_PNG: Record<string, ImageSourcePropType> = {
  'first-key':   require('../../assets/badges/key.png'),
  'scanner':     require('../../assets/badges/fingerprint.png'),
  'on-track':    require('../../assets/badges/compass.png'),
  'loyal-heart': require('../../assets/badges/brand-loyalty.png'),
  'marathon':    require('../../assets/badges/hiking-boots.png'),
  'sunny-week':  require('../../assets/badges/sun.png'),
  'self-care':   require('../../assets/badges/love.png'),
  'full-range':  require('../../assets/badges/theater-mask.png'),
  'balanced':    require('../../assets/badges/justice-scale.png'),
  'goal-set':    require('../../assets/badges/signpost.png'),
  'doer':        require('../../assets/badges/call-to-action.png'),
  // anti-achievements
  'crime-scene': require('../../assets/badges/crime-scene.png'),
  'undead':      require('../../assets/badges/skull.png'),
  'bottomless':  require('../../assets/badges/stomach.png'),
};

export function badgePng(id: string): ImageSourcePropType | undefined {
  return BADGE_PNG[id];
}
