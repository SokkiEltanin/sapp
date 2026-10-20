import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Opóźnienie odświeżania dashboardu (§405, 2026-10-20) — user: "ustaw mi opcję żeby na
// dashboardzie aktualizowało się tylko raz na jakiś czas z opóźnieniem... żeby nie lagowało,
// zwłaszcza te mniej wymagające typu wydatki itp". Dashboard już ma mechanizm snapshotu
// wydatków (ARCHITECTURE.md §4 "Snapshot statystyk") — ciężkie widgety czytają zamrożony
// snapshot, nie żywy store, a snapshot odświeża się TYLKO na triggerach. Jeden z triggerów
// ("coś zmieniło się w tle, podczas gdy user I TAK siedzi na dashboardzie" — np. auto-book z
// banku) był ZASZYTY NA SZTYWNO na 300ms debounce — to pole user teraz może sam dostroić.
// Pozostałe dwa triggery (wejście na zakładkę, powrót appki z tła) ZOSTAJĄ natychmiastowe
// (deferred tylko do końca przejścia ekranu) niezależnie od tego trybu — to świadome momenty,
// kiedy user chce świeże dane, nie "w tle, póki siedzę".
export type DashboardRefreshMode = 'normal' | 'relaxed' | 'eco';
export const DASHBOARD_REFRESH_DELAY_MS: Record<DashboardRefreshMode, number> = {
  normal: 300,     // dotychczasowe zachowanie, zero zmiany dla nikogo kto tego nie dotknie
  relaxed: 4000,
  eco: 15000,
};

// Opt-in UI preferences that need to be reactive across screens.
interface UiPrefs {
  tabSlide: boolean; // slide animation between tab boards (off by default — see _layout)
  dashboardRefreshMode: DashboardRefreshMode;
  _hydrated: boolean;
  setTabSlide: (v: boolean) => void;
  setDashboardRefreshMode: (v: DashboardRefreshMode) => void;
}

export const useUiPrefs = create<UiPrefs>()(
  persist(
    (set) => ({
      tabSlide: false,
      dashboardRefreshMode: 'normal',
      _hydrated: false,
      setTabSlide: (v) => set({ tabSlide: v }),
      setDashboardRefreshMode: (v) => set({ dashboardRefreshMode: v }),
    }),
    {
      name: 'ui-prefs-v1',
      storage: throttledPersistStorage(),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
