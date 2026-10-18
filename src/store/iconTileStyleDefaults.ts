import { SHAPE_COLOR_PRESETS } from '@/store/shapeStyleDefaults';

// Typ komponentu "Ikona" na wolnym płótnie (§371, user: "możesz też do edytora pododawać
// IKONKI które mamy w aplikacji używane i moge je dodawac wtedy bezposrednio skalować
// justować"). Pure TS (bez importu 'react-native'/`lucide-react-native`) z TEGO SAMEGO
// powodu co `shapeStyleDefaults.ts`/`countdownTileStyleDefaults.ts` — `canvasComponentsStore.ts`
// musi móc go zaimportować bez ciągnięcia drzewa komponentów za sobą (jest, `testEnvironment:
// 'node'`). Mapowanie klucz→realny komponent lucide żyje w `IconTile.tsx` (renderer), NIE tutaj.
//
// Zakres: NIE cała biblioteka lucide-react-native (1000+ ikon, nieużywalny picker) — curated
// pula ~43 ikon, już widocznych gdzie indziej w appce (nawyki — `HABIT_ICONS` w `types/index.ts`
// — plus szeroki zestaw generycznych kategorii: cele/sport/finanse/dom/natura/zwierzęta/czas),
// tym samym duchem co `HABIT_ICONS`/`SHAPE_COLOR_PRESETS` — skończona, przemyślana lista, nie
// "wszystko co się da". Klucze w kebab-case (ten sam format co `Habit.icon`/`Counter.icon` —
// "optional lucide key" — i jak nazwy plików samego pakietu `lucide-react-native`).
export const ICON_TILE_ICONS = [
  'star', 'heart', 'flag', 'target', 'gift', 'coffee', 'music', 'camera',
  'gamepad-2', 'dumbbell', 'plane', 'car', 'house', 'briefcase', 'graduation-cap', 'smile',
  'droplets', 'moon', 'sun', 'bike', 'book-open', 'zap', 'flame', 'trophy',
  'rocket', 'bell', 'calendar', 'clock', 'map-pin', 'shopping-bag', 'wallet', 'piggy-bank',
  'leaf', 'dog', 'cat', 'smartphone', 'palette', 'pen-tool', 'sparkles', 'cloud-rain',
  'image', 'hash', 'tag', 'check', 'lock',
] as const;
export type IconTileIconKey = typeof ICON_TILE_ICONS[number];

export type IconAlign = 'left' | 'center' | 'right';

export interface IconTileStyle {
  iconKey: IconTileIconKey;
  color: string;
  size: number;                   // px — "skalować" (user) = ten stepper, ten sam wzorzec co
                                   // `TextShapeStyle.fontSize` (absolutny rozmiar, nie % boxa)
  backgroundColor: string | null; // null = brak tła, goła ikona
  cornerRadius: number;           // tylko gdy backgroundColor !== null
  align: IconAlign;               // "justować" (user) — pozycja ikony w boxie w poziomie
}

export const DEFAULT_ICON_TILE_STYLE: IconTileStyle = {
  iconKey: 'star',
  color: '#38BDF8',
  size: 40,
  backgroundColor: null,
  cornerRadius: 16,
  align: 'center',
};

// Ta sama paleta co kształty (§357) — reużyta, nie zduplikowana.
export const ICON_COLOR_PRESETS = SHAPE_COLOR_PRESETS;
