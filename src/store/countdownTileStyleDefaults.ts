// Typ/default stylu kafla odliczania na wolnym płótnie, WYDZIELONE z `CountdownTile.tsx`
// (2026-10-17, §349) — ten plik NIE importuje 'react-native', więc `canvasComponentsStore.ts`
// (store, nie komponent) może go bezpiecznie importować bez ciągnięcia za sobą całego
// drzewa komponentów RN. Powód identyczny do tego, czemu `StreakTileStyle`/
// `DEFAULT_STREAK_TILE_STYLE` żyją w `streakTileStyleStore.ts`, nie w `StreakTile.tsx` — ale
// dla `CountdownTile` (Faza 17) to rozdzielenie nigdy nie zostało zrobione, bo nic wcześniej
// nie próbowało testować `canvasComponentsStore.ts` bezpośrednio w jest (`testEnvironment:
// 'node'`, `transformIgnorePatterns` nie transpiluje `react-native`) — pierwszy test
// (`canvasComponentsStore.test.ts`, grupowanie §349) to wykrył: import łańcuch
// `canvasComponentsStore.ts` → `CountdownTile.tsx` → `'react-native'` wywalał cały test
// suite przy samym `import`. `CountdownTile.tsx` importuje stąd i re-eksportuje oba symbole —
// zero zmiany dla istniejących konsumentów (`CanvasCountdownStyleModal.tsx`/`ScreenCanvas.tsx`
// dalej importują z `CountdownTile.tsx` jak dotąd).
// Warianty kształtu (Faza 24, 2026-10-17, §355) — user, zrzutem ekranu zakładki "Odliczania"
// w Kreatorze: "nie ma możliwości wyboru własnego kształtu od zera". Do tej pory Odliczania
// miały JEDEN, stały układ (pierścień+tekst w rzędzie) — tylko liczbowe suwaki (rozmiar/
// grubość pierścienia). `'ring'` = dokładnie dotychczasowy wygląd (default, zero zmiany dla
// nikogo kto nie dotknie nowego wyboru). `'bar'` = pasek postępu zamiast pierścienia (lepszy
// przy szerokich, niskich kaflach — pierścień marnuje tam pionową przestrzeń). `'compact'` =
// jedna linijka tekstu, zero grafiki postępu (najgęstszy, do małych instancji na płótnie).
// `'hero'` = duża liczba dni na środku (jak klasyczny styl serii) — dni jako GŁÓWNY element
// wizualny, nie dodatek przy pierścieniu.
export type CountdownLayoutPreset = 'ring' | 'bar' | 'compact' | 'hero';

export interface CountdownTileStyle {
  layoutPreset: CountdownLayoutPreset;
  cornerRadius: number;
  ringSize: number;
  ringStrokeWidth: number;
  numberScale: number; // tylko 'hero' — rozmiar dużej liczby dni
}

export const DEFAULT_COUNTDOWN_TILE_STYLE: CountdownTileStyle = {
  layoutPreset: 'ring',
  cornerRadius: 16,
  ringSize: 56,
  ringStrokeWidth: 6,
  numberScale: 1,
};
