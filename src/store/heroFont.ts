import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

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
];

export function heroFontById(id?: string): HeroFont {
  return HERO_FONTS.find(f => f.id === id) ?? HERO_FONTS[0];
}

interface HeroFontState {
  fontId: string;
  setFont: (id: string) => void;
}

export const useHeroFont = create<HeroFontState>()(
  persist(
    (set) => ({
      fontId: 'black',
      setFont: (fontId) => set({ fontId }),
    }),
    { name: 'hero-font-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
