import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  RefreshControl, Animated, Pressable,
} from 'react-native';
import { router } from 'expo-router';
import { ChevronLeft, ChevronRight, CalendarDays, Plus } from 'lucide-react-native';

import CalendarGrid from './CalendarGrid';
import WeekStrip from './WeekStrip';
import TaskItem from './TaskItem';
import DayTimeline from './DayTimeline';
import PressableScale from '@/components/ui/PressableScale';
import { useMoodStore } from '@/store/moodStore';
import { calendarService } from '@/services/calendarService';
import { Task, CalendarEvent } from '@/types';
import { colors, spacing, radius } from '@/theme';

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
const MONTH_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const DAY_FULL   = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDay(s: string) {
  const d = new Date(s);
  return `${DAY_FULL[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

interface Props {
  tasks: Task[];
  onToggleTask: (id: string) => void;
}

export default function CalendarView({ tasks, onToggleTask }: Props) {
  const { entries: moodEntries } = useMoodStore();
  const [events, setEvents]             = useState<CalendarEvent[]>([]);
  const [loading, setLoading]           = useState(false);
  const [selectedDate, setSelectedDate] = useState(todayStr());
  const now = new Date();
  const [viewYear, setViewYear]   = useState(now.getFullYear());
  const [viewMonth, setViewMonth] = useState(now.getMonth());
  const [monthExpanded, setMonthExpanded] = useState(false);
  const [weekOffset, setWeekOffset]       = useState(0);

  const gridHeight  = useRef(new Animated.Value(0)).current;
  const gridOpacity = useRef(new Animated.Value(0)).current;

  useEffect(() => { load(); }, []);

  const load = async () => {
    try {
      setLoading(true);
      const evs = await calendarService.getAllEvents();
      setEvents(evs);
    } catch (_) {
    } finally {
      setLoading(false);
    }
  };

  const toggleMonth = () => {
    const next = !monthExpanded;
    setMonthExpanded(next);
    Animated.parallel([
      Animated.timing(gridHeight,  { toValue: next ? 330 : 0, duration: 280, useNativeDriver: false }),
      Animated.timing(gridOpacity, { toValue: next ? 1   : 0, duration: 240, useNativeDriver: false }),
    ]).start();
  };

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

  const selectedEvents = useMemo(
    () => events.filter(e => e.date.startsWith(selectedDate)),
    [events, selectedDate],
  );
  const selectedTasks = useMemo(
    () => tasks.filter(t => t.deadline?.startsWith(selectedDate) || t.scheduledDate === selectedDate),
    [tasks, selectedDate],
  );
  const upcomingTasks = useMemo(
    () => tasks
      .filter(t => t.status !== 'done')
      .sort((a, b) => (a.deadline ?? 'z').localeCompare(b.deadline ?? 'z'))
      .slice(0, 12),
    [tasks],
  );

  const hasSelected = selectedEvents.length > 0 || selectedTasks.length > 0;
  const isToday     = selectedDate === todayStr();

  return (
    <ScrollView
      showsVerticalScrollIndicator={false}
      refreshControl={
        <RefreshControl refreshing={loading} onRefresh={load} tintColor={colors.text.muted} />
      }
      contentContainerStyle={{ paddingBottom: 120 }}
    >
      {/* Month nav */}
      <View style={styles.monthNav}>
        <PressableScale onPress={prevMonth} style={styles.navBtn}>
          <ChevronLeft size={18} color={colors.text.secondary} />
        </PressableScale>

        <Pressable onPress={toggleMonth} style={styles.monthTitleBtn}>
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

      {/* Collapsible month grid */}
      <Animated.View style={{ height: gridHeight, opacity: gridOpacity, overflow: 'hidden' }}>
        <View style={styles.gridWrap}>
          <CalendarGrid
            year={viewYear}
            month={viewMonth}
            selectedDate={selectedDate}
            events={events}
            tasks={tasks}
            moodEntries={moodEntries}
            onSelectDate={handleSelectDate}
          />
        </View>
      </Animated.View>

      {/* Week strip */}
      <View style={styles.weekCard}>
        <View style={styles.weekNavRow}>
          <PressableScale onPress={() => setWeekOffset(w => w - 1)} style={styles.weekNavBtn}>
            <ChevronLeft size={15} color={colors.text.muted} />
          </PressableScale>
          <WeekStrip
            selectedDate={selectedDate}
            events={events}
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

      {/* Day header row */}
      <View style={styles.dayHeader}>
        <Text style={styles.sectionLabel}>
          {hasSelected ? fmtDay(selectedDate) : 'Nadchodzące zadania'}
        </Text>
        <View style={styles.dayActions}>
          {!isToday && (
            <PressableScale onPress={goToday} style={styles.todayBtn}>
              <Text style={styles.todayBtnText}>Dziś</Text>
            </PressableScale>
          )}
          <PressableScale
            onPress={() => router.push(`/calendar/add?date=${selectedDate}` as any)}
            style={styles.addBtn}
          >
            <Plus size={14} color={colors.text.primary} />
          </PressableScale>
        </View>
      </View>

      {/* Day content */}
      <View style={styles.section}>
        {hasSelected ? (
          <>
            {selectedEvents.some(e => e.startTime) ? (
              <DayTimeline
                events={selectedEvents}
                date={selectedDate}
                onPress={(id) => router.push(`/calendar/${id}` as any)}
                onAddAtTime={(time) => router.push(`/calendar/add?startTime=${time}&type=event` as any)}
              />
            ) : (
              selectedEvents.map(ev => (
                <PressableScale key={ev.id} onPress={() => router.push(`/calendar/${ev.id}` as any)}>
                  <View style={styles.eventRow}>
                    {ev.color && <View style={[styles.evColorBar, { backgroundColor: ev.color }]} />}
                    <View style={styles.evTime}>
                      <Text style={styles.evTimeText}>{ev.startTime ?? '—'}</Text>
                      {ev.endTime && <Text style={styles.evTimeSub}>{ev.endTime}</Text>}
                    </View>
                    <View style={styles.evInfo}>
                      <Text style={styles.evTitle}>{ev.title}</Text>
                      {ev.description
                        ? <Text style={styles.evDesc} numberOfLines={1}>{ev.description}</Text>
                        : null}
                    </View>
                  </View>
                </PressableScale>
              ))
            )}
            {selectedTasks.map((t, i) => (
              <TaskItem
                key={t.id}
                task={t}
                index={selectedEvents.length + i}
                onToggle={onToggleTask}
                onPress={(id) => router.push(`/tasks/${id}` as any)}
              />
            ))}
          </>
        ) : upcomingTasks.length > 0 ? (
          upcomingTasks.map((t, i) => (
            <TaskItem
              key={t.id}
              task={t}
              index={i}
              onToggle={onToggleTask}
              onPress={(id) => router.push(`/tasks/${id}` as any)}
            />
          ))
        ) : (
          <View style={styles.empty}>
            <Text style={styles.emptyText}>Brak zadań</Text>
            <Text style={styles.emptyHint}>Dotknij + żeby dodać zadanie lub event</Text>
          </View>
        )}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
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
  monthLabel: { fontSize: 18, fontWeight: '700', color: colors.text.primary },
  yearLabel:  { fontSize: 12, color: colors.text.muted, marginTop: 2 },

  gridWrap: {
    marginHorizontal: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    paddingTop: spacing[3],
  },

  weekCard: {
    marginHorizontal: spacing[2], marginTop: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  weekNavRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[1] },
  weekNavBtn: { width: 28, height: 48, alignItems: 'center', justifyContent: 'center' },

  dayHeader: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2],
  },
  sectionLabel: {
    fontSize: 10, fontWeight: '600', color: colors.text.muted,
    letterSpacing: 1.2, textTransform: 'uppercase',
  },
  dayActions: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  todayBtn: {
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderRadius: radius.md, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
  },
  todayBtnText: { fontSize: 11, color: colors.text.secondary, fontWeight: '600' },
  addBtn: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.bg.elevated, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.1)',
    alignItems: 'center', justifyContent: 'center',
  },

  section: { paddingHorizontal: spacing[4], gap: spacing[2] },

  eventRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.card, borderRadius: radius.md,
    overflow: 'hidden', marginBottom: spacing[2],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
    minHeight: 52,
  },
  evColorBar: { width: 3, alignSelf: 'stretch' },
  evTime:     { width: 48, alignItems: 'center', paddingVertical: spacing[3] },
  evTimeText: { fontSize: 11, color: colors.text.secondary, fontWeight: '700' },
  evTimeSub:  { fontSize: 9,  color: colors.text.muted, marginTop: 1 },
  evInfo:     { flex: 1, paddingVertical: spacing[3], paddingRight: spacing[3] },
  evTitle:    { fontSize: 13, color: colors.text.primary, fontWeight: '600' },
  evDesc:     { fontSize: 11, color: colors.text.muted, marginTop: 2 },

  empty:     { alignItems: 'center', paddingVertical: spacing[8], gap: spacing[2] },
  emptyText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  emptyHint: { fontSize: 12, color: colors.text.muted },
});
