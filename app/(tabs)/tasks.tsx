import { useState, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, SectionList, RefreshControl,
  TouchableOpacity, Alert, Modal, Pressable, ScrollView, Animated, TextInput,
} from 'react-native';
import Swipeable from 'react-native-gesture-handler/Swipeable';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  CheckCircle2, Circle, Clock, Flame, Timer,
  ChevronDown, Filter, Search, RefreshCw, AlarmClock, BellOff, BarChart2, CheckSquare, Target,
  Trash2, Plus, CalendarClock, X as XIcon,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import AnimatedButton from '@/components/ui/AnimatedButton';
import { useTasks } from '@/hooks/useTasks';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { toast } from '@/store/toastStore';
import CompletionMoodModal from '@/components/tasks/CompletionMoodModal';
import { Task, TaskDifficulty, MoodLevel } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';

// ─── Snooze options ───────────────────────────────────────────────────────────

function buildSnoozeOptions() {
  const now = new Date();
  const tomorrow = new Date(now);
  tomorrow.setDate(tomorrow.getDate() + 1);
  tomorrow.setHours(8, 0, 0, 0);
  const in3 = new Date(now); in3.setDate(in3.getDate() + 3); in3.setHours(8, 0, 0, 0);
  const in7 = new Date(now); in7.setDate(in7.getDate() + 7); in7.setHours(8, 0, 0, 0);
  return [
    { label: '1 godzinę',          date: new Date(now.getTime() + 60 * 60_000) },
    { label: '2 godziny',          date: new Date(now.getTime() + 2 * 60 * 60_000) },
    { label: 'Jutro rano (8:00)',  date: tomorrow },
    { label: 'Za 3 dni',           date: in3 },
    { label: 'Za tydzień',         date: in7 },
  ];
}

