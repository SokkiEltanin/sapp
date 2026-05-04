import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TextInput,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, Check, CalendarDays, Flag, AlignLeft, Timer, Tag, Clock, RefreshCw } from 'lucide-react-native';

import AnimatedButton from '@/components/ui/AnimatedButton';
import PressableScale from '@/components/ui/PressableScale';
import InputField from '@/components/ui/InputField';
import GlassCard from '@/components/ui/GlassCard';
import { EventPriority, TaskDifficulty, TaskStatus, TaskRecurring } from '@/types';
import { tasksService } from '@/services/calendarService';
import { notificationsService } from '@/services/notificationsService';
import { useCalendarStore } from '@/store/calendarStore';
import { toast } from '@/store/toastStore';
import { colors, spacing, radius, typography } from '@/theme';

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── Priority ─────────────────────────────────────────────────────────────────

const PRIORITIES: { value: EventPriority; label: string; sub: string; color: string }[] = [
  { value: 'low',    label: 'Niskie',   sub: 'kiedyś', color: colors.text.muted },
  { value: 'normal', label: 'Normalne', sub: 'wkrótce', color: colors.text.secondary },
  { value: 'high',   label: 'Pilne',    sub: 'asap',   color: colors.accent.danger },
];

// ─── Difficulty ───────────────────────────────────────────────────────────────

function diffColor(level: TaskDifficulty): string {
  if (level <= 2) return colors.accent.success;
  if (level === 3) return colors.accent.warning;
  return colors.accent.danger;
}

function DifficultyPicker({
  value, onChange,
}: { value: TaskDifficulty | undefined; onChange: (v: TaskDifficulty) => void }) {
  return (
    <View style={diff.row}>
      {([1, 2, 3, 4, 5] as TaskDifficulty[]).map((d) => {
        const active = value !== undefined && d <= value;
        const color  = value ? diffColor(value) : 'rgba(255,255,255,0.15)';
        return (
          <PressableScale key={d} onPress={() => onChange(d)} style={diff.dotWrap}>
            <View style={[
              diff.dot,
              { backgroundColor: active ? color : 'rgba(255,255,255,0.08)' },
              active && { width: 18, height: 18 },
            ]} />
          </PressableScale>
        );
      })}
      {value !== undefined && (
        <Text style={[diff.label, { color: diffColor(value) }]}>
          {['', 'Łatwe', 'Proste', 'Średnie', 'Trudne', 'Hardkor'][value]}
        </Text>
      )}
    </View>
  );
}

const diff = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dotWrap: { padding: 4 },
  dot: { width: 14, height: 14, borderRadius: 7 },
  label: { fontSize: 12, fontWeight: '600', marginLeft: spacing[1] },
});

// ─── Pomodoro stepper ─────────────────────────────────────────────────────────

function PomodoroStepper({
  value, onChange,
}: { value: number; onChange: (v: number) => void }) {
  return (
    <View style={pom.row}>
      <PressableScale
        onPress={() => onChange(Math.max(0, value - 1))}
        style={[pom.btn, value === 0 && pom.btnDisabled]}
      >
        <Text style={pom.btnText}>−</Text>
      </PressableScale>
      <View style={pom.display}>
        <Text style={pom.count}>{value}</Text>
        <Text style={pom.unit}>× 25 min</Text>
      </View>
      <PressableScale
        onPress={() => onChange(Math.min(12, value + 1))}
        style={pom.btn}
      >
        <Text style={pom.btnText}>+</Text>
      </PressableScale>
      {value > 0 && (
        <Text style={pom.total}>{value * 25} min łącznie</Text>
      )}
    </View>
  );
}

const pom = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  btn: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },
  btnDisabled: { opacity: 0.35 },
  btnText: { color: colors.text.primary, fontSize: 18, lineHeight: 20 },
  display: { alignItems: 'center', minWidth: 50 },
  count: { fontSize: 22, fontWeight: '700', color: colors.text.primary, lineHeight: 26 },
  unit: { fontSize: 9, color: colors.text.muted },
  total: { fontSize: 11, color: colors.text.secondary, marginLeft: spacing[1] },
});

// ─── Tag input ────────────────────────────────────────────────────────────────

function TagInput({ tags, onChange }: { tags: string[]; onChange: (tags: string[]) => void }) {
  const [input, setInput] = useState('');

  const add = () => {
    const t = input.trim().toLowerCase().replace(/\s+/g, '_');
    if (t && !tags.includes(t)) onChange([...tags, t]);
    setInput('');
  };

  return (
    <View style={tag.wrap}>
      <View style={tag.row}>
        {tags.map((t) => (
          <PressableScale key={t} onPress={() => onChange(tags.filter((x) => x !== t))}>
            <View style={tag.chip}>
              <Text style={tag.chipText}>#{t}</Text>
              <X size={9} color={colors.text.muted} />
            </View>
          </PressableScale>
        ))}
      </View>
      <View style={tag.inputRow}>
        <TextInput
          value={input}
          onChangeText={setInput}
          onSubmitEditing={add}
          placeholder="Dodaj tag..."
          placeholderTextColor={colors.text.muted}
          style={tag.input}
          returnKeyType="done"
          blurOnSubmit={false}
        />
        {input.trim().length > 0 && (
          <PressableScale onPress={add} style={tag.addBtn}>
            <Check size={13} color={colors.accent.success} strokeWidth={3} />
          </PressableScale>
        )}
      </View>
    </View>
  );
}

