import { useMemo, useEffect, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, Animated, Modal, Pressable, TextInput, KeyboardAvoidingView, Platform } from 'react-native';

import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  CheckCircle2, Circle, ChevronRight,
  TrendingUp, TrendingDown, Timer, Flame,
  Smile, Zap, ArrowUpRight, CalendarDays, Settings, Search,
  Droplets, Dumbbell, BookOpen, Moon, Heart, Sun, Bike,
  Footprints, NotebookPen, BrainCircuit, Plus, ScanLine, Cookie,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import MoodCheckInModal from '@/components/mood/MoodCheckInModal';
import { useExpenses } from '@/hooks/useExpenses';
import { useTasks } from '@/hooks/useTasks';
import { useMoodCheckIn } from '@/hooks/useMoodCheckIn';
import { useHabits } from '@/hooks/useHabits';
import { usePomodoroToday } from '@/hooks/usePomodoroToday';
import { useMoodStore } from '@/store/moodStore';
import { useCalendarStore } from '@/store/calendarStore';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { toast } from '@/store/toastStore';
import { Task, MOOD_LABELS, MOOD_COLORS, Habit, ExpenseCategory } from '@/types';
import { expensesService } from '@/services/expensesService';
import { useExpensesStore } from '@/store/expensesStore';
import { CATEGORY_META } from '@/utils/categories';
import { colors, spacing, radius, typography } from '@/theme';
import { useTabSwipe } from '@/hooks/useTabSwipe';

// ─── Habit icon (inline, no dynamic import) ───────────────────────────────────

const HABIT_ICON_MAP: Record<string, React.ComponentType<any>> = {
  droplets: Droplets, dumbbell: Dumbbell, 'book-open': BookOpen,
  moon: Moon, zap: Zap, heart: Heart, sun: Sun, bike: Bike,
};
function HabitIconSmall({ name, size, color }: { name: string; size: number; color: string }) {
  const Icon = HABIT_ICON_MAP[name] ?? Zap;
  return <Icon size={size} color={color} />;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function greeting() {
  const h = new Date().getHours();
  if (h < 6)  return 'Dobranoc';
  if (h < 12) return 'Dzień dobry';
  if (h < 18) return 'Cześć';
  return 'Dobry wieczór';
}
function plTasks(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'zadanie';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'zadania';
  return 'zadań';
}

// ─── Humor line based on mood ─────────────────────────────────────────────────

const HUMOR: Record<number, string[]> = {
  1: ['Dzień jak z horroru. Przeżyłeś. Na razie.', 'Gorzej nie będzie. Chyba.', 'Przetrwanie to też sukces.'],
  2: ['Słabo. Ale przynajmniej żyjesz.', 'Nie jest świetnie. Jest. To wystarczy.', 'Niskie obroty, rozumiem.'],
  3: ['Tak sobie. Normalna energia.', 'Middle ground — ani super ani kiepsko.', 'Standard. Nic specjalnego.'],
  4: ['Całkiem nieźle! Nie psuj tego.', 'Dobry nastrój? Wykorzystaj go.', 'Rzadki widok. Doceniam.'],
  5: ['SZCZYT MOŻLIWOŚCI. Serio co zrobiłeś?', '5/5 — dziś możesz wszystko. Naprawdę.', 'Energia max. Pisz to sprawozdanie.'],
};
function humorLine(mood?: number, pending = 0, done = 0): string {
  if (mood === undefined) {
    if (done > 0) return `${done} ukończone dziś. Jak się czujesz?`;
    if (pending > 0) return `Masz ${pending} zadań. I jeszcze nie wiesz jak się czujesz.`;
    return 'Czysty start. Nastrój nieznany. Typowe.';
  }
  const opts = HUMOR[mood] ?? HUMOR[3];
  return opts[(new Date().getDate()) % opts.length];
}

// ─── Card base ────────────────────────────────────────────────────────────────

function Card({ children, style, onPress, accentColor }: {
  children: React.ReactNode;
  style?: any;
  onPress?: () => void;
  accentColor?: string;
}) {
  const inner = (
    <View style={[card.base, accentColor && { borderLeftWidth: 3, borderLeftColor: accentColor }, style]}>
      {children}
    </View>
  );
  if (onPress) return <PressableScale onPress={onPress}>{inner}</PressableScale>;
  return inner;
}
const card = StyleSheet.create({
  base: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
  },
});

// ─── Mini task item ───────────────────────────────────────────────────────────

