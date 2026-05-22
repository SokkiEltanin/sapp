import { useState, useEffect, useMemo, useRef } from 'react';
import {
  View, Text, StyleSheet, ScrollView, RefreshControl, Pressable,
  Modal, TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Plus, ChevronLeft, ChevronRight, ChevronDown, CalendarDays, Briefcase, List, LayoutGrid } from 'lucide-react-native';

import ScreenHeader from '@/components/ui/ScreenHeader';
import PressableScale from '@/components/ui/PressableScale';
import CalendarGrid from '@/components/calendar/CalendarGrid';
import WeekStrip from '@/components/calendar/WeekStrip';
import TaskItem from '@/components/calendar/TaskItem';
import DayTimeline from '@/components/calendar/DayTimeline';
import { useCalendarStore } from '@/store/calendarStore';
import { useMoodStore } from '@/store/moodStore';
import { useWorkStore } from '@/store/workStore';
import { calendarService, tasksService } from '@/services/calendarService';
import { notificationsService } from '@/services/notificationsService';
import { colors, spacing, radius, typography } from '@/theme';
import { useTabSwipe } from '@/hooks/useTabSwipe';
import { CalendarEvent, Task, MoodEntry } from '@/types';

const MONTH_NAMES = [
  'Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec',
  'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień',
];
const MONTH_SHORT = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const DAY_FULL = ['Niedziela', 'Poniedziałek', 'Wtorek', 'Środa', 'Czwartek', 'Piątek', 'Sobota'];
const DAY_SHORT = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

type CalMode = 'week' | 'month' | 'detailed';

