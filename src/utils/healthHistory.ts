import AsyncStorage from '@react-native-async-storage/async-storage';

// Per-day health logged on the Zdrowie screen (keys: health_YYYY-MM-DD).
// Read in one multiGet so it's cheap to use for cross-domain mood insights.

export interface HealthDayHistory {
  sleepMinutes: number;   // 0 = not logged
  weight: number;         // kg, 0 = not logged
  steps: number;
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

export async function getHealthHistory(days = 60): Promise<Record<string, HealthDayHistory>> {
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
        out[dates[i]] = { sleepMinutes, weight: Number(d.weight) || 0, steps: Number(d.steps) || 0 };
      } catch {}
    });
  } catch {}
  return out;
}