function fmtSnooze(iso: string) {
  const d = new Date(iso);
  const now = new Date();
  const diffMs = d.getTime() - now.getTime();
  const diffH = diffMs / 3_600_000;
  if (diffH < 1) return `${Math.ceil(diffMs / 60_000)} min`;
  if (diffH < 24) return `${d.getHours()}:${String(d.getMinutes()).padStart(2, '0')}`;
  const [, m, day] = d.toISOString().split('T')[0].split('-');
  return `${parseInt(day)}.${parseInt(m)}`;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function tomorrowStr() {
  const d = new Date(); d.setDate(d.getDate() + 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function weekEndStr() {
  const d = new Date();
  const diff = d.getDay() === 0 ? 6 : 7 - d.getDay();
  d.setDate(d.getDate() + diff);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDl(iso: string) {
  const d = iso.split('T')[0];
  const today = todayStr();
  if (d === today) return 'dziś';
  if (d === tomorrowStr()) return 'jutro';
  const [, m, day] = d.split('-');
  return `${parseInt(day)}.${parseInt(m)}`;
}

type FilterKey = 'all' | 'today' | 'week' | 'done' | 'snoozed';
const FILTERS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'Wszystkie' },
  { key: 'today',   label: 'Dziś' },
  { key: 'week',    label: 'Tydzień' },
  { key: 'done',    label: 'Ukończone' },
  { key: 'snoozed', label: 'Odłożone' },
];

interface Section { title: string; accent: string; data: Task[] }

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };
function byPriority(a: Task, b: Task) {
  return (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
}

function buildSections(tasks: Task[]): Section[] {
  const today    = todayStr();
  const tomorrow = tomorrowStr();
  const weekEnd  = weekEndStr();
  const pending  = tasks.filter(t => t.status !== 'done' && t.status !== 'snoozed');
  const groups: [string, string, Task[]][] = [
    ['Przeterminowane', colors.accent.red,    pending.filter(t => { const d = t.deadline?.split('T')[0]; return d && d < today; })],
    ['Dzisiaj',         colors.accent.purple, pending.filter(t => t.deadline?.startsWith(today))],
    ['Jutro',           colors.accent.blue,   pending.filter(t => t.deadline?.startsWith(tomorrow))],
    ['Ten tydzień',     colors.text.secondary, pending.filter(t => { const d = t.deadline?.split('T')[0]; return d && d > tomorrow && d <= weekEnd; })],
    ['Późniejsze',      colors.text.muted,    pending.filter(t => { const d = t.deadline?.split('T')[0]; return d && d > weekEnd; })],
    ['Bez terminu',     colors.text.muted,    pending.filter(t => !t.deadline)],
  ];
  return groups.filter(([,, data]) => data.length > 0).map(([title, accent, data]) => ({ title, accent, data: [...data].sort(byPriority) }));
}

// ─── Difficulty indicator ──────────────────────────────────────────────────────

function DiffBar({ level }: { level?: TaskDifficulty }) {
  if (!level) return null;
  const col = level <= 2 ? colors.accent.green : level === 3 ? colors.accent.amber : colors.accent.red;
  return (
    <View style={db.wrap}>
      {[1,2,3,4,5].map(i => (
        <View key={i} style={[db.seg, { backgroundColor: i <= level ? col : 'rgba(255,255,255,0.08)' }]} />
      ))}
    </View>
  );
}
const db = StyleSheet.create({
  wrap: { flexDirection: 'row', gap: 2, alignItems: 'center' },
  seg: { width: 8, height: 3, borderRadius: 2 },
});

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({ task, index, onToggle, onLongPress, onPomodoro, onSnooze }: {
  task: Task; index: number;
  onToggle: (id: string) => void;
  onLongPress: (id: string) => void;
  onPomodoro: (task: Task) => void;
  onSnooze: (task: Task) => void;
}) {
  const done     = task.status === 'done';
  const snoozed  = task.status === 'snoozed';
  const urgent   = task.priority === 'high' && !done && !snoozed;
  const overdue  = !done && !snoozed && (task.deadline?.split('T')[0] ?? '') < todayStr();
  const accentColor = snoozed ? colors.accent.amber : urgent ? colors.accent.red : overdue ? colors.accent.red : colors.accent.purple;

  return (
    <View style={styles.cardWrap}>
      <TouchableOpacity
        activeOpacity={0.8}
        onPress={() => router.push(`/tasks/${task.id}` as any)}
        onLongPress={() => onLongPress(task.id)}
        style={[styles.taskCard, done && styles.taskCardDone]}
      >
        {/* Left accent bar */}
        <View style={[styles.accentBar, { backgroundColor: done ? colors.text.muted : accentColor }]} />

        {/* Checkbox */}
        <TouchableOpacity onPress={() => onToggle(task.id)} style={styles.checkWrap} hitSlop={8}>
          {done
            ? <CheckCircle2 size={20} color={colors.accent.green} />
            : <Circle size={20} color={urgent ? colors.accent.red : 'rgba(255,255,255,0.18)'} strokeWidth={1.5} />
          }
        </TouchableOpacity>

        {/* Content */}
        <View style={styles.taskContent}>
          <Text style={[styles.taskTitle, done && styles.taskTitleDone]} numberOfLines={2}>
            {task.title}
          </Text>

          <View style={styles.taskMeta}>
            {task.deadline && (
              <View style={[styles.chip,
                overdue && { backgroundColor: colors.accent.red + '18', borderColor: colors.accent.red + '40' }
              ]}>
                <Clock size={9} color={overdue ? colors.accent.red : colors.text.muted} />
                <Text style={[styles.chipText, overdue && { color: colors.accent.red }]}>
                  {fmtDl(task.deadline)}
                </Text>
              </View>
            )}
            {urgent && (
              <View style={[styles.chip, { backgroundColor: colors.accent.red + '18', borderColor: colors.accent.red + '30' }]}>
                <Flame size={9} color={colors.accent.red} />
                <Text style={[styles.chipText, { color: colors.accent.red }]}>pilne</Text>
              </View>
            )}
            {task.estimatedPomodoros != null && task.estimatedPomodoros > 0 && (
              <View style={[styles.chip, { backgroundColor: colors.accent.purple + '18', borderColor: colors.accent.purple + '30' }]}>
                <Timer size={9} color={colors.accent.purple} />
                <Text style={[styles.chipText, { color: colors.accent.purple }]}>
                  {task.estimatedPomodoros}×25m
                </Text>
              </View>
            )}
            {snoozed && task.snoozedUntil && (
              <View style={[styles.chip, { backgroundColor: colors.accent.amber + '18', borderColor: colors.accent.amber + '30' }]}>
                <BellOff size={9} color={colors.accent.amber} />
                <Text style={[styles.chipText, { color: colors.accent.amber }]}>
                  {fmtSnooze(task.snoozedUntil)}
                </Text>
              </View>
            )}
            {task.recurring && task.recurring !== 'none' && (
              <View style={[styles.chip, { backgroundColor: colors.accent.blue + '18', borderColor: colors.accent.blue + '30' }]}>
                <RefreshCw size={9} color={colors.accent.blue} />
                <Text style={[styles.chipText, { color: colors.accent.blue }]}>
                  {{ daily: 'codziennie', weekly: 'tyg.', monthly: 'mies.' }[task.recurring]}
                </Text>
              </View>
            )}
            {task.subtasks && task.subtasks.length > 0 && (() => {
              const total = task.subtasks.length;
              const doneCount = task.subtasks.filter(s => s.done).length;
              const allDone = doneCount === total;
              const col = allDone ? colors.accent.green : colors.accent.blue;
              return (
                <View style={[styles.chip, { backgroundColor: col + '18', borderColor: col + '30' }]}>
                  <CheckSquare size={9} color={col} />
                  <Text style={[styles.chipText, { color: col }]}>{doneCount}/{total}</Text>
                </View>
              );
            })()}
            {task.tags?.slice(0, 2).map(t => (
              <Text key={t} style={styles.tagText}>#{t}</Text>
            ))}
            <DiffBar level={task.difficulty} />
          </View>
        </View>

        {/* Action buttons */}
        <View style={styles.cardActions}>
          {!done && !snoozed && (
            <TouchableOpacity onPress={() => onSnooze(task)} style={styles.snoozeBtn} hitSlop={8}>
              <AlarmClock size={15} color={colors.accent.amber} />
            </TouchableOpacity>
          )}
          {!done && !snoozed && task.estimatedPomodoros! > 0 && (
            <TouchableOpacity onPress={() => onPomodoro(task)} style={styles.pomBtn} hitSlop={8}>
              <Timer size={16} color={colors.accent.purple} />
            </TouchableOpacity>
          )}
        </View>
      </TouchableOpacity>
    </View>
  );
}

// ─── Swipeable wrapper ────────────────────────────────────────────────────────

function SwipeableTaskCard(props: {
  task: Task; index: number;
  onToggle: (id: string) => void;
  onLongPress: (id: string) => void;
  onPomodoro: (task: Task) => void;
  onSnooze: (task: Task) => void;
  onDelete: (id: string) => void;
}) {
  const { task, onToggle, onSnooze, onDelete } = props;
  const swipeRef = useRef<Swipeable>(null);

  const isDone    = task.status === 'done';
  const isSnoozed = task.status === 'snoozed';

  if (isDone || isSnoozed) {
    return <TaskCard {...props} />;
  }

  const LeftAction = (_: any, dragX: Animated.AnimatedInterpolation<number>) => {
    const scale = dragX.interpolate({ inputRange: [0, 80], outputRange: [0.6, 1], extrapolate: 'clamp' });
    return (
      <View style={sw.leftWrap}>
        <Animated.View style={[sw.leftInner, { transform: [{ scale }] }]}>
          <CheckCircle2 size={22} color={colors.bg.primary} strokeWidth={2.5} />
          <Text style={sw.leftLabel}>Gotowe</Text>
        </Animated.View>
      </View>
    );
  };

  const RightActions = () => (
    <View style={sw.rightWrap}>
      <TouchableOpacity
        style={sw.snoozeAction}
        activeOpacity={0.8}
        onPress={() => { swipeRef.current?.close(); onSnooze(task); }}
      >
        <AlarmClock size={18} color={colors.bg.primary} />
        <Text style={sw.rightLabel}>Odłóż</Text>
      </TouchableOpacity>
      <TouchableOpacity
        style={sw.deleteAction}
        activeOpacity={0.8}
        onPress={() => { swipeRef.current?.close(); onDelete(task.id); }}
      >
        <Trash2 size={18} color={colors.bg.primary} />
      </TouchableOpacity>
    </View>
  );

  return (
    <Swipeable
      ref={swipeRef}
      friction={2}
      leftThreshold={72}
      rightThreshold={40}
      overshootLeft={false}
      renderLeftActions={LeftAction}
      renderRightActions={RightActions}
      onSwipeableLeftOpen={() => {
        onToggle(task.id);
        setTimeout(() => swipeRef.current?.close(), 300);
      }}
    >
      <TaskCard {...props} />
    </Swipeable>
  );
}

const sw = StyleSheet.create({
  leftWrap: {
    width: 88, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.accent.green,
    borderRadius: radius.lg,
  },
  leftInner: { alignItems: 'center', gap: 4 },
  leftLabel: { fontSize: 10, fontWeight: '700', color: colors.bg.primary },

  rightWrap: {
    flexDirection: 'row',
  },
  snoozeAction: {
    width: 68, justifyContent: 'center', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent.amber,
    borderTopLeftRadius: radius.lg, borderBottomLeftRadius: radius.lg,
  },
  deleteAction: {
    width: 56, justifyContent: 'center', alignItems: 'center',
    backgroundColor: colors.accent.red,
    borderTopRightRadius: radius.lg, borderBottomRightRadius: radius.lg,
  },
  rightLabel: { fontSize: 10, fontWeight: '700', color: colors.bg.primary },
});

// ─── Section header ───────────────────────────────────────────────────────────

function SectionHeader({ title, count, accent }: { title: string; count: number; accent: string }) {
  return (
    <View style={sh.row}>
      <View style={[sh.pill, { backgroundColor: accent + '18', borderColor: accent + '35' }]}>
        <Text style={[sh.title, { color: accent }]}>{title}</Text>
      </View>
      <View style={sh.line} />
      <Text style={sh.count}>{count}</Text>
    </View>
  );
}
const sh = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[3] },
  pill: { paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  title: { fontSize: 10, fontWeight: '700', letterSpacing: 0.8, textTransform: 'uppercase' },
  line: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  count: { fontSize: 11, color: colors.text.muted, fontWeight: '600' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const { tasks, isLoading, reload, toggle, remove, update, snooze, unsnooze } = useTasks();
  const startPomodoro = usePomodoroStore(s => s.startFor);
  const [filter, setFilter]         = useState<FilterKey>('all');
  const [moodModal, setMoodModal]   = useState(false);
  const [completedTask, setCompletedTask] = useState<Task | null>(null);
  const [snoozeTask, setSnoozeTask] = useState<Task | null>(null);
  const [rescueOpen, setRescueOpen] = useState(false);
  const [showSearch, setShowSearch] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  const today   = todayStr();
  const weekEnd = weekEndStr();

  const sections     = useMemo(() => buildSections(tasks), [tasks]);
  const snoozedTasks = useMemo(() => tasks.filter(t => t.status === 'snoozed'), [tasks]);
  const pending      = tasks.filter(t => t.status !== 'done' && t.status !== 'snoozed').length;
  const overdueTasks = useMemo(() =>
    tasks.filter(t => {
      const d = t.deadline?.split('T')[0];
      return t.status !== 'done' && t.status !== 'snoozed' && d && d < today;
    }),
    [tasks, today]);

  const filtered = useMemo(() => {
    switch (filter) {
      case 'today':
        return tasks.filter(t => t.status !== 'done' && t.status !== 'snoozed' &&
          (t.deadline?.startsWith(today) || t.scheduledDate === today));
      case 'week':
        return tasks.filter(t => t.status !== 'done' && t.status !== 'snoozed' && t.deadline != null &&
          t.deadline.split('T')[0] >= today && t.deadline.split('T')[0] <= weekEnd);
      case 'done':
        return tasks.filter(t => t.status === 'done').slice(0, 50);
      case 'snoozed':
        return [...snoozedTasks].sort((a, b) =>
          (a.snoozedUntil ?? '').localeCompare(b.snoozedUntil ?? ''));
      default:
        return [];
    }
  }, [tasks, filter, today, weekEnd, snoozedTasks]);

  const [selectedTag, setSelectedTag] = useState<string | null>(null);
  const allTags = useMemo(() => {
    const set = new Set<string>();
    tasks.forEach(t => t.tags?.forEach(tag => set.add(tag)));
    return Array.from(set).sort();
  }, [tasks]);

  const handleToggle = (id: string) => {
    const t = tasks.find(x => x.id === id);
    toggle(id);
    if (t && t.status !== 'done') {
      setCompletedTask(t);
      setMoodModal(true);
    }
  };

  const handleLongPress = (id: string) => {
    const t = tasks.find(x => x.id === id);
    const isSnoozed = t?.status === 'snoozed';
    const btns: any[] = [
      { text: 'Anuluj', style: 'cancel' },
    ];
    if (!isSnoozed) {
      btns.push({ text: 'Odłóż', onPress: () => { const found = tasks.find(x => x.id === id); if (found) setSnoozeTask(found); } });
    } else {
      btns.push({ text: 'Wznów teraz', onPress: () => { unsnooze(id); toast.success('Zadanie wznowione'); } });
    }
    btns.push({ text: 'Usuń', style: 'destructive', onPress: () => { remove(id); toast.info('Usunięto'); } });
    Alert.alert(t?.title ?? 'Zadanie', undefined, btns);
  };

  const handleSnooze = (task: Task) => setSnoozeTask(task);

  const handleSnoozeSelect = (until: Date) => {
    if (!snoozeTask) return;
    snooze(snoozeTask.id, until);
    setSnoozeTask(null);
    toast.info(`Odłożono do ${fmtSnooze(until.toISOString())}`);
  };

  const handlePomodoro = (task: Task) => {
    startPomodoro(task.id, task.title);
    router.push('/pomodoro' as any);
    toast.info(`Timer: ${task.title}`);
  };

  const handleDelete = (id: string) => {
    remove(id);
    toast.info('Usunięto');
  };

  const rescheduleOverdue = (id: string, daysAhead: number) => {
    const d = new Date();
    d.setDate(d.getDate() + daysAhead);
    const pad2 = (n: number) => String(n).padStart(2, '0');
    const newDeadline = `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}T23:59:00.000Z`;
    update(id, { deadline: newDeadline });
  };

  const renderItem = ({ item, index }: { item: Task; index: number }) => (
    <SwipeableTaskCard
      task={item}
      index={index}
      onToggle={handleToggle}
      onLongPress={handleLongPress}
      onPomodoro={handlePomodoro}
      onSnooze={handleSnooze}
      onDelete={handleDelete}
    />
  );

  const applyTagFilter = (list: Task[]) =>
    selectedTag ? list.filter(t => t.tags?.includes(selectedTag)) : list;

  const applySearch = (list: Task[]) => {
    const q = searchQuery.trim().toLowerCase();
    if (!q) return list;
    return list.filter(t =>
      t.title.toLowerCase().includes(q) ||
      t.description?.toLowerCase().includes(q) ||
      t.tags?.some(tag => tag.toLowerCase().includes(q))
    );
  };

  const tagFilteredSections: Section[] = sections.map(s => ({
    ...s, data: applySearch(applyTagFilter(s.data)),
  })).filter(s => s.data.length > 0);

  // For non-'all' filters, flat list wrapped in one section
  const displaySections: Section[] = filter === 'all'
    ? tagFilteredSections
    : [{ title: '', accent: '', data: applySearch(applyTagFilter(filtered)) }];

  const handleMoodSelect = async (mood: MoodLevel) => {
    setMoodModal(false);
    if (completedTask) {
      await update(completedTask.id, { postCompletionMood: mood });
      toast.success('Nastrój zapisany');
    }
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top']}>
      {/* Header */}
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Zadania</Text>
          <Text style={styles.subtitle}>
            {pending > 0 ? `${pending} aktywnych` : 'Wszystko ukończone'}
            {snoozedTasks.length > 0 ? ` · ${snoozedTasks.length} odłożonych` : ''}
          </Text>
        </View>
        <View style={styles.headerBtns}>
          <PressableScale onPress={() => router.push('/focus' as any)} style={styles.searchBtn}>
            <Target size={16} color={colors.accent.purple} />
          </PressableScale>
          <PressableScale onPress={() => router.push('/weekly' as any)} style={styles.searchBtn}>
            <BarChart2 size={16} color={colors.text.muted} />
          </PressableScale>
          <PressableScale
            onPress={() => { setShowSearch(v => !v); if (showSearch) setSearchQuery(''); }}
            style={[styles.searchBtn, showSearch && styles.searchBtnActive]}
          >
            <Search size={18} color={showSearch ? colors.accent.purple : colors.text.muted} />
          </PressableScale>
        </View>
      </View>

      {/* Search bar */}
      {showSearch && (
        <View style={styles.searchBarWrap}>
          <Search size={14} color={colors.text.muted} />
          <TextInput
            autoFocus
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholder="Szukaj zadań, tagów..."
            placeholderTextColor={colors.text.muted}
            style={styles.searchInput}
            returnKeyType="search"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')} hitSlop={8}>
              <XIcon size={14} color={colors.text.muted} />
            </TouchableOpacity>
          )}
        </View>
      )}

      {/* Filter bar */}
      <View style={styles.filterWrap}>
        {FILTERS.map(({ key, label }) => {
          const active = filter === key;
          return (
            <PressableScale key={key} onPress={() => setFilter(key)}>
              <View style={[styles.filterPill, active && styles.filterPillActive]}>
                <Text style={[styles.filterText, active && styles.filterTextActive]}>{label}</Text>
              </View>
            </PressableScale>
          );
        })}
      </View>

      {/* Overdue rescue banner */}
      {overdueTasks.length > 0 && filter === 'all' && (
        <TouchableOpacity
          style={styles.overdueBanner}
          onPress={() => setRescueOpen(true)}
          activeOpacity={0.8}
        >
          <CalendarClock size={14} color={colors.bg.primary} />
          <Text style={styles.overdueBannerText}>
            {overdueTasks.length} przeterminowanych — naciśnij aby wyczyścić
          </Text>
        </TouchableOpacity>
      )}

      {/* Tag filter strip */}
      {allTags.length > 0 && (
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.tagStrip}
        >
          {selectedTag && (
            <PressableScale onPress={() => setSelectedTag(null)}>
              <View style={[styles.tagPill, styles.tagPillClear]}>
                <Text style={styles.tagPillClearText}>✕ wyczyść</Text>
              </View>
            </PressableScale>
          )}
          {allTags.map(tag => {
            const active = selectedTag === tag;
            return (
              <PressableScale key={tag} onPress={() => setSelectedTag(active ? null : tag)}>
                <View style={[styles.tagPill, active && styles.tagPillActive]}>
                  <Text style={[styles.tagPillText, active && styles.tagPillTextActive]}>#{tag}</Text>
                </View>
              </PressableScale>
            );
          })}
        </ScrollView>
      )}

      <SectionList
        sections={displaySections}
        keyExtractor={item => item.id}
        renderItem={renderItem}
        renderSectionHeader={({ section }) =>
          section.title ? (
            <SectionHeader title={section.title} count={section.data.length} accent={section.accent} />
          ) : null
        }
        refreshControl={
          <RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={colors.text.muted} />
        }
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        ListEmptyComponent={
          <View style={styles.empty}>
            <Text style={styles.emptyTitle}>
              {filter === 'done' ? 'Brak ukończonych' : filter === 'snoozed' ? 'Brak odłożonych' : 'Brak zadań'}
            </Text>
            <Text style={styles.emptySub}>
              {filter === 'done'
                ? 'Zaznacz zadania jako ukończone'
                : filter === 'snoozed'
                ? 'Odłóż zadanie, żeby schować je tymczasowo'
                : 'Naciśnij + żeby dodać pierwsze zadanie'}
            </Text>
          </View>
        }
      />

      {/* FAB */}
      <View style={styles.fab}>
        <AnimatedButton
          onPress={() => router.push('/tasks/add' as any)}
          label="Nowe zadanie"
          icon={<Plus size={17} color={colors.bg.primary} />}
          size="lg"
          fullWidth
        />
      </View>

      <CompletionMoodModal
        visible={moodModal}
        taskTitle={completedTask?.title ?? ''}
        onSelect={handleMoodSelect}
        onDismiss={() => setMoodModal(false)}
      />

      {/* Snooze picker */}
      {snoozeTask && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setSnoozeTask(null)}>
          <Pressable style={sn.overlay} onPress={() => setSnoozeTask(null)} />
          <View style={sn.sheet}>
            <View style={sn.handle} />
            <Text style={sn.heading}>Odłóż zadanie</Text>
            <Text style={sn.sub} numberOfLines={1}>{snoozeTask.title}</Text>
            {buildSnoozeOptions().map(opt => (
              <TouchableOpacity
                key={opt.label}
                style={sn.optionRow}
                onPress={() => handleSnoozeSelect(opt.date)}
                activeOpacity={0.75}
              >
                <AlarmClock size={16} color={colors.accent.amber} />
                <Text style={sn.optionLabel}>{opt.label}</Text>
                <Text style={sn.optionTime}>
                  {opt.date.toLocaleTimeString('pl-PL', { hour: '2-digit', minute: '2-digit' })}
                </Text>
              </TouchableOpacity>
            ))}
          </View>
        </Modal>
      )}
      {/* Overdue rescue modal */}
      {rescueOpen && (
        <Modal visible transparent animationType="slide" onRequestClose={() => setRescueOpen(false)}>
          <Pressable style={sn.overlay} onPress={() => setRescueOpen(false)} />
          <View style={sn.sheet}>
            <View style={sn.handle} />
            <View style={rs.header}>
              <CalendarClock size={16} color={colors.accent.red} />
              <Text style={rs.heading}>Przeterminowane</Text>
              <Text style={rs.count}>{overdueTasks.length}</Text>
            </View>
            <ScrollView showsVerticalScrollIndicator={false} style={{ maxHeight: 420 }}>
              {overdueTasks.map(task => (
                <View key={task.id} style={rs.row}>
                  <Text style={rs.taskTitle} numberOfLines={1}>{task.title}</Text>
                  {task.deadline && (
                    <Text style={rs.taskDate}>{task.deadline.split('T')[0]}</Text>
                  )}
                  <View style={rs.actions}>
                    <TouchableOpacity
                      style={[rs.btn, { backgroundColor: colors.accent.purple + '20', borderColor: colors.accent.purple + '40' }]}
                      onPress={() => rescheduleOverdue(task.id, 0)}
                      activeOpacity={0.75}
                    >
                      <Text style={[rs.btnText, { color: colors.accent.purple }]}>Dziś</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[rs.btn, { backgroundColor: colors.accent.blue + '20', borderColor: colors.accent.blue + '40' }]}
                      onPress={() => rescheduleOverdue(task.id, 1)}
                      activeOpacity={0.75}
                    >
                      <Text style={[rs.btnText, { color: colors.accent.blue }]}>Jutro</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[rs.btn, { backgroundColor: colors.accent.amber + '20', borderColor: colors.accent.amber + '40' }]}
                      onPress={() => rescheduleOverdue(task.id, 7)}
                      activeOpacity={0.75}
                    >
                      <Text style={[rs.btnText, { color: colors.accent.amber }]}>+7 dni</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[rs.btn, { backgroundColor: colors.accent.red + '18', borderColor: colors.accent.red + '30' }]}
                      onPress={() => { remove(task.id); toast.info('Usunięto'); }}
                      activeOpacity={0.75}
                    >
                      <Trash2 size={12} color={colors.accent.red} />
                    </TouchableOpacity>
                  </View>
                </View>
              ))}
            </ScrollView>
            {overdueTasks.length === 0 && (
              <View style={rs.done}>
                <CheckCircle2 size={28} color={colors.accent.green} />
                <Text style={rs.doneText}>Wszystko ogarnięte!</Text>
              </View>
            )}
            <TouchableOpacity
              style={rs.closeBtn}
              onPress={() => setRescueOpen(false)}
              activeOpacity={0.8}
            >
              <Text style={rs.closeBtnText}>Zamknij</Text>
            </TouchableOpacity>
          </View>
        </Modal>
      )}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'flex-end',
    justifyContent: 'space-between',
    paddingHorizontal: spacing[4],
    paddingTop: spacing[4],
    paddingBottom: spacing[2],
  },
  title: { fontSize: 28, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: colors.text.muted, marginTop: 3 },
  headerBtns: { flexDirection: 'row', gap: spacing[2] },
  searchBtn: {
    width: 38, height: 38, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1,
    borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  searchBtnActive: {
    backgroundColor: colors.accent.purple + '18',
    borderColor: colors.accent.purple + '40',
  },
  searchBarWrap: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.accent.purple + '40',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  searchInput: {
    flex: 1, fontSize: 14, color: colors.text.primary,
    paddingVertical: 4,
  },

  filterWrap: {
    flexDirection: 'row', gap: spacing[2],
    paddingHorizontal: spacing[4], paddingBottom: spacing[3],
  },
  filterPill: {
    paddingHorizontal: spacing[4], paddingVertical: 8,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: colors.border.default,
    backgroundColor: colors.bg.card,
  },
  filterPillActive: {
    backgroundColor: colors.text.primary,
    borderColor: colors.text.primary,
  },
  filterText: { fontSize: 12, fontWeight: '500', color: colors.text.secondary },
  filterTextActive: { color: colors.text.inverse },

  list: { paddingHorizontal: spacing[4], paddingBottom: 120 },

  cardWrap: { marginBottom: spacing[2] }, // used by done/snoozed cards (no Swipeable wrapper)
  taskCard: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.card,
    borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default,
    minHeight: 60, overflow: 'hidden',
  },
  taskCardDone: { opacity: 0.35 },
  accentBar: { width: 3, alignSelf: 'stretch', marginRight: spacing[3] },
  checkWrap: { marginRight: spacing[2] },
  taskContent: { flex: 1, paddingVertical: spacing[3], paddingRight: spacing[3], gap: 6 },
  taskTitle: { fontSize: 14, fontWeight: '500', color: colors.text.primary, lineHeight: 19 },
  taskTitleDone: { textDecorationLine: 'line-through', color: colors.text.secondary },
  taskMeta: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: spacing[2] },

  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: 6, paddingVertical: 3, borderRadius: 5,
  },
  chipText: { fontSize: 10, color: colors.text.muted, fontWeight: '500' },
  tagText: { fontSize: 10, color: colors.text.muted },
  cardActions: { flexDirection: 'row', alignItems: 'center', gap: 2 },
  snoozeBtn: { paddingHorizontal: spacing[2], paddingVertical: spacing[2] },
  pomBtn: { paddingHorizontal: spacing[2], paddingVertical: spacing[2] },

  tagStrip: { paddingHorizontal: spacing[4], paddingBottom: spacing[2], gap: spacing[2], flexDirection: 'row' },
  tagPill: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  tagPillActive: {
    backgroundColor: colors.accent.blue + '25',
    borderColor: colors.accent.blue + '60',
  },
  tagPillText: { fontSize: 11, color: colors.text.muted, fontWeight: '500' },
  tagPillTextActive: { color: colors.accent.blue, fontWeight: '700' },
  tagPillClear: { backgroundColor: 'rgba(255,255,255,0.07)', borderColor: 'rgba(255,255,255,0.15)' },
  tagPillClearText: { fontSize: 11, color: colors.text.secondary, fontWeight: '600' },

  fab: { position: 'absolute', bottom: spacing[6], left: spacing[4], right: spacing[4] },

  overdueBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.accent.red,
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    borderRadius: radius.lg,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  overdueBannerText: { fontSize: 12, fontWeight: '700', color: colors.bg.primary, flex: 1 },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing[3] },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.secondary },
  emptySub: { fontSize: 13, color: colors.text.muted, textAlign: 'center', lineHeight: 20 },
});

