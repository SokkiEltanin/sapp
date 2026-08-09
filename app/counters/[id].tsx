import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity, Modal, Alert } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams, useFocusEffect } from 'expo-router';
import {
  ChevronLeft, CalendarClock, Car, RotateCcw, Ban, FileText, ListChecks, Plus,
  CheckSquare, Square, X, Link2, Trash2, StickyNote,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import DatePickerField from '@/components/ui/DatePickerField';
import WalkProgress from '@/components/counters/WalkProgress';
import StreakFlame, { streakColor } from '@/components/counters/StreakFlame';
import { WeekStrip } from '@/components/counters/StreakCard';
import {
  useCounters, daysSince, daysUntil, untilProgress, autoDaysWithout,
  isDuringEvent, daysUntilEnd, isOver, eventProgress,
} from '@/store/countersStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useFoodStore } from '@/store/foodStore';
import { useTasks } from '@/hooks/useTasks';
import { Note, getAllNotes, createNote, updateNote } from '@/utils/notesStorage';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const ACCENT = '#ECEEEE';
const ON_ACCENT = '#12100F';

const untilLabel = (n: number) => n > 1 ? `za ${n} dni` : n === 1 ? 'jutro!' : n === 0 ? 'dziś!' : 'minęło';

function pad(n: number) { return String(n).padStart(2, '0'); }
function addDays(iso: string, delta: number): string {
  const d = new Date(iso + 'T00:00:00'); d.setDate(d.getDate() + delta);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export default function CounterDetail() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { id } = useLocalSearchParams<{ id: string }>();
  const { counters } = useCounters();
  const { expenses } = useExpensesStore();
  const meals = useFoodStore(st => st.meals);
  const { tasks, create: createTask, toggle: toggleTask, remove: removeTask } = useTasks();

  const counter = counters.find(cn => cn.id === id);

  const [notes, setNotes] = useState<Note[]>([]);
  const loadNotes = useCallback(() => { getAllNotes().then(setNotes).catch(() => {}); }, []);
  useFocusEffect(loadNotes);

  const [pickerOpen, setPickerOpen] = useState(false);
  const [addingTask, setAddingTask] = useState(false);
  const [taskTitle, setTaskTitle] = useState('');
  const [taskDate, setTaskDate] = useState('');

  if (!counter) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
          <Text style={s.headerTitle}>Licznik</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.notFound}><Text style={s.notFoundText}>Ten licznik już nie istnieje.</Text></View>
      </SafeAreaView>
    );
  }

  const linkedNotes = notes.filter(n => n.counterId === counter.id);
  const unlinkedNotes = notes.filter(n => !n.counterId);
  const linkedTasks = tasks.filter(t => t.counterId === counter.id);

  const isUntil = counter.kind === 'until';
  const during = isUntil && isDuringEvent(counter);
  const over = isUntil && isOver(counter);
  const left = isUntil ? daysUntil(counter) : 0;
  const endLeft = isUntil ? daysUntilEnd(counter) : 0;
  const prog = isUntil ? (during ? eventProgress(counter) : untilProgress(counter)) : 0;
  const bigLabel = !isUntil ? '' : over ? 'minęło'
    : during ? (endLeft > 1 ? `koniec za ${endLeft} dni` : endLeft === 1 ? 'ostatni dzień!' : 'kończy się dziś!')
    : untilLabel(left);
  const sinceN = !isUntil ? (counter.mode === 'auto' ? autoDaysWithout(counter, expenses, meals) : daysSince(counter)) : 0;

  // Quick relative-date chips for a linked task, anchored on the event's own date —
  // "muszę się spakować, więc dzień przed wyjazdem" was the user's own example.
  const dateChips = isUntil ? [
    { label: 'Tydzień przed', value: addDays(counter.date, -7) },
    { label: 'Dzień przed', value: addDays(counter.date, -1) },
    { label: 'W dniu', value: counter.date },
  ] : [];

  const startAddNote = async () => {
    haptic.tap();
    const note = await createNote({ title: '', body: '', tags: [], counterId: counter.id });
    router.push(`/notes?noteId=${note.id}` as any);
  };
  const linkNote = async (note: Note) => {
    haptic.success();
    await updateNote(note.id, { counterId: counter.id });
    setPickerOpen(false);
    loadNotes();
    toast.success('Notatka przypisana');
  };
  const unlinkNote = async (note: Note) => {
    haptic.tap();
    await updateNote(note.id, { counterId: undefined });
    loadNotes();
  };

  const openAddTask = () => { setTaskTitle(''); setTaskDate(isUntil ? counter.date : ''); setAddingTask(true); };
  const saveTask = async () => {
    if (!taskTitle.trim()) return;
    haptic.success();
    await createTask({
      title: taskTitle.trim(), status: 'pending', priority: 'normal', tags: [],
      deadline: taskDate ? taskDate + 'T23:59:00.000Z' : undefined,
      counterId: counter.id,
    });
    setAddingTask(false); setTaskTitle(''); setTaskDate('');
    toast.success('Zadanie dodane');
  };
  const delTask = (title: string, taskId: string) => Alert.alert('Usunąć zadanie?', `„${title}" zniknie.`, [
    { text: 'Anuluj', style: 'cancel' },
    { text: 'Usuń', style: 'destructive', onPress: () => { haptic.medium(); removeTask(taskId); } },
  ]);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle} numberOfLines={1}>{counter.emoji ? `${counter.emoji} ` : ''}{counter.name}</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Progress — same visual as /counters, just for this one counter */}
        <View style={s.card}>
          {isUntil ? (
            <>
              <View style={s.cardTop}>
                {during ? <Car size={16} color="#2AC68F" /> : <CalendarClock size={15} color={ACCENT} />}
                <Text style={[s.cardBig, over && { color: c.text.muted }, during && { color: '#2AC68F' }]}>{bigLabel}</Text>
              </View>
              <WalkProgress progress={prog} color={during ? '#2AC68F' : ACCENT} mode={during ? 'drive' : 'walk'} emoji={counter.emoji} />
              <Text style={s.cardMeta}>
                {during ? `w trakcie · wróć ${counter.endDate}`
                  : counter.endDate && !over ? `${counter.date} → ${counter.endDate}`
                  : counter.date}
              </Text>
            </>
          ) : (
            <>
              <View style={s.cardTop}>
                {counter.mode === 'auto' ? <Ban size={15} color={ACCENT} /> : <RotateCcw size={15} color={ACCENT} />}
                <Text style={s.cardBig}>{counter.mode === 'auto' ? `bez ${counter.name}` : 'ostatnio zrobione'}</Text>
              </View>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: spacing[1] }}>
                <StreakFlame days={sinceN} size={42} />
                <Text style={s.sinceUnit}>{sinceN === 1 ? 'dzień' : 'dni'}</Text>
              </View>
              <View style={{ marginTop: spacing[3] }}><WeekStrip days={sinceN} color={streakColor(sinceN)} /></View>
            </>
          )}
        </View>

        {/* Notes */}
        <View style={s.sectionHead}>
          <FileText size={13} color={c.text.muted} />
          <Text style={s.sectionTitle}>Notatki{linkedNotes.length > 0 ? ` (${linkedNotes.length})` : ''}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={() => { haptic.tap(); setPickerOpen(true); }} hitSlop={6} style={s.sectionAct}>
            <Link2 size={14} color={c.text.muted} />
          </TouchableOpacity>
          <TouchableOpacity onPress={startAddNote} hitSlop={6} style={s.sectionAct}>
            <Plus size={16} color={ACCENT} />
          </TouchableOpacity>
        </View>
        {linkedNotes.length === 0 ? (
          <Text style={s.emptyHint}>Brak notatek przypiętych do tego eventu.</Text>
        ) : linkedNotes.map(n => (
          <View key={n.id} style={s.rowCard}>
            <TouchableOpacity style={{ flex: 1 }} onPress={() => router.push(`/notes?noteId=${n.id}` as any)} activeOpacity={0.75}>
              <Text style={s.rowTitle} numberOfLines={1}>{n.title || n.body.slice(0, 60) || 'Pusta notatka'}</Text>
              {!!n.body && <Text style={s.rowSub} numberOfLines={1}>{n.body}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => unlinkNote(n)} hitSlop={8} style={s.rowRemove}><X size={14} color={c.text.muted} /></TouchableOpacity>
          </View>
        ))}

        {/* Tasks */}
        <View style={[s.sectionHead, { marginTop: spacing[5] }]}>
          <ListChecks size={13} color={c.text.muted} />
          <Text style={s.sectionTitle}>Zadania{linkedTasks.length > 0 ? ` (${linkedTasks.length})` : ''}</Text>
          <View style={{ flex: 1 }} />
          <TouchableOpacity onPress={openAddTask} hitSlop={6} style={s.sectionAct}>
            <Plus size={16} color={ACCENT} />
          </TouchableOpacity>
        </View>
        {linkedTasks.length === 0 && !addingTask ? (
          <Text style={s.emptyHint}>Brak zadań przypiętych do tego eventu.</Text>
        ) : linkedTasks.map(t => (
          <View key={t.id} style={s.rowCard}>
            <TouchableOpacity onPress={() => { haptic.tap(); toggleTask(t.id); }} hitSlop={8}>
              {t.status === 'done' ? <CheckSquare size={18} color={ACCENT} /> : <Square size={18} color={c.text.muted} />}
            </TouchableOpacity>
            <TouchableOpacity style={{ flex: 1, marginLeft: spacing[2] }} onPress={() => router.push(`/tasks/${t.id}` as any)} activeOpacity={0.75}>
              <Text style={[s.rowTitle, t.status === 'done' && { textDecorationLine: 'line-through', color: c.text.muted }]} numberOfLines={1}>{t.title}</Text>
              {!!t.deadline && <Text style={s.rowSub}>{t.deadline.slice(0, 10)}</Text>}
            </TouchableOpacity>
            <TouchableOpacity onPress={() => delTask(t.title, t.id)} hitSlop={8} style={s.rowRemove}><Trash2 size={14} color={c.accent.red} /></TouchableOpacity>
          </View>
        ))}

        {addingTask && (
          <View style={s.addTaskCard}>
            <TextInput
              value={taskTitle} onChangeText={setTaskTitle} autoFocus
              placeholder="np. Spakować się"
              placeholderTextColor={c.text.muted} style={s.input}
            />
            {dateChips.length > 0 && (
              <View style={s.chipRow}>
                {dateChips.map(chip => (
                  <TouchableOpacity key={chip.label} style={[s.dateChip, taskDate === chip.value && s.dateChipOn]}
                    onPress={() => { haptic.tap(); setTaskDate(chip.value); }} activeOpacity={0.8}>
                    <Text style={[s.dateChipText, taskDate === chip.value && s.dateChipTextOn]}>{chip.label}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            )}
            <DatePickerField value={taskDate} onChange={setTaskDate} placeholder="Własna data" />
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] }}>
              <TouchableOpacity style={s.cancelBtn} onPress={() => setAddingTask(false)} activeOpacity={0.8}>
                <Text style={s.cancelBtnText}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.saveBtn, !taskTitle.trim() && { opacity: 0.4 }]} onPress={saveTask} disabled={!taskTitle.trim()} activeOpacity={0.85}>
                <Text style={s.saveBtnText}>Dodaj</Text>
              </TouchableOpacity>
            </View>
          </View>
        )}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Link an existing note */}
      <Modal visible={pickerOpen} transparent animationType="fade" onRequestClose={() => setPickerOpen(false)}>
        <View style={s.overlay}>
          <View style={s.sheet}>
            <View style={s.sheetHead}>
              <Text style={s.sheetTitle}>Przypisz istniejącą notatkę</Text>
              <TouchableOpacity onPress={() => setPickerOpen(false)} hitSlop={10}><X size={20} color={c.text.muted} /></TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 420 }} showsVerticalScrollIndicator={false}>
              {unlinkedNotes.length === 0 ? (
                <Text style={s.emptyHint}>Brak notatek do przypisania — wszystkie są już gdzieś przypięte, albo nie masz jeszcze żadnej.</Text>
              ) : unlinkedNotes.map(n => (
                <TouchableOpacity key={n.id} style={s.pickerRow} onPress={() => linkNote(n)} activeOpacity={0.75}>
                  <StickyNote size={14} color={c.text.muted} />
                  <Text style={s.rowTitle} numberOfLines={1}>{n.title || n.body.slice(0, 60) || 'Pusta notatka'}</Text>
                </TouchableOpacity>
              ))}
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  scroll: { padding: spacing[4], paddingTop: spacing[2] },
  notFound: { flex: 1, alignItems: 'center', justifyContent: 'center', padding: spacing[6] },
  notFoundText: { fontSize: 14, color: c.text.muted },

  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], marginBottom: spacing[4] },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing[2] },
  cardBig: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  cardMeta: { fontSize: 11.5, color: c.text.muted, marginTop: 6 },
  sinceUnit: { fontSize: 15, fontWeight: '700', color: c.text.muted },

  sectionHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: spacing[2] },
  sectionTitle: { fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, textTransform: 'uppercase' },
  sectionAct: { padding: 4 },
  emptyHint: { fontSize: 12.5, color: c.text.muted, lineHeight: 18, marginBottom: spacing[2] },

  rowCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], marginBottom: spacing[2] },
  rowTitle: { fontSize: 13.5, fontWeight: '700', color: c.text.primary },
  rowSub: { fontSize: 11, color: c.text.muted, marginTop: 2 },
  rowRemove: { padding: 4, marginLeft: spacing[2] },

  addTaskCard: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], gap: spacing[2], marginTop: spacing[1] },
  input: { backgroundColor: c.bg.primary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 11, fontSize: 14, color: c.text.primary },
  chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  dateChip: { paddingHorizontal: spacing[3], paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.primary },
  dateChipOn: { backgroundColor: ACCENT + '22', borderColor: ACCENT },
  dateChipText: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  dateChipTextOn: { color: ACCENT, fontWeight: '800' },
  cancelBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  cancelBtnText: { fontSize: 13, fontWeight: '700', color: c.text.muted },
  saveBtn: { flex: 1, alignItems: 'center', paddingVertical: 11, borderRadius: radius.md, backgroundColor: ACCENT },
  saveBtnText: { fontSize: 13, fontWeight: '800', color: ON_ACCENT },

  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'flex-end' },
  sheet: { backgroundColor: c.bg.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, paddingHorizontal: spacing[5], paddingTop: spacing[5], paddingBottom: spacing[8], maxHeight: '80%' },
  sheetHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[3] },
  sheetTitle: { fontSize: 17, fontWeight: '800', color: c.text.primary },
  pickerRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: c.border.subtle },
}));
