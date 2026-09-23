import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Ustawienia widgetu pulpitu "Zadania" (2026-09-23) — TYLKO magazyn wartości do wyświetlenia
// w Ustawieniach; prawdziwe źródło prawdy dla RENDEROWANIA widgetu to natywny
// SharedPreferences ("TasksWidgetPrefs"), pisany przez `widgetSync.ts`'s
// `setWidgetTransparent()` przez natywny most. Ten store istnieje TYLKO żeby przełącznik w
// Ustawieniach wiedział jaka jest bieżąca wartość bez zapytania natywnej strony (JS nie ma
// prostego "read" z SharedPreferences bez dodatkowego natywnego mostu w drugą stronę).
//
// Odrzucony wcześniej pomysł: osobny natywny ekran "configure" otwierany przy DODAWANIU
// widgetu (usunięty w tej samej rundzie, patrz plugins/withTasksWidget.js) — Android wymaga,
// żeby taki ekran zwrócił RESULT_OK zanim W OGÓLE dokończy dodawanie widgetu; user zgłosił że
// po tej zmianie dodawanie widgetu przestało działać ("nic sie nie dodaje"), bo bez jawnego
// zapisu na tamtym ekranie Android po cichu anulował całe dodanie. Zwykły przełącznik w
// Ustawieniach nie ma tego ryzyka — nie gate'uje niczego.
interface WidgetSettingsState {
  transparentBg: boolean;
  setTransparentBg: (v: boolean) => void;
}

export const useWidgetSettingsStore = create<WidgetSettingsState>()(
  persist(
    (set) => ({
      transparentBg: false,
      setTransparentBg: (v) => set({ transparentBg: v }),
    }),
    { name: 'widget-settings-v1', storage: throttledPersistStorage() },
  ),
);
