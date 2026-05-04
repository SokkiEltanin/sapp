import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '@/types';

const HABITS_KEY = 'habits_list';
const doneKey = (date: string) => `habits_done_${date}`;

export async function getHabits(): Promise<Habit[]> {
  const raw = await AsyncStorage.getItem(HABITS_KEY);
  return raw ? JSON.parse(raw) : [];
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

export async function getCompletions(date: string): Promise<string[]> {
  const raw = await AsyncStorage.getItem(doneKey(date));
  return raw ? JSON.parse(raw) : [];
}

export async function setCompletions(date: string, ids: string[]): Promise<void> {
  await AsyncStorage.setItem(doneKey(date), JSON.stringify(ids));
}
