import { addDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { userCol, userDoc } from './firebase';
import { Debt } from '@/types';

const COL = 'debts';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const debtsService = {
  async getAll(): Promise<Debt[]> {
    const q = query(userCol(COL), orderBy('askDate', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Debt));
  },

  async add(debt: Omit<Debt, 'id' | 'createdAt' | 'updatedAt'>): Promise<Debt> {
    const now = new Date().toISOString();
    const data = strip({ ...debt, createdAt: now, updatedAt: now });
    const ref = await addDoc(userCol(COL), data);
    return { ...debt, id: ref.id, createdAt: now, updatedAt: now };
  },

  async update(id: string, updates: Partial<Debt>): Promise<void> {
    await updateDoc(userDoc(COL, id), strip({ ...updates, updatedAt: new Date().toISOString() }));
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(userDoc(COL, id));
  },
};
