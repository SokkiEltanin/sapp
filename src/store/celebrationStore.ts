import { create } from 'zustand';

// A small queue of achievement ids waiting for their full-screen celebration.
interface CelebrationState {
  queue: string[];
  celebrate: (ids: string[]) => void;
  dismissTop: () => void;
  clear: () => void;
}

export const useCelebration = create<CelebrationState>((set) => ({
  queue: [],
  celebrate: (ids) => set((s) => ({ queue: [...s.queue, ...ids.filter(id => !s.queue.includes(id))] })),
  dismissTop: () => set((s) => ({ queue: s.queue.slice(1) })),
  clear: () => set({ queue: [] }),
}));
