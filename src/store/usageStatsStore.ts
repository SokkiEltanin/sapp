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

// Log zdarzeń z limitem (2026-09-15, §102) — user: "chciałem mieć w USTAWIENIACH >
// STATYSTYKI PANEL cały żebym mógł wejść w niego i mieć dużo dokładnych danych jak
// korzystam w co wchodzę kiedy dokładnie itp (wykresy z czasem itp". `screens` wyżej to
// tylko agregat (count + ostatnie otwarcie) — nie starczy do wykresu "otwarcia w czasie"
// ani "o której porze dnia". `events` to PROSTY, capped log {screenId, at} — `at` jako
// liczba (epoch ms), nie ISO string, żeby JSON był mniejszy i bucketowanie po dniu/
// godzinie było tanie (Date arytmetyka, bez parsowania stringów). Cap 3000 (nie rośnie
// bez końca jak surowy click-stream by rósł) — przy typowym użyciu to wciąż wiele
// miesięcy historii, starsze wpisy po prostu wypadają z okna.
export interface ScreenOpenEvent {
  screenId: string;
  at: number; // Date.now()
}

const EVENTS_MAX = 3000;

interface UsageStatsState {
  screens: Record<string, ScreenStat>; // klucz = znormalizowany screenId, patrz screenStats.ts
  events: ScreenOpenEvent[];
  recordOpen: (screenId: string) => void;
  reset: () => void;
}

export const useUsageStats = create<UsageStatsState>()(
  persist(
    (set) => ({
      screens: {},
      events: [],
      recordOpen: (screenId) =>
        set((state) => {
          const prev = state.screens[screenId];
          return {
            screens: {
              ...state.screens,
              [screenId]: { count: (prev?.count ?? 0) + 1, lastOpenedAt: new Date().toISOString() },
            },
            events: [...state.events, { screenId, at: Date.now() }].slice(-EVENTS_MAX),
          };
        }),
      reset: () => set({ screens: {}, events: [] }),
    }),
    {
      name: 'usage-stats-v1',
      storage: throttledPersistStorage(),
    },
  ),
);
