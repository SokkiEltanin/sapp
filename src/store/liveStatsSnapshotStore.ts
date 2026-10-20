import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Snapshot pól, które są ZA DROGIE/ASYNCHRONICZNE, żeby czytać je bezpośrednio w
// `useDataFieldRegistry.ts` (Faza §404, 2026-10-20) — user: "dlaczego do edytora nie dajesz
// wszystkich danych tylko część, jaki to problem". Realny problem: `useDataFieldRegistry`
// MUSI pozostać tanim, czystym selektorem Zustand (patrz komentarz tam — kafel danych na
// płótnie może wystąpić WIELOKROTNIE, każda instancja montuje rejestr osobno, więc KAŻDY
// hook użyty tutaj mnoży się przez liczbę instancji). Trzy pola, które user chciał
// (kroki/saldo/nastrój pupila), źródłowo wymagają: `usePetHealthSync()` (Health Connect sync +
// AsyncStorage, realny async I/O), `getBalanceOffset()` (surowy AsyncStorage getter, nie
// Zustand), `computePetState()` (agregacja kroki+sen+nawyki+nastrój, w tym `useHabits()` — WŁASNY
// ciężki hook z 371-dniowym wczytywaniem + harmonogramem powiadomień). Montowanie
// KTÓREGOKOLWIEK z nich per-instancja na płótnie byłoby dokładnie tym błędem architektonicznym
// (`useHabits()` double-fetch hazard), którego ta sesja już wcześniej unikała.
//
// Rozwiązanie: TEN SAM wzorzec co "Dashboard czyta snapshot `expenses`, nie żywy store"
// (ARCHITECTURE.md §4, CLAUDE.md reguła #3) — ekran, który i tak JUŻ liczy te wartości
// (`app/pet.tsx` dla kroków/snu/nastroju pupila, `app/(tabs)/finances.tsx` dla salda na
// karcie), dopisuje JEDNĄ linię zapisu do tego małego, persystowanego store'u. Rejestr czyta
// stąd zwykłym, tanim selektorem — zero nowych fetchy wywołanych przez sam fakt dodania kafla
// na płótnie. Kompromis (świadomy, udokumentowany w UI przez `*Known` flagi niżej): wartość
// jest tak świeża jak ostatnia wizyta na ekranie źródłowym, nie "na żywo" przy każdym
// otwarciu płótna — ale oba ekrany (Pupil/Finanse) należą do najczęściej odwiedzanych w
// appce, więc w praktyce rzadko bywa to realnym problemem.
interface LiveStatsSnapshotState {
  stepsToday: number;
  sleepMinutesToday: number;
  petMoodLabel: string;
  petWellbeing: number;
  // `false` dopóki `app/pet.tsx` nie policzył tego choć raz w tej instalacji — odróżnia
  // "naprawdę 0 kroków" od "jeszcze nie wiadomo" (ten sam powód co `unknown` w `PetNeed`,
  // `petState.ts`).
  petSynced: boolean;
  cardBalanceOffset: number;
  balanceSynced: boolean;
  update: (patch: Partial<Omit<LiveStatsSnapshotState, 'update'>>) => void;
}

export const useLiveStatsSnapshotStore = create<LiveStatsSnapshotState>()(
  persist(
    (set) => ({
      stepsToday: 0,
      sleepMinutesToday: 0,
      petMoodLabel: '',
      petWellbeing: 60,
      petSynced: false,
      cardBalanceOffset: 0,
      balanceSynced: false,
      update: (patch) => set(patch),
    }),
    { name: 'live-stats-snapshot-v1', storage: throttledPersistStorage() },
  ),
);
