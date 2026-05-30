import { useState, useMemo, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect } from 'expo-router';
import {
  CheckCircle2, Flame, Smile, Timer, TrendingUp, TrendingDown, Target,
  Droplets, Dumbbell, BookOpen, Moon, Zap, Heart, Sun, Bike,
  ChevronLeft, ChevronRight,
} from 'lucide-react-native';

import { useCalendarStore } from '@/store/calendarStore';
import { useHabits } from '@/hooks/useHabits';
import { useMoodStore } from '@/store/moodStore';
import { getSessionsForDates, PomodoroSession } from '@/utils/pomodoroHistory';
import { MoodLevel, MOOD_COLORS } from '@/types';
import { colors, spacing, radius } from '@/theme';
import { haptic } from '@/utils/haptics';

// ─── Habit icon map ───────────────────────────────────────────────────────────

const HABIT_ICON_MAP: Record<string, React.ComponentType<any>> = {
  droplets:    Droplets,
  dumbbell:    Dumbbell,
  'book-open': BookOpen,
  moon:        Moon,
  zap:         Zap,
  heart:       Heart,
  sun:         Sun,
  bike:        Bike,
};

// ─── Orange palette ───────────────────────────────────────────────────────────

const O = {
  card:       '#160D04',
  cardBorder: 'rgba(255,159,107,0.18)',
  accent:     '#FF9F6B',
  accentDim:  'rgba(255,159,107,0.12)',
  muted:      'rgba(255,159,107,0.50)',
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const WEEK_DAYS_SHORT = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

function pad(n: number) { return String(n).padStart(2, '0'); }
function dateStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function last7Dates(weekOffset = 0): string[] {
  const today = new Date();
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(today);
    d.setDate(today.getDate() - (6 - i) + weekOffset * 7);
    return dateStr(d);
  });
}
function todayDow(): number {
  const d = new Date().getDay();
  return d === 0 ? 6 : d - 1;
}
function dowLabel(iso: string): string {
  const d = new Date(iso + 'T00:00:00');
  return WEEK_DAYS_SHORT[(d.getDay() + 6) % 7];
}

// ─── Stat card ────────────────────────────────────────────────────────────────

function StatCard({ label, value, sub, icon, accent }: {
  label: string; value: string; sub?: string;
  icon: React.ReactNode; accent: string;
}) {
  return (
    <View style={[sc.card, { borderColor: accent + '30' }]}>
      <View style={[sc.iconWrap, { backgroundColor: accent + '18' }]}>
        {icon}
      </View>
      <Text style={sc.value}>{value}</Text>
      <Text style={[sc.label, { color: accent + 'AA' }]}>{label}</Text>
      {sub ? <Text style={sc.sub}>{sub}</Text> : null}
    </View>
  );
}

const sc = StyleSheet.create({
  card: {
    flex: 1, backgroundColor: O.card, borderRadius: radius.xl,
    borderWidth: 1, padding: spacing[3], gap: 4,
  },
  iconWrap: {
    width: 28, height: 28, borderRadius: radius.md,
    alignItems: 'center', justifyContent: 'center', marginBottom: 2,
  },
  value: { fontSize: 28, fontWeight: '900', color: colors.text.primary, letterSpacing: -1.2 },
  label: { fontSize: 9, fontWeight: '700', textTransform: 'uppercase', letterSpacing: 0.9 },
  sub:   { fontSize: 10, color: colors.text.muted, marginTop: 1 },
});

// ─── Mini bar chart ───────────────────────────────────────────────────────────

