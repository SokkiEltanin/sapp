import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, PanResponder, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, RefreshCw, CheckSquare, Wallet } from 'lucide-react-native';

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
import { CalendarEvent } from '@/types';
import { notificationsService } from '@/services/notificationsService';
import { colors, spacing, radius, typography } from '@/theme';
import { useTabSwipe } from '@/hooks/useTabSwipe';

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
const MONTH_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const DAY_FULL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

const CATEGORY_COLORS: Record<string, string> = {
  groceries: '#4CAF50', transport: '#2196F3', entertainment: '#9C27B0',
  health: '#F44336', clothing: '#FF9800', housing: '#795548',
  subscriptions: '#00BCD4', salary: '#4CAF50', freelance: '#8BC34A',
  gift: '#E91E63', transfer: '#607D8B', investment: '#FF5722',
  other: '#9E9E9E', other_income: '#9E9E9E',
};
const CATEGORY_LABELS: Record<string, string> = {
  groceries: 'Zakupy', transport: 'Transport', entertainment: 'Rozrywka',
  health: 'Zdrowie', clothing: 'Ubrania', housing: 'Dom',
  subscriptions: 'Subskrypcje', salary: 'Wynagrodzenie', freelance: 'Freelance',
  gift: 'Prezent', transfer: 'Przelew', investment: 'Inwestycje',
  other: 'Inne', other_income: 'Inne przychody',
};

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

