import { useState, useMemo, useEffect } from 'react';
import {
  View, Text, TextInput, StyleSheet, ScrollView,
  TouchableOpacity, KeyboardAvoidingView, Platform, ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Search, X, CheckSquare, CalendarDays, Receipt, CheckCircle2, FileText, Clock } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { useCalendarStore } from '@/store/calendarStore';
import { useExpensesStore } from '@/store/expensesStore';
import { getCategoryMeta } from '@/utils/categories';
import { Note, getAllNotes } from '@/utils/notesStorage';
import { blocksToPlainText, deserializeBlocks } from '@/utils/richText';
import { expensesService } from '@/services/expensesService';
import { calendarService, tasksService } from '@/services/calendarService';
import { colors, spacing, radius, typography } from '@/theme';

function highlight(text: string, query: string): { part: string; match: boolean }[] {
  if (!query) return [{ part: text, match: false }];
  const idx = text.toLowerCase().indexOf(query.toLowerCase());
  if (idx === -1) return [{ part: text, match: false }];
  return [
    { part: text.slice(0, idx), match: false },
    { part: text.slice(idx, idx + query.length), match: true },
    { part: text.slice(idx + query.length), match: false },
  ];
}

function Highlighted({ text, query }: { text: string; query: string }) {
  const parts = highlight(text, query);
  return (
    <Text style={hl.base} numberOfLines={1}>
      {parts.map((p, i) => (
        <Text key={i} style={p.match ? hl.match : undefined}>{p.part}</Text>
      ))}
    </Text>
  );
}
const hl = StyleSheet.create({
  base: { fontSize: 14, fontWeight: '500', color: colors.text.primary },
  match: { color: colors.accent.amber, fontWeight: '700' },
});

