import { useState, useEffect, useMemo } from 'react';
import {
  View, Text, StyleSheet, ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ArrowLeft, ChevronLeft, ChevronRight,
  CheckCircle2, Smile, Zap, TrendingDown, TrendingUp,
  Footprints, Flame, Moon, Timer,
} from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import PressableScale from '@/components/ui/PressableScale';
import { useTasks } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';
import { useExpensesStore } from '@/store/expensesStore';
import { useMoodStore } from '@/store/moodStore';
import { getSessionsForDates, PomodoroSession } from '@/utils/pomodoroHistory';
import { MOOD_COLORS, MOOD_LABELS, MoodEntry, Habit } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';

// ─── Date helpers ─────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }
function dateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

const MONTH_SHORT = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
const DAY_SHORT   = ['Pn','Wt','Śr','Cz','Pt','Sb','Nd'];

function getWeekDates(offset: number): string[] {
  const today = new Date();
  const dow   = today.getDay() === 0 ? 6 : today.getDay() - 1; // Mon=0
  const mon   = new Date(today);
  mon.setDate(today.getDate() - dow + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return dateStr(d);
  });
}

function weekLabel(dates: string[]) {
  const from = new Date(dates[0]);
  const to   = new Date(dates[6]);
  if (from.getMonth() === to.getMonth()) {
    return `${from.getDate()}–${to.getDate()} ${MONTH_SHORT[from.getMonth()]} ${from.getFullYear()}`;
  }
  return `${from.getDate()} ${MONTH_SHORT[from.getMonth()]} – ${to.getDate()} ${MONTH_SHORT[to.getMonth()]}`;
}

// ─── Section card wrapper ─────────────────────────────────────────────────────

function SCard({ icon, label, children, accent }: {
  icon: React.ReactNode; label: string; children: React.ReactNode; accent?: string;
}) {
  return (
    <View style={[sc.card, accent && { borderLeftWidth: 3, borderLeftColor: accent }]}>
      <View style={sc.header}>
        {icon}
        <Text style={sc.label}>{label}</Text>
      </View>
      {children}
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[4], gap: spacing[3],
  },
  header: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  label: {
    fontSize: 10, fontWeight: '700', color: colors.text.muted,
    textTransform: 'uppercase', letterSpacing: 1,
  },
});

// ─── Mini bar row (7 days) ────────────────────────────────────────────────────

function WeekBars({ values, max, color, dates }: {
  values: number[]; max: number; color: string; dates: string[];
}) {
  const todayStr = dateStr(new Date());
  return (
    <View style={wb.row}>
      {values.map((v, i) => {
        const h    = max > 0 ? Math.max(v > 0 ? 4 : 2, (v / max) * 48) : 2;
        const isToday = dates[i] === todayStr;
        return (
          <View key={i} style={wb.col}>
            <View style={wb.barWrap}>
              <View style={[
                wb.bar,
                { height: h, backgroundColor: v > 0 ? color : 'rgba(255,255,255,0.07)' },
                isToday && { width: 12 },
              ]} />
            </View>
            <Text style={[wb.day, isToday && wb.dayToday]}>{DAY_SHORT[i]}</Text>
          </View>
        );
      })}
    </View>
  );
}

