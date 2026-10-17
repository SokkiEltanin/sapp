// Gołe kształty-primitywy na wolnym płótnie (Faza 26, 2026-10-17, §357) — user: "na pewno pełny
// edytor z dodawaniem kształtów od zera... żeby było jak Figma". Dotychczasowe 3 typy
// (`streakTile`/`countdownTile`/`notesTile`, `canvasComponentsStore.ts`) to gotowe WIDGETY z
// treścią z apki — żaden nie pozwalał postawić gołego prostokąta/kółka/linii/podpisu. Te 4 nowe
// typy są BEZ podpięcia danych (`bindingKey` zawsze `null` dla nich, patrz `canvasComponentsStore.
// ts`/`ScreenCanvas.tsx`) — czysto wizualne elementy do budowania własnego układu (ramki, tła pod
// inne kafle, separatory, podpisy). Pure TS (bez importu `'react-native'`) z TEGO SAMEGO powodu co
// `countdownTileStyleDefaults.ts`/`notesTileStyleDefaults.ts` — `canvasComponentsStore.ts` musi
// móc je zaimportować bez ciągnięcia drzewa komponentów RN za sobą (jest, `testEnvironment:
// 'node'`).
//
// Świadomie uproszczone: kształty żyją w znormalizowanej przestrzeni `viewBox="0 0 100 100"` (+
// `preserveAspectRatio="none"`) w komponencie renderującym (`ShapeTile.tsx`), nie w pikselach —
// SVG rozciąga się 1:1 z flex-resize tego samego kontenera co pozostałe 3 typy kafli (żywa
// animacja podczas przeciągania uchwytu resize w `CanvasPlacedItem.tsx`, bez potrzeby
// `onLayout`/pomiaru). Efekt: `strokeWidth`/`cornerRadius` są względne do rozmiaru kształtu, nie
// stałą liczbą pikseli (inaczej niż w prawdziwej Figmie) — przy bardzo małych/dużych instancjach
// grubość obrysu będzie się skalować z boxem. Jeśli user zgłosi że to przeszkadza, v2 przejdzie
// na pomiar `onLayout` + piksele absolutne.
export type ShapeComponentType = 'rectShape' | 'ellipseShape' | 'lineShape' | 'textShape';

export const SHAPE_TYPES: readonly ShapeComponentType[] = ['rectShape', 'ellipseShape', 'lineShape', 'textShape'];
export const isShapeType = (t: string): t is ShapeComponentType => (SHAPE_TYPES as readonly string[]).includes(t);

export interface RectShapeStyle {
  fill: string;
  stroke: string | null; // null = brak obrysu
  strokeWidth: number;    // jednostki viewBox 0-100 (patrz komentarz wyżej)
  cornerRadius: number;   // 0-50
  opacity: number;        // 0.1-1
}
export interface EllipseShapeStyle {
  fill: string;
  stroke: string | null;
  strokeWidth: number;
  opacity: number;
}
export interface LineShapeStyle {
  color: string;
  thickness: number; // jednostki viewBox 0-100
  opacity: number;
}
export interface TextShapeStyle {
  text: string;
  color: string;
  fontSize: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  opacity: number;
}

export type ShapeStyle = RectShapeStyle | EllipseShapeStyle | LineShapeStyle | TextShapeStyle;

export const DEFAULT_RECT_SHAPE_STYLE: RectShapeStyle = { fill: '#3B82F6', stroke: null, strokeWidth: 2, cornerRadius: 8, opacity: 1 };
export const DEFAULT_ELLIPSE_SHAPE_STYLE: EllipseShapeStyle = { fill: '#3B82F6', stroke: null, strokeWidth: 2, opacity: 1 };
export const DEFAULT_LINE_SHAPE_STYLE: LineShapeStyle = { color: '#3B82F6', thickness: 3, opacity: 1 };
export const DEFAULT_TEXT_SHAPE_STYLE: TextShapeStyle = { text: 'Tekst', color: '#FFFFFF', fontSize: 16, bold: true, align: 'left', opacity: 1 };

// Paleta domyślna dla `ColorSwatchPicker` w `CanvasShapeStyleModal` — te same 8 odcieni co
// progi serii (`streakTileStyleStore.ts`) + biały/czarny (kształty/tekst częściej potrzebują
// neutralnych kolorów niż akcentów nawyków).
export const SHAPE_COLOR_PRESETS = ['#FFFFFF', '#94A3B8', '#1E293B', '#EF4444', '#F59E0B', '#22C55E', '#3B82F6', '#8B5CF6'];
