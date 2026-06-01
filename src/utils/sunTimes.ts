import AsyncStorage from '@react-native-async-storage/async-storage';

// Sunrise/sunset as decimal local hours (e.g. 5.5 = 05:30). Kept in a module
// cache so the synchronous useTimeAccent() can read them, and persisted so the
// theme is correct immediately on the next launch (before weather reloads).

export interface SunTimes { sunrise: number; sunset: number; }

const KEY = 'sun_times_v1';
let cached: SunTimes | null = null;

export function getSunTimes(): SunTimes | null {
  return cached;
}

export async function hydrateSunTimes(): Promise<void> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (raw) cached = JSON.parse(raw);
  } catch {}
}

export async function setSunTimes(sunrise: number, sunset: number): Promise<void> {
  if (!isFinite(sunrise) || !isFinite(sunset)) return;
  cached = { sunrise, sunset };
  try { await AsyncStorage.setItem(KEY, JSON.stringify(cached)); } catch {}
}

// Parse an ISO time like "2026-06-01T04:51" into decimal local hours.
export function isoToDecimalHour(iso: string): number {
  const t = iso.includes('T') ? iso.split('T')[1] : iso;
  const [h, m] = t.split(':').map(Number);
  return (h || 0) + (m || 0) / 60;
}
