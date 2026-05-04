import { View, Text, StyleSheet, Pressable, TouchableOpacity } from 'react-native';
import { CalendarEvent } from '@/types';
import { colors, spacing, radius } from '@/theme';

const HOUR_HEIGHT  = 58;
const START_HOUR   = 6;
const END_HOUR     = 23;
const TOTAL_HOURS  = END_HOUR - START_HOUR;
const LEFT_WIDTH   = 40;

function parseTime(t?: string): { h: number; m: number } {
  if (!t) return { h: 9, m: 0 };
  const [h, m] = t.split(':').map(Number);
  return { h: isNaN(h) ? 9 : h, m: isNaN(m) ? 0 : m };
}

function timeToY(h: number, m: number) {
  return (h - START_HOUR) * HOUR_HEIGHT + (m / 60) * HOUR_HEIGHT;
}

interface Props {
  events: CalendarEvent[];
  date: string;
  onPress?: (id: string) => void;
  onAddAtTime?: (time: string) => void;
}

export default function DayTimeline({ events, date, onPress, onAddAtTime }: Props) {
  const now   = new Date();
  const today = `${now.getFullYear()}-${String(now.getMonth()+1).padStart(2,'0')}-${String(now.getDate()).padStart(2,'0')}`;
  const isToday = date === today;

  const timedEvents   = events.filter(e => e.startTime);
  const allDayEvents  = events.filter(e => !e.startTime);

  const nowY = isToday
    ? timeToY(now.getHours(), now.getMinutes())
    : -1;

  const totalHeight = TOTAL_HOURS * HOUR_HEIGHT;

  return (
    <View>
      {/* All-day section */}
      {allDayEvents.length > 0 && (
        <View style={styles.allDaySection}>
          <Text style={styles.allDayLabel}>całodz.</Text>
          <View style={styles.allDayList}>
            {allDayEvents.map(ev => (
              <Pressable key={ev.id} onPress={() => onPress?.(ev.id)}
                style={[styles.allDayPill, { backgroundColor: (ev.color ?? colors.accent.purple) + '28', borderColor: (ev.color ?? colors.accent.purple) + '55' }]}>
                <Text style={[styles.allDayText, { color: ev.color ?? colors.accent.purple }]} numberOfLines={1}>
                  {ev.title}
                </Text>
              </Pressable>
            ))}
          </View>
        </View>
      )}

      {/* Timeline */}
      <View style={{ height: totalHeight, flexDirection: 'row' }}>
        {/* Hour labels + grid lines */}
        <View style={{ width: LEFT_WIDTH }}>
          {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => {
            const h = START_HOUR + i;
            return (
              <View key={h} style={[styles.hourRow, { top: i * HOUR_HEIGHT }]}>
                <Text style={styles.hourLabel}>{String(h).padStart(2, '0')}</Text>
              </View>
            );
          })}
        </View>

        {/* Grid + events */}
        <TouchableOpacity
          style={{ flex: 1, position: 'relative' }}
          activeOpacity={1}
          onPress={e => {
            if (!onAddAtTime) return;
            const y = e.nativeEvent.locationY;
            const totalH = y / HOUR_HEIGHT;
            const h = Math.floor(totalH) + START_HOUR;
            const m = Math.round((totalH % 1) * 4) * 15;
            const clampedH = Math.max(START_HOUR, Math.min(END_HOUR - 1, h));
            const clampedM = m >= 60 ? 0 : m;
            onAddAtTime(`${String(clampedH).padStart(2,'0')}:${String(clampedM).padStart(2,'0')}`);
          }}
        >
          {/* Hour dividers */}
          {Array.from({ length: TOTAL_HOURS + 1 }, (_, i) => (
            <View key={i} style={[styles.gridLine, { top: i * HOUR_HEIGHT }]} />
          ))}

          {/* Half-hour dashed lines */}
          {Array.from({ length: TOTAL_HOURS }, (_, i) => (
            <View key={`h${i}`} style={[styles.halfLine, { top: i * HOUR_HEIGHT + HOUR_HEIGHT / 2 }]} />
          ))}

          {/* Current time indicator */}
          {nowY >= 0 && nowY <= totalHeight && (
            <View style={[styles.nowLine, { top: nowY }]}>
              <View style={styles.nowDot} />
              <View style={styles.nowBar} />
            </View>
          )}

          {/* Events */}
          {timedEvents.map(ev => {
            const { h: sh, m: sm } = parseTime(ev.startTime);
            const { h: eh, m: em } = parseTime(ev.endTime ?? `${sh + 1}:${String(sm).padStart(2,'0')}`);
            const top    = timeToY(sh, sm);
            const durationMins = (eh - sh) * 60 + (em - sm);
            const height = Math.max(28, (durationMins / 60) * HOUR_HEIGHT);
            const col    = ev.color ?? colors.accent.purple;
            const clamped = Math.min(top, totalHeight - 32);

            return (
              <Pressable
                key={ev.id}
                onPress={() => onPress?.(ev.id)}
                style={[styles.eventBlock, {
                  top: clamped,
                  height,
                  backgroundColor: col + '22',
                  borderLeftColor: col,
                }]}
              >
                <Text style={[styles.eventTitle, { color: col }]} numberOfLines={2}>
                  {ev.title}
                </Text>
                {ev.startTime && (
                  <Text style={[styles.eventTime, { color: col + 'BB' }]}>
                    {ev.startTime}{ev.endTime ? ` – ${ev.endTime}` : ''}
                  </Text>
                )}
              </Pressable>
            );
          })}
        </TouchableOpacity>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  allDaySection: {
    flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2],
    paddingHorizontal: spacing[2], paddingBottom: spacing[3],
  },
  allDayLabel: {
    width: LEFT_WIDTH, fontSize: 9, color: colors.text.muted,
    fontWeight: '600', textAlign: 'right', paddingTop: 4,
  },
  allDayList: { flex: 1, gap: spacing[1], flexWrap: 'wrap', flexDirection: 'row' },
  allDayPill: {
    paddingHorizontal: spacing[2], paddingVertical: 4,
    borderRadius: radius.sm, borderWidth: 1,
  },
  allDayText: { fontSize: 11, fontWeight: '600' },

  hourRow: {
    position: 'absolute', left: 0, right: 0,
    alignItems: 'flex-end', paddingRight: spacing[2],
  },
  hourLabel: {
    fontSize: 9, color: colors.text.muted, fontWeight: '600',
    lineHeight: 12, marginTop: -6,
  },

  gridLine: {
    position: 'absolute', left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.06)',
  },
  halfLine: {
    position: 'absolute', left: 0, right: 0, height: 1,
    backgroundColor: 'rgba(255,255,255,0.03)',
  },

  nowLine: {
    position: 'absolute', left: 0, right: 0,
    flexDirection: 'row', alignItems: 'center',
    zIndex: 10,
  },
  nowDot: {
    width: 8, height: 8, borderRadius: 4,
    backgroundColor: colors.accent.red, marginLeft: -4,
  },
  nowBar: { flex: 1, height: 1.5, backgroundColor: colors.accent.red },

  eventBlock: {
    position: 'absolute', left: 4, right: 4,
    borderLeftWidth: 3, borderRadius: radius.sm,
    paddingHorizontal: spacing[2], paddingVertical: 4,
    overflow: 'hidden',
    borderTopRightRadius: radius.sm, borderBottomRightRadius: radius.sm,
  },
  eventTitle: { fontSize: 11, fontWeight: '700', lineHeight: 15 },
  eventTime: { fontSize: 9, fontWeight: '500', marginTop: 1 },
});
