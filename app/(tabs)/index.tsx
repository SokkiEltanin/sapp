import { useMemo, useEffect, useState } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  CheckCircle2, ChevronRight,
  TrendingUp, TrendingDown,
  Flame, Smile, Zap, CalendarDays,
  Settings, Search, Droplets, Dumbbell,
  BookOpen, Moon, Heart, Sun, Bike,
  BrainCircuit, Plus,
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
import { MOOD_COLORS } from '@/types';
import { colors, spacing, radius } from '@/theme';
import { useTabSwipe } from '@/hooks/useTabSwipe';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { Animated } from 'react-native';

// ─── Habit icon map ───────────────────────────────────────────────────────────

const HABIT_ICON_MAP: Record<string, React.ComponentType<any>> = {
  droplets: Droplets, dumbbell: Dumbbell, 'book-open': BookOpen,
  moon: Moon, zap: Zap, heart: Heart, sun: Sun, bike: Bike,
};
function HabitIcon({ name, size, color }: { name: string; size: number; color: string }) {
  const Icon = HABIT_ICON_MAP[name] ?? Zap;
  return <Icon size={size} color={color} />;
}

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function plTasks(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'zadanie';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'zadania';
  return 'zadań';
}

const HUMOR: Record<number, string[]> = {
  1: ['Dzień jak z horroru. Przeżyłeś. Na razie.', 'Gorzej nie będzie. Chyba.', 'Przetrwanie to też sukces.'],
  2: ['Słabo. Ale przynajmniej żyjesz.', 'Nie jest świetnie. Jest. To wystarczy.', 'Niskie obroty, rozumiem.'],
  3: ['Tak sobie. Normalna energia.', 'Middle ground — ani super ani kiepsko.', 'Standard. Nic specjalnego.'],
  4: ['Całkiem nieźle! Nie psuj tego.', 'Dobry nastrój? Wykorzystaj go.', 'Rzadki widok. Doceniam.'],
  5: ['SZCZYT MOŻLIWOŚCI. Serio co zrobiłeś?', '5/5 — dziś możesz wszystko.', 'Energia max. Pisz to sprawozdanie.'],
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


// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { panHandlers, animatedStyle } = useTabSwipe();
  const { color: accentColor, greeting } = useTimeAccent();

  const { stats, isLoading: finLoading, reload: reloadFin } = useExpenses();
  const { tasks, isLoading: tasksLoading, reload: reloadTasks } = useTasks();
  const { habits, todayDone: habitsDone, toggle: toggleHabit } = useHabits();
  const pomodoro    = usePomodoroToday();
  const { todayEntry, modalVisible, openCheckIn, closeCheckIn } = useMoodCheckIn();
  const { entries: moodEntries } = useMoodStore();
  const { events, setEvents } = useCalendarStore();
  useEffect(() => {
    if (events.length === 0) {
      import('@/services/calendarService').then(({ calendarService }) => {
        calendarService.getAllEvents().then(setEvents).catch(() => {});
      });
    }
  }, []);

  const today     = todayStr();
  const isLoading = finLoading || tasksLoading;
  const balance   = stats.monthIncome - stats.monthExpenses;
  const balPos    = balance >= 0;

  const pendingTasks = useMemo(() =>
    tasks.filter(t => t.status !== 'done'), [tasks]);

  const todayTasks = useMemo(() =>
    pendingTasks.filter(t => t.deadline?.startsWith(today) || t.scheduledDate === today),
    [pendingTasks, today]);

  const todayEvents = useMemo(() =>
    events.filter(e => e.date === today), [events, today]);


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

  const habitsTotal     = habits.length;
  const habitsDoneCount = habits.filter(h => habitsDone.includes(h.id)).length;
  const onRefresh       = () => { reloadFin(); reloadTasks(); };

  const todayTotal    = todayTasks.length + todayDoneCount;
  const todayProgress = todayTotal > 0 ? todayDoneCount / todayTotal : 0;

  const humor = useMemo(
    () => humorLine(todayEntry?.mood, pendingTasks.length, todayDoneCount),
    [todayEntry?.mood, pendingTasks.length, todayDoneCount],
  );

  const dateLabel = new Date().toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).replace(/^\w/, c => c.toUpperCase());

  return (
    <SafeAreaView style={s.safe} edges={['top']} {...panHandlers}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.text.secondary} />
          }
        >
          {/* ── Header ──────────────────────────────────────────────────── */}
          <View style={s.header}>
            <View style={s.headerTop}>
              <View>
                <Text style={s.dateText}>{dateLabel}</Text>
                <Text style={[s.greeting, { color: accentColor }]}>{greeting}</Text>
              </View>
              <View style={s.headerBtns}>
                <PressableScale onPress={() => router.push('/search' as any)} style={s.iconBtn}>
                  <Search size={17} color={colors.text.secondary} />
                </PressableScale>
                <PressableScale onPress={() => router.push('/settings' as any)} style={s.iconBtn}>
                  <Settings size={17} color={colors.text.secondary} />
                </PressableScale>
              </View>
            </View>

            {/* Humor / status line */}
            <PressableScale onPress={openCheckIn} style={s.humorRow}>
              {todayEntry
                ? <View style={[s.moodDot, { backgroundColor: MOOD_COLORS[todayEntry.mood] }]} />
                : <Smile size={12} color={colors.text.muted} />}
              <Text style={s.humorText} numberOfLines={1}>{humor}</Text>
            </PressableScale>
          </View>

          {/* ── Tasks hero ──────────────────────────────────────────────── */}
          <PressableScale onPress={() => router.push('/(tabs)/tasks' as any)}>
            <View style={s.card}>
              <View style={s.taskHeader}>
                <View style={s.taskCountRow}>
                  <Text style={s.taskBig}>{pendingTasks.length}</Text>
                  <View>
                    <Text style={s.taskLabel}>{plTasks(pendingTasks.length)}</Text>
                    {todayTasks.length > 0 && (
                      <Text style={[s.taskSub, { color: accentColor }]}>{todayTasks.length} na dziś</Text>
                    )}
                  </View>
                </View>
                <View style={{ flex: 1 }} />
                {todayDoneCount > 0 && (
                  <View style={s.doneBadge}>
                    <CheckCircle2 size={10} color={colors.accent.green} />
                    <Text style={s.doneBadgeText}>{todayDoneCount} dziś</Text>
                  </View>
                )}
                <ChevronRight size={16} color={colors.text.muted} />
              </View>

              {/* Progress bar */}
              {todayTotal > 0 && (
                <View style={s.progressRow}>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${todayProgress * 100}%`, backgroundColor: accentColor }]} />
                  </View>
                  <Text style={s.progressLabel}>{todayDoneCount}/{todayTotal} dziś</Text>
                </View>
              )}

              <PressableScale onPress={(e) => { e.stopPropagation?.(); router.push('/tasks/add' as any); }} style={s.addRow}>
                <Plus size={12} color={colors.text.muted} />
                <Text style={s.addText}>Dodaj zadanie</Text>
              </PressableScale>
            </View>
          </PressableScale>

          {/* ── Stats row ───────────────────────────────────────────────── */}
          <View style={s.statsRow}>
            <PressableScale style={s.statTile} onPress={() => router.push('/(tabs)/finances' as any)}>
              {balPos
                ? <TrendingUp size={12} color={colors.accent.green} />
                : <TrendingDown size={12} color={colors.accent.red} />}
              <Text style={[s.statVal, { color: balPos ? colors.text.primary : colors.accent.red }]}>
                {balPos ? '+' : ''}{Math.round(balance)}
              </Text>
              <Text style={s.statLabel}>saldo zł</Text>
            </PressableScale>

            <PressableScale style={s.statTile} onPress={() => router.push('/(tabs)/tasks' as any)}>
              <CalendarDays size={12} color={todayEvents.length > 0 ? colors.accent.blue : colors.text.muted} />
              <Text style={s.statVal}>{todayEvents.length}</Text>
              <Text style={s.statLabel}>dziś</Text>
            </PressableScale>

            <PressableScale style={s.statTile} onPress={() => router.push('/habits' as any)}>
              <Flame size={12} color={habitsTotal > 0 && habitsDoneCount === habitsTotal ? colors.accent.amber : colors.text.muted} />
              <Text style={s.statVal}>{habitsTotal > 0 ? `${habitsDoneCount}/${habitsTotal}` : '—'}</Text>
              <Text style={s.statLabel}>nawyki</Text>
            </PressableScale>

            <PressableScale style={s.statTile} onPress={() => router.push('/focus' as any)}>
              <BrainCircuit size={12} color={pomodoro.totalMins > 0 ? colors.accent.purple : colors.text.muted} />
              <Text style={s.statVal}>
                {pomodoro.totalMins > 0
                  ? pomodoro.totalMins >= 60 ? `${Math.floor(pomodoro.totalMins / 60)}h` : `${pomodoro.totalMins}m`
                  : '—'}
              </Text>
              <Text style={s.statLabel}>fokus</Text>
            </PressableScale>
          </View>

          {/* ── Mood island ─────────────────────────────────────────────── */}
          {(() => {
            const mc = todayEntry ? MOOD_COLORS[todayEntry.mood] : colors.accent.pink;
            return (
              <PressableScale onPress={() => router.push('/(tabs)/stats' as any)}>
                <View style={[s.moodIsland, { borderColor: mc + '44', backgroundColor: mc + '0A' }]}>
                  <View style={[s.moodPill, { backgroundColor: mc + '1A' }]}>
                    <Smile size={12} color={mc} />
                    <Text style={[s.moodPillLabel, { color: mc }]}>NASTRÓJ</Text>
                  </View>
                  <View style={s.moodDots}>
                    {last7Mood.map(e => (
                      <View key={e.id} style={[s.moodDotSm, { backgroundColor: MOOD_COLORS[e.mood] }]} />
                    ))}
                    {last7Mood.length === 0 && <Text style={s.moodEmpty}>brak danych</Text>}
                  </View>
                  <View style={{ flex: 1 }} />
                  {last7Mood.length > 0 && (
                    <Text style={[s.moodAvg, { color: mc }]}>
                      {(last7Mood.reduce((a, b) => a + b.mood, 0) / last7Mood.length).toFixed(1)}
                    </Text>
                  )}
                  <TouchableOpacity
                    onPress={(ev) => { ev.stopPropagation?.(); openCheckIn(); }}
                    style={[s.checkInBtn, { borderColor: mc + '44', backgroundColor: mc + '18' }]}
                    hitSlop={8}
                  >
                    <Text style={[s.checkInText, { color: mc }]}>+ check-in</Text>
                  </TouchableOpacity>
                </View>
              </PressableScale>
            );
          })()}

          {/* ── Habits compact ───────────────────────────────────────────── */}
          {habitsTotal > 0 && (
            <View style={s.card}>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>NAWYKI</Text>
                <Text style={[s.cardLabel, {
                  color: habitsDoneCount === habitsTotal ? colors.accent.green : colors.accent.purple,
                }]}>
                  {habitsDoneCount}/{habitsTotal}
                </Text>
                <View style={{ flex: 1 }} />
                <PressableScale onPress={() => router.push('/habits' as any)} style={s.seeAll}>
                  <Text style={s.seeAllText}>Wszystkie</Text>
                  <ChevronRight size={12} color={colors.text.muted} />
                </PressableScale>
              </View>
              <View style={s.habitsBubbles}>
                {habits.slice(0, 5).map(h => {
                  const done = habitsDone.includes(h.id);
                  return (
                    <TouchableOpacity
                      key={h.id}
                      onPress={() => toggleHabit(h.id)}
                      activeOpacity={0.75}
                      style={[s.habitBubble, done && { borderColor: h.color, backgroundColor: h.color + '18' }]}
                    >
                      <HabitIcon name={h.icon} size={13} color={done ? h.color : colors.text.muted} />
                      <Text style={[s.habitText, done && { color: h.color }]} numberOfLines={1}>{h.title}</Text>
                      {done && <CheckCircle2 size={10} color={h.color} />}
                    </TouchableOpacity>
                  );
                })}
                {habitsTotal > 5 && (
                  <View style={s.habitMore}>
                    <Text style={s.habitMoreText}>+{habitsTotal - 5}</Text>
                  </View>
                )}
              </View>
            </View>
          )}
        </ScrollView>

        <MoodCheckInModal visible={modalVisible} onClose={closeCheckIn} existingEntry={null} />
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 140 },

  // Header
  header:     { gap: spacing[2], marginBottom: spacing[1] },
  headerTop:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerBtns: { flexDirection: 'row', gap: spacing[2], marginTop: 6 },
  dateText:   { fontSize: 11, color: colors.text.muted, marginBottom: 2, letterSpacing: 0.2 },
  greeting:   { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, lineHeight: 34 },
  iconBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  humorRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderWidth: 1, borderColor: colors.border.subtle,
  },
  humorText: { flex: 1, fontSize: 12, color: colors.text.secondary, fontStyle: 'italic' },
  moodDot:   { width: 7, height: 7, borderRadius: 4 },

  // Card
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
  },

  // Tasks
  taskHeader:   { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  taskCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  taskBig:      { fontSize: 44, fontWeight: '900', color: colors.text.primary, letterSpacing: -2, lineHeight: 46 },
  taskLabel:    { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
  taskSub:      { fontSize: 11, fontWeight: '500' },
  doneBadge:    {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent.green + '14',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full,
  },
  doneBadgeText: { fontSize: 10, fontWeight: '600', color: colors.accent.green },
  seeAll:        { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText:    { fontSize: 11, color: colors.text.muted },

  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.full, overflow: 'hidden' },
  progressFill:  { height: 3, borderRadius: radius.full },
  progressLabel: { fontSize: 10, color: colors.text.muted, minWidth: 28 },

  groupLabel: { fontSize: 9, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.5, paddingVertical: spacing[2] },
  emptyRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[3] },
  emptyText:  { fontSize: 13, color: colors.text.muted },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingTop: spacing[3], marginTop: spacing[2],
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
  },
  addText: { fontSize: 12, color: colors.text.muted },

  // Stats row
  statsRow: { flexDirection: 'row', gap: spacing[2] },
  statTile: {
    flex: 1, alignItems: 'center', gap: 3,
    backgroundColor: colors.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default,
    paddingVertical: spacing[3], paddingHorizontal: spacing[2],
  },
  statVal:   { fontSize: 15, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3 },
  statLabel: { fontSize: 9, fontWeight: '500', color: colors.text.muted },

  // Mood island
  moodIsland: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    borderRadius: 28, borderWidth: 1,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  moodPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3,
  },
  moodPillLabel: { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  moodDots:      { flexDirection: 'row', gap: 4, alignItems: 'center', marginLeft: spacing[1] },
  moodDotSm:     { width: 7, height: 7, borderRadius: 4 },
  moodEmpty:     { fontSize: 11, color: colors.text.muted },
  moodAvg:       { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, marginRight: spacing[1] },
  checkInBtn:    { paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  checkInText:   { fontSize: 11, fontWeight: '600' },

  // Habits
  cardRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  cardLabel:    { fontSize: 10, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.5, textTransform: 'uppercase' },
  habitsBubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  habitBubble:   {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: colors.border.default, backgroundColor: colors.bg.elevated,
  },
  habitText:     { fontSize: 12, fontWeight: '500', color: colors.text.secondary },
  habitMore:     { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.elevated },
  habitMoreText: { fontSize: 12, color: colors.text.muted },
});
