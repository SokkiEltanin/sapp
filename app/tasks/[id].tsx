import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, TextInput,
  TouchableOpacity, Alert, KeyboardAvoidingView, Platform,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useLocalSearchParams, router } from 'expo-router';
import {
  ArrowLeft, Trash2, Check, Timer, Edit3, Save,
  Calendar, Flag, AlignLeft, Tag, Clock, RefreshCw, BellOff, Bell,
  Plus, CheckSquare, Square, X as XIcon, ChevronUp, ChevronDown,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useTasks } from '@/hooks/useTasks';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { toast } from '@/store/toastStore';
import { EventPriority, TaskDifficulty, TaskStatus, MoodLevel, TaskRecurring, Subtask } from '@/types';

const RECURRING_OPTIONS: { value: TaskRecurring; label: string }[] = [
  { value: 'none',    label: 'Brak' },
  { value: 'daily',   label: 'Codziennie' },
  { value: 'weekly',  label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
];
import { tasksService } from '@/services/calendarService';
import { notificationsService } from '@/services/notificationsService';
import { useCalendarStore } from '@/store/calendarStore';
import { colors, spacing, radius, typography } from '@/theme';
import CompletionMoodModal from '@/components/tasks/CompletionMoodModal';
import { haptic } from '@/utils/haptics';

const G = {
  card:       '#0D2318',
  cardBorder: 'rgba(61,190,117,0.18)',
  accent:     '#3DBE75',
  accentDim:  'rgba(61,190,117,0.14)',
  muted:      'rgba(61,190,117,0.45)',
};

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDate(iso?: string) {
  if (!iso) return '';
  return iso.split('T')[0];
}
function addDays(n: number) {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── Difficulty bar ───────────────────────────────────────────────────────────

function DiffPicker({ value, onChange }: { value?: TaskDifficulty; onChange: (v: TaskDifficulty) => void }) {
  const col = (v?: TaskDifficulty) => !v ? colors.text.muted : v <= 2 ? G.accent : v === 3 ? colors.accent.amber : colors.accent.red;
  const labels = ['', 'Łatwe', 'Proste', 'Średnie', 'Trudne', 'Hardkor'] as const;
  return (
    <View style={dp.row}>
      {([1,2,3,4,5] as TaskDifficulty[]).map(d => (
        <PressableScale key={d} onPress={() => onChange(d)} style={dp.dotWrap}>
          <View style={[dp.dot,
            { backgroundColor: value && d <= value ? col(value) : 'rgba(255,255,255,0.08)' },
            value === d && { width: 20, height: 20 },
          ]} />
        </PressableScale>
      ))}
      {value && <Text style={[dp.label, { color: col(value) }]}>{labels[value]}</Text>}
    </View>
  );
}
const dp = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dotWrap: { padding: 4 },
  dot: { width: 16, height: 16, borderRadius: 8 },
  label: { fontSize: 12, fontWeight: '600', marginLeft: spacing[1] },
});

// ─── Priority pills ───────────────────────────────────────────────────────────

const PRIORITIES: { value: EventPriority; label: string; color: string }[] = [
  { value: 'low',    label: 'Niskie',   color: colors.text.secondary },
  { value: 'normal', label: 'Normalne', color: G.accent },
  { value: 'high',   label: 'Pilne',    color: colors.accent.red },
];

// ─── Pomodoro ring (simple arc) ───────────────────────────────────────────────

function PomRing({ done, total }: { done: number; total: number }) {
  if (total === 0) return null;
  const pct = Math.min(1, done / total);
  const col = pct >= 1 ? colors.accent.green : colors.accent.purple;
  return (
    <View style={pr.wrap}>
      <View style={[pr.track]}>
        <View style={[pr.fill, { width: `${pct * 100}%`, backgroundColor: col }]} />
      </View>
      <Text style={pr.text}>
        <Text style={{ color: col, fontWeight: '800' }}>{done}</Text>/{total} sesji
      </Text>
    </View>
  );
}
const pr = StyleSheet.create({
  wrap: { gap: 6 },
  track: { height: 4, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 2, overflow: 'hidden' },
  fill: { height: 4, borderRadius: 2 },
  text: { fontSize: 12, color: colors.text.secondary },
});

