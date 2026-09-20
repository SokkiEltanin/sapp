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
  maxLagMs: number;      // najdłuższa JEDNA zwłoka wątku JS zaobserwowana do tego momentu (ms)
  totalLagMs: number;    // suma wszystkich zwłok — "jak długo łącznie wątek JS był zajęty/zablokowany"
  lagSamples: number;    // ile próbek zdążyło odpalić się do tego momentu (sanity-check — mniej niż
                          // oczekiwane z `LAG_WINDOW_MS`/`LAG_SAMPLE_MS` = same przez to, że wątek był
                          // zbyt zajęty, żeby je nawet odpalić na czas)
}

// ─── Cold-start JS-thread lag sampling ─────────────────────────────────────────
// User (2026-09-20): "zawsze te startupy animacje lagują... jak wchodzę i próbuję kliknąć to
// jest impossible, zrob rejestr żebyś miał realne dane". `msToFirstFrame`/`msToReady` powyżej
// mówią JAK DŁUGO trwa start, ale nie CZY wątek JS jest w tym czasie zablokowany — a to
// dokładnie ta sama przyczyna co "nie mogę kliknąć" (dotyk w RN jest obsługiwany na TYM SAMYM
// wątku JS co reszta logiki). Metoda: `setTimeout` zaplanowany na `LAG_SAMPLE_MS` który
// faktycznie odpala się później = coś innego zajmowało wątek JS w tym czasie — mierzymy o ile
// później, zamiast zgadywać które z ~10 równoległych `useEffect`ów w `_layout.tsx` jest winne.
const LAG_SAMPLE_MS = 50;
const LAG_WINDOW_MS = 8000; // przestań próbkować tyle po JS_START — z zapasem po najdłuższym dotąd starcie

let maxLagMs = 0;
let totalLagMs = 0;
let lagSamples = 0;
let lagSamplingStarted = false;

function scheduleLagSample() {
  const scheduledAt = Date.now();
  setTimeout(() => {
    const actual = Date.now() - scheduledAt;
    const lag = Math.max(0, actual - LAG_SAMPLE_MS);
    maxLagMs = Math.max(maxLagMs, lag);
    totalLagMs += lag;
    lagSamples++;
    if (Date.now() - JS_START < LAG_WINDOW_MS) scheduleLagSample();
  }, LAG_SAMPLE_MS);
}

// Wołane RAZ z `app/_layout.tsx` (efekt, NIE na poziomie modułu) — samo-startujące się przy
// imporcie zapętliłoby prawdziwe `setTimeout`y na 8s przy KAŻDYM imporcie tego modułu, także
// przez `perfLog.test.ts` w Jest, wisząc/przeciekając w testach. Idempotentne — bezpieczne przy
// Fast Refresh, który mógłby wywołać ten efekt ponownie.
export function startColdStartLagSampling() {
  if (lagSamplingStarted) return;
  lagSamplingStarted = true;
  scheduleLagSample();
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
    maxLagMs, totalLagMs, lagSamples,
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
