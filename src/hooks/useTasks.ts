import { useEffect } from 'react';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useCalendarStore } from '@/store/calendarStore';
import { tasksService } from '@/services/calendarService';
import { notificationsService } from '@/services/notificationsService';
import { usePetStore } from '@/store/petStore';
import { Task, TaskRecurring, Subtask } from '@/types';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const SAVE_FAIL = 'Nie zapisano — sprawdź połączenie';

// ─── Pet reward: finishing your real tasks feeds the companion ───────────────
// You set a task's difficulty yourself; the harder you rate it, the more coins the
// pet earns when you complete it (1 / 2 / 3). Every milestone you tick off gives a
// small XP nibble so breaking a task down pays off as you chip at it.
export function taskCoins(difficulty?: number): number {
  if (!difficulty) return 1;
  if (difficulty <= 2) return 1;   // Łatwe / Proste
  if (difficulty === 3) return 2;  // Średnie
  return 3;                        // Trudne / Hardkor
}
function taskXp(difficulty?: number): number {
  return 6 + (difficulty ?? 1) * 3;
}
const MILESTONE_XP = 4;

function nextDeadline(iso: string, recurring: TaskRecurring): string {
  const d = new Date(iso);
  if (recurring === 'daily')   d.setDate(d.getDate() + 1);
  if (recurring === 'weekly')  d.setDate(d.getDate() + 7);
  if (recurring === 'monthly') d.setMonth(d.getMonth() + 1);
  return d.toISOString();
}

