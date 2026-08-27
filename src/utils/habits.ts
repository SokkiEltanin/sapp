import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '@/types';

const HABITS_KEY = 'habits_list';
const cntKey    = (date: string) => `habits_cnt_${date}`;
const legacyKey = (date: string) => `habits_done_${date}`;

// How much one tap adds/removes for a count habit. Only an explicitly ml-based goal
// steps by a glass (250 ml) so you don't tap 250 times; everything else — including
// the glasses-based water habit (unit 'szkl.', goal in glasses) — steps by 1.
export function stepFor(h: Habit): number {
  if (h.step && h.step > 0) return h.step;
  const u = (h.unit ?? '').trim().toLowerCase();
  if (u === 'ml') return 250;
  return 1;
}

export async function getHabits(): Promise<Habit[]> {
  try {
    const raw = await AsyncStorage.getItem(HABITS_KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return []; // corrupt JSON → don't break the whole Habits screen
  }
}

export async function saveHabits(habits: Habit[]): Promise<void> {
  await AsyncStorage.setItem(HABITS_KEY, JSON.stringify(habits));
}

// Returns Record<habitId, count> — check habits store 0 or 1, count habits store 0..N
export async function getCounts(date: string): Promise<Record<string, number>> {
  try {
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
  } catch {} // corrupt JSON for one day → treat as empty, don't break habit loading
  return {};
}

export async function setCounts(date: string, counts: Record<string, number>): Promise<void> {
  await AsyncStorage.setItem(cntKey(date), JSON.stringify(counts));
}

// Batched `getCounts` for many dates at once (2026-08-27) — `useHabits.ts`'s `load()` widened
// from 30 to 371 days (BUG FIX #3, patrz komentarz tam: streak-owi realnie brakowało DANYCH,
// nie tylko szerszej pętli), które przez 371 sekwencyjnych `getCounts()` (dwa `getItem` każdy w
// najgorszym razie) byłoby wolne. `AsyncStorage.multiGet` batchuje w JEDNO wywołanie natywne;
// druga runda `multiGet` po legacy klucze tylko dla dni bez nowego formatu (zwykle 0, bo
// migracja jest stara) — ten sam fallback co `getCounts`, tylko wsadowo zamiast dzień po dniu.
export async function getCountsRange(dates: string[]): Promise<Record<string, Record<string, number>>> {
  const out: Record<string, Record<string, number>> = {};
  if (!dates.length) return out;
  const pairs = await AsyncStorage.multiGet(dates.map(cntKey));
  const missing: string[] = [];
  pairs.forEach(([, raw], i) => {
    const d = dates[i];
    if (!raw) { missing.push(d); return; }
    try { out[d] = JSON.parse(raw); } catch { missing.push(d); }
  });
  if (missing.length) {
    const legacyPairs = await AsyncStorage.multiGet(missing.map(legacyKey));
    legacyPairs.forEach(([, raw], i) => {
      const d = missing[i];
      if (!raw) return;
      try {
        const ids: string[] = JSON.parse(raw);
        const counts: Record<string, number> = {};
        ids.forEach((id) => { counts[id] = 1; });
        out[d] = counts;
      } catch {}
    });
  }
  return out;
}

// The single water habit fed by Health Connect hydration: the kind:'water' one,
// or (fallback for habits created before the merge) a count habit named "Woda".
export async function getWaterHabit(): Promise<Habit | null> {
  const list = await getHabits();
  return list.find((h) => h.kind === 'water')
    ?? list.find((h) => h.type === 'count' && h.title.trim().toLowerCase() === 'woda')
    ?? null;
}

// Feed the water habit from Health Connect hydration. Takes the MAX of what's stored
// and the watch value, so a background/foreground sync never clobbers water you added
// by hand (and vice-versa) — within a day the count only ever grows. No-op without a
// water habit. Returns true if it changed anything.
export async function feedWaterHabit(glasses: number, date: string): Promise<boolean> {
  const w = await getWaterHabit();
  if (!w) return false;
  const counts = await getCounts(date);
  const next = Math.max(counts[w.id] ?? 0, Math.max(0, glasses));
  if ((counts[w.id] ?? 0) === next) return false;
  counts[w.id] = next;
  await setCounts(date, counts);
  return true;
}

// A "steps" habit (matched by name, since there's no kind:'steps') that we auto-mark
// from Health Connect steps, so a "did I hit my step goal" streak doesn't die on days
// the app wasn't opened before midnight.
export async function getStepsHabit(): Promise<Habit | null> {
  const list = await getHabits();
  const match = (t: string) => {
    const s = t.trim().toLowerCase();
    return s === 'kroki' || s === 'kroków' || s === 'chodzenie' || s === 'spacer' || s === 'steps';
  };
  return list.find((h) => match(h.title)) ?? null;
}

// Mark the steps habit done for `date` when the watch shows the day HIT the goal.
// MAX so it never un-marks a day you already completed by hand. No-op without a steps
// habit or when the goal wasn't met. Returns true if it changed anything.
export async function feedStepsHabit(steps: number, goal: number, date: string): Promise<boolean> {
  if (!(steps > 0 && goal > 0 && steps >= goal)) return false;
  const h = await getStepsHabit();
  if (!h) return false;
  const counts = await getCounts(date);
  const target = Math.max(1, h.dailyGoal ?? 1);
  const next = Math.max(counts[h.id] ?? 0, target);
  if ((counts[h.id] ?? 0) >= next) return false;
  counts[h.id] = next;
  await setCounts(date, counts);
  return true;
}

// A day's water intake in glasses = the water habit's count (0 if no water habit).
// Single source of truth shared by the Health screen, the Habits screen and the pet.
export async function getWaterGlasses(date: string): Promise<number> {
  const w = await getWaterHabit();
  if (!w) return 0;
  const counts = await getCounts(date);
  return Math.max(0, counts[w.id] ?? 0);
}
