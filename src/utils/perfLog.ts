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

// ─── JS-thread lag sampling (start + cała sesja) ───────────────────────────────
// User (2026-09-20): "zawsze te startupy animacje lagują... jak wchodzę i próbuję kliknąć to
// jest impossible, zrob rejestr żebyś miał realne dane". `msToFirstFrame`/`msToReady` powyżej
// mówią JAK DŁUGO trwa start, ale nie CZY wątek JS jest w tym czasie zablokowany — a to
// dokładnie ta sama przyczyna co "nie mogę kliknąć" (dotyk w RN jest obsługiwany na TYM SAMYM
// wątku JS co reszta logiki). Metoda: `setTimeout` zaplanowany na `LAG_SAMPLE_MS` który
// faktycznie odpala się później = coś innego zajmowało wątek JS w tym czasie — mierzymy o ile
// później, zamiast zgadywać które z ~10 równoległych `useEffect`ów w `_layout.tsx` jest winne.
//
// 2026-10-09 (user: "nadal mam wrażenie że appka laguje, dodaj testową [diagnostykę] żeby
// lepiej zrozumieć") — próbkowanie dotąd ZATRZYMYWAŁO SIĘ na stałe po `LAG_WINDOW_MS` (8s) od
// startu, więc mierzyło WYŁĄCZNIE lag przy starcie — zero widoczności w lag, który user
// zgłasza jako ogólne, ciągłe wrażenie podczas zwykłego używania appki (scroll, nawigacja,
// minuty/godziny po starcie). Teraz DWIE fazy: pierwsze `LAG_WINDOW_MS` próbkuje gęsto (co
// `LAG_SAMPLE_MS`=50ms, bez zmiany — to był zawsze cel: złapać dokładnie start), POTEM
// próbkowanie LECI DALEJ przez całą resztę sesji, tylko rzadziej (`LAG_SAMPLE_MS_IDLE`=500ms —
// wystarczy, żeby wyłapać zauważalne (>0.5s) zacięcia bez obciążania appki kolejnym timerem co
// 50ms bez końca). Pauzowane w tle (`pauseLagSampling`/`resumeLagSampling`, wołane z AppState
// w `_layout.tsx`) — appka w tle i tak jest trzymana przez OS, próbkowanie wtedy mierzyłoby
// tylko to jak długo appka była zamrożona, nie realny lag UI. `getLiveLagStats()` czyta
// AKTUALNE, żywe liczniki w dowolnym momencie sesji (nie tylko ten jeden snapshot przy starcie
// zapisany przez `recordDashboardReady`) — Diagnostyka może je pokazać NA ŻĄDANIE, zaraz po
// tym jak user poczuje zacięcie, zamiast czekać na kolejny cold start.
const LAG_SAMPLE_MS = 50;
const LAG_SAMPLE_MS_IDLE = 500;
const LAG_WINDOW_MS = 8000; // próg przejścia z gęstego próbkowania startu na rzadsze, ciągłe

let maxLagMs = 0;
let totalLagMs = 0;
let lagSamples = 0;
let lagSamplingStarted = false;
let lagSamplingPaused = false;
let lagTimer: ReturnType<typeof setTimeout> | null = null;

function scheduleLagSample() {
  const intervalMs = (Date.now() - JS_START < LAG_WINDOW_MS) ? LAG_SAMPLE_MS : LAG_SAMPLE_MS_IDLE;
  const scheduledAt = Date.now();
  lagTimer = setTimeout(() => {
    lagTimer = null;
    const actual = Date.now() - scheduledAt;
    const lag = Math.max(0, actual - intervalMs);
    maxLagMs = Math.max(maxLagMs, lag);
    totalLagMs += lag;
    lagSamples++;
    if (!lagSamplingPaused) scheduleLagSample();
  }, intervalMs);
}

// Wołane z AppState listenerem w `_layout.tsx` — appka w tle nie ma po co próbkować (OS i tak
// zamraża JS, a wznowiony timer zmierzyłby czas zamrożenia jako "lag", fałszywie zawyżając
// wynik). `resumeLagSampling()` jest bezpieczne nawet jeśli próbkowanie nigdy w ogóle się nie
// zaczęło (np. wywołane przed `startColdStartLagSampling()`) — po prostu nic nie robi.
export function pauseLagSampling(): void {
  lagSamplingPaused = true;
  if (lagTimer) { clearTimeout(lagTimer); lagTimer = null; }
}

export function resumeLagSampling(): void {
  if (!lagSamplingStarted || !lagSamplingPaused || lagTimer) return;
  lagSamplingPaused = false;
  scheduleLagSample();
}

// Żywy, aktualny stan liczników — do odczytu W DOWOLNYM momencie sesji (Diagnostyka), nie
// tylko to, co `recordDashboardReady()` zapisało raz przy starcie.
export function getLiveLagStats(): { maxLagMs: number; totalLagMs: number; lagSamples: number; sinceMs: number } {
  return { maxLagMs, totalLagMs, lagSamples, sinceMs: Date.now() - JS_START };
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
