import AsyncStorage from '@react-native-async-storage/async-storage';

const KEY = 'ocr_scan_count';
const MONTH_KEY = 'ocr_scan_month';

function currentMonth(): string {
  const d = new Date();
  return `${d.getFullYear()}-${d.getMonth()}`;
}

export async function getScanCount(): Promise<number> {
  const stored = await AsyncStorage.getItem(MONTH_KEY);
  if (stored !== currentMonth()) return 0;
  const raw = await AsyncStorage.getItem(KEY);
  return raw ? parseInt(raw) : 0;
}

export async function incrementScanCount(): Promise<number> {
  const month = currentMonth();
  const stored = await AsyncStorage.getItem(MONTH_KEY);
  if (stored !== month) {
    await AsyncStorage.multiSet([[MONTH_KEY, month], [KEY, '1']]);
    return 1;
  }
  const raw = await AsyncStorage.getItem(KEY);
  const count = (raw ? parseInt(raw) : 0) + 1;
  await AsyncStorage.setItem(KEY, String(count));
  return count;
}
