import { MOOD_COLORS } from '@/types';

// Czyste formatery/mapery dashboardu — wyniesione z app/(tabs)/index.tsx (krok 1 utwardzania).
// Bez zależności od store'ów/RN → testowalne w node.

// Kolor dla średniego nastroju (1..5).
export function moodColor(avg: number): string {
  if (avg >= 4.5) return MOOD_COLORS[5];
  if (avg >= 3.5) return MOOD_COLORS[4];
  if (avg >= 2.5) return MOOD_COLORS[3];
  if (avg >= 1.5) return MOOD_COLORS[2];
  return MOOD_COLORS[1];
}

// Polska odmiana rzeczownika „zadanie" (1 zadanie / 2–4 zadania / 5+ zadań, z wyjątkiem 12–14).
export function plTasks(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (n === 1) return 'zadanie';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'zadania';
  return 'zadań';
}

// Etykieta metryki tagowej — rejestrowa etykieta jest generyczna („Wydatki na tag…"), a
// widget musi nazwać KONKRETNY tag.
export function metricTagLabel(def: { label: string; unit: string; needsTag?: boolean } | undefined, tag?: string): string {
  if (def?.needsTag && tag) {
    const kind = def.unit === 'zł' ? 'wydatki' : def.unit === 'kg' ? 'kg' : 'szt.';
    return `${tag.charAt(0).toUpperCase()}${tag.slice(1)} (${kind})`;
  }
  return def?.label ?? '';
}

// Zwięzła etykieta punktu wykresu (wartość nad kropką). Puste dla zera/braku danych.
export function fmtChartPt(v: number, unit: string): string {
  if (!(v > 0)) return '';
  if (unit === 'kg' || unit === 'h' || unit === '/5') return v.toFixed(1).replace('.', ',');
  if (v >= 100000) return `${Math.round(v / 1000)}k`;
  return Math.round(v).toLocaleString('pl-PL');
}

// Wartość liczbowa custom stat-tile'a, uwzględniająca jednostkę (PLN/kg/h/oceny/itd.) —
// wyniesiona z app/(tabs)/index.tsx (2026-09-08, ekstrakcja StatTile) razem z `fmtWave`/
// `unitChip`/`periodCaption` niżej: czyste funkcje bez domknięcia nad stanem komponentu,
// używane zarówno przez `<StatTile>` (components/dashboard/StatTile.tsx) jak i modal
// szczegółów kafelka w index.tsx — jedna definicja zamiast dwóch kopii.
export function fmtStat(v: number, unit: string): string {
  const g = (x: number) => Math.round(x).toLocaleString('pl-PL'); // thousands grouping
  if (unit === 'zł')   return `${g(v)} zł`;
  if (unit === 'kg')   return `${v.toFixed(1).replace('.0', '')} kg`;
  if (unit === 'h')    return `${v.toFixed(1).replace('.0', '')} h`;
  if (unit === '/5')   return v.toFixed(1);
  if (unit === 'szt.') return `${g(v)} szt.`;
  if (unit === '×')    return `×${g(v)}`;
  if (unit === 'dni')  return `${Math.round(v)} dni`;
  if (unit.startsWith('/')) return `${Math.round(v)} ${unit}`; // e.g. habits "/ 5"
  return g(v);
}

// Compact value for above wave points (unit-aware, blank when zero).
export function fmtWave(v: number, unit: string): string {
  if (v <= 0) return '';
  if (unit === 'kg' || unit === 'h') return v.toFixed(1).replace('.0', '');
  if (unit === '/5') return v.toFixed(1);
  return `${Math.round(v)}`;
}

// A clear, human unit for the header chip — so every tile SAYS what it's counting
// (PLN / szt / kg / …), which the bare chart numbers never made obvious.
export function unitChip(unit: string): string {
  switch (unit) {
    case 'zł':   return 'PLN';
    case 'szt.': return 'szt.';
    case '×':    return 'razy';
    case 'kg':   return 'kg';
    case 'h':    return 'godziny';
    case '/5':   return 'ocena /5';
    case 'kroki':return 'kroki';
    case 'dni':  return 'dni';
    default:     return unit.startsWith('/') ? unit : '';
  }
}

// What window the chart covers + what its x-labels mean — kills the "jakie tygodnie?"
// ambiguity (week labels are the Monday of each week).
export function periodCaption(p: 'week' | 'month', count: number): string {
  return p === 'month' ? `Ostatnie ${count} mies.` : `Ostatnie ${count} tyg. · etykieta = poniedziałek tygodnia`;
}

// Komunikat limitu tagu, eskalujący z wykorzystaniem (0..1+).
export function tagLimitMsg(pct: number): string {
  if (pct >= 1)    return 'Przekroczono limit';
  if (pct >= 0.85) return 'Hamuj! Limit prawie wyczerpany';
  if (pct >= 0.6)  return 'Robi się gorąco';
  if (pct >= 0.35) return 'Powoli, powoli';
  if (pct >= 0.15) return 'Kurde, raz Cię pokusiło';
  if (pct > 0)     return 'Na razie idzie dobrze';
  return 'Czysto, zero wydatków';
}
