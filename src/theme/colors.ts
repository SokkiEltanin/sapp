export const colors = {
  bg: {
    primary:   '#0A0A0A',
    secondary: '#111111',
    card:      '#1C1C1E',
    elevated:  '#242426',
    overlay:   'rgba(0,0,0,0.85)',
  },
  text: {
    primary:   '#FFFFFF',
    secondary: '#8A8A8E',
    muted:     '#48484A',
    inverse:   '#000000',
  },
  // Per-tab identity colors — one per section
  tabs: {
    dashboard: '#E5E5EA',  // neutral/white — no strong accent
    tasks:     '#6C9EFF',  // cobalt blue — focus, clarity
    finances:  '#4ECBA8',  // teal — money, growth
    calendar:  '#BF80FF',  // soft violet — time, planning
    analytics: '#FF9F6B',  // warm orange — data, insights
  },
  accent: {
    green:  '#4ECBA8',
    red:    '#FF6B6B',
    amber:  '#FBBF24',
    blue:   '#6C9EFF',
    purple: '#BF80FF',
    pink:   '#F472B6',
    orange: '#FF9F6B',
    // legacy aliases
    primary:  '#BF80FF',
    secondary: '#F472B6',
    success:  '#4ECBA8',
    danger:   '#FF6B6B',
    warning:  '#FBBF24',
  },
  border: {
    default: 'rgba(255,255,255,0.10)',
    subtle:  'rgba(255,255,255,0.05)',
    focus:   'rgba(255,255,255,0.25)',
    card:    'rgba(255,255,255,0.08)',
    glass:   'rgba(255,255,255,0.12)',
  },
  tint: {
    green:  'rgba(78,203,168,0.12)',
    red:    'rgba(255,107,107,0.12)',
    amber:  'rgba(251,191,36,0.12)',
    blue:   'rgba(108,158,255,0.12)',
    purple: 'rgba(191,128,255,0.12)',
    pink:   'rgba(244,114,182,0.12)',
    orange: 'rgba(255,159,107,0.12)',
  },
  brand: {
    gcal: '#039BE5',
  },
  // Time-of-day gradient top colors (darkened for subtle effect)
  timeGradient: {
    night:     '#0A0A1E', // deep indigo
    dawn:      '#1A0E06', // warm amber-brown
    morning:   '#060D1A', // clear blue
    afternoon: '#0D0A18', // soft violet
    evening:   '#180A08', // burnt orange-red
  },
  transparent: 'transparent',
  white: '#FFFFFF',
  black: '#000000',
  expenses: '#FF6B6B',
  calendar: '#BF80FF',
  health:   '#4ECBA8',
  mood:     '#F472B6',
  tasks:    '#6C9EFF',
} as const;

export type Colors = typeof colors;