export default function CalendarTabScreen() {
  const { panHandlers, animatedStyle } = useTabSwipe();
  const { events, tasks, selectedDate, setEvents, setTasks, updateTask, setSelectedDate, setLoading } =
    useCalendarStore();
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();

  const now = new Date();
  const [viewYear, setViewYear]         = useState(now.getFullYear());
  const [viewMonth, setViewMonth]       = useState(now.getMonth());
  const [refreshing, setRefreshing]     = useState(false);
  const [monthExpanded, setMonthExpanded] = useState(true);
  const [weekOffset, setWeekOffset]     = useState(0);
  const [gcalEvents, setGcalEvents]     = useState<CalendarEvent[]>([]);
  const [gcalSyncing, setGcalSyncing]   = useState(false);
  const [gcalAvailable, setGcalAvailable] = useState(false);

  const monthSwipePR = useRef(
    PanResponder.create({
      onMoveShouldSetPanResponder: (_, { dx, dy }) =>
        Math.abs(dx) > 18 && Math.abs(dx) > Math.abs(dy) * 2,
      onPanResponderRelease: (_, { dx, vx }) => {
        if (Math.abs(dx) > 50 || Math.abs(vx) > 0.4) {
          if (dx < 0) setViewMonth(m => { if (m === 11) { setViewYear(y => y + 1); return 0; } return m + 1; });
          else        setViewMonth(m => { if (m === 0)  { setViewYear(y => y - 1); return 11; } return m - 1; });
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
    setSelectedDate(date);
    const d = new Date(date + 'T12:00:00');
    setViewYear(d.getFullYear());
    setViewMonth(d.getMonth());
    setWeekOffset(0);
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

  const toggleTask = async (id: string) => {
    const task = tasks.find(t => t.id === id);
    if (!task) return;
    const next = task.status === 'done' ? 'pending' : 'done';
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

  return (
    <SafeAreaView style={styles.container} edges={['top']} {...panHandlers}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <ScreenHeader
          title="Kalendarz"
          subtitle={isToday ? 'Dzisiaj' : fmtDay(selectedDate)}
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
          contentContainerStyle={{ paddingBottom: 140 }}
        >
          {/* ── Month nav + calendar ── */}
          <View {...monthSwipePR.panHandlers}>
            <View style={styles.monthNav}>
              <PressableScale onPress={prevMonth} style={styles.navBtn}>
                <ChevronLeft size={18} color={colors.text.secondary} />
              </PressableScale>

              <Pressable onPress={() => setMonthExpanded(v => !v)} style={styles.monthTitleBtn}>
                <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth]}</Text>
                <Text style={styles.yearLabel}>{viewYear}</Text>
                <CalendarDays
                  size={12}
                  color={monthExpanded ? colors.text.secondary : colors.text.muted}
                  style={{ marginLeft: 4 }}
                />
              </Pressable>

              <PressableScale onPress={nextMonth} style={styles.navBtn}>
                <ChevronRight size={18} color={colors.text.secondary} />
              </PressableScale>
            </View>

            {/* Monthly grid OR week strip — never both simultaneously */}
            {monthExpanded ? (
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
            ) : (
              <View style={styles.weekCard}>
                <View style={styles.weekNavRow}>
                  <PressableScale onPress={() => setWeekOffset(w => w - 1)} style={styles.weekNavBtn}>
                    <ChevronLeft size={15} color={colors.text.muted} />
                  </PressableScale>
                  <WeekStrip
                    selectedDate={selectedDate}
                    events={allEvents}
                    tasks={tasks}
                    moodEntries={moodEntries}
                    weekOffset={weekOffset}
                    onSelectDate={(d) => { setSelectedDate(d); setWeekOffset(0); }}
                  />
                  <PressableScale onPress={() => setWeekOffset(w => w + 1)} style={styles.weekNavBtn}>
                    <ChevronRight size={15} color={colors.text.muted} />
                  </PressableScale>
                </View>
              </View>
            )}
          </View>

          {/* ── Day detail ── */}
          <View style={styles.daySection}>
            <Text style={styles.daySectionLabel}>
              {isToday ? 'Dzisiaj' : fmtDay(selectedDate)}
            </Text>

            {/* Time-block timeline */}
            <View style={styles.timelineWrap}>
              <DayTimeline
                events={selectedEvents}
                date={selectedDate}
                onPress={(id) => { if (!id.startsWith('gcal-')) router.push(`/calendar/${id}` as any); }}
                onAddAtTime={(time) => router.push(`/calendar/add?startTime=${time}&type=event` as any)}
              />
            </View>

            {/* Tasks for the selected day */}
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

            {/* Expenses / income for the selected day */}
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
                    onPress={() => router.push(`/finances/${exp.id}` as any)}
                    style={styles.expenseRow}
                  >
                    <View style={[styles.expenseDot, { backgroundColor: CATEGORY_COLORS[exp.category] ?? '#9E9E9E' }]} />
                    <View style={styles.expenseInfo}>
                      <Text style={styles.expenseNote} numberOfLines={1}>
                        {exp.note || CATEGORY_LABELS[exp.category] || exp.category}
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

            {/* Empty state — timeline still shown above for tap-to-add */}
            {selectedEvents.length === 0 && selectedTasks.length === 0 && selectedExpenses.length === 0 && (
              <View style={styles.emptyDay}>
                <Text style={styles.emptyText}>Pusty dzień</Text>
                <Text style={styles.emptyHint}>Dotknij oś czasu żeby dodać event</Text>
              </View>
            )}
          </View>
        </ScrollView>
      </Animated.View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },

  headerRight: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  todayBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
  },
  todayBtnText: { ...typography.caption, color: colors.text.secondary, fontWeight: '600', fontSize: 11 },
  iconBtn: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  monthNav: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingTop: spacing[3], paddingBottom: spacing[2],
  },
  navBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: colors.bg.card, alignItems: 'center', justifyContent: 'center',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  monthTitleBtn: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md,
  },
  monthLabel: { ...typography.h3, color: colors.text.primary, fontWeight: '700' },
  yearLabel:  { ...typography.caption, color: colors.text.muted, marginTop: 2 },

  gridWrap: {
    marginHorizontal: spacing[2],
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    paddingTop: spacing[3],
  },

  weekCard: {
    marginHorizontal: spacing[2],
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  weekNavRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[1] },
  weekNavBtn: { width: 28, height: 48, alignItems: 'center', justifyContent: 'center' },

  daySection: { paddingHorizontal: spacing[3], paddingTop: spacing[4], gap: spacing[3] },
  daySectionLabel: {
    fontSize: 10, fontWeight: '700', color: colors.text.muted,
    letterSpacing: 1.4, textTransform: 'uppercase',
  },

  timelineWrap: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
    padding: spacing[3],
    overflow: 'hidden',
  },

  subSection: { gap: spacing[2] },
  subHeader:  { flexDirection: 'row', alignItems: 'center', gap: spacing[1], marginBottom: spacing[1] },
  subLabel: {
    fontSize: 9, fontWeight: '700', color: colors.text.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },

  summaryExpense: { fontSize: 11, fontWeight: '700', color: '#F44336' },
  summaryIncome:  { fontSize: 11, fontWeight: '700', color: '#4CAF50', marginLeft: spacing[2] },

  expenseRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.bg.card, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  expenseDot:   { width: 8, height: 8, borderRadius: 4 },
  expenseInfo:  { flex: 1 },
  expenseNote:  { fontSize: 13, fontWeight: '600', color: colors.text.primary },
  expenseStore: { fontSize: 10, color: colors.text.muted, marginTop: 1 },
  expenseAmount: { fontSize: 13, fontWeight: '700' },
  expenseColor:  { color: '#F44336' },
  incomeColor:   { color: '#4CAF50' },

  emptyDay:  { alignItems: 'center', paddingVertical: spacing[4], gap: spacing[2] },
  emptyText: { ...typography.label, color: colors.text.secondary },
  emptyHint: { ...typography.caption, color: colors.text.muted },
});
