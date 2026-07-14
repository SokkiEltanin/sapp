import AsyncStorage from '@react-native-async-storage/async-storage';

// A breadcrumb for the receipt-save flow. The black screen on save produces NO JS
// error (it's a freeze/ANR — the JS thread is blocked, e.g. by a heavy re-render of a
// still-mounted screen when the expenses store mutates), so no ErrorBoundary or crash
// handler can see it. Instead we drop a marker when a save starts and remove it the
// instant the save finishes. If the app is force-closed while frozen, the marker is
// left behind and the next launch can finally say "the save froze" with the step it
// reached — turning an invisible hang into something reportable.
const KEY = 'scan_save_pending';

export function beginScanSave(meta: string) {
  AsyncStorage.setItem(KEY, JSON.stringify({ at: Date.now(), meta })).catch(() => {});
}

export function markScanStep(step: string) {
  // best-effort update of the last-reached step (start → built → persisted → nav)
  AsyncStorage.getItem(KEY).then(raw => {
    if (!raw) return;
    try { const d = JSON.parse(raw); d.step = step; AsyncStorage.setItem(KEY, JSON.stringify(d)).catch(() => {}); } catch {}
  }).catch(() => {});
}

export function clearScanSave() {
  AsyncStorage.removeItem(KEY).catch(() => {});
}

// Read + consume a dangling marker (a save that started but never cleared → the app
// was force-closed or hung mid-save). Returns it once, then removes it.
export async function takeDanglingScanSave(): Promise<{ at: number; meta?: string; step?: string } | null> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    if (!raw) return null;
    await AsyncStorage.removeItem(KEY);
    return JSON.parse(raw);
  } catch {
    return null;
  }
}
