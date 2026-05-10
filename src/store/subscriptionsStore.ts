import { create } from 'zustand';
import { Subscription } from '@/types';

interface SubscriptionsState {
  subscriptions: Subscription[];
  isLoading: boolean;
  setSubscriptions: (subs: Subscription[]) => void;
  addSubscription: (sub: Subscription) => void;
  updateSubscription: (id: string, updates: Partial<Subscription>) => void;
  deleteSubscription: (id: string) => void;
  setLoading: (v: boolean) => void;
}

export const useSubscriptionsStore = create<SubscriptionsState>((set) => ({
  subscriptions: [],
  isLoading: false,
  setSubscriptions: (subscriptions) => set({ subscriptions }),
  addSubscription: (sub) => set((s) => ({ subscriptions: [sub, ...s.subscriptions] })),
  updateSubscription: (id, updates) =>
    set((s) => ({
      subscriptions: s.subscriptions.map((x) => (x.id === id ? { ...x, ...updates } : x)),
    })),
  deleteSubscription: (id) =>
    set((s) => ({ subscriptions: s.subscriptions.filter((x) => x.id !== id) })),
  setLoading: (isLoading) => set({ isLoading }),
}));
