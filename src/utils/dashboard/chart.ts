// Czyste transformacje serii danych pod wykresy dashboardu — wyniesione z app/(tabs)/index.tsx
// (krok 1). Bez zależności od RN/store'ów → testowalne w node.

// Wagi (i inne serie „nigdy nie 0"): kubełki bez odczytu mają 0 → przeciągnij ostatnią znaną
// wartość, żeby rzadka seria była CIĄGŁĄ linią, nie skokami do zera.
export function carryForward(values: number[]): number[] {
  const first = values.find(v => v > 0) ?? 0;
  let last = first;
  return values.map(v => (v > 0 ? (last = v) : last));
}

// Ostatnia niezerowa wartość serii (0 gdy same zera / pusto).
export function lastNonZero(values: number[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] > 0) return values[i];
  return 0;
}

// Dolna granica, która „przybliża" wąskie wysokie pasmo (np. waga 71–73 kg), żeby było widać
// wahania zamiast płaskiej linii przy górze. 0 = nie przybliżaj.
export function zoomFloor(values: number[]): number {
  const nz = values.filter(v => v > 0);
  if (nz.length < 2) return 0;
  const lo = Math.min(...nz), hi = Math.max(...nz);
  return (hi - lo > 0 && lo > hi * 0.3) ? Math.max(0, lo - (hi - lo) * 0.5) : 0;
}

// Czy dwie serie metryk poruszają się razem w tych SAMYCH okresach? Pearson po dopasowanych
// niezerowych parach → werdykt słowny do widgetu porównania dwóch metryk (null gdy za mało par).
export function compareVerdict(a: number[], b: number[], mutedColor: string): { text: string; color: string } | null {
  const pairs: [number, number][] = [];
  for (let i = 0; i < a.length; i++) if (a[i] > 0 && (b[i] ?? 0) > 0) pairs.push([a[i], b[i]]);
  if (pairs.length < 3) return null;
  const n = pairs.length;
  const mx = pairs.reduce((s, p) => s + p[0], 0) / n;
  const my = pairs.reduce((s, p) => s + p[1], 0) / n;
  let sxy = 0, sxx = 0, syy = 0;
  for (const [x, y] of pairs) { const dx = x - mx, dy = y - my; sxy += dx * dy; sxx += dx * dx; syy += dy * dy; }
  const r = sxx > 0 && syy > 0 ? sxy / Math.sqrt(sxx * syy) : 0;
  if (r >= 0.4)  return { text: 'Zwykle idą w parze — więcej jednego, więcej drugiego', color: '#2AC68F' };
  if (r <= -0.4) return { text: 'Zwykle przeciwnie — gdy jedno rośnie, drugie spada', color: '#F87171' };
  return { text: 'Bez wyraźnego związku w tych okresach', color: mutedColor };
}
