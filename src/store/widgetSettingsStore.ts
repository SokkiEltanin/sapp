import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Ustawienia widgetu pulpitu "Zadania" (2026-09-23) — TYLKO magazyn wartości do wyświetlenia
// w Ustawieniach; prawdziwe źródło prawdy dla RENDEROWANIA widgetu to natywny
// SharedPreferences ("TasksWidgetPrefs"), pisany przez `widgetSync.ts`'s
// `setWidgetAppearance()` przez natywny most. Ten store istnieje TYLKO żeby kontrolki w
// Ustawieniach wiedziały jaka jest bieżąca wartość bez zapytania natywnej strony (JS nie ma
// prostego "read" z SharedPreferences bez dodatkowego natywnego mostu w drugą stronę).
//
// Odrzucony wcześniej pomysł: osobny natywny ekran "configure" otwierany przy DODAWANIU
// widgetu (usunięty, patrz plugins/withTasksWidget.js) — Android wymaga, żeby taki ekran
// zwrócił RESULT_OK zanim W OGÓLE dokończy dodawanie widgetu; user zgłosił że po tej zmianie
// dodawanie widgetu przestało działać ("nic sie nie dodaje"), bo bez jawnego zapisu na tamtym
// ekranie Android po cichu anulował całe dodanie. Zwykłe kontrolki w Ustawieniach nie mają
// tego ryzyka — nie gate'ują niczego.
//
// Runda 2 (2026-09-25, user: "slider przezroczystości, koloru w razie czego, wielkość
// tekstu") — binarny `transparentBg` zastąpiony trzema wartościami: `bgOpacity` (0-100, nie
// sam on/off), `bgColor` (dowolny kolor, nie tylko domyślny ciemny), `textScale`.
export type WidgetTextScale = 'small' | 'medium' | 'large';

interface WidgetSettingsState {
  bgOpacity: number;       // 0-100, domyślnie 100 (nieprzezroczysty, jak stary `transparentBg: false`)
  bgColor: string;         // hex, domyślnie ten sam ciemny co dawny sztywny widget_bg.xml
  textScale: WidgetTextScale;
  setBgOpacity: (v: number) => void;
  setBgColor: (v: string) => void;
  setTextScale: (v: WidgetTextScale) => void;
}

const DEFAULT_BG_COLOR = '#1A1C1C';

export const useWidgetSettingsStore = create<WidgetSettingsState>()(
  persist(
    (set) => ({
      bgOpacity: 100,
      bgColor: DEFAULT_BG_COLOR,
      textScale: 'medium',
      setBgOpacity: (v) => set({ bgOpacity: v }),
      setBgColor: (v) => set({ bgColor: v }),
      setTextScale: (v) => set({ textScale: v }),
    }),
    {
      name: 'widget-settings-v1',
      storage: throttledPersistStorage(),
      // v1 → v2: stary `transparentBg: boolean` zastąpiony `bgOpacity`. Zachowujemy istniejący
      // wybór usera zamiast go po cichu resetować — `true` (przezroczyste) → opacity 0,
      // `false`/brak → domyślne 100.
      version: 2,
      migrate: (persisted: any) => {
        if (persisted && typeof persisted.transparentBg === 'boolean' && persisted.bgOpacity === undefined) {
          return { bgOpacity: persisted.transparentBg ? 0 : 100, bgColor: DEFAULT_BG_COLOR, textScale: 'medium' };
        }
        return persisted;
      },
    },
  ),
);
