import AsyncStorage from '@react-native-async-storage/async-storage';
import { isHealthConnectAvailable, readHealthRange } from './healthConnectService';

// Mirrors the Zdrowie screen's per-day cache (`health_YYYY-MM-DD`) from the watch
// WITHOUT any UI. The screen only ever wrote *today's* key while it was open, so
// days the app wasn't opened silently dropped their steps/sleep from the history
// that the dashboard, achievements and calorie engine read via getHealthHistory.
// This backfills the whole recent window straight from Health Connect.
//
// Silent + best-effort: no-ops when Health Connect is unavailable or access
// wasn't granted (the reads return null/empty and never throw). Weight is treated
// carefully — a value already stored for a day (a manual override) is never
// clobbered; the watch only fills days that have none.

type Quality = 'poor' | 'fair' | 'good' | 'excellent';
function qualityFromMinutes(min: number): Quality | undefined {
  if (min <= 0) return undefined;
  const h = min / 60;
  if (h < 5) return 'poor';
  if (h < 6.5) return 'fair';
  if (h < 7) return 'good';
  if (h <= 9) return 'excellent';
  return 'good'; // oversleeping
}

let _lastRun = 0;
let _running = false;
const THROTTLE_MS = 10 * 60 * 1000; // don't hammer the watch — 10 min between runs

// Returns how many day-keys were written (0 = nothing to do / skipped).
export async function autoSyncHealth(days = 30, force = false): Promise<number> {
  if (!isHealthConnectAvailable()) return 0;
  const now = Date.now();
  if (!force && (_running || now - _lastRun < THROTTLE_MS)) return 0;
  _running = true;
  try {
    const range = await readHealthRange(days);
    if (!range || !range.length) { _lastRun = now; return 0; }

    const keys = range.map(p => `health_${p.date}`);
    const existingByKey = new Map((await AsyncStorage.multiGet(keys)).map(([k, v]) => [k, v]));

    const writes: [string, string][] = [];
    let latestWeight: number | null = null;
    for (const p of range) {
      if (!(p.steps > 0 || p.sleepMinutes > 0 || p.weightKg != null)) continue; // empty day
      const key = `health_${p.date}`;
      let prev: any = {};
      const raw = existingByKey.get(key);
      if (raw) { try { prev = JSON.parse(raw); } catch {} }

      const next: any = { ...prev };
      if (p.steps > 0) next.steps = p.steps;                       // watch is source-of-truth
      if (p.sleepMinutes > 0) {
        next.sleepH = Math.floor(p.sleepMinutes / 60);
        next.sleepM = p.sleepMinutes % 60;
        next.sleepQuality = qualityFromMinutes(p.sleepMinutes);
      }
      if (p.weightKg != null && !(Number(prev.weight) > 0)) next.weight = p.weightKg; // don't override manual
      if (p.weightKg != null) latestWeight = p.weightKg;            // range is oldest→newest, so last wins
      writes.push([key, JSON.stringify(next)]);
    }

    if (writes.length) await AsyncStorage.multiSet(writes);
    if (latestWeight != null) await AsyncStorage.setItem('health_last_weight', String(latestWeight)).catch(() => {});
    _lastRun = now;
    return writes.length;
  } catch {
    return 0;
  } finally {
    _running = false;
  }
}