const wb = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'flex-end', gap: 6 },
  col: { flex: 1, alignItems: 'center', gap: 4 },
  barWrap: { height: 52, justifyContent: 'flex-end', alignItems: 'center' },
  bar: { width: 8, borderRadius: 4, minHeight: 2 },
  day: { fontSize: 8, color: colors.text.muted },
  dayToday: { color: colors.text.secondary, fontWeight: '700' },
});

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function WeeklyScreen() {
  const [weekOffset, setWeekOffset]     = useState(0);
  const [stepData, setStepData]         = useState<number[]>(Array(7).fill(0));
  const [sleepData, setSleepData]       = useState<{ h: number; quality?: string }[]>(Array(7).fill({ h: 0 }));
  const [pomodoroData, setPomodoroData] = useState<Record<string, PomodoroSession[]>>({});

  const { tasks }                        = useTasks();
  const { habits, getLast7, completions } = useHabits();
  const { expenses }         = useExpensesStore();
  const { entries: mood }    = useMoodStore();

  const dates     = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const prevDates = useMemo(() => getWeekDates(weekOffset - 1), [weekOffset]);
  const isCurrentWeek = weekOffset === 0;
  const isFutureWeek  = weekOffset > 0;

  // Load step + sleep + pomodoro data for selected week
  useEffect(() => {
    (async () => {
      const [healthResults, pomSessions] = await Promise.all([
        Promise.all(dates.map(d => AsyncStorage.getItem(`health_${d}`))),
        getSessionsForDates(dates),
      ]);
      const parsed = healthResults.map(r => {
        if (!r) return null;
        try { return JSON.parse(r); } catch { return null; }
      });
      setStepData(parsed.map(p => p?.steps ?? 0));
      setSleepData(parsed.map(p => ({ h: (p?.sleepH ?? 0) + (p?.sleepM ?? 0) / 60, quality: p?.sleepQuality })));
      setPomodoroData(pomSessions);
    })();
  }, [dates]);

  // ── Tasks ──────────────────────────────────────────────────────────────────

  const weekTasks = useMemo(() => {
    const [from, to] = [dates[0], dates[6]];
    return tasks.filter(t => {
      const d = (t.deadline ?? t.updatedAt ?? '').split('T')[0];
      return d >= from && d <= to;
    });
  }, [tasks, dates]);

  const completedThisWeek = useMemo(() =>
    tasks.filter(t => t.status === 'done' && t.updatedAt.split('T')[0] >= dates[0] && t.updatedAt.split('T')[0] <= dates[6]),
    [tasks, dates]);

  const taskDailyDone = useMemo(() =>
    dates.map(d => tasks.filter(t => t.status === 'done' && t.updatedAt.split('T')[0] === d).length),
    [tasks, dates]);

  const maxTaskDay = Math.max(...taskDailyDone, 1);

  // ── Mood ───────────────────────────────────────────────────────────────────

  const weekMood = useMemo(() =>
    mood.filter(e => e.date >= dates[0] && e.date <= dates[6]),
    [mood, dates]);

  const avgMood   = weekMood.length ? weekMood.reduce((a, b) => a + b.mood, 0) / weekMood.length : 0;
  const avgEnergy = weekMood.length ? weekMood.reduce((a, b) => a + b.energy, 0) / weekMood.length : 0;

  const moodDailyValues = useMemo(() =>
    dates.map(d => weekMood.find(e => e.date === d)?.mood ?? 0),
    [weekMood, dates]);

  const moodDailyColors = useMemo(() =>
    dates.map(d => {
      const e = weekMood.find(x => x.date === d);
      return e ? MOOD_COLORS[e.mood] : 'rgba(255,255,255,0.07)';
    }),
    [weekMood, dates]);

  // ── Habits ─────────────────────────────────────────────────────────────────

  const habitWeekData = useMemo(() =>
    habits.map(h => ({
      days: dates.filter(d => (completions[d] ?? []).includes(h.id)).length,
    })),
    [habits, completions, dates],
  );

  // ── Finances ───────────────────────────────────────────────────────────────

  const isExpense = (e: any) => !e.type || e.type === 'expense';
  const isIncome  = (e: any) => e.type === 'income';

  const weekExp = useMemo(() =>
    expenses.filter(e => isExpense(e) && e.date >= dates[0] && e.date <= dates[6])
      .reduce((s, e) => s + e.amount, 0),
    [expenses, dates]);

  const weekInc = useMemo(() =>
    expenses.filter(e => isIncome(e) && e.date >= dates[0] && e.date <= dates[6])
      .reduce((s, e) => s + e.amount, 0),
    [expenses, dates]);

  const prevExp = useMemo(() =>
    expenses.filter(e => isExpense(e) && e.date >= prevDates[0] && e.date <= prevDates[6])
      .reduce((s, e) => s + e.amount, 0),
    [expenses, prevDates]);

  const expDiff   = weekExp - prevExp;
  const expDailyV = useMemo(() =>
    dates.map(d => expenses.filter(e => isExpense(e) && e.date === d).reduce((s, e) => s + e.amount, 0)),
    [expenses, dates]);
  const maxExpDay = Math.max(...expDailyV, 1);

  // ── Pomodoro ───────────────────────────────────────────────────────────────

  const pomoDailyMins  = useMemo(() =>
    dates.map(d => (pomodoroData[d] ?? []).reduce((s, p) => s + p.durationMins, 0)),
    [pomodoroData, dates]);
  const pomoTotalMins  = pomoDailyMins.reduce((a, b) => a + b, 0);
  const pomoDays       = pomoDailyMins.filter(m => m > 0).length;
  const pomoMaxDay     = Math.max(...pomoDailyMins, 1);
  const pomoTotalRounds = useMemo(() =>
    dates.reduce((sum, d) => sum + (pomodoroData[d]?.length ?? 0), 0),
    [pomodoroData, dates]);

  // ── Steps ──────────────────────────────────────────────────────────────────

  const totalSteps = stepData.reduce((a, b) => a + b, 0);
  const maxStepDay = Math.max(...stepData, 1);

  // ── Sleep ──────────────────────────────────────────────────────────────────

  const sleepDays     = sleepData.filter(s => s.h > 0);
  const avgSleep      = sleepDays.length ? sleepDays.reduce((a, s) => a + s.h, 0) / sleepDays.length : 0;
  const maxSleepH     = Math.max(...sleepData.map(s => s.h), 1);
  const goodNights    = sleepData.filter(s => s.quality === 'good' || s.quality === 'excellent').length;
  const SLEEP_Q_COLORS: Record<string, string> = {
    poor: colors.accent.red, fair: colors.accent.amber,
    good: colors.accent.green, excellent: colors.accent.purple,
  };

  return (
    <SafeAreaView style={styles.safe} edges={['top', 'bottom']}>
      {/* Header */}
      <View style={styles.header}>
        <PressableScale onPress={() => router.back()} style={styles.iconBtn}>
          <ArrowLeft size={20} color={colors.text.secondary} />
        </PressableScale>

        <View style={styles.weekNav}>
          <PressableScale onPress={() => setWeekOffset(w => w - 1)} style={styles.navBtn}>
            <ChevronLeft size={16} color={colors.text.secondary} />
          </PressableScale>
          <View style={styles.weekLabelWrap}>
            <Text style={styles.weekTitle}>
              {isCurrentWeek ? 'Ten tydzień' : isFutureWeek ? 'Przyszły tydzień' : 'Poprzedni tydzień'}
            </Text>
            <Text style={styles.weekDates}>{weekLabel(dates)}</Text>
          </View>
          <PressableScale
            onPress={() => setWeekOffset(w => w + 1)}
            style={[styles.navBtn, weekOffset >= 0 && styles.navBtnDisabled]}
            disabled={weekOffset >= 0}
          >
            <ChevronRight size={16} color={weekOffset >= 0 ? colors.text.muted : colors.text.secondary} />
          </PressableScale>
        </View>

        <View style={{ width: 36 }} />
      </View>

      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={styles.scroll}
      >
        {/* ── Tasks ── */}
        <SCard
          icon={<CheckCircle2 size={13} color={colors.accent.purple} />}
          label="Zadania"
          accent={colors.accent.purple}
        >
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statBig, { color: colors.accent.green }]}>
                {completedThisWeek.length}
              </Text>
              <Text style={styles.statSub}>ukończono</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statBig, { color: colors.accent.purple }]}>
                {weekTasks.filter(t => t.status !== 'done').length}
              </Text>
              <Text style={styles.statSub}>aktywnych</Text>
            </View>
          </View>
          <WeekBars values={taskDailyDone} max={maxTaskDay} color={colors.accent.purple} dates={dates} />
        </SCard>

        {/* ── Mood ── */}
        <SCard
          icon={<Smile size={13} color={colors.accent.pink} />}
          label="Nastrój"
          accent={colors.accent.pink}
        >
          {weekMood.length > 0 ? (
            <>
              <View style={styles.statRow}>
                <View style={styles.statBox}>
                  <Text style={[styles.statBig, { color: avgMood >= 4 ? colors.accent.green : avgMood >= 3 ? colors.accent.amber : colors.accent.red }]}>
                    {avgMood.toFixed(1)}
                  </Text>
                  <Text style={styles.statSub}>śr. nastrój</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <View style={styles.energyRow}>
                    <Zap size={14} color={colors.accent.amber} />
                    <Text style={[styles.statBig, { color: colors.accent.amber }]}>
                      {avgEnergy.toFixed(1)}
                    </Text>
                  </View>
                  <Text style={styles.statSub}>śr. energia</Text>
                </View>
                <View style={styles.statDivider} />
                <View style={styles.statBox}>
                  <Text style={[styles.statBig, { color: colors.text.secondary }]}>
                    {weekMood.length}/7
                  </Text>
                  <Text style={styles.statSub}>check-inów</Text>
                </View>
              </View>
              {/* Mood bars with per-day color */}
              <View style={wb.row}>
                {moodDailyValues.map((v, i) => {
                  const h = v > 0 ? Math.max(6, (v / 5) * 48) : 2;
                  const isToday = dates[i] === dateStr(new Date());
                  return (
                    <View key={i} style={wb.col}>
                      <View style={wb.barWrap}>
                        <View style={[
                          wb.bar,
                          { height: h, backgroundColor: moodDailyColors[i] },
                          isToday && { width: 12 },
                        ]} />
                      </View>
                      <Text style={[wb.day, isToday && wb.dayToday]}>{DAY_SHORT[i]}</Text>
                    </View>
                  );
                })}
              </View>
            </>
          ) : (
            <Text style={styles.empty}>Brak wpisów w tym tygodniu</Text>
          )}
        </SCard>

        {/* ── Habits ── */}
        {habits.length > 0 && (
          <SCard
            icon={<Flame size={13} color={colors.accent.amber} />}
            label="Nawyki"
            accent={colors.accent.amber}
          >
            <View style={styles.habitsGrid}>
              {habits.map((h, i) => {
                const { days } = habitWeekData[i] ?? { days: 0 };
                const pct = days / 7;
                const col = pct >= 0.85 ? colors.accent.green : pct >= 0.5 ? colors.accent.amber : colors.text.muted;
                return (
                  <View key={h.id} style={styles.habitRow}>
                    <View style={[styles.habitDot, { backgroundColor: h.color + '30', borderColor: h.color + '50' }]}>
                      <Text style={{ fontSize: 10, color: h.color, fontWeight: '700' }}>{days}</Text>
                    </View>
                    <Text style={styles.habitName} numberOfLines={1}>{h.title}</Text>
                    <View style={styles.habitBarTrack}>
                      <View style={[styles.habitBarFill, { width: `${pct * 100}%`, backgroundColor: col }]} />
                    </View>
                    <Text style={[styles.habitPct, { color: col }]}>{days}/7</Text>
                  </View>
                );
              })}
            </View>
          </SCard>
        )}

        {/* ── Finances ── */}
        <SCard
          icon={<TrendingDown size={13} color={colors.accent.red} />}
          label="Finanse"
          accent={weekInc > weekExp ? colors.accent.green : colors.accent.red}
        >
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statBig, { color: colors.accent.red }]}>
                {weekExp.toFixed(0)}
              </Text>
              <Text style={styles.statSub}>wydatki zł</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statBig, { color: colors.accent.green }]}>
                {weekInc.toFixed(0)}
              </Text>
              <Text style={styles.statSub}>przychody zł</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <View style={styles.energyRow}>
                {expDiff > 0
                  ? <TrendingUp size={12} color={colors.accent.red} />
                  : <TrendingDown size={12} color={colors.accent.green} />
                }
                <Text style={[styles.statBig, { color: expDiff > 0 ? colors.accent.red : colors.accent.green, fontSize: 16 }]}>
                  {Math.abs(expDiff).toFixed(0)}
                </Text>
              </View>
              <Text style={styles.statSub}>vs poprzedni</Text>
            </View>
          </View>
          <WeekBars values={expDailyV} max={maxExpDay} color={colors.accent.red} dates={dates} />
        </SCard>

        {/* ── Pomodoro ── */}
        {pomoTotalRounds > 0 && (
          <SCard
            icon={<Timer size={13} color={colors.accent.purple} />}
            label="Skupienie (Pomodoro)"
            accent={colors.accent.purple}
          >
            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statBig, { color: colors.accent.purple }]}>
                  {pomoTotalRounds}
                </Text>
                <Text style={styles.statSub}>sesji</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statBig, { color: colors.accent.purple }]}>
                  {pomoTotalMins >= 60
                    ? `${Math.floor(pomoTotalMins / 60)}h${pomoTotalMins % 60 > 0 ? `${pomoTotalMins % 60}m` : ''}`
                    : `${pomoTotalMins}m`}
                </Text>
                <Text style={styles.statSub}>łącznie</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statBig, { color: colors.text.secondary }]}>
                  {pomoDays}
                </Text>
                <Text style={styles.statSub}>aktywnych dni</Text>
              </View>
            </View>
            <WeekBars values={pomoDailyMins} max={pomoMaxDay} color={colors.accent.purple} dates={dates} />
          </SCard>
        )}

        {/* ── Steps ── */}
        <SCard
          icon={<Footprints size={13} color={colors.accent.blue} />}
          label="Kroki"
          accent={colors.accent.blue}
        >
          <View style={styles.statRow}>
            <View style={styles.statBox}>
              <Text style={[styles.statBig, { color: colors.accent.blue }]}>
                {(totalSteps / 1000).toFixed(1)}k
              </Text>
              <Text style={styles.statSub}>łącznie</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statBig, { color: colors.text.secondary }]}>
                {stepData.filter(s => s > 0).length > 0
                  ? Math.round(totalSteps / stepData.filter(s => s > 0).length / 100) / 10 + 'k'
                  : '—'}
              </Text>
              <Text style={styles.statSub}>dziennie śr.</Text>
            </View>
            <View style={styles.statDivider} />
            <View style={styles.statBox}>
              <Text style={[styles.statBig, { color: colors.accent.green }]}>
                {stepData.filter(s => s >= 10_000).length}
              </Text>
              <Text style={styles.statSub}>dni celu</Text>
            </View>
          </View>
          <WeekBars values={stepData} max={maxStepDay} color={colors.accent.blue} dates={dates} />
        </SCard>

        {/* ── Sleep ── */}
        {sleepDays.length > 0 && (
          <SCard
            icon={<Moon size={13} color={colors.accent.purple} />}
            label="Sen"
            accent={colors.accent.purple}
          >
            <View style={styles.statRow}>
              <View style={styles.statBox}>
                <Text style={[styles.statBig, { color: avgSleep >= 7 ? colors.accent.green : avgSleep >= 6 ? colors.accent.amber : colors.accent.red }]}>
                  {avgSleep.toFixed(1)}h
                </Text>
                <Text style={styles.statSub}>śr. długość</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statBig, { color: colors.accent.green }]}>
                  {goodNights}
                </Text>
                <Text style={styles.statSub}>dobry sen</Text>
              </View>
              <View style={styles.statDivider} />
              <View style={styles.statBox}>
                <Text style={[styles.statBig, { color: colors.text.secondary }]}>
                  {sleepDays.length}/7
                </Text>
                <Text style={styles.statSub}>wpisów</Text>
              </View>
            </View>

            {/* Quality-colored sleep bars */}
            <View style={wb.row}>
              {sleepData.map((s, i) => {
                const h = s.h > 0 ? Math.max(4, (s.h / maxSleepH) * 48) : 2;
                const isToday = dates[i] === dateStr(new Date());
                const barCol = s.quality ? SLEEP_Q_COLORS[s.quality] : (s.h > 0 ? colors.text.secondary : 'rgba(255,255,255,0.07)');
                return (
                  <View key={i} style={wb.col}>
                    <View style={wb.barWrap}>
                      <View style={[wb.bar, { height: h, backgroundColor: barCol }, isToday && { width: 12 }]} />
                    </View>
                    <Text style={[wb.day, isToday && wb.dayToday]}>{DAY_SHORT[i]}</Text>
                  </View>
                );
              })}
            </View>
          </SCard>
        )}

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  safe: { flex: 1, backgroundColor: colors.bg.primary },

  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
    borderBottomWidth: 1, borderBottomColor: colors.border.subtle,
  },
  iconBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  weekNav: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginHorizontal: spacing[2] },
  navBtn: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  weekLabelWrap: { flex: 1, alignItems: 'center', gap: 2 },
  weekTitle: { fontSize: 14, fontWeight: '700', color: colors.text.primary },
  weekDates: { fontSize: 10, color: colors.text.muted },

  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 60 },

  statRow: { flexDirection: 'row', alignItems: 'center' },
  statBox: { flex: 1, alignItems: 'center', gap: 3 },
  statBig: { fontSize: 22, fontWeight: '900', letterSpacing: -0.5, lineHeight: 26 },
  statSub: { fontSize: 9, color: colors.text.muted, fontWeight: '500', textAlign: 'center' },
  statDivider: { width: 1, height: 32, backgroundColor: colors.border.default },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },

  habitsGrid: { gap: spacing[2] },
  habitRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  habitDot: {
    width: 28, height: 28, borderRadius: 14,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  habitName: { flex: 1, fontSize: 12, color: colors.text.primary, fontWeight: '500' },
  habitBarTrack: {
    width: 60, height: 3, borderRadius: radius.full,
    backgroundColor: 'rgba(255,255,255,0.07)', overflow: 'hidden',
  },
  habitBarFill: { height: 3, borderRadius: radius.full },
  habitPct: { fontSize: 10, fontWeight: '700', width: 24, textAlign: 'right' },

  empty: { fontSize: 13, color: colors.text.muted, paddingVertical: spacing[1] },
});
