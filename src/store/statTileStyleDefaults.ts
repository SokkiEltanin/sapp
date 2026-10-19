// Typ komponentu "Wykres" na wolnym płótnie (Faza 4, 2026-10-19, §386) — user: "chcę... też
// wykresów". Celowo NIE reużywa pełnego `StatTile.tsx`/`CustomTile` z dashboardu wprost (ten
// ma własne, dashboardowe sprzężenie — `updateCustomTile`/`pixelDayCache`, interaktywny stan
// 'compare'/'pixels' wymagający danych nieobecnych poza dashboardem) — zamiast tego lekki,
// samodzielny renderer (`StatCanvasTile.tsx`) wołający te same, czyste funkcje rejestru
// (`metricNumber`/`metricSeries` z `statWidgets.ts`) i ten sam `WaveChart`, ale z WŁASNYM,
// mniejszym stylem dopasowanym do slotu `CanvasItem.style`. v1 celowo ogranicza się do
// `viz: 'number' | 'wave'` (dwa najprostsze, najbardziej "wykresowe" z sześciu wariantów
// dashboardu) — 'compare'/'donut'/'list'/'pixels' wymagają dodatkowych podpięć (drugi
// metric/cache per-dzień/rozbicie kategorii) i są świadomie odłożone, patrz NEXT_STEPS.md.
export interface StatTileCanvasStyle {
  period: 'week' | 'month';
  viz: 'number' | 'wave';
  // Zakres punktów serii dla `viz: 'wave'` (Faza §389, user: "wybierać ile tych dni, jakie
  // zakresy dniowe/tyg./miesięczne") — `metricSeries(metric, ctx, period, n, tag?)` w
  // `statWidgets.ts` już PRZYJMOWAŁ `n` (domyślnie 6), tylko nigdzie nie było to wystawione.
  // Opcjonalne (`?`), nie wymagane — stare, persystowane itemy sprzed tej fazy nie mają tego
  // pola (shallow `persist` merge nie dogania pól WEWNĄTRZ elementów tablicy, ten sam powód co
  // `CanvasItem.zIndex`) — `?? 6` na miejscu odczytu w `StatCanvasTile.tsx` dogania domyślną
  // wartość, którą miały wszystkie instancje PRZED tą fazą. Nieużywane dla `viz: 'number'`
  // (ta wariacja nie rysuje serii, tylko jedną wartość z `metricNumber`).
  rangeN?: number;
  // Zaokrąglenie/precyzja (Faza §397, 2026-10-19, NEXT_STEPS.md punkt 6 — "jakie zaokrąglenia
  // danych") — OPCJONALNE (stare instancje bez tego pola = dotychczasowe zachowanie,
  // `fmtStat()`'s wbudowana logika per-metryka). Gdy ustawione, `StatCanvasTile.tsx` dla
  // `viz: 'number'` pokazuje `value.toFixed(decimals)` ZAMIAST `fmtStat()` — jednostka wciąż
  // widoczna w nagłówku (`unitChip`), więc nic się nie gubi, tylko samą liczbę user kontroluje
  // dokładniej niż zaszyta na sztywno logika `fmtStat`. Nieużywane dla `viz: 'wave'` (ta
  // wariacja nie rysuje liczby jako tekstu).
  decimals?: number;
}

export const DEFAULT_STAT_TILE_STYLE: StatTileCanvasStyle = { period: 'month', viz: 'number' };
