import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { findMatchingExpense, findMatchingIncome, sameLocalDay } from '@/utils/bankNotification';
import { recordMerchantAccept, MerchantInfo } from '@/utils/merchantMemory';
import { PendingBankTx } from '@/store/bankQueueStore';
import { useWorkStore } from '@/store/workStore';
import { useSubscriptionsStore } from '@/store/subscriptionsStore';
import { subscriptionsService } from '@/services/subscriptionsService';
import { matchSubscriptionForPayment, advanceBillingDate, isConfidentSubMatch, queueSubConfirm } from '@/utils/subscriptionAuto';
import { rememberPaycheckSender } from '@/utils/paycheckSenders';

// A bank payment that settles a subscription: if it's a CONFIDENT match (same
// currency + close amount) advance the billing date silently, so the "zapłaciłeś?"
// prompt stops asking. If it only matches by NAME but the amount/currency differs
// (e.g. a EUR charge for a PLN sub, floating with the exchange rate) queue a
// dashboard confirmation "is this your Claude subscription — 22,14 EUR?" instead.
async function maybeAutoPaySubscription(p: PendingBankTx): Promise<void> {
  try {
    let subs = useSubscriptionsStore.getState().subscriptions;
    if (!subs.length) subs = await subscriptionsService.getAll();
    const sub = matchSubscriptionForPayment({ store: p.store, amount: p.amount, dateISO: p.dateISO }, subs);
    if (!sub) return;
    if (isConfidentSubMatch({ store: p.store, amount: p.amount, dateISO: p.dateISO, currency: p.currency }, sub)) {
      const next = advanceBillingDate(sub.nextBillingDate, sub.billingCycle);
      if (next === sub.nextBillingDate) return;
      useSubscriptionsStore.getState().updateSubscription(sub.id, { nextBillingDate: next });
      await subscriptionsService.update(sub.id, { nextBillingDate: next });
    } else {
      await queueSubConfirm({
        subId: sub.id, subName: sub.name, merchant: p.store || sub.name,
        amount: p.amount, currency: p.currency || 'PLN', date: p.dateISO.slice(0, 10),
      });
    }
  } catch { /* best-effort */ }
}

export interface CommitResult {
  ok: boolean;
  matched: boolean;        // merged into an already-scanned receipt instead of adding
  merchant?: MerchantInfo; // updated trust info (cleanAccepts / auto)
}

// Turn one confirmed bank payment into a real expense: if a scanned receipt with the
// same amount is already there (within the match window) mark it bank-confirmed;
// otherwise add a fresh expense. Then teach the merchant memory (unless learn:false).
// Shared by the manual review screen and the auto-accept processor so both behave
// identically. Reads/writes the live expenses store, so run it with expenses loaded.
export async function commitBankTx(
  p: PendingBankTx,
  opts?: { corrected?: boolean; learn?: boolean },
): Promise<CommitResult> {
  const st = useExpensesStore.getState();

  // ── Incoming transfer → income ──────────────────────────────────────────────
  if (p.direction === 'in') {
    const dup = findMatchingIncome(p, st.expenses);
    try {
      if (dup) {
        st.updateExpense(dup.id, { bankMatched: true });
        expensesService.update(dup.id, { bankMatched: true }).catch(() => {});
        return { ok: true, matched: true };
      }
      const wp = (useWorkStore.getState().settings.workPrefix ?? '').trim();
      const note = p.jd && wp ? `${wp} ${p.store || 'Wynagrodzenie'}` : (p.store || 'Przychód');
      const exp = await expensesService.add({
        type: 'income', amount: p.amount, currency: p.currency || 'PLN',
        category: (p.jd ? 'salary' : 'other') as any,
        tags: p.jd && wp ? [wp] : [],
        note, date: p.dateISO, paymentMethod: 'card', bankMatched: true,
      } as any);
      st.addExpense(exp);
      // Teach the paycheck-sender memory so next month's transfer from this employer
      // auto-flags as [JD] even without a "wynagrodzenie" keyword.
      if (p.jd) rememberPaycheckSender(p.storeKey).catch(() => {});
      return { ok: true, matched: false };
    } catch {
      return { ok: false, matched: !!dup };
    }
  }

  // Dedup: a re-delivered / re-drained PeoPay notification must NOT book the same
  // payment twice. If an expense with this exact amount + same day + same merchant is
  // already there — INCLUDING one we booked from the bank before (findMatchingExpense
  // skips bankMatched, so it can't catch a re-drain) — skip it.
  const pTime = new Date(p.dateISO).getTime();
  const storeMatches = (e: { storeName?: string; note?: string }) => {
    const hay = `${e.storeName ?? ''} ${e.note ?? ''}`.toLowerCase();
    return !p.storeKey || hay.includes(p.storeKey) || p.storeKey.includes((e.storeName ?? '').toLowerCase().split(/\s+/)[0] ?? '');
  };
  const already = st.expenses.find(e =>
    (e.type === 'expense' || !e.type) &&
    Math.abs(e.amount - p.amount) <= 0.011 &&
    !!e.date && sameLocalDay(new Date(e.date).getTime(), pTime) &&
    storeMatches(e),
  );
  if (already) {
    if (!already.bankMatched) {
      st.updateExpense(already.id, { bankMatched: true });
      expensesService.update(already.id, { bankMatched: true }).catch(() => {});
    }
    return { ok: true, matched: true };
  }

  const match = findMatchingExpense(p, st.expenses);
  try {
    if (match) {
      st.updateExpense(match.id, { bankMatched: true });
      expensesService.update(match.id, { bankMatched: true }).catch(() => {});
    } else {
      const exp = await expensesService.add({
        type: 'expense', amount: p.amount, currency: p.currency || 'PLN', category: p.category,
        tags: p.tags ?? [], note: p.store || (p.selfTransfer ? 'Przelew na oszczędności' : 'Płatność'), date: p.dateISO,
        ...(p.store ? { storeName: p.store } : {}),
        paymentMethod: p.method === 'cash' ? 'cash' : 'card', bankMatched: true,
      });
      st.addExpense(exp);
    }
    let merchant: MerchantInfo | undefined;
    if (opts?.learn !== false) {
      merchant = await recordMerchantAccept(p.storeKey, {
        category: p.category, name: p.store, corrected: !!opts?.corrected,
      });
    }
    await maybeAutoPaySubscription(p);
    return { ok: true, matched: !!match, merchant };
  } catch {
    return { ok: false, matched: !!match };
  }
}