const sn = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing[5], paddingBottom: spacing[8], gap: spacing[1],
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border.default,
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.12)',
    alignSelf: 'center', marginBottom: spacing[3],
  },
  heading: { fontSize: 17, fontWeight: '800', color: colors.text.primary, marginBottom: 2 },
  sub: { fontSize: 12, color: colors.text.muted, marginBottom: spacing[3] },
  optionRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  optionLabel: { flex: 1, fontSize: 15, color: colors.text.primary, fontWeight: '500' },
  optionTime: { fontSize: 12, color: colors.text.muted },
});

const rs = StyleSheet.create({
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  heading: { fontSize: 17, fontWeight: '800', color: colors.text.primary, flex: 1 },
  count: {
    fontSize: 13, fontWeight: '700', color: colors.accent.red,
    backgroundColor: colors.accent.red + '18',
    paddingHorizontal: 8, paddingVertical: 2, borderRadius: radius.full,
  },
  row: {
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
    gap: spacing[2],
  },
  taskTitle: { fontSize: 14, fontWeight: '600', color: colors.text.primary },
  taskDate: { fontSize: 11, color: colors.accent.red, fontWeight: '500' },
  actions: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  btn: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.md, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
    minWidth: 52,
  },
  btnText: { fontSize: 12, fontWeight: '700' },
  done: { alignItems: 'center', paddingVertical: spacing[6], gap: spacing[2] },
  doneText: { fontSize: 16, fontWeight: '700', color: colors.accent.green },
  closeBtn: {
    marginTop: spacing[3],
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderRadius: radius.full, paddingVertical: spacing[3],
    alignItems: 'center',
  },
  closeBtnText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
});

