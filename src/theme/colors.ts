export const colors = {
  bg: {
    primary:   '#000000',
    secondary: '#080808',
    card:      '#0E0E0E',
    elevated:  '#181818',
    overlay:   'rgba(0,0,0,0.92)',
  },
  text: {
    primary:   '#FFFFFF',
    secondary: '#909090',
    muted:     '#666666',
    inverse:   '#000000',
  },
  accent: {
    green:    '#34D399',
    red:      '#F87171',
    amber:    '#FBBF24',
    purple:   '#C084FC',
    blue:     '#60A5FA',
    pink:     '#F472B6',
    // legacy aliases
    primary:  '#C084FC',
    secondary:'#F472B6',
    success:  '#34D399',
    danger:   '#F87171',
    warning:  '#FBBF24',
  },
  border: {
    default: 'rgba(255,255,255,0.12)',
    subtle:  'rgba(255,255,255,0.06)',
    focus:   'rgba(255,255,255,0.28)',
    card:    'rgba(255,255,255,0.12)',
  },
  tint: {
    green:  'rgba(52,211,153,0.10)',
    red:    'rgba(248,113,113,0.10)',
    amber:  'rgba(251,191,36,0.10)',
    purple: 'rgba(192,132,252,0.10)',
    blue:   'rgba(96,165,250,0.10)',
    pink:   'rgba(244,114,182,0.10)',
  },
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
  expenses: '#F87171',
  calendar: '#60A5FA',
  health:   '#34D399',
  mood:     '#F472B6',
  tasks:    '#C084FC',
} as const;

export type Colors = typeof colors;