export default function SearchScreen() {
  const [query, setQuery] = useState('');
  const [notes, setNotes] = useState<Note[]>([]);
  const [loading, setLoading] = useState(false);

  const { tasks, events, setTasks, setEvents } = useCalendarStore();
  const { expenses, setExpenses } = useExpensesStore();

  // Load data into stores if not already loaded
  useEffect(() => {
    let active = true;
    const load = async () => {
      setLoading(true);
      await Promise.all([
        expenses.length === 0
          ? expensesService.getAll().then(d => { if (active) setExpenses(d); }).catch(() => {})
          : Promise.resolve(),
        tasks.length === 0
          ? tasksService.getAllTasks().then(d => { if (active) setTasks(d); }).catch(() => {})
          : Promise.resolve(),
        events.length === 0
          ? calendarService.getAllEvents().then(d => { if (active) setEvents(d); }).catch(() => {})
          : Promise.resolve(),
        getAllNotes().then(d => { if (active) setNotes(d); }),
      ]);
      if (active) setLoading(false);
    };
    load();
    return () => { active = false; };
  }, []);

  const q = query.trim();

  const matchedTasks = useMemo(() => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return tasks
      .filter(t =>
        t.title.toLowerCase().includes(lower) ||
        t.description?.toLowerCase().includes(lower) ||
        t.tags?.some(tag => tag.toLowerCase().includes(lower))
      )
      .slice(0, 8);
  }, [tasks, q]);

  const matchedEvents = useMemo(() => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return events
      .filter(e =>
        e.title.toLowerCase().includes(lower) ||
        e.description?.toLowerCase().includes(lower)
      )
      .slice(0, 6);
  }, [events, q]);

  const matchedExpenses = useMemo(() => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return expenses
      .filter(e =>
        e.note?.toLowerCase().includes(lower) ||
        e.tags?.some(tag => tag.toLowerCase().includes(lower)) ||
        String(e.amount).includes(lower) ||
        getCategoryMeta(e.category as any)?.label?.toLowerCase().includes(lower)
      )
      .slice(0, 6);
  }, [expenses, q]);

  const matchedNotes = useMemo(() => {
    if (!q) return [];
    const lower = q.toLowerCase();
    return notes
      .filter(n => {
        const body = n.bodyRich
          ? blocksToPlainText(deserializeBlocks(n.bodyRich))
          : n.body;
        return (
          n.title.toLowerCase().includes(lower) ||
          body.toLowerCase().includes(lower) ||
          n.tags.some(t => t.includes(lower))
        );
      })
      .slice(0, 5);
  }, [notes, q]);

  // Recent items for empty state
  const recentExpenses = useMemo(() =>
    [...expenses].sort((a, b) => b.date.localeCompare(a.date)).slice(0, 5),
  [expenses]);
  const pendingTasks = useMemo(() =>
    tasks.filter(t => t.status === 'pending').slice(0, 4),
  [tasks]);

  const hasResults = matchedTasks.length + matchedEvents.length + matchedExpenses.length + matchedNotes.length > 0;
  const total = matchedTasks.length + matchedEvents.length + matchedExpenses.length + matchedNotes.length;

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>

        {/* Search bar */}
        <View style={styles.header}>
          <View style={styles.searchBar}>
            <Search size={16} color={colors.text.muted} />
            <TextInput
              value={query}
              onChangeText={setQuery}
              placeholder="Szukaj zadań, wydarzeń, wydatków..."
              placeholderTextColor={colors.text.muted}
              style={styles.input}
              autoFocus
              returnKeyType="search"
            />
            {loading && <ActivityIndicator size="small" color={colors.text.muted} style={{ marginLeft: 4 }} />}
            {q.length > 0 && !loading && (
              <PressableScale onPress={() => setQuery('')} style={styles.clearBtn}>
                <X size={14} color={colors.text.muted} />
              </PressableScale>
            )}
          </View>
          <TouchableOpacity onPress={() => router.back()} style={styles.cancelBtn}>
            <Text style={styles.cancelText}>Anuluj</Text>
          </TouchableOpacity>
        </View>

        {q && hasResults && (
          <Text style={styles.resultCount}>{total} wyników</Text>
        )}

        <ScrollView
          contentContainerStyle={styles.scroll}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {/* Empty query — show recent */}
          {!q && !loading && (
            <>
              {recentExpenses.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionRow}>
                    <Clock size={12} color={colors.text.muted} />
                    <Text style={[styles.sectionTitle, { color: colors.text.muted }]}>Ostatnie transakcje</Text>
                  </View>
                  {recentExpenses.map(exp => {
                    const meta = getCategoryMeta(exp.category);
                    const isIncome = exp.type === 'income';
                    const label = exp.note || meta.label;
                    return (
                      <TouchableOpacity
                        key={exp.id}
                        style={styles.row}
                        onPress={() => router.push(`/expenses/${exp.id}` as any)}
                        activeOpacity={0.75}
                      >
                        <View style={[styles.rowIcon, { backgroundColor: meta.color + '20' }]}>
                          <Receipt size={14} color={meta.color} />
                        </View>
                        <View style={styles.rowInfo}>
                          <Text style={hl.base} numberOfLines={1}>{label}</Text>
                          <Text style={styles.rowMeta}>{exp.date.split('T')[0]}</Text>
                        </View>
                        <Text style={[styles.rowAmount, { color: isIncome ? colors.accent.success : colors.text.secondary }]}>
                          {isIncome ? '+' : '-'}{exp.amount.toFixed(2)} zł
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}

              {pendingTasks.length > 0 && (
                <View style={styles.section}>
                  <View style={styles.sectionRow}>
                    <CheckSquare size={12} color={colors.accent.purple} />
                    <Text style={[styles.sectionTitle, { color: colors.accent.purple }]}>Do zrobienia</Text>
                  </View>
                  {pendingTasks.map(task => (
                    <TouchableOpacity
                      key={task.id}
                      style={styles.row}
                      onPress={() => router.push(`/tasks/${task.id}` as any)}
                      activeOpacity={0.75}
                    >
                      <View style={[styles.rowIcon, { backgroundColor: colors.accent.purple + '18' }]}>
                        <CheckSquare size={14} color={colors.accent.purple} />
                      </View>
                      <View style={styles.rowInfo}>
                        <Text style={hl.base} numberOfLines={1}>{task.title}</Text>
                        {task.deadline && (
                          <Text style={styles.rowMeta}>{task.deadline.split('T')[0]}</Text>
                        )}
                      </View>
                      {task.priority === 'high' && <View style={styles.urgentDot} />}
                    </TouchableOpacity>
                  ))}
                </View>
              )}

              {recentExpenses.length === 0 && pendingTasks.length === 0 && (
                <View style={styles.empty}>
                  <Search size={36} color={colors.text.muted} strokeWidth={1.2} />
                  <Text style={styles.emptyTitle}>Szukaj w całej aplikacji</Text>
                  <Text style={styles.emptySub}>Zadania, wydarzenia, transakcje, notatki</Text>
                </View>
              )}
            </>
          )}

          {q && !hasResults && !loading && (
            <View style={styles.empty}>
              <Text style={styles.emptyTitle}>Brak wyników</Text>
              <Text style={styles.emptySub}>Spróbuj innej frazy</Text>
            </View>
          )}

          {/* Tasks */}
          {matchedTasks.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <CheckSquare size={12} color={colors.accent.purple} />
                <Text style={[styles.sectionTitle, { color: colors.accent.purple }]}>Zadania</Text>
                <Text style={styles.sectionCount}>{matchedTasks.length}</Text>
              </View>
              {matchedTasks.map(task => {
                const done = task.status === 'done';
                return (
                  <TouchableOpacity
                    key={task.id}
                    style={styles.row}
                    onPress={() => router.push(`/tasks/${task.id}` as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: colors.accent.purple + '18' }]}>
                      {done
                        ? <CheckCircle2 size={14} color={colors.accent.green} />
                        : <CheckSquare size={14} color={colors.accent.purple} />
                      }
                    </View>
                    <View style={styles.rowInfo}>
                      <Highlighted text={task.title} query={q} />
                      {task.deadline && (
                        <Text style={styles.rowMeta}>{task.deadline.split('T')[0]}</Text>
                      )}
                    </View>
                    {task.priority === 'high' && !done && (
                      <View style={styles.urgentDot} />
                    )}
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Events */}
          {matchedEvents.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <CalendarDays size={12} color={colors.accent.blue} />
                <Text style={[styles.sectionTitle, { color: colors.accent.blue }]}>Wydarzenia</Text>
                <Text style={styles.sectionCount}>{matchedEvents.length}</Text>
              </View>
              {matchedEvents.map(ev => (
                <TouchableOpacity
                  key={ev.id}
                  style={styles.row}
                  onPress={() => router.push(`/calendar/${ev.id}` as any)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.rowIcon, { backgroundColor: (ev.color ?? colors.accent.blue) + '25' }]}>
                    <CalendarDays size={14} color={ev.color ?? colors.accent.blue} />
                  </View>
                  <View style={styles.rowInfo}>
                    <Highlighted text={ev.title} query={q} />
                    <Text style={styles.rowMeta}>
                      {ev.date.split('T')[0]}{ev.startTime ? ` · ${ev.startTime}` : ''}
                    </Text>
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}

          {/* Expenses */}
          {matchedExpenses.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <Receipt size={12} color={colors.accent.amber} />
                <Text style={[styles.sectionTitle, { color: colors.accent.amber }]}>Transakcje</Text>
                <Text style={styles.sectionCount}>{matchedExpenses.length}</Text>
              </View>
              {matchedExpenses.map(exp => {
                const meta = getCategoryMeta(exp.category);
                const isIncome = exp.type === 'income';
                const label = exp.note || meta.label;
                return (
                  <TouchableOpacity
                    key={exp.id}
                    style={styles.row}
                    onPress={() => router.push(`/expenses/${exp.id}` as any)}
                    activeOpacity={0.75}
                  >
                    <View style={[styles.rowIcon, { backgroundColor: meta.color + '20' }]}>
                      <Receipt size={14} color={meta.color} />
                    </View>
                    <View style={styles.rowInfo}>
                      <Highlighted text={label} query={q} />
                      <Text style={styles.rowMeta}>{exp.date.split('T')[0]}</Text>
                    </View>
                    <Text style={[styles.rowAmount, { color: isIncome ? colors.accent.success : colors.text.secondary }]}>
                      {isIncome ? '+' : '-'}{exp.amount.toFixed(2)} zł
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {/* Notes */}
          {matchedNotes.length > 0 && (
            <View style={styles.section}>
              <View style={styles.sectionRow}>
                <FileText size={12} color={colors.accent.purple} />
                <Text style={[styles.sectionTitle, { color: colors.accent.purple }]}>Notatki</Text>
                <Text style={styles.sectionCount}>{matchedNotes.length}</Text>
              </View>
              {matchedNotes.map(note => (
                <TouchableOpacity
                  key={note.id}
                  style={styles.row}
                  onPress={() => router.push({ pathname: '/notes', params: { noteId: note.id } } as any)}
                  activeOpacity={0.75}
                >
                  <View style={[styles.rowIcon, { backgroundColor: colors.accent.purple + '18' }]}>
                    <FileText size={14} color={colors.accent.purple} />
                  </View>
                  <View style={styles.rowInfo}>
                    <Highlighted text={note.title || note.body.slice(0, 40) || 'Notatka'} query={q} />
                    {note.title && note.body.length > 0 && (
                      <Text style={styles.rowMeta} numberOfLines={1}>{note.body.slice(0, 60)}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              ))}
            </View>
          )}
        </ScrollView>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  searchBar: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bg.elevated,
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
  },
  input: { flex: 1, fontSize: 14, color: colors.text.primary, paddingVertical: 0 },
  clearBtn: {
    width: 20, height: 20, borderRadius: 10,
    backgroundColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  cancelBtn: { paddingVertical: spacing[2] },
  cancelText: { ...typography.label, color: colors.text.secondary, fontWeight: '600' },

  resultCount: {
    ...typography.caption, color: colors.text.muted,
    paddingHorizontal: spacing[4], paddingTop: spacing[2],
  },

  scroll: { padding: spacing[4], gap: spacing[4], paddingBottom: 100 },

  empty: { alignItems: 'center', paddingVertical: 64, gap: spacing[3] },
  emptyTitle: { ...typography.h3, color: colors.text.secondary, fontWeight: '700' },
  emptySub: { ...typography.body, color: colors.text.muted, textAlign: 'center' },

  section: { gap: spacing[2] },
  sectionRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[1] },
  sectionTitle: { fontSize: 10, fontWeight: '700', letterSpacing: 1, textTransform: 'uppercase', flex: 1 },
  sectionCount: { fontSize: 10, fontWeight: '600', color: colors.text.muted },

  row: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
  },
  rowIcon: {
    width: 32, height: 32, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
  },
  rowInfo: { flex: 1, gap: 3 },
  rowMeta: { ...typography.caption, color: colors.text.muted, fontSize: 11 },
  rowAmount: { ...typography.label, fontWeight: '700', fontSize: 13 },
  urgentDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: colors.accent.red },
});
