import { useState, useEffect, useCallback } from 'react';
import { Habit } from '@/types';
import { getHabits, saveHabits, getCompletions, setCompletions } from '@/utils/habits';
import { notificationsService } from '@/services/notificationsService';

function applyReminder(habit: Habit) {
  if (habit.reminderTime) {
    const [h, m] = habit.reminderTime.split(':').map(Number);
    notificationsService.scheduleHabitReminder(habit.id, habit.title, h, m).catch(() => {});
  } else {
    notificationsService.cancelHabitReminder(habit.id).catch(() => {});
  }
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function dateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayStr() { return dateStr(new Date()); }
function offsetDate(from: string, days: number): string {
  const d = new Date(from);
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

export function useHabits() {
  const [habits, setHabits]           = useState<Habit[]>([]);
  const [completions, setComp]        = useState<Record<string, string[]>>({});
  const [isLoading, setIsLoading]     = useState(true);

  const today = todayStr();

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const list  = await getHabits();
      const dates = Array.from({ length: 30 }, (_, i) => offsetDate(today, -i));
      const cols  = await Promise.all(dates.map(d => getCompletions(d)));
      const map: Record<string, string[]> = {};
      dates.forEach((d, i) => { map[d] = cols[i]; });
      setHabits(list);
      setComp(map);
    } finally {
      setIsLoading(false);
    }
  }, [today]);

  useEffect(() => { load(); }, []);

  const toggle = useCallback(async (habitId: string) => {
    const current = completions[today] ?? [];
    const next = current.includes(habitId)
      ? current.filter(id => id !== habitId)
      : [...current, habitId];
    setComp(prev => ({ ...prev, [today]: next }));
    await setCompletions(today, next);
  }, [completions, today]);

  const add = useCallback(async (partial: Omit<Habit, 'id' | 'createdAt'>) => {
    const newHabit: Habit = {
      ...partial,
      id: Date.now().toString(),
      createdAt: new Date().toISOString(),
    };
    const next = [...habits, newHabit];
    setHabits(next);
    await saveHabits(next);
    applyReminder(newHabit);
    return newHabit;
  }, [habits]);

  const remove = useCallback(async (id: string) => {
    notificationsService.cancelHabitReminder(id).catch(() => {});
    const next = habits.filter(h => h.id !== id);
    setHabits(next);
    await saveHabits(next);
  }, [habits]);

  const update = useCallback(async (id: string, partial: Partial<Pick<Habit, 'title' | 'color' | 'icon' | 'reminderTime'>>) => {
    const next = habits.map(h => h.id === id ? { ...h, ...partial } : h);
    setHabits(next);
    await saveHabits(next);
    const updated = next.find(h => h.id === id);
    if (updated) applyReminder(updated);
  }, [habits]);

  const getStreak = useCallback((habitId: string): number => {
    let streak = 0;
    const todayDone = (completions[today] ?? []).includes(habitId);
    const start = todayDone ? 0 : -1;
    for (let i = start; i >= -29; i--) {
      const d = offsetDate(today, i);
      if ((completions[d] ?? []).includes(habitId)) {
        streak++;
      } else {
        break;
      }
    }
    return streak;
  }, [completions, today]);

  const getLast7 = useCallback((habitId: string): boolean[] => {
    return Array.from({ length: 7 }, (_, i) => {
      const d = offsetDate(today, -(6 - i));
      return (completions[d] ?? []).includes(habitId);
    });
  }, [completions, today]);

  const getLast30 = useCallback((habitId: string): boolean[] => {
    return Array.from({ length: 30 }, (_, i) => {
      const d = offsetDate(today, -(29 - i));
      return (completions[d] ?? []).includes(habitId);
    });
  }, [completions, today]);

  const todayDone = completions[today] ?? [];

  return { habits, todayDone, completions, isLoading, toggle, add, remove, update, getStreak, getLast7, getLast30, reload: load };
}
