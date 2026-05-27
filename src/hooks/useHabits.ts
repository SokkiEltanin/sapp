import { useState, useEffect, useCallback, useMemo } from 'react';
import { Habit } from '@/types';
import { getHabits, saveHabits, getCounts, setCounts } from '@/utils/habits';
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
  const d = new Date(from + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return dateStr(d);
}

function goalFor(habit: Habit): number {
  if (!habit.type || habit.type === 'check') return 1;
  return habit.dailyGoal ?? 1;
}

function isDone(habit: Habit, count: number): boolean {
  return count >= goalFor(habit);
}

export function useHabits() {
  const [habits, setHabits]       = useState<Habit[]>([]);
  const [completions, setComp]    = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);

  const today = todayStr();

  const load = useCallback(async () => {
    try {
      setIsLoading(true);
      const list  = await getHabits();
      const dates = Array.from({ length: 30 }, (_, i) => offsetDate(today, -i));
      const cols  = await Promise.all(dates.map((d) => getCounts(d)));
      const map: Record<string, Record<string, number>> = {};
      dates.forEach((d, i) => { map[d] = cols[i]; });
      setHabits(list);
      setComp(map);
    } finally {
      setIsLoading(false);
    }
  }, [today]);

  useEffect(() => { load(); }, []);

  // Toggle for check-type habits
  const toggle = useCallback(async (habitId: string) => {
    const counts = completions[today] ?? {};
    const current = counts[habitId] ?? 0;
    const next = current >= 1 ? 0 : 1;
    const nextCounts = { ...counts, [habitId]: next };
    setComp((prev) => ({ ...prev, [today]: nextCounts }));
    await setCounts(today, nextCounts);
  }, [completions, today]);

  // +1 for count-type habits
  const increment = useCallback(async (habitId: string) => {
    const counts  = completions[today] ?? {};
    const current = counts[habitId] ?? 0;
    const habit   = habits.find((h) => h.id === habitId);
    const goal    = goalFor(habit!);
    const next    = current + 1;
    const nextCounts = { ...counts, [habitId]: next };
    setComp((prev) => ({ ...prev, [today]: nextCounts }));
    await setCounts(today, nextCounts);
  }, [completions, today, habits]);

  // -1 for count-type habits (min 0)
  const decrement = useCallback(async (habitId: string) => {
    const counts  = completions[today] ?? {};
    const current = counts[habitId] ?? 0;
    if (current <= 0) return;
    const nextCounts = { ...counts, [habitId]: current - 1 };
    setComp((prev) => ({ ...prev, [today]: nextCounts }));
    await setCounts(today, nextCounts);
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
    const next = habits.filter((h) => h.id !== id);
    setHabits(next);
    await saveHabits(next);
  }, [habits]);

  const update = useCallback(async (id: string, partial: Partial<Omit<Habit, 'id' | 'createdAt'>>) => {
    const next = habits.map((h) => (h.id === id ? { ...h, ...partial } : h));
    setHabits(next);
    await saveHabits(next);
    const updated = next.find((h) => h.id === id);
    if (updated) applyReminder(updated);
  }, [habits]);

  const getStreak = useCallback((habitId: string): number => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return 0;
    const target = habit.weeklyTarget && habit.weeklyTarget < 7 ? habit.weeklyTarget : null;

    if (!target) {
      // Daily streak: consecutive days done
      const todayCount = completions[today]?.[habitId] ?? 0;
      let streak = 0;
      const start = isDone(habit, todayCount) ? 0 : -1;
      for (let i = start; i >= -29; i--) {
        const d = offsetDate(today, i);
        const c = completions[d]?.[habitId] ?? 0;
        if (isDone(habit, c)) streak++; else break;
      }
      return streak;
    }

    // Weekly streak: consecutive 7-day windows meeting the target
    let streak = 0;
    for (let w = 0; w <= 3; w++) {
      const windowDone = Array.from({ length: 7 }, (_, i) => {
        const d = offsetDate(today, -(w * 7) - i);
        return isDone(habit, completions[d]?.[habitId] ?? 0);
      }).filter(Boolean).length;
      if (windowDone >= target) streak++;
      else break;
    }
    return streak;
  }, [completions, today, habits]);

  const getLast7 = useCallback((habitId: string): boolean[] => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return Array(7).fill(false);
    return Array.from({ length: 7 }, (_, i) => {
      const d = offsetDate(today, -(6 - i));
      return isDone(habit, completions[d]?.[habitId] ?? 0);
    });
  }, [completions, today, habits]);

  const getLast30 = useCallback((habitId: string): boolean[] => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return Array(30).fill(false);
    return Array.from({ length: 30 }, (_, i) => {
      const d = offsetDate(today, -(29 - i));
      return isDone(habit, completions[d]?.[habitId] ?? 0);
    });
  }, [completions, today, habits]);

  const getTodayCount = useCallback((habitId: string): number => {
    return completions[today]?.[habitId] ?? 0;
  }, [completions, today]);

  const todayDone = useMemo(() => {
    const counts = completions[today] ?? {};
    return habits
      .filter((h) => {
        // For weekly-target habits, done if target met in rolling 7-day window
        if (h.weeklyTarget && h.weeklyTarget < 7) {
          const weekDone = Array.from({ length: 7 }, (_, i) => {
            const d = offsetDate(today, -i);
            return isDone(h, completions[d]?.[h.id] ?? 0);
          }).filter(Boolean).length;
          return weekDone >= h.weeklyTarget;
        }
        return isDone(h, counts[h.id] ?? 0);
      })
      .map((h) => h.id);
  }, [habits, completions, today]);

  return {
    habits, todayDone, completions, isLoading,
    toggle, increment, decrement,
    add, remove, update,
    getStreak, getLast7, getLast30, getTodayCount,
    reload: load,
  };
}
