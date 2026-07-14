import { parseBankNotification } from '@/utils/bankNotification';
import { loadMerchantMemory, merchantFor, guessCategory } from '@/utils/merchantMemory';
import { isKnownPaycheckSender } from '@/utils/paycheckSenders';
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

  // Incoming transfer → income. Auto-book ONLY confident salary-like income (reads
  // like salary OR a sender you've confirmed as a paycheck before) when full-auto is
  // on. Anything else (a refund, a friend paying you back, an unknown transfer) is NOT
  // silently booked as income — it goes to review on the dashboard so you decide.
  if (tx.direction === 'in') {
    const jd = !!tx.isSalary || await isKnownPaycheckSender(tx.storeKey);
    const confidentIncome = store.autoAll && jd;
    return store.enqueue({
      ...tx,
      category: 'other',
      suggestedCategory: 'other',
      jd,
      auto: confidentIncome,
      ...(confidentIncome ? {} : { flagReason: jd ? undefined : 'przelew przychodzący — potwierdź, czy to przychód' }),
    });
  }

  const mem = await loadMerchantMemory();
  const learned = merchantFor(tx.storeKey, mem);
  const category = learned?.category ?? guessCategory(tx.store);
  // Verify better, but never critically drop: auto-book the usual card payment. Only
  // genuinely WEIRD ones ask — an unusually large amount (a common sign of a mis-parsed
  // figure, e.g. 10,18 read as 1018). A missing merchant name is NOT weird enough to
  // block (it just books as "Płatność"), so it no longer forces a confirmation.
  const uncertain = tx.amount > 1500;
  const flagReason = uncertain ? 'nietypowo wysoka kwota — potwierdź' : undefined;
  return store.enqueue({
    ...tx,
    store: learned?.name ?? tx.store,
    category,
    suggestedCategory: category,
    // Full autopilot logs every card payment straight away; otherwise a merchant has to
    // earn trust (5 clean accepts) before its payments skip review — and uncertain ones
    // always fall back to review regardless.
    auto: (store.autoAll || !!learned?.auto) && !uncertain,
    ...(uncertain ? { flagReason } : {}),
  });
}
