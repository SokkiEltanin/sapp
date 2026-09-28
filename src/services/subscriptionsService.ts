import { addDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { userCol, userDoc, withTimeout } from './firebase';
import { Subscription } from '@/types';

const COL = 'subscriptions';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const subscriptionsService = {
  async getAll(): Promise<Subscription[]> {
    const q = query(await userCol(COL), orderBy('nextBillingDate', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Subscription));
  },

  async add(sub: Omit<Subscription, 'id' | 'createdAt' | 'updatedAt'>): Promise<Subscription> {
    const now = new Date().toISOString();
    const data = strip({ ...sub, createdAt: now, updatedAt: now });
    const ref = await withTimeout(addDoc(await userCol(COL), data));
    return { ...sub, id: ref.id, createdAt: now, updatedAt: now };
  },

  async update(id: string, updates: Partial<Subscription>): Promise<void> {
    await withTimeout(updateDoc(await userDoc(COL, id), strip({ ...updates, updatedAt: new Date().toISOString() })));
  },

  async remove(id: string): Promise<void> {
    await withTimeout(deleteDoc(await userDoc(COL, id)));
  },
};
