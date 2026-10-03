// Czyste helpery dla app/water-calendar.tsx (2026-10-03) — wydzielone z komponentu, bo
// `water-calendar.tsx` importuje react-native-svg/expo-router (nie da się go zaimportować
// w teście bez mockowania RN), a ta logika (tier koloru, formatowanie dnia) ma realne
// przypadki brzegowe (granice kwintyli, "dziś"/"wczoraj" na przełomie miesiąca) warte
// pokrycia testem — ten sam wzorzec co weekChips.ts/taskReward.ts z wcześniejszych sesji.

export function pad2(n: number): string { return String(n).padStart(2, '0'); }
export function ymd(d: Date): string { return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; }

export function fmtDay(ds: string, todayKey: string): string {
  if (ds === todayKey) return 'Dziś';
  const y = new Date(todayKey);
  y.setDate(y.getDate() - 1);
  if (ds === ymd(y)) return 'Wczoraj';
  const [yy, mm, dd] = ds.split('-');
  return `${Number(dd)}.${mm}.${yy}`;
}

// Alpha-suffix (hex) dla koloru akcentu wg stosunku wypitej ilości do celu dnia — pusty
// string = brak koloru (dzień pusty, kafelek dostaje neutralne tło). 5 kwintyli, 1.0+ → pełna.
const SHADE_ALPHA = ['22', '55', '88', 'BB', 'FF'];
export function tierAlpha(count: number, goal: number): string {
  if (count <= 0) return '';
  const ratio = Math.min(1, count / Math.max(1, goal));
  return SHADE_ALPHA[Math.min(4, Math.max(0, Math.ceil(ratio * 5) - 1))];
}
