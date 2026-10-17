// Czysta logika kolorów — wydzielona z `ColorSwatchPicker.tsx` (komponent RN) żeby była
// testowalna w jest (`testEnvironment: 'node'` nie transpiluje 'react-native', ten sam powód
// co `countdownTileStyleDefaults.ts`/`notesTileStyleDefaults.ts`, §349/§350).
export function normalizeHex(input: string): string | null {
  const s = input.trim().replace(/^#/, '');
  if (!/^[0-9A-Fa-f]{6}$/.test(s)) return null;
  return `#${s.toUpperCase()}`;
}
