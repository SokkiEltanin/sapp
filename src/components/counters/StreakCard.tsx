import { View, Text, StyleSheet } from 'react-native';
import { Flame, Check } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { streakColor } from './StreakFlame';

const WD = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
const MO = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const MO_LONG = ['Styczeń', 'Luty', 'Marzec', 'Kwiecień', 'Maj', 'Czerwiec', 'Lipiec', 'Sierpień', 'Wrzesień', 'Październik', 'Listopad', 'Grudzień'];

// ── local-date helpers ──────────────────────────────────────────────────────────
const atMidnight = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate());
const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
const daysInMonth = (y: number, m: number) => new Date(y, m + 1, 0).getDate();
const dayDiff = (a: Date, b: Date) => Math.round((atMidnight(a).getTime() - atMidnight(b).getTime()) / 86400000);

// A day is part of the streak if it's today or within the (days-1) days before it.
const covers = (today: Date, x: Date, days: number) => {
  const ago = dayDiff(today, x);
  return ago >= 0 && ago <= days - 1;
};

type Tier = 'week' | 'month' | 'halfyear';
// The strip zooms out as the streak grows so it stays meaningful: a week for a young
// streak, the month's days once it's a week old, and the last 6 months once it's a
// full month long (uses the current month's real length, so Feb 28/29 is respected).
function tierFor(days: number, today: Date): Tier {
  if (days < 7) return 'week';
  if (days < daysInMonth(today.getFullYear(), today.getMonth())) return 'month';
  return 'halfyear';
}

// ── the adaptive strip ──────────────────────────────────────────────────────────
export function StreakStrip({ days, color }: { days: number; color: string }) {
  const c = useColors();
  const today = new Date();
  const tier = tierFor(days, today);

  const dotFilled = { backgroundColor: color, borderColor: color };
  const dotIdle = { backgroundColor: 'transparent', borderColor: c.border.default };
  const dotToday = { backgroundColor: 'transparent', borderColor: color };

  if (tier === 'week') {
    const monday = addDays(today, -((today.getDay() + 6) % 7));
    return (
      <View>
        <Text style={[st.caption, { color: c.text.muted }]}>TEN TYDZIEŃ</Text>
        <View style={st.strip}>
          {Array.from({ length: 7 }, (_, i) => {
            const date = addDays(monday, i);
            const isToday = dayDiff(today, date) === 0;
            const filled = covers(today, date, days);
            return (
              <View key={i} style={st.col}>
                <View style={[st.dot, filled ? dotFilled : isToday ? dotToday : dotIdle, isToday && !filled && st.ring]}>
                  {filled && <Check size={13} color="#FFFFFF" strokeWidth={3.5} />}
                </View>
                <Text style={[st.wd, { color: isToday ? color : c.text.muted, fontWeight: isToday ? '800' : '600' }]}>{WD[i]}</Text>
              </View>
            );
          })}
        </View>
      </View>
    );
  }

  if (tier === 'month') {
    const y = today.getFullYear(), m = today.getMonth();
    const dim = daysInMonth(y, m);
    const todayD = today.getDate();
    return (
      <View>
        <Text style={[st.caption, { color: c.text.muted }]}>{MO_LONG[m].toUpperCase()}</Text>
        <View style={st.dayRow}>
          {Array.from({ length: dim }, (_, i) => {
            const d = i + 1;
            const date = new Date(y, m, d);
            const isToday = d === todayD;
            const filled = covers(today, date, days);
            return (
              <View key={d} style={[st.miniDot, filled ? dotFilled : isToday ? dotToday : dotIdle, isToday && !filled && st.ring]} />
            );
          })}
        </View>
        <View style={st.endLabels}>
          <Text style={[st.wd, { color: c.text.muted }]}>1</Text>
          <Text style={[st.wd, { color: c.text.muted }]}>{dim}</Text>
        </View>
      </View>
    );
  }

  // half-year: last 6 months, each cell full / partial / idle by streak coverage
  const streakStart = addDays(today, -(days - 1));
  const months = Array.from({ length: 6 }, (_, k) => {
    const d = new Date(today.getFullYear(), today.getMonth() - (5 - k), 1);
    const y = d.getFullYear(), m = d.getMonth();
    const dim = daysInMonth(y, m);
    const monthStart = new Date(y, m, 1);
    const monthEnd = new Date(y, m, dim);
    const s = streakStart > monthStart ? streakStart : monthStart;
    const e = today < monthEnd ? today : monthEnd;
    const count = e >= s ? dayDiff(e, s) + 1 : 0;
    const frac = count / dim;
    const isCurrent = y === today.getFullYear() && m === today.getMonth();
    return { m, frac, isCurrent };
  });
  return (
    <View>
      <Text style={[st.caption, { color: c.text.muted }]}>OSTATNIE 6 MIESIĘCY</Text>
      <View style={st.strip}>
        {months.map(({ m, frac, isCurrent }, i) => {
          const full = frac >= 0.999;
          const partial = frac > 0 && !full;
          const cell = full
            ? dotFilled
            : partial
              ? { backgroundColor: color + '40', borderColor: color }
              : isCurrent ? dotToday : dotIdle;
          return (
            <View key={i} style={st.col}>
              <View style={[st.cell, cell, isCurrent && !full && st.ring]}>
                {full && <Check size={13} color="#FFFFFF" strokeWidth={3.5} />}
              </View>
              <Text style={[st.wd, { color: isCurrent ? color : c.text.muted, fontWeight: isCurrent ? '800' : '600' }]}>{MO[m]}</Text>
            </View>
          );
        })}
      </View>
    </View>
  );
}

// Back-compat alias — older call sites imported WeekStrip.
export const WeekStrip = StreakStrip;

// A rich, glanceable streak card in the style of a fitness widget: a lit flame with
// the day count, plus a strip that zooms week → month → half-year as the streak grows.
export default function StreakCard({ name, days }: { name: string; days: number }) {
  const c = useColors();
  const color = streakColor(days);

  return (
    <View style={st.wrap}>
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

      <StreakStrip days={days} color={color} />
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
  caption: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, marginBottom: 8 },
  strip: { flexDirection: 'row', justifyContent: 'space-between' },
  col: { alignItems: 'center', gap: 6, flex: 1 },
  dot: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  cell: { width: 34, height: 30, borderRadius: 9, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  ring: { borderWidth: 2 },
  wd: { fontSize: 10.5 },
  dayRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  miniDot: { width: 8, height: 8, borderRadius: 4, borderWidth: 1 },
  endLabels: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 6 },
});
