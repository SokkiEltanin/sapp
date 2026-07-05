import { parseBankNotification } from '@/utils/bankNotification';
import { loadMerchantMemory, merchantFor, guessCategory } from '@/utils/merchantMemory';
import { useBankQueue } from '@/store/bankQueueStore';

// Turn one bank push notification into a queued, pre-categorised payment. Safe to call
// from a headless task (uses zustand + AsyncStorage, both work with the app closed).
// Trusted (auto) merchants are still queued but flagged `auto` — the in-app processor
// commits those without manual review the next time the app is opened (so receipt
// matching runs with expenses loaded and nothing gets double-counted).
export async function ingestBankNotification(title: string, text: string): Promise<boolean> {
  const store = useBankQueue.getState();
  if (!store.enabled) return false;
  const tx = parseBankNotification(title, text);
  if (!tx) return false;

  // Incoming transfer → income. Default to "[JD] paycheck" when it looks like salary
  // (the common case for a single job); the user can flip it in review.
  if (tx.direction === 'in') {
    return store.enqueue({
      ...tx,
      category: 'other',
      suggestedCategory: 'other',
      jd: !!tx.isSalary,
      auto: false, // never auto-log income blindly — always review first
    });
  }

  const mem = await loadMerchantMemory();
  const learned = merchantFor(tx.storeKey, mem);
  const category = learned?.category ?? guessCategory(tx.store);
  return store.enqueue({
    ...tx,
    store: learned?.name ?? tx.store,
    category,
    suggestedCategory: category,
    auto: !!learned?.auto,
  });
}
