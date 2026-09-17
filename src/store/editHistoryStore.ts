import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Log zmian na transakcjach (2026-09-17) — user: "moze byc gdzieś szczegóły i tam
// każdorazowo co edytowano i np co nauczono lub zapisano do pamięci". Ten sam capped-log
// wzorzec co `usageStatsStore.events`/`bankQueueStore.history` — WYŁĄCZNIE lokalne, nigdy
// nigdzie nie wysyłane. Jeden wpis PER ZAPIS (nie per pole) — kilka zmienionych pól w
// jednym `handleSave()` składa się w jedną linijkę, tak jak commit message, żeby log się
// nie zaśmiecał przy zwykłej edycji kilku rzeczy naraz.
export interface EditHistoryEntry {
  id: string;
  expenseId: string;
  at: number; // Date.now()
  summary: string; // np. "Kategoria: Zakupy → Jedzenie; Tagi: +słodycze"
  learned?: string; // np. "Nauczono: Lidl → kategoria Zakupy"
}

const MAX_ENTRIES = 500;

interface EditHistoryState {
  entries: EditHistoryEntry[];
  record: (e: Omit<EditHistoryEntry, 'id' | 'at'>) => void;
  clear: () => void;
}

// Świadomie BEZ selektora typu `forExpense(id)` na store — zwracałby nową
// przefiltrowaną+posortowaną tablicę przy KAŻDYM wywołaniu, co jako selektor Zustand
// (`useEditHistory(st => st.forExpense(id))`) byłoby niestabilne (nowa referencja przy
// każdym renderze). Konsument (`app/expenses/[id].tsx`) czyta surowe, stabilne
// `st.entries` i filtruje we własnym `useMemo` — ten sam wzorzec co `useBankQueue`'s
// `st => st.history` w `BankHistorySection.tsx`.
export const useEditHistory = create<EditHistoryState>()(
  persist(
    (set) => ({
      entries: [],
      record: (e) => set((state) => ({
        entries: [...state.entries, { ...e, id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`, at: Date.now() }].slice(-MAX_ENTRIES),
      })),
      clear: () => set({ entries: [] }),
    }),
    {
      name: 'edit-history-v1',
      storage: throttledPersistStorage(),
    },
  ),
);
