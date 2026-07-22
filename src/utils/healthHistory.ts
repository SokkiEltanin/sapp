import AsyncStorage from '@react-native-async-storage/async-storage';

// Per-day health logged on the Zdrowie screen (keys: health_YYYY-MM-DD).
// Read in one multiGet so it's cheap to use for cross-domain mood insights.

export interface HealthDayHistory {
  sleepMinutes: number;   // 0 = not logged
  weight: number;         // kg, 0 = not logged
  steps: number;
  burn: number;           // total kcal burned that day (0 = unknown)
}

// The day's total burn from the stored Health Connect blob. Samsung often shares
// only the EXERCISE calories as "total" (a few hundred), which is a nonsense whole
// -day figure — so we only trust totalCalories when it's plausibly a full day
// (>=1200); otherwise BMR + active. Mirrors the Zdrowie energy card so the food
// tab and burn widgets agree with it. 0 = no usable burn data.
export function dailyBurnFromHc(hc: any, fallbackBmr = 0): number {
  if (!hc) return fallbackBmr > 0 ? Math.round(fallbackBmr) : 0;
  const total = Number(hc.totalCalories) || 0;
  if (total >= 1200) return Math.round(total);
  const bmr = Number(hc.bmr) || fallbackBmr || 0;
  const active = Number(hc.activeCalories) || 0;
  // Watch often gives ONLY the activity calories (e.g. 77) with no BMR record. Before,
  // that returned 0 ("nie czyta z zegarka"). Now: BMR (watch or profile) + active, or at
  // least the active/movement calories so the watch value always shows.
  if (bmr > 0) return Math.round(bmr + active);
  return Math.round(active);
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function keyFor(d: Date) { return `health_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function dateStr(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

// Save today's weight (kg) without clobbering the day's other health fields
// (water/steps/sleep). Also updates the "last known weight" seed.
export async function saveTodayWeight(kg: number): Promise<void> {
  if (!(kg > 0)) return;
  const key = keyFor(new Date());
  let obj: Record<string, any> = {};
  try { const raw = await AsyncStorage.getItem(key); if (raw) obj = JSON.parse(raw); } catch {}
  obj.weight = kg;
  await AsyncStorage.setItem(key, JSON.stringify(obj));
  await AsyncStorage.setItem('health_last_weight', String(kg)).catch(() => {});
}

export async function getHealthHistory(days = 60, fallbackBmr = 0): Promise<Record<string, HealthDayHistory>> {
  const keys: string[] = [];
  const dates: string[] = [];
  const today = new Date();
  for (let i = 0; i < days; i++) {
    const d = new Date(today.getFullYear(), today.getMonth(), today.getDate() - i);
    keys.push(keyFor(d));
    dates.push(dateStr(d));
  }
  const out: Record<string, HealthDayHistory> = {};
  try {
    const pairs = await AsyncStorage.multiGet(keys);
    pairs.forEach(([, raw], i) => {
      if (!raw) return;
      try {
        const d = JSON.parse(raw);
        // Legacy fake default: 7h30m with no quality/stages was written automatically
        // before manual sleep existed — treat it as "no data" so it doesn't inflate
        // the sleep average.
        const isFakeSleep = Number(d.sleepH) === 7 && Number(d.sleepM) === 30 && !d.sleepQuality;
        const sleepMinutes = isFakeSleep ? 0 : (Number(d.sleepH) || 0) * 60 + (Number(d.sleepM) || 0);
        out[dates[i]] = { sleepMinutes, weight: Number(d.weight) || 0, steps: Number(d.steps) || 0, burn: dailyBurnFromHc(d.hc, fallbackBmr) };
      } catch {}
    });
  } catch {}
  return out;
}
