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
import { CalendarEvent, Task } from '@/types';

const EVENTS_COL = 'events';
const TASKS_COL = 'tasks';

const strip = <T extends Record<string, any>>(obj: T): T =>
  Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as T;

export const calendarService = {
  async getAllEvents(): Promise<CalendarEvent[]> {
    const q = query(collection(db, EVENTS_COL), orderBy('date', 'asc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as CalendarEvent));
  },

  async addEvent(event: Omit<CalendarEvent, 'id' | 'createdAt'>): Promise<CalendarEvent> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(db, EVENTS_COL), strip({ ...event, createdAt: now }));
    return { ...event, id: ref.id, createdAt: now };
  },

  async updateEvent(id: string, updates: Partial<CalendarEvent>): Promise<void> {
    await updateDoc(doc(db, EVENTS_COL, id), updates);
  },

  async deleteEvent(id: string): Promise<void> {
    await deleteDoc(doc(db, EVENTS_COL, id));
  },
};

export const tasksService = {
  async getAllTasks(): Promise<Task[]> {
    const q = query(collection(db, TASKS_COL), orderBy('createdAt', 'desc'));
    const snap = await getDocs(q);
    return snap.docs.map((d) => ({ id: d.id, ...d.data() } as Task));
  },

  async addTask(task: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> {
    const now = new Date().toISOString();
    const ref = await addDoc(collection(db, TASKS_COL), strip({ ...task, createdAt: now, updatedAt: now }));
    return { ...task, id: ref.id, createdAt: now, updatedAt: now };
  },

  async updateTask(id: string, updates: Partial<Task>): Promise<void> {
    await updateDoc(doc(db, TASKS_COL, id), { ...updates, updatedAt: new Date().toISOString() });
  },

  async deleteTask(id: string): Promise<void> {
    await deleteDoc(doc(db, TASKS_COL, id));
  },
};
