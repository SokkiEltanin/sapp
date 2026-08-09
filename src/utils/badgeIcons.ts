import { ImageSourcePropType } from 'react-native';

// ─────────────────────────────────────────────────────────────────────────────
// Custom badge artwork (PNG, transparent). Maps achievement id → file in
// assets/bages/. require() paths must be static literals, so one line per badge.
// The gablota greys a badge out while it's still locked. Ids without an entry fall
// back to a lucide placeholder (see BadgeArt) — some badges never got custom art.
// Candidates awaiting a decision live in assets/bagesv2/ (see memory backlog_2026-08-07:
// gnome.png = no clear mechanic yet, radar.png = missed-reminder detection deferred).
// ─────────────────────────────────────────────────────────────────────────────
export const BADGE_PNG: Record<string, ImageSourcePropType> = {
  // ── Legendy ──
  'year-one':       require('../../assets/bages/old-map.png'),
  'fossil-300':     require('../../assets/bages/fossil.png'),
  'legend-saver':   require('../../assets/bages/crown.png'),
  'unbreakable':    require('../../assets/bages/excalibur.png'),
  'centurion':      require('../../assets/bages/ancient-pillar.png'),
  'clean-month':    require('../../assets/bages/orange.png'),
  'cyborg-365':     require('../../assets/bages/cyborg.png'),

  // ── Nawyki ──
  'habit-streak-30': require('../../assets/bages/kendo.png'),

  // ── Jedzenie ──
  'first-bite':   require('../../assets/bages/carrot.png'),
  'kcal-month':   require('../../assets/bages/astronaut.png'),
  'home-chef':    require('../../assets/bages/kiwi.png'),
  'no-junk-7':    require('../../assets/bages/bonsai.png'),
  'veg-variety':  require('../../assets/bages/eggplants.png'),
  'five-a-day':   require('../../assets/bages/apple.png'),
  'produce-week': require('../../assets/bages/strawberry.png'),
  'fish-menu':    require('../../assets/bages/fish.png'),
  'fish-master':  require('../../assets/bages/fishing-rod.png'),

  // ── Oszczędzanie ──
  'saver-5000':      require('../../assets/bages/coin.png'),
  'saver-10000':     require('../../assets/bages/castle.png'),
  'saver-1000':      require('../../assets/bages/money-bag.png'),
  'under-limit':     require('../../assets/bages/helmet.png'),
  'balanced':        require('../../assets/bages/pirate-hat.png'),
  'power-saver':     require('../../assets/bages/washing.png'),
  'bill-tracked':    require('../../assets/bages/steering-wheel.png'),
  'budget-streak-3': require('../../assets/bages/armor.png'),
  'budget-precision':require('../../assets/bages/target.png'),
  'slow-saver':      require('../../assets/bages/turtle.png'),
  'deposit-collector':require('../../assets/bages/bottle.png'),
  'pirate-treasure': require('../../assets/bages/pirate.png'),
  'bank-detective':  require('../../assets/bages/detective.png'),
  'auto-merchant':   require('../../assets/bages/robot.png'),

  // ── Praca ──
  'doer':      require('../../assets/bages/horn.png'),
  'tasks-50':  require('../../assets/bages/bow-and-arrow.png'),
  'tasks-200': require('../../assets/bages/robe.png'),
  'work-100h':  require('../../assets/bages/school-bag.png'),
  'work-1000h': require('../../assets/bages/air-force.png'),

  // ── Nastrój ──
  'self-care':    require('../../assets/bages/heart.png'),
  'full-range':   require('../../assets/bages/actress.png'),
  'chronicler':   require('../../assets/bages/brain.png'),
  'sunny-week':   require('../../assets/bages/bonfire.png'),
  'zen':          require('../../assets/bages/lung.png'),
  'stoic-30':     require('../../assets/bages/statue.png'),
  'mood-bounce':  require('../../assets/bages/bandage.png'),
  'mood-mastery': require('../../assets/bages/oscar.png'),

  // ── Zdrowie ──
  'marathon':    require('../../assets/bages/foot.png'),
  'step-beast':  require('../../assets/bages/muscle.png'),
  'well-rested': require('../../assets/bages/lantern.png'),

  // ── Życie ──
  'traveler':      require('../../assets/bages/globe.png'),
  'carnivore':     require('../../assets/bages/bear.png'),
  'butcher':       require('../../assets/bages/knife.png'),
  'alchemist':     require('../../assets/bages/art.png'),
  'unplugged-7':   require('../../assets/bages/spine.png'),
  'otaku':         require('../../assets/bages/cherry-blossom.png'),
  'otaku-koi':     require('../../assets/bages/carp-fish.png'),
  'otaku-samurai': require('../../assets/bages/samurai.png'),
  'eco-warrior':   require('../../assets/bages/ecology.png'),

  // ── Konsekwencja ──
  'scanner':         require('../../assets/bages/eye.png'),
  'loyal':           require('../../assets/bages/dinosaur.png'),
  'goal-set':        require('../../assets/bages/treasure-map.png'),
  'on-track':        require('../../assets/bages/compass.png'),
  'loyal-heart':     require('../../assets/bages/medieval-house.png'),
  'backup-done':     require('../../assets/bages/document.png'),
  'login-streak-14': require('../../assets/bages/dog.png'),
  'selftest-clean':  require('../../assets/bages/vase.png'),
  'stats-watcher':   require('../../assets/bages/spy.png'),
  'scan-master':     require('../../assets/bages/green-screen.png'),

  // ── Grzeszki (antyodznaki) ──
  'undead':        require('../../assets/bages/skull.png'),
  'undead-7':      require('../../assets/bages/humanskull.png'),
  'bottomless':    require('../../assets/bages/belly.png'),
  'fast-food':     require('../../assets/bages/chili-pepper.png'),
  'chemist':       require('../../assets/bages/lemon.png'),
  'panic':         require('../../assets/bages/bomb.png'),
  'kraken':        require('../../assets/bages/kraken.png'),
  'red-light':     require('../../assets/bages/fire.png'),
  'meltdown':      require('../../assets/bages/nuclear-weapon.png'),
  'rollercoaster': require('../../assets/bages/volcano.png'),
  'high-roller':   require('../../assets/bages/gambling-chips.png'),
  'va-banque':     require('../../assets/bages/poker-cards.png'),
  'ags-edge':      require('../../assets/bages/cough.png'),
  'ags-month':     require('../../assets/bages/allergy.png'),
  'ags-streak':    require('../../assets/bages/gas-mask.png'),
  'ags-trash':     require('../../assets/bages/trash.png'),
};

export function badgePng(id: string): ImageSourcePropType | undefined {
  return BADGE_PNG[id];
}
