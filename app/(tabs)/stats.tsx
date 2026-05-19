import { useState, useEffect, useMemo, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, RefreshControl, Pressable, Animated } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, ChevronLeft, ChevronRight, CalendarDays, RefreshCw } from 'lucide-react-native';

import ScreenHeader from '@/components/ui/ScreenHeader';
import PressableScale from '@/components/ui/PressableScale';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import WeekStrip from '@/components/calendar/WeekStrip';
import TaskItem from '@/components/calendar/TaskItem';
import DayTimeline from '@/components/calendar/DayTimeline';
import { useCalendarStore } from '@/store/calendarStore';
import { useMoodStore } from '@/store/moodStore';
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

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDay(dateStr: string) {
  const d = new Date(dateStr);
  return `${DAY_FULL[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

export default function CalendarTabScreen() {
  const { panHandlers, animatedStyle } = useTabSwipe();
  const { events, tasks, selectedDate, setEvents, setTasks, updateTask, setSelectedDate, setLoading } =
    useCalendarStore();
  const { entries: moodEntries } = useMoodStore();

  const now = new Date();
  const [viewYear, setViewYear] = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [refreshing, setRefreshing] = useState(false);
  const [monthExpanded, setMonthExpanded] = useState(true);
  const [weekOffset, setWeekOffset] = useState(0);
  const [gcalEvents, setGcalEvents] = useState<CalendarEvent[]>([]);
  const [gcalSyncing, setGcalSyncing] = useState(false);
  const [gcalAvailable, setGcalAvailable] = useState(false);

  const gridHeight  = useRef(new Animated.Value(330)).current;
  const gridOpacity = useRef(new Animated.Value(1)).current;

  const toggleMonth = () => {
    const next = !monthExpanded;
    setMonthExpanded(next);
    Animated.parallel([
      Animated.timing(gridHeight,  { toValue: next ? 330 : 0, duration: 280, useNativeDriver: false }),
      Animated.timing(gridOpacity, { toValue: next ? 1 : 0,   duration: 240, useNativeDriver: false }),
    ]).start();
  };

  useEffect(() => {
    load();
    checkGcal();
  }, []);

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
    } catch {
    } finally {
      setGcalSyncing(false);
    }
  };

  const load = async () => {
    try {
      setLoading(true);
      const [evs, tks] = await Promise.all([
        calendarService.getAllEvents(),
        tasksService.getAllTasks(),
      ]);
      setEvents(evs);
      setTasks(tks);
    } catch (_) {
    } finally {
      setLoading(false);
    }
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
    const t = todayStr();
    setSelectedDate(t);
    setViewYear(now.getFullYear());
    setViewMonth(now.getMonth());
    setWeekOffset(0);
  };

  const handleSelectDate = (date: string) => {
    setSelectedDate(date);
    const d = new Date(date);
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
      t.deadline?.startsWith(selectedDate) || t.scheduledDate === selectedDate
    ),
    [tasks, selectedDate],
  );
  const upcomingTasks = useMemo(
    () => tasks
      .filter(t => t.status !== 'done')
      .sort((a, b) => (a.deadline ?? 'z').localeCompare(b.deadline ?? 'z'))
      .slice(0, 12),
    [tasks],
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

  const hasSelected = selectedEvents.length > 0 || selectedTasks.length > 0;
  const isToday = selectedDate === todayStr();

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
                <PressableScale onPress={syncGcal} style={styles.addBtn}>
                  <RefreshCw size={14} color={gcalSyncing ? colors.text.muted : colors.accent.blue} />
                </PressableScale>
              )}
              <PressableScale onPress={() => router.push('/calendar/add')} style={styles.addBtn}>
                <Plus size={16} color={colors.text.primary} />
              </PressableScale>
            </View>
          }
        />

        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={refreshing} onRefresh={refresh} tintColor={colors.text.muted} />}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Month nav + collapsible grid */}
          <View>
            <View style={styles.monthNav}>
              <PressableScale onPress={prevMonth} style={styles.navBtn}>
                <ChevronLeft size={18} color={colors.text.secondary} />
              </PressableScale>

              <Pressable onPress={toggleMonth} style={styles.monthTitleBtn}>
                <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth]}</Text>
                <Text style={styles.yearLabel}>{viewYear}</Text>
                <CalendarDays size={12} color={monthExpanded ? colors.text.secondary : colors.text.muted} style={{ marginLeft: 4 }} />
              </Pressable>

              <PressableScale onPress={nextMonth} style={styles.navBtn}>
                <ChevronRight size={18} color={colors.text.secondary} />
              </PressableScale>
            </View>

            <Animated.View style={{ height: gridHeight, opacity: gridOpacity, overflow: 'hidden' }}>
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
            </Animated.View>
          </View>

          {/* Week strip — always visible */}
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

          {/* Day detail */}
          <View style={styles.section}>
            <Text style={styles.sectionLabel}>
              {hasSelected ? fmtDay(selectedDate) : 'Nadchodzące zadania'}
            </Text>

            {hasSelected ? (
              <>
                {selectedEvents.some(e => e.startTime) ? (
                  <DayTimeline
                    events={selectedEvents}
                    date={selectedDate}
                    onPress={(id) => { if (!id.startsWith('gcal-')) router.push(`/calendar/${id}` as any); }}
                    onAddAtTime={(time) => router.push(`/calendar/add?startTime=${time}&type=event` as any)}
                  />
                ) : (
                  selectedEvents.map((ev) => (
                    <PressableScale key={ev.id} onPress={() => { if (!ev.id.startsWith('gcal-')) router.push(`/calendar/${ev.id}` as any); }}>
                      <View style={styles.eventRow}>
                        {ev.color && <View style={[styles.evColorBar, { backgroundColor: ev.color }]} />}
                        <View style={styles.evTime}>
                          <Text style={styles.evTimeText}>{ev.startTime ?? '—'}</Text>
                          {ev.endTime && <Text style={styles.evTimeSub}>{ev.endTime}</Text>}
                        </View>
                        <View style={styles.evInfo}>
                          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                            <Text style={styles.evTitle}>{ev.title}</Text>
                            {ev.id.startsWith('gcal-') && (
                              <View style={styles.gcalBadge}><Text style={styles.gcalBadgeText}>G</Text></View>
                            )}
                          </View>
                          {ev.description ? (
                            <Text style={styles.evDesc} numberOfLines={1}>{ev.description}</Text>
                          ) : null}
                        </View>
                      </View>
                    </PressableScale>
                  ))
                )}
                {selectedTasks.map((t, i) => (
                  <TaskItem
                    key={t.id} task={t} index={selectedEvents.length + i}
                    onToggle={toggleTask}
                    onPress={(id) => router.push(`/tasks/${id}` as any)}
                  />
                ))}
              </>
            ) : upcomingTasks.length > 0 ? (
              upcomingTasks.map((t, i) => (
                <TaskItem key={t.id} task={t} index={i} onToggle={toggleTask} onPress={(id) => router.push(`/tasks/${id}` as any)} />
              ))
            ) : (
              <View style={styles.empty}>
                <Text style={styles.emptyText}>Brak zadań</Text>
                <Text style={styles.emptyHint}>Dotknij "+" aby dodać</Text>
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
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  todayBtnText: { ...typography.caption, color: colors.text.secondary, fontWeight: '600', fontSize: 11 },
  addBtn: {
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
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md,
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
    marginTop: spacing[2],
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.04)',
  },
  weekNavRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing[1],
  },
  weekNavBtn: {
    width: 28, height: 48,
    alignItems: 'center', justifyContent: 'center',
  },

  section: { paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[2] },
  sectionLabel: {
    fontSize: 10, fontWeight: '600', color: colors.text.muted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[1],
  },

  eventRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.card, borderRadius: radius.md,
    overflow: 'hidden', marginBottom: spacing[2],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    minHeight: 52,
  },
  evColorBar: { width: 3, alignSelf: 'stretch' },
  evTime:     { width: 48, alignItems: 'center', paddingVertical: spacing[3] },
  evTimeText: { ...typography.caption, color: colors.text.secondary, fontWeight: '700', fontSize: 11 },
  evTimeSub:  { ...typography.caption, color: colors.text.muted, fontSize: 9, marginTop: 1 },
  evInfo:     { flex: 1, paddingVertical: spacing[3], paddingRight: spacing[3] },
  evTitle:    { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600' },
  evDesc:     { ...typography.caption, color: colors.text.muted, marginTop: 2 },

  gcalBadge: {
    paddingHorizontal: 5, paddingVertical: 1, borderRadius: 4,
    backgroundColor: '#039BE5' + '28', borderWidth: 1, borderColor: '#039BE5' + '55',
  },
  gcalBadgeText: { fontSize: 9, fontWeight: '800', color: '#039BE5', letterSpacing: 0.3 },

  empty:     { alignItems: 'center', paddingVertical: spacing[8], gap: spacing[2] },
  emptyText: { ...typography.label, color: colors.text.secondary },
  emptyHint: { ...typography.caption, color: colors.text.muted },
});