export function useTasks() {
  const { tasks, isLoading, setTasks, addTask, updateTask, deleteTask, setLoading } =
    useCalendarStore();

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const data = await tasksService.getAllTasks();
      const now = new Date();
      // auto-unsnooze tasks whose snooze has expired
      for (const task of data) {
        if (task.status === 'snoozed' && task.snoozedUntil && new Date(task.snoozedUntil) <= now) {
          task.status = 'pending';
          tasksService.updateTask(task.id, { status: 'pending' }).catch(() => {});
          notificationsService.cancelSnoozeReminder(task.id).catch(() => {});
        }
      }
      setTasks(data);
      // Reschedule deadline reminders for all pending tasks with future deadlines
      const nowStr = new Date().toISOString();
      for (const task of data) {
        if (task.status === 'pending' && task.deadline && task.deadline > nowStr) {
          notificationsService.scheduleTaskDeadlineReminder(task.id, task.title, task.deadline).catch(() => {});
        }
      }
      // Reschedule daily todo list with fresh task data
      AsyncStorage.getItem('notif_todo_enabled').then(enabled => {
        if (enabled !== 'true') return;
        return Promise.all([
          AsyncStorage.getItem('notif_todo_hour'),
          AsyncStorage.getItem('notif_todo_min'),
        ]).then(([h, m]) => {
          const hour = parseInt(h ?? '9');
          const min  = parseInt(m ?? '0');
          notificationsService.scheduleDailyTodoList(hour, min, data).catch(() => {});
        });
      }).catch(() => {});
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const create = async (data: Omit<Task, 'id' | 'createdAt' | 'updatedAt'>): Promise<Task> => {
    const task = await tasksService.addTask(data);
    addTask(task);
    if (task.deadline) {
      notificationsService.scheduleTaskDeadlineReminder(task.id, task.title, task.deadline).catch(() => {});
    }
    return task;
  };

  const update = async (id: string, updates: Partial<Omit<Task, 'id' | 'createdAt' | 'updatedAt'>>) => {
    updateTask(id, updates);
    if ('deadline' in updates) {
      notificationsService.cancelTaskReminder(id).catch(() => {});
      if (updates.deadline) {
        const task = tasks.find(t => t.id === id);
        notificationsService.scheduleTaskDeadlineReminder(id, task?.title ?? '', updates.deadline).catch(() => {});
      }
    }
    try {
      await tasksService.updateTask(id, updates);
    } catch {
      haptic.error();
      toast.error(SAVE_FAIL);
      load();
    }
  };

  const toggle = async (id: string) => {
    const task = tasks.find((t) => t.id === id);
    if (!task) return;
    const next = task.status === 'done' ? 'pending' : 'done';
    if (next === 'done') {
      haptic.success();
      const coins = taskCoins(task.difficulty);
      const pet = usePetStore.getState();
      pet.addCoins(coins);
      pet.addXp(taskXp(task.difficulty));
      toast.success(`Ukończono!  +${coins} 🪙`);
    } else haptic.tap();
    await update(id, { status: next });
    if (next === 'done') {
      notificationsService.cancelTaskReminder(id).catch(() => {});
      if (task.recurring && task.recurring !== 'none' && task.deadline) {
        const newDeadline = nextDeadline(task.deadline, task.recurring);
        await create({
          title: task.title,
          description: task.description,
          deadline: newDeadline,
          status: 'pending',
          priority: task.priority,
          difficulty: task.difficulty,
          estimatedPomodoros: task.estimatedPomodoros,
          tags: task.tags ?? [],
          recurring: task.recurring,
        });
      }
    }
  };

  const snooze = async (id: string, until: Date) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const snoozedUntil = until.toISOString();
    updateTask(id, { status: 'snoozed', snoozedUntil });
    notificationsService.cancelTaskReminder(id).catch(() => {});
    notificationsService.scheduleSnoozeReminder(id, task.title, until).catch(() => {});
    try {
      await tasksService.updateTask(id, { status: 'snoozed', snoozedUntil });
    } catch {
      haptic.error();
      toast.error(SAVE_FAIL);
      load();
    }
  };

  const unsnooze = async (id: string) => {
    updateTask(id, { status: 'pending', snoozedUntil: undefined });
    notificationsService.cancelSnoozeReminder(id).catch(() => {});
    try {
      await tasksService.updateTask(id, { status: 'pending' });
    } catch {
      haptic.error();
      toast.error(SAVE_FAIL);
      load();
    }
  };

  const remove = async (id: string) => {
    deleteTask(id);
    notificationsService.cancelTaskReminder(id).catch(() => {});
    try {
      await tasksService.deleteTask(id);
    } catch {
      haptic.error();
      toast.error('Nie usunięto — sprawdź połączenie');
      load();
    }
  };

  const getById = (id: string) => tasks.find(t => t.id === id) ?? null;

  const addSubtask = async (taskId: string, title: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const newSub: Subtask = { id: Date.now().toString(), title, done: false };
    const subtasks = [...(task.subtasks ?? []), newSub];
    updateTask(taskId, { subtasks });
    await tasksService.updateTask(taskId, { subtasks }).catch(() => load());
  };

  const toggleSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const sub = (task.subtasks ?? []).find(s => s.id === subtaskId);
    const becomingDone = sub ? !sub.done : false;
    const subtasks = (task.subtasks ?? []).map(s =>
      s.id === subtaskId ? { ...s, done: !s.done } : s,
    );
    updateTask(taskId, { subtasks });
    if (becomingDone) {
      usePetStore.getState().addXp(MILESTONE_XP);
      toast.success(`Kamień zaliczony  +${MILESTONE_XP} XP`);
    }
    await tasksService.updateTask(taskId, { subtasks }).catch(() => load());
  };

  const removeSubtask = async (taskId: string, subtaskId: string) => {
    const task = tasks.find(t => t.id === taskId);
    if (!task) return;
    const subtasks = (task.subtasks ?? []).filter(s => s.id !== subtaskId);
    updateTask(taskId, { subtasks });
    await tasksService.updateTask(taskId, { subtasks }).catch(() => load());
  };

  return { tasks, isLoading, reload: load, create, update, toggle, snooze, unsnooze, remove, getById, addSubtask, toggleSubtask, removeSubtask };
}
