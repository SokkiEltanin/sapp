import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';

let _flushing = false;

// Retry Firestore writes for every locally-added/edited expense the cloud hasn't
// confirmed yet (weak/no signal when it was saved). setDoc is an upsert, so
// re-writing the full local row is safe for both new receipts and merged edits.
// Best-effort + guarded against overlap; call on cold start + every foreground.
export async function flushPendingExpenseWrites(): Promise<void> {
  if (_flushing) return;
  const { pendingSync, expenses } = useExpensesStore.getState();
  if (pendingSync.length === 0) return;
  _flushing = true;
  try {
    const byId = new Map(expenses.map((e) => [e.id, e]));
    for (const id of pendingSync) {
      const e = byId.get(id);
      if (!e) { useExpensesStore.getState().confirmSync(id); continue; } // deleted meanwhile
      try {
        await expensesService.addWithId(e.id, e);
        useExpensesStore.getState().confirmSync(id);
      } catch { /* still offline — keep it pending, try again next foreground */ }
    }
  } finally {
    _flushing = false;
  }
}
