import { create } from 'zustand';
import { WorkShift, WorkSettings, DEFAULT_WORK_SETTINGS } from '@/types';

interface WorkState {
  shifts: WorkShift[];
  settings: WorkSettings;
  isLoading: boolean;

  setShifts:   (shifts: WorkShift[]) => void;
  addShift:    (shift: WorkShift)    => void;
  updateShift: (id: string, updates: Partial<WorkShift>) => void;
  deleteShift: (id: string)          => void;
  setSettings: (s: WorkSettings)    => void;
  setLoading:  (v: boolean)         => void;
}

export const useWorkStore = create<WorkState>((set) => ({
  shifts:    [],
  settings:  { ...DEFAULT_WORK_SETTINGS },
  isLoading: false,

  setShifts:   (shifts)          => set({ shifts }),
  addShift:    (shift)           => set(s => ({ shifts: [shift, ...s.shifts] })),
  updateShift: (id, updates)     => set(s => ({ shifts: s.shifts.map(sh => sh.id === id ? { ...sh, ...updates } : sh) })),
  deleteShift: (id)              => set(s => ({ shifts: s.shifts.filter(sh => sh.id !== id) })),
  setSettings: (settings)        => set({ settings }),
  setLoading:  (isLoading)       => set({ isLoading }),
}));
