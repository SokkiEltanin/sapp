import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, Text as SvgText } from 'react-native-svg';
import { ChevronLeft, Flame, Snowflake } from 'lucide-react-native';

import { Habit } from '@/types';
import { getHabits } from '@/utils/habits';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { spacing, radius, fonts } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';

const ICE = '#7DD3FC';
const MONTHS = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const WINDOW = 371;   // 53 tygodnie — czytelna rolka roku kończąca się dziś

function pad(n: number) { return String(n).padStart(2, '0'); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function goalFor(h: Habit): number {
  if (!h.type || h.type === 'check') return 1;
  return h.dailyGoal ?? 1;
}

type DayState = 'done' | 'frozen' | 'miss';

// Rok konkretnego NAWYKU w pikselach (GitHub-style). Dzień zrobiony = kolor nawyku,
// uratowany zamrożeniem = NIEBIESKI, pominięty = tło. Klik z widgetu „Twoje serie".
export default function HabitYear() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const params = useLocalSearchParams<{ id?: string }>();
  const habitId = typeof params.id === 'string' ? params.id : '';
  const frozen = useStreakFreezeStore(st => st.frozen);

  const [habit, setHabit] = useState<Habit | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});   // date → count
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let alive = true;
    (async () => {
      const list = await getHabits();
      const h = list.find(x => x.id === habitId) ?? null;
      const today = new Date();
      const keys: string[] = [];
      const dates: string[] = [];
      for (let i = WINDOW - 1; i >= 0; i--) {
        const d = new Date(today); d.setDate(today.getDate() - i);
        dates.push(ymd(d)); keys.push(`habits_cnt_${ymd(d)}`);
      }
      const map: Record<string, number> = {};
      try {
        const pairs = await AsyncStorage.multiGet(keys);
        pairs.forEach(([, raw], i) => {
          if (!raw) return;
          try { const obj = JSON.parse(raw); const v = Number(obj?.[habitId]); if (v > 0) map[dates[i]] = v; } catch {}
        });
      } catch {}
      if (alive) { setHabit(h); setCounts(map); setLoading(false); }
    })();
    return () => { alive = false; };
  }, [habitId]);

  // ── build the grid + stats ─────────────────────────────────────────────
  const { cells, cols, monthCols, stats } = useMemo(() => {
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - (WINDOW - 1));
    const firstDow = (start.getDay() + 6) % 7;   // Monday = 0
    const goal = habit ? goalFor(habit) : 1;
    const stateFor = (ds: string): DayState => {
      if ((counts[ds] ?? 0) >= goal) return 'done';
      if (frozen[`${habitId}|${ds}`]) return 'frozen';
      return 'miss';
    };
    const cells: { col: number; row: number; st: DayState }[] = [];
    const monthCols: { m: number; col: number }[] = [];
    let idx = 0, lastMonth = -1;
    const seq: DayState[] = [];
    for (const cur = new Date(start); cur <= today; cur.setDate(cur.getDate() + 1)) {
      const ds = ymd(cur);
      const st = stateFor(ds);
      seq.push(st);
      const p = firstDow + idx;
      const col = Math.floor(p / 7), row = p % 7;
      const month = cur.getMonth();
      if (month !== lastMonth) { monthCols.push({ m: month, col }); lastMonth = month; }
      cells.push({ col, row, st });
      idx++;
    }
    const cols = Math.floor((firstDow + idx - 1) / 7) + 1;
    // stats z sekwencji (oldest→today)
    let doneDays = 0, frozenDays = 0, longest = 0, run = 0, current = 0;
    for (let i = 0; i < seq.length; i++) {
      const alive = seq[i] === 'done' || seq[i] === 'frozen';
      if (seq[i] === 'done') doneDays++;
      if (seq[i] === 'frozen') frozenDays++;
      if (alive) { run++; if (run > longest) longest = run; } else run = 0;
    }
    for (let i = seq.length - 1; i >= 0; i--) { if (seq[i] === 'done' || seq[i] === 'frozen') current++; else break; }
    return { cells, cols, monthCols, stats: { doneDays, frozenDays, longest, current } };
  }, [counts, frozen, habit, habitId]);

  const CELL = 6, GAP = 1.6, TOP = 12;
  const W = cols * (CELL + GAP);
  const H = TOP + 7 * (CELL + GAP);
  const habitColor = habit?.color ?? c.text.primary;
  const colorFor = (st: DayState) => st === 'done' ? habitColor + 'DD' : st === 'frozen' ? ICE : c.fill.subtle;

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={24} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{habit?.title ?? 'Nawyk'} — rok</Text>
        <View style={{ width: 24 }} />
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* aktualna seria hero */}
        <View style={[s.hero, { borderColor: habitColor + '3A', backgroundColor: habitColor + '12' }]}>
          <Flame size={26} color={habitColor} fill={stats.current > 0 ? habitColor : 'transparent'} />
          <View style={{ flex: 1 }}>
            <Text style={s.heroNum}>{stats.current} <Text style={s.heroUnit}>{stats.current === 1 ? 'dzień' : 'dni'} z rzędu</Text></Text>
            <Text style={s.heroSub}>najdłuższa w roku: {stats.longest} dni</Text>
          </View>
        </View>

        {/* legenda */}
        <View style={s.legendRow}>
          <View style={s.legendItem}><View style={[s.sw, { backgroundColor: habitColor + 'DD' }]} /><Text style={s.legendTxt}>zrobione</Text></View>
          <View style={s.legendItem}><View style={[s.sw, { backgroundColor: ICE }]} /><Text style={s.legendTxt}>zamrożone</Text></View>
          <View style={s.legendItem}><View style={[s.sw, { backgroundColor: c.fill.subtle }]} /><Text style={s.legendTxt}>pominięte</Text></View>
        </View>

        {/* siatka */}
        {!loading && (
          <View style={s.gridCard}>
            <View style={{ width: '100%', aspectRatio: W / H }}>
              <Svg width="100%" height="100%" viewBox={`0 0 ${W} ${H}`} preserveAspectRatio="xMidYMid meet">
                {monthCols.map(({ m, col }) => (
                  <SvgText key={`${m}-${col}`} x={col * (CELL + GAP)} y={8} fontSize={6} fill={c.text.muted}>{MONTHS[m]}</SvgText>
                ))}
                {cells.map((cell, i) => (
                  <Rect key={i} x={cell.col * (CELL + GAP)} y={TOP + cell.row * (CELL + GAP)} width={CELL} height={CELL} rx={1.3} fill={colorFor(cell.st)} />
                ))}
              </Svg>
            </View>
          </View>
        )}

        {/* statystyki */}
        <View style={s.statsRow}>
          <View style={s.stat}><Text style={s.statVal}>{stats.doneDays}</Text><Text style={s.statKey}>dni zrobione</Text></View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Snowflake size={14} color={ICE} /><Text style={[s.statVal, { color: ICE }]}>{stats.frozenDays}</Text></View>
            <Text style={s.statKey}>zamrożenia użyte</Text>
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}><Text style={s.statVal}>{Math.round((stats.doneDays / WINDOW) * 100)}%</Text><Text style={s.statKey}>frekwencja</Text></View>
        </View>
        <View style={{ height: 30 }} />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  head: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingHorizontal: spacing[4], paddingVertical: spacing[3] },
  title: { fontSize: 17, fontWeight: '800', color: c.text.primary, flex: 1 },
  scroll: { paddingHorizontal: spacing[4], gap: spacing[3] },

  hero: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], borderRadius: radius.xl, borderWidth: 1, padding: spacing[4] },
  heroNum: { fontFamily: fonts.display, fontSize: 32, color: c.text.primary, letterSpacing: -0.5 },
  heroUnit: { fontSize: 13, fontWeight: '700', color: c.text.muted },
  heroSub: { fontSize: 12, color: c.text.secondary, marginTop: 2 },

  legendRow: { flexDirection: 'row', gap: spacing[4], justifyContent: 'center' },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  sw: { width: 10, height: 10, borderRadius: 3 },
  legendTxt: { fontSize: 11, fontWeight: '600', color: c.text.muted },

  gridCard: { backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[3] },

  statsRow: { flexDirection: 'row', alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, paddingVertical: spacing[3] },
  stat: { flex: 1, alignItems: 'center', gap: 2 },
  statVal: { fontFamily: fonts.display, fontSize: 20, color: c.text.primary },
  statKey: { fontSize: 10.5, fontWeight: '600', color: c.text.muted },
  statDiv: { width: 1, height: 30, backgroundColor: c.border.subtle },
}));
