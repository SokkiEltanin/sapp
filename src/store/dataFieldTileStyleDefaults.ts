// Styl kafla "pole danych" (Faza 27, 2026-10-17, §358) — generyczny data-binding, user: "...
// potem podpisanie danych itp itd" (po AskUserQuestion: pełny edytor jak Figma). Pure TS z tego
// samego powodu co `countdownTileStyleDefaults.ts`/`notesTileStyleDefaults.ts`/
// `shapeStyleDefaults.ts` — `canvasComponentsStore.ts` importuje to bez ciągnięcia drzewa RN.
export interface DataFieldTileStyle {
  color: string;
  fontSize: number;
  bold: boolean;
  align: 'left' | 'center' | 'right';
  showLabel: boolean; // np. "Poziom pupila" nad wartością, czy sama wartość
  cornerRadius: number;
  opacity: number;
}

export const DEFAULT_DATA_FIELD_TILE_STYLE: DataFieldTileStyle = {
  color: '#FFFFFF', fontSize: 20, bold: true, align: 'left', showLabel: true, cornerRadius: 14, opacity: 1,
};
