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
// Ruch (aktywne kcal) oszacowany z KROKÓW — waga-skalowany. Samsung eksportuje kroki
// do Health Connect PEWNIE (naprawione: stepsBySourceMax), a aktywne kalorie RZADKO —
// więc kroki to najlepszy fallback. ~0.0005 kcal/krok/kg (≈ 0.036 kcal/krok @72kg;
// 10k kroków @72kg ≈ 360 kcal). Nigdy nie zaniża — bierzemy MAX z pomiarem zegarka.
export function activeFromSteps(steps: number, weightKg: number): number {
  if (!(steps > 0)) return 0;
  const kg = weightKg > 0 ? weightKg : 70;
  return Math.round(steps * kg * 0.0005);
}

export function dailyBurnFromHc(hc: any, fallbackBmr = 0, steps = 0, weightKg = 0): number {
  const stepsActive = activeFromSteps(steps, weightKg);
  if (!hc) return fallbackBmr > 0 ? Math.round(fallbackBmr + stepsActive) : Math.round(stepsActive);
  const total = Number(hc.totalCalories) || 0;
  const bmr = Number(hc.bmr) || fallbackBmr || 0;
  const active = Number(hc.activeCalories) || 0;
  // Ruch = MAX(zmierzony z zegarka, oszacowany z kroków, mała podłoga 12% BMR).
  const move = Math.max(active, stepsActive, bmr > 0 ? Math.round(bmr * 0.12) : 0);
  const est = bmr > 0 ? bmr + move : Math.max(active, stepsActive);
  // Samsung czasem daje OKROJONY „total" mniejszy niż BMR (np. 1252 < 1670) — bez sensu.
  // Ufamy totalowi TYLKO gdy pełny dzień I WYŻSZY niż BMR+ruch; inaczej BMR+ruch.
  return Math.round(total >= 1200 && total > est ? total : est);
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

export async function getHealthHistory(days = 60, fallbackBmr = 0, defaultWeightKg = 0): Promise<Record<string, HealthDayHistory>> {
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
        const stepsN = Number(d.steps) || 0;
        const wKg = Number(d.weight) || defaultWeightKg;
        out[dates[i]] = { sleepMinutes, weight: Number(d.weight) || 0, steps: stepsN, burn: dailyBurnFromHc(d.hc, fallbackBmr, stepsN, wKg) };
      } catch {}
    });
  } catch {}
  return out;
}