// ─── Section row ──────────────────────────────────────────────────────────────

function Row({ icon, label, children }: { icon: React.ReactNode; label: string; children: React.ReactNode }) {
  return (
    <View style={rw.wrap}>
      <View style={rw.labelRow}>
        {icon}
        <Text style={rw.label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}
const rw = StyleSheet.create({
  wrap: {
    gap: spacing[2], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: G.cardBorder,
  },
  labelRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  label: { fontSize: 10, fontWeight: '700', color: G.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function TaskDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { tasks, update, remove, toggle, unsnooze, addSubtask, toggleSubtask, removeSubtask } = useTasks();
  const startPomodoro = usePomodoroStore(s => s.startFor);
  const updateTaskStore = useCalendarStore(s => s.updateTask);

  const task = tasks.find(t => t.id === id);

  const [editing, setEditing]           = useState(false);
  const [title, setTitle]               = useState(task?.title ?? '');
  const [description, setDescription]   = useState(task?.description ?? '');
  const [deadline, setDeadline]         = useState(fmtDate(task?.deadline));
  const [priority, setPriority]         = useState<EventPriority>(task?.priority ?? 'normal');
  const [difficulty, setDifficulty]     = useState<TaskDifficulty | undefined>(task?.difficulty);
  const [pomodoros, setPomodoros]       = useState(task?.estimatedPomodoros ?? 0);
  const [tags, setTags]                 = useState<string[]>(task?.tags ?? []);
  const [tagInput, setTagInput]         = useState('');
  const [recurring, setRecurring]       = useState<TaskRecurring>(task?.recurring ?? 'none');
  const [subtaskInput, setSubtaskInput] = useState('');
  const [saving, setSaving]             = useState(false);
  const [reminderOn, setReminderOn]     = useState(!!task?.reminderTime);
  const reminderParts = task?.reminderTime?.split(':').map(Number) ?? [9, 0];
  const [reminderHour, setReminderHour] = useState(reminderParts[0]);
  const [reminderMin, setReminderMin]   = useState(reminderParts[1]);
  const [reminderMsg, setReminderMsg]   = useState(task?.reminderMessage ?? '');
  const [moodModal, setMoodModal]       = useState(false);
  const [moodTaskTitle, setMoodTaskTitle] = useState('');

  if (!task) {
    return (
      <SafeAreaView style={styles.safe} edges={['top']}>
        <View style={styles.notFound}>
          <Text style={styles.notFoundText}>Zadanie nie istnieje</Text>
          <PressableScale onPress={() => router.back()} style={styles.backBtn}>
            <Text style={{ color: colors.text.primary }}>Wróć</Text>
          </PressableScale>
        </View>
      </SafeAreaView>
    );
  }

  const done = task.status === 'done';

  const handleSave = async () => {
    if (!title.trim()) { toast.error('Tytuł nie może być pusty'); return; }
    setSaving(true);
    try {
      const deadlineIso = deadline.trim() ? deadline.trim() + 'T23:59:00.000Z' : undefined;
      const reminderTime = reminderOn ? `${pad(reminderHour)}:${pad(reminderMin)}` : undefined;
      const reminderMessage = reminderOn && reminderMsg.trim() ? reminderMsg.trim() : undefined;

      await update(id!, {
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadlineIso,
        priority,
        difficulty,
        estimatedPomodoros: pomodoros > 0 ? pomodoros : undefined,
        tags,
        recurring,
        reminderTime,
        reminderMessage,
      });

      // Reschedule or cancel reminder
      notificationsService.cancelTaskReminder(id!).catch(() => {});
      if (reminderTime) {
        notificationsService.scheduleCustomTaskReminder(
          id!, title.trim(), deadline.trim() || todayStr(), reminderTime, reminderMessage,
        ).catch(() => {});
      }

      haptic.success();
      setEditing(false);
      toast.success('Zapisano');
    } catch (e: any) {
      toast.error(e.message);
    } finally {
      setSaving(false);
    }
  };

  const handleToggle = async () => {
    const isCompleting = task.status !== 'done';
    await toggle(id!);
    if (isCompleting) {
      setMoodTaskTitle(task.title);
      setMoodModal(true);
    }
  };

  const handleDelete = () => {
    Alert.alert('Usuń zadanie', 'Na pewno usunąć?', [
      { text: 'Anuluj', style: 'cancel' },
      {
        text: 'Usuń', style: 'destructive', onPress: async () => {
          haptic.medium();
          await remove(id!);
          toast.info('Usunięto');
          router.back();
        },
      },
    ]);
  };

  const handleMoodSelect = async (mood: MoodLevel) => {
    setMoodModal(false);
    await update(id!, { postCompletionMood: mood });
    toast.success('Nastrój zapisany');
  };

  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (t && !tags.includes(t)) setTags([...tags, t]);
    setTagInput('');
  };

  const removeTag = (t: string) => setTags(tags.filter(x => x !== t));

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Header */}
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
            <ArrowLeft size={20} color={colors.text.secondary} />
          </PressableScale>

          <View style={styles.headerActions}>
            {editing ? (
              <PressableScale onPress={saving ? undefined : handleSave} style={[styles.iconBtn, styles.saveBtn]}>
                <Save size={18} color={colors.bg.primary} />
              </PressableScale>
            ) : (
              <PressableScale onPress={() => setEditing(true)} style={styles.iconBtn}>
                <Edit3 size={18} color={colors.text.secondary} />
              </PressableScale>
            )}
            <PressableScale onPress={handleDelete} style={styles.iconBtn}>
              <Trash2 size={18} color={colors.accent.red} />
            </PressableScale>
          </View>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View>
            {editing ? (
              <TextInput
                value={title}
                onChangeText={setTitle}
                style={styles.titleInput}
                multiline
                autoFocus
                placeholderTextColor={colors.text.muted}
              />
            ) : (
              <Text style={[styles.titleText, done && styles.titleDone]}>{task.title}</Text>
            )}
          </View>

          {/* Snoozed banner */}
          {task.status === 'snoozed' && task.snoozedUntil && (
            <TouchableOpacity
              style={styles.snoozedBanner}
              onPress={() => { unsnooze(id!); toast.success('Zadanie wznowione'); }}
              activeOpacity={0.8}
            >
              <BellOff size={14} color={colors.accent.amber} />
              <Text style={styles.snoozedText}>
                Odłożone do {new Date(task.snoozedUntil).toLocaleString('pl-PL', {
                  day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
                })} — dotknij, żeby wznowić
              </Text>
            </TouchableOpacity>
          )}

          {/* Status toggle */}
          <View style={styles.statusRow}>
            <TouchableOpacity
              style={[styles.statusBtn, done && styles.statusBtnDone]}
              onPress={handleToggle}
              activeOpacity={0.8}
            >
              <Check size={14} color={done ? colors.bg.primary : colors.text.muted} strokeWidth={2.5} />
              <Text style={[styles.statusText, done && { color: colors.bg.primary }]}>
                {done ? 'Ukończone' : 'Oznacz jako ukończone'}
              </Text>
            </TouchableOpacity>

            {!done && task.status !== 'snoozed' && (
              <PressableScale
                onPress={() => { startPomodoro(task.id, task.title); router.push('/pomodoro' as any); }}
                style={styles.pomStartBtn}
              >
                <Timer size={14} color={colors.accent.purple} />
                <Text style={styles.pomStartText}>Pomodoro</Text>
              </PressableScale>
            )}
          </View>

          {/* Pomodoro progress */}
          {(task.estimatedPomodoros ?? 0) > 0 && (
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <Timer size={13} color={colors.accent.purple} />
                <Text style={styles.sectionCardLabel}>Sesje Pomodoro</Text>
              </View>
              <PomRing done={task.completedPomodoros ?? 0} total={task.estimatedPomodoros ?? 0} />
              {editing && (
                <View style={styles.pomRow}>
                  <Text style={styles.fieldLabel}>Planowane sesje:</Text>
                  <View style={styles.stepperRow}>
                    <PressableScale onPress={() => setPomodoros(p => Math.max(0, p - 1))} style={styles.stepBtn}>
                      <Text style={styles.stepBtnText}>−</Text>
                    </PressableScale>
                    <Text style={styles.stepVal}>{pomodoros}</Text>
                    <PressableScale onPress={() => setPomodoros(p => Math.min(12, p + 1))} style={styles.stepBtn}>
                      <Text style={styles.stepBtnText}>+</Text>
                    </PressableScale>
                  </View>
                </View>
              )}
            </View>
          )}

          {/* Subtasks */}
          {(task.subtasks && task.subtasks.length > 0) || !done ? (
            <View style={styles.sectionCard}>
              <View style={styles.sectionCardHeader}>
                <CheckSquare size={13} color={colors.accent.blue} />
                <Text style={styles.sectionCardLabel}>Kroki</Text>
                {task.subtasks && task.subtasks.length > 0 && (
                  <Text style={styles.subtaskProgress}>
                    {task.subtasks.filter(s => s.done).length}/{task.subtasks.length}
                  </Text>
                )}
              </View>

              {/* Subtask progress bar */}
              {task.subtasks && task.subtasks.length > 0 && (
                <View style={styles.subProgressTrack}>
                  <View style={[styles.subProgressFill, {
                    width: `${(task.subtasks.filter(s => s.done).length / task.subtasks.length) * 100}%`,
                    backgroundColor: task.subtasks.every(s => s.done) ? colors.accent.green : colors.accent.blue,
                  }]} />
                </View>
              )}

              {/* Subtask rows */}
              {(task.subtasks ?? []).map((sub) => (
                <TouchableOpacity
                  key={sub.id}
                  style={styles.subRow}
                  onPress={() => toggleSubtask(id!, sub.id)}
                  activeOpacity={0.75}
                >
                  {sub.done
                    ? <CheckSquare size={16} color={G.accent} />
                    : <Square size={16} color='rgba(255,255,255,0.25)' />
                  }
                  <Text style={[styles.subTitle, sub.done && styles.subTitleDone]} numberOfLines={2}>
                    {sub.title}
                  </Text>
                  {!done && (
                    <TouchableOpacity
                      onPress={() => removeSubtask(id!, sub.id)}
                      hitSlop={8}
                      style={styles.subDelete}
                    >
                      <XIcon size={12} color='rgba(255,255,255,0.2)' />
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>
              ))}

              {/* Add subtask input */}
              {!done && (
                <View style={styles.subInputRow}>
                  <Plus size={13} color={colors.text.muted} />
                  <TextInput
                    value={subtaskInput}
                    onChangeText={setSubtaskInput}
                    placeholder="Dodaj krok..."
                    placeholderTextColor={colors.text.muted}
                    style={styles.subInput}
                    returnKeyType="done"
                    blurOnSubmit={false}
                    onSubmitEditing={() => {
                      const t = subtaskInput.trim();
                      if (t) { addSubtask(id!, t); setSubtaskInput(''); }
                    }}
                  />
                  {subtaskInput.trim().length > 0 && (
                    <TouchableOpacity
                      onPress={() => {
                        const t = subtaskInput.trim();
                        if (t) { addSubtask(id!, t); setSubtaskInput(''); }
                      }}
                      style={styles.subAddBtn}
                    >
                      <Check size={13} color={G.accent} strokeWidth={3} />
                    </TouchableOpacity>
                  )}
                </View>
              )}
            </View>
          ) : null}

          {/* Details */}
          <View style={styles.sectionCard}>

            <Row icon={<Flag size={12} color={colors.text.muted} />} label="Priorytet">
              <View style={styles.priorityRow}>
                {PRIORITIES.map(p => {
                  const active = (editing ? priority : task.priority) === p.value;
                  return (
                    <PressableScale
                      key={p.value}
                      onPress={() => editing && setPriority(p.value)}
                      style={[styles.priorityPill, active && { borderColor: p.color, backgroundColor: p.color + '18' }]}
                    >
                      <Text style={[styles.priorityText, active && { color: p.color }]}>{p.label}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </Row>

            <Row icon={<Calendar size={12} color={colors.text.muted} />} label="Termin">
              {editing ? (
                <View style={{ gap: spacing[2] }}>
                  <TextInput
                    value={deadline}
                    onChangeText={setDeadline}
                    placeholder={todayStr()}
                    placeholderTextColor={colors.text.muted}
                    style={styles.fieldInput}
                    keyboardType="numbers-and-punctuation"
                  />
                  <View style={styles.quickDateRow}>
                    {([
                      { label: 'Dzisiaj', value: addDays(0) },
                      { label: 'Jutro',   value: addDays(1) },
                      { label: '+7 dni',  value: addDays(7) },
                      { label: 'Wyczyść', value: '' },
                    ] as { label: string; value: string }[]).map(btn => (
                      <TouchableOpacity
                        key={btn.label}
                        style={[styles.quickDateBtn, deadline === btn.value && styles.quickDateBtnActive]}
                        onPress={() => setDeadline(btn.value)}
                        activeOpacity={0.75}
                      >
                        <Text style={[styles.quickDateText, deadline === btn.value && styles.quickDateTextActive]}>
                          {btn.label}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              ) : (
                <Text style={styles.fieldValue}>
                  {task.deadline ? task.deadline.split('T')[0] : 'Brak terminu'}
                </Text>
              )}
            </Row>

            <Row icon={<Bell size={12} color={colors.text.muted} />} label="Przypomnienie">
              {editing ? (
                <View style={{ gap: spacing[2] }}>
                  <TouchableOpacity
                    style={[styles.reminderBtn, reminderOn && styles.reminderBtnOn]}
                    onPress={() => setReminderOn(v => !v)}
                    activeOpacity={0.8}
                  >
                    {reminderOn
                      ? <Bell size={13} color={G.accent} />
                      : <BellOff size={13} color={colors.text.muted} />
                    }
                    <Text style={[styles.reminderBtnText, reminderOn && { color: G.accent }]}>
                      {reminderOn ? `${pad(reminderHour)}:${pad(reminderMin)}` : 'Dodaj przypomnienie'}
                    </Text>
                  </TouchableOpacity>
                  {reminderOn && (
                    <>
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
                        <TouchableOpacity onPress={() => setReminderHour(h => (h + 23) % 24)} style={styles.stepBtn}>
                          <ChevronUp size={12} color={G.accent} />
                        </TouchableOpacity>
                        <Text style={styles.stepVal}>{pad(reminderHour)}</Text>
                        <TouchableOpacity onPress={() => setReminderHour(h => (h + 1) % 24)} style={styles.stepBtn}>
                          <ChevronDown size={12} color={G.accent} />
                        </TouchableOpacity>
                        <Text style={{ color: G.muted, fontSize: 18, fontWeight: '700' }}>:</Text>
                        <TouchableOpacity onPress={() => setReminderMin(m => (m + 55) % 60)} style={styles.stepBtn}>
                          <ChevronUp size={12} color={G.accent} />
                        </TouchableOpacity>
                        <Text style={styles.stepVal}>{pad(reminderMin)}</Text>
                        <TouchableOpacity onPress={() => setReminderMin(m => (m + 5) % 60)} style={styles.stepBtn}>
                          <ChevronDown size={12} color={G.accent} />
                        </TouchableOpacity>
                      </View>
                      <TextInput
                        value={reminderMsg}
                        onChangeText={setReminderMsg}
                        placeholder="Treść powiadomienia..."
                        placeholderTextColor={colors.text.muted}
                        style={[styles.fieldInput, { minHeight: 56, textAlignVertical: 'top' }]}
                        multiline
                      />
                    </>
                  )}
                </View>
              ) : (
                <Text style={styles.fieldValue}>
                  {task.reminderTime
                    ? `${task.reminderTime}${task.reminderMessage ? ` — "${task.reminderMessage}"` : ''}`
                    : 'Brak'}
                </Text>
              )}
            </Row>

            <Row icon={<RefreshCw size={12} color={colors.text.muted} />} label="Powtarzanie">
              <View style={styles.recurRow}>
                {RECURRING_OPTIONS.map(opt => {
                  const active = (editing ? recurring : (task.recurring ?? 'none')) === opt.value;
                  return (
                    <PressableScale
                      key={opt.value}
                      onPress={() => editing && setRecurring(opt.value)}
                      style={[styles.recurPill, active && styles.recurPillActive]}
                    >
                      <Text style={[styles.recurText, active && styles.recurTextActive]}>{opt.label}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </Row>

            <Row icon={<Flag size={12} color={colors.text.muted} />} label="Trudność">
              <DiffPicker
                value={editing ? difficulty : task.difficulty}
                onChange={v => editing && setDifficulty(v)}
              />
            </Row>

            <Row icon={<Tag size={12} color={colors.text.muted} />} label="Tagi">
              <View style={{ gap: spacing[2] }}>
                <View style={styles.tagsRow}>
                  {(editing ? tags : task.tags ?? []).map(t => (
                    <PressableScale key={t} onPress={() => editing && removeTag(t)}>
                      <View style={styles.tagChip}>
                        <Text style={styles.tagText}>#{t}</Text>
                        {editing && <Text style={styles.tagX}>×</Text>}
                      </View>
                    </PressableScale>
                  ))}
                </View>
                {editing && (
                  <View style={styles.tagInputRow}>
                    <TextInput
                      value={tagInput}
                      onChangeText={setTagInput}
                      onSubmitEditing={addTag}
                      placeholder="+ dodaj tag"
                      placeholderTextColor={colors.text.muted}
                      style={styles.tagInput}
                      returnKeyType="done"
                      blurOnSubmit={false}
                    />
                  </View>
                )}
              </View>
            </Row>

            <Row icon={<AlignLeft size={12} color={colors.text.muted} />} label="Opis">
              {editing ? (
                <TextInput
                  value={description}
                  onChangeText={setDescription}
                  placeholder="Szczegóły, notatki..."
                  placeholderTextColor={colors.text.muted}
                  style={[styles.fieldInput, { minHeight: 80, textAlignVertical: 'top' }]}
                  multiline
                />
              ) : (
                <Text style={styles.fieldValue}>
                  {task.description || 'Brak opisu'}
                </Text>
              )}
            </Row>

            {task.postCompletionMood && (
              <Row icon={<Clock size={12} color={colors.text.muted} />} label="Nastrój po ukończeniu">
                <Text style={styles.fieldValue}>
                  {['','Fatalnie','Słabo','Tak sobie','Dobrze','Świetnie'][task.postCompletionMood]} ({task.postCompletionMood}/5)
                </Text>
              </Row>
            )}

          </View>

          {/* Meta */}
          <View style={styles.metaCard}>
            <Text style={styles.metaText}>
              Utworzono: {new Date(task.createdAt).toLocaleDateString('pl-PL', { day:'numeric', month:'long', year:'numeric' })}
            </Text>
            <Text style={styles.metaText}>
              Ostatnia zmiana: {new Date(task.updatedAt).toLocaleDateString('pl-PL', { day:'numeric', month:'long' })}
            </Text>
          </View>
        </ScrollView>
      </KeyboardAvoidingView>

      <CompletionMoodModal
        visible={moodModal}
        taskTitle={moodTaskTitle}
        onSelect={handleMoodSelect}
        onDismiss={() => setMoodModal(false)}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: G.card, borderWidth: 1, borderColor: G.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  saveBtn: { backgroundColor: G.accent, borderColor: G.accent },
  headerActions: { flexDirection: 'row', gap: spacing[2] },

  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: spacing[10] },

  titleText: { fontSize: 24, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5, lineHeight: 30 },
  titleDone: { textDecorationLine: 'line-through', color: colors.text.secondary },
  titleInput: {
    fontSize: 24, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5,
    lineHeight: 30, padding: 0,
  },

  statusRow: { flexDirection: 'row', gap: spacing[2] },
  statusBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: G.card, borderRadius: radius.full,
    borderWidth: 1, borderColor: G.cardBorder,
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
  },
  statusBtnDone: {
    backgroundColor: G.accent,
    borderColor: G.accent,
  },
  statusText: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
  pomStartBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.accent.purple + '15',
    borderRadius: radius.full, borderWidth: 1, borderColor: colors.accent.purple + '40',
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  pomStartText: { fontSize: 13, fontWeight: '600', color: colors.accent.purple },

  sectionCard: {
    backgroundColor: G.card,
    borderRadius: radius.xl, borderWidth: 1, borderColor: G.cardBorder,
    padding: spacing[4], gap: spacing[1],
  },
  sectionCardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  sectionCardLabel: { fontSize: 10, fontWeight: '700', color: G.muted, textTransform: 'uppercase', letterSpacing: 0.8 },

  pomRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[2] },
  fieldLabel: { fontSize: 12, color: colors.text.secondary },
  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stepBtn: {
    width: 28, height: 28, borderRadius: radius.sm,
    backgroundColor: G.accentDim, borderWidth: 1, borderColor: G.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { fontSize: 16, color: G.accent, lineHeight: 18 },
  stepVal: { fontSize: 18, fontWeight: '700', color: G.accent, minWidth: 24, textAlign: 'center' },

  fieldValue: { fontSize: 14, color: colors.text.secondary, lineHeight: 20 },
  fieldInput: {
    fontSize: 14, color: colors.text.primary, lineHeight: 20,
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md, borderWidth: 1, borderColor: G.cardBorder,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },

  priorityRow: { flexDirection: 'row', gap: spacing[2] },
  priorityPill: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  priorityText: { fontSize: 12, fontWeight: '600', color: colors.text.muted },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: G.accentDim, borderRadius: radius.full,
    borderWidth: 1, borderColor: G.cardBorder,
    paddingHorizontal: spacing[3], paddingVertical: 5,
  },
  tagText: { fontSize: 12, color: G.accent, fontWeight: '600' },
  tagX: { fontSize: 14, color: G.muted, lineHeight: 16 },
  tagInputRow: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md, borderWidth: 1, borderColor: G.cardBorder,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  tagInput: { fontSize: 13, color: colors.text.primary },

  metaCard: {
    gap: spacing[1],
    paddingHorizontal: spacing[1],
  },
  metaText: { fontSize: 11, color: colors.text.muted },

  subtaskProgress: { fontSize: 11, fontWeight: '700', color: G.accent, marginLeft: 'auto' },
  subProgressTrack: { height: 2, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: 1, overflow: 'hidden' },
  subProgressFill: { height: 2, borderRadius: 1 },
  subRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2],
    borderBottomWidth: 1, borderBottomColor: G.cardBorder,
  },
  subTitle: { flex: 1, fontSize: 14, color: colors.text.primary, lineHeight: 19 },
  subTitleDone: { textDecorationLine: 'line-through', color: colors.text.muted },
  subDelete: { padding: 4 },
  subInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginTop: spacing[1], paddingTop: spacing[2],
    borderTopWidth: 1, borderTopColor: G.cardBorder,
  },
  subInput: { flex: 1, fontSize: 14, color: colors.text.primary, paddingVertical: spacing[1] },
  subAddBtn: { padding: 4 },

  recurRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  recurPill: {
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  recurPillActive: { borderColor: G.accent, backgroundColor: G.accentDim },
  recurText: { fontSize: 12, fontWeight: '500', color: colors.text.muted },
  recurTextActive: { color: G.accent, fontWeight: '700' },

  quickDateRow: { flexDirection: 'row', gap: spacing[2], flexWrap: 'wrap' },
  quickDateBtn: {
    paddingHorizontal: spacing[3], paddingVertical: 5,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  quickDateBtnActive: { borderColor: G.accent, backgroundColor: G.accentDim },
  quickDateText: { fontSize: 11, fontWeight: '600', color: colors.text.muted },
  quickDateTextActive: { color: G.accent },

  reminderBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)',
  },
  reminderBtnOn: {
    borderColor: G.accent + '55',
    backgroundColor: G.accentDim,
  },
  reminderBtnText: { fontSize: 13, fontWeight: '600', color: colors.text.muted },

  snoozedBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.accent.amber + '15',
    borderRadius: radius.lg, borderWidth: 1,
    borderColor: colors.accent.amber + '30',
    padding: spacing[3],
  },
  snoozedText: { flex: 1, fontSize: 12, color: colors.accent.amber, lineHeight: 16 },

  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[4] },
  notFoundText: { fontSize: 16, color: colors.text.secondary },
  backBtn: {
    paddingHorizontal: spacing[4], paddingVertical: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.md,
  },
});
