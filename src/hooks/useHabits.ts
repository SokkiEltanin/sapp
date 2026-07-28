import { useState, useEffect, useCallback, useMemo } from 'react';
import { Habit } from '@/types';
import { getHabits, saveHabits, getCounts, setCounts, stepFor } from '@/utils/habits';
import { useHabitsSync } from '@/store/habitsSync';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
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

// Which habits count as done on `date` — the single rule behind todayDone (weekly-target
// habits count when the rolling 7-day target is met). Exported so other screens can
// reconstruct a PAST day with identical semantics, e.g. the pet's missed-reward catch-up.
export function habitsDoneOn(
  habits: Habit[],
  completions: Record<string, Record<string, number>>,
  date: string,
): string[] {
  return habits
    .filter((h) => {
      if (h.weeklyTarget && h.weeklyTarget < 7) {
        const weekDone = Array.from({ length: 7 }, (_, i) =>
          isDone(h, completions[offsetDate(date, -i)]?.[h.id] ?? 0)).filter(Boolean).length;
        return weekDone >= h.weeklyTarget;
      }
      return isDone(h, completions[date]?.[h.id] ?? 0);
    })
    .map((h) => h.id);
}

export function useHabits() {
  const [habits, setHabits]       = useState<Habit[]>([]);
  const [completions, setComp]    = useState<Record<string, Record<string, number>>>({});
  const [isLoading, setIsLoading] = useState(true);

  const today = todayStr();
  const syncVersion = useHabitsSync((s) => s.version);
  const bump = useHabitsSync((s) => s.bump);

  // Zamrożenia serii — dzień zamrożony liczy się jako zaliczony.
  const frozen      = useStreakFreezeStore((s) => s.frozen);
  const freezes     = useStreakFreezeStore((s) => s.freezes);
  const applyFreeze = useStreakFreezeStore((s) => s.applyFreeze);
  const isDoneOrFrozen = useCallback(
    (habit: Habit, date: string) =>
      isDone(habit, completions[date]?.[habit.id] ?? 0) || !!frozen[`${habit.id}|${date}`],
    [completions, frozen],
  );

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

  // Another instance mutated → re-read the list + today's counts (cheap) so a
  // deleted habit disappears everywhere, not just on the screen that deleted it.
  useEffect(() => {
    if (syncVersion === 0) return;
    (async () => {
      const [list, tc] = await Promise.all([getHabits(), getCounts(today)]);
      setHabits(list);
      setComp((prev) => ({ ...prev, [today]: tc }));
    })();
  }, [syncVersion, today]);

  // Toggle for check-type habits
  const toggle = useCallback(async (habitId: string) => {
    const counts = completions[today] ?? {};
    const current = counts[habitId] ?? 0;
    const next = current >= 1 ? 0 : 1;
    const nextCounts = { ...counts, [habitId]: next };
    setComp((prev) => ({ ...prev, [today]: nextCounts }));
    await setCounts(today, nextCounts);
    bump();
  }, [completions, today]);

  // +step for count-type habits (a glass = 250 ml for water, else 1)
  const increment = useCallback(async (habitId: string) => {
    const counts  = completions[today] ?? {};
    const current = counts[habitId] ?? 0;
    const habit   = habits.find((h) => h.id === habitId);
    const next    = current + (habit ? stepFor(habit) : 1);
    const nextCounts = { ...counts, [habitId]: next };
    setComp((prev) => ({ ...prev, [today]: nextCounts }));
    await setCounts(today, nextCounts);
    bump();
  }, [completions, today, habits]);

  // -step for count-type habits (min 0)
  const decrement = useCallback(async (habitId: string) => {
    const counts  = completions[today] ?? {};
    const current = counts[habitId] ?? 0;
    if (current <= 0) return;
    const habit   = habits.find((h) => h.id === habitId);
    const nextCounts = { ...counts, [habitId]: Math.max(0, current - (habit ? stepFor(habit) : 1)) };
    setComp((prev) => ({ ...prev, [today]: nextCounts }));
    await setCounts(today, nextCounts);
    bump();
  }, [completions, today, habits]);

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
    bump();
    return newHabit;
  }, [habits]);

  const remove = useCallback(async (id: string) => {
    notificationsService.cancelHabitReminder(id).catch(() => {});
    const next = habits.filter((h) => h.id !== id);
    setHabits(next);
    await saveHabits(next);
    bump();
  }, [habits]);

  const update = useCallback(async (id: string, partial: Partial<Omit<Habit, 'id' | 'createdAt'>>) => {
    const next = habits.map((h) => (h.id === id ? { ...h, ...partial } : h));
    setHabits(next);
    await saveHabits(next);
    const updated = next.find((h) => h.id === id);
    if (updated) applyReminder(updated);
    bump();
  }, [habits]);

  const getStreak = useCallback((habitId: string): number => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return 0;
    const target = habit.weeklyTarget && habit.weeklyTarget < 7 ? habit.weeklyTarget : null;

    if (!target) {
      // Daily streak: consecutive done-OR-FROZEN days (zamrożenie ratuje pominięty dzień)
      let streak = 0;
      const start = isDoneOrFrozen(habit, today) ? 0 : -1;
      for (let i = start; i >= -29; i--) {
        const d = offsetDate(today, i);
        if (isDoneOrFrozen(habit, d)) streak++; else break;
      }
      return streak;
    }

    // Weekly streak: consecutive 7-day windows meeting the target
    let streak = 0;
    for (let w = 0; w <= 3; w++) {
      const windowDone = Array.from({ length: 7 }, (_, i) =>
        isDoneOrFrozen(habit, offsetDate(today, -(w * 7) - i))).filter(Boolean).length;
      if (windowDone >= target) streak++;
      else break;
    }
    return streak;
  }, [isDoneOrFrozen, today, habits]);

  const getLast7 = useCallback((habitId: string): boolean[] => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return Array(7).fill(false);
    return Array.from({ length: 7 }, (_, i) => isDoneOrFrozen(habit, offsetDate(today, -(6 - i))));
  }, [isDoneOrFrozen, today, habits]);

  const getLast30 = useCallback((habitId: string): boolean[] => {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return Array(30).fill(false);
    return Array.from({ length: 30 }, (_, i) => isDoneOrFrozen(habit, offsetDate(today, -(29 - i))));
  }, [isDoneOrFrozen, today, habits]);

  // AUTO-ZAMROŻENIE: gdy „wczoraj" wypadło z serii, a dziś jeszcze nie zaliczone i była
  // realna seria (≥2 dni przed luką) — zużyj jedno zamrożenie na wczoraj, żeby seria nie
  // padła. Chroni TYLKO wczoraj (nie wskrzesza starych serii), 1 zamrożenie na nawyk.
  useEffect(() => {
    if (isLoading || freezes <= 0) return;
    for (const h of habits) {
      if (h.weeklyTarget && h.weeklyTarget < 7) continue;   // tylko serie dzienne
      if (isDoneOrFrozen(h, today)) continue;               // dziś ok → seria bezpieczna
      const yest = offsetDate(today, -1);
      if (isDoneOrFrozen(h, yest)) continue;                // wczoraj kotwiczy → jeszcze żyje
      const anchor = offsetDate(today, -2);
      if (!isDoneOrFrozen(h, anchor)) continue;             // brak serii do uratowania
      let len = 0;
      for (let i = -2; i >= -30; i--) { if (isDoneOrFrozen(h, offsetDate(today, i))) len++; else break; }
      if (len >= 2) applyFreeze(h.id, yest);                // zużyj 1 zamrożenie na wczoraj
    }
  }, [isLoading, freezes, frozen, completions, habits, today, isDoneOrFrozen, applyFreeze]);

  const getTodayCount = useCallback((habitId: string): number => {
    return completions[today]?.[habitId] ?? 0;
  }, [completions, today]);

  const todayDone = useMemo(() => habitsDoneOn(habits, completions, today), [habits, completions, today]);

  return {
    habits, todayDone, completions, isLoading,
    toggle, increment, decrement,
    add, remove, update,
    getStreak, getLast7, getLast30, getTodayCount,
    reload: load,
  };
}
