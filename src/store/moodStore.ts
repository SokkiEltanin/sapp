import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { MoodEntry } from '@/types';
import { notificationsService } from '@/services/notificationsService';

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

function todayStr() { return new Date().toISOString().split('T')[0]; }

export const useMoodStore = create<MoodState>()(
  persist(
    (set) => ({
      entries: [],
      todayEntry: null,
      isLoading: false,

      setEntries: (entries) => {
        const today = todayStr();
        const todayEntry = entries.filter(e => e.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
        set({ entries, todayEntry });
      },
      addEntry: (entry) =>
        set((state) => {
          const today = todayStr();
          const isToday = entry.date === today;
          // Logged today → push the "didn't log mood" reminder to tomorrow.
          if (isToday) notificationsService.refreshMoodReminder(true).catch(() => {});
          return {
            entries: [entry, ...state.entries],
            todayEntry: isToday ? entry : state.todayEntry,
          };
        }),
      updateEntry: (id, updates) =>
        set((state) => {
          const entries = state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e));
          const today = todayStr();
          const todayEntry = entries.filter(e => e.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
          return { entries, todayEntry };
        }),
      deleteEntry: (id) =>
        set((state) => {
          const entries = state.entries.filter((e) => e.id !== id);
          const today = todayStr();
          return { entries, todayEntry: entries.filter(e => e.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null };
        }),
      setTodayEntry: (todayEntry) => set({ todayEntry }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'mood-store-v1',
      storage: createJSONStorage(() => AsyncStorage),
      partialize: (state) => ({ entries: state.entries }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const today = todayStr();
          state.todayEntry = state.entries.filter(e => e.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
        }
      },
    },
  ),
);
