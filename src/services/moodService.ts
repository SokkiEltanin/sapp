import { deleteDoc, getDocs, query, orderBy, where, setDoc, doc, collection } from 'firebase/firestore';
import { userCol, userDoc, withTimeout, db } from './firebase';
import { MoodEntry } from '@/types';

const COL = 'mood';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const moodService = {
  async getAll(): Promise<MoodEntry[]> {
    const q = query(await userCol(COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MoodEntry));
  },

  async getByDate(date: string): Promise<MoodEntry | null> {
    const q = query(await userCol(COL), where('date', '==', date));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as MoodEntry;
  },

  // Offline-safe id: mints a Firestore-style random id WITHOUT touching the network or
  // even auth (throwaway `collection(db, COL)` ref, not the real per-user path — the id
  // Firestore generates doesn't depend on the collection's path). Stays SYNCHRONOUS on
  // purpose so a caller can update the local store + close the modal immediately instead
  // of awaiting a network round-trip — ten sam wzorzec co `expensesService.newId()`.
  newId(): string {
    return doc(collection(db, COL)).id;
  },

  // Write with a client-generated id (upsert — safe for both a brand-new entry and a
  // re-write of an edited one). Call it fire-and-forget (`.catch(() => {})`) right after
  // the local-store update, jak `expensesService.addWithId` — UI nigdy nie czeka na chmurę
  // (2026-09-21, user: "moze zapisywac offline i wyslac jak bedzie wifi", nawiązanie do
  // zawieszonego "Zapisuję..." z §149). `withTimeout` chroni RETRY-KOLEJKĘ (moodSync.ts) —
  // bez tego jeden zawieszony zapis blokowałby próby dla reszty `pendingSync` na zawsze.
  async addWithId(id: string, entry: Omit<MoodEntry, 'id'>): Promise<void> {
    await withTimeout(setDoc(await userDoc(COL, id), strip({ ...(entry as any) })));
  },

  async remove(id: string): Promise<void> {
    await withTimeout(deleteDoc(await userDoc(COL, id)));
  },
};
