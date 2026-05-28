import { useState, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, FlatList, TouchableOpacity,
  Modal, Pressable, TextInput, KeyboardAvoidingView,
  Platform, ScrollView, Animated, RefreshControl,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Check, Pencil, Plus, SlidersHorizontal,
  ChevronRight, Trash2, X,
  Square, CheckSquare2, Clock, ArrowRight, Timer, RefreshCw,
} from 'lucide-react-native';
import ReanimatedSwipeable, { SwipeableMethods } from 'react-native-gesture-handler/ReanimatedSwipeable';
import TopPill from '@/components/ui/TopPill';

import { useTasks } from '@/hooks/useTasks';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { Task } from '@/types';
import { colors, spacing, radius } from '@/theme';
import { useTabSwipe } from '@/hooks/useTabSwipe';
import { notificationsService } from '@/services/notificationsService';

// ─── Colors ───────────────────────────────────────────────────────────────────

const G = {
  card:       '#0D2318',
  cardBorder: 'rgba(61,190,117,0.18)',
  accent:     '#3DBE75',
  accentDim:  'rgba(61,190,117,0.22)',
  accentText: '#3DBE75',
  overdueCard:'#1A0A0A',
  overdueBorder:'rgba(255,107,107,0.25)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function daysUntil(iso: string): number {
  const today = new Date(); today.setHours(0, 0, 0, 0);
  const target = new Date(iso.split('T')[0] + 'T00:00:00');
  return Math.ceil((target.getTime() - today.getTime()) / 86_400_000);
}
const DAY_PL = ['Niedziela','Poniedziałek','Wtorek','Środa','Czwartek','Piątek','Sobota'];

function deadlineLabel(iso: string): string {
  const d = daysUntil(iso);
  if (d < 0)  return 'PRZETERMINOWANE';
  if (d === 0) return 'NA DZIŚ';
  if (d === 1) return 'NA JUTRO';
  if (d <= 6) {
    const wd = new Date(iso.split('T')[0] + 'T12:00:00').getDay();
    return `NA ${DAY_PL[wd].toUpperCase()}`;
  }
  const [, m, day] = iso.split('T')[0].split('-');
  return `${parseInt(day)}.${parseInt(m)}`;
}

function taskSubtitle(task: Task, pomodoroTaskId?: string): string {
  if (task.status === 'snoozed') {
    if (task.snoozedUntil) {
      const d = new Date(task.snoozedUntil);
      return `ODŁOŻONE DO ${d.getHours()}:${pad(d.getMinutes())}`;
    }
    return 'ODŁOŻONE';
  }
  if (task.id === pomodoroTaskId) return 'AKTUALNIE W TOKU';
  if (task.deadline) return `ZAPLANOWANE ${deadlineLabel(task.deadline)}`;
  if (task.scheduledDate) return `ZAPLANOWANE ${deadlineLabel(task.scheduledDate)}`;
  return 'BEZ TERMINU';
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortKey   = 'deadline' | 'priority' | 'created' | 'alpha';
type FilterKey = 'all' | 'urgent' | 'today' | 'snoozed' | 'quick';

const SORT_OPTIONS: { key: SortKey; label: string; sub: string }[] = [
  { key: 'deadline',  label: 'Termin',     sub: 'Najpilniejsze pierwsze' },
  { key: 'priority',  label: 'Priorytet',  sub: 'Wysokie → niskie' },
  { key: 'created',   label: 'Dodane',     sub: 'Najnowsze pierwsze' },
  { key: 'alpha',     label: 'Alfabet',    sub: 'A → Z' },
];

const PRIORITY_ORDER: Record<string, number> = { high: 0, normal: 1, low: 2 };

function sortTasks(tasks: Task[], sort: SortKey): Task[] {
  const today = todayStr();
  return [...tasks].sort((a, b) => {
    if (sort === 'deadline') {
      // Overdue first, then by nearest deadline, no deadline last
      const aD = a.deadline?.split('T')[0];
      const bD = b.deadline?.split('T')[0];
      const aOver = aD && aD < today ? -1 : 0;
      const bOver = bD && bD < today ? -1 : 0;
      if (aOver !== bOver) return aOver - bOver;
      if (!aD && !bD) return 0;
      if (!aD) return 1;
      if (!bD) return -1;
      return aD.localeCompare(bD);
    }
    if (sort === 'priority') {
      const pDiff = (PRIORITY_ORDER[a.priority] ?? 1) - (PRIORITY_ORDER[b.priority] ?? 1);
      if (pDiff !== 0) return pDiff;
      return (a.deadline ?? 'z').localeCompare(b.deadline ?? 'z');
    }
    if (sort === 'created') return b.createdAt.localeCompare(a.createdAt);
    return a.title.localeCompare(b.title);
  });
}

// ─── Deadline grouping ────────────────────────────────────────────────────────

type SectionHeader = { type: 'section'; key: string; label: string; color: string; count: number };
type ListItem = Task | SectionHeader | 'done-header';

const SECTION_DEFS = [
  { key: 'overdue',  label: 'PRZETERMINOWANE', color: '#FF6B6B' },
  { key: 'today',    label: 'DZIŚ',             color: '#FBBF24' },
  { key: 'tomorrow', label: 'JUTRO',            color: '#F97316' },
  { key: 'week',     label: 'W TYM TYGODNIU',   color: G.accent  },
  { key: 'later',    label: 'PÓŹNIEJ',           color: colors.text.muted },
  { key: 'none',     label: 'BEZ TERMINU',       color: colors.text.muted },
] as const;

function taskSection(task: Task, today: string, tomorrow: string, weekEnd: string): typeof SECTION_DEFS[number]['key'] {
  const d = task.deadline?.split('T')[0];
  const s = task.scheduledDate;
  // Overdue deadline
  if (d && d < today) return 'overdue';
  // Today by deadline or scheduledDate
  if (d === today || s === today) return 'today';
  // Tomorrow by deadline or scheduledDate
  if (d === tomorrow || (!d && s === tomorrow)) return 'tomorrow';
  // This week
  if ((d && d <= weekEnd) || (!d && s && s <= weekEnd)) return 'week';
  // Later
  if (d || s) return 'later';
  return 'none';
}

function buildGroupedList(sorted: Task[], done: Task[], today: string): ListItem[] {
  const tomorrow = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + 1); return d.toISOString().split('T')[0]; })();
  const weekEnd  = (() => { const d = new Date(today + 'T00:00:00'); d.setDate(d.getDate() + 7); return d.toISOString().split('T')[0]; })();

  const buckets: Record<string, Task[]> = { overdue: [], today: [], tomorrow: [], week: [], later: [], none: [] };
  for (const t of sorted) {
    buckets[taskSection(t, today, tomorrow, weekEnd)].push(t);
  }

  const result: ListItem[] = [];
  for (const def of SECTION_DEFS) {
    const tasks = buckets[def.key];
    if (tasks.length === 0) continue;
    result.push({ type: 'section', key: def.key, label: def.label, color: def.color, count: tasks.length });
    result.push(...tasks);
  }
  if (done.length > 0) {
    result.push('done-header');
    result.push(...done);
  }
  return result;
}

