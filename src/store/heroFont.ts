import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { throttledAsyncStorage } from '@/utils/throttledStorage';

// The dashboard greeting ("DZIEŃ DOBRY") font. We use system font families
// (no bundled files) so each option renders on-device; sizes/heights are tuned
// per font because they have different metrics.
export interface HeroFont {
  id: string;
  label: string;
  family?: string;       // undefined = default system black
  weight: string;
  spacing: number;       // letterSpacing
  size: number;          // SVG fontSize
  height: number;        // SVG height (line box)
  baseY: number;         // SVG text baseline y
  upper: boolean;        // uppercase the text?
  italic?: boolean;
}

export const HERO_FONTS: HeroFont[] = [
  { id: 'black',     label: 'Gruby (domyślny)',   family: undefined,               weight: '900', spacing: -2,   size: 44, height: 50, baseY: 40, upper: true },
  { id: 'condensed', label: 'Nowoczesny wąski',   family: 'sans-serif-condensed',  weight: '800', spacing: -0.5, size: 44, height: 50, baseY: 40, upper: true },
  { id: 'serif',     label: 'Elegancki (serif)',  family: 'serif',                 weight: '700', spacing: -0.5, size: 40, height: 50, baseY: 39, upper: true },
  { id: 'script',    label: 'Odręczny',           family: 'cursive',               weight: '700', spacing: 0,    size: 40, height: 56, baseY: 42, upper: false, italic: true },
  { id: 'mono',      label: 'Techniczny',         family: 'monospace',             weight: '700', spacing: -1,   size: 32, height: 46, baseY: 35, upper: true },
  { id: 'light',     label: 'Minimalistyczny',    family: 'sans-serif-thin',       weight: '300', spacing: 1,    size: 40, height: 50, baseY: 39, upper: true },
  // Bundled custom display fonts (loaded by name in app/_layout via expo-font).
  // Metrics are starting points — fine-tune per font with the size/position sliders.
  { id: 'blackout',   label: 'Blackout',         family: 'Blackout',      weight: '400', spacing: 1,  size: 40, height: 52, baseY: 40, upper: true },
  { id: 'pastel',     label: 'Pastel',           family: 'Pastel',        weight: '400', spacing: 0,  size: 40, height: 56, baseY: 42, upper: false },
  { id: 'airstrike',  label: 'Airstrike',        family: 'Airstrike',     weight: '400', spacing: 0,  size: 38, height: 50, baseY: 38, upper: true },
  { id: 'airstrikeB', label: 'Airstrike Bold',   family: 'AirstrikeBold', weight: '400', spacing: 0,  size: 38, height: 50, baseY: 38, upper: true },
  { id: 'airstrikeC', label: 'Airstrike wąski',  family: 'AirstrikeCond', weight: '400', spacing: 0,  size: 42, height: 50, baseY: 39, upper: true },
];

export function heroFontById(id?: string): HeroFont {
  return HERO_FONTS.find(f => f.id === id) ?? HERO_FONTS[0];
}

interface HeroFontState {
  fontId: string;
  sizeScale: number;   // multiplier on the preset size (1 = default)
  offsetX: number;     // px horizontal nudge
  offsetY: number;     // px vertical nudge
  customFamily?: string; // a runtime-loaded custom font family name (optional)
  customLabel?: string;  // display name for the custom font
  setFont: (id: string) => void;
  setSizeScale: (v: number) => void;
  setOffsetX: (v: number) => void;
  setOffsetY: (v: number) => void;
  setCustomFamily: (family?: string, label?: string) => void;
}

const clamp = (v: number, lo: number, hi: number) => Math.min(hi, Math.max(lo, v));

export const useHeroFont = create<HeroFontState>()(
  persist(
    (set) => ({
      fontId: 'black',
      sizeScale: 1,
      offsetX: 0,
      offsetY: 0,
      setFont: (fontId) => set({ fontId }),
      setSizeScale: (v) => set({ sizeScale: clamp(Math.round(v * 100) / 100, 0.5, 2) }),
      setOffsetX: (v) => set({ offsetX: clamp(Math.round(v), -60, 60) }),
      setOffsetY: (v) => set({ offsetY: clamp(Math.round(v), -30, 40) }),
      setCustomFamily: (customFamily, customLabel) => set({ customFamily, customLabel }),
    }),
    { name: 'hero-font-v1', storage: createJSONStorage(() => throttledAsyncStorage()) },
  ),
);
