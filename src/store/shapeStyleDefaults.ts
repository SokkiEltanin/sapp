import { Fill } from '@/store/gradientFill';

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
// Świadomie uproszczone: `ellipseShape`/`lineShape`/`textShape` żyją w znormalizowanej
// przestrzeni `viewBox="0 0 100 100"` (+ `preserveAspectRatio="none"`) w komponencie renderującym
// (`ShapeTile.tsx`), nie w pikselach — SVG rozciąga się 1:1 z flex-resize tego samego kontenera
// co pozostałe typy kafli (żywa animacja podczas przeciągania uchwytu resize w
// `CanvasPlacedItem.tsx`, bez potrzeby `onLayout`/pomiaru). Dla `ellipseShape` to jest GEOMETRYCZNIE
// POPRAWNE (elipsa to z definicji okrąg rozciągnięty nierównomiernie — niekwadratowy box daje
// poprawną elipsę). Efekt dla `lineShape`/`textShape`: `thickness`/`fontSize` są względne do
// rozmiaru kształtu, nie stałą liczbą pikseli — przy bardzo małych/dużych instancjach będą się
// skalować z boxem.
//
// `rectShape` jest WYJĄTKIEM od 2026-10-19 (§387, user: kształty "wydłużają się i wyglądają jak
// gówno") — kwadratowy promień zaokrąglenia rogu (`cornerRadius`) w znormalizowanej przestrzeni
// po nierównomiernym skalowaniu zamieniał się w rozciągniętą, eliptyczną ćwiartkę (widoczny,
// zgłoszony bug — to NIE jest to samo co poprawna elipsa wyżej, bo tu user NIE chce rozciągnięcia,
// chce geometrycznie okrągły róg niezależnie od proporcji). Fix: `ShapeTile.tsx` dla `rectShape`
// używa `viewBox` = REALNE piksele instancji (`item.width`/`item.height` przekazane z
// `ScreenCanvas.tsx`), więc `cornerRadius`/`strokeWidth` tego typu SĄ realnymi pikselami, nie
// jednostkami 0-100 — zob. komentarz w `ShapeTile.tsx`.
export type ShapeComponentType = 'rectShape' | 'ellipseShape' | 'lineShape' | 'textShape';

export const SHAPE_TYPES: readonly ShapeComponentType[] = ['rectShape', 'ellipseShape', 'lineShape', 'textShape'];
export const isShapeType = (t: string): t is ShapeComponentType => (SHAPE_TYPES as readonly string[]).includes(t);

// `fill: Fill` (Faza §394, 2026-10-19, user: "dodaj gradienty na pewno") — POSZERZENIE typu
// (`string | GradientFill`, `gradientFill.ts`), nie rename/migracja: stare, persystowane itemy
// z płaskim hex-em dalej są poprawnym `Fill` bez żadnej zmiany danych.
export interface RectShapeStyle {
  fill: Fill;
  stroke: string | null; // null = brak obrysu
  strokeWidth: number;    // REALNE piksele (§387, patrz komentarz wyżej) — nie jednostki 0-100
  cornerRadius: number;   // REALNE piksele, klamrowane w ShapeTile.tsx do połowy krótszej krawędzi
  opacity: number;        // 0.1-1
}
export interface EllipseShapeStyle {
  fill: Fill;
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
  // `color: Fill` (Faza §402, 2026-10-19) — user: "gradient na tekście". POSZERZENIE typu
  // (`string | GradientFill`, ten sam, już ustalony wzorzec co `RectShapeStyle.fill`/§394) —
  // stare, persystowane instancje z płaskim hex-em dalej są poprawnym `Fill`, zero migracji.
  // Pole NIE przemianowane na `fill` (mimo że to by pasowało do reszty kształtów) — zmiana
  // KLUCZA, nie tylko typu, złamałaby persystowane dane (`persist` merge nie przemianowuje
  // pól). Renderowane jako SVG `<SvgText fill="url(#...)">` TYLKO gdy gradient (patrz
  // `ShapeTile.tsx`) — płaski kolor renderuje się jak dotąd, zwykłym RN `<Text>` (wieloliniowe,
  // bez zmiany zachowania).
  color: Fill;
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
