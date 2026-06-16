import { addDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { userCol, userDoc } from './firebase';
import { MaintenanceItem } from '@/types';

const COL = 'maintenanceItems';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const maintenanceService = {
  async getAll(): Promise<MaintenanceItem[]> {
    const q = query(userCol(COL), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as MaintenanceItem));
  },

  async add(it: Omit<MaintenanceItem, 'id' | 'createdAt' | 'updatedAt'>): Promise<MaintenanceItem> {
    const now = new Date().toISOString();
    const data = strip({ ...it, createdAt: now, updatedAt: now });
    const ref = await addDoc(userCol(COL), data);
    return { ...it, id: ref.id, createdAt: now, updatedAt: now };
  },

  async update(id: string, updates: Partial<MaintenanceItem>): Promise<void> {
    await updateDoc(userDoc(COL, id), strip({ ...updates, updatedAt: new Date().toISOString() }));
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(userDoc(COL, id));
  },
};

// Days until the next replacement is due (negative = overdue).
export function dueInDays(it: MaintenanceItem): number {
  const due = new Date(it.lastChangedDate);
  due.setDate(due.getDate() + it.intervalDays);
  return Math.round((due.getTime() - Date.now()) / 86_400_000);
}
