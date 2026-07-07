import * as FileSystem from 'expo-file-system/legacy';
import { ingestBankNotification } from './bankIngest';
import { useBankQueue } from '@/store/bankQueueStore';

// The native NotificationListenerService (plugins/withBankNotificationListener.js)
// appends captured bank notifications to this file in the app's filesDir — which is
// exactly expo-file-system's documentDirectory. We drain it on every app foreground:
// read all, clear, and run each through the normal ingest pipeline (which enqueues
// or, for trusted merchants, flags them for silent auto-accept on the dashboard).
const FILE = `${FileSystem.documentDirectory ?? ''}bank_notifications.json`;

let _running = false;

export async function drainBankNotifications(): Promise<number> {
  if (_running || !FileSystem.documentDirectory) return 0;
  // Feature off → DON'T touch the file. The native listener keeps appending the
  // whole day's notifications; when the user turns the feature on, the backlog is
  // processed instead of being silently discarded (previous bug: we cleared it
  // even while disabled, losing everything).
  if (!useBankQueue.getState().enabled) return 0;
  _running = true;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return 0;
    const raw = await FileSystem.readAsStringAsync(FILE);
    // Clear straight away so we don't reprocess (ingest also dedupes as a backstop).
    await FileSystem.writeAsStringAsync(FILE, '[]').catch(() => {});
    let arr: any[] = [];
    try { arr = JSON.parse(raw); } catch { return 0; }
    if (!Array.isArray(arr)) return 0;
    let n = 0;
    for (const it of arr) {
      try { if (await ingestBankNotification(String(it?.title ?? ''), String(it?.text ?? ''))) n++; } catch {}
    }
    return n;
  } catch {
    return 0;
  } finally {
    _running = false;
  }
}

// Diagnostics: peek at the raw native capture file WITHOUT clearing it, so the user
// can tell whether the native listener is actually catching anything (empty file =
// notifications never reach the app → permission/OEM issue; non-empty but nothing
// queued = the JS toggle/parse side).
export async function peekBankCapture(): Promise<{ count: number; samples: string[]; fileExists: boolean }> {
  try {
    if (!FileSystem.documentDirectory) return { count: 0, samples: [], fileExists: false };
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return { count: 0, samples: [], fileExists: false };
    const raw = await FileSystem.readAsStringAsync(FILE);
    const arr = JSON.parse(raw);
    if (!Array.isArray(arr)) return { count: 0, samples: [], fileExists: true };
    const samples = arr.slice(-3).map((it: any) => `${it?.title ?? ''} ${it?.text ?? ''}`.trim().slice(0, 90));
    return { count: arr.length, samples, fileExists: true };
  } catch {
    return { count: 0, samples: [], fileExists: false };
  }
}
