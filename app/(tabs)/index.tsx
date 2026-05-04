import { useMemo, useState, useRef } from 'react';
import { useHealthToday } from '@/hooks/useHealthToday';
import { View, Text, StyleSheet, ScrollView, RefreshControl, TouchableOpacity, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  CheckCircle2, Circle, ChevronRight,
  TrendingUp, TrendingDown, Timer, Flame,
  Smile, Zap, ArrowUpRight, CalendarDays, Settings, Search,
  Droplets, Dumbbell, BookOpen, Moon, Heart, Sun, Bike, Plus,
  BarChart2, Footprints, Target, NotebookPen, BrainCircuit,
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
import { Task, MOOD_LABELS, MOOD_COLORS, Habit } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';

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
      onPress={() => onToggle(task.id)}
      activeOpacity={0.75}
    >
      <View style={[ti.check, done && ti.checkDone]}>
        {done
          ? <CheckCircle2 size={18} color={colors.accent.green} />
          : <Circle size={18} color={urgent ? colors.accent.red : 'rgba(255,255,255,0.2)'} />
        }
      </View>
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
    <View style={[st.tile, { backgroundColor: color + '15', borderColor: color + '30' }]}>
      <Text style={[st.value, { color }]}>{value}</Text>
      <Text style={st.label}>{label}</Text>
      {sub && <Text style={[st.sub, { color: color + 'BB' }]}>{sub}</Text>}
    </View>
  );
}
const st = StyleSheet.create({
  tile: {
    flex: 1, borderRadius: radius.lg, borderWidth: 1,
    padding: spacing[3], gap: 2, minHeight: 72,
  },
  value: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5, lineHeight: 28 },
  label: { fontSize: 10, fontWeight: '500', color: colors.text.secondary },
  sub: { fontSize: 9, marginTop: 1 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const [captureText, setCaptureText] = useState('');
  const [capturing, setCapturing] = useState(false);
  const captureRef = useRef<TextInput>(null);

  const { stats, isLoading: finLoading, reload: reloadFin } = useExpenses();
  const { tasks, isLoading: tasksLoading, reload: reloadTasks, toggle, create } = useTasks();
  const { habits, todayDone: habitsDone, toggle: toggleHabit } = useHabits();
  const health = useHealthToday();
  const pomodoro = usePomodoroToday();
  const { todayEntry, modalVisible, openCheckIn, closeCheckIn } = useMoodCheckIn();
  const { entries: moodEntries } = useMoodStore();
  const { events } = useCalendarStore();
  const startPomodoro = usePomodoroStore(s => s.startFor);

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

  const previewTasks = useMemo(() =>
    pendingTasks
      .sort((a, b) => {
        const po: Record<string,number> = { high:0, normal:1, low:2 };
        return (po[a.priority]??1) - (po[b.priority]??1) || (a.deadline??'z').localeCompare(b.deadline??'z');
      })
      .slice(0, 5),
    [pendingTasks]);

  const todayDoneCount = useMemo(() =>
    tasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(today)).length,
    [tasks, today]);

  const last7Mood = useMemo(() =>
    moodEntries.slice(0, 7).reverse(),
    [moodEntries]);

  const handleToggle = (id: string) => {
    const t = tasks.find(x => x.id === id);
    toggle(id);
    if (t?.status !== 'done') toast.success('Zadanie ukończone');
  };

  const handlePomodoro = (task: Task) => {
    startPomodoro(task.id, task.title);
    router.push('/pomodoro' as any);
  };

  const handleCapture = async () => {
    const text = captureText.trim();
    if (!text) return;
    setCaptureText('');
    try {
      await create({ title: text, status: 'pending', priority: 'normal', tags: [] });
      toast.success('Zadanie dodane');
    } catch {
      toast.error('Nie udało się dodać zadania');
    }
  };

  const habitsTotal = habits.length;
  const habitsDoneCount = habits.filter(h => habitsDone.includes(h.id)).length;

  const onRefresh = () => { reloadFin(); reloadTasks(); };

  const dateLabel = new Date().toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).replace(/^\w/, c => c.toUpperCase());

  const hasToday = todayTasks.length > 0 || todayEvents.length > 0;

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.text.muted} />
        }
      >
        {/* ── Header ── */}
        <View style={styles.header}>
          <View>
            <Text style={styles.dateText}>{dateLabel}</Text>
            <Text style={styles.greeting}>{greeting()}</Text>
          </View>
          <View style={styles.headerRight}>
            <PressableScale onPress={() => router.push('/focus' as any)} style={styles.settingsBtn}>
              <Target size={16} color={colors.accent.purple} />
            </PressableScale>
            <PressableScale onPress={() => router.push('/notes' as any)} style={styles.settingsBtn}>
              <NotebookPen size={16} color={colors.text.muted} />
            </PressableScale>
            <PressableScale onPress={() => router.push('/weekly' as any)} style={styles.settingsBtn}>
              <BarChart2 size={16} color={colors.text.muted} />
            </PressableScale>
            <PressableScale onPress={() => router.push('/search' as any)} style={styles.settingsBtn}>
              <Search size={16} color={colors.text.muted} />
            </PressableScale>
            <PressableScale onPress={openCheckIn} style={styles.moodBtn}>
              {todayEntry ? (
                <>
                  <View style={[styles.moodDot, { backgroundColor: MOOD_COLORS[todayEntry.mood] }]} />
                  <Text style={[styles.moodLabel, { color: MOOD_COLORS[todayEntry.mood] }]}>
                    {MOOD_LABELS[todayEntry.mood]}
                  </Text>
                </>
              ) : (
                <>
                  <Smile size={14} color={colors.text.muted} />
                  <Text style={styles.moodLabel}>Jak dziś?</Text>
                </>
              )}
            </PressableScale>
            <PressableScale onPress={() => router.push('/settings' as any)} style={styles.settingsBtn}>
              <Settings size={16} color={colors.text.muted} />
            </PressableScale>
          </View>
        </View>

        {/* ── Stat tiles ── */}
        <View style={styles.tilesRow}>
          <StatTile
            value={String(pendingTasks.length)}
            label="zadań"
            color={colors.accent.purple}
            sub={todayTasks.length > 0 ? `${todayTasks.length} na dziś` : undefined}
          />
          <StatTile
            value={`${balancePos ? '+' : ''}${Math.round(balance)}`}
            label="saldo zł"
            color={balancePos ? colors.accent.green : colors.accent.red}
            sub="ten miesiąc"
          />
          <StatTile
            value={last7Mood.length > 0
              ? (last7Mood.reduce((a,b) => a + b.mood, 0) / last7Mood.length).toFixed(1)
              : '—'}
            label="nastrój"
            color={colors.accent.pink}
            sub="śr. 7 dni"
          />
        </View>

        {/* ── Quick capture ── */}
        <View style={[styles.captureWrap, capturing && styles.captureWrapFocused]}>
          <Plus size={15} color={capturing ? colors.accent.purple : colors.text.muted} />
          <TextInput
            ref={captureRef}
            value={captureText}
            onChangeText={setCaptureText}
            placeholder="Szybkie zadanie..."
            placeholderTextColor={colors.text.muted}
            style={styles.captureInput}
            returnKeyType="done"
            onSubmitEditing={handleCapture}
            onFocus={() => setCapturing(true)}
            onBlur={() => setCapturing(false)}
            blurOnSubmit
          />
          {captureText.length > 0 && (
            <TouchableOpacity onPress={handleCapture} style={styles.captureBtn} activeOpacity={0.75}>
              <Text style={styles.captureBtnText}>Dodaj</Text>
            </TouchableOpacity>
          )}
        </View>

        {/* ── Finance card ── */}
        <Card onPress={() => router.push('/(tabs)/finances' as any)}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>FINANSE</Text>
            <ArrowUpRight size={14} color={colors.text.muted} />
          </View>
          <Text style={[styles.balanceBig, { color: balancePos ? colors.accent.green : colors.accent.red }]}>
            {balancePos ? '+' : ''}{balance.toFixed(2)}
            <Text style={styles.balanceCur}> zł</Text>
          </Text>
          <View style={styles.finRow}>
            <View style={styles.finStat}>
              <TrendingUp size={12} color={colors.accent.green} />
              <Text style={[styles.finVal, { color: colors.accent.green }]}>
                +{stats.monthIncome.toFixed(0)} zł
              </Text>
            </View>
            <View style={styles.finDivider} />
            <View style={styles.finStat}>
              <TrendingDown size={12} color={colors.accent.red} />
              <Text style={[styles.finVal, { color: colors.accent.red }]}>
                -{stats.monthExpenses.toFixed(0)} zł
              </Text>
            </View>
            <View style={styles.finDivider} />
            <Text style={styles.finMonth}>
              {new Date().toLocaleDateString('pl-PL', { month: 'long' })}
            </Text>
          </View>
        </Card>

        {/* ── Tasks card ── */}
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>ZADANIA</Text>
            {pendingTasks.length > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.accent.purple + '20' }]}>
                <Text style={[styles.countText, { color: colors.accent.purple }]}>
                  {pendingTasks.length}
                </Text>
              </View>
            )}
            {todayDoneCount > 0 && (
              <View style={[styles.countBadge, { backgroundColor: colors.accent.green + '20' }]}>
                <Text style={[styles.countText, { color: colors.accent.green }]}>
                  +{todayDoneCount} dziś
                </Text>
              </View>
            )}
            <View style={{ flex: 1 }} />
            <PressableScale
              onPress={() => router.push('/(tabs)/tasks' as any)}
              style={styles.seeAll}
            >
              <Text style={styles.seeAllText}>Wszystkie</Text>
              <ChevronRight size={12} color={colors.text.muted} />
            </PressableScale>
          </View>

          {previewTasks.length > 0 ? (
            <View>
              {previewTasks.map((t) => (
                <TaskItem
                  key={t.id}
                  task={t}
                  onToggle={handleToggle}
                  onPomodoro={handlePomodoro}
                />
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Brak aktywnych zadań</Text>
          )}
        </Card>

        {/* ── Mood history strip ── */}
        {last7Mood.length > 0 && (
          <Card onPress={() => router.push('/(tabs)/mood' as any)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>NASTRÓJ — 7 DNI</Text>
              <PressableScale onPress={openCheckIn} style={styles.checkInBtn}>
                <Text style={styles.checkInText}>+ check-in</Text>
              </PressableScale>
            </View>
            <View style={styles.moodStrip}>
              {last7Mood.map((e) => {
                const mc = MOOD_COLORS[e.mood];
                const barH = Math.max(12, (e.mood / 5) * 48);
                return (
                  <View key={e.id} style={styles.moodCol}>
                    <View style={styles.moodBarTrack}>
                      <View style={[styles.moodBarFill, { height: barH, backgroundColor: mc }]} />
                    </View>
                    <Text style={[styles.moodNum, { color: mc }]}>{e.mood}</Text>
                    <Text style={styles.moodDate}>{e.date.slice(8)}</Text>
                  </View>
                );
              })}
              {/* Energy sparkline */}
              <View style={styles.moodDivider} />
              <View style={styles.energyCol}>
                <Zap size={12} color={colors.accent.amber} />
                <Text style={[styles.energyVal, { color: colors.accent.amber }]}>
                  {(last7Mood.reduce((a,b)=>a+b.energy,0)/last7Mood.length).toFixed(1)}
                </Text>
                <Text style={styles.energySub}>śr. energii</Text>
              </View>
            </View>
          </Card>
        )}

        {/* ── Habits ── */}
        <Card>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>NAWYKI</Text>
            {habitsTotal > 0 && (
              <Text style={[styles.cardLabel, {
                color: habitsDoneCount === habitsTotal ? colors.accent.green : colors.accent.purple,
                marginLeft: 2,
              }]}>
                {habitsDoneCount}/{habitsTotal}
              </Text>
            )}
            <View style={{ flex: 1 }} />
            <PressableScale
              onPress={() => router.push('/habits' as any)}
              style={styles.seeAll}
            >
              <Text style={styles.seeAllText}>Wszystkie</Text>
              <ChevronRight size={12} color={colors.text.muted} />
            </PressableScale>
          </View>

          {habitsTotal === 0 ? (
            <PressableScale
              onPress={() => router.push('/habits' as any)}
              style={styles.habitsEmpty}
            >
              <Plus size={14} color={colors.text.muted} />
              <Text style={styles.habitsEmptyText}>Dodaj nawyki do śledzenia</Text>
            </PressableScale>
          ) : (
            <View style={styles.habitsBubbles}>
              {habits.slice(0, 6).map(h => {
                const done = habitsDone.includes(h.id);
                return (
                  <TouchableOpacity
                    key={h.id}
                    onPress={() => toggleHabit(h.id)}
                    activeOpacity={0.75}
                    style={[
                      styles.habitBubble,
                      { borderColor: done ? h.color : 'rgba(255,255,255,0.08)' },
                      done && { backgroundColor: h.color + '20' },
                    ]}
                  >
                    <HabitIconSmall name={h.icon} size={16} color={done ? h.color : colors.text.muted} />
                    <Text style={[styles.habitBubbleText, done && { color: h.color }]} numberOfLines={1}>
                      {h.title}
                    </Text>
                    {done && <CheckCircle2 size={10} color={h.color} />}
                  </TouchableOpacity>
                );
              })}
              {habitsTotal > 6 && (
                <View style={styles.habitMore}>
                  <Text style={styles.habitMoreText}>+{habitsTotal - 6}</Text>
                </View>
              )}
            </View>
          )}
        </Card>

        {/* ── Health today ── */}
        {(health.steps > 0 || health.water > 0 || health.sleepH > 0 || pomodoro.totalRounds > 0) && (
          <Card onPress={() => router.push('/(tabs)/health' as any)}>
            <View style={styles.cardHeader}>
              <Text style={styles.cardLabel}>ZDROWIE DZIŚ</Text>
              <ArrowUpRight size={14} color={colors.text.muted} />
            </View>
            <View style={styles.healthRow}>
              {health.steps > 0 && (
                <View style={styles.healthStat}>
                  <Footprints size={13} color={health.steps >= 10000 ? colors.accent.green : colors.text.muted} />
                  <Text style={[styles.healthVal, health.steps >= 10000 && { color: colors.accent.green }]}>
                    {(health.steps / 1000).toFixed(1)}k
                  </Text>
                  <Text style={styles.healthLabel}>kroków</Text>
                </View>
              )}
              {health.sleepH > 0 && (
                <View style={styles.healthStat}>
                  <Moon size={13} color={health.sleepH >= 7 ? colors.accent.purple : colors.text.muted} />
                  <Text style={[styles.healthVal, health.sleepH >= 7 && { color: colors.accent.purple }]}>
                    {health.sleepH}h{health.sleepM > 0 ? `${health.sleepM}m` : ''}
                  </Text>
                  <Text style={styles.healthLabel}>sen</Text>
                </View>
              )}
              {health.water > 0 && (
                <View style={styles.healthStat}>
                  <Droplets size={13} color={health.water >= 8 ? colors.accent.green : colors.text.muted} />
                  <Text style={[styles.healthVal, health.water >= 8 && { color: colors.accent.green }]}>
                    {health.water}/8
                  </Text>
                  <Text style={styles.healthLabel}>woda</Text>
                </View>
              )}
              {pomodoro.totalRounds > 0 && (
                <View style={styles.healthStat}>
                  <BrainCircuit size={13} color={colors.accent.purple} />
                  <Text style={[styles.healthVal, { color: colors.accent.purple }]}>
                    {pomodoro.totalMins >= 60
                      ? `${Math.floor(pomodoro.totalMins / 60)}h${pomodoro.totalMins % 60 > 0 ? `${pomodoro.totalMins % 60}m` : ''}`
                      : `${pomodoro.totalMins}m`}
                  </Text>
                  <Text style={styles.healthLabel}>fokus</Text>
                </View>
              )}
              {/* Step progress bar */}
              {health.steps > 0 && (
                <View style={styles.healthBarWrap}>
                  <View style={[styles.healthBar, {
                    width: `${Math.min(100, health.steps / 100)}%`,
                    backgroundColor: health.steps >= 10000 ? colors.accent.green : colors.text.primary,
                  }]} />
                </View>
              )}
            </View>
          </Card>
        )}

        {/* ── Today in calendar ── */}
        <Card onPress={() => router.push('/(tabs)/calendar' as any)}>
          <View style={styles.cardHeader}>
            <Text style={styles.cardLabel}>DZIŚ W KALENDARZU</Text>
            <ArrowUpRight size={14} color={colors.text.muted} />
          </View>
          {hasToday ? (
            <View style={styles.calPreview}>
              {todayEvents.slice(0, 3).map(ev => (
                <PressableScale
                  key={ev.id}
                  onPress={() => router.push(`/calendar/${ev.id}` as any)}
                  style={styles.calItem}
                >
                  <CalendarDays size={12} color={ev.color ?? colors.accent.blue} />
                  <Text style={styles.calTitle} numberOfLines={1}>{ev.title}</Text>
                  {ev.startTime ? (
                    <Text style={styles.calTime}>{ev.startTime}</Text>
                  ) : (
                    <Text style={[styles.calTime, styles.calAllDay]}>cały dzień</Text>
                  )}
                </PressableScale>
              ))}
              {todayTasks.slice(0, 3 - Math.min(todayEvents.length, 3)).map(t => (
                <View key={t.id} style={styles.calItem}>
                  <View style={[styles.calDot, { backgroundColor: colors.accent.purple }]} />
                  <Text style={styles.calTitle} numberOfLines={1}>{t.title}</Text>
                  {t.deadline && (
                    <Text style={styles.calTime}>{t.deadline.slice(11,16)}</Text>
                  )}
                </View>
              ))}
            </View>
          ) : (
            <Text style={styles.emptyText}>Brak wydarzeń na dziś</Text>
          )}
        </Card>

      </ScrollView>

      <MoodCheckInModal
        visible={modalVisible}
        onClose={closeCheckIn}
        existingEntry={todayEntry}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 120 },

  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    justifyContent: 'space-between', marginBottom: spacing[1],
    paddingTop: spacing[2],
  },
  dateText: { fontSize: 12, color: colors.text.muted, marginBottom: 4 },
  greeting: { fontSize: 30, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  moodBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.full,
    borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  settingsBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: colors.bg.elevated,
    borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  moodDot: { width: 7, height: 7, borderRadius: 4 },
  moodLabel: { fontSize: 12, fontWeight: '500', color: colors.text.secondary },

  tilesRow: { flexDirection: 'row', gap: spacing[2] },

  captureWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  captureWrapFocused: {
    borderColor: colors.accent.purple + '55',
    backgroundColor: colors.bg.elevated,
  },
  captureInput: {
    flex: 1, fontSize: 14, color: colors.text.primary,
    paddingVertical: 0,
  },
  captureBtn: {
    backgroundColor: colors.accent.purple,
    borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: 5,
  },
  captureBtnText: { fontSize: 12, fontWeight: '700', color: colors.bg.primary },

  cardHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3],
  },
  cardLabel: {
    fontSize: 10, fontWeight: '700', color: colors.text.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  countBadge: {
    paddingHorizontal: 7, paddingVertical: 2,
    borderRadius: radius.full,
  },
  countText: { fontSize: 10, fontWeight: '700' },
  seeAll: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText: { fontSize: 11, color: colors.text.muted },

  balanceBig: { fontSize: 38, fontWeight: '800', letterSpacing: -1, lineHeight: 44 },
  balanceCur: { fontSize: 18, fontWeight: '400' },
  finRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    marginTop: spacing[3], paddingTop: spacing[3],
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
  },
  finStat: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  finVal: { fontSize: 12, fontWeight: '600' },
  finDivider: { width: 1, height: 14, backgroundColor: colors.border.default },
  finMonth: { fontSize: 11, color: colors.text.muted, marginLeft: 'auto' },

  emptyText: { fontSize: 13, color: colors.text.muted, paddingVertical: spacing[2] },

  checkInBtn: {
    marginLeft: 'auto',
    backgroundColor: colors.accent.pink + '18',
    paddingHorizontal: spacing[3], paddingVertical: 4,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: colors.accent.pink + '35',
  },
  checkInText: { fontSize: 11, fontWeight: '600', color: colors.accent.pink },

  moodStrip: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2] },
  moodCol: { flex: 1, alignItems: 'center', gap: 4 },
  moodBarTrack: { height: 52, justifyContent: 'flex-end' },
  moodBarFill: { width: 10, borderRadius: 5 },
  moodNum: { fontSize: 10, fontWeight: '700' },
  moodDate: { fontSize: 8, color: colors.text.muted },
  moodDivider: { width: 1, height: 40, backgroundColor: colors.border.default },
  energyCol: { alignItems: 'center', gap: 3, paddingLeft: spacing[1] },
  energyVal: { fontSize: 16, fontWeight: '800' },
  energySub: { fontSize: 8, color: colors.text.muted, textAlign: 'center' },

  calPreview: { gap: spacing[2] },
  calItem: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  calDot: { width: 6, height: 6, borderRadius: 3 },
  calTitle: { flex: 1, fontSize: 13, color: colors.text.primary },
  calTime: { fontSize: 11, color: colors.text.muted },
  calAllDay: { fontSize: 10, fontStyle: 'italic' },

  habitsEmpty: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2],
  },
  habitsEmptyText: { fontSize: 13, color: colors.text.muted },
  habitsBubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  habitBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.elevated,
  },
  habitBubbleText: { fontSize: 12, fontWeight: '500', color: colors.text.secondary },
  habitMore: {
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.elevated,
  },
  habitMoreText: { fontSize: 12, color: colors.text.muted },

  healthRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[4], flexWrap: 'wrap' },
  healthStat: { alignItems: 'center', gap: 3 },
  healthVal: { fontSize: 16, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3 },
  healthLabel: { fontSize: 9, color: colors.text.muted, fontWeight: '500' },
  healthBarWrap: {
    flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.full, overflow: 'hidden', alignSelf: 'center',
  },
  healthBar: { height: 3, borderRadius: radius.full },
});
