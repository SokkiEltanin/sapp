// Cross-metric weekly/daily correlations for the dashboard "Zależności" insight.
//
// Only metrics that are genuinely measured PER DAY are used (sleep, steps, mood,
// daily spend) — receipt kcal is deliberately excluded because a purchase day is
// not an eating day, so it would correlate noise. Pearson r over the days where
// both metrics are present; we surface the strongest few as plain Polish.

export type CorrKey = 'sleepH' | 'steps' | 'mood' | 'spend';

export interface DailyPoint {
  sleepH?: number;   // hours slept
  steps?: number;
  mood?: number;     // 1–5 average
  spend?: number;    // zł spent that day
}

const MIN_N = 8;     // need at least this many overlapping days to claim anything
const MIN_R = 0.35;  // below this it's just noise

function pearson(xs: number[], ys: number[]): number {
  const n = xs.length;
  if (n === 0) return 0;
  const mx = xs.reduce((a, b) => a + b, 0) / n;
  const my = ys.reduce((a, b) => a + b, 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (let i = 0; i < n; i++) {
    const dx = xs[i] - mx, dy = ys[i] - my;
    sxy += dx * dy; sxx += dx * dx; syy += dy * dy;
  }
  const d = Math.sqrt(sxx * syy);
  return d === 0 ? 0 : sxy / d;
}

const PAIRS: { a: CorrKey; b: CorrKey; pos: string; neg: string }[] = [
  { a: 'sleepH', b: 'mood',  pos: 'Gdy śpisz dłużej, masz lepszy nastrój',          neg: 'Dłuższy sen idzie u Ciebie w parze z gorszym nastrojem' },
  { a: 'steps',  b: 'mood',  pos: 'Więcej kroków — lepszy nastrój',                 neg: 'Więcej kroków, a gorszy nastrój' },
  { a: 'sleepH', b: 'steps', pos: 'Po lepszym śnie robisz więcej kroków',           neg: 'Po dłuższym śnie robisz mniej kroków' },
  { a: 'spend',  b: 'mood',  pos: 'W dni z większymi wydatkami masz lepszy nastrój', neg: 'W dni z większymi wydatkami masz gorszy nastrój' },
  { a: 'sleepH', b: 'spend', pos: 'Po krótszym śnie wydajesz więcej',               neg: 'Po dłuższym śnie wydajesz więcej' },
];

export interface CorrelationInsight { text: string; strength: number }

export function correlationInsights(points: DailyPoint[]): CorrelationInsight[] {
  const out: CorrelationInsight[] = [];
  for (const p of PAIRS) {
    const xs: number[] = [], ys: number[] = [];
    for (const pt of points) {
      const av = pt[p.a], bv = pt[p.b];
      if (av == null || bv == null || !isFinite(av) || !isFinite(bv)) continue;
      xs.push(av); ys.push(bv);
    }
    if (xs.length < MIN_N) continue;
    const r = pearson(xs, ys);
    if (!isFinite(r) || Math.abs(r) < MIN_R) continue;
    // 'spend↔mood' sign flips meaning vs the others; the wording already encodes it.
    const label = Math.abs(r) >= 0.6 ? 'wyraźnie' : Math.abs(r) >= 0.45 ? 'zauważalnie' : 'lekko';
    out.push({ text: `${r >= 0 ? p.pos : p.neg} (${label}, ${xs.length} dni)`, strength: Math.abs(r) });
  }
  return out.sort((a, b) => b.strength - a.strength).slice(0, 3);
}
