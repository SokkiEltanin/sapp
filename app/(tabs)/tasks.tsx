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
  AlarmClock, ChevronRight, Trash2, X,
  Square, CheckSquare2,
} from 'lucide-react-native';

import { useTasks } from '@/hooks/useTasks';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { toast } from '@/store/toastStore';
import { haptic } from '@/utils/haptics';
import { Task, Subtask } from '@/types';
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
  if (!task.deadline) return 'BEZ TERMINU';
  return `ZAPLANOWANE ${deadlineLabel(task.deadline)}`;
}

// ─── Sort ─────────────────────────────────────────────────────────────────────

type SortKey = 'deadline' | 'priority' | 'created' | 'alpha';

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

  const cardBg     = overdue ? G.overdueCard : G.card;
  const cardBorder = overdue ? G.overdueBorder : G.cardBorder;
  const subColor   = subtitle === 'AKTUALNIE W TOKU' ? G.accent
    : overdue ? colors.accent.red
    : snoozed ? colors.accent.amber
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
        {task.subtasks && task.subtasks.length > 0 && (() => {
          const done = task.subtasks.filter(s => s.done).length;
          return (
            <Text style={s.cardMilestones}>{done}/{task.subtasks.length} kamieni</Text>
          );
        })()}
      </View>

      <ChevronRight size={14} color='rgba(255,255,255,0.15)' />
    </TouchableOpacity>
  );
}

// ─── Task detail modal ────────────────────────────────────────────────────────

function TaskDetailModal({ task, visible, onClose, onUpdate, onDelete, onAddSubtask, onToggleSubtask }: {
  task: Task | null;
  visible: boolean;
  onClose: () => void;
  onUpdate: (id: string, data: Partial<Task>) => void;
  onDelete: (id: string) => void;
  onAddSubtask: (taskId: string, title: string) => void;
  onToggleSubtask: (taskId: string, subtaskId: string) => void;
}) {
  const [newMilestone, setNewMilestone] = useState('');
  const inputRef = useRef<TextInput>(null);

  if (!task) return null;

  const handleAddMilestone = () => {
    const title = newMilestone.trim();
    if (!title) return;
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
                {task.deadline && (
                  <Text style={dm.dateLabel}>
                    {deadlineLabel(task.deadline)}
                  </Text>
                )}
                <Text style={dm.titleText}>{task.title.toUpperCase()}</Text>
                {task.description ? (
                  <Text style={dm.descText}>{task.description}</Text>
                ) : null}
              </View>
              <TouchableOpacity onPress={onClose} style={dm.closeBtn} hitSlop={8}>
                <X size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} style={dm.body}>
              {/* Milestones */}
              {(task.subtasks ?? []).map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={dm.milestoneRow}
                  onPress={() => onToggleSubtask(task.id, sub.id)}
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
                style={dm.footerBtn}
                onPress={() => { onClose(); router.push(`/tasks/${task.id}` as any); }}
                activeOpacity={0.8}
              >
                <Pencil size={15} color={G.accent} />
                <Text style={dm.footerBtnText}>Edytuj</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[dm.footerBtn, dm.footerBtnDanger]}
                onPress={() => { onDelete(task.id); onClose(); }}
                activeOpacity={0.8}
              >
                <Trash2 size={15} color={colors.accent.red} />
                <Text style={[dm.footerBtnText, { color: colors.accent.red }]}>Usuń</Text>
              </TouchableOpacity>
            </View>
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
  footerBtnText: { fontSize: 13, fontWeight: '700', color: G.accent },
});

// ─── Completion confirm modal ──────────────────────────────────────────────────

