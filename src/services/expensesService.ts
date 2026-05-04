import {
  collection,
  doc,
  addDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  query,
  orderBy,
} from 'firebase/firestore';
import { db } from './firebase';
import { Expense } from '@/types';

const COL = 'expenses';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const expensesService = {
  async getAll(): Promise<Expense[]> {
    const q = query(collection(db, COL), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Expense));
  },

  async add(expense: Omit<Expense, 'id' | 'createdAt' | 'updatedAt'>): Promise<Expense> {
    const now = new Date().toISOString();
    const data = strip({ ...expense, createdAt: now, updatedAt: now });
    const docRef = await addDoc(collection(db, COL), data);
    return { ...expense, id: docRef.id, createdAt: now, updatedAt: now };
  },

  async update(id: string, updates: Partial<Expense>): Promise<void> {
    await updateDoc(doc(db, COL, id), strip({
      ...updates,
      updatedAt: new Date().toISOString(),
    }));
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COL, id));
  },
};
