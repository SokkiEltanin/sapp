import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// Which dashboard skin is equipped. 'auto' = follow the time-of-day theme.
interface SkinState {
  active: string;
  setActive: (id: string) => void;
}

export const useSkinStore = create<SkinState>()(
  persist(
    (set) => ({
      active: 'auto',
      setActive: (active) => set({ active }),
    }),
    { name: 'skin-active-v1', storage: throttledPersistStorage() },
  ),
);
