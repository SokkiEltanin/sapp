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

  // Incoming transfer → income. Full-auto means FULL auto: an ordinary credit is booked
  // straight away, exactly like a card payment. This used to hold back everything that
  // wasn't salary-like, so a normal transfer ("Wpłynęło 37,00 PLN … od OLESIA NEZHUHA")
  // just sat in review — which read as "the notification wasn't picked up at all".
  //
  // Verify better, but never drop: only genuinely odd ones ASK. `jd` still matters —
  // it's what tags the income as a paycheck (workPrefix) on commit.
  if (tx.direction === 'in') {
    const jd = !!tx.isSalary || await isKnownPaycheckSender(tx.storeKey);
    // A large credit that doesn't look like your paycheck is worth one glance — it's
    // the one case where booking it silently as income could quietly skew the stats.
    const uncertain = !jd && tx.amount > 1500;
    return store.enqueue({
      ...tx,
      category: 'other',
      suggestedCategory: 'other',
      jd,
      auto: store.autoAll && !uncertain,
      ...(uncertain ? { flagReason: 'duży przelew przychodzący — potwierdź, czy to przychód' } : {}),
    });
  }

  // Self-transfer to your own account (Revolut / savings): book it as a 'transfer' with
  // the 'revolut' tag so isSelfTransfer treats it as "odłożone" — an outflow from the
  // main account, NOT income and NOT counted as spending. Auto-book it (it's your own
  // money moving), never flag.
  if (tx.selfTransfer) {
    return store.enqueue({
      ...tx,
      category: 'transfer' as any,
      suggestedCategory: 'transfer' as any,
      tags: ['revolut'],
      auto: store.autoAll,
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
