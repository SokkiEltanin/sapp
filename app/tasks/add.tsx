import { useState, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TextInput,
  TouchableOpacity, InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  X, Check, CalendarDays, Flag, AlignLeft, Timer,
  Bell, BellOff, ChevronUp, ChevronDown,
} from 'lucide-react-native';

import { EventPriority, TaskDifficulty, TaskStatus, TaskRecurring } from '@/types';
import { tasksService } from '@/services/calendarService';
import { notificationsService } from '@/services/notificationsService';
import { useCalendarStore } from '@/store/calendarStore';
import { toast } from '@/store/toastStore';
import { colors, spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';

// ─── Green palette ────────────────────────────────────────────────────────────

const G = {
  card:       '#0D2318',
  cardBorder: 'rgba(61,190,117,0.18)',
  accent:     '#3DBE75',
  accentDim:  'rgba(61,190,117,0.14)',
  muted:      'rgba(61,190,117,0.45)',
};

// ─── Helpers ──────────────────────────────────────────────────────���───────────

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function offsetDate(days: number): string {
  const d = new Date(); d.setDate(d.getDate() + days);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

// ─── Quick deadline chips ──────────────────��──────────────────────────────────

const DEADLINE_CHIPS = [
  { label: 'Bez terminu', value: null },
  { label: 'Dziś',        value: 0 },
  { label: 'Jutro',       value: 1 },
  { label: 'Ten tydz.',   value: 7 },
] as const;

// ─── Priority chips ───────────────────────────────────────────────────��───────

const PRIORITIES: { value: EventPriority; label: string; color: string }[] = [
  { value: 'low',    label: 'Niskie',   color: colors.text.muted },
  { value: 'normal', label: 'Normalne', color: G.accent },
  { value: 'high',   label: 'Pilne',    color: colors.accent.red },
];

// ─── Time picker ──────────────────────���───────────────────────────��───────────

function TimePicker({ hour, minute, onChange }: {
  hour: number; minute: number; onChange: (h: number, m: number) => void;
}) {
  return (
    <View style={tp.row}>
      <View style={tp.unit}>
        <TouchableOpacity onPress={() => onChange((hour + 23) % 24, minute)} style={tp.arrow} activeOpacity={0.7}>
          <ChevronUp size={14} color={G.accent} />
        </TouchableOpacity>
        <Text style={tp.digit}>{pad(hour)}</Text>
        <TouchableOpacity onPress={() => onChange((hour + 1) % 24, minute)} style={tp.arrow} activeOpacity={0.7}>
          <ChevronDown size={14} color={G.accent} />
        </TouchableOpacity>
      </View>
      <Text style={tp.sep}>:</Text>
      <View style={tp.unit}>
        <TouchableOpacity onPress={() => onChange(hour, (minute + 55) % 60)} style={tp.arrow} activeOpacity={0.7}>
          <ChevronUp size={14} color={G.accent} />
        </TouchableOpacity>
        <Text style={tp.digit}>{pad(minute)}</Text>
        <TouchableOpacity onPress={() => onChange(hour, (minute + 5) % 60)} style={tp.arrow} activeOpacity={0.7}>
          <ChevronDown size={14} color={G.accent} />
        </TouchableOpacity>
      </View>
    </View>
  );
}

const tp = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  unit: { alignItems: 'center', gap: 2 },
  arrow: {
    width: 36, height: 28, borderRadius: radius.sm,
    backgroundColor: G.accentDim, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: G.cardBorder,
  },
  digit: { fontSize: 24, fontWeight: '800', color: G.accent, minWidth: 40, textAlign: 'center' },
  sep: { fontSize: 24, fontWeight: '800', color: G.muted, marginBottom: 2 },
});

// ─── Section card ────────────────────��───────────────────────────────────���────

