import AsyncStorage from '@react-native-async-storage/async-storage';
import { Habit } from '@/types';
import { matchesAvoid } from '@/store/countersStore';

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

// Batched counterpart to `getCountsRange` — writes many days in one native call
// (AsyncStorage.multiSet) instead of N sequential `setCounts`. Used by `persistAvoidCounts`
// below, which can touch many days at once the first time an 'avoid' habit is added (backfill
// across the whole loaded window) or none at all on a normal day.
async function setCountsRange(entries: [date: string, counts: Record<string, number>][]): Promise<void> {
  if (!entries.length) return;
  try {
    await AsyncStorage.multiSet(entries.map(([date, counts]) => [cntKey(date), JSON.stringify(counts)]));
  } catch {}
}

// ── 'avoid' habits — auto-tracked from the food log, no manual taps ────────────
// (2026-08-29, user: "żeby w nawyku dodać że chcę nie jeść słodyczy" — the SAME auto
// "days without X" tracking the counters screen already has (`matchesAvoid` in
// countersStore.ts), but living as a HABIT with its own streak/calendar instead of a
// standalone counter.) A day counts as done UNLESS a matching food was logged that day —
// mirrors habit-year.tsx's counter branch (`matchDays.has(ds) ? 'broke' : 'done'`), so a day
// with nothing logged yet (including today, still in progress) reads as clean until proven
// otherwise, exactly like the counter it's modeled on.
type MatchMeal = { date?: string; items?: { name?: string; parts?: { name?: string }[] }[] };

function brokenDaysFor(keyword: string, meals: MatchMeal[]): Set<string> {
  const set = new Set<string>();
  for (const m of meals) {
    const day = (m.date ?? '').slice(0, 10);
    if (!day) continue;
    const names = (m.items ?? [])
      .flatMap((it) => [it?.name, ...((it?.parts ?? []).map((p) => p?.name))])
      .filter(Boolean).join(' ');
    if (matchesAvoid(names, keyword)) set.add(day);
  }
  return set;
}

// PURE (no I/O, easily testable) — given the ALREADY-LOADED `existing` counts for `dates`
// (whatever useHabits.ts's own getCountsRange call returned, reused rather than re-fetched),
// computes the correct value for every 'avoid' habit on every date and returns BOTH the full
// merged map (for immediate React state) and just the days that actually changed (so the
// caller only persists what's new — usually 0 days, or all of them the very first time an
// 'avoid' habit is added).
export function computeAvoidCounts(
  habits: Habit[],
  meals: MatchMeal[],
  dates: string[],
  existing: Record<string, Record<string, number>>,
): { merged: Record<string, Record<string, number>>; changed: [string, Record<string, number>][] } {
  const avoidHabits = habits.filter((h) => h.kind === 'avoid' && h.avoidKeyword);
  if (avoidHabits.length === 0) return { merged: existing, changed: [] };
  const brokenByKeyword = new Map<string, Set<string>>();
  for (const h of avoidHabits) {
    if (!brokenByKeyword.has(h.avoidKeyword!)) brokenByKeyword.set(h.avoidKeyword!, brokenDaysFor(h.avoidKeyword!, meals));
  }
  const merged: Record<string, Record<string, number>> = { ...existing };
  const changed: [string, Record<string, number>][] = [];
  for (const date of dates) {
    const dayCounts = { ...(existing[date] ?? {}) };
    let dirty = false;
    for (const h of avoidHabits) {
      const broke = brokenByKeyword.get(h.avoidKeyword!)!.has(date);
      const want = broke ? 0 : 1;
      if ((dayCounts[h.id] ?? 0) !== want) { dayCounts[h.id] = want; dirty = true; }
    }
    if (dirty) { merged[date] = dayCounts; changed.push([date, dayCounts]); }
  }
  return { merged, changed };
}

// Thin I/O wrapper — persists whatever `computeAvoidCounts` flagged as changed, so the same
// `habits_cnt_<date>` storage every other habit uses stays correct for OTHER readers too
// (habit-year.tsx reads it directly, not through useHabits.ts).
export async function persistAvoidCounts(changed: [string, Record<string, number>][]): Promise<void> {
  await setCountsRange(changed);
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
