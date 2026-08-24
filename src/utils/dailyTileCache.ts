import AsyncStorage from '@react-native-async-storage/async-storage';

// Generic "compute once per calendar day, reuse until tomorrow" cache — for dashboard
// widgets that are historical/statistical rather than actionable, so same-day staleness
// is an acceptable trade for not redoing expensive work on every render.
//
// (2026-08-24, user: "ogólnie na wejście apki laguje" → traced to `renderStatTile`'s
// viz==='pixels' branch (index.tsx): `dailyValue()` scans the FULL expense/task/health
// history for EACH of 365 days, and this ran on every dashboard re-render — not just
// when the underlying data actually changed — because the whole `nodes` block that calls
// it isn't memoized, and `YearPixels`'s OWN internal useMemo was silently defeated by a
// fresh `valueFor` closure every render anyway. User's own framing: "EVENTY/KALENDARZ/
// ZADANIA/PUPIL/NAWYKI/KROKI/SEN/FINANSE" stay live/eager, but widgets like "Rok w
// pikselach" are fine loading "raz na dzień w tle" (once a day, in the background) —
// this util is that mechanism, persisted to AsyncStorage so it survives app restarts
// within the same day, not just the current session.)
const PREFIX = 'daily_tile_cache_v1:';

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

interface CacheEntry<T> { date: string; value: T }

// Returns the cached value if it was computed TODAY, else undefined (cache miss —
// caller should compute fresh and call setDailyCached).
export async function getDailyCached<T>(key: string): Promise<T | undefined> {
  try {
    const raw = await AsyncStorage.getItem(PREFIX + key);
    if (!raw) return undefined;
    const entry: CacheEntry<T> = JSON.parse(raw);
    return entry.date === todayStr() ? entry.value : undefined;
  } catch {
    return undefined;
  }
}

export async function setDailyCached<T>(key: string, value: T): Promise<void> {
  try {
    const entry: CacheEntry<T> = { date: todayStr(), value };
    await AsyncStorage.setItem(PREFIX + key, JSON.stringify(entry));
  } catch {}
}
