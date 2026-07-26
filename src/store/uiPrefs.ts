import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

// Opt-in UI preferences that need to be reactive across screens.
interface UiPrefs {
  tabSlide: boolean; // slide animation between tab boards (off by default — see _layout)
  liteMode: boolean; // performance: drop the heaviest decorative animations (weather sky etc.)
  _hydrated: boolean;
  setTabSlide: (v: boolean) => void;
  setLiteMode: (v: boolean) => void;
}

export const useUiPrefs = create<UiPrefs>()(
  persist(
    (set) => ({
      tabSlide: false,
      liteMode: false,
      _hydrated: false,
      setTabSlide: (v) => set({ tabSlide: v }),
      setLiteMode: (v) => set({ liteMode: v }),
    }),
    {
      name: 'ui-prefs-v1',
      storage: createJSONStorage(() => AsyncStorage),
      onRehydrateStorage: () => (state) => { if (state) state._hydrated = true; },
    },
  ),
);
