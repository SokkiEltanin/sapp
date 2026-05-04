import { create } from 'zustand';
import { logSession } from '@/utils/pomodoroHistory';

export type PomodoroMode = 'work' | 'break' | 'long_break';

interface PomodoroState {
  taskId: string | null;
  taskTitle: string | null;
  mode: PomodoroMode;
  workMins: number;
  breakMins: number;
  longBreakMins: number;
  remaining: number;
  isRunning: boolean;
  completedRounds: number;

  startFor: (taskId: string | null, taskTitle: string | null) => void;
  pause: () => void;
  resume: () => void;
  reset: () => void;
  tick: () => void;
  nextRound: () => void;
  setWorkMins: (v: number) => void;
}

let _interval: ReturnType<typeof setInterval> | null = null;

function clearTick() {
  if (_interval) { clearInterval(_interval); _interval = null; }
}

export const usePomodoroStore = create<PomodoroState>((set, get) => ({
  taskId: null,
  taskTitle: null,
  mode: 'work',
  workMins: 25,
  breakMins: 5,
  longBreakMins: 15,
  remaining: 25 * 60,
  isRunning: false,
  completedRounds: 0,

  startFor: (taskId, taskTitle) => {
    clearTick();
    const { workMins } = get();
    set({ taskId, taskTitle, mode: 'work', remaining: workMins * 60, isRunning: true, completedRounds: 0 });
    _interval = setInterval(() => get().tick(), 1000);
  },

  pause: () => {
    clearTick();
    set({ isRunning: false });
  },

  resume: () => {
    if (get().isRunning) return;
    clearTick();
    set({ isRunning: true });
    _interval = setInterval(() => get().tick(), 1000);
  },

  reset: () => {
    clearTick();
    const { workMins } = get();
    set({ remaining: workMins * 60, isRunning: false, mode: 'work' });
  },

  tick: () => {
    const { remaining, mode, completedRounds, breakMins, longBreakMins, workMins } = get();
    if (remaining > 0) {
      set({ remaining: remaining - 1 });
      return;
    }
    clearTick();
    if (mode === 'work') {
      const rounds = completedRounds + 1;
      const nextMode: PomodoroMode = rounds % 4 === 0 ? 'long_break' : 'break';
      const nextSecs = (nextMode === 'long_break' ? longBreakMins : breakMins) * 60;
      const { taskId, taskTitle } = get();
      logSession(taskId, taskTitle, workMins).catch(() => {});
      set({ mode: nextMode, remaining: nextSecs, isRunning: false, completedRounds: rounds });
    } else {
      set({ mode: 'work', remaining: workMins * 60, isRunning: false });
    }
  },

  nextRound: () => {
    clearTick();
    const { mode, completedRounds, breakMins, longBreakMins, workMins } = get();
    if (mode === 'work') {
      const rounds = completedRounds + 1;
      const nextMode: PomodoroMode = rounds % 4 === 0 ? 'long_break' : 'break';
      set({ mode: nextMode, remaining: (nextMode === 'long_break' ? longBreakMins : breakMins) * 60, isRunning: false, completedRounds: rounds });
    } else {
      set({ mode: 'work', remaining: workMins * 60, isRunning: false });
    }
  },

  setWorkMins: (v) => {
    clearTick();
    set({ workMins: v, remaining: v * 60, isRunning: false, mode: 'work' });
  },
}));
