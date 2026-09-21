import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { MoodEntry } from '@/types';
import { notificationsService } from '@/services/notificationsService';

interface MoodState {
  entries: MoodEntry[];
  todayEntry: MoodEntry | null;
  isLoading: boolean;
  // ids added/edited locally that Firestore hasn't confirmed yet (weak/no signal) — TEN
  // SAM wzorzec co `pendingSync` w `expensesStore.ts` (2026-09-21, user: "moze zapisywac
  // offline i wyslac jak bedzie wifi" — nawiązanie do zawieszonego zapisu humoru z §149).
  // `setEntries` preserves these on a refresh so a just-logged mood never vanishes when the
  // screen reloads from the cloud before the background write lands.
  pendingSync: string[];

  setEntries: (entries: MoodEntry[]) => void;
  addEntry: (entry: MoodEntry) => void;
  addPending: (entry: MoodEntry) => void;   // add locally + flag for background sync
  updateEntry: (id: string, updates: Partial<MoodEntry>) => void;
  markPending: (id: string) => void;        // flag an existing entry as needing a re-write
  confirmSync: (id: string) => void;        // background write landed → stop preserving it
  deleteEntry: (id: string) => void;
  setTodayEntry: (entry: MoodEntry | null) => void;
  setLoading: (loading: boolean) => void;
}

function todayStr() { const d = new Date(); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`; } // LOCAL date (toISOString is UTC → wrong day at night)

const withPending = (list: string[], id: string) => (list.includes(id) ? list : [...list, id]);

function todayEntryOf(entries: MoodEntry[]): MoodEntry | null {
  const today = todayStr();
  return entries.filter(e => e.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
}

export const useMoodStore = create<MoodState>()(
  persist(
    (set) => ({
      entries: [],
      todayEntry: null,
      isLoading: false,
      pendingSync: [],

      // Merge-aware: remote (Firestore) is the baseline, but any entry still flagged
      // pendingSync is overlaid on top — kept if the cloud doesn't have it yet, or
      // preferred over the cloud copy if it does (the local edit isn't synced). Ten sam
      // wzorzec co `setExpenses` w expensesStore.ts.
      setEntries: (incoming) =>
        set((state) => {
          if (state.pendingSync.length === 0) return { entries: incoming, todayEntry: todayEntryOf(incoming) };
          const byId = new Map(state.entries.map((e) => [e.id, e]));
          const merged = incoming.slice();
          const stillPending: string[] = [];
          for (const id of state.pendingSync) {
            const local = byId.get(id);
            if (!local) continue; // usunięte lokalnie → zrzuć flagę
            stillPending.push(id);
            const idx = merged.findIndex((e) => e.id === id);
            if (idx >= 0) merged[idx] = local; // preferuj niezsynchronizowaną lokalną wersję
            else merged.unshift(local);        // chmura jeszcze jej nie ma → zachowaj
          }
          return { entries: merged, pendingSync: stillPending, todayEntry: todayEntryOf(merged) };
        }),
      addEntry: (entry) =>
        set((state) => {
          const isToday = entry.date === todayStr();
          // Logged today → push the "didn't log mood" reminder to tomorrow.
          if (isToday) notificationsService.refreshMoodReminder(true).catch(() => {});
          return {
            entries: [entry, ...state.entries],
            todayEntry: isToday ? entry : state.todayEntry,
          };
        }),
      addPending: (entry) =>
        set((state) => {
          const isToday = entry.date === todayStr();
          if (isToday) notificationsService.refreshMoodReminder(true).catch(() => {});
          return {
            entries: [entry, ...state.entries],
            pendingSync: withPending(state.pendingSync, entry.id),
            todayEntry: isToday ? entry : state.todayEntry,
          };
        }),
      updateEntry: (id, updates) =>
        set((state) => {
          const entries = state.entries.map((e) => (e.id === id ? { ...e, ...updates } : e));
          return { entries, todayEntry: todayEntryOf(entries) };
        }),
      markPending: (id) =>
        set((state) => ({ pendingSync: withPending(state.pendingSync, id) })),
      confirmSync: (id) =>
        set((state) => ({ pendingSync: state.pendingSync.filter((x) => x !== id) })),
      deleteEntry: (id) =>
        set((state) => {
          const entries = state.entries.filter((e) => e.id !== id);
          return {
            entries,
            pendingSync: state.pendingSync.filter((x) => x !== id),
            todayEntry: todayEntryOf(entries),
          };
        }),
      setTodayEntry: (todayEntry) => set({ todayEntry }),
      setLoading: (isLoading) => set({ isLoading }),
    }),
    {
      name: 'mood-store-v1',
      storage: throttledPersistStorage(),
      partialize: (state) => ({ entries: state.entries, pendingSync: state.pendingSync }),
      onRehydrateStorage: () => (state) => {
        if (state) {
          const today = todayStr();
          state.todayEntry = state.entries.filter(e => e.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0] ?? null;
        }
      },
    },
  ),
);