// ─── Task card ────────────────────────────────────────────────────────────────

function TaskCard({ task, pomodoroTaskId, onComplete, onEdit }: {
  task: Task;
  pomodoroTaskId?: string;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
}) {
  const overdue  = task.status !== 'done' && task.status !== 'snoozed' &&
    !!task.deadline && task.deadline.split('T')[0] < todayStr();
  const urgent   = task.priority === 'high';
  const snoozed  = task.status === 'snoozed';
  const isDone   = task.status === 'done';
  const subtitle = taskSubtitle(task, pomodoroTaskId);
  const dueDays  = (!overdue && !snoozed && !isDone && task.deadline) ? daysUntil(task.deadline) : null;
  const isToday    = dueDays === 0;
  const isTomorrow = dueDays === 1;

  const cardBg     = overdue ? G.overdueCard : G.card;
  const cardBorder = overdue ? G.overdueBorder : isToday ? 'rgba(251,191,36,0.25)' : G.cardBorder;
  const subColor   = subtitle === 'AKTUALNIE W TOKU' ? G.accent
    : overdue   ? colors.accent.red
    : snoozed   ? colors.accent.amber
    : isToday   ? colors.accent.amber
    : isTomorrow ? '#F97316'
    : colors.text.muted;

  return (
    <TouchableOpacity
      style={[s.card, { backgroundColor: cardBg, borderColor: cardBorder }, isDone && s.cardDone]}
      onPress={() => onEdit(task)}
      activeOpacity={0.75}
    >
      {/* Action pill */}
      <View style={[s.actionPill, overdue && { borderColor: colors.accent.red + '40' }]}>
        <TouchableOpacity
          style={s.actionHalf}
          onPress={() => onComplete(task)}
          hitSlop={6}
          activeOpacity={0.7}
        >
          <Check size={14} color={isDone ? G.accent : colors.text.secondary} strokeWidth={2.5} />
        </TouchableOpacity>
        <View style={s.actionDivider} />
        <TouchableOpacity
          style={s.actionHalf}
          onPress={() => onEdit(task)}
          hitSlop={6}
          activeOpacity={0.7}
        >
          <Pencil size={13} color={colors.text.secondary} strokeWidth={2} />
        </TouchableOpacity>
      </View>

      {/* Content */}
      <View style={s.cardContent}>
        <Text
          style={[s.cardTitle, isDone && s.cardTitleDone, urgent && !isDone && { color: colors.accent.red }]}
          numberOfLines={2}
        >
          {task.title.toUpperCase()}
        </Text>
        <Text style={[s.cardSub, { color: subColor }]}>{subtitle}</Text>
        <View style={s.cardMeta}>
          {task.subtasks && task.subtasks.length > 0 && (() => {
            const done = task.subtasks.filter(st => st.done).length;
            return (
              <Text style={s.cardMilestones}>{done}/{task.subtasks.length} kamieni</Text>
            );
          })()}
          {!!task.estimatedPomodoros && task.estimatedPomodoros > 0 && (
            <View style={s.pomoPill}>
              <Timer size={9} color={isDone ? colors.text.muted : '#4DD9F5'} strokeWidth={2.5} />
              <Text style={[s.pomoPillText, isDone && { color: colors.text.muted }]}>
                {task.estimatedPomodoros}
              </Text>
            </View>
          )}
          {task.recurring && task.recurring !== 'none' && (
            <View style={s.recurPill}>
              <RefreshCw size={8} color={colors.text.muted} strokeWidth={2.5} />
            </View>
          )}
          {(task.tags ?? []).slice(0, 2).map(tag => (
            <View key={tag} style={s.tagPill}>
              <Text style={s.tagPillText}>#{tag}</Text>
            </View>
          ))}
          {(task.tags ?? []).length > 2 && (
            <Text style={s.tagMore}>+{(task.tags ?? []).length - 2}</Text>
          )}
        </View>
      </View>

      <ChevronRight size={14} color='rgba(255,255,255,0.15)' />
    </TouchableOpacity>
  );
}

