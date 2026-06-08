import { useMemo, useRef, useEffect, useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, Animated } from 'react-native';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useWorkStore } from '@/store/workStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useMoodStore } from '@/store/moodStore';
import { useHabits } from '@/hooks/useHabits';
import { useWorkEarnings } from '@/hooks/useWorkEarnings';
import { getBudgets, MonthlyBudgets } from '@/utils/budgets';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { colors } from '@/theme';
import { haptic } from '@/utils/haptics';

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

function todayIso() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function tomorrowIso() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function weekEndIso() {
  const d = new Date(); d.setDate(d.getDate() + 7);
  return `${d.getFullYear()}-${pad(d.getMonth()+1)}-${pad(d.getDate())}`;
}
function fmtTimer(secs: number) {
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return `${pad(m)}:${pad(s)}`;
}
function daysUntil(iso: string, today: string) {
  const ms = new Date(iso + 'T00:00:00').getTime() - new Date(today + 'T00:00:00').getTime();
  return Math.round(ms / 86_400_000);
}

// Safe uppercase — Google Calendar events can have an empty/undefined title,
// and `undefined.toUpperCase()` would throw and crash the whole pill.
function up(s: string | undefined | null): string {
  return (s ?? '').toUpperCase();
}

// ─── Pill data type ───────────────────────────────────────────────────────────

interface PillItem {
  badge: string;
  color: string;
  text: string;
  route: string;
  key: string; // for animation change detection
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TopPill() {
  const today    = todayIso();
  const tomorrow = tomorrowIso();
  const weekEnd  = weekEndIso();
  const hour     = new Date().getHours();
  const { color: timeAccent } = useTimeAccent(); // cyan by day, blue by night

  // ── Store selectors ────────────────────────────────────────────────────────
  const pomRunning   = usePomodoroStore(s => s.isRunning);
  const pomMode      = usePomodoroStore(s => s.mode);
  const pomRemaining = usePomodoroStore(s => s.remaining);
  const pomTitle     = usePomodoroStore(s => s.taskTitle);

  const calTasks   = useCalendarStore(s => s.tasks);
  const gcalEvents = useCalendarStore(s => s.gcalEvents);

  const shifts        = useWorkStore(s => s.shifts);
  const workSettings  = useWorkStore(s => s.settings);
  const workPrefix    = workSettings.workPrefix ?? '';

  const events     = useCalendarStore(s => s.events);
  const expenses   = useExpensesStore(s => s.expenses);

  // Live earnings — ticks each second while a work shift is in progress.
  const allEvents    = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);
  const workEarnings = useWorkEarnings(shifts, allEvents, workSettings, expenses);

  const { habits, todayDone } = useHabits();
  const todayMoodEntry = useMoodStore(s => s.todayEntry);

  const [budgets, setBudgets] = useState<MonthlyBudgets>({});
  useEffect(() => { getBudgets().then(setBudgets).catch(() => {}); }, []);

