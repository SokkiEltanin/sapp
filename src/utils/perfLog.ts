import AsyncStorage from '@react-native-async-storage/async-storage';

// Poor-man's cold-start perf tracker — there's no remote on-device profiler (Flipper) here,
// so instead of guessing at further optimizations blind, this records real numbers on the
// user's own device across app updates: "does the dashboard actually load faster after a
// perf fix, or not" (2026-08-25, user: "a okiem specjalisty co byś jeszcze zoptymalizował?"
// → "zapisz wszystko i wszystko rob"). Read back via Ustawienia → Diagnostyka.
//
// `JS_START` is set at MODULE EVAL time — importing this file as early as possible in
// `app/_layout.tsx` gets it close to real app-launch, though it necessarily misses native
// bundle-load time before any JS runs at all. Not scientific, but good enough for a
// before/after comparison on the SAME device, which is what actually matters here.
const JS_START = Date.now();

const KEY = 'perf_dashboard_log_v1';
const MAX_ENTRIES = 20;

export interface PerfEntry {
  at: string;            // ISO timestamp
  msToFirstFrame: number; // JS start → dashboard component's first committed render
  msToReady: number;      // JS start → `deferredReady` (ALL sections, incl. non-essential, are in)
}

// One-shot PER JS SESSION (cold start / reload) — the dashboard remounts every time you
// switch back to its tab, and `markDashboardFirstFrame` firing again on that "warm" remount
// would silently overwrite the real cold-start timestamp with a much later one, right before
// a stray `recordDashboardReady()` call could read it. Guarded here (not just at the
// `recordDashboardReady()` call site in index.tsx) so the two stay consistent even if
// something calls this one on its own.
let firstFrameMarked = false;
let firstFrameAt = 0;

export function markDashboardFirstFrame() {
  if (firstFrameMarked) return;
  firstFrameMarked = true;
  firstFrameAt = Date.now();
}

// Deliberately NOT one-shot itself — the caller (index.tsx) owns "only once per cold start,
// ignore later tab-revisit remounts" via its own module-level flag, so this stays a plain,
// always-appends function: simpler to reason about and to test (no hidden internal state that
// only a fresh module load can reset).
export async function recordDashboardReady(): Promise<void> {
  const now = Date.now();
  const entry: PerfEntry = {
    at: new Date().toISOString(),
    msToFirstFrame: Math.max(0, firstFrameAt - JS_START),
    msToReady: Math.max(0, now - JS_START),
  };
  try {
    const raw = await AsyncStorage.getItem(KEY);
    const list: PerfEntry[] = raw ? JSON.parse(raw) : [];
    list.push(entry);
    while (list.length > MAX_ENTRIES) list.shift();
    await AsyncStorage.setItem(KEY, JSON.stringify(list));
  } catch {}
}

export async function getPerfLog(): Promise<PerfEntry[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch { return []; }
}

export async function clearPerfLog(): Promise<void> {
  try { await AsyncStorage.removeItem(KEY); } catch {}
}
