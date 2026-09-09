import AsyncStorage from '@react-native-async-storage/async-storage';
import type { PersistStorage, StorageValue } from 'zustand/middleware';

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
//
// 2026-09-09, user: "okiem specjalisty co byś jeszcze zoptymalizował?" → the ONE remaining,
// previously-documented-but-deliberately-unfixed architectural cost (ARCHITECTURE.md §15):
// the coalescing above only throttled the AsyncStorage DISK WRITE — the `JSON.stringify(value)`
// of the WHOLE persisted slice (expenses/meals/products, growing with account age) still ran
// SYNCHRONOUSLY on every single `set()`, because `createJSONStorage()` (zustand's own helper,
// previously wrapping this file's storage) stringifies BEFORE calling `setItem`, so by the time
// our throttling code ran, the expensive part had already happened on the calling tick — every
// store using `createJSONStorage(() => throttledAsyncStorage())` paid that cost on every single
// mutation, not just on the eventual disk write. Fix: this file now implements zustand's
// `PersistStorage<S>` interface DIRECTLY (raw `{state, version}` objects, not pre-stringified
// text) instead of being wrapped by `createJSONStorage` — `JSON.stringify` moved INSIDE the
// debounced `setTimeout` callback below, so it now (a) runs off the current interaction's tick
// instead of blocking it, and (b) coalesces across a burst of `set()` calls the same way the
// disk write already did (e.g. several HP/coin changes in one boss-fight round now cost ONE
// stringify instead of one per `set()`). Every store previously configured with
// `storage: createJSONStorage(() => throttledAsyncStorage())` is now
// `storage: throttledPersistStorage()` — same debounce semantics, same eventual persisted
// bytes, only WHEN the stringify happens changed. `getItem` still parses the full blob once at
// rehydration (cold-start cost) — that's separate, far less frequent, and left alone; splitting/
// paginating storage per collection would be the real fix for THAT half, but is the "duży,
// ryzykowny redesign warstwy danych" flagged in §15, not something folded in here.
const DEFAULT_DELAY_MS = 600;

interface Pending { value: StorageValue<unknown>; timer: ReturnType<typeof setTimeout> }
const pending = new Map<string, Pending>();

export function throttledPersistStorage<S>(delayMs: number = DEFAULT_DELAY_MS): PersistStorage<S> {
  return {
    getItem: async (name) => {
      const raw = await AsyncStorage.getItem(name);
      if (raw == null) return null;
      try { return JSON.parse(raw) as StorageValue<S>; } catch { return null; }
    },
    removeItem: (name) => {
      const p = pending.get(name);
      if (p) { clearTimeout(p.timer); pending.delete(name); }
      return AsyncStorage.removeItem(name);
    },
    setItem: (name, value) => {
      const existing = pending.get(name);
      if (existing) clearTimeout(existing.timer);
      const timer = setTimeout(() => {
        pending.delete(name);
        AsyncStorage.setItem(name, JSON.stringify(value)).catch(() => {});
      }, delayMs);
      pending.set(name, { value: value as StorageValue<unknown>, timer });
      return Promise.resolve();
    },
  };
}

// Forces every still-pending throttled write out to real AsyncStorage immediately, in
// parallel (stringifying now instead of waiting for each key's own timer). Call this before
// anything reads AsyncStorage keys directly (bypassing zustand, e.g. backupService's snapshot)
// or when the app is about to leave the foreground.
export function flushThrottledStorage(): Promise<void> {
  const writes: Promise<void>[] = [];
  for (const [key, { value, timer }] of pending) {
    clearTimeout(timer);
    writes.push(AsyncStorage.setItem(key, JSON.stringify(value)).catch(() => {}));
  }
  pending.clear();
  return Promise.all(writes).then(() => undefined);
}
