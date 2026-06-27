import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Which WeeklyBoard tiles the user has hidden. Empty = show all (that have data).
interface WeeklyBoardState {
  hidden: string[];
  toggle: (id: string) => void;
}

export const useWeeklyBoard = create<WeeklyBoardState>()(
  persist(
    (set) => ({
      hidden: [],
      toggle: (id) =>
        set((s) => ({
          hidden: s.hidden.includes(id) ? s.hidden.filter((h) => h !== id) : [...s.hidden, id],
        })),
    }),
    { name: 'weekly-board-tiles-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