// ─── Task detail modal ────────────────────────────────────────────────────────

const SNOOZE_OPTIONS = [
  { label: 'Za 1 godzinę',     getDate: () => { const d = new Date(); d.setHours(d.getHours() + 1); return d; } },
  { label: 'Dziś wieczór 20:00', getDate: () => { const d = new Date(); d.setHours(20, 0, 0, 0); return d; } },
  { label: 'Jutro rano 9:00',   getDate: () => { const d = new Date(); d.setDate(d.getDate() + 1); d.setHours(9, 0, 0, 0); return d; } },
  { label: 'Za tydzień',        getDate: () => { const d = new Date(); d.setDate(d.getDate() + 7); d.setHours(9, 0, 0, 0); return d; } },
] as const;

function TaskDetailModal({ task, visible, onClose, onUpdate, onDelete, onAddSubtask, onToggleSubtask, onSnooze, onPomodoro }: {
  task: Task | null;
  visible: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
  onSnooze: (id: string, until: Date) => void;
  onPomodoro: (task: Task) => void;
}) {
  const [newMilestone, setNewMilestone] = useState('');
  const [snoozeOpen, setSnoozeOpen] = useState(false);
  const inputRef = useRef<TextInput>(null);

  if (!task) return null;

  const handleAddMilestone = () => {
    const title = newMilestone.trim();
    if (!title) return;
    haptic.tap();
    onAddSubtask(task.id, title);
    setNewMilestone('');
  };

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={dm.overlay}>
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={dm.kav}
        >
          <View style={dm.sheet}>
            {/* Header */}
            <View style={dm.header}>
              <View style={dm.headerLeft}>
                {(task.deadline || task.scheduledDate) && (
                  <Text style={dm.dateLabel}>
                    {task.deadline ? deadlineLabel(task.deadline) : `ZAPLANOWANE ${task.scheduledDate}`}
                  </Text>
                )}
                <Text style={dm.titleText}>{task.title.toUpperCase()}</Text>
                {task.description ? (
                  <Text style={dm.descText}>{task.description}</Text>
                ) : null}
                {(task.tags ?? []).length > 0 && (
                  <View style={dm.tagRow}>
                    {(task.tags ?? []).map(t => (
                      <Text key={t} style={dm.tagChip}>#{t}</Text>
                    ))}
                  </View>
                )}
              </View>
              <TouchableOpacity onPress={() => { haptic.tap(); onClose(); }} style={dm.closeBtn} hitSlop={8}>
                <X size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={dm.body}>
              {/* Milestones */}
              {(task.subtasks ?? []).map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={dm.milestoneRow}
                  onPress={() => { haptic.tap(); onToggleSubtask(task.id, sub.id); }}
                  activeOpacity={0.7}
                >
                  {sub.done
                    ? <CheckSquare2 size={16} color={G.accent} strokeWidth={2} />
                    : <Square size={16} color={colors.text.muted} strokeWidth={1.5} />
                  }
                  <Text style={[dm.milestoneText, sub.done && dm.milestoneDone]}>
                    {sub.title}
                  </Text>
                </TouchableOpacity>
              ))}

              {/* Add milestone row */}
              <View style={dm.addMilestoneRow}>
                <Plus size={14} color={G.accent} />
                <TextInput
                  ref={inputRef}
                  value={newMilestone}
                  onChangeText={setNewMilestone}
                  placeholder="DODAJ KAMIEŃ MILOWY"
                  placeholderTextColor={colors.text.muted}
                  style={dm.milestoneInput}
                  returnKeyType="done"
                  onSubmitEditing={handleAddMilestone}
                />
              </View>
            </ScrollView>

            {/* Footer actions */}
            <View style={dm.footer}>
              <TouchableOpacity
                style={[dm.footerBtn, dm.footerBtnPom]}
                onPress={() => { haptic.tap(); onPomodoro(task); onClose(); }}
                activeOpacity={0.8}
              >
                <Timer size={15} color='#22D3EE' />
                <Text style={[dm.footerBtnText, { color: '#22D3EE' }]}>Pomodoro</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={dm.footerBtn}
                onPress={() => { haptic.tap(); onClose(); router.push(`/tasks/${task.id}` as any); }}
                activeOpacity={0.8}
              >
                <Pencil size={15} color={G.accent} />
                <Text style={dm.footerBtnText}>Edytuj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dm.footerBtn, dm.footerBtnSnooze]}
                onPress={() => { haptic.tap(); setSnoozeOpen(true); }}
                activeOpacity={0.8}
              >
                <Clock size={15} color={colors.accent.amber} />
                <Text style={[dm.footerBtnText, { color: colors.accent.amber }]}>Odłóż</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dm.footerBtn, dm.footerBtnDanger]}
                onPress={() => { haptic.medium(); onDelete(task.id); onClose(); }}
                activeOpacity={0.8}
              >
                <Trash2 size={15} color={colors.accent.red} />
                <Text style={[dm.footerBtnText, { color: colors.accent.red }]}>Usuń</Text>
              </TouchableOpacity>
            </View>

            {/* Snooze sheet */}
            {snoozeOpen && (
              <View style={dm.snoozeSheet}>
                <View style={dm.snoozeHeader}>
                  <Clock size={13} color={colors.accent.amber} />
                  <Text style={dm.snoozeTitle}>Odłóż zadanie</Text>
                  <TouchableOpacity onPress={() => { haptic.tap(); setSnoozeOpen(false); }} hitSlop={8}>
                    <X size={15} color={colors.text.muted} />
                  </TouchableOpacity>
                </View>
                {SNOOZE_OPTIONS.map(opt => (
                  <TouchableOpacity
                    key={opt.label}
                    style={dm.snoozeRow}
                    onPress={() => {
                      haptic.tap();
                      onSnooze(task.id, opt.getDate());
                      setSnoozeOpen(false);
                      onClose();
                      toast.info('Odłożono zadanie');
                    }}
                    activeOpacity={0.75}
                  >
                    <Text style={dm.snoozeRowText}>{opt.label}</Text>
                    <ChevronRight size={13} color={colors.text.muted} />
                  </TouchableOpacity>
                ))}
              </View>
            )}
          </View>
        </KeyboardAvoidingView>
      </View>
    </Modal>
  );
}

