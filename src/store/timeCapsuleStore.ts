import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';

// "List do przyszłego siebie" — a time capsule. You write a short message and pick when
// it unlocks (e.g. in 6 months); until then it's sealed. Persisted in AsyncStorage, so it
// survives restarts AND reinstalls (backupService snapshots every AsyncStorage key).

export interface CapsuleLetter {
  id: string;
  text: string;
  createdAt: number;   // ms — when it was written
  unlockAt: number;    // ms — when it becomes readable
  read?: boolean;      // true once opened + dismissed
}

interface State {
  letters: CapsuleLetter[];
  // Zwraca nowo utworzony list (2026-09-27, powiadomienie o odblokowaniu) — caller (index.tsx)
  // potrzebuje `id`/`unlockAt`, żeby zaplanować `scheduleCapsuleUnlockReminder` tym samym
  // identyfikatorem; store zostaje jedynym miejscem generującym `id`, więc nie ma szansy na
  // rozjazd między tym co zapisane a tym co zaplanowane.
  add: (text: string, unlockAt: number) => CapsuleLetter;
  markRead: (id: string) => void;
  remove: (id: string) => void;
}

export const useTimeCapsule = create<State>()(
  persist(
    (set) => ({
      letters: [],
      add: (text, unlockAt) => {
        const letter: CapsuleLetter = { id: `cap-${Date.now()}`, text: text.trim(), createdAt: Date.now(), unlockAt };
        set((s) => ({ letters: [...s.letters, letter] }));
        return letter;
      },
      markRead: (id) => set((s) => ({ letters: s.letters.map((l) => (l.id === id ? { ...l, read: true } : l)) })),
      remove: (id) => set((s) => ({ letters: s.letters.filter((l) => l.id !== id) })),
    }),
    { name: 'time-capsule-v1', storage: throttledPersistStorage() },
  ),
);
