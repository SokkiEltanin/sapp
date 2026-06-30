import { ImageSourcePropType } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Custom badge artwork.
//
// Drop a PNG (512×512, transparent background, named exactly by achievement id)
// into  assets/badges/<id>.png  and UNCOMMENT its line below. That's the only
// wiring needed — the gablota picks it up automatically and greys it out while
// the badge is still locked. Until a PNG exists, a lucide placeholder is shown.
//
// require() paths MUST be static string literals, so each badge gets its own line.
// ─────────────────────────────────────────────────────────────────────────────
export const BADGE_PNG: Record<string, ImageSourcePropType> = {
  // 'habit-streak-3':    require('../../assets/badges/habit-streak-3.png'),
  // 'habit-streak-7':    require('../../assets/badges/habit-streak-7.png'),
  // 'habit-streak-30':   require('../../assets/badges/habit-streak-30.png'),
  // 'habit-all-day':     require('../../assets/badges/habit-all-day.png'),
  // 'no-junk-3':         require('../../assets/badges/no-junk-3.png'),
  // 'no-junk-7':         require('../../assets/badges/no-junk-7.png'),
  // 'no-junk-14':        require('../../assets/badges/no-junk-14.png'),
  // 'saver-first':       require('../../assets/badges/saver-first.png'),
  // 'saver-1000':        require('../../assets/badges/saver-1000.png'),
  // 'saver-5000':        require('../../assets/badges/saver-5000.png'),
  // 'saver-10000':       require('../../assets/badges/saver-10000.png'),
  // 'work-payday-first': require('../../assets/badges/work-payday-first.png'),
  // 'work-50h':          require('../../assets/badges/work-50h.png'),
  // 'work-100h':         require('../../assets/badges/work-100h.png'),
  // 'receipts-25':       require('../../assets/badges/receipts-25.png'),
  // 'receipts-100':      require('../../assets/badges/receipts-100.png'),
  // 'mood-7':            require('../../assets/badges/mood-7.png'),
  // 'mood-30':           require('../../assets/badges/mood-30.png'),
  // 'steps-10k':         require('../../assets/badges/steps-10k.png'),
  // 'bills-first':       require('../../assets/badges/bills-first.png'),
};

export function badgePng(id: string): ImageSourcePropType | undefined {
  return BADGE_PNG[id];
}
