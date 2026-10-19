// Gradient wypełnienia (Faza §394, 2026-10-19) — user: "dodaj gradienty na pewno". Wspólny typ
// dla kształtów (`rectShape`/`ellipseShape`, `shapeStyleDefaults.ts`) i paska progresu
// (`progressBarStyleDefaults.ts`) — JEDNA zmiana modelu dla obu typów naraz, zamiast dwóch
// osobnych mechanizmów. `string` (istniejące dane — zarówno kolory shapes jak i progressBar z
// §393) ZOSTAJE poprawnym `Fill` — to POSZERZENIE typu (union), NIE rename/migracja: stare,
// persystowane itemy z płaskim hex-em dalej działają bez żadnej zmiany.
export interface GradientFill {
  type: 'gradient';
  // v1: ZAWSZE dokładnie 2 stopy — prostsza UI (dwa pickery koloru, nie lista o zmiennej
  // długości) i najczęstszy, najbardziej czytelny przypadek. Jeśli user zechce więcej stopów,
  // to naturalne rozszerzenie na `stops: string[]` (2+) w kolejnej fazie, bez zmiany reszty.
  stops: [string, string];
  direction: 'right' | 'down' | 'diagonalDown' | 'diagonalUp';
}

export type Fill = string | GradientFill;

export function isGradientFill(f: Fill): f is GradientFill {
  return typeof f === 'object' && f !== null;
}

// Punkty start/end 0..1 (znormalizowane, zgodne z `expo-linear-gradient`'s `start`/`end` I
// `react-native-svg`'s `LinearGradient` w domyślnych `objectBoundingBox` units) — jedna funkcja,
// dwa renderery (`ShapeTile.tsx` dla SVG, `ProgressBarTile.tsx` dla plain RN View).
export function gradientPoints(direction: GradientFill['direction']): { start: { x: number; y: number }; end: { x: number; y: number } } {
  switch (direction) {
    case 'right': return { start: { x: 0, y: 0 }, end: { x: 1, y: 0 } };
    case 'down': return { start: { x: 0, y: 0 }, end: { x: 0, y: 1 } };
    case 'diagonalDown': return { start: { x: 0, y: 0 }, end: { x: 1, y: 1 } };
    case 'diagonalUp': return { start: { x: 0, y: 1 }, end: { x: 1, y: 0 } };
  }
}

export function makeGradientFill(base: string, second = '#1E293B'): GradientFill {
  return { type: 'gradient', stops: [base, second], direction: 'right' };
}
