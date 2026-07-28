import AsyncStorage from '@react-native-async-storage/async-storage';
import { isHealthConnectAvailable, readHealthRange } from './healthConnectService';
import { feedWaterHabit, feedStepsHabit } from '@/utils/habits';
import { getHealthGoals } from '@/utils/healthGoals';
import { useHabitsSync } from '@/store/habitsSync';

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
  // A run in flight is always skipped (dedupe rapid tab switches). `force` only bypasses
  // the 10-min TIME throttle — that throttle was why re-opening the app inside 10 minutes
  // kept showing stale watch data. Screens that want fresh-on-entry pass force:true.
  if (_running) return 0;
  if (!force && now - _lastRun < THROTTLE_MS) return 0;
  _running = true;
  try {
    const range = await readHealthRange(days);
    if (!range || !range.length) { _lastRun = now; return 0; }

    const keys = range.map(p => `health_${p.date}`);
    const existingByKey = new Map((await AsyncStorage.multiGet(keys)).map(([k, v]) => [k, v]));

    const writes: [string, string][] = [];
    let latestWeight: number | null = null;
    for (const p of range) {
      if (!(p.steps > 0 || p.sleepMinutes > 0 || p.weightKg != null || p.activeCalories > 0 || p.totalCalories > 0 || p.bmr > 0)) continue; // empty day
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
      // Calories from the watch → per-day blob (so the food tab / calorie widgets have
      // burn EVERY day, not only when Zdrowie was opened). Merge, never zero-out good data.
      if (p.activeCalories > 0 || p.totalCalories > 0 || p.bmr > 0) {
        const hc = { ...(prev.hc ?? {}) };
        if (p.activeCalories > 0) hc.activeCalories = p.activeCalories;
        if (p.totalCalories > 0) hc.totalCalories = p.totalCalories;
        if (p.bmr > 0) hc.bmr = p.bmr;
        next.hc = hc;
      }
      writes.push([key, JSON.stringify(next)]);
    }

    if (writes.length) await AsyncStorage.multiSet(writes);
    if (latestWeight != null) await AsyncStorage.setItem('health_last_weight', String(latestWeight)).catch(() => {});

    // Woda z Health Connect → nawyk „Woda", PER DZIEŃ z całego okna (nie tylko dziś).
    // Dzięki temu, gdy apka była zamknięta o północy, woda za pominięte dni zalicza się
    // retroaktywnie przy najbliższym otwarciu → seria „Woda" NIE pada. feedWaterHabit
    // używa MAX, więc nigdy nie nadpisze ręcznych stuknięć. (Watch dostarcza wodę tylko
    // jeśli logujesz ją w Samsung Health — bez tego nie ma czego leczyć.)
    try {
      const goals = await getHealthGoals();
      const glassMl = goals.glassMl || 250;
      const stepGoal = goals.stepGoal || 0;
      let anyChanged = false;
      for (const p of range) {
        // woda per dzień (leczy serię „Woda")
        if ((p.hydrationMl ?? 0) > 0) {
          if (await feedWaterHabit(Math.round((p.hydrationMl ?? 0) / glassMl), p.date)) anyChanged = true;
        }
        // kroki per dzień — zalicz habit „Kroki" gdy dzień trafił w cel (leczy serię kroków)
        if (stepGoal > 0 && p.steps >= stepGoal) {
          if (await feedStepsHabit(p.steps, stepGoal, p.date)) anyChanged = true;
        }
      }
      if (anyChanged) useHabitsSync.getState().bump();
    } catch {}

    _lastRun = now;
    return writes.length;
  } catch {
    return 0;
  } finally {
    _running = false;
  }
}
