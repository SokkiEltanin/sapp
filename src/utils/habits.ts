import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '@/types';

const HABITS_KEY = 'habits_list';
const cntKey    = (date: string) => `habits_cnt_${date}`;
const legacyKey = (date: string) => `habits_done_${date}`;

export async function getHabits(): Promise<Habit[]> {
  const raw = await AsyncStorage.getItem(HABITS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

// Returns Record<habitId, count> — check habits store 0 or 1, count habits store 0..N
export async function getCounts(date: string): Promise<Record<string, number>> {
  const newRaw = await AsyncStorage.getItem(cntKey(date));
  if (newRaw) return JSON.parse(newRaw);
  // Migrate from legacy string[] format
  const oldRaw = await AsyncStorage.getItem(legacyKey(date));
  if (oldRaw) {
    const ids: string[] = JSON.parse(oldRaw);
    const counts: Record<string, number> = {};
    ids.forEach((id) => { counts[id] = 1; });
    return counts;
  }
  return {};
}

export async function setCounts(date: string, counts: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem(cntKey(date), JSON.stringify(counts));
}
