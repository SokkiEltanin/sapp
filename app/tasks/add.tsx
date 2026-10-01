import { useState, useRef, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  KeyboardAvoidingView, Platform, TextInput,
  TouchableOpacity, InteractionManager,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  X, Check, CalendarDays, Flag, Timer,
  Bell, BellOff, ChevronUp, ChevronDown, Plus,
  Zap, Target, Hourglass,
} from 'lucide-react-native';

import { EventPriority, TaskStatus, TaskRecurring, Subtask, TaskKind } from '@/types';
import { KIND_META, KIND_ORDER, inferKind } from '@/utils/taskKind';
import { weekChipInfo } from '@/utils/weekChips';
import { tasksService } from '@/services/calendarService';
import DatePickerField from '@/components/ui/DatePickerField';
import TimePickerField from '@/components/ui/TimePickerField';
import { notificationsService } from '@/services/notificationsService';
import { useCalendarStore } from '@/store/calendarStore';
import { toast } from '@/store/toastStore';
import { colors, spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// ─── Green palette ────────────────────────────────────────────────────────────

const G = {
  card:       '#0C2218',
  cardBorder: 'rgba(46,222,160,0.20)',
  accent:     '#ECEEEE',
  accentDim:  'rgba(46,222,160,0.18)',
  muted:      'rgba(46,222,160,0.50)',
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

// ─── Quick deadline chips ──────────────────────────────────────────────────────
// Etykiety ZOSTAJĄ widoczne (2026-10-01, user: "coś innego może być z napisem dzisiaj
// jutro w tym tyg." — w przeciwieństwie do usuniętych nagłówków sekcji, te chipy SĄ
// swoją własną treścią, nie dekoracją nad treścią). Zakresy tygodni (`weekChipInfo`,
// @/utils/weekChips.ts — wydzielone stamtąd żeby dało się je przetestować w Jest) liczone
// na żywo przy każdym renderze, ten sam wzorzec co `offsetDate()` niżej — user: "jak
// zaznaczam [ten tydzień] żeby pokazywało ten tydzień przyszły tydzień i w nawiasie który"
// — poprzednia wersja miała JEDEN chip "Ten tydz." = +7 dni, co nie było ani "tym
// tygodniem" ani jednoznaczne; teraz dwa chipy z czytelnym zakresem dat w nawiasie.
function buildDeadlineChips(): { label: string; date: string | null }[] {
  const thisWeek = weekChipInfo(0);
  const nextWeek = weekChipInfo(1);
  return [
    { label: 'Bez terminu', date: null },
    { label: 'Dziś', date: todayStr() },
    { label: 'Jutro', date: offsetDate(1) },
    { label: `Ten tydz. (${thisWeek.range})`, date: thisWeek.sundayStr },
    { label: `Przyszły tydz. (${nextWeek.range})`, date: nextWeek.sundayStr },
  ];
}

// ─── Priority chips ───────────────────────────────────────────────────��───────

const PRIORITIES: { value: EventPriority; label: string; color: string }[] = [
  { value: 'low',    label: 'Niskie',   color: colors.text.muted },
  { value: 'normal', label: 'Normalne', color: G.accent },
  { value: 'high',   label: 'Pilne',    color: colors.accent.red },
];

// ─── Time picker ──────────────────────���───────────────────────────��───────────

// TimePicker/makeTp (chevron ±1/±5 stepper) removed 2026-08-09 — replaced by
// TimePickerField (scroll wheel, src/components/ui/TimePickerField.tsx).

// ─── Screen ─────────────────────────────────────────────────────────────────

export default function AddTaskScreen() {
  const colors = useColors();
  const s = useMemo(() => makeS(colors), [colors]);
  const [title, setTitle]             = useState('');
  const [description, setDescription] = useState('');
  const [deadline, setDeadline]       = useState('');
  const [priority, setPriority]       = useState<EventPriority>('normal');
  const [saving, setSaving]           = useState(false);

  // Typ zadania — auto-zgadnięty z tytułu, dopóki nie zmienisz ręcznie.
  const [kind, setKind]               = useState<TaskKind>('quick');
  const [kindTouched, setKindTouched] = useState(false);
  const [waitingFor, setWaitingFor]   = useState('');   // poczekalnia: na co czekasz
  const [wakeAt, setWakeAt]           = useState('');    // poczekalnia: obudź gdy (YYYY-MM-DD)
  const KIND_ICON: Record<TaskKind, any> = { quick: Zap, deep: Target, waiting: Hourglass };
  const onTitleChange = (t: string) => {
    setTitle(t);
    if (!kindTouched) setKind(inferKind(t));
  };

  // Reminder
  const [reminderOn, setReminderOn]       = useState(false);
  const [reminderClock, setReminderClock] = useState('09:00');   // 'HH:MM'
  const [reminderDate, setReminderDate]   = useState('');        // '' = follow deadline||dziś (see handleSave)
  const [reminderMsg, setReminderMsg]     = useState('');

  // Milestones — break the task into small steps up front (easier to start)
  const [milestones, setMilestones]       = useState<string[]>([]);
  const [msInput, setMsInput]             = useState('');

  // Advanced (collapsed by default)
  const [showAdvanced, setShowAdvanced]   = useState(false);
  const [pomodoros, setPomodoros]         = useState(0);
  const [recurring, setRecurring]         = useState<TaskRecurring>('none');
  const [tags, setTags]                   = useState<string[]>([]);
  const [tagInput, setTagInput]           = useState('');

  const { selectedDate, addTask } = useCalendarStore();
  const titleRef = useRef<TextInput>(null);

  // ── Deadline chips logic ─────────────────────────────────────────────────
  // Liczone na żywo przy KAŻDYM renderze (`buildDeadlineChips`), nie memo — zakresy
  // tygodni muszą zostać poprawne nawet jeśli ekran zostanie otwarty przez zmianę dnia,
  // ten sam wzorzec co istniejące `offsetDate()` wywoływane świeżo w `activeChip`.
  const deadlineChips = buildDeadlineChips();
  const selectDeadlineChip = (date: string | null) => {
    haptic.tap();
    setDeadline(date ?? '');
  };
  const activeChip = (date: string | null): boolean => {
    if (date === null) return !deadline;
    return deadline === date;
  };

  // ── Tags ──────��──────────────────────────────────────────────────────────
  const addTag = () => {
    const t = tagInput.trim().toLowerCase().replace(/\s+/g, '_');
    if (t && !tags.includes(t)) setTags(prev => [...prev, t]);
    setTagInput('');
  };

  // ── Milestones ────────────────────────────────────────────────────────────
  const addMilestone = () => {
    const t = msInput.trim();
    if (t) { haptic.tap(); setMilestones(prev => [...prev, t]); }
    setMsInput('');
  };
  const removeMilestone = (i: number) => setMilestones(prev => prev.filter((_, idx) => idx !== i));

  // ── Save ──────────────────���──────────────────────────────────────────────
  const handleSave = async () => {
    if (!title.trim()) { toast.error('Wpisz tytuł zadania'); return; }
    setSaving(true);
    try {
      const deadlineIso = deadline ? deadline + 'T23:59:00.000Z' : undefined;
      const reminderTime = reminderOn ? reminderClock : undefined;
      // reminderDate empty = never touched the day-picker → keep the old implicit
      // behaviour (deadline, else today) exactly; only a deliberate pick overrides it.
      const reminderDateEff = reminderOn ? (reminderDate || deadline || todayStr()) : undefined;
      const reminderMessage = reminderOn && reminderMsg.trim() ? reminderMsg.trim() : undefined;

      const task = await tasksService.addTask({
        title: title.trim(),
        description: description.trim() || undefined,
        deadline: deadlineIso,
        scheduledDate: deadline || selectedDate || undefined,
        status: 'pending' as TaskStatus,
        priority,
        kind,
        waitingFor: kind === 'waiting' && waitingFor.trim() ? waitingFor.trim() : undefined,
        wakeAt: kind === 'waiting' && wakeAt ? wakeAt : undefined,
        estimatedPomodoros: pomodoros > 0 ? pomodoros : undefined,
        completedPomodoros: 0,
        tags,
        recurring,
        reminderTime,
        reminderDate: reminderDateEff,
        reminderMessage,
        subtasks: milestones.length > 0
          ? milestones.map((t, i): Subtask => ({ id: `${Date.now()}_${i}`, title: t, done: false }))
          : undefined,
      });

      if (reminderTime && reminderDateEff) {
        notificationsService.scheduleCustomTaskReminder(
          task.id, task.title,
          reminderDateEff,
          reminderTime,
          reminderMessage,
        ).catch(() => {});
      }

      haptic.success();
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
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
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
              onChangeText={onTitleChange}
              placeholder="Co trzeba zrobić?"
              placeholderTextColor={G.muted}
              style={s.titleInput}
              multiline
              autoFocus
            />
          </View>

          {/* ── Wszystko w jednej karcie (2026-10-01, user: "zrob go bardziej zbity, może
              bez napisów typu 'tutaj są terminy'... wszystkie kafelki zbić może w jednym")
              — poprzednio 6 osobnych kart, każda z powtórzonym nagłówkiem WIELKIMI
              LITERAMI ("TYP"/"TERMIN"/"PRIORYTET"/"POWIADOMIENIE"/"OPIS"/"ROZBIJ NA
              KROKI"). Te nagłówki były czystą dekoracją nad treścią, która i tak mówi sama
              za siebie (chipy priorytetu, placeholder pola opisu, toggle powiadomienia z
              własną ikoną) — usunięte, zostaje mała ikona-znacznik tam gdzie rząd chipów
              inaczej nie miałby żadnego kontekstu (Typ/Termin/Priorytet). Etykiety chipów
              terminu ("Dziś"/"Jutro"/...) ZOSTAJĄ — to nie dekoracja, to sama treść. */}
          <View style={s.mergedCard}>
            {/* Typ zadania (auto-zgadnięty, klikalny) */}
            <View style={s.fieldRow}>
              <Zap size={14} color={G.muted} />
              <View style={[s.priorityRow, { flex: 1 }]}>
                {KIND_ORDER.map(k => {
                  const m = KIND_META[k];
                  const Icon = KIND_ICON[k];
                  const active = kind === k;
                  return (
                    <TouchableOpacity
                      key={k}
                      style={[s.kindChip, active && { borderColor: m.color, backgroundColor: m.color + '18' }]}
                      onPress={() => { haptic.tap(); setKind(k); setKindTouched(true); }}
                      activeOpacity={0.8}
                    >
                      <Icon size={16} color={active ? m.color : colors.text.muted} strokeWidth={2.2} />
                      <Text style={[s.kindChipText, active && { color: m.color, fontWeight: '800' }]}>{m.short}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            <Text style={s.kindHint}>{KIND_META[kind].hint}</Text>

            {kind === 'waiting' && (
              <View style={{ gap: spacing[3] }}>
                <TextInput
                  value={waitingFor}
                  onChangeText={setWaitingFor}
                  placeholder="Na co czekasz? (np. rozliczenie projektu)"
                  placeholderTextColor={G.muted}
                  style={s.waitInput}
                />
                <Text style={s.advLabel}>OBUDŹ GDY</Text>
                <View style={s.chipRow}>
                  {([['Bez', ''], ['Za tydzień', offsetDate(7)], ['Za miesiąc', offsetDate(30)]] as [string, string][]).map(([lbl, val]) => {
                    const active = wakeAt === val;
                    return (
                      <TouchableOpacity key={lbl} style={[s.deadlineChip, active && s.deadlineChipActive]}
                        onPress={() => { haptic.tap(); setWakeAt(val); }} activeOpacity={0.75}>
                        <Text style={[s.deadlineChipText, active && s.deadlineChipTextActive]}>{lbl}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
                {wakeAt ? <Text style={s.deadlineDate}>wróci jako aktywne: {wakeAt}</Text> : null}
              </View>
            )}

            <View style={s.fieldDivider} />

            {/* Termin */}
            <View style={s.fieldRow}>
              <CalendarDays size={14} color={G.muted} />
              <View style={[s.chipRow, { flex: 1 }]}>
                {deadlineChips.map(chip => {
                  const active = activeChip(chip.date);
                  return (
                    <TouchableOpacity
                      key={chip.label}
                      style={[s.deadlineChip, active && s.deadlineChipActive]}
                      onPress={() => selectDeadlineChip(chip.date)}
                      activeOpacity={0.75}
                    >
                      <Text style={[s.deadlineChipText, active && s.deadlineChipTextActive]}>
                        {chip.label}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
            {/* Chipy pokrywają dziś/jutro/ten tydz./przyszły tydz. — dowolna inna data
                wymagała ręcznego wpisywania (user, 2026-08-11: "niewygodnie"). Ten sam
                DatePickerField co przy przypomnieniu niżej, dowolny dzień z kalendarza. */}
            <DatePickerField
              value={deadline}
              onChange={(d) => { haptic.tap(); setDeadline(d); }}
              placeholder="Wybierz dowolny dzień"
            />

            <View style={s.fieldDivider} />

            {/* Priorytet */}
            <View style={s.fieldRow}>
              <Flag size={14} color={G.muted} />
              <View style={[s.priorityRow, { flex: 1 }]}>
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
            </View>

            <View style={s.fieldDivider} />

            {/* Powiadomienie — toggle ma już własną ikonę (Bell/BellOff) i opisowy tekst
                ("Dodaj przypomnienie" / "Przypomnienie DATA o GODZINIE"), osobny nagłówek
                był czystym powtórzeniem. */}
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
                  ? `Przypomnienie ${reminderDate || deadline || todayStr()} o ${reminderClock}`
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
                <View style={s.reminderFieldsRow}>
                  <DatePickerField
                    value={reminderDate || deadline || todayStr()}
                    onChange={setReminderDate}
                    style={{ flex: 1 }}
                  />
                  <TimePickerField
                    value={reminderClock}
                    onChange={setReminderClock}
                    style={{ flex: 1 }}
                  />
                </View>
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

            <View style={s.fieldDivider} />

            {/* Opis — placeholder tłumaczy pole, osobny nagłówek "OPIS" był zbędny */}
            <TextInput
              value={description}
              onChangeText={setDescription}
              placeholder="Opis / szczegóły, notatki..."
              placeholderTextColor={G.muted}
              style={s.descInput}
              multiline
              numberOfLines={3}
              textAlignVertical="top"
            />

            <View style={s.fieldDivider} />

            {/* Rozbij na kroki — placeholder + ikona Plus w rzędzie inputu tłumaczą pole */}
            {milestones.length > 0 && (
              <View style={{ gap: spacing[2] }}>
                {milestones.map((m, i) => (
                  <View key={i} style={s.msRow}>
                    <View style={s.msDot} />
                    <Text style={s.msText} numberOfLines={2}>{m}</Text>
                    <TouchableOpacity onPress={() => { haptic.tap(); removeMilestone(i); }} hitSlop={8} style={s.msRemove}>
                      <X size={12} color={G.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            )}
            <View style={s.msInputRow}>
              <Plus size={14} color={G.accent} />
              <TextInput
                value={msInput}
                onChangeText={setMsInput}
                onSubmitEditing={addMilestone}
                placeholder="Dodaj krok / kamień milowy..."
                placeholderTextColor={G.muted}
                style={s.msInput}
                returnKeyType="done"
                blurOnSubmit={false}
              />
              {msInput.trim().length > 0 && (
                <TouchableOpacity onPress={addMilestone} style={s.msAddBtn} activeOpacity={0.8}>
                  <Check size={13} color={G.accent} strokeWidth={3} />
                </TouchableOpacity>
              )}
            </View>
            <Text style={s.msHint}>Za każdy odhaczony krok pupil dostaje +4 XP.</Text>
          </View>

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
            <View style={s.mergedCard}>
              {/* Pomodoros */}
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

              <View style={s.fieldDivider} />

              {/* Recurring */}
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

              <View style={s.fieldDivider} />

              {/* Tags */}
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

const makeS = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  closeBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: c.border.subtle,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default,
  },
  headerTitle: { fontSize: 16, fontWeight: '700', color: c.text.primary, letterSpacing: -0.2 },
  saveBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: G.accent, borderRadius: radius.full,
    paddingHorizontal: spacing[3], paddingVertical: 7,
  },
  saveBtnDisabled: { backgroundColor: 'rgba(46,222,160,0.12)', borderWidth: 1, borderColor: G.cardBorder },
  saveBtnText: { fontSize: 12, fontWeight: '700', color: c.bg.primary },

  scroll: { paddingHorizontal: spacing[4], paddingTop: spacing[3], gap: spacing[3] },

  titleCard: {
    backgroundColor: c.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: G.cardBorder,
    padding: spacing[4], minHeight: 96,
  },
  titleInput: {
    fontSize: 20, fontWeight: '700', color: c.text.primary,
    lineHeight: 28, letterSpacing: -0.3, padding: 0,
  },

  // Jedna karta dla Typ/Termin/Priorytet/Powiadomienie/Opis/Rozbij-na-kroki (2026-10-01,
  // §229) zamiast 6 osobnych — `fieldDivider` zastępuje osobne obramowania/odstępy kart.
  mergedCard: {
    backgroundColor: c.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: G.cardBorder, padding: spacing[4], gap: spacing[3],
  },
  fieldDivider: { height: 1, backgroundColor: G.cardBorder },
  fieldRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },

  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  deadlineChip: {
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.border.subtle,
  },
  deadlineChipActive: {
    borderColor: G.accent,
    backgroundColor: G.accentDim,
  },
  deadlineChipText: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  deadlineChipTextActive: { color: G.accent, fontWeight: '700' },
  deadlineDate: { fontSize: 11, color: G.muted, marginTop: -spacing[1] },

  priorityRow: { flexDirection: 'row', gap: spacing[2] },
  priorityChip: {
    flex: 1, alignItems: 'center', paddingVertical: spacing[3],
    borderRadius: radius.md, borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.border.subtle,
  },
  priorityChipText: { fontSize: 13, fontWeight: '600', color: c.text.muted },

  kindChip: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: spacing[3], borderRadius: radius.md, borderWidth: 1,
    borderColor: c.border.default, backgroundColor: c.border.subtle,
  },
  kindChipText: { fontSize: 12.5, fontWeight: '600', color: c.text.muted },
  kindHint: { fontSize: 11, color: G.muted, marginTop: -spacing[1] },
  waitInput: {
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: radius.md, borderWidth: 1, borderColor: G.cardBorder,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3], fontSize: 13, color: c.text.primary,
  },

  reminderToggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    borderRadius: radius.md, borderWidth: 1,
    borderColor: c.border.default,
    backgroundColor: c.border.subtle,
  },
  reminderToggleOn: {
    borderColor: G.accent + '55',
    backgroundColor: G.accentDim,
  },
  reminderToggleText: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text.muted },
  reminderClear: { padding: 4 },
  reminderFieldsRow: { flexDirection: 'row', gap: spacing[2] },
  reminderMsgInput: {
    backgroundColor: 'rgba(0,0,0,0.3)',
    borderRadius: radius.md, borderWidth: 1,
    borderColor: G.cardBorder,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    fontSize: 13, color: c.text.primary, lineHeight: 18,
    minHeight: 60, textAlignVertical: 'top',
  },

  descInput: {
    fontSize: 14, color: c.text.secondary, lineHeight: 21,
    minHeight: 72, padding: 0, textAlignVertical: 'top',
  },

  advancedToggle: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: spacing[2], paddingHorizontal: spacing[1],
  },
  advancedToggleText: { flex: 1, fontSize: 12, color: G.muted, fontWeight: '600' },

  advLabel: {
    fontSize: 9, fontWeight: '700', color: G.muted,
    letterSpacing: 1.1, textTransform: 'uppercase',
  },

  // milestones
  msRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  msDot: { width: 6, height: 6, borderRadius: 3, backgroundColor: G.accent },
  msText: { flex: 1, fontSize: 13, color: c.text.secondary, fontWeight: '500', lineHeight: 18 },
  msRemove: { padding: 4 },
  msInputRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: 'rgba(0,0,0,0.3)', borderRadius: radius.md,
    borderWidth: 1, borderColor: G.cardBorder, paddingHorizontal: spacing[3], minHeight: 42,
  },
  msInput: { flex: 1, fontSize: 13, color: c.text.primary },
  msAddBtn: { padding: 4 },
  msHint: { fontSize: 11, color: G.muted, lineHeight: 15 },

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
  tagInput: { flex: 1, fontSize: 13, color: c.text.primary },
  tagAddBtn: { padding: 4 },

  footer: {
    padding: spacing[4],
    borderTopWidth: 1, borderTopColor: c.border.subtle,
  },
  cta: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    backgroundColor: G.accent, borderRadius: radius.xl,
    paddingVertical: 15, width: '100%',
  },
  ctaDisabled: { backgroundColor: 'rgba(46,222,160,0.15)' },
  ctaText: { fontSize: 15, fontWeight: '800', color: c.bg.primary, letterSpacing: -0.2 },
});
