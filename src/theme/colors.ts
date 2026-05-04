export const colors = {
  bg: {
    primary:   '#0A0A0A',
    secondary: '#111111',
    card:      '#161616',
    elevated:  '#1E1E1E',
    overlay:   'rgba(0,0,0,0.82)',
  },
  text: {
    primary:   '#F0F0F0',
    secondary: '#888888',
    muted:     '#3A3A3A',
    inverse:   '#0A0A0A',
  },
  accent: {
    green:   '#34D399',
    red:     '#F87171',
    amber:   '#FBBF24',
    purple:  '#C084FC',
    blue:    '#60A5FA',
    pink:    '#F472B6',
    // legacy aliases (used across codebase)
    primary:  '#C084FC',
    secondary:'#F472B6',
    success:  '#34D399',
    danger:   '#F87171',
    warning:  '#FBBF24',
  },
  border: {
    default: 'rgba(255,255,255,0.07)',
    subtle:  'rgba(255,255,255,0.03)',
    focus:   'rgba(255,255,255,0.30)',
    card:    'rgba(255,255,255,0.07)',
  },
  tint: {
    green:  'rgba(52,211,153,0.12)',
    red:    'rgba(248,113,113,0.12)',
    amber:  'rgba(251,191,36,0.12)',
    purple: 'rgba(192,132,252,0.12)',
    blue:   'rgba(96,165,250,0.12)',
    pink:   'rgba(244,114,182,0.12)',
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
