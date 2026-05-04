import { create } from 'zustand';
import { MoodEntry } from '@/types';

interface MoodState {
  entries: MoodEntry[];
  todayEntry: MoodEntry | null;
  isLoading: boolean;

  setEntries: (entries: MoodEntry[]) => void;
  addEntry: (entry: MoodEntry) => void;
  updateEntry: (id: string, updates: Partial<MoodEntry>) => void;
  deleteEntry: (id: string) => void;
  setTodayEntry: (entry: MoodEntry | null) => void;
  setLoading: (loading: boolean) => void;
}

export const useMoodStore = create<MoodState>((set) => ({
  entries: [],
  todayEntry: null,
  isLoading: false,

  setEntries: (entries) => {
    const today = new Date().toISOString().split('T')[0];
    const todayEntry = entries.find((e) => e.date === today) ?? null;
    set({ entries, todayEntry });
  },
  addEntry: (entry) =>
    set((state) => {
      const today = new Date().toISOString().split('T')[0];
      return {
        entries: [entry, ...state.entries],
        todayEntry: entry.date === today ? entry : state.todayEntry,
      };
    }),
  updateEntry: (id, updates) =>
    set((state) => {
      const entries = state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e));
      const today = new Date().toISOString().split('T')[0];
      const todayEntry = entries.find((e) => e.date === today) ?? null;
      return { entries, todayEntry };
    }),
  deleteEntry: (id) =>
    set((state) => {
      const entries = state.entries.filter((e) => e.id !== id);
      const today = new Date().toISOString().split('T')[0];
      return { entries, todayEntry: entries.find((e) => e.date === today) ?? null };
    }),
  setTodayEntry: (todayEntry) => set({ todayEntry }),
  setLoading: (isLoading) => set({ isLoading }),
}));
