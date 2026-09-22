import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Plan zajęć (2026-09-22, user, student UR) — DOKŁADNIE ten sam kierunek co `workPrefix`
// dla pracy (praca.tsx/workEvents.ts), ale prostszy: JEDEN globalny prefiks (nie ma
// wielu "pracodawców" do przełączania), zero parsera godzin z tytułu (to zwykłe, w pełni
// czasowe eventy Google Kalendarza — start/koniec liczy się z ich WŁASNYCH czasów, nie z
// tekstu w tytule jak przy zmianach). Format tytułu ustalony przez usera: "[PUR] Angielski
// techniczny - 203 B3" — prefiks + spacja + nazwa przedmiotu + " - " + sala. Prefiks
// EDYTOWALNY w Ustawieniach (user: "dodaj mi w ustawieniach możliwość edytowania go w razie
// czego" — np. zmiana uczelni/kierunku w przyszłości).
//
// Reszta pipeline'u (rozpoznawanie [PUR]-prefiksowanych gcalEvents + wyciąganie sali,
// kafelek/widget na dziś, nowe powiadomienie X minut przed z salą) ŚWIADOMIE NIE zbudowana
// jeszcze w tym samym kroku — user dopiero zaczyna wpisywać eventy do Google Kalendarza,
// więc nie ma jeszcze realnych danych żeby to sensownie zweryfikować (ta sama dyscyplina co
// przy MAD reward curve/ekonomii skrzynek w tej sesji — najpierw dane, potem kod). Ten plik
// to TYLKO magazyn prefiksu, gotowy pod przyszły `isClassEvent()`/`classRoomFor()` w
// `src/utils/classSchedule.ts`, analogiczny do `isWorkEvent()` w `workEvents.ts`.
export const DEFAULT_CLASS_PREFIX = '[PUR]';

interface ClassScheduleState {
  prefix: string;
  _hydrated: boolean;
  setPrefix: (v: string) => void;
}

export const useClassScheduleStore = create<ClassScheduleState>()(
  persist(
    (set) => ({
      prefix: DEFAULT_CLASS_PREFIX,
      _hydrated: false,
      setPrefix: (v) => set({ prefix: v }),
    }),
    {
      name: 'class-schedule-v1',
      storage: throttledPersistStorage(),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
