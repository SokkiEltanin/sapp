import * as FileSystem from 'expo-file-system/legacy';
import { Platform } from 'react-native';
import { markTaskDone } from '@/hooks/useTasks';
import { useCalendarStore } from '@/store/calendarStore';
import { syncTasksWidget } from './widgetSync';

// TEN SAM plik-jako-most wzorzec co bankNotificationDrain.ts (2026-09-27, interaktywny widget
// "Zadania" — user zaakceptował pomysł: "przycisk zrobione bez otwierania appki"). Natywny
// `TasksWidgetProvider.kt`'s `handleToggle()` dopisuje id zadania do tego pliku PRZY TAPIE na
// checkboxie widgetu (i optymistycznie usuwa wiersz z `widget_tasks.json`, żeby widget
// zareagował od razu) — to prawdziwe oznaczenie "zrobione" (zapis do store'u + Firestore +
// nagrody/powiadomienia, przez `markTaskDone()`) dzieje się TU, na najbliższym foregroundzie.
const FILE = `${FileSystem.documentDirectory ?? ''}widget_toggle_queue.json`;

let _running = false;

export async function drainWidgetToggleQueue(): Promise<void> {
  if (Platform.OS !== 'android' || _running || !FileSystem.documentDirectory) return;
  _running = true;
  try {
    const info = await FileSystem.getInfoAsync(FILE);
    if (!info.exists) return;
    const raw = await FileSystem.readAsStringAsync(FILE);
    // Clear straight away so we don't reprocess — markTaskDone() is idempotent as a backstop.
    await FileSystem.writeAsStringAsync(FILE, '[]').catch(() => {});
    let ids: unknown[] = [];
    try { ids = JSON.parse(raw); } catch { return; }
    if (!Array.isArray(ids) || ids.length === 0) return;
    for (const id of ids) {
      try { await markTaskDone(String(id)); } catch {}
    }
    // Re-sync the widget from the now-authoritative task list — the native side already
    // hid these rows optimistically, this just corrects anything that drifted (e.g. a task
    // that was already done/deleted in-app before the tap got processed here).
    syncTasksWidget(useCalendarStore.getState().tasks).catch(() => {});
  } catch {
  } finally {
    _running = false;
  }
}
