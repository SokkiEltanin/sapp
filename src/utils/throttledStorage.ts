import AsyncStorage from '@react-native-async-storage/async-storage';

// Zustand's `persist` middleware calls `storage.setItem(key, value)` on EVERY state change —
// for a store with a big/frequently-mutated slice (wydatki, kalendarz, walki pupila) that's a
// full JSON.stringify (done by `persist` itself) + an AsyncStorage write on EVERY single
// action, not just app entry. During a boss/raid fight (multiple `set()` calls per round) or
// rapid receipt edits this is a real, per-action cost — a different class of hotspot than the
// render-memo bugs fixed earlier in this optimization pass (2026-08-25, user: "a okiem
// specjalisty co byś jeszcze zoptymalizował?" → "zapisz wszystko i wszystko rób").
//
// Fix: writes to the SAME AsyncStorage key coalesce — only the LATEST value survives once
// `delayMs` passes with no further writes to that key. Different stores (different keys)
// throttle independently; `getItem`/`removeItem` pass straight through (only ever called once,
// at hydration, so there's nothing to coalesce there).
//
// Trade-off (accepted): up to `delayMs` of the newest LOCAL AsyncStorage write can be lost if
// the app is force-killed before the timer fires. Bounded and low-stakes — every store here
// also either mirrors to Firestore separately (expenses/mood/calendar/tasks — see
// backupService.ts's `CLOUD_COLS`) or holds small, low-frequency UI prefs (theme/skin/font).
// Two mitigations against even that narrow window:
//  1. `flushThrottledStorage()` is awaited by `backupService.gatherSnapshot()` BEFORE it reads
//     `AsyncStorage.getAllKeys()/multiGet()` — a backup can never observe a stale value.
//  2. `_layout.tsx` flushes on every AppState transition to background/inactive, so leaving
//     the app (not just force-kill) never leaves a write pending for long.
const DEFAULT_DELAY_MS = 600;

interface Pending { value: string; timer: ReturnType<typeof setTimeout> }
const pending = new Map<string, Pending>();

export function throttledAsyncStorage(delayMs: number = DEFAULT_DELAY_MS) {
  return {
    getItem: (key: string) => AsyncStorage.getItem(key),
    removeItem: (key: string) => {
      const p = pending.get(key);
      if (p) { clearTimeout(p.timer); pending.delete(key); }
      return AsyncStorage.removeItem(key);
    },
    setItem: (key: string, value: string) => {
      const existing = pending.get(key);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => {
        pending.delete(key);
        AsyncStorage.setItem(key, value).catch(() => {});
      }, delayMs);
      pending.set(key, { value, timer });
      return Promise.resolve();
    },
  };
}

// Forces every still-pending throttled write out to real AsyncStorage immediately, in
// parallel. Call this before anything reads AsyncStorage keys directly (bypassing zustand,
// e.g. backupService's snapshot) or when the app is about to leave the foreground.
export function flushThrottledStorage(): Promise<void> {
  const writes: Promise<void>[] = [];
  for (const [key, { value, timer }] of pending) {
    clearTimeout(timer);
    writes.push(AsyncStorage.setItem(key, value).catch(() => {}));
  }
  pending.clear();
  return Promise.all(writes).then(() => undefined);
}