const tag = StyleSheet.create({
  wrap: { gap: spacing[2] },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  chip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    paddingHorizontal: spacing[3], paddingVertical: 5,
  },
  chipText: { fontSize: 11, color: colors.text.secondary, fontWeight: '500' },
  inputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    paddingHorizontal: spacing[3], minHeight: 40,
  },
  input: { flex: 1, ...typography.body, color: colors.text.primary, fontSize: 13 },
  addBtn: { padding: 4 },
});

// ─── Recurring options ────────────────────────────────────────────────────────

const RECURRING_OPTIONS: { value: TaskRecurring; label: string }[] = [
  { value: 'none',    label: 'Brak' },
  { value: 'daily',   label: 'Codziennie' },
  { value: 'weekly',  label: 'Co tydzień' },
  { value: 'monthly', label: 'Co miesiąc' },
];

// ─── Section label ────────────────────────────────────────────────────────────

function SectionLabel({ icon, label }: { icon: React.ReactNode; label: string }) {
  return (
    <View style={sec.row}>
      {icon}
      <Text style={sec.text}>{label}</Text>
    </View>
  );
}

const sec = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[2] },
  text: { fontSize: 11, fontWeight: '600', color: colors.text.secondary, textTransform: 'uppercase', letterSpacing: 0.8 },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AddTaskScreen() {
  const [title, setTitle]           = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline]     = useState('');
  const [scheduledDate, setScheduledDate] = useState('');
  const [priority, setPriority]     = useState<EventPriority>('normal');
  const [difficulty, setDifficulty] = useState<TaskDifficulty | undefined>(undefined);
  const [pomodoros, setPomodoros]   = useState(0);
  const [tags, setTags]             = useState<string[]>([]);
  const [recurring, setRecurring]   = useState<TaskRecurring>('none');
  const [saving, setSaving]         = useState(false);

  const { selectedDate, addTask } = useCalendarStore();

  const handleSave = async () => {
    if (!title.trim()) {
      toast.error('Wpisz tytuł zadania');
      return;
    }
    setSaving(true);
    try {
      const deadlineDate = deadline.trim() || selectedDate || todayStr();
      const deadlineIso  = deadlineDate + 'T23:59:00.000Z';
      const task = await tasksService.addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadlineIso,
        scheduledDate: scheduledDate.trim() || selectedDate || undefined,
        status: 'pending' as TaskStatus,
        priority,
        difficulty: difficulty ?? undefined,
        estimatedPomodoros: pomodoros > 0 ? pomodoros : undefined,
        completedPomodoros: 0,
        tags,
        recurring,
      });
      addTask(task);
      notificationsService.scheduleTaskDeadlineReminder(task.id, task.title, deadlineIso).catch(() => {});
      toast.success('Zadanie dodane');
      router.back();
    } catch (e: any) {
      toast.error(e.message ?? 'Błąd zapisu');
    } finally {
      setSaving(false);
    }
  };

  return (
    <SafeAreaView style={styles.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={20}
      >
        {/* Header */}
        <View style={styles.header}>
          <PressableScale onPress={() => router.back()} style={styles.closeBtn}>
            <X size={20} color={colors.text.secondary} />
          </PressableScale>
          <Text style={styles.headerTitle}>Nowe zadanie</Text>
          <View style={{ width: 36 }} />
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Title */}
          <View>
            <GlassCard style={styles.titleCard}>
              <TextInput
                value={title}
                onChangeText={setTitle}
                placeholder="Co trzeba zrobić?"
                placeholderTextColor={colors.text.muted}
                style={styles.titleInput}
                multiline
                autoFocus
              />
            </GlassCard>
          </View>

          {/* Priority */}
          <View>
            <GlassCard padding={spacing[4]}>
              <SectionLabel icon={<Flag size={12} color={colors.text.muted} />} label="Priorytet" />
              <View style={styles.priorityRow}>
                {PRIORITIES.map((opt) => {
                  const active = priority === opt.value;
                  return (
                    <PressableScale
                      key={opt.value}
                      onPress={() => setPriority(opt.value)}
                      style={[
                        styles.priorityBtn,
                        active && { borderColor: opt.color, backgroundColor: opt.color + '12' },
                      ]}
                    >
                      <Text style={[styles.priorityLabel, active && { color: opt.color, fontWeight: '700' }]}>
                        {opt.label}
                      </Text>
                      <Text style={styles.prioritySub}>{opt.sub}</Text>
                    </PressableScale>
                  );
                })}
              </View>
            </GlassCard>
          </View>

          {/* Difficulty */}
          <View>
            <GlassCard padding={spacing[4]}>
              <SectionLabel icon={<Flag size={12} color={colors.text.muted} />} label="Trudność" />
              <DifficultyPicker value={difficulty} onChange={setDifficulty} />
            </GlassCard>
          </View>

          {/* Pomodoros */}
          <View>
            <GlassCard padding={spacing[4]}>
              <SectionLabel icon={<Timer size={12} color={colors.text.muted} />} label="Szacowany czas" />
              <PomodoroStepper value={pomodoros} onChange={setPomodoros} />
            </GlassCard>
          </View>

          {/* Recurring */}
          <View>
            <GlassCard padding={spacing[4]}>
              <SectionLabel icon={<RefreshCw size={12} color={colors.text.muted} />} label="Powtarzanie" />
              <View style={rec.row}>
                {RECURRING_OPTIONS.map((opt) => {
                  const active = recurring === opt.value;
                  return (
                    <PressableScale
                      key={opt.value}
                      onPress={() => setRecurring(opt.value)}
                      style={[rec.pill, active && rec.pillActive]}
                    >
                      <Text style={[rec.pillText, active && rec.pillTextActive]}>
                        {opt.label}
                      </Text>
                    </PressableScale>
                  );
                })}
              </View>
            </GlassCard>
          </View>

          {/* Deadline */}
          <View>
            <GlassCard padding={spacing[4]}>
              <SectionLabel icon={<CalendarDays size={12} color={colors.text.muted} />} label="Termin" />
              <View style={{ gap: spacing[3] }}>
                <InputField
                  value={deadline}
                  onChangeText={setDeadline}
                  placeholder={selectedDate || todayStr()}
                  leftSlot={<Clock size={14} color={colors.text.muted} />}
                  keyboardType="numbers-and-punctuation"
                  containerStyle={styles.inputInCard}
                />
                <InputField
                  label="Zaplanuj na dzień"
                  value={scheduledDate}
                  onChangeText={setScheduledDate}
                  placeholder={selectedDate || todayStr()}
                  leftSlot={<CalendarDays size={14} color={colors.text.muted} />}
                  keyboardType="numbers-and-punctuation"
                  containerStyle={styles.inputInCard}
                />
              </View>
            </GlassCard>
          </View>

          {/* Tags */}
          <View>
            <GlassCard padding={spacing[4]}>
              <SectionLabel icon={<Tag size={12} color={colors.text.muted} />} label="Tagi" />
              <TagInput tags={tags} onChange={setTags} />
            </GlassCard>
          </View>

          {/* Description */}
          <View>
            <GlassCard padding={spacing[4]}>
              <SectionLabel icon={<AlignLeft size={12} color={colors.text.muted} />} label="Opis (opcjonalnie)" />
              <TextInput
                value={description}
                onChangeText={setDescription}
                placeholder="Szczegóły, notatki..."
                placeholderTextColor={colors.text.muted}
                style={styles.descInput}
                multiline
                numberOfLines={3}
                textAlignVertical="top"
              />
            </GlassCard>
          </View>
        </ScrollView>

        <View style={styles.footer}>
          <AnimatedButton
            onPress={handleSave}
            label={saving ? 'Zapisuję...' : 'Dodaj zadanie'}
            icon={<Check size={18} color={colors.bg.primary} />}
            size="lg"
            fullWidth
            disabled={saving || !title.trim()}
          />
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  closeBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)', alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  headerTitle: { ...typography.h4, color: colors.text.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[8] },

  titleCard: { padding: spacing[4], minHeight: 80 },
  titleInput: {
    fontSize: 20, fontWeight: '600', color: colors.text.primary,
    lineHeight: 28, letterSpacing: -0.3,
  },

  priorityRow: { flexDirection: 'row', gap: spacing[2] },
  priorityBtn: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[3],
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)', gap: 3,
  },
  priorityLabel: { fontSize: 13, fontWeight: '600', color: colors.text.muted },
  prioritySub: { fontSize: 10, color: colors.text.muted },

  inputInCard: { backgroundColor: 'rgba(255,255,255,0.04)' },

  descInput: {
    ...typography.body, color: colors.text.primary,
    fontSize: 14, minHeight: 72, lineHeight: 22,
  },

  footer: {
    padding: spacing[4],
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
});

const rec = StyleSheet.create({
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  pill: {
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  pillActive: {
    borderColor: colors.accent.primary,
    backgroundColor: colors.accent.primary + '20',
  },
  pillText: { fontSize: 13, color: colors.text.muted, fontWeight: '500' },
  pillTextActive: { color: colors.accent.primary, fontWeight: '700' },
});

