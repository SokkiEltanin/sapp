import { ScreenOpenEvent } from '@/store/usageStatsStore';

// Agregacje nad `usageStatsStore.events` (log otwarć ekranów, §102) na potrzeby panelu
// "Statystyki" (app/usage-stats.tsx) — czyste funkcje, żeby dały się testować bez mocka
// Zustand/AsyncStorage. `now` jest parametrem (nie `new Date()` w środku) tylko w
// `bucketByDay`, gdzie "dziś" faktycznie wpływa na wynik — testy mogą podać stały punkt
// odniesienia zamiast być zależne od zegara uruchomienia.

function pad(n: number): string { return String(n).padStart(2, '0'); }
function dayKey(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export interface DayBucket {
  dateStr: string; // YYYY-MM-DD
  count: number;
  isToday: boolean;
}

// Otwarcia dziennie dla ostatnich `days` dni (włącznie z dziś), najstarszy dzień pierwszy —
// gotowe do wykresu słupkowego lewo→prawo. Dni bez ani jednego otwarcia dostają `count: 0`
// (nie są pomijane), żeby przerwy w używaniu apki były widoczne jako luki, nie zniekształcały
// skali wykresu.
export function bucketByDay(events: ScreenOpenEvent[], days: number, now: Date = new Date()): DayBucket[] {
  const counts = new Map<string, number>();
  for (const e of events) {
    const key = dayKey(new Date(e.at));
    counts.set(key, (counts.get(key) ?? 0) + 1);
  }
  const todayKey = dayKey(now);
  const buckets: DayBucket[] = [];
  for (let i = days - 1; i >= 0; i--) {
    const d = new Date(now);
    d.setDate(now.getDate() - i);
    const key = dayKey(d);
    buckets.push({ dateStr: key, count: counts.get(key) ?? 0, isToday: key === todayKey });
  }
  return buckets;
}

export interface HourBucket {
  hour: number; // 0-23, lokalny czas urządzenia
  count: number;
}

// Rozkład otwarć wg godziny dnia (lokalny czas) — "o której porze dnia najczęściej
// korzystam z apki".
export function bucketByHour(events: ScreenOpenEvent[]): HourBucket[] {
  const counts = new Array(24).fill(0);
  for (const e of events) counts[new Date(e.at).getHours()]++;
  return counts.map((count, hour) => ({ hour, count }));
}

// Najstarsze zdarzenie w logu — do pokazania "dane od ...". `null` gdy log pusty
// (świeży install/dopiero co włączone liczenie).
export function oldestEventDate(events: ScreenOpenEvent[]): Date | null {
  if (events.length === 0) return null;
  return new Date(events.reduce((min, e) => Math.min(min, e.at), events[0].at));
}
