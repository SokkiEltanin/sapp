import { View, Text, StyleSheet, Pressable } from 'react-native';
import { CalendarEvent, MoodEntry, MOOD_COLORS, Task } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';

const HEADERS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function daysInMonth(y: number, m: number) { return new Date(y, m + 1, 0).getDate(); }
function startOffset(y: number, m: number) { return (new Date(y, m, 1).getDay() + 6) % 7; }

interface Props {
  year: number;
  month: number;
  selectedDate: string;
  events: CalendarEvent[];
  tasks: Task[];
  moodEntries?: MoodEntry[];
  onSelectDate: (date: string) => void;
  detailed?: boolean;
}

export default function CalendarGrid({ year, month, selectedDate, events, tasks, moodEntries = [], onSelectDate, detailed = false }: Props) {
  const numDays = daysInMonth(year, month);
  const offset = startOffset(year, month);
  const today = new Date();
  const todayStr = `${today.getFullYear()}-${pad(today.getMonth() + 1)}-${pad(today.getDate())}`;

  const cells: (number | null)[] = [
    ...Array(offset).fill(null),
    ...Array.from({ length: numDays }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const ds = (day: number) => `${year}-${pad(month + 1)}-${pad(day)}`;
  const eventsFor = (day: number) => events.filter(e => e.date.startsWith(ds(day)));
  const evColor = (day: number) => {
    const ev = events.find(e => e.date.startsWith(ds(day)));
    return ev ? (ev.color ?? 'rgba(255,255,255,0.4)') : null;
  };
  const hasEv = (day: number) => events.some(e => e.date.startsWith(ds(day)));
  const hasTk = (day: number) => tasks.some(t => t.deadline?.startsWith(ds(day)) && t.status !== 'done');
  const hasHighTk = (day: number) => tasks.some(
    t => t.deadline?.startsWith(ds(day)) && t.status !== 'done' && t.priority === 'high',
  );
  const moodFor = (day: number) => moodEntries.find(e => e.date === ds(day));

  return (
    <View style={[styles.grid, detailed && styles.gridDetailed]}>
      {/* Day headers */}
      <View style={[styles.headerRow, detailed && styles.headerRowDetailed]}>
        {HEADERS.map((h, i) => (
          <Text key={h} style={[
            styles.header,
            (i >= 5) && styles.headerWeekend,
            detailed && styles.headerDetailed,
          ]}>{h}</Text>
        ))}
      </View>

      {Array.from({ length: cells.length / 7 }, (_, w) => (
        <View key={w} style={[styles.row, detailed && styles.rowDetailed]}>
          {cells.slice(w * 7, w * 7 + 7).map((day, i) => {
            if (!day) {
              return (
                <View
                  key={i}
                  style={detailed ? styles.detailedEmpty : styles.cellWrap}
                />
              );
            }

            const d = ds(day);
            const sel = d === selectedDate;
            const isTd = d === todayStr;
            const isWeekend = i >= 5;
            const ev = hasEv(day);
            const evCol = evColor(day);
            const tk = hasTk(day);
            const urgent = hasHighTk(day);
            const mood = moodFor(day);

            // ── Detailed (Google Calendar style) ─────────────────────────────
            if (detailed) {
              const dayEvs = eventsFor(day);
              const dayTks = tasks.filter(t =>
                (t.deadline?.startsWith(d) || t.scheduledDate === d) && t.status !== 'done'
              );
              const hasUrgent = dayTks.some(t => t.priority === 'high');

              // Show up to 3 event pills; tasks get 1 pill if any
              const maxEvPills = dayTks.length > 0 ? 2 : 3;
              const visibleEvs = dayEvs.slice(0, maxEvPills);
              const overflow = dayEvs.length - visibleEvs.length + (dayTks.length > 1 ? dayTks.length - 1 : 0);

              return (
                <Pressable
                  key={i}
                  onPress={() => onSelectDate(d)}
                  style={[styles.detailedCell, sel && styles.detailedCellSel]}
                >
                  {/* Day number */}
                  <View style={styles.detailedNumRow}>
                    <Text style={[
                      styles.detailedNum,
                      isTd && styles.detailedNumToday,
                      sel && !isTd && styles.detailedNumSel,
                      isWeekend && !sel && !isTd && styles.detailedNumWeekend,
                    ]}>
                      {day}
                    </Text>
                    {mood && (
                      <View style={[styles.moodDotTiny, { backgroundColor: MOOD_COLORS[mood.mood] }]} />
                    )}
                  </View>

                  {/* Event pills */}
                  {visibleEvs.map((ev, ei) => (
                    <View
                      key={ei}
                      style={[styles.eventPill, {
                        backgroundColor: (ev.color ?? colors.accent.blue) + '28',
                        borderLeftColor: ev.color ?? colors.accent.blue,
                      }]}
                    >
                      <Text style={styles.eventPillText} numberOfLines={1}>
                        {ev.startTime ? `${ev.startTime.slice(0, 5)} ` : ''}{ev.title}
                      </Text>
                    </View>
                  ))}

                  {/* Task pill */}
                  {dayTks.length > 0 && (
                    <View style={[styles.eventPill, {
                      backgroundColor: hasUrgent
                        ? colors.accent.danger + '22'
                        : 'rgba(255,255,255,0.06)',
                      borderLeftColor: hasUrgent ? colors.accent.danger : 'rgba(255,255,255,0.25)',
                    }]}>
                      <Text style={styles.eventPillText} numberOfLines={1}>
                        {dayTks.length === 1 ? dayTks[0].title : `${dayTks.length} zadań`}
                      </Text>
                    </View>
                  )}

                  {overflow > 0 && (
                    <Text style={styles.overflowText}>+{overflow}</Text>
                  )}
                </Pressable>
              );
            }

            // ── Compact (default) ─────────────────────────────────────────────
            return (
              <View key={i} style={styles.cellWrap}>
                <Pressable
                  onPress={() => onSelectDate(d)}
                  style={[styles.cell, sel && styles.cellSel, isTd && !sel && styles.cellToday]}
                >
                  <Text style={[
                    styles.num,
                    sel && styles.numSel,
                    isTd && !sel && styles.numToday,
                    isWeekend && !sel && styles.numWeekend,
                  ]}>
                    {day}
                  </Text>
                  {mood && !sel && (
                    <View style={[styles.moodDot, { backgroundColor: MOOD_COLORS[mood.mood] }]} />
                  )}
                  {(ev || tk) && (
                    <View style={styles.dots}>
                      {ev && <View style={[styles.dot, sel ? styles.dotSel : { backgroundColor: evCol ?? 'rgba(255,255,255,0.4)' }]} />}
                      {tk && <View style={[
                        styles.dot,
                        urgent && !sel ? styles.dotUrgent : undefined,
                        sel ? styles.dotSel : undefined,
                      ]} />}
                    </View>
                  )}
                </Pressable>
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  grid: { paddingHorizontal: spacing[3], paddingBottom: spacing[3] },
  gridDetailed: { paddingHorizontal: 0, paddingBottom: 0 },

  headerRow: {
    flexDirection: 'row',
    paddingBottom: spacing[2],
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(255,255,255,0.04)',
    marginBottom: spacing[1],
  },
  headerRowDetailed: {
    paddingBottom: spacing[1],
    marginBottom: 0,
    paddingHorizontal: spacing[3],
    borderBottomColor: 'rgba(255,255,255,0.07)',
  },
  header: {
    flex: 1, textAlign: 'center',
    ...typography.caption, color: colors.text.muted,
    fontWeight: '600', fontSize: 10, letterSpacing: 0.8,
    textTransform: 'uppercase', paddingVertical: spacing[1],
  },
  headerDetailed: { fontSize: 9, letterSpacing: 0.5 },
  headerWeekend: { color: colors.text.muted, opacity: 0.55 },

  row: { flexDirection: 'row' },
  rowDetailed: {
    flexDirection: 'row',
    alignItems: 'stretch',
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255,255,255,0.07)',
  },

  // ── Compact cells ───────────────────────────────────────────────────────────
  cellWrap: { flex: 1, alignItems: 'center', paddingVertical: spacing[1] },
  cell: {
    width: 40, height: 48, alignItems: 'center', justifyContent: 'center',
    borderRadius: radius.md, gap: 3,
  },
  cellSel: { backgroundColor: colors.text.primary },
  cellToday: { borderWidth: 1.5, borderColor: 'rgba(255,255,255,0.25)' },
  num: { fontSize: 14, fontWeight: '400', color: colors.text.secondary, lineHeight: 18 },
  numSel: { color: colors.bg.primary, fontWeight: '800' },
  numToday: { color: colors.text.primary, fontWeight: '700' },
  numWeekend: { opacity: 0.5 },
  moodDot: { width: 16, height: 3, borderRadius: 2, opacity: 0.9 },
  dots: { flexDirection: 'row', gap: 3, height: 5 },
  dot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.4)' },
  dotSel: { backgroundColor: colors.bg.primary + 'BB' },
  dotUrgent: { backgroundColor: colors.accent.danger },

  // ── Detailed cells ──────────────────────────────────────────────────────────
  detailedEmpty: {
    flex: 1, minHeight: 90,
    borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.05)',
  },
  detailedCell: {
    flex: 1, minHeight: 90,
    borderRightWidth: 0.5, borderRightColor: 'rgba(255,255,255,0.05)',
    paddingHorizontal: 3, paddingTop: 5, paddingBottom: 4,
    gap: 2,
  },
  detailedCellSel: { backgroundColor: 'rgba(255,255,255,0.05)' },

  detailedNumRow: {
    flexDirection: 'row', alignItems: 'center',
    justifyContent: 'space-between', marginBottom: 2,
  },
  detailedNum: {
    fontSize: 11, fontWeight: '500', color: colors.text.muted,
    width: 20, height: 20, textAlign: 'center', lineHeight: 20,
  },
  detailedNumToday: {
    color: '#fff', fontWeight: '800',
    backgroundColor: colors.accent.blue,
    borderRadius: 10, overflow: 'hidden',
  },
  detailedNumSel: {
    color: colors.bg.primary, fontWeight: '800',
    backgroundColor: colors.text.primary,
    borderRadius: 10, overflow: 'hidden',
  },
  detailedNumWeekend: { color: '#f87171', opacity: 0.8 },

  moodDotTiny: { width: 5, height: 5, borderRadius: 3 },

  eventPill: {
    borderLeftWidth: 2,
    paddingHorizontal: 3, paddingVertical: 2,
    borderRadius: 2,
  },
  eventPillText: { fontSize: 8, color: colors.text.primary, fontWeight: '500' },
  overflowText: {
    fontSize: 8, color: colors.text.muted,
    paddingHorizontal: 3, fontWeight: '600',
  },
});