function ConfirmModal({ task, onConfirm, onCancel }: {
  task: Task | null;
  onConfirm: () => void;
  onCancel: () => void;
}) {
  if (!task) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onCancel}>
      <Pressable style={cm.overlay} onPress={onCancel} />
      <View style={cm.box}>
        <Text style={cm.title}>Ukończyłeś zadanie?</Text>
        <Text style={cm.sub} numberOfLines={2}>{task.title}</Text>
        <View style={cm.btns}>
          <TouchableOpacity style={cm.btnNo} onPress={onCancel} activeOpacity={0.8}>
            <Text style={cm.btnNoText}>Nie</Text>
          </TouchableOpacity>
          <TouchableOpacity style={cm.btnYes} onPress={onConfirm} activeOpacity={0.8}>
            <Check size={16} color={G.card} strokeWidth={3} />
            <Text style={cm.btnYesText}>Tak, gotowe</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const cm = StyleSheet.create({
  overlay: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.7)' },
  box: {
    position: 'absolute', bottom: 120, left: 24, right: 24,
    backgroundColor: '#0D2318',
    borderRadius: 20, padding: spacing[5], gap: spacing[4],
    borderWidth: 1, borderColor: G.cardBorder,
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.white, textAlign: 'center' },
  sub:   { fontSize: 13, color: colors.text.muted, textAlign: 'center' },
  btns:  { flexDirection: 'row', gap: spacing[3] },
  btnNo: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.lg,
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center',
  },
  btnNoText:  { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  btnYes: {
    flex: 2, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 8, paddingVertical: spacing[3], borderRadius: radius.lg,
    backgroundColor: G.accent,
  },
  btnYesText: { fontSize: 14, fontWeight: '800', color: G.card },
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
            onPress={() => { onSelect(opt.key); onClose(); }}
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

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TasksScreen() {
  const { panHandlers, animatedStyle } = useTabSwipe();
  const { tasks, isLoading, reload, toggle, remove, update, addSubtask, toggleSubtask } = useTasks();
  const pomodoroTaskId = usePomodoroStore(s => s.taskId ?? undefined);

  const [sort, setSort]           = useState<SortKey>('deadline');
  const [sortOpen, setSortOpen]   = useState(false);
  const [confirmTask, setConfirmTask] = useState<Task | null>(null);
  const [detailTask, setDetailTask]   = useState<Task | null>(null);
  const [detailVisible, setDetailVisible] = useState(false);

  const today = todayStr();

  const active    = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
  const done      = useMemo(() => tasks.filter(t => t.status === 'done').slice(0, 30), [tasks]);
  const sorted    = useMemo(() => sortTasks(active, sort), [active, sort]);

  const handleCompletePress = useCallback((task: Task) => {
    if (task.status === 'done') {
      toggle(task.id); // untoggle
    } else {
      haptic.tap();
      setConfirmTask(task);
    }
  }, [toggle]);

  const handleConfirm = useCallback(() => {
    if (!confirmTask) return;
    toggle(confirmTask.id);
    toast.success('Zadanie ukończone');
    setConfirmTask(null);
  }, [confirmTask, toggle]);

  const handleEditPress = useCallback((task: Task) => {
    setDetailTask(task);
    setDetailVisible(true);
  }, []);

  const handleDelete = useCallback((id: string) => {
    remove(id);
    toast.info('Usunięto');
  }, [remove]);

  const pending  = active.filter(t => t.status === 'pending' && !t.snoozedUntil).length;
  const overdue  = active.filter(t => t.deadline?.split('T')[0] < today).length;

  const listData: (Task | 'done-header' | Task)[] = [
    ...sorted,
    ...(done.length > 0 ? (['done-header' as const, ...done]) : []),
  ];

  return (
    <SafeAreaView style={s.root} edges={['top']} {...panHandlers}>
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
              onPress={() => setSortOpen(true)}
              activeOpacity={0.75}
            >
              <SlidersHorizontal size={16} color={colors.text.secondary} />
            </TouchableOpacity>
            <TouchableOpacity
              style={[s.headerBtn, s.addBtn]}
              onPress={() => router.push('/tasks/add' as any)}
              activeOpacity={0.75}
            >
              <Plus size={18} color={G.accent} strokeWidth={2.5} />
            </TouchableOpacity>
          </View>
        </View>

        {/* List */}
        <FlatList
          data={listData as any[]}
          keyExtractor={(item, i) => typeof item === 'string' ? item : item.id}
          renderItem={({ item }) => {
            if (item === 'done-header') {
              return (
                <View style={s.sectionHeader}>
                  <View style={s.sectionLine} />
                  <Text style={s.sectionLabel}>UKOŃCZONE</Text>
                  <View style={s.sectionLine} />
                </View>
              );
            }
            return (
              <TaskCard
                task={item}
                pomodoroTaskId={pomodoroTaskId}
                onComplete={handleCompletePress}
                onEdit={handleEditPress}
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
              <Text style={s.emptyTitle}>Brak zadań</Text>
              <Text style={s.emptySub}>Naciśnij + żeby dodać pierwsze</Text>
            </View>
          }
        />
      </Animated.View>

      {/* Modals */}
      <ConfirmModal
        task={confirmTask}
        onConfirm={handleConfirm}
        onCancel={() => setConfirmTask(null)}
      />
      <TaskDetailModal
        task={detailTask}
        visible={detailVisible}
        onClose={() => setDetailVisible(false)}
        onUpdate={update}
        onDelete={handleDelete}
        onAddSubtask={addSubtask}
        onToggleSubtask={toggleSubtask}
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
  cardMilestones: { fontSize: 9, color: colors.text.muted, marginTop: 2 },

  sectionHeader: {
    flexDirection: 'row', alignItems: 'center',
    gap: spacing[3], marginVertical: spacing[3],
  },
  sectionLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.05)' },
  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: colors.text.muted,
    letterSpacing: 1.5,
  },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing[3] },
  emptyTitle: { fontSize: 18, fontWeight: '700', color: colors.text.secondary },
  emptySub:   { fontSize: 13, color: colors.text.muted },
});
