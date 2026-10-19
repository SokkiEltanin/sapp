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
  // Przezroczystość TŁA-KARTY (Faza §401, 2026-10-19) — NIE opacity całego kafla (dawne,
  // nigdy niewystawione w UI zachowanie `DataFieldTile.tsx` blakło TEKST razem z tłem, co i
  // tak nie miało znaczenia bo nic nie dało się tego ustawić — pole istniało, ale
  // `CanvasDataFieldStyleModal.tsx` nigdy go nie pokazywało). Teraz: wpływa WYŁĄCZNIE na
  // `backgroundColor`-alfa karty (wmieszane w hex, ten sam wzorzec co `c.accent.blue + '18'`
  // wszędzie indziej w appce), tekst zawsze w pełni czytelny niezależnie od wartości.
  // Używane TYLKO gdy `background==='card'` — dla `'none'` nie ma czego robić przezroczystym.
  opacity: number;
  // Tło (Faza §401) — user: "jak dodaje datę to powinien być tekst sam a nie kafelek,
  // któremu nawet nie mogę nadać przezroczystych [tła]". OPCJONALNE — stare, persystowane
  // instancje bez tego pola (sprzed §401) renderują się `?? 'card'` = DOKŁADNIE jak dotąd
  // (kafelek z kartą w tle, `boxed` było dotąd ZASZYTE NA SZTYWNO w `ScreenCanvas.tsx`, nie
  // konfigurowalne wcale). `'none'` = czysty tekst, bez karty/paddingu — to, o co user prosił
  // dla pola daty.
  background?: 'card' | 'none';
}

export const DEFAULT_DATA_FIELD_TILE_STYLE: DataFieldTileStyle = {
  color: '#FFFFFF', fontSize: 20, bold: true, align: 'left', showLabel: true, cornerRadius: 14, opacity: 1, background: 'card',
};