function TaskItem({ task, onToggle, onPomodoro }: {
  task: Task;
  onToggle: (id: string) => void;
  onPomodoro: (task: Task) => void;
}) {
  const done    = task.status === 'done';
  const urgent  = task.priority === 'high' && !done;
  const overdue = !done && (task.deadline?.split('T')[0] ?? '') < todayStr();
  const dl      = task.deadline ? task.deadline.slice(5, 10).replace('-', '.') : null;

  return (
    <TouchableOpacity
      style={[ti.row, done && ti.rowDone]}
      onPress={() => router.push(`/tasks/${task.id}` as any)}
      activeOpacity={0.75}
    >
      <TouchableOpacity
        style={[ti.check, done && ti.checkDone]}
        onPress={() => onToggle(task.id)}
        hitSlop={8}
        activeOpacity={0.75}
      >
        {done
          ? <CheckCircle2 size={18} color={colors.accent.green} />
          : <Circle size={18} color={urgent ? colors.accent.red : 'rgba(255,255,255,0.2)'} />
        }
      </TouchableOpacity>
      <View style={ti.info}>
        <Text style={[ti.title, done && ti.titleDone]} numberOfLines={1}>{task.title}</Text>
        {(dl || task.tags?.length > 0) && (
          <View style={ti.meta}>
            {dl && (
              <Text style={[ti.dl, overdue && { color: colors.accent.red }]}>{overdue ? 'po terminie' : dl}</Text>
            )}
            {task.tags?.slice(0, 2).map(t => (
              <Text key={t} style={ti.tag}>#{t}</Text>
            ))}
          </View>
        )}
      </View>
      {urgent && <Flame size={13} color={colors.accent.red} />}
      {!done && task.estimatedPomodoros! > 0 && (
        <TouchableOpacity onPress={() => onPomodoro(task)} style={ti.pomBtn} hitSlop={8}>
          <Timer size={14} color={colors.accent.purple} />
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

const ti = StyleSheet.create({
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  rowDone: { opacity: 0.4 },
  check: { width: 18, height: 18 },
  checkDone: {},
  info: { flex: 1 },
  title: { fontSize: 14, fontWeight: '500', color: colors.text.primary, lineHeight: 19 },
  titleDone: { textDecorationLine: 'line-through', color: colors.text.secondary },
  meta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 3 },
  dl: { fontSize: 11, color: colors.text.secondary },
  tag: { fontSize: 10, color: colors.text.muted },
  pomBtn: { padding: 4 },
});

// ─── Stat tile ────────────────────────────────────────────────────────────────

function StatTile({ value, label, color, sub }: {
  value: string; label: string; color: string; sub?: string;
}) {
  return (
    <View style={[st.tile, { borderColor: color + '28' }]}>
      <View style={[st.dot, { backgroundColor: color }]} />
      <Text style={st.value}>{value}</Text>
      <Text style={st.label}>{label}</Text>
      {sub && <Text style={[st.sub, { color: color }]}>{sub}</Text>}
    </View>
  );
}
const st = StyleSheet.create({
  tile: {
    flex: 1, borderRadius: radius.lg, borderWidth: 1,
    backgroundColor: colors.bg.card,
    padding: spacing[3], gap: 2, minHeight: 72,
  },
  dot: { width: 5, height: 5, borderRadius: 3, marginBottom: 2 },
  value: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5, lineHeight: 26, color: colors.text.primary },
  label: { fontSize: 10, fontWeight: '500', color: colors.text.muted },
  sub: { fontSize: 9, fontWeight: '600', marginTop: 1 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { panHandlers, animatedStyle } = useTabSwipe();

  const { stats, isLoading: finLoading, reload: reloadFin } = useExpenses();
  const { tasks, isLoading: tasksLoading, reload: reloadTasks, toggle } = useTasks();
  const { habits, todayDone: habitsDone, toggle: toggleHabit } = useHabits();
  const pomodoro = usePomodoroToday();
  const { todayEntry, modalVisible, openCheckIn, closeCheckIn } = useMoodCheckIn();
  const { entries: moodEntries } = useMoodStore();
  const { events, setEvents } = useCalendarStore();
  const startPomodoro = usePomodoroStore(s => s.startFor);
  const addExpenseStore = useExpensesStore(s => s.addExpense);
  const allExpenses = useExpensesStore(s => s.expenses);

  const [quickType, setQuickType] = useState<'expense' | 'income'>('expense');
  const [quickVisible, setQuickVisible] = useState(false);
  const [quickAmount, setQuickAmount] = useState('');
  const [quickCat, setQuickCat] = useState<ExpenseCategory>('food');
  const [quickSaving, setQuickSaving] = useState(false);

  // Load calendar events on home mount if not yet loaded
  useEffect(() => {
    if (events.length === 0) {
      import('@/services/calendarService').then(({ calendarService }) => {
        calendarService.getAllEvents().then(setEvents).catch(() => {});
      });
    }
  }, []);

  const today      = todayStr();
  const isLoading  = finLoading || tasksLoading;
  const balance    = stats.monthIncome - stats.monthExpenses;
  const balancePos = balance >= 0;

  const pendingTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'done'), [tasks]);

  const todayTasks = useMemo(() =>
    pendingTasks.filter(t => t.deadline?.startsWith(today) || t.scheduledDate === today),
    [pendingTasks, today]);

  const todayEvents = useMemo(() =>
    events
      .filter(e => e.date === today)
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    [events, today]);

  const { todayPreviewTasks, upcomingPreviewTasks } = useMemo(() => {
    const byPriority = (a: Task, b: Task) => {
      const po: Record<string,number> = { high:0, normal:1, low:2 };
      return (po[a.priority]??1) - (po[b.priority]??1) || (a.deadline??'z').localeCompare(b.deadline??'z');
    };
    const todayOnes = pendingTasks.filter(t => t.deadline?.startsWith(today) || t.scheduledDate === today).sort(byPriority);
    const upcoming  = pendingTasks.filter(t => !t.deadline?.startsWith(today) && t.scheduledDate !== today).sort(byPriority);
    return {
      todayPreviewTasks:    todayOnes.slice(0, 4),
      upcomingPreviewTasks: upcoming.slice(0, Math.max(0, 5 - Math.min(todayOnes.length, 4))),
    };
  }, [pendingTasks, today]);

  const todayDoneCount = useMemo(() =>
    tasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(today)).length,
    [tasks, today]);

  const last7Mood = useMemo(() => {
    const seen = new Set<string>();
    const unique: typeof moodEntries = [];
    for (const e of moodEntries) {
      if (!seen.has(e.date)) { seen.add(e.date); unique.push(e); }
      if (unique.length === 7) break;
    }
    return unique.reverse();
  }, [moodEntries]);

  const handleToggle = (id: string) => {
    const t = tasks.find(x => x.id === id);
    toggle(id);
    if (t?.status !== 'done') toast.success('Zadanie ukończone');
  };

  const handlePomodoro = (task: Task) => {
    startPomodoro(task.id, task.title);
    router.push('/pomodoro' as any);
  };

  const habitsTotal = habits.length;
  const habitsDoneCount = habits.filter(h => habitsDone.includes(h.id)).length;

  const onRefresh = () => { reloadFin(); reloadTasks(); };

  const openQuick = (type: 'expense' | 'income') => {
    setQuickType(type);
    setQuickAmount('');
    setQuickCat('food');
    setQuickVisible(true);
  };

  const handleQuickSave = async () => {
    const parsed = parseFloat(quickAmount.replace(',', '.'));
    if (!parsed || isNaN(parsed) || parsed <= 0) return;
    setQuickSaving(true);
    try {
      const exp = await expensesService.add({
        type: quickType,
        amount: parsed,
        currency: 'PLN',
        category: quickType === 'income' ? 'salary' : quickCat,
        tags: [],
        note: '',
        date: new Date().toISOString(),
      });
      addExpenseStore(exp);
      setQuickVisible(false);
      toast.success(quickType === 'income' ? `+${parsed.toFixed(2)} zł dodane` : `-${parsed.toFixed(2)} zł dodane`);
    } catch {
      toast.error('Błąd zapisu');
    } finally {
      setQuickSaving(false);
    }
  };

  const dateLabel = new Date().toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).replace(/^\w/, c => c.toUpperCase());

  const hasToday = todayTasks.length > 0 || todayEvents.length > 0;

  // Humor line — stable per day (not random per render)
  const humor = useMemo(
    () => humorLine(todayEntry?.mood, pendingTasks.length, todayDoneCount),
    [todayEntry?.mood, pendingTasks.length, todayDoneCount],
  );

  // Today task progress
  const todayTotal    = todayTasks.length + todayDoneCount;
  const todayProgress = todayTotal > 0 ? todayDoneCount / todayTotal : 0;

  // Sweets/snacks spending this month
  const sweetsThisMonth = useMemo(() => {
    const monthStr = new Date().toISOString().slice(0, 7);
    let total = 0;
    for (const e of allExpenses) {
      if (!e.date.startsWith(monthStr)) continue;
      if (e.type === 'income') continue;
      if (e.receiptItems?.length) {
        for (const it of e.receiptItems) {
          if (it.tags.includes('słodycze') || it.category === 'food') total += it.price;
        }
      } else if (e.tags.includes('słodycze') || e.category === 'food') {
        total += e.amount;
      }
    }
    return Math.round(total * 100) / 100;
  }, [allExpenses]);

  return (
    <SafeAreaView style={styles.safe} edges={['top']} {...panHandlers}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.text.muted} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View style={styles.headerTop}>
            <View>
              <Text style={styles.dateText}>{dateLabel}</Text>
              <Text style={styles.greeting}>{greeting()}</Text>
            </View>
            <View style={styles.headerBtns}>
              <PressableScale onPress={() => router.push('/search' as any)} style={styles.settingsBtn}>
                <Search size={18} color={colors.text.muted} />
              </PressableScale>
              <PressableScale onPress={() => router.push('/settings' as any)} style={styles.settingsBtn}>
                <Settings size={18} color={colors.text.muted} />
              </PressableScale>
            </View>
          </View>
          {/* Humor / mood line */}
          <PressableScale onPress={openCheckIn} style={styles.humorRow}>
            {todayEntry
              ? <View style={[styles.moodDot, { backgroundColor: MOOD_COLORS[todayEntry.mood] }]} />
              : <Smile size={13} color={colors.text.muted} />}
            <Text style={styles.humorText} numberOfLines={1}>{humor}</Text>
          </PressableScale>
        </View>

        {/* ── Tasks HERO ── */}
        <Card accentColor={colors.accent.green}>
          {/* Header row */}
          <View style={styles.taskHeroHeader}>
            <View style={styles.taskCountWrap}>
              <Text style={styles.taskCountBig}>{pendingTasks.length}</Text>
              <View>
                <Text style={styles.taskCountLabel}>{plTasks(pendingTasks.length)}</Text>
                {todayTasks.length > 0 && (
                  <Text style={[styles.taskCountSub, { color: colors.accent.green }]}>
                    {todayTasks.length} na dziś
                  </Text>
                )}
              </View>
            </View>
            <View style={{ flex: 1 }} />
            {todayDoneCount > 0 && (
              <View style={styles.doneBadge}>
                <CheckCircle2 size={11} color={colors.accent.green} />
                <Text style={styles.doneBadgeText}>{todayDoneCount} dziś</Text>
              </View>
            )}
            <PressableScale onPress={() => router.push('/(tabs)/tasks' as any)} style={styles.seeAll}>
              <Text style={styles.seeAllText}>Wszystkie</Text>
              <ChevronRight size={12} color={colors.text.muted} />
            </PressableScale>
          </View>

          {/* Progress bar (if tasks today) */}
          {todayTotal > 0 && (
            <View style={styles.progressWrap}>
              <View style={styles.progressTrack}>
                <View style={[styles.progressFill, { width: `${todayProgress * 100}%` }]} />
              </View>
              <Text style={styles.progressLabel}>{todayDoneCount}/{todayTotal} na dziś</Text>
            </View>
          )}

          {/* Task list */}
          {(todayPreviewTasks.length > 0 || upcomingPreviewTasks.length > 0) ? (
            <View>
              {todayPreviewTasks.length > 0 && (
                <>
                  <View style={styles.taskGroupLabel}>
                    <Text style={styles.taskGroupText}>DZIŚ</Text>
                  </View>
                  {todayPreviewTasks.map(t => (
                    <TaskItem key={t.id} task={t} onToggle={handleToggle} onPomodoro={handlePomodoro} />
                  ))}
                </>
              )}
              {upcomingPreviewTasks.length > 0 && (
                <>
                  <View style={[styles.taskGroupLabel, todayPreviewTasks.length > 0 && { marginTop: spacing[2] }]}>
                    <Text style={styles.taskGroupText}>NADCHODZĄCE</Text>
                  </View>
                  {upcomingPreviewTasks.map(t => (
                    <TaskItem key={t.id} task={t} onToggle={handleToggle} onPomodoro={handlePomodoro} />
                  ))}
                </>
              )}
            </View>
          ) : todayDoneCount > 0 ? (
            <View style={styles.tasksEmptyRow}>
              <CheckCircle2 size={16} color={colors.accent.green} />
              <Text style={styles.tasksEmptyText}>
                {todayDoneCount === 1 ? 'Zadanie ukończone.' : `${todayDoneCount} zadań ukończonych dziś.`} Szacun.
              </Text>
            </View>
          ) : (
            <View style={styles.tasksEmptyRow}>
              <CheckCircle2 size={16} color={colors.accent.green} />
              <Text style={styles.tasksEmptyText}>Wszystko gotowe. Serio? Wow.</Text>
            </View>
          )}

          {/* Add task shortcut */}
          <PressableScale onPress={() => router.push('/tasks/add' as any)} style={styles.addTaskRow}>
            <Plus size={13} color={colors.text.muted} />
            <Text style={styles.addTaskText}>Dodaj zadanie</Text>
          </PressableScale>
        </Card>

        {/* ── Compact quick-stats row ── */}
        <View style={styles.quickRow}>
          <PressableScale style={styles.quickTile} onPress={() => router.push('/(tabs)/finances' as any)}>
            <TrendingUp size={12} color={balancePos ? colors.accent.blue : colors.accent.red} />
            <Text style={[styles.quickVal, { color: balancePos ? colors.text.primary : colors.accent.red }]}>
              {balancePos ? '+' : ''}{Math.round(balance)}
            </Text>
            <Text style={styles.quickLabel}>saldo zł</Text>
          </PressableScale>

          <PressableScale style={styles.quickTile} onPress={() => router.push('/(tabs)/tasks' as any)}>
            <CalendarDays size={12} color={todayEvents.length > 0 ? colors.accent.blue : colors.text.muted} />
            <Text style={styles.quickVal}>{todayEvents.length}</Text>
            <Text style={styles.quickLabel}>dziś</Text>
          </PressableScale>

          <PressableScale style={styles.quickTile} onPress={() => router.push('/habits' as any)}>
            <Flame size={12} color={habitsTotal > 0 && habitsDoneCount === habitsTotal ? colors.accent.amber : colors.text.muted} />
            <Text style={styles.quickVal}>{habitsTotal > 0 ? `${habitsDoneCount}/${habitsTotal}` : '—'}</Text>
            <Text style={styles.quickLabel}>nawyki</Text>
          </PressableScale>

          <PressableScale style={styles.quickTile} onPress={() => router.push('/focus' as any)}>
            <BrainCircuit size={12} color={pomodoro.totalMins > 0 ? colors.accent.purple : colors.text.muted} />
            <Text style={styles.quickVal}>
              {pomodoro.totalMins > 0
                ? pomodoro.totalMins >= 60 ? `${Math.floor(pomodoro.totalMins/60)}h` : `${pomodoro.totalMins}m`
                : '—'}
            </Text>
            <Text style={styles.quickLabel}>fokus</Text>
          </PressableScale>
        </View>

        {/* ── Sweets guilt ── */}
        {sweetsThisMonth > 0 && (
          <PressableScale onPress={() => router.push('/(tabs)/finances' as any)}>
            <View style={styles.sweetsRow}>
              <Cookie size={13} color={colors.accent.amber} />
              <Text style={styles.sweetsText}>
                Słodycze: <Text style={styles.sweetsAmt}>{sweetsThisMonth.toFixed(0)} zł</Text> w tym miesiącu
              </Text>
              <ArrowUpRight size={12} color={colors.text.muted} />
            </View>
          </PressableScale>
        )}

        {/* ── Today in calendar (compact) ── */}
        {(todayEvents.length > 0 || todayTasks.length > 0) && (
          <Card onPress={() => router.push('/(tabs)/tasks' as any)} accentColor={colors.accent.blue}>
            <View style={styles.cardHeader}>
              <CalendarDays size={12} color={colors.accent.blue} />
              <Text style={[styles.cardLabel, { color: colors.accent.blue }]}>DZIŚ</Text>
              <ArrowUpRight size={12} color={colors.text.muted} style={{ marginLeft: 'auto' }} />
            </View>
            {todayEvents.slice(0, 3).map(ev => (
              <View key={ev.id} style={styles.calItem}>
                <View style={[styles.calDot, { backgroundColor: ev.color ?? colors.accent.blue }]} />
                <Text style={styles.calTitle} numberOfLines={1}>{ev.title}</Text>
                <Text style={styles.calTime}>{ev.startTime ?? 'cały dzień'}</Text>
              </View>
            ))}
            {todayTasks.slice(0, 2).map(t => (
              <View key={t.id} style={styles.calItem}>
                <View style={[styles.calDot, { backgroundColor: colors.accent.green }]} />
                <Text style={styles.calTitle} numberOfLines={1}>{t.title}</Text>
                <Text style={[styles.calTime, { color: colors.accent.red }]}>deadline</Text>
              </View>
            ))}
          </Card>
        )}

        {/* ── Mood Float Island ── */}
        {(() => {
          const moodColor = todayEntry ? MOOD_COLORS[todayEntry.mood] : colors.accent.pink;
          return (
            <PressableScale onPress={openCheckIn}>
              <View style={[styles.moodIsland, { borderColor: moodColor + '55', backgroundColor: moodColor + '0E' }]}>
                <View style={[styles.moodIslandPill, { backgroundColor: moodColor + '22' }]}>
                  <Smile size={13} color={moodColor} />
                  <Text style={[styles.moodIslandLabel, { color: moodColor }]}>NASTRÓJ</Text>
                </View>
                <View style={styles.moodDotsRow}>
                  {last7Mood.map((e) => (
                    <View key={e.id} style={[styles.moodDotSmall, { backgroundColor: MOOD_COLORS[e.mood] }]} />
                  ))}
                  {last7Mood.length === 0 && (
                    <Text style={styles.moodIslandEmpty}>brak danych</Text>
                  )}
                </View>
                <View style={{ flex: 1 }} />
                {last7Mood.length > 0 && (
                  <Text style={[styles.moodIslandAvg, { color: moodColor }]}>
                    {(last7Mood.reduce((a, b) => a + b.mood, 0) / last7Mood.length).toFixed(1)}
                  </Text>
                )}
                <View style={[styles.checkInBtn, { borderColor: moodColor + '40', backgroundColor: moodColor + '18' }]}>
                  <Text style={[styles.checkInText, { color: moodColor }]}>+ check-in</Text>
                </View>
              </View>
            </PressableScale>
          );
        })()}

        {/* ── Habits compact ── */}
        {habitsTotal > 0 && (
          <Card accentColor={colors.accent.purple}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>NAWYKI</Text>
              <Text style={[styles.cardLabel, {
                color: habitsDoneCount === habitsTotal ? colors.accent.green : colors.accent.purple,
              }]}>
                {habitsDoneCount}/{habitsTotal}
              </Text>
              <View style={{ flex: 1 }} />
              <PressableScale onPress={() => router.push('/habits' as any)} style={styles.seeAll}>
                <Text style={styles.seeAllText}>Wszystkie</Text>
                <ChevronRight size={12} color={colors.text.muted} />
              </PressableScale>
            </View>
            <View style={styles.habitsBubbles}>
              {habits.slice(0, 5).map(h => {
                const done = habitsDone.includes(h.id);
                return (
                  <TouchableOpacity
                    key={h.id}
                    onPress={() => toggleHabit(h.id)}
                    activeOpacity={0.75}
                    style={[styles.habitBubble, done && { borderColor: h.color, backgroundColor: h.color + '18' }]}
                  >
                    <HabitIconSmall name={h.icon} size={14} color={done ? h.color : colors.text.muted} />
                    <Text style={[styles.habitBubbleText, done && { color: h.color }]} numberOfLines={1}>{h.title}</Text>
                    {done && <CheckCircle2 size={10} color={h.color} />}
                  </TouchableOpacity>
                );
              })}
              {habitsTotal > 5 && (
                <View style={styles.habitMore}>
                  <Text style={styles.habitMoreText}>+{habitsTotal - 5}</Text>
                </View>
              )}
            </View>
          </Card>
        )}

      </ScrollView>

      {/* ── Bottom quick-actions ── */}
      <View style={styles.bottomBar}>
        <PressableScale onPress={() => router.push('/notes' as any)} style={styles.barBtn}>
          <NotebookPen size={18} color={colors.text.secondary} />
        </PressableScale>
        <PressableScale onPress={() => openQuick('expense')} style={styles.barBtn}>
          <TrendingDown size={18} color={colors.accent.red} />
        </PressableScale>
        <PressableScale onPress={() => router.push('/expenses/scan' as any)} style={styles.barBtn}>
          <ScanLine size={18} color={colors.accent.blue} />
        </PressableScale>
        <PressableScale onPress={() => openQuick('income')} style={styles.barBtn}>
          <TrendingUp size={18} color={colors.accent.green} />
        </PressableScale>
        <PressableScale onPress={() => router.push('/calendar/add' as any)} style={styles.barBtn}>
          <CalendarDays size={18} color={colors.text.secondary} />
        </PressableScale>
      </View>

      <MoodCheckInModal visible={modalVisible} onClose={closeCheckIn} existingEntry={null} />

      {/* ── Quick add sheet ── */}
      <Modal visible={quickVisible} transparent animationType="slide" onRequestClose={() => setQuickVisible(false)}>
        <Pressable style={qs.overlay} onPress={() => setQuickVisible(false)} />
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={qs.kav}>
          <View style={qs.sheet}>
            <View style={qs.handle} />
            <Text style={qs.title}>{quickType === 'income' ? 'Szybki przychód' : 'Szybki wydatek'}</Text>
            <View style={qs.amountRow}>
              <Text style={qs.currency}>PLN</Text>
              <TextInput
                style={[qs.amountInput, { color: quickType === 'income' ? colors.accent.green : colors.text.primary }]}
                value={quickAmount}
                onChangeText={setQuickAmount}
                placeholder="0,00"
                placeholderTextColor={colors.text.muted}
                keyboardType="decimal-pad"
                autoFocus
              />
            </View>
            {quickType === 'expense' && (
              <ScrollView horizontal showsHorizontalScrollIndicator={false} style={qs.catRow}>
                {(['food', 'transport', 'groceries', 'health', 'entertainment', 'other'] as ExpenseCategory[]).map(cat => {
                  const meta = CATEGORY_META[cat];
                  return (
                    <TouchableOpacity
                      key={cat}
                      style={[qs.catChip, quickCat === cat && { borderColor: meta.color, backgroundColor: meta.color + '18' }]}
                      onPress={() => setQuickCat(cat)}
                      activeOpacity={0.75}
                    >
                      <Text style={[qs.catText, quickCat === cat && { color: meta.color }]}>{meta.label}</Text>
                    </TouchableOpacity>
                  );
                })}
              </ScrollView>
            )}
            <View style={qs.actions}>
              <TouchableOpacity
                style={qs.fullBtn}
                onPress={() => {
                  setQuickVisible(false);
                  setTimeout(() => router.push({ pathname: '/expenses/add', params: { type: quickType, prefillAmount: quickAmount } } as any), 200);
                }}
                activeOpacity={0.75}
              >
                <Text style={qs.fullBtnText}>Pełny formularz</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[qs.saveBtn, { backgroundColor: quickType === 'income' ? colors.accent.green : colors.text.primary }]}
                onPress={handleQuickSave}
                disabled={quickSaving}
                activeOpacity={0.8}
              >
                <Text style={qs.saveBtnText}>{quickSaving ? '...' : 'Zapisz'}</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 160 },

  // ── Header ──────────────────────────────────────────────────────────────────
  header:    { gap: spacing[2], marginBottom: spacing[1] },
  headerTop: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerBtns: { flexDirection: 'row', gap: spacing[2], marginTop: 4 },
  dateText:  { fontSize: 12, color: colors.text.muted, marginBottom: 2 },
  greeting:  { fontSize: 28, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  settingsBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },
  humorRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderWidth: 1, borderColor: colors.border.subtle,
  },
  humorText: { flex: 1, fontSize: 12, color: colors.text.secondary, fontStyle: 'italic' },

  // ── Task hero ────────────────────────────────────────────────────────────────
  taskHeroHeader:  { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  taskCountWrap:   { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  taskCountBig:    { fontSize: 42, fontWeight: '900', color: colors.text.primary, letterSpacing: -2, lineHeight: 44 },
  taskCountLabel:  { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
  taskCountSub:    { fontSize: 11, fontWeight: '500' },
  doneBadge:       { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: colors.accent.green + '18', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  doneBadgeText:   { fontSize: 11, fontWeight: '600', color: colors.accent.green },
  seeAll:          { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText:      { fontSize: 11, color: colors.text.muted },
  progressWrap:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  progressTrack:   { flex: 1, height: 4, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full, overflow: 'hidden' },
  progressFill:    { height: 4, backgroundColor: colors.accent.green, borderRadius: radius.full },
  progressLabel:   { fontSize: 10, color: colors.text.muted, minWidth: 60 },
  taskGroupLabel:  { flexDirection: 'row', alignItems: 'center', paddingVertical: spacing[2] },
  taskGroupText:   { fontSize: 9, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.2, textTransform: 'uppercase' },
  tasksEmptyRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[3] },
  tasksEmptyText:  { fontSize: 13, color: colors.text.muted },
  addTaskRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingTop: spacing[3], marginTop: spacing[2], borderTopWidth: 1, borderTopColor: colors.border.subtle },
  addTaskText:     { fontSize: 12, color: colors.text.muted },

  // ── Quick stats row ──────────────────────────────────────────────────────────
  quickRow:  { flexDirection: 'row', gap: spacing[2] },
  quickTile: {
    flex: 1, alignItems: 'center', gap: 3,
    backgroundColor: colors.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default,
    paddingVertical: spacing[3], paddingHorizontal: spacing[2],
  },
  quickVal:   { fontSize: 15, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3 },
  quickLabel: { fontSize: 9, fontWeight: '500', color: colors.text.muted },

  // ── Sweets guilt bar ────────────────────────────────────────────────────────
  sweetsRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.subtle,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  sweetsIcon: { fontSize: 14 },
  sweetsText: { flex: 1, fontSize: 12, color: colors.text.secondary },
  sweetsAmt: { color: colors.accent.amber, fontWeight: '700' },

  // ── Calendar compact ─────────────────────────────────────────────────────────
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  cardLabel:  { fontSize: 10, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.2, textTransform: 'uppercase' },
  calItem:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 5 },
  calDot:     { width: 6, height: 6, borderRadius: 3 },
  calTitle:   { flex: 1, fontSize: 13, color: colors.text.primary },
  calTime:    { fontSize: 11, color: colors.text.muted },

  // ── Mood Float Island ────────────────────────────────────────────────────────
  moodIsland: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    borderRadius: 28, borderWidth: 1.5,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  moodIslandPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3,
  },
  moodIslandLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.2, textTransform: 'uppercase' },
  moodIslandAvg:   { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, marginRight: spacing[1] },
  moodIslandEmpty: { fontSize: 11, color: colors.text.muted },
  moodDotsRow:     { flexDirection: 'row', gap: 4, alignItems: 'center', marginLeft: spacing[1] },
  moodDotSmall:    { width: 7, height: 7, borderRadius: 4 },
  checkInBtn:      { paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  checkInText:     { fontSize: 11, fontWeight: '600' },

  // ── Habits compact ───────────────────────────────────────────────────────────
  habitsBubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  habitBubble:   { flexDirection: 'row', alignItems: 'center', gap: 5, paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.elevated },
  habitBubbleText: { fontSize: 12, fontWeight: '500', color: colors.text.secondary },
  habitMore:     { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.elevated },
  habitMoreText: { fontSize: 12, color: colors.text.muted },

  // ── Bottom bar ───────────────────────────────────────────────────────────────
  bottomBar: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], gap: spacing[2],
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
    backgroundColor: colors.bg.secondary,
  },
  barBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  moodBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    height: 40, backgroundColor: colors.bg.elevated,
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3],
  },
  moodDot:   { width: 7, height: 7, borderRadius: 4 },
  moodLabel: { fontSize: 12, fontWeight: '500', color: colors.text.secondary },
});

const qs = StyleSheet.create({
  overlay: { position: 'absolute', top: 0, left: 0, right: 0, bottom: 0, backgroundColor: 'rgba(0,0,0,0.6)' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing[5], paddingBottom: spacing[8], gap: spacing[3],
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border.default,
  },
  handle: { width: 36, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.12)', alignSelf: 'center', marginBottom: spacing[1] },
  title: { fontSize: 13, fontWeight: '700', color: colors.text.muted, letterSpacing: 0.5, textTransform: 'uppercase' },
  amountRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  currency: { fontSize: 18, fontWeight: '300', color: colors.text.muted },
  amountInput: { flex: 1, fontSize: 42, fontWeight: '800', letterSpacing: -1, paddingVertical: 0 },
  catRow: { marginHorizontal: -spacing[1] },
  catChip: {
    marginHorizontal: spacing[1], paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default,
    backgroundColor: colors.bg.elevated,
  },
  catText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  fullBtn: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.lg,
    backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center',
  },
  fullBtnText: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
  saveBtn: { flex: 2, paddingVertical: spacing[3], borderRadius: radius.lg, alignItems: 'center' },
  saveBtnText: { fontSize: 15, fontWeight: '800', color: colors.bg.primary },
});
