import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { throttledPersistStorage } from '@/utils/throttledStorage';
import { ParsedBankTx } from '@/utils/bankNotification';
import { ExpenseCategory } from '@/types';

// A parsed bank payment waiting for the user to confirm (accept / fix / reject).
export interface PendingBankTx extends ParsedBankTx {
  id: string;
  category: ExpenseCategory;      // current (possibly user-edited) category — expenses only
  suggestedCategory: ExpenseCategory; // what the reader guessed — to detect a correction
  tags?: string[];                // extra tags to book with (e.g. ['revolut'] for a self-transfer)
  auto?: boolean;                // trusted merchant → auto-accept on next app open
  jd?: boolean;                  // income: log as a [JD] paycheck (salary + work tag)
  flagReason?: string;           // set → held for confirmation (something looked off), shown in review
  addedAt: number;
}

// Cap on the notification-dedup memory below — bounded so it can never grow unbounded
// (roughly a year+ of daily bank traffic at typical volume; old entries just age out).
const SEEN_NOTIFICATIONS_MAX = 500;

interface BankQueueState {
  pending: PendingBankTx[];
  enabled: boolean;              // master switch for auto-logging from notifications
  autoAll: boolean;              // full autopilot: log every card payment WITHOUT review
  // 2026-09-09, user: sama płatność za internet (P4/Play) zalogowana DWA razy, wczoraj i
  // dziś — "nie wiem czemu zdublowało mi wczorajszy wyciąg mimo że go nie mam już w
  // powiadomieniach na telefonie... niech zapisuje datę kiedy dostał, żeby sprawdzić czas
  // powiadomienia". Root cause: Androidowy `NotificationListenerService`
  // (`withBankNotificationListener.js`) ma DRUGĄ ścieżkę dostawy poza `onNotificationPosted`
  // — `onListenerConnected` (system re-bind, np. po zabiciu usługi przez OEM battery-saver)
  // zamiata WSZYSTKIE wciąż widoczne powiadomienia w zasobniku. Jeśli bankowa apka nie
  // skasowała swojego powiadomienia od razu, ten sam realny event potrafi zostać dostarczony
  // PONOWNIE dni później — natywny dedup w `append()` (Kotlin) łapie to tylko w ramach JEDNEGO
  // niewyczyszczonego pliku przechwytu; `enqueue`'s dedup niżej patrzy tylko 3 minuty wstecz
  // w AKTUALNEJ kolejce — oryginał jest już dawno zatwierdzony i usunięty z `pending`, więc oba
  // zawodzą. `seenNotifications` to trwała (persist), międzysesyjna pamięć kluczy
  // `pkg:postTime` (Android `n.postTime` — ORYGINALNY czas wysłania powiadomienia, stabilny
  // między wielokrotnymi dostawami tego samego eventu, w przeciwieństwie do naszego czasu
  // odebrania) — sprawdzana W `ingestBankNotification` PRZED parsowaniem, więc dokładnie ten
  // sam event nigdy nie trafi do kolejki drugi raz, niezależnie ile dni minęło.
  seenNotifications: string[];
  setEnabled: (v: boolean) => void;
  setAutoAll: (v: boolean) => void;
  wasNotificationSeen: (key: string) => boolean;
  markNotificationSeen: (key: string) => void;
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
      autoAll: false,
      seenNotifications: [],
      setEnabled: (v) => set({ enabled: v }),
      wasNotificationSeen: (key) => get().seenNotifications.includes(key),
      markNotificationSeen: (key) => set((s) => ({
        seenNotifications: s.seenNotifications.includes(key)
          ? s.seenNotifications
          : [...s.seenNotifications, key].slice(-SEEN_NOTIFICATIONS_MAX),
      })),
      // Turning full-auto ON flips the whole queued backlog to `auto` — incoming
      // transfers included. Income used to be excluded here, which meant even with
      // full-auto on, a credit still waited for a tap. Anything explicitly flagged
      // (flagReason) stays manual: that's the "ask me when it looks off" case.
      setAutoAll: (v) => set((s) => ({
        autoAll: v,
        pending: v ? s.pending.map(p => (p.flagReason ? p : { ...p, auto: true })) : s.pending,
      })),
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
    { name: 'bank-queue-v1', storage: throttledPersistStorage() },
  ),
);