function pad(n: number) { return String(n).padStart(2, '0'); }
function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function fmtDay(dateStr: string) {
  const d = new Date(dateStr);
  return `${DAY_FULL[d.getDay()]}, ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}
function fmtDayShort(dateStr: string) {
  const d = new Date(dateStr + 'T00:00:00');
  return `${DAY_SHORT[d.getDay()]} ${d.getDate()} ${MONTH_SHORT[d.getMonth()]}`;
}

// ─── Full-screen month modal ──────────────────────────────────────────────────

interface MonthModalProps {
  visible: boolean;
  onClose: () => void;
  viewYear: number;
  viewMonth: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  selectedDate: string;
  onSelectDate: (d: string) => void;
  events: CalendarEvent[];
  tasks: Task[];
  moodEntries: MoodEntry[];
  workColor?: string;
  onEventPress: (id: string) => void;
  onAddEvent: () => void;
}

function MonthModal({
  visible, onClose,
  viewYear, viewMonth, onPrevMonth, onNextMonth,
  selectedDate, onSelectDate,
  events, tasks, moodEntries,
  workColor, onEventPress, onAddEvent,
}: MonthModalProps) {
  const monthEvents = useMemo(() => {
    const prefix = `${viewYear}-${pad(viewMonth + 1)}`;
    const filtered = events
      .filter(e => e.date.startsWith(prefix))
      .sort((a, b) => {
        const dateCmp = a.date.localeCompare(b.date);
        if (dateCmp !== 0) return dateCmp;
        return (a.startTime ?? '').localeCompare(b.startTime ?? '');
      });

    const groups: { date: string; evs: CalendarEvent[] }[] = [];
    for (const ev of filtered) {
      const last = groups[groups.length - 1];
      if (last && last.date === ev.date.slice(0, 10)) {
        last.evs.push(ev);
      } else {
        groups.push({ date: ev.date.slice(0, 10), evs: [ev] });
      }
    }
    return groups;
  }, [events, viewYear, viewMonth]);

  return (
    <Modal
      visible={visible}
      animationType="slide"
      presentationStyle="fullScreen"
      statusBarTranslucent
      onRequestClose={onClose}
    >
      <SafeAreaView style={m.safe} edges={['top', 'bottom']}>
        <View style={m.header}>
          <TouchableOpacity onPress={onPrevMonth} style={m.navBtn} activeOpacity={0.7}>
            <ChevronLeft size={18} color={colors.text.secondary} />
          </TouchableOpacity>
          <View style={m.titleWrap}>
            <Text style={m.monthLabel}>{MONTH_NAMES[viewMonth]}</Text>
            <Text style={m.yearLabel}>{viewYear}</Text>
          </View>
          <TouchableOpacity onPress={onNextMonth} style={m.navBtn} activeOpacity={0.7}>
            <ChevronRight size={18} color={colors.text.secondary} />
          </TouchableOpacity>
          <View style={m.headerRight}>
            <TouchableOpacity onPress={onAddEvent} style={m.addBtn} activeOpacity={0.7}>
              <Plus size={16} color={colors.text.primary} />
            </TouchableOpacity>
            <TouchableOpacity onPress={onClose} style={m.closeBtn} activeOpacity={0.7}>
              <ChevronDown size={20} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={m.scroll}
          keyboardShouldPersistTaps="handled"
        >
          <View style={m.gridWrap}>
            <CalendarGrid
              year={viewYear}
              month={viewMonth}
              selectedDate={selectedDate}
              events={events}
              tasks={tasks}
              moodEntries={moodEntries}
              onSelectDate={onSelectDate}
            />
          </View>

          {monthEvents.length > 0 ? (
            <View style={m.eventList}>
              <Text style={m.listHeader}>Eventy w tym miesiącu</Text>
              {monthEvents.map(({ date, evs }) => {
                const isToday = date === todayStr();
                const isSel = date === selectedDate;
                return (
                  <View key={date} style={m.dayGroup}>
                    <TouchableOpacity
                      onPress={() => onSelectDate(date)}
                      activeOpacity={0.7}
                      style={[m.dayLabel, isSel && m.dayLabelSel]}
                    >
                      <Text style={[m.dayLabelText, isToday && { color: colors.accent.blue }, isSel && { color: colors.text.primary, fontWeight: '700' }]}>
                        {fmtDayShort(date)}
                      </Text>
                      {isToday && <View style={m.todayDot} />}
                    </TouchableOpacity>
                    {evs.map(ev => {
                      const isWork = workColor != null && ev.color === workColor;
                      return (
                        <TouchableOpacity
                          key={ev.id}
                          onPress={() => { onClose(); onEventPress(ev.id); }}
                          activeOpacity={0.75}
                          style={m.eventRow}
                        >
                          <View style={[m.colorBar, { backgroundColor: ev.color ?? colors.accent.blue }]} />
                          <View style={m.eventMeta}>
                            {(ev.startTime || ev.endTime) ? (
                              <Text style={m.eventTime}>
                                {ev.startTime ?? ''}{ev.endTime ? ` – ${ev.endTime}` : ''}
                              </Text>
                            ) : (
                              <Text style={m.eventTime}>cały dzień</Text>
                            )}
                            {ev.endTime && ev.startTime && (
                              <Text style={m.eventDuration}>
                                {(() => {
                                  const [sh, sm] = ev.startTime.split(':').map(Number);
                                  const [eh, em] = ev.endTime.split(':').map(Number);
                                  const mins = (eh * 60 + em) - (sh * 60 + sm);
                                  return mins > 0 ? `${Math.floor(mins / 60)}h${mins % 60 > 0 ? ` ${mins % 60}m` : ''}` : '';
                                })()}
                              </Text>
                            )}
                          </View>
                          <View style={m.eventBody}>
                            <Text style={m.eventTitle} numberOfLines={1}>{ev.title}</Text>
                            {ev.description ? (
                              <Text style={m.eventDesc} numberOfLines={1}>{ev.description}</Text>
                            ) : null}
                          </View>
                          {isWork && (
                            <View style={[m.workBadge, { backgroundColor: workColor + '20', borderColor: workColor + '50' }]}>
                              <Briefcase size={10} color={workColor} />
                              <Text style={[m.workBadgeText, { color: workColor }]}>praca</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                );
              })}
            </View>
          ) : (
            <View style={m.emptyMonth}>
              <CalendarDays size={28} color={colors.text.muted} />
              <Text style={m.emptyMonthText}>Brak eventów w tym miesiącu</Text>
            </View>
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const m = StyleSheet.create({
  safe:       { flex: 1, backgroundColor: colors.bg.primary },
  header:     { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[4], paddingVertical: spacing[3], borderBottomWidth: 1, borderBottomColor: 'rgba(255,255,255,0.05)', gap: spacing[1] },
  navBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)' },
  titleWrap:  { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: spacing[2], paddingHorizontal: spacing[2] },
  monthLabel: { fontSize: 20, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3 },
  yearLabel:  { fontSize: 13, color: colors.text.muted, fontWeight: '500' },
  headerRight:{ flexDirection: 'row', gap: spacing[2], marginLeft: spacing[1] },
  addBtn:     { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  closeBtn:   { width: 36, height: 36, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, backgroundColor: colors.bg.card, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  scroll:     { paddingBottom: 40 },
  gridWrap:   { paddingHorizontal: spacing[2], paddingTop: spacing[3], paddingBottom: spacing[3] },
  eventList:  { paddingHorizontal: spacing[4], gap: spacing[2] },
  listHeader: { fontSize: 10, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.5, textTransform: 'uppercase', marginBottom: spacing[1], marginTop: spacing[2] },
  dayGroup:   { gap: spacing[1] },
  dayLabel:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 4, paddingHorizontal: spacing[2], borderRadius: radius.md },
  dayLabelSel:{ backgroundColor: 'rgba(255,255,255,0.04)' },
  dayLabelText:{ fontSize: 11, fontWeight: '600', color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  todayDot:   { width: 5, height: 5, borderRadius: 3, backgroundColor: colors.accent.blue },
  eventRow:   { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.bg.card, borderRadius: radius.lg, overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', minHeight: 52, gap: 0 },
  colorBar:   { width: 3, alignSelf: 'stretch' },
  eventMeta:  { width: 68, paddingVertical: spacing[3], paddingLeft: spacing[3], gap: 2 },
  eventTime:  { fontSize: 10, fontWeight: '700', color: colors.text.secondary },
  eventDuration:{ fontSize: 9, color: colors.text.muted },
  eventBody:  { flex: 1, paddingVertical: spacing[3], paddingRight: spacing[3] },
  eventTitle: { fontSize: 13, fontWeight: '600', color: colors.text.primary },
  eventDesc:  { fontSize: 11, color: colors.text.muted, marginTop: 2 },
  workBadge:  { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, marginRight: spacing[3] },
  workBadgeText:{ fontSize: 9, fontWeight: '700' },
  emptyMonth: { alignItems: 'center', paddingVertical: spacing[10], gap: spacing[3] },
  emptyMonthText:{ fontSize: 14, color: colors.text.muted, fontWeight: '500' },
});

// ─── Main screen ─────────────────────────────────────────────────────────────

export default function CalendarScreen() {
  const { panHandlers, animatedStyle } = useTabSwipe();
  const { events, tasks, selectedDate, setEvents, setTasks, updateTask, setSelectedDate, setLoading } =
    useCalendarStore();
  const { entries: moodEntries } = useMoodStore();
  const { settings: workSettings } = useWorkStore();

  const now = new Date();
  const [calMode, setCalMode]       = useState<CalMode>('month');
  const [viewYear, setViewYear]     = useState(now.getFullYear());
  const [viewMonth, setViewMonth]   = useState(now.getMonth());
  const [modalVisible, setModalVisible] = useState(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // Pull-down opens the full-screen month modal on all platforms
  // (on Android RefreshControl fires onRefresh instead of negative scroll Y)
  const openModal = () => {
    if (!modalVisible) setModalVisible(true);
    load(); // silent background refresh
  };

  useEffect(() => { load(); }, []);

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

  // ─── Shared day detail section ─────────────────────────────────────────────
  const DayDetail = () => (
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
              onPress={(id) => router.push(`/calendar/${id}` as any)}
              onAddAtTime={(time) => router.push(`/calendar/add?startTime=${time}&type=event` as any)}
            />
          ) : (
            selectedEvents.map((ev) => (
              <PressableScale key={ev.id} onPress={() => router.push(`/calendar/${ev.id}` as any)}>
                <View style={styles.eventRow}>
                  {ev.color && <View style={[styles.evColorBar, { backgroundColor: ev.color }]} />}
                  <View style={styles.evTime}>
                    <Text style={styles.evTimeText}>{ev.startTime ?? '—'}</Text>
                    {ev.endTime && <Text style={styles.evTimeSub}>{ev.endTime}</Text>}
                  </View>
                  <View style={styles.evInfo}>
                    <Text style={styles.evTitle}>{ev.title}</Text>
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
          <Text style={styles.emptyHint}>Dotknij "Dodaj" poniżej</Text>
        </View>
      )}
    </View>
  );

  return (
    <SafeAreaView style={styles.container} edges={['top']} {...panHandlers}>
      {/* Full-screen month modal */}
      <MonthModal
        visible={modalVisible}
        onClose={() => setModalVisible(false)}
        viewYear={viewYear}
        viewMonth={viewMonth}
        onPrevMonth={prevMonth}
        onNextMonth={nextMonth}
        selectedDate={selectedDate}
        onSelectDate={(d) => { handleSelectDate(d); }}
        events={events}
        tasks={tasks}
        moodEntries={moodEntries}
        workColor={workSettings.workColor}
        onEventPress={(id) => router.push(`/calendar/${id}` as any)}
        onAddEvent={() => { setModalVisible(false); router.push('/calendar/add'); }}
      />

      <ScreenHeader
        title="Kalendarz"
        subtitle={isToday ? 'Dzisiaj' : fmtDay(selectedDate)}
        rightSlot={
          <View style={styles.headerRight}>
            <PressableScale onPress={goToday} style={styles.todayBtn}>
              <Text style={styles.todayBtnText}>Dziś</Text>
            </PressableScale>
            <PressableScale onPress={() => router.push('/calendar/add')} style={styles.addBtn}>
              <Plus size={16} color={colors.text.primary} />
            </PressableScale>
          </View>
        }
      />

      {/* Mode toggle bar */}
      <View style={styles.modeBar}>
        <TouchableOpacity
          style={[styles.modeTab, calMode === 'week' && styles.modeTabActive]}
          onPress={() => setCalMode('week')}
          activeOpacity={0.7}
        >
          <CalendarDays size={13} color={calMode === 'week' ? colors.text.primary : colors.text.muted} />
          <Text style={[styles.modeTabText, calMode === 'week' && styles.modeTabTextActive]}>Tydzień</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, calMode === 'month' && styles.modeTabActive]}
          onPress={() => setCalMode('month')}
          activeOpacity={0.7}
        >
          <LayoutGrid size={13} color={calMode === 'month' ? colors.text.primary : colors.text.muted} />
          <Text style={[styles.modeTabText, calMode === 'month' && styles.modeTabTextActive]}>Miesiąc</Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[styles.modeTab, calMode === 'detailed' && styles.modeTabActive]}
          onPress={() => setCalMode('detailed')}
          activeOpacity={0.7}
        >
          <List size={13} color={calMode === 'detailed' ? colors.text.primary : colors.text.muted} />
          <Text style={[styles.modeTabText, calMode === 'detailed' && styles.modeTabTextActive]}>Szczegółowy</Text>
        </TouchableOpacity>
      </View>

      {/* ── Week view ──────────────────────────────────────────────────────── */}
      {calMode === 'week' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={openModal} tintColor={colors.text.muted} />}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
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
          <DayDetail />
        </ScrollView>
      )}

      {/* ── Month compact view ─────────────────────────────────────────────── */}
      {calMode === 'month' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={openModal} tintColor={colors.text.muted} />}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          {/* Month nav — tap to expand full screen */}
          <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.8} style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn} activeOpacity={0.7}>
              <ChevronLeft size={18} color={colors.text.secondary} />
            </TouchableOpacity>
            <View style={styles.monthTitleBtn}>
              <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth]}</Text>
              <Text style={styles.yearLabel}>{viewYear}</Text>
              <View style={styles.expandHint}>
                <ChevronDown size={10} color={colors.text.muted} />
              </View>
            </View>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn} activeOpacity={0.7}>
              <ChevronRight size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </TouchableOpacity>

          <View style={styles.gridCard}>
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

          <DayDetail />
        </ScrollView>
      )}

      {/* ── Monthly detailed view ──────────────────────────────────────────── */}
      {calMode === 'detailed' && (
        <ScrollView
          showsVerticalScrollIndicator={false}
          refreshControl={<RefreshControl refreshing={false} onRefresh={openModal} tintColor={colors.text.muted} />}
          contentContainerStyle={{ paddingBottom: 120 }}
        >
          <TouchableOpacity onPress={() => setModalVisible(true)} activeOpacity={0.8} style={styles.monthNav}>
            <TouchableOpacity onPress={prevMonth} style={styles.navBtn} activeOpacity={0.7}>
              <ChevronLeft size={18} color={colors.text.secondary} />
            </TouchableOpacity>
            <View style={styles.monthTitleBtn}>
              <Text style={styles.monthLabel}>{MONTH_NAMES[viewMonth]}</Text>
              <Text style={styles.yearLabel}>{viewYear}</Text>
              <View style={styles.expandHint}>
                <ChevronDown size={10} color={colors.text.muted} />
              </View>
            </View>
            <TouchableOpacity onPress={nextMonth} style={styles.navBtn} activeOpacity={0.7}>
              <ChevronRight size={18} color={colors.text.secondary} />
            </TouchableOpacity>
          </TouchableOpacity>

          {/* Full-width grid — no card wrapper, flush to screen edges */}
          <View style={styles.detailedGridWrap}>
            <CalendarGrid
              year={viewYear}
              month={viewMonth}
              selectedDate={selectedDate}
              events={events}
              tasks={tasks}
              moodEntries={moodEntries}
              onSelectDate={handleSelectDate}
              detailed
            />
          </View>

          <DayDetail />
        </ScrollView>
      )}
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

  // Mode toggle
  modeBar: {
    flexDirection: 'row',
    paddingHorizontal: spacing[4],
    paddingVertical: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.05)',
    gap: spacing[1],
  },
  modeTab: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
    gap: 5, paddingVertical: spacing[2],
    borderRadius: radius.md,
    borderWidth: 1, borderColor: 'transparent',
  },
  modeTabActive: {
    backgroundColor: 'rgba(255,255,255,0.07)',
    borderColor: 'rgba(255,255,255,0.1)',
  },
  modeTabText: { fontSize: 11, color: colors.text.muted, fontWeight: '500' },
  modeTabTextActive: { color: colors.text.primary, fontWeight: '700' },

  // Month nav
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
    borderRadius: radius.md, backgroundColor: colors.bg.card,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  monthLabel: { ...typography.h3, color: colors.text.primary, fontWeight: '700' },
  yearLabel:  { ...typography.caption, color: colors.text.muted, marginTop: 2 },
  expandHint: { marginLeft: 2, opacity: 0.5 },

  gridCard: {
    marginHorizontal: spacing[2], marginTop: spacing[1],
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
    overflow: 'hidden',
  },
  detailedGridWrap: {
    marginTop: spacing[1],
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },

  // Week view
  weekCard: {
    marginHorizontal: spacing[2], marginTop: spacing[3],
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.04)',
  },
  weekNavRow: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[1] },
  weekNavBtn: { width: 28, height: 48, alignItems: 'center', justifyContent: 'center' },

  section: { paddingHorizontal: spacing[4], paddingTop: spacing[4], gap: spacing[2] },
  sectionLabel: {
    fontSize: 10, fontWeight: '600', color: colors.text.muted,
    letterSpacing: 1.2, textTransform: 'uppercase', marginBottom: spacing[1],
  },

  eventRow: {
    flexDirection: 'row', alignItems: 'center',
    backgroundColor: colors.bg.card, borderRadius: radius.md,
    overflow: 'hidden', marginBottom: spacing[2],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)', minHeight: 52,
  },
  evColorBar: { width: 3, alignSelf: 'stretch' },
  evTime:     { width: 48, alignItems: 'center', paddingVertical: spacing[3] },
  evTimeText: { ...typography.caption, color: colors.text.secondary, fontWeight: '700', fontSize: 11 },
  evTimeSub:  { ...typography.caption, color: colors.text.muted, fontSize: 9, marginTop: 1 },
  evInfo:     { flex: 1, paddingVertical: spacing[3], paddingRight: spacing[3] },
  evTitle:    { ...typography.bodySmall, color: colors.text.primary, fontWeight: '600' },
  evDesc:     { ...typography.caption, color: colors.text.muted, marginTop: 2 },

  empty: { alignItems: 'center', paddingVertical: spacing[8], gap: spacing[2] },
  emptyText: { ...typography.label, color: colors.text.secondary },
  emptyHint: { ...typography.caption, color: colors.text.muted },
});
