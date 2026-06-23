import { colors as dark } from './colors';

// Light theme — same shape as the dark palette, only the neutrals (surfaces,
// text, borders) flip. Module/accent hues stay identical so identity is kept;
// the redesigned screens read this via useColors() so light mode is reactive.
export const lightColors = {
  ...dark,
  bg: {
    primary:   '#F3F5F5',
    secondary: '#EBEEEE',
    card:      '#FFFFFF',
    elevated:  '#FFFFFF',
    overlay:   'rgba(20,24,24,0.45)',
  },
  text: {
    primary:   '#16191A',
    secondary: 'rgba(22,25,26,0.62)',
    muted:     'rgba(22,25,26,0.42)',
    inverse:   '#FFFFFF',
  },
  border: {
    default: 'rgba(20,24,24,0.10)',
    subtle:  'rgba(20,24,24,0.06)',
    focus:   'rgba(20,24,24,0.28)',
    card:    'rgba(20,24,24,0.08)',
    glass:   'rgba(20,24,24,0.12)',
  },
  fill: {
    subtle: 'rgba(20,24,24,0.04)',
    medium: 'rgba(20,24,24,0.06)',
    strong: 'rgba(20,24,24,0.10)',
  },
  white: '#FFFFFF',
} as const;
