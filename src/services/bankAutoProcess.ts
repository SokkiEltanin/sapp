import { useBankQueue } from '@/store/bankQueueStore';
import { commitBankTx } from './bankCommit';
import { toast } from '@/store/toastStore';

// Auto-accepts every queued payment from a TRUSTED (auto) merchant. Runs in-app on
// foreground so the expenses store is loaded and receipt-matching is reliable. Items
// from not-yet-trusted merchants are left in the queue for manual review. Best-effort
// + guarded against overlapping runs.
let _running = false;

export async function processAutoBankQueue(): Promise<number> {
  if (_running) return 0;
  _running = true;
  try {
    const q = useBankQueue.getState();
    if (!q.enabled) return 0;
    // Foreign-currency pushes never auto-accept, even from a trusted merchant — the real
    // PLN figure depends on that transaction's card FX rate, which only a human can supply
    // (see bank-review.tsx). They stay queued for manual review regardless of trust level.
    const auto = q.pending.filter(p => p.auto && (p.currency || 'PLN') === 'PLN');
    if (!auto.length) return 0;

    let done = 0;
    let total = 0;
    for (const p of auto) {
      const r = await commitBankTx(p, { corrected: false });
      if (r.ok) { useBankQueue.getState().remove(p.id); done++; total += p.amount; }
    }
    if (done > 0) {
      toast.success(done === 1
        ? `Auto-dodano płatność z banku: ${total.toFixed(2)} zł`
        : `Auto-dodano ${done} płatności z banku: ${total.toFixed(2)} zł`);
    }
    return done;
  } finally {
    _running = false;
  }
}
