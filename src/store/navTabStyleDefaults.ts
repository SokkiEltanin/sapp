// Przycisk nawigacji dla Navbaru Pupila (Faza §392, 2026-10-19) — user: "pełna przebudowa jak
// Figma" dla navbaru. BEZ konfigurowalnego stylu (celowo) — wygląd (ikona/kolor akcentu) idzie
// WPROST z podpiętego tabu (`PUPIL_NAV_TABS`, `src/data/pupilNavTabs.ts`), nie z per-instancji
// stylu jak reszta typów. Puste `interface` (NIE `Record<string, never>` — to dodaje niejawny
// index signature `[x: string]: never`, który łamał spready gdzie indziej w `CanvasItem.style`
// unii, np. `{ ...styleItem.style, tierColorOverrides: next }` w `ScreenCanvas.tsx` — TS
// rozdziela spread po unii i `never`-indeksowany człon wymuszał `never` na nowym polu).
// eslint-disable-next-line @typescript-eslint/no-empty-interface
export interface NavTabStyle {}
export const DEFAULT_NAV_TAB_STYLE: NavTabStyle = {};
