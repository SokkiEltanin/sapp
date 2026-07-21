import { useState, useRef, useEffect, useCallback } from 'react';
import { useFocusEffect } from 'expo-router';
import { Habit } from '@/types';
import { getWaterHabit, getCounts, setCounts, getHabits, saveHabits } from '@/utils/habits';
import { getHealthGoals } from '@/utils/healthGoals';
import { useHabitsSync } from '@/store/habitsSync';
import { haptic } from '@/utils/haptics';

// Water tracking as a REUSABLE hook — the single source of truth is the "Woda"
// habit's per-day count (`habits_cnt_YYYY-MM-DD`), exactly like the Zdrowie screen.
// Any screen using this hook stays in sync with Nawyki / dashboard / pet / Health
// Connect, because they all read the same counts and the `habitsSync` version bus
// makes everyone reload on a change. Writes are debounced (350 ms) off a ref so a
// burst of taps is ONE storage write (that per-tap churn was the old lag).

const pad = (n: number) => String(n).padStart(2, '0');
const todayDate = () => { const d = new Date(); return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; };

export function useWaterTracker() {
  const [glasses, setGlasses] = useState(0);
  const [goal, setGoal]       = useState(8);
  const ref      = useRef(0);
  const habitId  = useRef<string | null>(null);
  const timer    = useRef<ReturnType<typeof setTimeout> | null>(null);
  const version  = useHabitsSync(s => s.version);
  const bump     = useHabitsSync(s => s.bump);

  const load = useCallback(async () => {
    const w = await getWaterHabit();
    habitId.current = w?.id ?? null;
    const goals = await getHealthGoals();
    setGoal(w?.dailyGoal && w.dailyGoal > 0 ? w.dailyGoal : goals.waterGoal);
    if (timer.current) return;   // a debounced write is pending → don't clobber the optimistic count
    if (w) {
      const counts = await getCounts(todayDate());
      const n = Math.max(0, counts[w.id] ?? 0);
      ref.current = n; setGlasses(n);
    } else { ref.current = 0; setGlasses(0); }
  }, []);

  useFocusEffect(useCallback(() => { load(); }, [load]));
  useEffect(() => { if (version > 0) load(); }, [version, load]);
  useEffect(() => () => { if (timer.current) clearTimeout(timer.current); }, []);

  // First tap with no water habit yet → create the "Woda" preset (never a dead end).
  const ensure = async (): Promise<string | null> => {
    const existing = await getWaterHabit();
    if (existing) { habitId.current = existing.id; return existing.id; }
    const habit: Habit = {
      id: Date.now().toString(), title: 'Woda', color: '#60A5FA', icon: 'droplets',
      type: 'count', kind: 'water', dailyGoal: goal || 8, unit: 'szkl.', createdAt: new Date().toISOString(),
    };
    await saveHabits([...(await getHabits()), habit]);
    habitId.current = habit.id;
    return habit.id;
  };

  const persist = async () => {
    const id = habitId.current ?? await ensure();
    if (!id) return;
    const date = todayDate();
    const counts = await getCounts(date);
    counts[id] = ref.current;
    await setCounts(date, counts);
    bump();   // notify Nawyki / dashboard / pet
  };

  const change = useCallback((delta: number) => {
    const next = Math.max(0, ref.current + delta);
    if (next === ref.current) return;
    ref.current = next; setGlasses(next);
    if (next === goal && delta > 0) haptic.success(); else haptic.medium();
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { persist().catch(() => {}); }, 350);
  }, [goal]);

  return { glasses, goal, change };
}
