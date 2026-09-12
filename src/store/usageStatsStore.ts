import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Lekki, CAŁKOWICIE lokalny licznik użycia ekranów — "coś ala meta pixel, ale zamknięty
// obieg, nigdzie nie wysyłane" (2026-09-12, user: "Pixel tylko w apce nigdzie nie
// wysyłać tego chce zupełnie obieg zamknięty ogarniaj teraz to"). ŚWIADOMIE nie jest to
// pełny click-stream (każdy tap na każdym ekranie) — to wymagałoby ręcznego dopięcia
// instrumentacji do ~35 ekranów, łatwo o dziury w pokryciu za niewspółmiernie mały zysk
// (patrz rozmowa). Zamiast tego: JEDNO miejsce (app/_layout.tsx, `usePathname()` w
// komponencie zamontowanym przez całą sesję) liczy OTWARCIA EKRANU — ile razy i kiedy
// ostatnio. To odpowiada na realne pytanie "czego w ogóle nie używam", bez ryzyka lagów
// (jeden zapis na nawigację, nie na każdy gest) i bez rozrostu — store ma tyle wpisów ile
// UNIKALNYCH ekranów w apce (dziesiątki), NIE rośnie z każdym otwarciem jak surowy log
// zdarzeń by rósł.
export interface ScreenStat {
  count: number;
  lastOpenedAt: string; // ISO
}

interface UsageStatsState {
  screens: Record<string, ScreenStat>; // klucz = znormalizowany screenId, patrz screenStats.ts
  recordOpen: (screenId: string) => void;
  reset: () => void;
}

export const useUsageStats = create<UsageStatsState>()(
  persist(
    (set) => ({
      screens: {},
      recordOpen: (screenId) =>
        set((state) => {
          const prev = state.screens[screenId];
          return {
            screens: {
              ...state.screens,
              [screenId]: { count: (prev?.count ?? 0) + 1, lastOpenedAt: new Date().toISOString() },
            },
          };
        }),
      reset: () => set({ screens: {} }),
    }),
    {
      name: 'usage-stats-v1',
      storage: throttledPersistStorage(),
    },
  ),
);
