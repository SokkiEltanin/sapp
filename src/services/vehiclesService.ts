import { addDoc, updateDoc, deleteDoc, getDocs, query, orderBy } from 'firebase/firestore';
import { userCol, userDoc } from './firebase';
import { Vehicle } from '@/types';

const COL = 'vehicles';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const vehiclesService = {
  async getAll(): Promise<Vehicle[]> {
    const q = query(userCol(COL), orderBy('createdAt', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map(d => ({ id: d.id, ...d.data() } as Vehicle));
  },

  async add(v: Omit<Vehicle, 'id' | 'createdAt' | 'updatedAt'>): Promise<Vehicle> {
    const now = new Date().toISOString();
    const data = strip({ ...v, createdAt: now, updatedAt: now });
    const ref = await addDoc(userCol(COL), data);
    return { ...v, id: ref.id, createdAt: now, updatedAt: now };
  },

  async update(id: string, updates: Partial<Vehicle>): Promise<void> {
    await updateDoc(userDoc(COL, id), strip({ ...updates, updatedAt: new Date().toISOString() }));
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(userDoc(COL, id));
  },
};
