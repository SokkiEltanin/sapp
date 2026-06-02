import AsyncStorage from '@react-native-async-storage/async-storage';

// "Who paid" — lets expenses be split by person (e.g. you vs partner) while
// still summing into the food/sweets/total figures. Persisted locally.

const KEY = 'payers_v1';
const DEFAULT_PAYERS = ['Ja', 'Partnerka'];

export async function getPayers(): Promise<string[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list = raw ? JSON.parse(raw) : DEFAULT_PAYERS;
    return Array.isArray(list) && list.length > 0 ? list : DEFAULT_PAYERS;
  } catch {
    return DEFAULT_PAYERS;
  }
}

export async function savePayers(list: string[]): Promise<void> {
  try { await AsyncStorage.setItem(KEY, JSON.stringify(list)); } catch {}
}

export async function addPayer(name: string): Promise<string[]> {
  const trimmed = name.trim();
  const list = await getPayers();
  if (trimmed && !list.includes(trimmed)) {
    const next = [...list, trimmed];
    await savePayers(next);
    return next;
  }
  return list;
}
