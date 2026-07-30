import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Svg, { Rect, Text as SvgText, G } from 'react-native-svg';
import { ChevronLeft, Flame, Snowflake } from 'lucide-react-native';

import { Habit } from '@/types';
import { getHabits } from '@/utils/habits';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { useCounters, matchesAvoid, type Counter } from '@/store/countersStore';
import { useFoodStore } from '@/store/foodStore';
import { expensesService } from '@/services/expensesService';
import { spacing, radius, fonts } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';

const ICE = '#7DD3FC';
const CLEAN = '#22C55E';   // licznik „bez X" — dzień czysto
const BREAK = '#E4484A';   // licznik „bez X" — dzień wpadki (kupiłeś)
const MONTHS = ['Sty', 'Lut', 'Mar', 'Kwi', 'Maj', 'Cze', 'Lip', 'Sie', 'Wrz', 'Paź', 'Lis', 'Gru'];
const WINDOW = 371;   // 53 tygodnie — rolka roku kończąca się dziś

function pad(n: number) { return String(n).padStart(2, '0'); }
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }
function goalFor(h: Habit): number {
  if (!h.type || h.type === 'check') return 1;
  return h.dailyGoal ?? 1;
}

type DayState = 'done' | 'frozen' | 'miss' | 'broke';

// Rok NAWYKU **lub** LICZNIKA „bez X" w pikselach. Nawyk: zrobiony = kolor nawyku,
// zamrożony = niebieski. Licznik: dzień czysto = zielony, wpadka (kupiłeś) = czerwony.
// MIESIĄC = czytelny kalendarz (Pn..Nd + numery dni). ROK = kompaktowa rolka GitHub.
export default function HabitYear() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const params = useLocalSearchParams<{ id?: string; counter?: string }>();
  const habitId = typeof params.id === 'string' ? params.id : '';
  const counterId = typeof params.counter === 'string' ? params.counter : '';
  const isCounter = !!counterId;
  const frozen = useStreakFreezeStore(st => st.frozen);
  const allCounters = useCounters(st => st.counters);
  const meals = useFoodStore(st => st.meals);

  const [habit, setHabit] = useState<Habit | null>(null);
  const [counter, setCounter] = useState<Counter | null>(null);
  const [counts, setCounts] = useState<Record<string, number>>({});   // date → count
  const [expenses, setExpenses] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [view, setView] = useState<'month' | 'year'>('month');   // domyślnie MIESIĄC, tap → rok
  const windowDays = view === 'month' ? 35 : 371;

  useEffect(() => {
    let alive = true;
    (async () => {
      if (isCounter) {
        const cn = allCounters.find(x => x.id === counterId) ?? null;
        let exp: any[] = [];
        try { exp = await expensesService.getAll(); } catch {}
        if (alive) { setCounter(cn); setExpenses(exp); setLoading(false); }
        return;
      }
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
  }, [habitId, counterId, isCounter, allCounters]);

  // dni „wpadki" auto-licznika „bez X": zjedzenie (Co zjadłem) domyślnie, albo kupno (paragony)
  const matchDays = useMemo(() => {
    const set = new Set<string>();
    if (!isCounter || !counter?.keyword) return set;
    const kw = counter.keyword;
    if ((counter.track ?? 'eat') === 'buy') {
      for (const e of expenses) {
        if (e?.type === 'income') continue;
        const day = (e?.date ?? '').slice(0, 10);
        if (!day) continue;
        const parts = [
          e.note, (e.tags ?? []).join(' '), e.storeName,
          ...((e.receiptItems ?? []).flatMap((it: any) => [it?.name, ...((it?.tags) ?? [])])),
        ].filter(Boolean).join(' ');
        if (matchesAvoid(parts, kw)) set.add(day);
      }
    } else {
      for (const m of meals) {
        const day = (m?.date ?? '').slice(0, 10);
        if (!day) continue;
        const names = (m.items ?? [])
          .flatMap((it: any) => [it?.name, ...((it?.parts ?? []).map((p: any) => p?.name))])
          .filter(Boolean).join(' ');
        if (matchesAvoid(names, kw)) set.add(day);
      }
    }
    return set;
  }, [isCounter, counter, expenses, meals]);

  // ── build the grid + stats ─────────────────────────────────────────────
  const { cells, weeks, monthCols, stats } = useMemo(() => {
    const today = new Date();
    const start = new Date(today); start.setDate(today.getDate() - (windowDays - 1));
    const firstDow = (start.getDay() + 6) % 7;   // Monday = 0
    const goal = habit ? goalFor(habit) : 1;
    const todayKey = ymd(today);
    const startKey = counter ? (counter.startDate || counter.createdAt.slice(0, 10)) : '';
    const stateFor = (ds: string): DayState => {
      if (isCounter) {
        if (!counter) return 'miss';
        if (ds < startKey) return 'miss';                                   // przed startem — nieśledzone
        if (counter.mode === 'auto') return matchDays.has(ds) ? 'broke' : 'done';
        return ds >= counter.date ? 'done' : 'miss';                        // manual „od ostatniego razu"
      }
      if ((counts[ds] ?? 0) >= goal) return 'done';
      if (frozen[`${habitId}|${ds}`]) return 'frozen';
      return 'miss';
    };
    const cells: { wd: number; wk: number; st: DayState; dom: number; isToday: boolean }[] = [];
    const monthCols: { m: number; col: number }[] = [];
    let idx = 0, lastMonth = -1;
    const seq: DayState[] = [];
    for (const cur = new Date(start); cur <= today; cur.setDate(cur.getDate() + 1)) {
      const ds = ymd(cur);
      const st = stateFor(ds);
      seq.push(st);
      const p = firstDow + idx;
      const wk = Math.floor(p / 7), wd = p % 7;
      const month = cur.getMonth();
      if (month !== lastMonth) { monthCols.push({ m: month, col: wk }); lastMonth = month; }
      cells.push({ wd, wk, st, dom: cur.getDate(), isToday: ds === todayKey });
      idx++;
    }
    const weeks = Math.floor((firstDow + idx - 1) / 7) + 1;
    // stats z sekwencji (oldest→today)
    let doneDays = 0, altDays = 0, longest = 0, run = 0, current = 0;
    for (let i = 0; i < seq.length; i++) {
      const alive = seq[i] === 'done' || seq[i] === 'frozen';
      if (seq[i] === 'done') doneDays++;
      if (seq[i] === 'frozen' || seq[i] === 'broke') altDays++;
      if (alive) { run++; if (run > longest) longest = run; } else run = 0;
    }
    if (isCounter) {
      // seria licznika = dni „czysto" z rzędu do DZIŚ (wpadka dziś = 0)
      for (let i = seq.length - 1; i >= 0; i--) { if (seq[i] === 'done') current++; else break; }
    } else {
      // nawyk: jak dashboard getStreak — jeśli DZIŚ jeszcze nie zrobione, licz od wczoraj
      const nSeq = seq.length;
      let ci = (nSeq > 0 && (seq[nSeq - 1] === 'done' || seq[nSeq - 1] === 'frozen')) ? nSeq - 1 : nSeq - 2;
      for (; ci >= 0; ci--) { if (seq[ci] === 'done' || seq[ci] === 'frozen') current++; else break; }
    }
    return { cells, weeks, monthCols, stats: { doneDays, altDays, longest, current } };
  }, [counts, frozen, habit, habitId, windowDays, isCounter, counter, matchDays]);

  const title = isCounter
    ? (counter ? (counter.mode === 'auto' ? `bez ${counter.name}` : counter.name) : 'Licznik')
    : (habit?.title ?? 'Nawyk');
  const doneColor = isCounter ? CLEAN : (habit?.color ?? c.text.primary);
  const isMonth = view === 'month';
  const WD = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd'];
  // MIESIĄC: kalendarz 7 kolumn (Pn..Nd) z numerami dni
  const MC = 40, MG = 6, MHEAD = 18;
  const mW = 7 * (MC + MG), mH = MHEAD + weeks * (MC + MG);
  // ROK: kompaktowa rolka GitHub (kolumny = tygodnie)
  const YC = 6, YG = 1.6, YTOP = 12;
  const yW = weeks * (YC + YG), yH = YTOP + 7 * (YC + YG);

  const fillFor = (st: DayState) =>
    st === 'done' ? doneColor : st === 'broke' ? BREAK : st === 'frozen' ? ICE : c.fill.subtle;
  const yFillFor = (st: DayState) =>
    st === 'done' ? doneColor + 'DD' : st === 'broke' ? BREAK : st === 'frozen' ? ICE : c.fill.subtle;

  const freqPct = isCounter
    ? (stats.doneDays + stats.altDays > 0 ? Math.round((stats.doneDays / (stats.doneDays + stats.altDays)) * 100) : 0)
    : Math.round((stats.doneDays / windowDays) * 100);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <View style={s.head}>
        <TouchableOpacity onPress={() => router.back()} hitSlop={10}><ChevronLeft size={24} color={c.text.primary} /></TouchableOpacity>
        <Text style={s.title} numberOfLines={1}>{title}</Text>
        {/* toggle MIESIĄC / ROK */}
        <View style={s.viewToggle}>
          {(['month', 'year'] as const).map(v => (
            <TouchableOpacity key={v} onPress={() => setView(v)} style={[s.viewBtn, view === v && s.viewBtnOn]}>
              <Text style={[s.viewBtnTxt, view === v && s.viewBtnTxtOn]}>{v === 'month' ? 'Miesiąc' : 'Rok'}</Text>
            </TouchableOpacity>
          ))}
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* aktualna seria hero */}
        <View style={[s.hero, { borderColor: doneColor + '3A', backgroundColor: doneColor + '12' }]}>
          <Flame size={26} color={doneColor} fill={stats.current > 0 ? doneColor : 'transparent'} />
          <View style={{ flex: 1 }}>
            <Text style={s.heroNum}>{stats.current} <Text style={s.heroUnit}>{stats.current === 1 ? 'dzień' : 'dni'}{isCounter ? ' czysto' : ''} z rzędu</Text></Text>
            <Text style={s.heroSub}>najdłuższa: {stats.longest} dni · {view === 'month' ? 'ostatnie 5 tyg.' : 'rok'}</Text>
          </View>
        </View>

        {/* legenda */}
        <View style={s.legendRow}>
          {isCounter ? (
            <>
              <View style={s.legendItem}><View style={[s.sw, { backgroundColor: CLEAN }]} /><Text style={s.legendTxt}>czysto</Text></View>
              <View style={s.legendItem}><View style={[s.sw, { backgroundColor: BREAK }]} /><Text style={s.legendTxt}>wpadka</Text></View>
              <View style={s.legendItem}><View style={[s.sw, { backgroundColor: c.fill.subtle }]} /><Text style={s.legendTxt}>przed startem</Text></View>
            </>
          ) : (
            <>
              <View style={s.legendItem}><View style={[s.sw, { backgroundColor: doneColor + 'DD' }]} /><Text style={s.legendTxt}>zrobione</Text></View>
              <View style={s.legendItem}><View style={[s.sw, { backgroundColor: ICE }]} /><Text style={s.legendTxt}>zamrożone</Text></View>
              <View style={s.legendItem}><View style={[s.sw, { backgroundColor: c.fill.subtle }]} /><Text style={s.legendTxt}>pominięte</Text></View>
            </>
          )}
        </View>

        {/* siatka */}
        {!loading && (
          <View style={s.gridCard}>
            {isMonth ? (
              <View style={{ width: '100%', aspectRatio: mW / mH }}>
                <Svg width="100%" height="100%" viewBox={`0 0 ${mW} ${mH}`} preserveAspectRatio="xMidYMid meet">
                  {WD.map((w, i) => (
                    <SvgText key={w} x={i * (MC + MG) + MC / 2} y={11} fontSize={9} fontWeight="700" fill={c.text.muted} textAnchor="middle">{w}</SvgText>
                  ))}
                  {cells.map((cell, i) => {
                    const x = cell.wd * (MC + MG), y = MHEAD + cell.wk * (MC + MG);
                    const done = cell.st === 'done', froz = cell.st === 'frozen', broke = cell.st === 'broke';
                    const numColor = done ? '#0E0E0E' : broke ? '#FFFFFF' : froz ? '#0A2A3A' : c.text.muted;
                    return (
                      <G key={i}>
                        <Rect x={x} y={y} width={MC} height={MC} rx={7} fill={fillFor(cell.st)}
                          stroke={cell.isToday ? c.text.primary : froz ? '#FFFFFF' : undefined}
                          strokeWidth={cell.isToday ? 2.2 : froz ? 1 : 0} />
                        <SvgText x={x + MC / 2} y={y + MC / 2 + 4.5} fontSize={13} fontWeight="700"
                          fill={numColor} textAnchor="middle" opacity={cell.st === 'miss' ? 0.5 : 1}>{cell.dom}</SvgText>
                      </G>
                    );
                  })}
                </Svg>
              </View>
            ) : (
              <View style={{ width: '100%', aspectRatio: yW / yH }}>
                <Svg width="100%" height="100%" viewBox={`0 0 ${yW} ${yH}`} preserveAspectRatio="xMidYMid meet">
                  {monthCols.map(({ m, col }) => (
                    <SvgText key={`${m}-${col}`} x={col * (YC + YG)} y={8} fontSize={6} fill={c.text.muted}>{MONTHS[m]}</SvgText>
                  ))}
                  {cells.map((cell, i) => (
                    <Rect key={i} x={cell.wk * (YC + YG)} y={YTOP + cell.wd * (YC + YG)} width={YC} height={YC} rx={1.3} fill={yFillFor(cell.st)} />
                  ))}
                </Svg>
              </View>
            )}
          </View>
        )}

        {/* statystyki */}
        <View style={s.statsRow}>
          <View style={s.stat}><Text style={s.statVal}>{stats.doneDays}</Text><Text style={s.statKey}>{isCounter ? 'dni czysto' : 'dni zrobione'}</Text></View>
          <View style={s.statDiv} />
          <View style={s.stat}>
            {isCounter ? (
              <><Text style={[s.statVal, { color: BREAK }]}>{stats.altDays}</Text><Text style={s.statKey}>wpadki</Text></>
            ) : (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: 4 }}><Snowflake size={14} color={ICE} /><Text style={[s.statVal, { color: ICE }]}>{stats.altDays}</Text></View>
                <Text style={s.statKey}>zamrożenia użyte</Text>
              </>
            )}
          </View>
          <View style={s.statDiv} />
          <View style={s.stat}><Text style={s.statVal}>{freqPct}%</Text><Text style={s.statKey}>frekwencja</Text></View>
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
  viewToggle: { flexDirection: 'row', backgroundColor: c.fill.subtle, borderRadius: radius.full, padding: 2, borderWidth: 1, borderColor: c.border.subtle },
  viewBtn: { paddingHorizontal: 11, paddingVertical: 5, borderRadius: radius.full },
  viewBtnOn: { backgroundColor: c.text.primary },
  viewBtnTxt: { fontSize: 11, fontWeight: '800', color: c.text.muted },
  viewBtnTxtOn: { color: c.bg.primary },
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