const dm = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.7)', justifyContent: 'flex-end' },
  kav: { flex: 1, justifyContent: 'flex-end' },
  sheet: {
    backgroundColor: '#0D2318',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: G.cardBorder,
    maxHeight: '85%',
    paddingBottom: 32,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start',
    padding: spacing[5], gap: spacing[3],
    borderBottomWidth: 1, borderBottomColor: G.cardBorder,
  },
  headerLeft: { flex: 1, gap: 4 },
  dateLabel: { fontSize: 10, color: G.accent, fontWeight: '700', letterSpacing: 1.5 },
  titleText: { fontSize: 20, fontWeight: '800', color: colors.white, letterSpacing: 0.5, lineHeight: 26 },
  descText:  { fontSize: 13, color: colors.text.secondary, lineHeight: 19, marginTop: 4 },
  closeBtn:  { padding: 4 },
  tagRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 },
  tagChip: { fontSize: 10, fontWeight: '600', color: 'rgba(61,190,117,0.50)' },
  body: { paddingHorizontal: spacing[5], paddingTop: spacing[4] },
  milestoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: 'rgba(61,190,117,0.08)',
  },
  milestoneText: { flex: 1, fontSize: 13, color: colors.text.primary, fontWeight: '500' },
  milestoneDone: { textDecorationLine: 'line-through', color: colors.text.muted },
  addMilestoneRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: spacing[3],
  },
  milestoneInput: {
    flex: 1, fontSize: 12, color: colors.text.primary,
    fontWeight: '700', letterSpacing: 1,
  },
  footer: {
    flexDirection: 'row', gap: spacing[3],
    paddingHorizontal: spacing[5], paddingTop: spacing[4],
    borderTopWidth: 1, borderTopColor: G.cardBorder,
  },
  footerBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: spacing[3],
    backgroundColor: G.accentDim, borderRadius: radius.lg,
    borderWidth: 1, borderColor: G.cardBorder,
  },
  footerBtnDanger: {
    backgroundColor: colors.accent.red + '15',
    borderColor: colors.accent.red + '30',
  },
  footerBtnSnooze: {
    backgroundColor: colors.accent.amber + '15',
    borderColor: colors.accent.amber + '30',
  },
  footerBtnPom: {
    backgroundColor: 'rgba(34,211,238,0.12)',
    borderColor: 'rgba(34,211,238,0.30)',
  },
  footerBtnText: { fontSize: 13, fontWeight: '700', color: G.accent },
  snoozeSheet: {
    borderTopWidth: 1, borderTopColor: G.cardBorder,
    paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[2],
    gap: 0,
  },
  snoozeHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingBottom: spacing[3],
  },
  snoozeTitle: { flex: 1, fontSize: 11, fontWeight: '700', color: colors.accent.amber, letterSpacing: 1.2, textTransform: 'uppercase' },
  snoozeRow: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[3],
    borderTopWidth: 1, borderTopColor: 'rgba(61,190,117,0.06)',
  },
  snoozeRowText: { flex: 1, fontSize: 14, fontWeight: '600', color: colors.text.secondary },
});

// ─── Sort sheet ───────────────────────────────────────────────────────────────

function SortSheet({ sort, onSelect, onClose }: {
  sort: SortKey;
  onSelect: (k: SortKey) => void;
  onClose: () => void;
}) {
  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={ss.overlay} onPress={onClose} />
      <View style={ss.sheet}>
        <View style={ss.handle} />
        <Text style={ss.heading}>Sortowanie</Text>
        {SORT_OPTIONS.map(opt => (
          <TouchableOpacity
            key={opt.key}
            style={[ss.row, sort === opt.key && ss.rowActive]}
            onPress={() => { haptic.tap(); onSelect(opt.key); onClose(); }}
            activeOpacity={0.75}
          >
            <View style={{ flex: 1 }}>
              <Text style={[ss.label, sort === opt.key && ss.labelActive]}>{opt.label}</Text>
              <Text style={ss.sub}>{opt.sub}</Text>
            </View>
            {sort === opt.key && <Check size={16} color={G.accent} strokeWidth={2.5} />}
          </TouchableOpacity>
        ))}
      </View>
    </Modal>
  );
}

