import { NativeModules, Platform } from 'react-native';
import * as FileSystem from 'expo-file-system/legacy';
import { Task } from '@/types';
import { pickWidgetTasks } from '@/utils/widgetTasks';

// Widget pulpitu Androida "Zadania" (2026-09-23) — TEN SAM plik-jako-most wzorzec co
// bankNotificationDrain.ts (odwrotny kierunek: TAM natywny kod pisze, JS czyta; TU JS
// pisze, natywny `TasksWidgetProvider.kt` czyta). `FileSystem.documentDirectory` ===
// Android `context.filesDir` (patrz komentarz w bankNotificationDrain.ts).
//
// `NativeModules.TasksWidget` istnieje TYLKO po rebuildzie APK z plugins/withTasksWidget.js
// (nowy natywny moduł, świeżo dodany) — przed pierwszym nowym buildem (i zawsze na iOS,
// którego apka nie wspiera) jest `undefined`. `?.requestUpdate?.()` więc jest tu OBOWIĄZKOWE,
// nie kosmetyczne — bez tego każde wywołanie `syncTasksWidget()` wywalałoby się na starym
// APK/w Expo Go, zanim ktokolwiek zdąży zrobić nowy build.
const FILE = `${FileSystem.documentDirectory ?? ''}widget_tasks.json`;

let _lastWritten = '';

export async function syncTasksWidget(tasks: Task[]): Promise<void> {
  if (Platform.OS !== 'android' || !FileSystem.documentDirectory) return;
  const d = new Date();
  const todayYMD = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  const rows = pickWidgetTasks(tasks, todayYMD);
  const json = JSON.stringify(rows);
  if (json === _lastWritten) return; // nic się nie zmieniło — nie budź niepotrzebnie widgetu
  _lastWritten = json;
  try {
    await FileSystem.writeAsStringAsync(FILE, json);
    NativeModules.TasksWidget?.requestUpdate?.();
  } catch {}
}

// Ustawienia → przełącznik "Przezroczyste tło widgetu" (2026-09-23) — pisze do natywnego
// SharedPreferences (jedna GLOBALNA wartość, nie per-instancja — po odrzuceniu osobnego
// ekranu configu, patrz widgetSettingsStore.ts) i budzi widget, żeby przemalował się od razu.
export function setWidgetTransparent(value: boolean): void {
  if (Platform.OS !== 'android') return;
  NativeModules.TasksWidget?.setTransparent?.(value);
}
