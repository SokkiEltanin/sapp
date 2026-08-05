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
