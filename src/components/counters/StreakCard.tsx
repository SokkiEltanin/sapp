import { View, Text, StyleSheet } from 'react-native';
import { Flame, Check } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { streakColor } from './StreakFlame';

const WD = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];

type Cell = 'done' | 'today-done' | 'today' | 'idle';

// Which days of the CURRENT week (Mon..Sun) the streak covers. A streak of `days`
// runs back from today, so a past weekday is "done" when it's within the last
// `days` days; today is "done" once the streak is at least 1.
function weekCells(days: number): Cell[] {
  const dow = (new Date().getDay() + 6) % 7; // 0=Mon .. 6=Sun
  return Array.from({ length: 7 }, (_, i): Cell => {
    if (i === dow) return days >= 1 ? 'today-done' : 'today';
    if (i > dow) return 'idle';
    return dow - i < days ? 'done' : 'idle';
  });
}

// The Mon–Sun completion strip on its own — reused by StreakCard and the /counters
// cards so both surfaces show the same week-at-a-glance view.
export function WeekStrip({ days, color }: { days: number; color: string }) {
  const c = useColors();
  const cells = weekCells(days);
  return (
    <View style={st.strip}>
      {cells.map((cell, i) => {
        const filled = cell === 'done' || cell === 'today-done';
        const isToday = cell === 'today' || cell === 'today-done';
        return (
          <View key={i} style={st.dayCol}>
            <View style={[
              st.dot,
              filled
                ? { backgroundColor: color, borderColor: color }
                : { backgroundColor: 'transparent', borderColor: isToday ? color : c.border.default },
              isToday && !filled && { borderWidth: 2 },
            ]}>
              {filled && <Check size={13} color="#FFFFFF" strokeWidth={3.5} />}
            </View>
            <Text style={[st.wd, { color: isToday ? color : c.text.muted, fontWeight: isToday ? '800' : '600' }]}>{WD[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

// A rich, glanceable streak card in the style of a fitness widget: a lit flame with
// the day count, plus a Mon–Sun strip that ticks off the days the streak covered.
export default function StreakCard({ name, days }: { name: string; days: number }) {
  const c = useColors();
  const color = streakColor(days);

  return (
    <View style={st.wrap}>
      {/* headline: flame chip + count */}
      <View style={st.head}>
        <View style={[st.flameChip, { backgroundColor: color + '22', borderColor: color + '55' }]}>
          <Flame size={24} color={color} fill={days >= 1 ? color : 'transparent'} strokeWidth={2} />
        </View>
        <View style={{ flex: 1, minWidth: 0 }}>
          <Text style={[st.label, { color: c.text.muted }]} numberOfLines={1}>{name.toUpperCase()}</Text>
          <View style={st.countRow}>
            <Text style={[st.count, { color: c.text.primary }]}>{days}</Text>
            <Text style={[st.countUnit, { color: c.text.muted }]}>{days === 1 ? 'dzień' : 'dni'}</Text>
          </View>
        </View>
      </View>

      <WeekStrip days={days} color={color} />
    </View>
  );
}

const st = StyleSheet.create({
  wrap: { gap: 14 },
  head: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  flameChip: { width: 46, height: 46, borderRadius: 14, alignItems: 'center', justifyContent: 'center', borderWidth: 1 },
  label: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8 },
  countRow: { flexDirection: 'row', alignItems: 'baseline', gap: 6, marginTop: 1 },
  count: { fontSize: 30, fontWeight: '900', letterSpacing: -1 },
  countUnit: { fontSize: 13, fontWeight: '700' },
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  dayCol: { alignItems: 'center', gap: 6, flex: 1 },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  wd: { fontSize: 10.5 },
});