function MiniBarChart({ values, barColors, labels, maxH = 56 }: {
  values: number[]; barColors: string[]; labels: string[]; maxH?: number;
}) {
  const max = Math.max(...values, 1);
  return (
    <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: 5 }}>
      {values.map((v, i) => (
        <View key={i} style={{ flex: 1, alignItems: 'center', gap: 4 }}>
          <View style={{ height: maxH, justifyContent: 'flex-end', alignItems: 'center' }}>
            <View style={{
              width: '75%', borderRadius: 3,
              height: v > 0 ? Math.max(4, (v / max) * maxH) : 3,
              backgroundColor: v > 0 ? barColors[i] : 'rgba(255,255,255,0.07)',
            }} />
          </View>
          <Text style={{ fontSize: 8, color: colors.text.muted, fontWeight: '600' }}>{labels[i]}</Text>
          {v > 0 && <Text style={{ fontSize: 7, fontWeight: '700', color: barColors[i] }}>{v}</Text>}
        </View>
      ))}
    </View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function AnalyticsScreen() {
  const { tasks }    = useCalendarStore();
  const { habits, completions, getLast30, getStreak, todayDone } = useHabits();
  const { entries: moodEntries }                   = useMoodStore();
  const [pomSessions, setPomSessions] = useState<Record<string, PomodoroSession[]>>({});
  const [weekOffset, setWeekOffset] = useState(0);

  const dates    = useMemo(() => last7Dates(weekOffset), [weekOffset]);
  const isCurrentWeek = weekOffset === 0;
  const todayIdx = isCurrentWeek ? todayDow() : 6;

  useFocusEffect(useCallback(() => {
    getSessionsForDates(dates).then(setPomSessions).catch(() => {});
  }, [dates.join(',')]));

  const habitDone = useCallback((habitId: string, date: string, goal: number): boolean => {
    return (completions[date]?.[habitId] ?? 0) >= goal;
  }, [completions]);

  const habitGoal = useCallback((h: { type?: string; dailyGoal?: number }): number => {
    return h.type === 'count' ? (h.dailyGoal ?? 1) : 1;
  }, []);

  // ── Task completions per day ────────────────────────────────────────────────
  const weekDoneByDay = useMemo(() =>
    dates.map(d =>
      tasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(d)).length
    ),
  [tasks, dates]);

  const totalDoneThisWeek = weekDoneByDay.reduce((a, b) => a + b, 0);
  const totalPending      = tasks.filter(t => t.status === 'pending').length;

  // ── Habit avg completion rate per day ───────────────────────────────────────
  const habitRateByDay = useMemo(() => {
    if (habits.length === 0) return dates.map(() => 0);
    return dates.map(d => {
      const done = habits.filter(h => habitDone(h.id, d, habitGoal(h))).length;
      return Math.round((done / habits.length) * 100);
    });
  }, [habits, dates, habitDone, habitGoal]);

  const avgHabitRate = habitRateByDay.length > 0
    ? Math.round(
        habitRateByDay.slice(0, todayIdx + 1).reduce((a, b) => a + b, 0) / (todayIdx + 1)
      )
    : 0;

  // ── Habits with stats (all, sorted by streak) ─────────────────────────────
  const habitStats = useMemo(() =>
    habits
      .map(h => ({
        habit: h,
        streak: getStreak(h.id),
        last7: dates.map(d => habitDone(h.id, d, habitGoal(h))),
        last30: getLast30(h.id),
      }))
      .sort((a, b) => b.streak - a.streak),
  [habits, dates, getStreak, getLast30, habitDone, habitGoal]);

  const topHabits = habitStats.slice(0, 4);

  // ── Mood this week ──────────────────────────────────────────────────────────
  const weekMood = useMemo(() =>
    dates.map(d => moodEntries.find(m => m.date === d)?.mood ?? 0),
  [moodEntries, dates]);

  const moodThisWeek = weekMood.filter(m => m > 0);
  const avgMood = moodThisWeek.length
    ? moodThisWeek.reduce((a: number, b) => a + b, 0) / moodThisWeek.length
    : 0;

  const prevWeekMoods = useMemo(() => {
    const prevDates = new Set(last7Dates(weekOffset - 1));
    return moodEntries.filter(e => prevDates.has(e.date));
  }, [moodEntries, weekOffset]);
  const prevAvgMood = prevWeekMoods.length
    ? prevWeekMoods.reduce((a, e) => a + e.mood, 0) / prevWeekMoods.length
    : 0;

  const moodTrend: 'up' | 'down' | 'flat' =
    avgMood > 0 && prevAvgMood > 0
      ? avgMood > prevAvgMood + 0.3 ? 'up'
      : avgMood < prevAvgMood - 0.3 ? 'down'
      : 'flat'
    : 'flat';

  const moodColor = avgMood > 0
    ? MOOD_COLORS[Math.round(avgMood) as MoodLevel]
    : colors.text.muted;

  // ── Pomodoro per day ────────────────────────────────────────────────────────
  const pomByDay         = dates.map(d => pomSessions[d]?.length ?? 0);
  const totalPomThisWeek = pomByDay.reduce((a, b) => a + b, 0);
  const totalPomMins     = dates
    .flatMap(d => pomSessions[d] ?? [])
    .reduce((a, s) => a + s.durationMins, 0);

  const noData = totalDoneThisWeek === 0 && habits.length === 0
    && moodThisWeek.length === 0 && totalPomThisWeek === 0;

  const weekStart = dates[0].slice(5).replace('-', '/');
  const weekEnd   = dates[6].slice(5).replace('-', '/');

  return (
    <SafeAreaView style={styles.root} edges={[]}>
      <View style={{ flex: 1 }}>
        <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

          {/* Header */}
          <View style={styles.header}>
            <Text style={styles.title}>Analityka</Text>
            <View style={styles.weekNav}>
              <TouchableOpacity onPress={() => { haptic.tap(); setWeekOffset(o => o - 1); }} style={styles.navArrow}>
                <ChevronLeft size={15} color={colors.text.muted} />
              </TouchableOpacity>
              <Text style={styles.weekLabel}>{weekStart} – {weekEnd}</Text>
              <TouchableOpacity
                onPress={() => { haptic.tap(); setWeekOffset(o => Math.min(o + 1, 0)); }}
                disabled={isCurrentWeek}
                style={styles.navArrow}
              >
                <ChevronRight size={15} color={isCurrentWeek ? colors.text.muted + '30' : colors.text.muted} />
              </TouchableOpacity>
            </View>
          </View>

          {/* 2×2 stat grid */}
          <View style={styles.statRow}>
            <StatCard
              label="Ukończone zadania"
              value={String(totalDoneThisWeek)}
              sub={totalPending > 0 ? `${totalPending} oczekuje` : 'Wszystko gotowe!'}
              icon={<CheckCircle2 size={15} color={O.accent} />}
              accent={O.accent}
            />
            <StatCard
              label="Skuteczność nawyków"
              value={habits.length > 0 ? `${avgHabitRate}%` : '—'}
              sub={`${todayDone.length}/${habits.length} dziś`}
              icon={<Flame size={15} color={colors.accent.amber} />}
              accent={colors.accent.amber}
            />
          </View>
          <View style={styles.statRow}>
            <StatCard
              label="Nastrój (śr.)"
              value={avgMood > 0 ? avgMood.toFixed(1) : '—'}
              sub={moodThisWeek.length > 0 ? `${moodThisWeek.length} check-inów` : 'brak danych'}
              icon={<Smile size={15} color={moodColor} />}
              accent={moodColor}
            />
            <StatCard
              label="Sesje Pomodoro"
              value={String(totalPomThisWeek)}
              sub={totalPomMins > 0
                ? `${Math.floor(totalPomMins / 60)}h ${totalPomMins % 60}m skupienia`
                : 'w tym tygodniu'}
              icon={<Timer size={15} color={colors.accent.blue} />}
              accent={colors.accent.blue}
            />
          </View>

          {/* Task completions chart */}
          {totalDoneThisWeek > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>ZADANIA UKOŃCZONE — 7 DNI</Text>
              <MiniBarChart
                values={weekDoneByDay}
                barColors={dates.map((_, i) => i === todayIdx ? O.accent : O.accent + '90')}
                labels={dates.map(dowLabel)}
                maxH={60}
              />
            </View>
          )}

          {/* Mood chart */}
          {moodThisWeek.length > 0 && (
            <View style={styles.card}>
              <View style={styles.cardHeader}>
                <Text style={styles.cardTitle}>NASTRÓJ — 7 DNI</Text>
                {moodTrend !== 'flat' && (
                  <View style={[styles.trendBadge, {
                    backgroundColor: moodTrend === 'up'
                      ? colors.accent.success + '20'
                      : colors.accent.red + '20',
                  }]}>
                    {moodTrend === 'up'
                      ? <TrendingUp size={10} color={colors.accent.success} />
                      : <TrendingDown size={10} color={colors.accent.red} />
                    }
                    <Text style={[styles.trendText, {
                      color: moodTrend === 'up' ? colors.accent.success : colors.accent.red,
                    }]}>
                      {moodTrend === 'up' ? 'Lepiej niż tydzień temu' : 'Gorzej niż tydzień temu'}
                    </Text>
                  </View>
                )}
              </View>
              <MiniBarChart
                values={weekMood}
                barColors={weekMood.map(m =>
                  m > 0 ? MOOD_COLORS[m as MoodLevel] : 'transparent'
                )}
                labels={dates.map(dowLabel)}
                maxH={56}
              />
            </View>
          )}

          {/* Habit streaks */}
          {topHabits.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>NAWYKI — SERIA DNI</Text>
              <View style={styles.habitsList}>
                {topHabits.map(({ habit, streak, last7 }) => {
                  const HIcon = HABIT_ICON_MAP[habit.icon] ?? Zap;
                  return (
                    <View key={habit.id} style={styles.habitRow}>
                      <View style={[styles.habitIconWrap, {
                        backgroundColor: habit.color + '22',
                        borderColor:     habit.color + '44',
                      }]}>
                        <HIcon size={11} color={habit.color} />
                      </View>
                      <Text style={styles.habitName} numberOfLines={1}>{habit.title}</Text>
                      <View style={styles.habitDots}>
                        {last7.map((done: boolean, i: number) => (
                          <View key={i} style={[
                            styles.habitMiniDot,
                            done && { backgroundColor: habit.color },
                          ]} />
                        ))}
                      </View>
                      {streak > 0 ? (
                        <View style={styles.streakBadge}>
                          <Flame size={9} color={colors.accent.amber} />
                          <Text style={styles.streakText}>{streak}d</Text>
                        </View>
                      ) : (
                        <View style={[styles.streakBadge, { backgroundColor: 'transparent' }]}>
                          <Text style={[styles.streakText, { color: colors.text.muted }]}>—</Text>
                        </View>
                      )}
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* 30-day habit heatmap */}
          {habitStats.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>NAWYKI — OSTATNIE 30 DNI</Text>
              <View style={styles.heatmapList}>
                {habitStats.map(({ habit, last30 }) => {
                  const HIcon = HABIT_ICON_MAP[habit.icon] ?? Zap;
                  const doneCount = last30.filter(Boolean).length;
                  return (
                    <View key={habit.id} style={styles.heatmapRow}>
                      <View style={[styles.heatmapIcon, { backgroundColor: habit.color + '22', borderColor: habit.color + '44' }]}>
                        <HIcon size={10} color={habit.color} />
                      </View>
                      <View style={styles.heatmapGrid}>
                        {last30.map((done, i) => (
                          <View
                            key={i}
                            style={[
                              styles.heatmapCell,
                              { backgroundColor: done ? habit.color + 'DD' : 'rgba(255,255,255,0.05)' },
                            ]}
                          />
                        ))}
                      </View>
                      <Text style={[styles.heatmapCount, { color: habit.color + 'AA' }]}>{doneCount}</Text>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          {/* Pomodoro chart */}
          {totalPomThisWeek > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>POMODORO — 7 DNI</Text>
              <MiniBarChart
                values={pomByDay}
                barColors={dates.map((_, i) =>
                  i === todayIdx ? colors.accent.blue : colors.accent.blue + '90'
                )}
                labels={dates.map(dowLabel)}
                maxH={48}
              />
            </View>
          )}

          {/* Habit rate chart */}
          {habits.length > 0 && (
            <View style={styles.card}>
              <Text style={styles.cardTitle}>NAWYKI — SKUTECZNOŚĆ DZIENNA</Text>
              <MiniBarChart
                values={habitRateByDay.map((v, i) => i > todayIdx ? 0 : v)}
                barColors={habitRateByDay.map(v =>
                  v >= 80 ? colors.accent.success
                  : v >= 50 ? colors.accent.amber
                  : colors.accent.red
                )}
                labels={dates.map(dowLabel)}
                maxH={52}
              />
            </View>
          )}

          {/* Empty state */}
          {noData && (
            <View style={styles.empty}>
              <View style={styles.emptyIcon}>
                <Target size={32} color={O.accent} strokeWidth={1.5} />
              </View>
              <Text style={styles.emptyTitle}>Zacznij zbierać dane</Text>
              <Text style={styles.emptySub}>
                Uzupełniaj zadania, nawyki i nastrój — tutaj zobaczysz swoje tygodniowe wzorce
              </Text>
            </View>
          )}

        </ScrollView>
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  root:   { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 180 },

  header: {
    paddingTop: spacing[2], paddingBottom: spacing[1],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
  },
  title:     { fontSize: 28, fontWeight: '900', color: colors.text.primary, letterSpacing: -0.5 },
  weekNav:   { flexDirection: 'row', alignItems: 'center', gap: 2 },
  weekLabel: { fontSize: 11, color: O.muted, fontWeight: '700' },
  navArrow:  { width: 26, height: 26, alignItems: 'center', justifyContent: 'center' },

  statRow: { flexDirection: 'row', gap: spacing[3] },

  card: {
    backgroundColor: O.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: O.cardBorder,
    padding: spacing[4], gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  cardTitle: {
    fontSize: 10, fontWeight: '700', color: O.muted,
    textTransform: 'uppercase', letterSpacing: 0.9,
  },

  trendBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full,
  },
  trendText: { fontSize: 9, fontWeight: '700' },

  habitsList: { gap: spacing[2] },
  habitRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  habitIconWrap: {
    width: 22, height: 22, borderRadius: 11, flexShrink: 0,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  habitInnerDot: { width: 8, height: 8, borderRadius: 4 },

  heatmapList: { gap: 8 },
  heatmapRow:  { flexDirection: 'row', alignItems: 'center', gap: 8 },
  heatmapIcon: {
    width: 20, height: 20, borderRadius: 10, flexShrink: 0,
    borderWidth: 1, alignItems: 'center', justifyContent: 'center',
  },
  heatmapGrid: { flex: 1, flexDirection: 'row', flexWrap: 'nowrap', gap: 2 },
  heatmapCell: { width: 7, height: 7, borderRadius: 1.5 },
  heatmapCount: { fontSize: 10, fontWeight: '700', minWidth: 20, textAlign: 'right' },
  habitName:     { flex: 1, fontSize: 13, color: colors.text.primary, fontWeight: '500' },
  habitDots:     { flexDirection: 'row', gap: 3 },
  habitMiniDot: {
    width: 7, height: 7, borderRadius: 4,
    backgroundColor: 'rgba(255,255,255,0.08)',
  },
  streakBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 2,
    backgroundColor: colors.accent.amber + '18',
    borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 2,
    minWidth: 32, justifyContent: 'center',
  },
  streakText: { fontSize: 10, fontWeight: '700', color: colors.accent.amber },

  empty: { alignItems: 'center', paddingTop: 80, gap: spacing[4] },
  emptyIcon: {
    width: 72, height: 72, borderRadius: 36,
    backgroundColor: O.accentDim, borderWidth: 1, borderColor: O.cardBorder,
    alignItems: 'center', justifyContent: 'center',
  },
  emptyTitle: { fontSize: 20, fontWeight: '800', color: colors.text.primary },
  emptySub: {
    fontSize: 14, color: colors.text.muted, textAlign: 'center',
    lineHeight: 22, paddingHorizontal: spacing[4],
  },
});
