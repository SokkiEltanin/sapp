// Czysta logika kolorów — wydzielona z `ColorSwatchPicker.tsx` (komponent RN) żeby była
// testowalna w jest (`testEnvironment: 'node'` nie transpiluje 'react-native', ten sam powód
// co `countdownTileStyleDefaults.ts`/`notesTileStyleDefaults.ts`, §349/§350).
export function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(s)) return null;
  return `#${s.toUpperCase()}`;
}

// HSV↔HEX (Faza §388, user: "żebym miał paletę taką a nie wpisywał tylko HEX") — wspólna
// matematyka dla nowego `ColorPickerPanel.tsx` (panel nasycenie/jasność + pasek odcienia, jak
// w Figmie/Canvie). `h` w stopniach [0,360), `s`/`v` [0,1]. Pure TS, zero importu `react-native`
// — testowalne w `testEnvironment: 'node'`, ten sam powód co `normalizeHex` wyżej.
export interface Hsv { h: number; s: number; v: number }

export function hexToHsv(hex: string): Hsv {
  const n = normalizeHex(hex) ?? '#000000';
  const r = parseInt(n.slice(1, 3), 16) / 255;
  const g = parseInt(n.slice(3, 5), 16) / 255;
  const b = parseInt(n.slice(5, 7), 16) / 255;
  const max = Math.max(r, g, b), min = Math.min(r, g, b);
  const d = max - min;
  let h = 0;
  if (d !== 0) {
    if (max === r) h = ((g - b) / d) % 6;
    else if (max === g) h = (b - r) / d + 2;
    else h = (r - g) / d + 4;
    h *= 60;
    if (h < 0) h += 360;
  }
  const v = max;
  const s = max === 0 ? 0 : d / max;
  return { h, s, v };
}

export function hsvToHex(h: number, s: number, v: number): string {
  const hh = ((h % 360) + 360) % 360;
  const c = v * s;
  const x = c * (1 - Math.abs(((hh / 60) % 2) - 1));
  const m = v - c;
  let r = 0, g = 0, b = 0;
  if (hh < 60) { r = c; g = x; b = 0; }
  else if (hh < 120) { r = x; g = c; b = 0; }
  else if (hh < 180) { r = 0; g = c; b = x; }
  else if (hh < 240) { r = 0; g = x; b = c; }
  else if (hh < 300) { r = x; g = 0; b = c; }
  else { r = c; g = 0; b = x; }
  const toByte = (ch: number) => Math.round((ch + m) * 255).toString(16).padStart(2, '0').toUpperCase();
  return `#${toByte(r)}${toByte(g)}${toByte(b)}`;
}
