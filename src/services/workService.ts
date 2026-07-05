import { addDoc, updateDoc, deleteDoc, getDocs, query, orderBy, where } from 'firebase/firestore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { userCol, userDoc } from './firebase';
import { WorkShift, WorkSettings, DEFAULT_WORK_SETTINGS } from '@/types';

const SHIFTS_COL     = 'workShifts';
const SETTINGS_KEY   = 'work_settings_v1';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const workService = {
  // ── Shifts (Firebase) ────────────────────────────────────────────────────────

  async getShifts(fromDate?: string, toDate?: string): Promise<WorkShift[]> {
    let q = query(userCol(SHIFTS_COL), orderBy('date', 'desc'));
    const snap = await getDocs(q);
    let shifts = snap.docs.map(d => ({ id: d.id, ...d.data() } as WorkShift));
    if (fromDate) shifts = shifts.filter(s => s.date >= fromDate);
    if (toDate)   shifts = shifts.filter(s => s.date <= toDate);
    return shifts;
  },

  async addShift(shift: Omit<WorkShift, 'id' | 'createdAt'>): Promise<WorkShift> {
    const now = new Date().toISOString();
    const ref = await addDoc(userCol(SHIFTS_COL), strip({ ...shift, createdAt: now }));
    return { ...shift, id: ref.id, createdAt: now };
  },

  async updateShift(id: string, updates: Partial<WorkShift>): Promise<void> {
    await updateDoc(userDoc(SHIFTS_COL, id), strip(updates));
  },

  async deleteShift(id: string): Promise<void> {
    await deleteDoc(userDoc(SHIFTS_COL, id));
  },

  // ── Settings (AsyncStorage) ──────────────────────────────────────────────────

  async getSettings(): Promise<WorkSettings> {
    try {
      const raw = await AsyncStorage.getItem(SETTINGS_KEY);
      return raw ? { ...DEFAULT_WORK_SETTINGS, ...JSON.parse(raw) } : { ...DEFAULT_WORK_SETTINGS };
    } catch {
      return { ...DEFAULT_WORK_SETTINGS }; // corrupt JSON → fall back instead of throwing
    }
  },

  async saveSettings(settings: WorkSettings): Promise<void> {
    await AsyncStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
  },
};
