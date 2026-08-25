import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import { throttledAsyncStorage } from '@/utils/throttledStorage';
import { Expense, ExpenseFilters } from '@/types';

interface ExpensesState {
  expenses: Expense[];
  // ids added / edited locally that Firestore hasn't confirmed yet (weak/no signal).
  // setExpenses preserves these on a refresh so a just-saved receipt never vanishes
  // when the screen reloads from the cloud before the background write lands.
  pendingSync: string[];
  filters: ExpenseFilters;
  isLoading: boolean;
  error: string | null;

  setExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  addPending: (expense: Expense) => void;   // add locally + flag for background sync
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  markPending: (id: string) => void;        // flag an existing row as needing a re-write
  confirmSync: (id: string) => void;        // background write landed → stop preserving it
  deleteExpense: (id: string) => void;
  setFilters: (filters: ExpenseFilters) => void;
  clearFilters: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

const withPending = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

export const useExpensesStore = create<ExpensesState>()(
  persist(
    (set) => ({
      expenses: [],
      pendingSync: [],
      filters: {},
      isLoading: false,
      error: null,

      // Merge-aware: remote (Firestore) is the baseline, but any row still flagged
      // pendingSync is overlaid on top — kept if the cloud doesn't have it yet, or
      // preferred over the cloud copy if it does (the local edit isn't synced). This
      // is what stops a fresh receipt from disappearing on pull-to-refresh.
      setExpenses: (incoming) =>
        set((state) => {
          if (state.pendingSync.length === 0) return { expenses: incoming };
          const byId = new Map(state.expenses.map((e) => [e.id, e]));
          const merged = incoming.slice();
          const stillPending: string[] = [];
          for (const id of state.pendingSync) {
            const local = byId.get(id);
            if (!local) continue; // deleted locally → drop the flag
            stillPending.push(id);
            const idx = merged.findIndex((e) => e.id === id);
            if (idx >= 0) merged[idx] = local; // prefer the unsynced local version
            else merged.unshift(local);        // cloud doesn't have it yet → keep it
          }
          return { expenses: merged, pendingSync: stillPending };
        }),
      addExpense: (expense) =>
        set((state) => ({ expenses: [expense, ...state.expenses] })),
      addPending: (expense) =>
        set((state) => ({
          expenses: [expense, ...state.expenses],
          pendingSync: withPending(state.pendingSync, expense.id),
        })),
      updateExpense: (id, updates) =>
        set((state) => ({
          expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
        })),
      markPending: (id) =>
        set((state) => ({ pendingSync: withPending(state.pendingSync, id) })),
      confirmSync: (id) =>
        set((state) => ({ pendingSync: state.pendingSync.filter((x) => x !== id) })),
      deleteExpense: (id) =>
        set((state) => ({
          expenses: state.expenses.filter((e) => e.id !== id),
          pendingSync: state.pendingSync.filter((x) => x !== id),
        })),
      setFilters: (filters) => set({ filters }),
      clearFilters: () => set({ filters: {} }),
      setLoading: (isLoading) => set({ isLoading }),
      setError: (error) => set({ error }),
    }),
    {
      name: 'expenses-store-v1',
      storage: createJSONStorage(() => throttledAsyncStorage()),
      partialize: (state) => ({ expenses: state.expenses, pendingSync: state.pendingSync }),
    },
  ),
);
