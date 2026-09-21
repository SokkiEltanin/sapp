import { useMoodStore } from '@/store/moodStore';
import { moodService } from '@/services/moodService';

let _flushing = false;

// Retry Firestore writes for every locally-added/edited mood entry the cloud hasn't
// confirmed yet (weak/no signal when it was saved) — ten sam wzorzec co
// `flushPendingExpenseWrites` w expenseSync.ts. `setDoc` (via `addWithId`) is an upsert,
// so re-writing the full local row is safe for both a new entry and an edited one.
// Best-effort + guarded against overlap; call on cold start + every foreground.
export async function flushPendingMoodWrites(): Promise<void> {
  if (_flushing) return;
  const { pendingSync, entries } = useMoodStore.getState();
  if (pendingSync.length === 0) return;
  _flushing = true;
  try {
    const byId = new Map(entries.map((e) => [e.id, e]));
    for (const id of pendingSync) {
      const e = byId.get(id);
      if (!e) { useMoodStore.getState().confirmSync(id); continue; } // deleted meanwhile
      try {
        await moodService.addWithId(e.id, e);
        useMoodStore.getState().confirmSync(id);
      } catch { /* still offline — keep it pending, try again next foreground */ }
    }
  } finally {
    _flushing = false;
  }
}
