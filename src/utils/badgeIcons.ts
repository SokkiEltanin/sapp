import { ImageSourcePropType } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Custom badge artwork (PNG 512×512, transparent). Maps achievement id → file in
// assets/badges/. require() paths must be static literals, so one line per badge.
// The gablota greys a badge out while it's still locked. Ids without an entry fall
// back to a lucide placeholder (see BadgeArt).
// ─────────────────────────────────────────────────────────────────────────────
export const BADGE_PNG: Record<string, ImageSourcePropType> = {
  'first-key':     require('../../assets/badges/key.png'),
  'scanner':       require('../../assets/badges/fingerprint.png'),
  'groceries-100': require('../../assets/badges/tote-bag.png'),
  'on-track':      require('../../assets/badges/compass.png'),
  'loyal-heart':   require('../../assets/badges/brand-loyalty.png'),
  'loyal':         require('../../assets/badges/fossil.png'),
  'marathon':      require('../../assets/badges/hiking-boots.png'),
  'sunny-week':    require('../../assets/badges/sun.png'),
  'self-care':     require('../../assets/badges/love.png'),
  'full-range':    require('../../assets/badges/theater-mask.png'),
  'chronicler':    require('../../assets/badges/papyrus.png'),
  'balanced':      require('../../assets/badges/justice-scale.png'),
  'under-limit':   require('../../assets/badges/speed-limit.png'),
  'goal-set':      require('../../assets/badges/signpost.png'),
  'doer':          require('../../assets/badges/call-to-action.png'),
  'habit-streak-7':  require('../../assets/badges/cactus.png'),
  'habit-streak-30': require('../../assets/badges/trunk.png'),
  'no-junk-7':     require('../../assets/badges/bonsai.png'),
  'saver-1000':    require('../../assets/badges/money.png'),
  'saver-5000':    require('../../assets/badges/coin.png'),
  'saver-10000':   require('../../assets/badges/precious-stone.png'),
  'payday-first':  require('../../assets/badges/money-card.png'),
  'work-100h':     require('../../assets/badges/gun.png'),
  'first-week':    require('../../assets/badges/dinosaur.png'),
  'tasks-50':      require('../../assets/badges/list.png'),
  'zen':           require('../../assets/badges/rose.png'),
  'well-rested':   require('../../assets/badges/sleeping.png'),
  // legendary
  'legend-saver':  require('../../assets/badges/slot-machine.png'),
  'centurion':     require('../../assets/badges/sword.png'),
  'unbreakable':   require('../../assets/badges/statue.png'),
  'year-one':      require('../../assets/badges/old-map.png'),
  'clean-month':   require('../../assets/badges/potion.png'),
  'ultra-walk':    require('../../assets/badges/magic-boot.png'),
  'titan':         require('../../assets/badges/dumbbell.png'),
  // anti-achievements
  'crime-scene':   require('../../assets/badges/crime-scene.png'),
  'undead':        require('../../assets/badges/skull.png'),
  'bottomless':    require('../../assets/badges/stomach.png'),
  'sweet-tooth':   require('../../assets/badges/donut.png'),
  'fast-food':     require('../../assets/badges/pizza.png'),
  'red-light':     require('../../assets/badges/stop.png'),
  'panic':         require('../../assets/badges/toilet-paper.png'),
  'grumpy':        require('../../assets/badges/annoyed.png'),
};

export function badgePng(id: string): ImageSourcePropType | undefined {
  return BADGE_PNG[id];
}