function SectionCard({ label, icon, children }: {
  label: string; icon: React.ReactNode; children: React.ReactNode;
}) {
  return (
    <View style={sc.card}>
      <View style={sc.header}>
        {icon}
        <Text style={sc.label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    backgroundColor: G.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: G.cardBorder, padding: spacing[4], gap: spacing[3],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  label: { fontSize: 10, fontWeight: '700', color: G.muted, textTransform: 'uppercase', letterSpacing: 1.1 },
});

// ─── Screen ───────────────────────────��──────────────────────────────��────────

export default function AddTaskScreen() {
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline]       = useState('');
  const [priority, setPriority]       = useState<EventPriority>('normal');
  const [saving, setSaving]           = useState(false);

  // Reminder
  const [reminderOn, setReminderOn]       = useState(false);
  const [reminderHour, setReminderHour]   = useState(9);
  const [reminderMin, setReminderMin]     = useState(0);
  const [reminderMsg, setReminderMsg]     = useState('');

  // Advanced (collapsed by default)
  const [showAdvanced, setShowAdvanced]   = useState(false);
  const [difficulty, setDifficulty]       = useState<TaskDifficulty | undefined>(undefined);
  const [pomodoros, setPomodoros]         = useState(0);
  const [recurring, setRecurring]         = useState<TaskRecurring>('none');
  const [tags, setTags]                   = useState<string[]>([]);
  const [tagInput, setTagInput]           = useState('');

  const { selectedDate, addTask } = useCalendarStore();
  const titleRef = useRef<TextInput>(null);

  // ── Deadline chips logic ─────────────────────────────────────────────────
  const selectDeadlineChip = (offset: number | null) => {
    haptic.tap();
    setDeadline(offset === null ? '' : offsetDate(offset));
  };
  const activeChip = (offset: number | null): boolean => {
    if (offset === null) return !deadline;
    return deadline === offsetDate(offset);
  };

  // ── Tags ──────��──────────────────────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  // ── Save ──────────────────���──────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { toast.error('Wpisz tytuł zadania'); return; }
    setSaving(true);
    try {
      const deadlineIso = deadline ? deadline + 'T23:59:00.000Z' : undefined;
      const reminderTime = reminderOn ? `${pad(reminderHour)}:${pad(reminderMin)}` : undefined;
      const reminderMessage = reminderOn && reminderMsg.trim() ? reminderMsg.trim() : undefined;

      const task = await tasksService.addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadlineIso,
        scheduledDate: deadline || selectedDate || undefined,
        status: 'pending' as TaskStatus,
        priority,
        difficulty,
        estimatedPomodoros: pomodoros > 0 ? pomodoros : undefined,
        completedPomodoros: 0,
        tags,
        recurring,
        reminderTime,
        reminderMessage,
      });

      // Schedule reminder — use deadline date or today if no deadline
      if (reminderTime) {
        notificationsService.scheduleCustomTaskReminder(
          task.id, task.title,
          deadline || todayStr(),
          reminderTime,
          reminderMessage,
        ).catch(() => {});
      }

      toast.success('Zadanie dodane');
      router.back();
      InteractionManager.runAfterInteractions(() => addTask(task));
    } catch (e: any) {
      setSaving(false);
      toast.error(e.message ?? 'Błąd zapisu');
    }
  };

  const canSave = !!title.trim() && !saving;

  return (
    <SafeAreaView style={s.container} edges={['top', 'bottom']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
        keyboardVerticalOffset={20}
      >

        {/* ── Header ── */}
        <View style={s.header}>
          <TouchableOpacity onPress={() => router.back()} style={s.closeBtn} activeOpacity={0.7}>
            <X size={18} color={colors.text.muted} />
          </TouchableOpacity>
          <Text style={s.headerTitle}>Nowe zadanie</Text>
          <TouchableOpacity
            onPress={handleSave}
            disabled={!canSave}
            style={[s.saveBtn, !canSave && s.saveBtnDisabled]}
            activeOpacity={0.8}
          >
            <Check size={15} color={canSave ? colors.bg.primary : colors.text.muted} strokeWidth={2.5} />
            <Text style={[s.saveBtnText, !canSave && { color: colors.text.muted }]}>
              {saving ? 'Zapis...' : 'Zapisz'}
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView
          style={{ flex: 1 }}
          contentContainerStyle={s.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >

          {/* ── Title card ── */}
          <View style={s.titleCard}>
            <TextInput
              ref={titleRef}
              value={title}
              onChangeText={setTitle}
              placeholder="Co trzeba zrobić?"
              placeholderTextColor={G.muted}
              style={s.titleInput}
              multiline
              autoFocus
            />
          </View>

          {/* ── Deadline ── */}
          <SectionCard
            label="Termin"
            icon={<CalendarDays size={12} color={G.muted} />}
          >
            <View style={s.chipRow}>
              {DEADLINE_CHIPS.map(chip => {
                const active = activeChip(chip.value);
                return (
                  <TouchableOpacity
                    key={chip.label}
                    style={[s.deadlineChip, active && s.deadlineChipActive]}
                    onPress={() => selectDeadlineChip(chip.value)}
                    activeOpacity={0.75}
                  >
                    <Text style={[s.deadlineChipText, active && s.deadlineChipTextActive]}>
                      {chip.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            {deadline ? (
              <Text style={s.deadlineDate}>{deadline}</Text>
            ) : null}
          </SectionCard>

          {/* ── Priority ── */}
          <SectionCard
            label="Priorytet"
            icon={<Flag size={12} color={G.muted} />}
          >
            <View style={s.priorityRow}>
              {PRIORITIES.map(p => {
                const active = priority === p.value;
                return (
                  <TouchableOpacity
                    key={p.value}
                    style={[s.priorityChip, active && { borderColor: p.color, backgroundColor: p.color + '18' }]}
                    onPress={() => { haptic.tap(); setPriority(p.value); }}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.priorityChipText, active && { color: p.color, fontWeight: '700' }]}>
                      {p.label}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </SectionCard>

          {/* ── Reminder ── */}
          <SectionCard
            label="Powiadomienie"
            icon={<Bell size={12} color={reminderOn ? G.accent : G.muted} />}
          >
            {/* Toggle */}
            <TouchableOpacity
              style={[s.reminderToggle, reminderOn && s.reminderToggleOn]}
              onPress={() => { haptic.tap(); setReminderOn(v => !v); }}
              activeOpacity={0.8}
            >
              {reminderOn
                ? <Bell size={14} color={G.accent} />
                : <BellOff size={14} color={colors.text.muted} />
              }
              <Text style={[s.reminderToggleText, reminderOn && { color: G.accent }]}>
                {reminderOn
                  ? `Przypomnienie o ${pad(reminderHour)}:${pad(reminderMin)}`
                  : 'Dodaj przypomnienie'}
              </Text>
              {reminderOn && (
                <TouchableOpacity
                  style={s.reminderClear}
                  onPress={() => { haptic.tap(); setReminderOn(false); }}
                  hitSlop={8}
                >
                  <X size={12} color={colors.text.muted} />
                </TouchableOpacity>
              )}
            </TouchableOpacity>

            {reminderOn && (
              <>
                <TimePicker
                  hour={reminderHour}
                  minute={reminderMin}
                  onChange={(h, m) => { setReminderHour(h); setReminderMin(m); }}
                />
                <TextInput
                  value={reminderMsg}
                  onChangeText={setReminderMsg}
                  placeholder="Treść powiadomienia (opcjonalnie)..."
                  placeholderTextColor={G.muted}
                  style={s.reminderMsgInput}
                  multiline
                  returnKeyType="done"
                />
              </>
            )}
          </SectionCard>

          {/* ── Description ── */}
          <SectionCard
            label="Opis"
            icon={<AlignLeft size={12} color={G.muted} />}
          >
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Szczegóły, notatki..."
              placeholderTextColor={G.muted}
              style={s.descInput}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />
          </SectionCard>

          {/* ── Advanced options (collapsed) ── */}
          <TouchableOpacity
            style={s.advancedToggle}
            onPress={() => setShowAdvanced(v => !v)}
            activeOpacity={0.75}
          >
            <Timer size={12} color={G.muted} />
            <Text style={s.advancedToggleText}>
              {showAdvanced ? 'Ukryj opcje zaawansowane' : 'Więcej opcji'}
            </Text>
            {showAdvanced
              ? <ChevronUp size={13} color={G.muted} />
              : <ChevronDown size={13} color={G.muted} />
            }
          </TouchableOpacity>

          {showAdvanced && (
            <>
              {/* Difficulty */}
              <View style={s.advCard}>
                <Text style={s.advLabel}>TRUDNOŚĆ</Text>
                <View style={s.diffRow}>
                  {([1, 2, 3, 4, 5] as TaskDifficulty[]).map(d => {
                    const active = difficulty !== undefined && d <= difficulty;
                    const col = difficulty ? (difficulty <= 2 ? G.accent : difficulty === 3 ? colors.accent.amber : colors.accent.red) : G.accent;
                    return (
                      <TouchableOpacity key={d} onPress={() => setDifficulty(d)} style={s.diffDotWrap} activeOpacity={0.7}>
                        <View style={[
                          s.diffDot,
                          active && { backgroundColor: col, width: 18, height: 18 },
                          !active && { backgroundColor: 'rgba(255,255,255,0.07)' },
                        ]} />
                      </TouchableOpacity>
                    );
                  })}
                  {difficulty !== undefined && (
                    <Text style={[s.diffLabel, { color: difficulty <= 2 ? G.accent : difficulty === 3 ? colors.accent.amber : colors.accent.red }]}>
                      {['', 'Łatwe', 'Proste', 'Średnie', 'Trudne', 'Hardkor'][difficulty]}
                    </Text>
                  )}
                </View>
              </View>

              {/* Pomodoros */}
              <View style={s.advCard}>
                <Text style={s.advLabel}>SZAC. CZAS (× 25 MIN)</Text>
                <View style={s.stepperRow}>
                  <TouchableOpacity
                    style={[s.stepBtn, pomodoros === 0 && { opacity: 0.35 }]}
                    onPress={() => setPomodoros(p => Math.max(0, p - 1))}
                    disabled={pomodoros === 0}
                    activeOpacity={0.7}
                  >
                    <Text style={s.stepBtnText}>−</Text>
                  </TouchableOpacity>
                  <Text style={s.stepVal}>{pomodoros}</Text>
                  <TouchableOpacity
                    style={s.stepBtn}
                    onPress={() => setPomodoros(p => Math.min(12, p + 1))}
                    activeOpacity={0.7}
                  >
                    <Text style={s.stepBtnText}>+</Text>
                  </TouchableOpacity>
                  {pomodoros > 0 && (
                    <Text style={s.stepHint}>{pomodoros * 25} min łącznie</Text>
                  )}
                </View>
              </View>

              {/* Recurring */}
              <View style={s.advCard}>
                <Text style={s.advLabel}>POWTARZANIE</Text>
                <View style={s.chipRow}>
                  {(['none', 'daily', 'weekly', 'monthly'] as TaskRecurring[]).map(r => {
                    const label = { none: 'Brak', daily: 'Dziennie', weekly: 'Tygodniowo', monthly: 'Miesięcznie' }[r];
                    const active = recurring === r;
                    return (
                      <TouchableOpacity
                        key={r}
                        style={[s.deadlineChip, active && s.deadlineChipActive]}
                        onPress={() => setRecurring(r)}
                        activeOpacity={0.75}
                      >
                        <Text style={[s.deadlineChipText, active && s.deadlineChipTextActive]}>{label}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>

              {/* Tags */}
              <View style={s.advCard}>
                <Text style={s.advLabel}>TAGI</Text>
                {tags.length > 0 && (
                  <View style={s.tagsRow}>
                    {tags.map(t => (
                      <TouchableOpacity
                        key={t} onPress={() => setTags(prev => prev.filter(x => x !== t))}
                        style={s.tagChip} activeOpacity={0.8}
                      >
                        <Text style={s.tagText}>#{t}</Text>
                        <X size={9} color={G.muted} />
                      </TouchableOpacity>
                    ))}
                  </View>
                )}
                <View style={s.tagInputRow}>
                  <TextInput
                    value={tagInput}
                    onChangeText={setTagInput}
                    onSubmitEditing={addTag}
                    placeholder="Dodaj tag..."
                    placeholderTextColor={G.muted}
                    style={s.tagInput}
                    returnKeyType="done"
                    blurOnSubmit={false}
                  />
                  {tagInput.trim().length > 0 && (
                    <TouchableOpacity onPress={addTag} style={s.tagAddBtn} activeOpacity={0.8}>
                      <Check size={13} color={G.accent} strokeWidth={3} />
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </>
          )}

          <View style={{ height: 20 }} />
        </ScrollView>

        {/* ── Footer CTA ── */}
        <View style={s.footer}>
          <TouchableOpacity
            style={[s.cta, !canSave && s.ctaDisabled]}
            onPress={handleSave}
            disabled={!canSave}
            activeOpacity={0.85}
          >
            <Check size={18} color={colors.bg.primary} strokeWidth={2.5} />
            <Text style={s.ctaText}>{saving ? 'Zapisuję...' : 'Dodaj zadanie'}</Text>
          </TouchableOpacity>
        </View>

      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)',
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: colors.text.primary, letterSpacing: -0.2 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: G.accent, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: 7,
  },
  saveBtnDisabled: { backgroundColor: 'rgba(61,190,117,0.15)', borderWidth: 1, borderColor: G.cardBorder },
  saveBtnText: { fontSize: 12, fontWeight: '700', color: colors.bg.primary },

  scroll: { paddingHorizontal: spacing[4], paddingTop: spacing[3], gap: spacing[3] },

  titleCard: {
    backgroundColor: G.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: G.cardBorder,
    padding: spacing[4], minHeight: 96,
  },
  titleInput: {
    fontSize: 20, fontWeight: '700', color: colors.text.primary,
    lineHeight: 28, letterSpacing: -0.3, padding: 0,
  },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  deadlineChip: {
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
    backgroundColor: 'rgba(255,255,255,0.04)',
  },
  deadlineChipActive: {
    borderColor: G.accent,
    backgroundColor: G.accentDim,
  },
  deadlineChipText: { fontSize: 12, fontWeight: '600', color: colors.text.muted },
  deadlineChipTextActive: { color: G.accent, fontWeight: '700' },
  deadlineDate: { fontSize: 11, color: G.muted, marginTop: -spacing[1] },

  priorityRow: { flexDirection: 'row', gap: spacing[2] },
  priorityChip: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[3],
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  priorityChipText: { fontSize: 13, fontWeight: '600', color: colors.text.muted },

  reminderToggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
    backgroundColor: 'rgba(255,255,255,0.03)',
  },
  reminderToggleOn: {
    borderColor: G.accent + '55',
    backgroundColor: G.accentDim,
  },
  reminderToggleText: { flex: 1, fontSize: 13, fontWeight: '600', color: colors.text.muted },
  reminderClear: { padding: 4 },
  reminderMsgInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md, borderWidth: 1,
    borderColor: G.cardBorder,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    fontSize: 13, color: colors.text.primary, lineHeight: 18,
    minHeight: 60, textAlignVertical: 'top',
  },

  descInput: {
    fontSize: 14, color: colors.text.secondary, lineHeight: 21,
    minHeight: 72, padding: 0, textAlignVertical: 'top',
  },

  advancedToggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2], paddingHorizontal: spacing[1],
  },
  advancedToggleText: { flex: 1, fontSize: 12, color: G.muted, fontWeight: '600' },

  advCard: {
    backgroundColor: G.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: G.cardBorder,
    padding: spacing[4], gap: spacing[3],
  },
  advLabel: {
    fontSize: 9, fontWeight: '700', color: G.muted,
    letterSpacing: 1.1, textTransform: 'uppercase',
  },

  diffRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  diffDotWrap: { padding: 4 },
  diffDot: { width: 14, height: 14, borderRadius: 7 },
  diffLabel: { fontSize: 12, fontWeight: '600', marginLeft: spacing[1] },

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  stepBtn: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: G.accentDim, borderWidth: 1, borderColor: G.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  stepBtnText: { color: G.accent, fontSize: 18, lineHeight: 20, fontWeight: '700' },
  stepVal: { fontSize: 22, fontWeight: '800', color: G.accent, minWidth: 30, textAlign: 'center' },
  stepHint: { fontSize: 11, color: G.muted },

  tagsRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  tagChip: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: spacing[3], paddingVertical: 5,
    backgroundColor: G.accentDim, borderRadius: radius.full,
    borderWidth: 1, borderColor: G.cardBorder,
  },
  tagText: { fontSize: 11, color: G.accent, fontWeight: '600' },
  tagInputRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md, borderWidth: 1, borderColor: G.cardBorder,
    paddingHorizontal: spacing[3], minHeight: 40,
  },
  tagInput: { flex: 1, fontSize: 13, color: colors.text.primary },
  tagAddBtn: { padding: 4 },

  footer: {
    padding: spacing[4],
    borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)',
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    backgroundColor: G.accent, borderRadius: radius.xl,
    paddingVertical: 15, width: '100%',
  },
  ctaDisabled: { backgroundColor: 'rgba(61,190,117,0.18)' },
  ctaText: { fontSize: 15, fontWeight: '800', color: colors.bg.primary, letterSpacing: -0.2 },
});
