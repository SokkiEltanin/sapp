import { addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, setDoc, doc, collection } from 'firebase/firestore';
import { userCol, userDoc, db } from './firebase';
import { Expense } from '@/types';

const COL = 'expenses';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const expensesService = {
  async getAll(): Promise<Expense[]> {
    const q = query(await userCol(COL), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    // Normalise: an old/partial Firestore doc may lack `tags`, and code across the
    // app calls e.tags.includes/.map unguarded — a single missing field would crash
    // a whole screen. Guarantee the array here, at the one load boundary.
    return snap.docs.map((d) => {
      const data = d.data() as Expense;
      return { ...data, id: d.id, tags: Array.isArray(data.tags) ? data.tags : [] };
    });
  },

  async add(expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
    const now = new Date().toISOString();
    const data = strip({ ...expense, createdAt: now, updatedAt: now });
    const docRef = await addDoc(await userCol(COL), data);
    return { ...expense, id: docRef.id, createdAt: now, updatedAt: now };
  },

  // Offline-safe id: `doc(collection)` mints a Firestore-style random id WITHOUT
  // touching the network — and, since 2026-09-15, without needing `userCol()`/auth
  // either (a throwaway `collection(db, COL)` ref, not the real per-user path — the
  // random id Firestore generates doesn't depend on the collection's path at all).
  // Stays SYNCHRONOUS on purpose: lets a caller update the local store + navigate away
  // instead of awaiting `add()` — the web Firestore SDK's write promise doesn't
  // resolve until the server acks, so `await add()` froze the screen on weak/no
  // signal (the receipt-save "black screen", e.g. scanning in-store). Making this
  // async (to await the now-async `userCol`) would force both call sites to await it
  // too, defeating that exact purpose — so it deliberately sidesteps `userCol` instead.
  newId(): string {
    return doc(collection(db, COL)).id;
  },

  // Write with a client-generated id. Call it fire-and-forget (`.catch(() => {})`)
  // right after the local-store update so the UI never blocks on the cloud write.
  async addWithId(id: string, expense: Omit<Expense, 'id'>): Promise<void> {
    await setDoc(await userDoc(COL, id), strip({ ...(expense as any) }));
  },

  async update(id: string, updates: Partial<Expense>): Promise<void> {
    await updateDoc(await userDoc(COL, id), strip({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(await userDoc(COL, id));
  },
};
