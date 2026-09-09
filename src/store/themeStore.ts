import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

export type ThemeMode = 'dark' | 'light' | 'system';

interface ThemeState {
  mode: ThemeMode;
  setMode: (mode: ThemeMode) => void;
}

export const useThemeStore = create<ThemeState>()(
  persist(
    (set) => ({
      mode: 'dark',
      setMode: (mode) => set({ mode }),
    }),
    { name: 'theme-mode-v1', storage: throttledPersistStorage() },
  ),
);
