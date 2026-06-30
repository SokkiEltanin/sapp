import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';

export type CounterKind = 'until' | 'since';

export interface Counter {
  id: string;
  kind: CounterKind;
  name: string;
  date: string;       // until → target date; since → last-done date (YYYY-MM-DD)
  startDate: string;  // until → progress start (creation day); since → unused
  icon?: string;      // optional lucide key (see counterIcons)
  createdAt: string;
}

interface CountersState {
  counters: Counter[];
  add: (c: Omit<Counter, 'id' | 'createdAt'>) => void;
  update: (id: string, patch: Partial<Counter>) => void;
  remove: (id: string) => void;
  resetSince: (id: string) => void; // "zrobione dziś"
}

const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

export const useCounters = create<CountersState>()(
  persist(
    (set) => ({
      counters: [],
      add: (c) => set((s) => ({
        counters: [{ ...c, id: `cnt_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() }, ...s.counters],
      })),
      update: (id, patch) => set((s) => ({ counters: s.counters.map(c => c.id === id ? { ...c, ...patch } : c) })),
      remove: (id) => set((s) => ({ counters: s.counters.filter(c => c.id !== id) })),
      resetSince: (id) => set((s) => ({ counters: s.counters.map(c => c.id === id ? { ...c, date: todayStr() } : c) })),
    }),
    { name: 'counters-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);

// ── Derived helpers ─────────────────────────────────────────────────────────
const MS_DAY = 86400000;
const atMidnight = (iso: string) => { const d = new Date(iso + 'T00:00:00'); return d.getTime(); };

// since: whole days elapsed since the last-done date (0 = today).
export function daysSince(c: Counter, now = Date.now()): number {
  return Math.max(0, Math.floor((now - atMidnight(c.date)) / MS_DAY));
}

// until: whole days remaining to the target (0 = today, negative = passed).
export function daysUntil(c: Counter, now = Date.now()): number {
  return Math.ceil((atMidnight(c.date) - now) / MS_DAY);
}

// until: 0..1 fraction of the journey covered (startDate → target).
export function untilProgress(c: Counter, now = Date.now()): number {
  const start = atMidnight(c.startDate || c.createdAt.slice(0, 10));
  const end = atMidnight(c.date);
  if (end <= start) return 1;
  return Math.min(1, Math.max(0, (now - start) / (end - start)));
}
