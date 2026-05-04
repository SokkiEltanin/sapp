import { collection, doc, addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, where } from 'firebase/firestore';
import { db } from './firebase';
import { MoodEntry } from '@/types';

const COL = 'mood';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const moodService = {
  async getAll(): Promise<MoodEntry[]> {
    const q = query(collection(db, COL), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as MoodEntry));
  },

  async getByDate(date: string): Promise<MoodEntry | null> {
    const q = query(collection(db, COL), where('date', '==', date));
    const snap = await getDocs(q);
    if (snap.empty) return null;
    const d = snap.docs[0];
    return { id: d.id, ...d.data() } as MoodEntry;
  },

  async add(entry: Omit<MoodEntry, 'id' | 'createdAt' | 'updatedAt'>): Promise<MoodEntry> {
    const now = new Date().toISOString();
    const data = strip({ ...entry, createdAt: now, updatedAt: now });
    const ref = await addDoc(collection(db, COL), data);
    return { ...entry, id: ref.id, createdAt: now, updatedAt: now };
  },

  async update(id: string, updates: Partial<MoodEntry>): Promise<void> {
    await updateDoc(doc(db, COL, id), strip({ ...updates, updatedAt: new Date().toISOString() }));
  },

  async remove(id: string): Promise<void> {
    await deleteDoc(doc(db, COL, id));
  },
};
