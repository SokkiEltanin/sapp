export const colors = {
  bg: {
    primary:   '#141414',  // near-black base
    secondary: '#1A1A1A',
    card:      '#282828',  // dark gray card
    elevated:  '#303030',
    overlay:   'rgba(0,0,0,0.85)',
  },
  text: {
    primary:   '#FFFFFF',
    secondary: '#8C8C8C',  // mid gray
    muted:     '#484848',
    inverse:   '#000000',
  },

  // ── Per-tab identity palette ─────────────────────────────────────
  tabs: {
    dashboard: '#C8C8C8',  // neutral light — time accent overrides
    tasks:     '#2EDEA0',  // mint green
    finances:  '#E63535',  // red
    calendar:  '#3A4C9C',  // indigo blue
    analytics: '#F97316',  // orange (unchanged)
  },

  // ── Accent colors (per-module) ───────────────────────────────────
  accent: {
    // blue pair (Row 2)
    blue:   '#5166F5',
    blueDark: '#1E2242',
    // cyan pair (Row 3)
    cyan:   '#2BC8E0',
    cyanDark: '#0E262C',
    // green pair (Row 4)
    green:  '#2EDEA0',
    greenDark: '#0C2218',
    // indigo pair (Row 5)
    indigo: '#3A4C9C',
    indigoDark: '#1A2048',
    // red pair (Row 6)
    red:    '#E63535',
    redDark: '#5C1010',
    // other
    amber:  '#FBBF24',
    purple: '#BF80FF',
    pink:   '#F472B6',
    orange: '#F97316',
    // legacy aliases
    primary:   '#BF80FF',
    secondary: '#F472B6',
    success:   '#2EDEA0',
    danger:    '#E63535',
    warning:   '#FBBF24',
  },

  // ── Dark card tints per module (light accent + ~10% opacity) ─────
  tint: {
    blue:   'rgba(81,102,245,0.12)',
    cyan:   'rgba(43,200,224,0.12)',
    green:  'rgba(46,222,160,0.12)',
    indigo: 'rgba(58,76,156,0.12)',
    red:    'rgba(230,53,53,0.12)',
    amber:  'rgba(251,191,36,0.12)',
    purple: 'rgba(191,128,255,0.12)',
    pink:   'rgba(244,114,182,0.12)',
    orange: 'rgba(249,115,22,0.12)',
  },

  border: {
    default: 'rgba(255,255,255,0.10)',
    subtle:  'rgba(255,255,255,0.05)',
    focus:   'rgba(255,255,255,0.25)',
    card:    'rgba(255,255,255,0.08)',
    glass:   'rgba(255,255,255,0.12)',
  },

  brand: {
    gcal: '#039BE5',
  },

  // Time-of-day gradient top colors
  timeGradient: {
    night:     '#0A0A1E',
    dawn:      '#1A0E06',
    morning:   '#060D1A',
    afternoon: '#0D0A18',
    evening:   '#180A08',
  },

  transparent: 'transparent',
  white:  '#FFFFFF',
  black:  '#000000',
  // legacy screen-level color aliases
  expenses: '#E63535',
  calendar: '#3A4C9C',
  health:   '#2EDEA0',
  mood:     '#F472B6',
  tasks:    '#2EDEA0',
} as const;

export type Colors = typeof colors;
