import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { findMatchingExpense } from '@/utils/bankNotification';
import { recordMerchantAccept, MerchantInfo } from '@/utils/merchantMemory';
import { PendingBankTx } from '@/store/bankQueueStore';

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
  const match = findMatchingExpense(p, st.expenses);
  try {
    if (match) {
      st.updateExpense(match.id, { bankMatched: true });
      expensesService.update(match.id, { bankMatched: true }).catch(() => {});
    } else {
      const exp = await expensesService.add({
        type: 'expense', amount: p.amount, currency: 'PLN', category: p.category,
        tags: [], note: p.store || 'Płatność', date: p.dateISO,
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
    return { ok: true, matched: !!match, merchant };
  } catch {
    return { ok: false, matched: !!match };
  }
}
