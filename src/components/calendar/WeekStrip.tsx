import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CalendarEvent, MoodEntry, MOOD_COLORS, Task } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import { haptic } from '@/utils/haptics';

const DAY_NAMES = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

function pad(n: number) { return String(n).padStart(2, '0'); }

function toDateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getMondayOfWeek(dateStr: string): Date {
  const d = new Date(dateStr);
  const day = d.getDay(); // 0=Sun
  const diff = day === 0 ? -6 : 1 - day;
  const monday = new Date(d);
  monday.setDate(d.getDate() + diff);
  return monday;
}

interface Props {
  selectedDate: string;
  events: CalendarEvent[];
  tasks: Task[];
  moodEntries?: MoodEntry[];
  weekOffset: number;
  onSelectDate: (date: string) => void;
}

export default function WeekStrip({ selectedDate, events, tasks, moodEntries = [], weekOffset, onSelectDate }: Props) {
  const today = toDateStr(new Date());

  // Start from Monday of selectedDate's week + weekOffset
  const base = getMondayOfWeek(selectedDate);
  base.setDate(base.getDate() + weekOffset * 7);

  const days = Array.from({ length: 7 }, (_, i) => {
    const d = new Date(base);
    d.setDate(base.getDate() + i);
    return { date: toDateStr(d), day: d.getDate(), dow: d.getDay() };
  });

  const hasEv = (date: string) => events.some(e => e.date.startsWith(date));
  const hasTk = (date: string) => tasks.some(t => t.deadline?.startsWith(date) && t.status !== 'done');
  const hasUrgent = (date: string) => tasks.some(
    t => t.deadline?.startsWith(date) && t.status !== 'done' && t.priority === 'high'
  );
  const moodFor = (date: string) => moodEntries.find(e => e.date === date);

  return (
    <View style={styles.strip}>
      {days.map(({ date, day, dow }) => {
        const sel = date === selectedDate;
        const isTd = date === today;
        const ev = hasEv(date);
        const tk = hasTk(date);
        const urgent = hasUrgent(date);
        const isWeekend = dow === 0 || dow === 6;
        const mood = moodFor(date);
        const moodBg = mood && !sel ? MOOD_COLORS[mood.mood] + '20' : undefined;

        return (
          <Pressable key={date} onPress={() => { haptic.tap(); onSelectDate(date); }} style={styles.cell}>
            <Text style={[styles.dayName, isWeekend && styles.dayNameWeekend, sel && styles.dayNameSel]}>
              {DAY_NAMES[dow]}
            </Text>
            <View style={[
              styles.numCircle,
              sel && styles.numCircleSel,
              isTd && !sel && styles.numCircleToday,
            ]}>
              <Text style={[
                styles.num,
                sel && styles.numSel,
                isTd && !sel && styles.numToday,
                isWeekend && !sel && styles.numWeekend,
              ]}>
                {day}
              </Text>
            </View>
            {mood && !sel && (
              <View style={[styles.moodBar, { backgroundColor: MOOD_COLORS[mood.mood] }]} />
            )}
            <View style={styles.dotRow}>
              {ev && <View style={[styles.dot, sel && styles.dotSel]} />}
              {tk && <View style={[styles.dot, urgent && !sel ? styles.dotUrgent : (sel ? styles.dotSel : undefined)]} />}
              {!ev && !tk && <View style={styles.dotPlaceholder} />}
            </View>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  strip: {
    flexDirection: 'row',
    paddingHorizontal: spacing[2],
    paddingVertical: spacing[1],
  },
  cell: {
    flex: 1,
    alignItems: 'center',
    gap: 4,
    paddingVertical: spacing[2],
  },
  dayName: {
    fontSize: 10,
    fontWeight: '500',
    color: colors.text.muted,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
  },
  dayNameWeekend: { color: colors.text.muted },
  dayNameSel: { color: colors.text.inverse, opacity: 0.6 },
  numCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  numCircleSel: {
    backgroundColor: colors.text.primary,
  },
  numCircleToday: {
    borderWidth: 1.5,
    borderColor: 'rgba(255,255,255,0.35)',
  },
  num: {
    fontSize: 15,
    fontWeight: '500',
    color: colors.text.secondary,
  },
  numSel: {
    color: colors.text.inverse,
    fontWeight: '800',
  },
  numToday: {
    color: colors.text.primary,
    fontWeight: '700',
  },
  numWeekend: {
    color: colors.text.muted,
  },
  moodBar: {
    width: 20,
    height: 3,
    borderRadius: 2,
    marginTop: 2,
    opacity: 0.85,
  },
  dotRow: {
    flexDirection: 'row',
    gap: 3,
    height: 5,
    alignItems: 'center',
    marginTop: 2,
  },
  dot: {
    width: 4,
    height: 4,
    borderRadius: 2,
    backgroundColor: 'rgba(255,255,255,0.35)',
  },
  dotPlaceholder: {
    width: 4,
    height: 4,
  },
  dotSel: { backgroundColor: colors.text.inverse + 'AA' },
  dotUrgent: { backgroundColor: colors.accent.danger },
});
