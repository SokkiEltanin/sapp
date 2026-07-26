import AsyncStorage from '@react-native-async-storage/async-storage';
import backfill from '@/data/samsungBackfill.json';

// One-time historical backfill from a Samsung Health export (parsed offline into
// samsungBackfill.json — a compact array per day). Fills the SAME per-day cache the
// watch auto-sync writes (`health_YYYY-MM-DD`) so old days show up in the charts,
// weight trend, records and calorie engine. Conservative: only fills a field that
// isn't already set, so it NEVER clobbers manual edits or fresher watch data.
//
// Row shape: [date, steps, sleepMin, weightKg, totalCal, activeCal, bmr]
type Row = [string, number, number, number, number, number, number];

export const BACKFILL_KEY = 'samsung_backfill_done_v1';

function qualityFromMinutes(min: number): string | undefined {
  if (min <= 0) return undefined;
  const h = min / 60;
  if (h < 5) return 'poor';
  if (h < 6.5) return 'fair';
  if (h < 7) return 'good';
  if (h <= 9) return 'excellent';
  return 'good';
}

export function backfillRange(): { days: number; from: string; to: string } {
  const rows = backfill as Row[];
  return { days: rows.length, from: rows[0]?.[0] ?? '', to: rows[rows.length - 1]?.[0] ?? '' };
}

export async function isBackfillDone(): Promise<boolean> {
  try { return !!(await AsyncStorage.getItem(BACKFILL_KEY)); } catch { return false; }
}

export async function runSamsungBackfill(): Promise<{ filled: number; total: number }> {
  const rows = backfill as Row[];
  const keys = rows.map(r => `health_${r[0]}`);
  const existing = new Map<string, string | null>();
  // read in chunks (multiGet on 1000+ keys at once can choke on some devices)
  for (let i = 0; i < keys.length; i += 300) {
    const pairs = await AsyncStorage.multiGet(keys.slice(i, i + 300));
    for (const [k, v] of pairs) existing.set(k, v);
  }

  const writes: [string, string][] = [];
  let latestWeight: { date: string; kg: number } | null = null;

  for (const [date, steps, sleepMin, weight, totalCal, activeCal, bmr] of rows) {
    const key = `health_${date}`;
    let prev: any = {};
    const raw = existing.get(key);
    if (raw) { try { prev = JSON.parse(raw); } catch {} }
    const next: any = { ...prev };
    let changed = false;

    if (steps > 0 && !(Number(prev.steps) > 0)) { next.steps = steps; changed = true; }
    if (sleepMin > 0 && !(Number(prev.sleepH) > 0 || Number(prev.sleepM) > 0)) {
      next.sleepH = Math.floor(sleepMin / 60); next.sleepM = sleepMin % 60; next.sleepQuality = qualityFromMinutes(sleepMin); changed = true;
    }
    if (weight > 0 && !(Number(prev.weight) > 0)) { next.weight = weight; changed = true; }
    if (weight > 0) { if (!latestWeight || date > latestWeight.date) latestWeight = { date, kg: weight }; }

    if (totalCal > 0 || activeCal > 0 || bmr > 0) {
      const hc = { ...(prev.hc ?? {}) };
      let hcChanged = false;
      if (totalCal > 0 && !(Number(hc.totalCalories) > 0)) { hc.totalCalories = totalCal; hcChanged = true; }
      if (activeCal > 0 && !(Number(hc.activeCalories) > 0)) { hc.activeCalories = activeCal; hcChanged = true; }
      if (bmr > 0 && !(Number(hc.bmr) > 0)) { hc.bmr = bmr; hcChanged = true; }
      if (hcChanged) { next.hc = hc; changed = true; }
    }

    if (changed) writes.push([key, JSON.stringify(next)]);
  }

  for (let i = 0; i < writes.length; i += 200) await AsyncStorage.multiSet(writes.slice(i, i + 200));

  // seed last-known weight if none stored yet (so the weight card has a value)
  if (latestWeight) {
    const cur = await AsyncStorage.getItem('health_last_weight').catch(() => null);
    if (!(Number(cur) > 0)) await AsyncStorage.setItem('health_last_weight', String(latestWeight.kg)).catch(() => {});
  }

  await AsyncStorage.setItem(BACKFILL_KEY, new Date().toISOString());
  return { filled: writes.length, total: rows.length };
}
