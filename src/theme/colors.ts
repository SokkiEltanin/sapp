export const colors = {
  bg: {
    // Deeper, cleaner ladder — a darker base makes cards "float" and reads more
    // premium; clear elevation steps instead of 4 near-identical greys.
    primary:   '#121414',
    secondary: '#171A1A',
    card:      '#1B1F1F',
    elevated:  '#252A2A',
    overlay:   'rgba(0,0,0,0.88)',
  },
  text: {
    primary:   '#ECEEEE',
    secondary: 'rgba(236,238,238,0.62)',
    muted:     'rgba(236,238,238,0.36)',
    inverse:   '#0A0C0C',
  },

  // ── Per-tab identity palette ─────────────────────────────────────
  tabs: {
    dashboard: '#46B0DE',  // day cyan — useTimeAccent overrides
    tasks:     '#2AC68F',  // mint green
    finances:  '#E43434',  // red
    calendar:  '#3A4C9C',  // indigo
    analytics: '#F97316',  // orange
  },

  // ── Accent colors ────────────────────────────────────────────────
  accent: {
    // blue-night pair
    blue:   '#5B7BE3',
    blueDark: '#282F44',
    // cyan-day pair
    cyan:   '#46B0DE',
    cyanDark: '#1B3947',
    // green-tasks pair
    green:  '#2AC68F',
    greenDark: '#28443A',
    // indigo pair
    indigo: '#3A4C9C',
    indigoDark: '#1A2048',
    // red-finances pair
    red:    '#E43434',
    redDark: '#5B1818',
    // misc
    amber:  '#FBBF24',
    purple: '#BF80FF',
    pink:   '#F472B6',
    orange: '#F97316',
    // legacy
    primary:   '#BF80FF',
    secondary: '#F472B6',
    success:   '#2AC68F',
    danger:    '#E43434',
    warning:   '#FBBF24',
  },

  // ── Tints ────────────────────────────────────────────────────────
  tint: {
    blue:   'rgba(91,123,227,0.12)',
    cyan:   'rgba(70,176,222,0.12)',
    green:  'rgba(42,198,143,0.12)',
    indigo: 'rgba(58,76,156,0.12)',
    red:    'rgba(228,52,52,0.12)',
    amber:  'rgba(251,191,36,0.12)',
    purple: 'rgba(191,128,255,0.12)',
    pink:   'rgba(244,114,182,0.12)',
    orange: 'rgba(249,115,22,0.12)',
  },

  border: {
    default: 'rgba(255,255,255,0.07)',
    subtle:  'rgba(255,255,255,0.045)',
    focus:   'rgba(255,255,255,0.22)',
    card:    'rgba(255,255,255,0.06)',
    glass:   'rgba(255,255,255,0.10)',
  },

  brand: {
    gcal: '#039BE5',
  },

  // Time-of-day gradient top colors
  timeGradient: {
    night:     '#0B0E1A',
    dawn:      '#0B0E1A',
    morning:   '#091820',
    afternoon: '#091820',
    evening:   '#0B0E1A',
  },

  transparent: 'transparent',
  white:  '#ECEEEE',
  black:  '#000000',
  // legacy aliases
  expenses: '#E43434',
  calendar: '#3A4C9C',
  health:   '#2AC68F',
  mood:     '#F472B6',
  tasks:    '#2AC68F',
} as const;

export type Colors = typeof colors;
