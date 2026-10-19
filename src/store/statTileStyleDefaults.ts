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
}

export const DEFAULT_STAT_TILE_STYLE: StatTileCanvasStyle = { period: 'month', viz: 'number' };