  // ── Priority logic ─────────────────────────────────────────────────────────
  const item: PillItem | null = useMemo(() => {
   try {

    // 1 — Pomodoro running (work session)
    if (pomRunning && pomMode === 'work') {
      return {
        badge:  fmtTimer(pomRemaining),
        color:  colors.tabs.tasks,      // #2EDEA0 green
        text:   (pomTitle ?? 'POMODORO').toUpperCase(),
        route:  '/pomodoro',
        key:    `pom-${pomRemaining}`,
      };
    }

    // 2 — Live earnings (currently in a work shift) — ticks every second
    if (workEarnings.isWorking) {
      return {
        badge: `${workEarnings.totalEarned.toFixed(2)} zł`,
        color: '#2AC68F',
        text:  (workEarnings.activeEventTitle ? workEarnings.activeEventTitle.toUpperCase() : 'JESTEŚ W PRACY'),
        route: '/settings',
        key:   `earn-${Math.floor(workEarnings.totalEarned)}`,
      };
    }

    // 3 — Work shift TODAY
    const todayShift = shifts.find(sh => sh.date === today);
    if (todayShift) {
      const pre = workPrefix ? `${workPrefix} ` : '';
      return {
        badge: 'DZISIAJ',
        color:  '#2BC8E0',             // cyan
        text:  `${pre}MASZ ZMIANĘ NA ${todayShift.startTime}`,
        route: '/(tabs)/stats',
        key:   `shift-today`,
      };
    }

    // 3 — Work shift TOMORROW
    const tomShift = shifts.find(sh => sh.date === tomorrow);
    if (tomShift) {
      const pre = workPrefix ? `${workPrefix} ` : '';
      return {
        badge: 'JUTRO',
        color:  colors.accent.blue,    // #5166F5
        text:  `${pre}MASZ ZMIANĘ NA ${tomShift.startTime}`,
        route: '/(tabs)/stats',
        key:   `shift-tom`,
      };
    }

    // 4 — Overdue tasks (status pending + deadline < today)
    const overdue = calTasks.filter(t =>
      t.status === 'pending' &&
      t.deadline &&
      t.deadline.split('T')[0] < today
    );
    if (overdue.length > 0) {
      const first = overdue.sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0];
      return {
        badge: `${overdue.length} ZALEGŁE`,
        color:  colors.tabs.finances,  // #E63535 red
        text:   up(first.title),
        route:  '/(tabs)/tasks',
        key:    `overdue-${overdue.length}`,
      };
    }

    // 4b — Tasks due / scheduled TODAY (deadline today OR scheduledDate today).
    // These fall between "overdue (<today)" and "near deadline (>today)", so
    // without this the pill would vanish on a day full of today-tasks.
    const todayTasks = calTasks.filter(t =>
      t.status !== 'done' &&
      ((t.deadline && t.deadline.split('T')[0] === today) || t.scheduledDate === today)
    );
    if (todayTasks.length > 0) {
      const first = todayTasks[0];
      return {
        badge: todayTasks.length > 1 ? `${todayTasks.length} DZIŚ` : 'DZIŚ',
        color:  timeAccent,
        text:   up(first.title),
        route:  '/(tabs)/tasks',
        key:    `today-${todayTasks.length}`,
      };
    }

    // 5 — Budget ≥85% of monthly limit
    const monthlySpend: Record<string, number> = {};
    for (const e of expenses) {
      if (e.type && e.type !== 'expense') continue;
      if (e.date.slice(0, 7) !== today.slice(0, 7)) continue;
      monthlySpend[e.category] = (monthlySpend[e.category] ?? 0) + e.amount;
    }
    const budgetAlerts = Object.entries(budgets)
      .map(([cat, limit]) => ({ cat, spend: monthlySpend[cat] ?? 0, limit: limit!, pct: (monthlySpend[cat] ?? 0) / limit! }))
      .filter(a => a.pct >= 0.85)
      .sort((a, b) => b.pct - a.pct);
    if (budgetAlerts.length > 0) {
      const first = budgetAlerts[0];
      return {
        badge: `${Math.round(first.spend)} PLN`,
        color:  colors.tabs.finances,  // #E43434 red
        text:  `ZBLIŻASZ SIĘ DO LIMITU #${first.cat}`,
        route: '/(tabs)/finances',
        key:   `budget-${first.cat}`,
      };
    }

    // 6 — Google Calendar event today (first upcoming by startTime)
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    const gcalToday = gcalEvents
      .filter(e => e.date === today)
      .filter(e => {
        if (!e.startTime) return false;
        const [h, m] = e.startTime.split(':').map(Number);
        return h * 60 + m >= nowMins; // not started yet OR in progress
      })
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
    if (gcalToday.length > 0) {
      const ev = gcalToday[0];
      const [h, m] = ev.startTime!.split(':').map(Number);
      const diffM = h * 60 + m - nowMins;
      const timeLabel = diffM <= 0 ? 'TERAZ' : diffM < 60 ? `ZA ${diffM} MIN` : ev.startTime!;
      return {
        badge: timeLabel,
        color:  '#2BC8E0',
        text:   up(ev.title) || 'WYDARZENIE',
        route:  '/(tabs)/stats',
        key:    `gcal-${ev.id}`,
      };
    }

    // 7 — Nearest task deadline within 7 days (countdown)
    const nearDeadline = calTasks
      .filter(t =>
        t.status !== 'done' &&
        t.deadline &&
        t.deadline.split('T')[0] > today &&
        t.deadline.split('T')[0] <= weekEnd
      )
      .sort((a, b) => a.deadline!.localeCompare(b.deadline!))[0];
    if (nearDeadline) {
      const days = daysUntil(nearDeadline.deadline!.split('T')[0], today);
      const label = days === 1 ? 'JUTRO' : `${days} DNI`;
      return {
        badge:  label,
        color:  colors.tabs.calendar,  // #3A4C9C indigo
        text:   `DO KOŃCA: ${up(nearDeadline.title)}`,
        route:  '/(tabs)/tasks',
        key:    `deadline-${nearDeadline.id}`,
      };
    }

    // 8 — Habit streak at risk (after 17:00, any habit not done today)
    if (hour >= 17) {
      const undone = habits.filter(h => !todayDone.includes(h.id));
      if (undone.length > 0) {
        const first = undone[0];
        return {
          badge: 'SERIA!',
          color:  '#F59E0B',             // amber
          text:   `${up(first.title)} NIE ZAZNACZONY`,
          route:  '/habits',
          key:    `habit-${first.id}`,
        };
      }
    }

    // 9 — No mood entry today (after 18:00)
    if (hour >= 18 && !todayMoodEntry) {
      return {
        badge: 'NASTRÓJ',
        color:  '#F472B6',             // pink
        text:   'JAK SIĘ CZUJESZ DZISIAJ?',
        route:  '/(tabs)/mood',
        key:    'mood-missing',
      };
    }

    // 10 — Fallback: nothing pressing → a calm positive state so the lifebar
    // never just disappears. Shows pending count, or an "all clear" message.
    const pending = calTasks.filter(t => t.status !== 'done').length;
    if (pending > 0) {
      return {
        badge: `${pending}`,
        color:  timeAccent,
        text:   pending === 1 ? 'JEDNO ZADANIE W TOKU' : 'ZADAŃ W TOKU',
        route:  '/(tabs)/tasks',
        key:    `pending-${pending}`,
      };
    }
    return {
      badge: 'LUZ',
      color:  colors.tabs.tasks,       // green
      text:   'WSZYSTKO OGARNIĘTE',
      route:  '/(tabs)/tasks',
      key:    'all-clear',
    };
   } catch {
    // Never let the pill crash — bad data just hides it this render
    return null;
   }
  }, [
    pomRunning, pomMode, pomRemaining, pomTitle,
    workEarnings.isWorking, workEarnings.totalEarned, workEarnings.activeEventTitle,
    shifts, workPrefix,
    calTasks,
    gcalEvents,
    expenses, budgets,
    habits, todayDone,
    todayMoodEntry,
    today, tomorrow, weekEnd, hour, timeAccent,
  ]);

  // ── Fade animation on content change ──────────────────────────────────────
  const opacity  = useRef(new Animated.Value(item ? 1 : 0)).current;
  const prevKey  = useRef<string | null>(item?.key ?? null);

  useEffect(() => {
    if (!item) {
      Animated.timing(opacity, { toValue: 0, duration: 180, useNativeDriver: true }).start();
      return;
    }
    if (prevKey.current !== item.key) {
      // Cross-fade: out → in
      Animated.sequence([
        Animated.timing(opacity, { toValue: 0, duration: 120, useNativeDriver: true }),
        Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      ]).start();
    } else {
      Animated.timing(opacity, { toValue: 1, duration: 200, useNativeDriver: true }).start();
    }
    prevKey.current = item.key;
  }, [item?.key]);

  if (!item) return null;

  return (
    <Animated.View style={{ opacity }}>
      <LinearGradient
        colors={[item.color + 'EE', item.color + '30', item.color + '00']}
        start={{ x: 0, y: 0.5 }}
        end={{ x: 1, y: 0.5 }}
        style={s.pillGradient}
      >
        <TouchableOpacity
          style={s.pill}
          onPress={() => { haptic.tap(); router.push(item.route as any); }}
          activeOpacity={0.75}
        >
          <View style={[s.badge, { backgroundColor: item.color }]}>
            <Text style={s.badgeText} numberOfLines={1}>{item.badge}</Text>
          </View>
          <Text style={s.text} numberOfLines={1}>{item.text}</Text>
        </TouchableOpacity>
      </LinearGradient>
    </Animated.View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  pillGradient: {
    marginHorizontal: 16,
    marginTop: 6,
    marginBottom: 4,
    borderRadius: 999,
    padding: 1.5,
    // Shadow so the pill visibly floats above the page (no solid band behind).
    elevation: 10,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.45,
    shadowRadius: 12,
  },
  pill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(14,16,20,0.92)',
    borderRadius: 999,
    paddingHorizontal: 6,
    paddingVertical: 5,
    gap: 8,
  },
  badge: {
    borderRadius: 999,
    paddingHorizontal: 10,
    paddingVertical: 5,
    minWidth: 58,
    alignItems: 'center',
    justifyContent: 'center',
  },
  badgeText: {
    fontSize: 11,
    fontWeight: '800',
    color: colors.white,
    letterSpacing: 0.4,
  },
  text: {
    flex: 1,
    fontSize: 12,
    fontWeight: '500',
    color: colors.white,
    letterSpacing: 0.2,
  },
});
