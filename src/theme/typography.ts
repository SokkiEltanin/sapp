import { TextStyle } from 'react-native';

export const fontSizes = {
  xs: 11,
  sm: 13,
  md: 15,
  lg: 17,
  xl: 20,
  '2xl': 24,
  '3xl': 30,
  '4xl': 38,
} as const;

export const fontWeights: Record<string, TextStyle['fontWeight']> = {
  regular: '400',
  medium: '500',
  semibold: '600',
  bold: '700',
};

export const lineHeights = {
  tight: 1.2,
  normal: 1.5,
  relaxed: 1.75,
} as const;

export const typography = {
  // Big stat numbers — tight tracking reads premium.
  display: { fontSize: fontSizes['4xl'], fontWeight: '800', lineHeight: fontSizes['4xl'] * 1.05, letterSpacing: -1 } as TextStyle,
  h1: { fontSize: fontSizes['3xl'], fontWeight: '800', lineHeight: fontSizes['3xl'] * 1.15, letterSpacing: -0.6 } as TextStyle,
  h2: { fontSize: fontSizes['2xl'], fontWeight: fontWeights.bold, lineHeight: fontSizes['2xl'] * 1.2, letterSpacing: -0.4 } as TextStyle,
  h3: { fontSize: fontSizes.xl, fontWeight: '700', lineHeight: fontSizes.xl * 1.25, letterSpacing: -0.3 } as TextStyle,
  h4: { fontSize: fontSizes.lg, fontWeight: fontWeights.semibold, lineHeight: fontSizes.lg * 1.3 } as TextStyle,
  body: { fontSize: fontSizes.md, fontWeight: fontWeights.regular, lineHeight: fontSizes.md * 1.5 } as TextStyle,
  bodySmall: { fontSize: fontSizes.sm, fontWeight: fontWeights.regular, lineHeight: fontSizes.sm * 1.5 } as TextStyle,
  caption: { fontSize: fontSizes.xs, fontWeight: fontWeights.regular, lineHeight: fontSizes.xs * 1.4 } as TextStyle,
  label: { fontSize: fontSizes.sm, fontWeight: fontWeights.medium, lineHeight: fontSizes.sm * 1.3 } as TextStyle,
  // Uppercase section eyebrow — opt-in "pro" label (use explicitly where wanted).
  eyebrow: { fontSize: fontSizes.xs, fontWeight: '700', lineHeight: fontSizes.xs * 1.3, letterSpacing: 0.8, textTransform: 'uppercase' } as TextStyle,
} as const;