const ss = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.6)' },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: '#0A1A10',
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    padding: spacing[5], paddingBottom: 40,
    borderWidth: 1, borderBottomWidth: 0, borderColor: G.cardBorder,
    gap: spacing[1],
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: G.accentDim, alignSelf: 'center', marginBottom: spacing[3],
  },
  heading: { fontSize: 13, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.2, marginBottom: spacing[2] },
  row: {
    flexDirection: 'row', alignItems: 'center',
    paddingVertical: spacing[3], paddingHorizontal: spacing[3],
    borderRadius: radius.lg, gap: spacing[3],
  },
  rowActive: { backgroundColor: G.accentDim },
  label: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
  labelActive: { color: G.accent },
  sub: { fontSize: 11, color: colors.text.muted, marginTop: 2 },
});

// ─── Quick capture bar ────────────────────────────────────────────────────────

function QuickCapture({ onCreate }: { onCreate: (title: string, scheduleToday: boolean) => void }) {
  const [text, setText] = useState('');
  const [todayMode, setTodayMode] = useState(false);
  const inputRef = useRef<TextInput>(null);

  const submit = () => {
    const t = text.trim();
    if (!t) return;
    onCreate(t, todayMode);
    setText('');
    haptic.tap();
  };

  return (
    <View style={qc.wrap}>
      <View style={qc.row}>
        <TextInput
          ref={inputRef}
          value={text}
          onChangeText={setText}
          placeholder="Szybkie zadanie..."
          placeholderTextColor={colors.text.muted}
          style={qc.input}
          returnKeyType="done"
          onSubmitEditing={submit}
          blurOnSubmit={false}
        />
        <TouchableOpacity
          onPress={() => { setTodayMode(v => !v); haptic.tap(); }}
          style={[qc.todayChip, todayMode && qc.todayChipActive]}
          activeOpacity={0.75}
          hitSlop={6}
        >
          <Text style={[qc.todayChipText, todayMode && qc.todayChipTextActive]}>Dziś</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[qc.btn, text.trim().length > 0 && qc.btnActive]}
          onPress={submit}
          activeOpacity={0.75}
          hitSlop={8}
        >
          <ArrowRight size={16} color={text.trim().length > 0 ? G.card : colors.text.muted} strokeWidth={2.5} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const qc = StyleSheet.create({
  wrap: {
    paddingHorizontal: spacing[4], paddingBottom: spacing[3], paddingTop: spacing[2],
    borderTopWidth: 1, borderTopColor: G.cardBorder,
    backgroundColor: colors.bg.primary,
  },
  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: G.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: G.cardBorder,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  input: {
    flex: 1, fontSize: 14, fontWeight: '600', color: colors.white, letterSpacing: 0.2,
  },
  btn: {
    width: 30, height: 30, borderRadius: 15,
    backgroundColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  btnActive: {
    backgroundColor: G.accent, borderColor: G.accent,
  },
  todayChip: {
    paddingHorizontal: spacing[3], paddingVertical: 5,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.12)',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  todayChipActive: {
    backgroundColor: G.accentDim, borderColor: G.accent + '80',
  },
  todayChipText: { fontSize: 11, fontWeight: '700', color: colors.text.muted },
  todayChipTextActive: { color: G.accent },
});

// ─── Filter pills ─────────────────────────────────────────────────────────────

const FILTER_PILLS: { key: FilterKey; label: string }[] = [
  { key: 'all',     label: 'Wszystkie' },
  { key: 'urgent',  label: 'Pilne'     },
  { key: 'today',   label: 'Dziś'      },
  { key: 'quick',   label: 'Szybkie'   },
  { key: 'snoozed', label: 'Odłożone'  },
];

function FilterPills({ filter, onSelect, counts, tags, tagFilter, onTagSelect }: {
  filter: FilterKey;
  onSelect: (f: FilterKey) => void;
  counts: Record<FilterKey, number>;
  tags: string[];
  tagFilter: string | null;
  onTagSelect: (t: string | null) => void;
}) {
  return (
    <ScrollView
      horizontal
      showsHorizontalScrollIndicator={false}
      style={fp.wrap}
      contentContainerStyle={fp.row}
    >
      {FILTER_PILLS.map(p => {
        const isActive = filter === p.key && !tagFilter;
        const count = counts[p.key];
        return (
          <TouchableOpacity
            key={p.key}
            style={[fp.pill, isActive && fp.pillActive]}
            onPress={() => { haptic.tap(); onSelect(p.key); onTagSelect(null); }}
            activeOpacity={0.75}
          >
            <Text style={[fp.pillText, isActive && fp.pillTextActive]}>{p.label}</Text>
            {count > 0 && (
              <View style={[fp.badge, isActive && fp.badgeActive]}>
                <Text style={[fp.badgeText, isActive && fp.badgeTextActive]}>{count}</Text>
              </View>
            )}
          </TouchableOpacity>
        );
      })}
      {tags.length > 0 && <View style={fp.divider} />}
      {tags.map(tag => {
        const isActive = tagFilter === tag;
        return (
          <TouchableOpacity
            key={`tag-${tag}`}
            style={[fp.tagChip, isActive && fp.tagChipActive]}
            onPress={() => { haptic.tap(); onTagSelect(isActive ? null : tag); }}
            activeOpacity={0.75}
          >
            <Text style={[fp.tagText, isActive && fp.tagTextActive]}>#{tag}</Text>
          </TouchableOpacity>
        );
      })}
    </ScrollView>
  );
}

const fp = StyleSheet.create({
  wrap: { flexGrow: 0, borderBottomWidth: 1, borderBottomColor: G.cardBorder },
  row: {
    paddingHorizontal: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[3],
    flexDirection: 'row', gap: spacing[2],
  },
  pill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 14, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: G.accentDim,
    borderWidth: 1, borderColor: G.cardBorder,
  },
  pillActive: {
    backgroundColor: G.accent,
    borderColor: G.accent,
  },
  pillText: {
    fontSize: 12, fontWeight: '700', color: G.accent, letterSpacing: 0.3,
  },
  pillTextActive: {
    color: G.card,
  },
  badge: {
    minWidth: 18, height: 18, borderRadius: 9,
    backgroundColor: 'rgba(61,190,117,0.18)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 4,
  },
  badgeActive: {
    backgroundColor: 'rgba(13,35,24,0.35)',
  },
  badgeText: {
    fontSize: 10, fontWeight: '800', color: G.accent,
  },
  badgeTextActive: {
    color: G.card,
  },
  divider: {
    width: 1, height: 20, backgroundColor: G.cardBorder, alignSelf: 'center', marginHorizontal: 4,
  },
  tagChip: {
    paddingHorizontal: 10, paddingVertical: 7,
    borderRadius: 999,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  tagChipActive: {
    backgroundColor: 'rgba(108,158,255,0.18)',
    borderColor: colors.accent.blue + '60',
  },
  tagText: { fontSize: 12, fontWeight: '600', color: colors.text.muted, letterSpacing: 0.2 },
  tagTextActive: { color: colors.accent.blue },
});

// ─── Swipe row ────────────────────────────────────────────────────────────────

function SwipeRow({ task, pomodoroTaskId, onComplete, onEdit, onQuickSnooze }: {
  task: Task;
  pomodoroTaskId?: string;
  onComplete: (task: Task) => void;
  onEdit: (task: Task) => void;
  onQuickSnooze: (id: string) => void;
}) {
  const swRef = useRef<SwipeableMethods>(null);
  const isDone = task.status === 'done';

  return (
    <ReanimatedSwipeable
      ref={swRef}
      friction={2}
      overshootFriction={8}
      leftThreshold={72}
      rightThreshold={72}
      renderLeftActions={() => (
        <View style={[sw.leftReveal, isDone && sw.leftRevealDone]}>
          <Check size={18} color={isDone ? G.accent : G.card} strokeWidth={3} />
          <Text style={[sw.revealText, isDone && sw.revealTextDone]}>
            {isDone ? 'COFNIJ' : 'GOTOWE'}
          </Text>
        </View>
      )}
      renderRightActions={() => isDone ? null : (
        <View style={sw.rightReveal}>
          <Text style={sw.revealText}>ZA GODZ.</Text>
          <Clock size={18} color={G.card} strokeWidth={2.5} />
        </View>
      )}
      onSwipeableOpen={(dir) => {
        swRef.current?.close();
        if (dir === 'right') {
          onComplete(task);
        } else if (!isDone) {
          onQuickSnooze(task.id);
        }
      }}
    >
      <TaskCard task={task} pomodoroTaskId={pomodoroTaskId} onComplete={onComplete} onEdit={onEdit} />
    </ReanimatedSwipeable>
  );
}

const sw = StyleSheet.create({
  leftReveal: {
    flex: 1, flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: 20, gap: 8,
    backgroundColor: G.accent, borderRadius: 18,
  },
  leftRevealDone: { backgroundColor: G.accentDim },
  rightReveal: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end',
    paddingHorizontal: 20, gap: 8,
    backgroundColor: colors.accent.amber, borderRadius: 18,
  },
  revealText: { fontSize: 10, fontWeight: '800', color: G.card, letterSpacing: 0.8 },
  revealTextDone: { color: G.accent },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const { panHandlers, animatedStyle } = useTabSwipe();
  const { tasks, isLoading, reload, toggle, remove, update, create, snooze, addSubtask, toggleSubtask } = useTasks();
  const pomodoroTaskId = usePomodoroStore(s => s.taskId ?? undefined);
  const startPomodoro  = usePomodoroStore(s => s.startFor);

  const [sort, setSort]           = useState<SortKey>('deadline');
  const [sortOpen, setSortOpen]   = useState(false);
  const [filter, setFilter]       = useState<FilterKey>('all');
  const [tagFilter, setTagFilter] = useState<string | null>(null);
  const [detailTask, setDetailTask]   = useState<Task | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);
  const [doneCollapsed, setDoneCollapsed] = useState(true);

  const today = todayStr();

  const active    = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
  const done      = useMemo(() => tasks.filter(t => t.status === 'done').slice(0, 30), [tasks]);

  const availableTags = useMemo(() => {
    const freq: Record<string, number> = {};
    for (const t of active) {
      for (const tag of t.tags ?? []) {
        if (tag) freq[tag] = (freq[tag] ?? 0) + 1;
      }
    }
    return Object.entries(freq).sort(([,a],[,b]) => b - a).slice(0, 8).map(([tag]) => tag);
  }, [active]);

  const isQuick = (t: Task) =>
    (t.estimatedPomodoros != null && t.estimatedPomodoros <= 1) ||
    (t.difficulty != null && t.difficulty <= 2);

  const filtered  = useMemo(() => {
    let base = active;
    if (filter === 'urgent')  base = base.filter(t => t.priority === 'high');
    else if (filter === 'today')   base = base.filter(t => t.deadline?.startsWith(today) || t.scheduledDate === today);
    else if (filter === 'snoozed') base = base.filter(t => t.status === 'snoozed');
    else if (filter === 'quick')   base = base.filter(isQuick);
    if (tagFilter) base = base.filter(t => (t.tags ?? []).includes(tagFilter));
    return base;
  }, [active, filter, tagFilter, today]);

  const filterCounts = useMemo<Record<FilterKey, number>>(() => ({
    all:     active.length,
    urgent:  active.filter(t => t.priority === 'high').length,
    today:   active.filter(t => t.deadline?.startsWith(today) || t.scheduledDate === today).length,
    snoozed: active.filter(t => t.status === 'snoozed').length,
    quick:   active.filter(isQuick).length,
  }), [active, today]);

  const sorted    = useMemo(() => sortTasks(filtered, sort), [filtered, sort]);

  const handleCompletePress = useCallback((task: Task) => {
    if (task.status === 'done') {
      haptic.tap();
      toggle(task.id);
    } else {
      haptic.success();
      toggle(task.id);
      toast.success('Ukończono!');
    }
  }, [toggle]);

  const handleEditPress = useCallback((task: Task) => {
    setDetailTask(task);
    setDetailVisible(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    remove(id);
    toast.info('Usunięto');
  }, [remove]);

  const handlePomodoro = useCallback((task: Task) => {
    startPomodoro(task.id, task.title);
    router.push('/pomodoro' as any);
  }, [startPomodoro]);

  const handleQuickSnooze = useCallback((id: string) => {
    const d = new Date(); d.setHours(d.getHours() + 1);
    snooze(id, d);
    haptic.tap();
    toast.info('Odłożono na godzinę');
  }, [snooze]);

  const pending  = active.filter(t => t.status === 'pending' && !t.snoozedUntil).length;
  const overdue  = active.filter(t => { const d = t.deadline?.split('T')[0]; return !!d && d < today; }).length;

  const listData: ListItem[] = useMemo(() => {
    const shownDone = doneCollapsed ? [] : done;
    // Always show done-header when there are done tasks so toggle is visible
    const doneBlock: ListItem[] = done.length > 0
      ? ['done-header' as const, ...shownDone]
      : [];
    if (sort === 'deadline') {
      const grouped = buildGroupedList(sorted, [], today);
      return [...grouped, ...doneBlock];
    }
    return [...sorted, ...doneBlock];
  }, [sorted, done, today, sort, doneCollapsed]);

  const handleQuickCreate = useCallback(async (title: string, scheduleToday: boolean) => {
    await create({
      title, status: 'pending', priority: 'normal', tags: [],
      ...(scheduleToday ? { scheduledDate: todayStr() } : {}),
    });
    toast.success(scheduleToday ? 'Dodano na dziś' : 'Dodano zadanie');
  }, [create]);

  return (
    <SafeAreaView style={s.root} edges={['top']} {...panHandlers}>
      <TopPill />
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>

        {/* Header */}
        <View style={s.header}>
          <View>
            <Text style={s.title}>Zadania</Text>
            <Text style={s.subtitle}>
              {pending > 0 ? `${pending} aktywnych` : 'Wszystko ogarnięte'}
              {overdue > 0 ? ` · ${overdue} po terminie` : ''}
            </Text>
          </View>
          <View style={s.headerRight}>
            <TouchableOpacity
              style={s.headerBtn}
              onPress={() => { haptic.tap(); setSortOpen(true); }}
              activeOpacity={0.75}
            >
              <SlidersHorizontal size={16} color={colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.headerBtn, s.addBtn]}
              onPress={() => { haptic.tap(); router.push('/tasks/add' as any); }}
              activeOpacity={0.75}
            >
              <Plus size={18} color={G.accent} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Filter pills */}
        <FilterPills
          filter={filter}
          onSelect={setFilter}
          counts={filterCounts}
          tags={availableTags}
          tagFilter={tagFilter}
          onTagSelect={setTagFilter}
        />

        {/* List */}
        <FlatList
          data={listData as any[]}
          keyExtractor={(item: ListItem) => {
            if (item === 'done-header') return 'done-header';
            if ((item as SectionHeader).type === 'section') return `sec-${(item as SectionHeader).key}`;
            return (item as Task).id;
          }}
          renderItem={({ item }: { item: ListItem }) => {
            if (item === 'done-header') {
              return (
                <TouchableOpacity
                  style={s.sectionHeader}
                  onPress={() => { haptic.tap(); setDoneCollapsed(v => !v); }}
                  activeOpacity={0.7}
                >
                  <View style={s.sectionLine} />
                  <View style={s.sectionLabelRow}>
                    <Text style={s.sectionLabel}>UKOŃCZONE</Text>
                    <View style={s.sectionBadge}>
                      <Text style={s.sectionBadgeText}>{done.length}</Text>
                    </View>
                    {doneCollapsed
                      ? <ChevronRight size={11} color={colors.text.muted} />
                      : <Square size={11} color={colors.text.muted} strokeWidth={1.5} />
                    }
                  </View>
                  <View style={s.sectionLine} />
                </TouchableOpacity>
              );
            }
            if ((item as SectionHeader).type === 'section') {
              const sec = item as SectionHeader;
              return (
                <View style={s.groupHeader}>
                  <View style={[s.groupDot, { backgroundColor: sec.color }]} />
                  <Text style={[s.groupLabel, { color: sec.color }]}>{sec.label}</Text>
                  <Text style={s.groupCount}>{sec.count}</Text>
                </View>
              );
            }
            return (
              <SwipeRow
                task={item as Task}
                pomodoroTaskId={pomodoroTaskId}
                onComplete={handleCompletePress}
                onEdit={handleEditPress}
                onQuickSnooze={handleQuickSnooze}
              />
            );
          }}
          contentContainerStyle={s.list}
          showsVerticalScrollIndicator={false}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={reload} tintColor={G.accent} />
          }
          ListEmptyComponent={
            <View style={s.empty}>
              <Text style={s.emptyTitle}>
                {filter === 'all' && !tagFilter ? 'Brak zadań' : 'Brak wyników'}
              </Text>
              <Text style={s.emptySub}>
                {tagFilter ? `Brak zadań z tagiem #${tagFilter}` :
                 filter === 'all'     ? 'Naciśnij + żeby dodać pierwsze' :
                 filter === 'urgent'  ? 'Brak zadań o wysokim priorytecie' :
                 filter === 'today'   ? 'Brak zadań na dziś' :
                 filter === 'quick'   ? 'Brak szybkich zadań' :
                                        'Brak odłożonych zadań'}
              </Text>
            </View>
          }
        />

        {/* Quick capture */}
        <QuickCapture onCreate={handleQuickCreate} />
      </Animated.View>

      {/* Modals */}
      <TaskDetailModal
        task={detailTask}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onUpdate={update}
        onDelete={handleDelete}
        onAddSubtask={addSubtask}
        onToggleSubtask={toggleSubtask}
        onSnooze={snooze}
        onPomodoro={handlePomodoro}
      />
      <SortSheet
        sort={sort}
        onSelect={setSort}
        onClose={() => setSortOpen(false)}
      />
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[3],
  },
  title:    { fontSize: 28, fontWeight: '800', color: colors.white, letterSpacing: -0.5 },
  subtitle: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
  headerRight: { flexDirection: 'row', gap: spacing[2] },
  headerBtn: {
    width: 38, height: 38, borderRadius: radius.lg,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  addBtn: {
    backgroundColor: G.accentDim,
    borderColor: G.cardBorder,
  },

  list: { paddingHorizontal: spacing[4], paddingBottom: 140, gap: spacing[2] },

  card: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: 18, borderWidth: 1,
    paddingVertical: spacing[3], paddingRight: spacing[3],
    gap: spacing[3],
  },
  cardDone: { opacity: 0.45 },

  actionPill: {
    flexDirection: 'row', alignItems: 'center',
    marginLeft: spacing[3],
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 12, borderWidth: 1, borderColor: 'rgba(61,190,117,0.2)',
    overflow: 'hidden',
    height: 44,
  },
  actionHalf: {
    width: 36, height: 44,
    alignItems: 'center', justifyContent: 'center',
  },
  actionDivider: {
    width: 1, height: 22, backgroundColor: 'rgba(61,190,117,0.2)',
  },

  cardContent: { flex: 1, gap: 3 },
  cardTitle: {
    fontSize: 13, fontWeight: '800', color: colors.white,
    letterSpacing: 0.3, lineHeight: 18,
  },
  cardTitleDone: { textDecorationLine: 'line-through', color: colors.text.muted },
  cardSub: { fontSize: 10, fontWeight: '700', letterSpacing: 1.2 },
  cardMeta: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 2 },
  cardMilestones: { fontSize: 9, color: colors.text.muted },
  pomoPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: 'rgba(77,217,245,0.10)',
    borderRadius: 6, paddingHorizontal: 5, paddingVertical: 2,
  },
  pomoPillText: { fontSize: 9, fontWeight: '700', color: '#4DD9F5' },
  recurPill: {
    width: 18, height: 18, borderRadius: 9,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  tagPill: {
    backgroundColor: 'rgba(108,158,255,0.10)',
    borderRadius: 4, paddingHorizontal: 4, paddingVertical: 1,
    borderWidth: 1, borderColor: 'rgba(108,158,255,0.20)',
  },
  tagPillText: { fontSize: 8, fontWeight: '600', color: colors.accent.blue + 'CC' },
  tagMore: { fontSize: 8, fontWeight: '600', color: colors.text.muted },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[3], marginVertical: spacing[3],
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  sectionLabelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: colors.text.muted,
    letterSpacing: 1.5,
  },
  sectionBadge: {
    backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 6,
    paddingHorizontal: 5, paddingVertical: 1,
  },
  sectionBadgeText: { fontSize: 9, fontWeight: '700', color: colors.text.muted },

  groupHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginTop: spacing[4], marginBottom: spacing[1],
    paddingHorizontal: spacing[1],
  },
  groupDot: { width: 6, height: 6, borderRadius: 3 },
  groupLabel: {
    flex: 1, fontSize: 9, fontWeight: '800', letterSpacing: 1.6,
  },
  groupCount: {
    fontSize: 9, fontWeight: '700', color: colors.text.muted,
    backgroundColor: 'rgba(255,255,255,0.06)',
    paddingHorizontal: 6, paddingVertical: 2,
    borderRadius: 8,
  },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing[3] },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.secondary },
  emptySub:   { fontSize: 13, color: colors.text.muted },
});
