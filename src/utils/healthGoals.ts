import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HealthGoals {
  stepGoal: number;
  waterGoal: number;  // daily water goal in glasses
  glassMl: number;    // how many ml one glass holds (for ml ⇄ glasses + watch hydration)
  weightGoal: number; // target weight in kg, 0 = not set
}

const KEY = 'health_goals';
const DEFAULTS: HealthGoals = { stepGoal: 10_000, waterGoal: 8, glassMl: 250, weightGoal: 0 };

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
    };
  } catch {
    return DEFAULTS;
  }
}

export async function saveHealthGoals(goals: Partial<HealthGoals>): Promise<void> {
  const current = await getHealthGoals();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...goals }));
}
