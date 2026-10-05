// Silnik korelacji „co na Ciebie wpływa" — Pearson po dopasowanych dniach między metrykami
// self-care (sen, energia, humor, słodycze, praca, kroki). Czysty → testowalny w node.
//
// Sama matematyka Pearsona żyje teraz w `statsPearson.ts` (2026-10-05, audyt) — współdzielona
// z `../correlations.ts` (ten sam silnik, inne okno dni i inny zestaw metryk, więc MIN_N/MIN_R
// NIŻEJ zostają własne, celowo: insightLinks patrzy tylko na ostatnie 30 dni, więc MIN_N=5
// żeby cokolwiek w ogóle miało szansę się zakwalifikować; `../correlations.ts` ciągnie z
// całej historii, więc może sobie pozwolić na MIN_N=8 bez ryzyka wiecznej pustki).
import { pearsonCoeff } from '@/utils/statsPearson';

export type MetricKey = 'sleep' | 'mood' | 'energy' | 'sweets' | 'work' | 'steps' | 'weather';

export interface DailyMetrics {
  sleep?: number;   // minuty snu
  mood?: number;    // 1–5
  energy?: number;  // 1–5
  sweets?: number;  // liczba/kcal słodyczy tego dnia
  work?: number;    // godziny pracy
  steps?: number;
  weather?: number; // średnia temperatura dnia (°C)
}

export interface Link {
  a: MetricKey;
  b: MetricKey;
  r: number;                              // -1..1
  n: number;                              // liczba dopasowanych dni
  strength: 'silna' | 'umiarkowana';
  positive: boolean;                      // true = rośnie razem
}

const MIN_N = 5;        // min dni z obiema metrykami
const MIN_R = 0.35;     // słabsze = szum, nie pokazujemy

// Pearson po parach; null gdy za mało par lub brak wariancji (płaska seria).
export function pearson(pairs: [number, number][]): number | null {
  if (pairs.length < MIN_N) return null;
  return pearsonCoeff(pairs.map(p => p[0]), pairs.map(p => p[1]));
}

// Pary, które mają sens (kierunek: a → wpływ na b).
const PAIRS: [MetricKey, MetricKey][] = [
  ['sleep', 'energy'], ['sleep', 'mood'],
  ['sweets', 'mood'], ['sweets', 'energy'],
  ['work', 'mood'], ['work', 'energy'],
  ['steps', 'energy'], ['steps', 'mood'],
  ['weather', 'mood'], ['weather', 'energy'], ['weather', 'steps'],
];

// Najsilniejsze wiarygodne powiązania (posortowane wg |r|), max `max`.
export function strongestLinks(days: DailyMetrics[], max = 4): Link[] {
  const links: Link[] = [];
  for (const [a, b] of PAIRS) {
    const pairs: [number, number][] = [];
    for (const d of days) {
      const va = d[a], vb = d[b];
      if (va == null || vb == null) continue;
      pairs.push([va, vb]);
    }
    const r = pearson(pairs);
    if (r == null || Math.abs(r) < MIN_R) continue;
    links.push({ a, b, r, n: pairs.length, strength: Math.abs(r) >= 0.6 ? 'silna' : 'umiarkowana', positive: r > 0 });
  }
  links.sort((x, y) => Math.abs(y.r) - Math.abs(x.r));
  return links.slice(0, max);
}
