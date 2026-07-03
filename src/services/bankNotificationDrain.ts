import * as FileSystem from 'expo-file-system/legacy';
import { ingestBankNotification } from './bankIngest';

// The native NotificationListenerService (plugins/withBankNotificationListener.js)
// appends captured bank notifications to this file in the app's filesDir — which is
// exactly expo-file-system's documentDirectory. We drain it on every app foreground:
// read all, clear, and run each through the normal ingest pipeline (which enqueues
// or, for trusted merchants, flags them for silent auto-accept on the dashboard).
const FILE = `${FileSystem.documentDirectory ?? ''}bank_notifications.json`;

let _running = false;

export async function drainBankNotifications(): Promise<number> {
  if (_running || !FileSystem.documentDirectory) return 0;
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
