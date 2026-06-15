import { useState, useEffect, useMemo, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Pressable,
  PanResponder, Modal, TouchableOpacity,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  Plus, ChevronLeft, ChevronRight, CalendarDays, RefreshCw,
  CheckSquare, Wallet, LayoutGrid, AlignJustify, Edit3, X, Clock,
} from 'lucide-react-native';

import ScreenHeader from '@/components/ui/ScreenHeader';
import PressableScale from '@/components/ui/PressableScale';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import WeekStrip from '@/components/calendar/WeekStrip';
import TaskItem from '@/components/calendar/TaskItem';
import DayTimeline from '@/components/calendar/DayTimeline';
import { useCalendarStore } from '@/store/calendarStore';
import { useMoodStore } from '@/store/moodStore';
import { useExpensesStore } from '@/store/expensesStore';
import { calendarService, tasksService } from '@/services/calendarService';
import { googleCalendarService } from '@/services/googleCalendarService';
import { CalendarEvent, Task } from '@/types';
import { notificationsService } from '@/services/notificationsService';
import { getCategoryMeta } from '@/utils/categories';
import { colors, spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';

const VP = {
  card:       '#0E1428',
  cardBorder: 'rgba(58,76,156,0.22)',
  accent:     '#3A4C9C',
  accentDim:  'rgba(58,76,156,0.18)',
  muted:      'rgba(58,76,156,0.55)',
};
const V = VP.accent; // kept for existing inline expressions

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
const MONTH_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const DAY_FULL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

type CalMode = 'month-detailed' | 'month-mini' | 'week';
// Only two styles, per design: full month grid ↔ compact week agenda.
const MODE_ORDER: CalMode[] = ['month-detailed', 'week'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDay(dateStr: string) {
  const d = new Date(dateStr + 'T12:00:00');
  return `${DAY_FULL[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}
function fmtAmount(amount: number, currency: string) {
  return `${amount % 1 === 0 ? amount : amount.toFixed(2)} ${currency}`;
}

// ─── Day events modal ─────────────────────────────────────────────────────────

interface DayModalProps {
  date: string;
  events: CalendarEvent[];
  tasks: Task[];
  onClose: () => void;
  onToggleTask: (id: string) => void;
}

function DayModal({ date, events, tasks, onClose, onToggleTask }: DayModalProps) {
  const colors = useColors();
  const VP = useMemo(() => ({ card: colors.bg.card, cardBorder: 'rgba(58,76,156,0.24)', accent: '#3A4C9C', accentDim: 'rgba(58,76,156,0.18)', muted: 'rgba(58,76,156,0.55)' }), [colors]);
  const dm = useMemo(() => makeDm(colors, VP), [colors, VP]);
  const insets = useSafeAreaInsets();
  const isToday = date === todayStr();

  return (
    <Modal visible transparent animationType="slide" onRequestClose={onClose} statusBarTranslucent>
      <Pressable style={dm.backdrop} onPress={onClose} />
      <View style={[dm.sheet, { paddingBottom: insets.bottom + 16 }]}>

        <View style={dm.handle} />

        <View style={dm.header}>
          <View>
            <Text style={dm.dayLabel}>
              {isToday ? 'Dzisiaj' : fmtDay(date)}
            </Text>
            <Text style={dm.monthLabel}>
              {new Date(date + 'T12:00:00').getDate()} {MONTH_SHORT[new Date(date + 'T12:00:00').getMonth()]}
            </Text>
          </View>
          <View style={dm.headerRight}>
            <TouchableOpacity
              style={[dm.addBtn, { backgroundColor: V + '22', borderColor: V + '55' }]}
              onPress={() => { onClose(); router.push(`/calendar/add?date=${date}` as any); }}
              activeOpacity={0.8}
            >
              <Plus size={15} color={V} strokeWidth={2.5} />
              <Text style={[dm.addBtnText, { color: V }]}>Dodaj</Text>
            </TouchableOpacity>
            <TouchableOpacity style={dm.closeBtn} onPress={onClose} activeOpacity={0.7}>
              <X size={16} color={colors.text.muted} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={dm.scrollContent}
        >
          {events.length === 0 && tasks.length === 0 && (
            <View style={dm.empty}>
              <Text style={dm.emptyText}>Brak wydarzeń</Text>
              <Text style={dm.emptyHint}>Dotknij + żeby dodać</Text>
            </View>
          )}

          {events.length > 0 && (
            <View style={dm.section}>
              <Text style={dm.sectionLabel}>WYDARZENIA</Text>
              {events.map(ev => {
                const isGCal = ev.id.startsWith('gcal-');
                const evColor = ev.color ?? (isGCal ? '#039BE5' : V);
                return (
                  <TouchableOpacity
                    key={ev.id}
                    style={[dm.eventRow, { borderLeftColor: evColor }]}
                    onPress={() => { onClose(); router.push(`/calendar/${ev.id}` as any); }}
                    activeOpacity={0.8}
                  >
                    <View style={dm.eventInfo}>
                      <Text style={dm.eventTitle} numberOfLines={1}>{ev.title}</Text>
                      {ev.startTime ? (
                        <View style={dm.eventTime}>
                          <Clock size={10} color={colors.text.muted} />
                          <Text style={dm.eventTimeText}>
                            {ev.startTime}{ev.endTime ? ` → ${ev.endTime}` : ''}
                          </Text>
                          {isGCal && <Text style={dm.gcalBadge}>GCal</Text>}
                        </View>
                      ) : (
                        <View style={dm.eventTime}>
                          <Text style={dm.eventTimeText}>Cały dzień</Text>
                          {isGCal && <Text style={dm.gcalBadge}>GCal</Text>}
                        </View>
                      )}
                    </View>
                    <View style={[dm.editBtn, { backgroundColor: evColor + '18', borderColor: evColor + '44' }]}>
                      <Edit3 size={13} color={evColor} />
                    </View>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}

          {tasks.length > 0 && (
            <View style={dm.section}>
              <Text style={dm.sectionLabel}>ZADANIA</Text>
              {tasks.map((t, i) => (
                <TaskItem
                  key={t.id} task={t} index={i}
                  onToggle={onToggleTask}
                  onPress={(id) => { onClose(); router.push(`/tasks/${id}` as any); }}
                />
              ))}
            </View>
          )}
        </ScrollView>
      </View>
    </Modal>
  );
}

const makeDm = (c: any, vp: any) => StyleSheet.create({
  backdrop: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0,0,0,0.6)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: c.bg.elevated,
    borderTopLeftRadius: 24, borderTopRightRadius: 24,
    borderWidth: 1, borderBottomWidth: 0,
    borderColor: V + '30',
    paddingTop: 12,
    maxHeight: '80%',
  },
  handle: {
    width: 36, height: 4, borderRadius: 2,
    backgroundColor: c.border.focus,
    alignSelf: 'center', marginBottom: 16,
  },
  header: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], marginBottom: spacing[4],
  },
  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dayLabel: { fontSize: 18, fontWeight: '800', color: c.text.primary, letterSpacing: -0.3 },
  monthLabel: { fontSize: 12, color: c.text.muted, marginTop: 2 },
  addBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: 7,
    borderRadius: radius.full, borderWidth: 1,
  },
  addBtnText: { fontSize: 12, fontWeight: '700' },
  closeBtn: {
    width: 32, height: 32, borderRadius: 16,
    backgroundColor: c.bg.card,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: c.border.default,
  },
  scrollContent: { paddingHorizontal: spacing[4], paddingBottom: spacing[4], gap: spacing[3] },
  section: { gap: spacing[2] },
  sectionLabel: {
    fontSize: 9, fontWeight: '700', color: c.text.muted,
    letterSpacing: 1.3, textTransform: 'uppercase', marginBottom: 2,
  },
  eventRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.lg,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    borderWidth: 1, borderColor: c.border.subtle,
    borderLeftWidth: 3,
  },
  eventInfo: { flex: 1, gap: 3 },
  eventTitle: { fontSize: 14, fontWeight: '700', color: c.text.primary },
  eventTime: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  eventTimeText: { fontSize: 11, color: c.text.muted },
  gcalBadge: {
    fontSize: 9, fontWeight: '700', color: '#039BE5',
    backgroundColor: '#039BE520', borderRadius: 4,
    paddingHorizontal: 4, paddingVertical: 1, marginLeft: 4,
  },
  editBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  empty: { alignItems: 'center', paddingVertical: spacing[8], gap: spacing[2] },
  emptyText: { fontSize: 15, fontWeight: '600', color: c.text.secondary },
  emptyHint: { fontSize: 12, color: c.text.muted },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function CalendarTabScreen() {
  const colors = useColors();
  const VP = useMemo(() => ({ card: colors.bg.card, cardBorder: 'rgba(58,76,156,0.24)', accent: '#3A4C9C', accentDim: 'rgba(58,76,156,0.18)', muted: 'rgba(58,76,156,0.55)' }), [colors]);
  const styles = useMemo(() => makeStyles(colors, VP), [colors, VP]);
  const { events, tasks, selectedDate, setEvents, setTasks, updateTask, setSelectedDate, setLoading } =
    useCalendarStore();
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();

  const now = new Date();
  const [viewYear, setViewYear]         = useState(now.getFullYear());
  const [viewMonth, setViewMonth]       = useState(now.getMonth());
  const [refreshing, setRefreshing]     = useState(false);
  const [calMode, setCalMode]           = useState<CalMode>('month-detailed');
  const calModeRef                      = useRef<CalMode>('month-detailed');
  const [weekOffset, setWeekOffset]     = useState(0);
  const [gcalEvents, setGcalEvents]     = useState<CalendarEvent[]>([]);
  const [gcalSyncing, setGcalSyncing]   = useState(false);
  const [gcalAvailable, setGcalAvailable] = useState(false);
  const [dayModalDate, setDayModalDate] = useState<string | null>(null);

  const setMode = useCallback((m: CalMode) => {
    setCalMode(m);
    calModeRef.current = m;
  }, []);

  // Combined gesture: horizontal → month nav, vertical → mode collapse/expand
  const calGesturePR = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 12 || Math.abs(dy) > 12,

      onPanResponderRelease: (_, { dx, dy, vx, vy }) => {
        const absX = Math.abs(dx), absY = Math.abs(dy);
        const isHoriz = absX > absY * 1.4;
        const isVert  = absY > absX * 1.4;

        if (isHoriz && (absX > 45 || Math.abs(vx) > 0.35)) {
          if (dx < 0) setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; });
          else        setViewMonth(m => { if (m === 0)  { setViewYear(y => y - 1); return 11; } return m - 1; });
        } else if (isVert && (absY > 50 || Math.abs(vy) > 0.35)) {
          const idx = MODE_ORDER.indexOf(calModeRef.current);
          if (dy < 0 && idx < MODE_ORDER.length - 1) setMode(MODE_ORDER[idx + 1]); // swipe up → collapse
          else if (dy > 0 && idx > 0) setMode(MODE_ORDER[idx - 1]);                 // swipe down → expand
        }
      },
    }),
  ).current;

  useEffect(() => { load(); checkGcal(); }, []);

  const checkGcal = async () => {
    const token = await googleCalendarService.getStoredToken();
    if (token) { setGcalAvailable(true); syncGcal(); }
  };

  const syncGcal = async () => {
    setGcalSyncing(true);
    try {
      const evs = await googleCalendarService.fetchEvents();
      setGcalEvents(evs);
      setGcalAvailable(true);
    } catch {} finally { setGcalSyncing(false); }
  };

  const load = async () => {
    try {
      setLoading(true);
      const [evs, tks] = await Promise.all([calendarService.getAllEvents(), tasksService.getAllTasks()]);
      setEvents(evs);
      setTasks(tks);
    } catch {} finally { setLoading(false); }
  };

  const refresh = async () => { setRefreshing(true); await load(); setRefreshing(false); };

  const prevMonth = () => {
    if (viewMonth === 0) { setViewMonth(11); setViewYear(y => y - 1); }
    else setViewMonth(m => m - 1);
  };
  const nextMonth = () => {
    if (viewMonth === 11) { setViewMonth(0); setViewYear(y => y + 1); }
    else setViewMonth(m => m + 1);
  };

  const goToday = () => {
    setSelectedDate(todayStr());
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setWeekOffset(0);
  };

  const handleSelectDate = (date: string) => {
    haptic.tap();
    setSelectedDate(date);
    const d = new Date(date + 'T12:00:00');
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setWeekOffset(0);
    setDayModalDate(date);
  };

  const allEvents = useMemo(
    () => [...events, ...gcalEvents.filter(g => !events.some(e => e.id === g.id))],
    [events, gcalEvents],
  );

  const selectedEvents = useMemo(
    () => allEvents.filter(e => e.date.startsWith(selectedDate)),
    [allEvents, selectedDate],
  );

  const selectedTasks = useMemo(
    () => tasks.filter(t =>
      t.deadline?.startsWith(selectedDate) || t.scheduledDate === selectedDate,
    ),
    [tasks, selectedDate],
  );

  const selectedExpenses = useMemo(
    () => expenses.filter(e => e.date.startsWith(selectedDate)),
    [expenses, selectedDate],
  );

  const modalEvents = useMemo(
    () => dayModalDate ? allEvents.filter(e => e.date.startsWith(dayModalDate)) : [],
    [allEvents, dayModalDate],
  );

  const modalTasks = useMemo(
    () => dayModalDate ? tasks.filter(t =>
      t.deadline?.startsWith(dayModalDate) || t.scheduledDate === dayModalDate,
    ) : [],
    [tasks, dayModalDate],
  );

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const next = task.status === 'done' ? 'pending' : 'done';
    if (next === 'done') haptic.success(); else haptic.tap();
    updateTask(id, { status: next });
    try {
      await tasksService.updateTask(id, { status: next });
      if (next === 'done') notificationsService.cancelTaskReminder(id).catch(() => {});
    } catch { updateTask(id, { status: task.status }); }
  };

  const isToday = selectedDate === todayStr();
  const totalExpensesAmt = selectedExpenses
    .filter(e => !e.type || e.type === 'expense')
    .reduce((s, e) => s + e.amount, 0);
  const totalIncomeAmt = selectedExpenses
    .filter(e => e.type === 'income')
    .reduce((s, e) => s + e.amount, 0);
  const expCurrency = selectedExpenses[0]?.currency ?? 'PLN';

  const modeIcon = (mode: CalMode) => {
    if (mode === 'month-detailed') return LayoutGrid;
    if (mode === 'month-mini')     return CalendarDays;
    return AlignJustify;
  };

  return (
    <SafeAreaView style={styles.container} edges={[]}>
      <View style={{ flex: 1 }}>
        <ScreenHeader
          title="Kalendarz"
          subtitle={isToday ? 'Dzisiaj' : fmtDay(selectedDate)}
          style={{ borderBottomColor: VP.cardBorder }}
          rightSlot={
            <View style={styles.headerRight}>
              <PressableScale onPress={goToday} style={styles.todayBtn}>
                <Text style={styles.todayBtnText}>Dziś</Text>
              </PressableScale>
              {gcalAvailable && (
                <PressableScale onPress={syncGcal} style={styles.iconBtn}>
                  <RefreshCw size={14} color={gcalSyncing ? colors.text.muted : colors.accent.blue} />
                </PressableScale>
              )}
              <PressableScale onPress={() => router.push('/calendar/add')} style={styles.iconBtn}>
                <Plus size={16} color={colors.text.primary} />
              </PressableScale>
            </View>
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text.muted} />}
          contentContainerStyle={{ paddingBottom: 180 }}
        >
          {/* ── Calendar area with gesture ── */}
          <View {...calGesturePR.panHandlers}>
            <View style={styles.monthNav}>
              <PressableScale
                onPress={calMode !== 'week' ? prevMonth : () => setWeekOffset(w => w - 1)}
                style={styles.navBtn}
              >
                <ChevronLeft size={18} color={colors.text.secondary} />
              </PressableScale>

              <View style={styles.monthTitleBtn}>
                <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth]}</Text>
                <Text style={styles.yearLabel}>{viewYear}</Text>
              </View>

              {/* Mode indicator — swipe hint */}
              <View style={styles.modeToggle}>
                {MODE_ORDER.map(mode => {
                  const Icon = modeIcon(mode);
                  return (
                    <Pressable
                      key={mode}
                      onPress={() => { haptic.tap(); setMode(mode); }}
                      style={[styles.modeBtn, calMode === mode && styles.modeBtnActive]}
                    >
                      <Icon size={14} color={calMode === mode ? V : colors.text.muted} />
                    </Pressable>
                  );
                })}
              </View>

              <PressableScale
                onPress={calMode !== 'week' ? nextMonth : () => setWeekOffset(w => w + 1)}
                style={styles.navBtn}
              >
                <ChevronRight size={18} color={colors.text.secondary} />
              </PressableScale>
            </View>

            {calMode === 'month-detailed' && (
              <CalendarGrid
                year={viewYear}
                month={viewMonth}
                selectedDate={selectedDate}
                events={allEvents}
                tasks={tasks}
                moodEntries={moodEntries}
                onSelectDate={handleSelectDate}
                onEventPress={(id) => router.push(`/calendar/${id}` as any)}
                onTaskPress={(id) => router.push(`/tasks/${id}` as any)}
                detailed
              />
            )}

            {calMode === 'month-mini' && (
              <View style={styles.gridWrap}>
                <CalendarGrid
                  year={viewYear}
                  month={viewMonth}
                  selectedDate={selectedDate}
                  events={allEvents}
                  tasks={tasks}
                  moodEntries={moodEntries}
                  onSelectDate={handleSelectDate}
                />
              </View>
            )}

            {calMode === 'week' && (
              <View style={styles.weekCard}>
                <WeekStrip
                  selectedDate={selectedDate}
                  events={allEvents}
                  tasks={tasks}
                  moodEntries={moodEntries}
                  weekOffset={weekOffset}
                  onSelectDate={(d) => { setSelectedDate(d); setDayModalDate(d); }}
                />
              </View>
            )}
          </View>

          {/* Swipe hint label */}
          <Text style={styles.swipeHint}>
            {calMode === 'month-detailed'
              ? 'Przesuń w górę → agenda tygodnia'
              : 'Przesuń w dół → widok miesięczny'}
          </Text>

          {/* ── Day detail (inline, below calendar) ── */}
          <View style={styles.daySection}>
            <Text style={styles.daySectionLabel}>
              {isToday ? 'Dzisiaj' : fmtDay(selectedDate)}
            </Text>

            <View style={styles.timelineWrap}>
              <DayTimeline
                events={selectedEvents}
                date={selectedDate}
                onPress={(id) => router.push(`/calendar/${id}` as any)}
                onAddAtTime={(time) => router.push(`/calendar/add?startTime=${time}&type=event` as any)}
              />
            </View>

            {selectedTasks.length > 0 && (
              <View style={styles.subSection}>
                <View style={styles.subHeader}>
                  <CheckSquare size={12} color={colors.text.muted} />
                  <Text style={styles.subLabel}>ZADANIA</Text>
                </View>
                {selectedTasks.map((t, i) => (
                  <TaskItem
                    key={t.id} task={t} index={i}
                    onToggle={toggleTask}
                    onPress={(id) => router.push(`/tasks/${id}` as any)}
                  />
                ))}
              </View>
            )}

            {selectedExpenses.length > 0 && (
              <View style={styles.subSection}>
                <View style={styles.subHeader}>
                  <Wallet size={12} color={colors.text.muted} />
                  <Text style={styles.subLabel}>FINANSE</Text>
                  <View style={{ flex: 1 }} />
                  {totalExpensesAmt > 0 && (
                    <Text style={styles.summaryExpense}>-{fmtAmount(totalExpensesAmt, expCurrency)}</Text>
                  )}
                  {totalIncomeAmt > 0 && (
                    <Text style={styles.summaryIncome}>+{fmtAmount(totalIncomeAmt, expCurrency)}</Text>
                  )}
                </View>
                {selectedExpenses.map(exp => (
                  <Pressable
                    key={exp.id}
                    onPress={() => router.push(`/expenses/${exp.id}` as any)}
                    style={styles.expenseRow}
                  >
                    <View style={[styles.expenseDot, { backgroundColor: getCategoryMeta(exp.category as any).color }]} />
                    <View style={styles.expenseInfo}>
                      <Text style={styles.expenseNote} numberOfLines={1}>
                        {exp.note || getCategoryMeta(exp.category as any).label || exp.category}
                      </Text>
                      {exp.storeName ? (
                        <Text style={styles.expenseStore} numberOfLines={1}>{exp.storeName}</Text>
                      ) : null}
                    </View>
                    <Text style={[styles.expenseAmount, exp.type === 'income' ? styles.incomeColor : styles.expenseColor]}>
                      {exp.type === 'income' ? '+' : '-'}{fmtAmount(exp.amount, exp.currency)}
                    </Text>
                  </Pressable>
                ))}
              </View>
            )}

            {selectedEvents.length === 0 && selectedTasks.length === 0 && selectedExpenses.length === 0 && (
              <View style={styles.emptyDay}>
                <Text style={styles.emptyText}>Pusty dzień</Text>
                <Text style={styles.emptyHint}>Dotknij oś czasu żeby dodać event</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </View>

      {/* ── Day modal ── */}
      {dayModalDate && (
        <DayModal
          date={dayModalDate}
          events={modalEvents}
          tasks={modalTasks}
          onClose={() => setDayModalDate(null)}
          onToggleTask={toggleTask}
        />
      )}
    </SafeAreaView>
  );
}

const makeStyles = (c: any, vp: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  todayBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, borderWidth: 1, borderColor: vp.cardBorder,
    backgroundColor: vp.accentDim,
  },
  todayBtnText: { ...typography.caption, color: vp.accent, fontWeight: '700', fontSize: 11 },
  iconBtn: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: vp.card, borderWidth: 1, borderColor: vp.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },

  monthNav: {
    flexDirection: 'row', alignItems: 'center',
    paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[2],
    gap: spacing[2],
  },
  navBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: vp.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: vp.cardBorder,
  },
  monthTitleBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[2],
  },
  modeToggle: {
    flexDirection: 'row', gap: 2,
    backgroundColor: vp.card,
    borderRadius: radius.md, padding: 2,
    borderWidth: 1, borderColor: vp.cardBorder,
  },
  modeBtn: {
    width: 28, height: 26, borderRadius: radius.sm,
    alignItems: 'center', justifyContent: 'center',
  },
  modeBtnActive: {
    backgroundColor: V + '20',
  },
  monthLabel: { ...typography.h3, color: c.text.primary, fontWeight: '800', textTransform: 'uppercase', letterSpacing: 0.5 },
  yearLabel:  { ...typography.caption, color: vp.accent, marginTop: 2, fontWeight: '700' },

  swipeHint: {
    fontSize: 9, color: c.text.muted, textAlign: 'center',
    letterSpacing: 0.5, marginTop: spacing[1], marginBottom: spacing[2],
    opacity: 0.6,
  },

  gridWrap: {
    marginHorizontal: spacing[2],
    backgroundColor: vp.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: vp.cardBorder,
    paddingTop: spacing[3],
  },

  weekCard: {
    marginHorizontal: spacing[2],
    backgroundColor: vp.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: vp.cardBorder,
  },

  daySection: { paddingHorizontal: spacing[3], paddingTop: spacing[3], gap: spacing[3] },
  daySectionLabel: {
    fontSize: 10, fontWeight: '700', color: vp.muted,
    letterSpacing: 1.4, textTransform: 'uppercase',
  },

  timelineWrap: {
    backgroundColor: vp.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: vp.cardBorder,
    padding: spacing[3],
    overflow: 'hidden',
  },

  subSection: { gap: spacing[2] },
  subHeader:  { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: spacing[1] },
  subLabel: {
    fontSize: 9, fontWeight: '700', color: vp.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },

  summaryExpense: { fontSize: 11, fontWeight: '700', color: '#F44336' },
  summaryIncome:  { fontSize: 11, fontWeight: '700', color: '#4CAF50', marginLeft: spacing[2] },

  expenseRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: vp.card, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    borderWidth: 1, borderColor: vp.cardBorder,
  },
  expenseDot:   { width: 8, height: 8, borderRadius: 4 },
  expenseInfo:  { flex: 1 },
  expenseNote:  { fontSize: 13, fontWeight: '600', color: c.text.primary },
  expenseStore: { fontSize: 10, color: c.text.muted, marginTop: 1 },
  expenseAmount: { fontSize: 13, fontWeight: '700' },
  expenseColor:  { color: '#F44336' },
  incomeColor:   { color: '#4CAF50' },

  emptyDay:  { alignItems: 'center', paddingVertical: spacing[4], gap: spacing[2] },
  emptyText: { ...typography.label, color: c.text.secondary },
  emptyHint: { ...typography.caption, color: c.text.muted },
});
