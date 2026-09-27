import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';

// Udostępnij TEKST prosto do parsera paragonów (2026-09-27, user zaakceptował pomysł) — TEN
// SAM plik-jako-most wzorzec co bankNotificationDrain.ts/widgetToggleDrain.ts. Natywny
// `ShareReceiverActivity.kt` (plugins/withReceiptShareIntent.js) zapisuje udostępniony tekst
// tutaj i przekierowuje przez `sapp://expenses/scan` deep link — `scan.tsx` czyta ten plik na
// mount (screen jest zawsze świeżo otwierany przez ten deep link, nie zamontowany od dawna,
// więc mount-time jest wystarczający, bez potrzeby AppState/foreground listenera jak przy
// innych drenażach w `app/_layout.tsx`).
const FILE = `${FileSystem.documentDirectory ?? ''}shared_receipt_text.json`;

export async function drainSharedReceiptText(): Promise<string | null> {
  if (Platform.OS !== 'android' || !FileSystem.documentDirectory) return null;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return null;
    const raw = await FileSystem.readAsStringAsync(FILE);
    await FileSystem.deleteAsync(FILE, { idempotent: true }).catch(() => {});
    const obj = JSON.parse(raw);
    const text = typeof obj?.text === 'string' ? obj.text.trim() : '';
    return text.length > 0 ? text : null;
  } catch {
    return null;
  }
}
