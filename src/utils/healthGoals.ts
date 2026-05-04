import AsyncStorage from '@react-native-async-storage/async-storage';

export interface HealthGoals {
  stepGoal: number;
  waterGoal: number;
}

const KEY = 'health_goals';
const DEFAULTS: HealthGoals = { stepGoal: 10_000, waterGoal: 8 };

export async function getHealthGoals(): Promise<HealthGoals> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return DEFAULTS;
    const parsed = JSON.parse(raw);
    return {
      stepGoal:  parsed.stepGoal  > 0 ? parsed.stepGoal  : DEFAULTS.stepGoal,
      waterGoal: parsed.waterGoal > 0 ? parsed.waterGoal : DEFAULTS.waterGoal,
    };
  } catch {
    return DEFAULTS;
  }
}

export async function saveHealthGoals(goals: Partial<HealthGoals>): Promise<void> {
  const current = await getHealthGoals();
  await AsyncStorage.setItem(KEY, JSON.stringify({ ...current, ...goals }));
}
