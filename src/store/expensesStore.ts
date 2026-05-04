import { create } from 'zustand';
import { Expense, ExpenseFilters } from '@/types';

interface ExpensesState {
  expenses: Expense[];
  filters: ExpenseFilters;
  isLoading: boolean;
  error: string | null;

  setExpenses: (expenses: Expense[]) => void;
  addExpense: (expense: Expense) => void;
  updateExpense: (id: string, updates: Partial<Expense>) => void;
  deleteExpense: (id: string) => void;
  setFilters: (filters: ExpenseFilters) => void;
  clearFilters: () => void;
  setLoading: (loading: boolean) => void;
  setError: (error: string | null) => void;
}

export const useExpensesStore = create<ExpensesState>((set) => ({
  expenses: [],
  filters: {},
  isLoading: false,
  error: null,

  setExpenses: (expenses) => set({ expenses }),
  addExpense: (expense) =>
    set((state) => ({ expenses: [expense, ...state.expenses] })),
  updateExpense: (id, updates) =>
    set((state) => ({
      expenses: state.expenses.map((e) => (e.id === id ? { ...e, ...updates } : e)),
    })),
  deleteExpense: (id) =>
    set((state) => ({ expenses: state.expenses.filter((e) => e.id !== id) })),
  setFilters: (filters) => set({ filters }),
  clearFilters: () => set({ filters: {} }),
  setLoading: (isLoading) => set({ isLoading }),
  setError: (error) => set({ error }),
}));
