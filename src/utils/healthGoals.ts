import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HealthGoals {
  stepGoal: number;
  waterGoal: number;  // daily water goal in glasses
  glassMl: number;    // how many ml one glass holds (for ml ⇄ glasses + watch hydration)
  weightGoal: number; // target weight in kg, 0 = not set
  // Body profile — needed to compute BMR (resting burn) so the calorie target has a
  // solid base even when the watch doesn't report BMR. 0/unset = not provided.
  heightCm: number;
  ageYears: number;
  sex: 'm' | 'f' | '';
}

const KEY = 'health_goals';
const DEFAULTS: HealthGoals = { stepGoal: 10_000, waterGoal: 8, glassMl: 250, weightGoal: 0, heightCm: 0, ageYears: 0, sex: '' };

export async function getHealthGoals(): Promise<HealthGoals> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      stepGoal:  parsed.stepGoal  > 0 ? parsed.stepGoal  : DEFAULTS.stepGoal,
      waterGoal: parsed.waterGoal > 0 ? parsed.waterGoal : DEFAULTS.waterGoal,
      glassMl:   parsed.glassMl   > 0 ? parsed.glassMl   : DEFAULTS.glassMl,
      weightGoal: parsed.weightGoal > 0 ? parsed.weightGoal : 0,
      heightCm:  parsed.heightCm  > 0 ? parsed.heightCm  : 0,
      ageYears:  parsed.ageYears  > 0 ? parsed.ageYears  : 0,
      sex:       parsed.sex === 'm' || parsed.sex === 'f' ? parsed.sex : '',
    };
  } catch {
    return DEFAULTS;
  }
}

// Mifflin-St Jeor resting metabolic rate (kcal/day). Needs weight, height, age, sex.
// Returns 0 when any is missing so callers can fall back to the watch's BMR.
export function bmrMifflin(kg: number, cm: number, age: number, sex: 'm' | 'f' | ''): number {
  if (!(kg > 0 && cm > 0 && age > 0) || !sex) return 0;
  const base = 10 * kg + 6.25 * cm - 5 * age;
  return Math.round(sex === 'f' ? base - 161 : base + 5);
}

export async function saveHealthGoals(goals: Partial<HealthGoals>): Promise<void> {
  const current = await getHealthGoals();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...goals }));
}
