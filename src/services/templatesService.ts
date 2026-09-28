import { addDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { userCol, userDoc, withTimeout } from './firebase';
import { ExpenseTemplate } from '@/types';

const COL = 'expenseTemplates';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const templatesService = {
  async getAll(): Promise<ExpenseTemplate[]> {
    const q = query(await userCol(COL), orderBy('name', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as ExpenseTemplate));
  },

  async add(tmpl: Omit<ExpenseTemplate, 'id' | 'createdAt' | 'updatedAt'>): Promise<ExpenseTemplate> {
    const now = new Date().toISOString();
    const data = strip({ ...tmpl, createdAt: now, updatedAt: now });
    const ref = await withTimeout(addDoc(await userCol(COL), data));
    return { ...tmpl, id: ref.id, createdAt: now, updatedAt: now };
  },

  async update(id: string, updates: Partial<ExpenseTemplate>): Promise<void> {
    await withTimeout(updateDoc(await userDoc(COL, id), strip({ ...updates, updatedAt: new Date().toISOString() })));
  },

  async remove(id: string): Promise<void> {
    await withTimeout(deleteDoc(await userDoc(COL, id)));
  },
};
