import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { ParsedBankTx } from '@/utils/bankNotification';
import { ExpenseCategory } from '@/types';

// A parsed bank payment waiting for the user to confirm (accept / fix / reject).
export interface PendingBankTx extends ParsedBankTx {
  id: string;
  category: ExpenseCategory;      // current (possibly user-edited) category
  suggestedCategory: ExpenseCategory; // what the reader guessed — to detect a correction
  auto?: boolean;                // trusted merchant → auto-accept on next app open
  addedAt: number;
}

interface BankQueueState {
  pending: PendingBankTx[];
  enabled: boolean;              // master switch for auto-logging from notifications
  setEnabled: (v: boolean) => void;
  enqueue: (tx: Omit<PendingBankTx, 'id' | 'addedAt'>) => boolean; // false if duplicate
  update: (id: string, patch: Partial<PendingBankTx>) => void;
  remove: (id: string) => void;
  clear: () => void;
}

export const useBankQueue = create<BankQueueState>()(
  persist(
    (set, get) => ({
      pending: [],
      enabled: false,
      setEnabled: (v) => set({ enabled: v }),
      enqueue: (tx) => {
        // dedupe: same amount + within 3 min + same shop already queued
        const dup = get().pending.some(p =>
          Math.abs(p.amount - tx.amount) < 0.011 &&
          p.storeKey === tx.storeKey &&
          Math.abs(new Date(p.dateISO).getTime() - new Date(tx.dateISO).getTime()) < 3 * 60000,
        );
        if (dup) return false;
        set((s) => ({ pending: [{ ...tx, id: `bnk_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`, addedAt: Date.now() }, ...s.pending] }));
        return true;
      },
      update: (id, patch) => set((s) => ({ pending: s.pending.map(p => p.id === id ? { ...p, ...patch } : p) })),
      remove: (id) => set((s) => ({ pending: s.pending.filter(p => p.id !== id) })),
      clear: () => set({ pending: [] }),
    }),
    { name: 'bank-queue-v1', storage: createJSONStorage(() => AsyncStorage) },
  ),
);
