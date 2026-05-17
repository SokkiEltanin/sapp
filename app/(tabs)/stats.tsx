import { useState, useMemo, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  ChevronLeft, ChevronRight, Smile, Zap,
  TrendingUp, TrendingDown, ShoppingCart,
  Calendar, Wallet, FileText, RefreshCw,
} from 'lucide-react-native';
import { isWithinInterval, parseISO } from 'date-fns';

import { useExpensesStore } from '@/store/expensesStore';
import { useMoodStore } from '@/store/moodStore';
import { useCalendarStore } from '@/store/calendarStore';
import { expensesService } from '@/services/expensesService';
import { moodService } from '@/services/moodService';
import { MOOD_COLORS, MOOD_LABELS, ENERGY_LABELS, MoodEntry, MoodLevel } from '@/types';
import { Expense } from '@/types';
import { colors, spacing, radius, typography } from '@/theme';
import {
  WeeklyReport, loadReports, saveReport, generateReport,
  getCurrentWeekStart, getPrevWeekStart, getWeekBounds,
  shouldAutoGenerate, markGenerated,
} from '@/utils/weeklyReports';
import {
  MonthlyReport, YearlyReport,
  loadMonthlyReports, saveMonthlyReport, generateMonthlyReport,
  loadYearlyReports, saveYearlyReport, generateYearlyReport,
  shouldAutoGenerateMonthly, markMonthlyGenerated,
  getCurrentMonth, getPrevMonth, getMonthBounds,
} from '@/utils/monthlyReports';

// ─── Constants ─────────────────────────────────────────────────────────────────

const FOOD_TAGS    = ['słodycze', 'nabiał', 'mięso', 'warzywa', 'owoce', 'pieczywo', 'napoje'];
const SWEETS_TAGS  = ['słodycze'];
const DAY_SHORT    = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const MONTH_SHORT  = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
const WEEKS_BACK   = 8;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }
function toStr(d: Date) {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function getWeekDates(offset: number): string[] {
  const today = new Date();
  const dow   = today.getDay() === 0 ? 6 : today.getDay() - 1;
  const mon   = new Date(today);
  mon.setDate(today.getDate() - dow + offset * 7);
  return Array.from({ length: 7 }, (_, i) => {
    const d = new Date(mon);
    d.setDate(mon.getDate() + i);
    return toStr(d);
  });
}

function weekLabel(dates: string[]) {
  const from = new Date(dates[0]);
  const to   = new Date(dates[6]);
  const fromM = MONTH_SHORT[from.getMonth()];
  const toM   = MONTH_SHORT[to.getMonth()];
  if (from.getMonth() === to.getMonth()) {
    return `${from.getDate()}–${to.getDate()} ${fromM}`;
  }
  return `${from.getDate()} ${fromM} – ${to.getDate()} ${toM}`;
}

function dayAvg(entries: MoodEntry[]) {
  if (!entries.length) return null;
  return {
    mood:   entries.reduce((a, b) => a + b.mood,   0) / entries.length as MoodLevel,
    energy: entries.reduce((a, b) => a + b.energy, 0) / entries.length as MoodLevel,
    count:  entries.length,
    notes:  entries.map(e => e.note).filter(Boolean) as string[],
  };
}

function groceryTotal(expenses: Expense[], dates: string[]): number {
  const set = new Set(dates);
  return expenses
    .filter(e => (!e.type || e.type === 'expense') && e.category === 'groceries' && set.has(e.date.slice(0, 10)))
    .reduce((s, e) => s + e.amount, 0);
}

function sweetsTotal(expenses: Expense[], dates: string[]): number {
  const set = new Set(dates);
  let total = 0;
  for (const e of expenses) {
    if (e.type && e.type !== 'expense') continue;
    if (!set.has(e.date.slice(0, 10))) continue;
    for (const it of (e.receiptItems ?? [])) {
      if (it.tags.some(t => SWEETS_TAGS.includes(t))) total += it.price;
    }
  }
  return total;
}

function allSpend(expenses: Expense[], dates: string[]): number {
  const set = new Set(dates);
  return expenses
    .filter(e => (!e.type || e.type === 'expense') && set.has(e.date.slice(0, 10)))
    .reduce((s, e) => s + e.amount, 0);
}

function weekIncome(expenses: Expense[], dates: string[]): number {
  const set = new Set(dates);
  return expenses
    .filter(e => e.type === 'income' && set.has(e.date.slice(0, 10)))
    .reduce((s, e) => s + e.amount, 0);
}

function moodColor(avg: number): string {
  if (avg >= 4.5) return MOOD_COLORS[5];
  if (avg >= 3.5) return MOOD_COLORS[4];
  if (avg >= 2.5) return MOOD_COLORS[3];
  if (avg >= 1.5) return MOOD_COLORS[2];
  return MOOD_COLORS[1];
}

// ─── Screen ────────────────────────────────────────────────────────────────────

export default function StatsScreen() {
  const { expenses, setExpenses } = useExpensesStore();
  const { entries: moodEntries, setEntries: setMood } = useMoodStore();
  const { events, tasks, setEvents } = useCalendarStore();

  const [weekOffset, setWeekOffset]       = useState(0);
  const [heatOffset, setHeatOffset]       = useState(0); // months back from current
  const [reportTab, setReportTab]         = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [reports, setReports]             = useState<WeeklyReport[]>([]);
  const [monthlyReports, setMonthlyRep]   = useState<MonthlyReport[]>([]);
  const [yearlyReports, setYearlyRep]     = useState<YearlyReport[]>([]);
  const [expandedReport, setExpanded]     = useState<string | null>(null);
  const [generating, setGenerating]       = useState(false);

  useEffect(() => {
    if (expenses.length === 0) expensesService.getAll().then(setExpenses).catch(() => {});
    if (moodEntries.length === 0) moodService.getAll().then(setMood).catch(() => {});
    if (events.length === 0) {
      import('@/services/calendarService').then(({ calendarService }) =>
        calendarService.getAllEvents().then(setEvents).catch(() => {})
      );
    }
    loadReports().then(setReports);
    loadMonthlyReports().then(setMonthlyRep);
    loadYearlyReports().then(setYearlyRep);
  }, []);

  // Auto-generate monthly report on first 3 days of the month
  useEffect(() => {
    if (expenses.length === 0 && moodEntries.length === 0) return;
    shouldAutoGenerateMonthly().then(async (should) => {
      if (!should) return;
      const prev = getPrevMonth();
      const report = generateMonthlyReport({ month: prev, moodEntries, tasks, expenses, events });
      await saveMonthlyReport(report);
      await markMonthlyGenerated(prev);
      setMonthlyRep(await loadMonthlyReports());
      // Also regenerate yearly report for that year
      const year = parseInt(prev.slice(0, 4));
      const yearly = generateYearlyReport({ year, moodEntries, tasks, expenses, events });
      await saveYearlyReport(yearly);
      setYearlyRep(await loadYearlyReports());
    });
  }, [expenses.length, moodEntries.length]);

  // Auto-generate report for previous week on Monday/Tuesday
  useEffect(() => {
    if (expenses.length === 0 || moodEntries.length === 0) return;
    shouldAutoGenerate().then(async (should) => {
      if (!should) return;
      const currentWeek = getCurrentWeekStart();
      const prevWeek    = getPrevWeekStart(currentWeek);
      const prevWeekMood = moodEntries.filter(e => {
        const pw = getWeekBounds(prevWeek);
        return e.date >= pw.start && e.date <= pw.end;
      });
      const report = generateReport({
        weekStart: prevWeek,
        moodEntries,
        tasks,
        expenses,
        events,
        prevWeekMoodEntries: moodEntries.filter(e => {
          const ppw = getWeekBounds(getPrevWeekStart(prevWeek));
          return e.date >= ppw.start && e.date <= ppw.end;
        }),
      });
      await saveReport(report);
      await markGenerated(prevWeek);
      setReports(await loadReports());
    });
  }, [expenses.length, moodEntries.length]);

  const generateManual = async (weekStart: string) => {
    setGenerating(true);
    const prevWeekStart = getPrevWeekStart(weekStart);
    const report = generateReport({
      weekStart,
      moodEntries, tasks, expenses, events,
      prevWeekMoodEntries: moodEntries.filter(e => {
        const pw = getWeekBounds(prevWeekStart);
        return e.date >= pw.start && e.date <= pw.end;
      }),
    });
    await saveReport(report);
    setReports(await loadReports());
    setGenerating(false);
  };

  const generateManualMonthly = async (month: string) => {
    setGenerating(true);
    const report = generateMonthlyReport({ month, moodEntries, tasks, expenses, events });
    await saveMonthlyReport(report);
    setMonthlyRep(await loadMonthlyReports());
    setGenerating(false);
  };

  const generateManualYearly = async (year: number) => {
    setGenerating(true);
    const report = generateYearlyReport({ year, moodEntries, tasks, expenses, events });
    await saveYearlyReport(report);
    setYearlyRep(await loadYearlyReports());
    setGenerating(false);
  };

  // Selected week's dates
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);
  const weekSet   = useMemo(() => new Set(weekDates), [weekDates]);

  // ── Mood per day
  const moodByDay = useMemo(() => {
    const map: Record<string, MoodEntry[]> = {};
    for (const e of moodEntries) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [moodEntries]);

  // ── Mood calendar heatmap
  const heatMonthLabel = useMemo(() => {
    const d = new Date();
    d.setDate(1);
    d.setMonth(d.getMonth() + heatOffset);
    return `${MONTH_SHORT[d.getMonth()]} ${d.getFullYear()}`;
  }, [heatOffset]);

  const heatGrid = useMemo(() => {
    const base = new Date();
    base.setDate(1);
    base.setMonth(base.getMonth() + heatOffset);
    const year  = base.getFullYear();
    const month = base.getMonth();
    const daysInMonth = new Date(year, month + 1, 0).getDate();
    const firstDow = new Date(year, month, 1).getDay();
    const startCol = firstDow === 0 ? 6 : firstDow - 1; // Mon=0

    type HeatCell = null | { day: number; dateStr: string; avgMood: number | null; isToday: boolean };
    const todayStr = toStr(new Date());
    const grid: HeatCell[][] = [];
    let row: HeatCell[] = Array.from({ length: startCol }, () => null);

    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      const entries = moodByDay[dateStr] ?? [];
      const avgMood = entries.length
        ? entries.reduce((a, b) => a + b.mood, 0) / entries.length
        : null;
      row.push({ day: d, dateStr, avgMood, isToday: dateStr === todayStr });
      if (row.length === 7) { grid.push(row); row = []; }
    }
    if (row.length) {
      while (row.length < 7) row.push(null);
      grid.push(row);
    }
    return grid;
  }, [heatOffset, moodByDay]);

  const weekMoodDays = useMemo(() =>
    weekDates.map(d => ({ date: d, avg: dayAvg(moodByDay[d] ?? []) })),
    [weekDates, moodByDay],
  );

  const loggedDays     = weekMoodDays.filter(d => d.avg !== null).length;
  const weekMoodValues = weekMoodDays.filter(d => d.avg !== null).map(d => d.avg!.mood);
  const weekAvgMood    = weekMoodValues.length
    ? weekMoodValues.reduce((a, b) => a + b, 0) / weekMoodValues.length
    : null;
  const weekAvgEnergy  = weekMoodDays.filter(d => d.avg !== null).length
    ? weekMoodDays.filter(d => d.avg).reduce((a, d) => a + d.avg!.energy, 0) / weekMoodDays.filter(d => d.avg).length
    : null;

  // ── Prev week for trend
  const prevWeekDates  = useMemo(() => getWeekDates(weekOffset - 1), [weekOffset]);
  const prevMoodValues = prevWeekDates.map(d => (moodByDay[d] ?? []).map(e => e.mood)).flat();
  const prevAvgMood    = prevMoodValues.length
    ? prevMoodValues.reduce((a, b) => a + b, 0) / prevMoodValues.length
    : null;

  const moodTrend: 'up' | 'down' | 'stable' | null = useMemo(() => {
    if (weekAvgMood === null || prevAvgMood === null) return null;
    const diff = weekAvgMood - prevAvgMood;
    if (diff > 0.3) return 'up';
    if (diff < -0.3) return 'down';
    return 'stable';
  }, [weekAvgMood, prevAvgMood]);

  // ── Week's notes (non-null)
  const weekNotes = useMemo(() =>
    weekDates.flatMap(d => (moodByDay[d] ?? []).filter(e => e.note).map(e => ({ date: d, note: e.note! }))),
    [weekDates, moodByDay],
  );

  // ── Finances for this week
  const weekFood    = useMemo(() => groceryTotal(expenses, weekDates), [expenses, weekDates]);
  const weekSweets  = useMemo(() => sweetsTotal(expenses, weekDates), [expenses, weekDates]);
  const weekTotal   = useMemo(() => allSpend(expenses, weekDates), [expenses, weekDates]);
  const weekInc     = useMemo(() => weekIncome(expenses, weekDates), [expenses, weekDates]);

  // Large individual expenses this week (single expense > 100 zł, non-groceries)
  const bigExpenses = useMemo(() =>
    expenses
      .filter(e => (!e.type || e.type === 'expense') && weekSet.has(e.date.slice(0, 10)) && e.amount >= 50)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4),
    [expenses, weekSet],
  );

  // ── Calendar events this week
  const weekEvents = useMemo(() =>
    events.filter(e => weekSet.has(e.date)).sort((a, b) => a.date.localeCompare(b.date)),
    [events, weekSet],
  );

  // ── 8-week overview
  const weekOverview = useMemo(() => {
    return Array.from({ length: WEEKS_BACK }, (_, i) => {
      const offset = weekOffset - (WEEKS_BACK - 1 - i);
      const dates  = getWeekDates(offset);
      const moodVals = dates.flatMap(d => (moodByDay[d] ?? []).map(e => e.mood));
      const avgMood  = moodVals.length ? moodVals.reduce((a, b) => a + b, 0) / moodVals.length : null;
      const sw = sweetsTotal(expenses, dates);
      const food = groceryTotal(expenses, dates);
      const inc = weekIncome(expenses, dates);
      const label = weekLabel(dates);
      return { offset, dates, avgMood, sweets: sw, food, income: inc, label, isCurrent: offset === weekOffset };
    });
  }, [weekOffset, moodByDay, expenses]);

  const maxSweets = Math.max(...weekOverview.map(w => w.sweets), 1);
  const maxFood   = Math.max(...weekOverview.map(w => w.food), 1);

  // Mood-food correlation: split weeks into good/bad mood, compare avg food spend
  const moodFoodCorr = useMemo(() => {
    const withMood = weekOverview.filter(w => w.avgMood !== null);
    if (withMood.length < 3) return null;
    const goodMood = withMood.filter(w => w.avgMood! >= 3.5);
    const badMood  = withMood.filter(w => w.avgMood! < 3.5);
    const avgFood  = (arr: typeof withMood) => arr.length > 0 ? arr.reduce((s, w) => s + w.food, 0) / arr.length : 0;
    const avgSweets = (arr: typeof withMood) => arr.length > 0 ? arr.reduce((s, w) => s + w.sweets, 0) / arr.length : 0;
    return {
      goodFood: avgFood(goodMood), badFood: avgFood(badMood),
      goodSweets: avgSweets(goodMood), badSweets: avgSweets(badMood),
      goodCount: goodMood.length, badCount: badMood.length,
    };
  }, [weekOverview]);

  return (
    <SafeAreaView style={s.safe} edges={['top']}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={s.scroll}>

        {/* ── Header ───────────────────────────────────────────────────── */}
        <View style={s.header}>
          <Text style={s.screenTitle}>Statystyki</Text>
          <View style={s.weekNav}>
            <TouchableOpacity onPress={() => setWeekOffset(o => o - 1)} style={s.navBtn}>
              <ChevronLeft size={16} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={s.weekLabel}>{weekLabel(weekDates)}</Text>
            <TouchableOpacity
              onPress={() => setWeekOffset(o => Math.min(o + 1, 0))}
              style={[s.navBtn, weekOffset >= 0 && s.navBtnDisabled]}
              disabled={weekOffset >= 0}
            >
              <ChevronRight size={16} color={weekOffset >= 0 ? colors.text.muted : colors.text.secondary} />
            </TouchableOpacity>
          </View>
        </View>

        {/* ── Mood timeline ────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <Smile size={13} color={colors.accent.pink} />
            <Text style={[s.cardLabel, { color: colors.accent.pink }]}>Nastrój tygodnia</Text>
            {moodTrend && (
              <View style={[s.trendBadge, {
                backgroundColor: moodTrend === 'up' ? colors.accent.green + '1A' : moodTrend === 'down' ? colors.accent.red + '1A' : 'rgba(255,255,255,0.06)',
              }]}>
                {moodTrend === 'up'
                  ? <TrendingUp size={10} color={colors.accent.green} />
                  : moodTrend === 'down'
                  ? <TrendingDown size={10} color={colors.accent.red} />
                  : null}
                <Text style={[s.trendText, {
                  color: moodTrend === 'up' ? colors.accent.green : moodTrend === 'down' ? colors.accent.red : colors.text.muted,
                }]}>
                  {moodTrend === 'up' ? 'wzrost' : moodTrend === 'down' ? 'spadek' : 'stabilnie'}
                </Text>
              </View>
            )}
          </View>

          {/* Day grid */}
          <View style={s.dayGrid}>
            {weekMoodDays.map(({ date, avg }, i) => {
              const isToday = date === toStr(new Date());
              const col = avg ? moodColor(avg.mood) : 'rgba(255,255,255,0.06)';
              return (
                <View key={date} style={s.dayCol}>
                  <Text style={[s.dayLabel, isToday && { color: colors.accent.blue, fontWeight: '700' }]}>
                    {DAY_SHORT[i]}
                  </Text>
                  <View style={[s.dayDot, { backgroundColor: col, borderWidth: isToday ? 2 : 0, borderColor: colors.accent.blue + '80' }]}>
                    {avg && <Text style={s.dayVal}>{avg.mood.toFixed(1)}</Text>}
                  </View>
                  {avg && avg.count > 1 && (
                    <View style={s.countBadge}>
                      <Text style={s.countBadgeText}>{avg.count}</Text>
                    </View>
                  )}
                  {avg && (
                    <View style={[s.energyBar, { backgroundColor: MOOD_COLORS[Math.round(avg.energy) as MoodLevel] + '60' }]}>
                      <View style={[s.energyFill, {
                        width: `${(avg.energy / 5) * 100}%`,
                        backgroundColor: MOOD_COLORS[Math.round(avg.energy) as MoodLevel],
                      }]} />
                    </View>
                  )}
                </View>
              );
            })}
          </View>

          {/* Summary row */}
          {weekAvgMood !== null && (
            <View style={s.summaryRow}>
              <View style={s.summaryItem}>
                <Text style={[s.summaryVal, { color: moodColor(weekAvgMood) }]}>{weekAvgMood.toFixed(1)}</Text>
                <Text style={s.summaryLabel}>śr. nastrój</Text>
                <Text style={[s.summaryDetail, { color: moodColor(weekAvgMood) }]}>
                  {MOOD_LABELS[Math.round(weekAvgMood) as MoodLevel]}
                </Text>
              </View>
              {weekAvgEnergy !== null && (
                <>
                  <View style={s.summarySep} />
                  <View style={s.summaryItem}>
                    <View style={s.energyRow}>
                      <Zap size={11} color={colors.accent.amber} />
                      <Text style={[s.summaryVal, { color: colors.accent.amber }]}>{weekAvgEnergy.toFixed(1)}</Text>
                    </View>
                    <Text style={s.summaryLabel}>śr. energia</Text>
                    <Text style={[s.summaryDetail, { color: colors.accent.amber }]}>
                      {ENERGY_LABELS[Math.round(weekAvgEnergy) as MoodLevel]}
                    </Text>
                  </View>
                </>
              )}
              <View style={s.summarySep} />
              <View style={s.summaryItem}>
                <Text style={s.summaryVal}>{loggedDays}/7</Text>
                <Text style={s.summaryLabel}>dni z wpisem</Text>
              </View>
            </View>
          )}

          {loggedDays === 0 && (
            <Text style={s.emptyMood}>Brak wpisów w tym tygodniu</Text>
          )}

          {/* Notes */}
          {weekNotes.length > 0 && (
            <View style={s.notesSection}>
              <Text style={s.notesSectionLabel}>NOTATKI</Text>
              {weekNotes.slice(0, 3).map((n, i) => (
                <View key={i} style={s.noteRow}>
                  <View style={[s.noteDot, { backgroundColor: moodColor(dayAvg(moodByDay[n.date] ?? [])?.mood ?? 3) }]} />
                  <Text style={s.noteDate}>{n.date.slice(5).replace('-', '.')}</Text>
                  <Text style={s.noteText} numberOfLines={2}>{n.note}</Text>
                </View>
              ))}
            </View>
          )}
        </View>

        {/* ── Mood heatmap ─────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <Calendar size={13} color={colors.accent.pink} />
            <Text style={[s.cardLabel, { color: colors.accent.pink }]}>Kalendarz nastrojów</Text>
          </View>

          {/* Month navigation */}
          <View style={s.heatNavRow}>
            <TouchableOpacity onPress={() => setHeatOffset(o => o - 1)} style={s.heatNavBtn}>
              <ChevronLeft size={14} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={s.heatMonthLabel}>{heatMonthLabel}</Text>
            <TouchableOpacity
              onPress={() => setHeatOffset(o => Math.min(o + 1, 0))}
              style={[s.heatNavBtn, heatOffset >= 0 && s.navBtnDisabled]}
              disabled={heatOffset >= 0}
            >
              <ChevronRight size={14} color={heatOffset >= 0 ? colors.text.muted : colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* Day headers */}
          <View style={s.heatHeaderRow}>
            {DAY_SHORT.map(d => (
              <Text key={d} style={s.heatHeaderCell}>{d}</Text>
            ))}
          </View>

          {/* Grid */}
          <View style={s.heatGridWrap}>
            {heatGrid.map((week, ri) => (
              <View key={ri} style={s.heatWeekRow}>
                {week.map((cell, ci) => {
                  if (!cell) return <View key={ci} style={s.heatCellEmpty} />;
                  const bg = cell.avgMood
                    ? moodColor(cell.avgMood)
                    : cell.isToday
                    ? 'rgba(255,255,255,0.10)'
                    : 'rgba(255,255,255,0.04)';
                  return (
                    <View key={ci} style={[
                      s.heatCell,
                      { backgroundColor: bg },
                      cell.isToday && s.heatCellToday,
                    ]}>
                      <Text style={[
                        s.heatCellDay,
                        cell.avgMood ? s.heatCellDayFilled : cell.isToday ? { color: colors.accent.blue } : null,
                      ]}>
                        {cell.day}
                      </Text>
                    </View>
                  );
                })}
              </View>
            ))}
          </View>

        </View>

        {/* ── Tydzień finansowo ────────────────────────────────────────── */}
        {(weekTotal > 0 || weekInc > 0) && (
          <View style={s.card}>
            <View style={s.cardRow}>
              <Wallet size={13} color={colors.accent.blue} />
              <Text style={[s.cardLabel, { color: colors.accent.blue }]}>Tydzień finansowo</Text>
            </View>

            {/* Stats row */}
            <View style={s.finRow}>
              <View style={s.finStat}>
                <Text style={s.finVal}>{weekTotal.toFixed(0)}</Text>
                <Text style={s.finLabel}>wydatki zł</Text>
              </View>
              {weekInc > 0 && (
                <>
                  <View style={s.finSep} />
                  <View style={s.finStat}>
                    <View style={s.finIconRow}>
                      <TrendingUp size={10} color={colors.accent.green} />
                      <Text style={[s.finVal, { color: colors.accent.green }]}>{weekInc.toFixed(0)}</Text>
                    </View>
                    <Text style={s.finLabel}>przychody zł</Text>
                  </View>
                </>
              )}
              {weekFood > 0 && (
                <>
                  <View style={s.finSep} />
                  <View style={s.finStat}>
                    <View style={s.finIconRow}>
                      <ShoppingCart size={10} color={colors.accent.green} />
                      <Text style={[s.finVal, { color: colors.accent.green }]}>{weekFood.toFixed(0)}</Text>
                    </View>
                    <Text style={s.finLabel}>jedzenie zł</Text>
                  </View>
                </>
              )}
            </View>

            {/* Big individual expenses */}
            {bigExpenses.length > 0 && (
              <View style={s.bigExpSection}>
                {bigExpenses.map(e => {
                  const isInc = e.type === 'income';
                  return (
                    <View key={e.id} style={s.bigExpRow}>
                      <Text style={s.bigExpDate}>{e.date.slice(5, 10).replace('-', '.')}</Text>
                      <Text style={s.bigExpNote} numberOfLines={1}>
                        {e.storeName || e.note || '—'}
                      </Text>
                      <Text style={[s.bigExpAmt, { color: isInc ? colors.accent.green : colors.text.primary }]}>
                        {isInc ? '+' : '-'}{e.amount.toFixed(0)} zł
                      </Text>
                    </View>
                  );
                })}
              </View>
            )}

            {weekSweets > 0 && weekFood > 0 && (
              <Text style={s.finNote}>
                Słodycze: {weekSweets.toFixed(0)} zł ({Math.round(weekSweets / weekFood * 100)}% jedzenia tego tygodnia)
              </Text>
            )}
          </View>
        )}

        {/* ── Calendar events ──────────────────────────────────────────── */}
        {weekEvents.length > 0 && (
          <View style={s.card}>
            <View style={s.cardRow}>
              <Calendar size={13} color={colors.accent.purple} />
              <Text style={[s.cardLabel, { color: colors.accent.purple }]}>Eventy w tym tygodniu</Text>
            </View>
            {weekEvents.map(e => (
              <View key={e.id} style={s.eventRow}>
                <View style={[s.eventDot, { backgroundColor: e.color ?? colors.accent.purple }]} />
                <Text style={s.eventDate}>{e.date.slice(5).replace('-', '.')}</Text>
                <Text style={s.eventTitle} numberOfLines={1}>{e.title}</Text>
              </View>
            ))}
          </View>
        )}

        {/* ── 8-week overview ──────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <Text style={s.cardLabel}>Ostatnie {WEEKS_BACK} tygodni</Text>
            <Text style={s.cardMeta}>nastrój · jedzenie · słodycze</Text>
          </View>

          {weekOverview.map((w, i) => {
            const col      = w.avgMood ? moodColor(w.avgMood) : 'rgba(255,255,255,0.08)';
            const sweetsH  = maxSweets > 0 ? (w.sweets / maxSweets) * 32 : 0;
            const foodH    = maxFood   > 0 ? (w.food   / maxFood)   * 32 : 0;
            const sweetsPct = w.food > 0 ? Math.round(w.sweets / w.food * 100) : 0;
            return (
              <TouchableOpacity
                key={i}
                style={[s.overviewRow, w.isCurrent && s.overviewRowCurrent]}
                onPress={() => setWeekOffset(w.offset)}
                activeOpacity={0.7}
              >
                <Text style={[s.overviewLabel, w.isCurrent && { color: colors.text.primary, fontWeight: '600' }]}>
                  {w.label}
                </Text>
                <View style={[s.overviewDot, { backgroundColor: col }]}>
                  {w.avgMood && <Text style={s.overviewDotVal}>{w.avgMood.toFixed(1)}</Text>}
                </View>
                {/* Food bar (green) */}
                <View style={s.overviewBarsWrap}>
                  <View style={[s.overviewBar, { height: Math.max(foodH, 2), backgroundColor: colors.accent.green + (w.food > 0 ? 'AA' : '20') }]} />
                  <View style={[s.overviewBar, { height: Math.max(sweetsH, 2), backgroundColor: colors.accent.amber + (w.sweets > 0 ? 'CC' : '20') }]} />
                </View>
                <View style={s.overviewAmtCol}>
                  {w.food > 0 && <Text style={[s.overviewAmt, { color: colors.accent.green }]}>{w.food.toFixed(0)}</Text>}
                  {w.sweets > 0 && <Text style={[s.overviewAmt, { color: colors.accent.amber }]}>{sweetsPct}%</Text>}
                </View>
                {w.income > 0 && <View style={s.overviewIncomeDot} />}
              </TouchableOpacity>
            );
          })}

          <View style={s.overviewLegend}>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: colors.accent.pink }]} />
              <Text style={s.legendText}>nastrój</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: colors.accent.green }]} />
              <Text style={s.legendText}>jedzenie zł</Text>
            </View>
            <View style={s.legendItem}>
              <View style={[s.legendDot, { backgroundColor: colors.accent.amber }]} />
              <Text style={s.legendText}>słodycze %</Text>
            </View>
          </View>

          {/* Mood-food correlation insight */}
          {moodFoodCorr && (moodFoodCorr.goodCount > 0 || moodFoodCorr.badCount > 0) && (
            <View style={s.corrBox}>
              <Text style={s.corrTitle}>Korelacja nastrój ↔ jedzenie</Text>
              <View style={s.corrRow}>
                <View style={s.corrStat}>
                  <View style={[s.corrDot, { backgroundColor: MOOD_COLORS[4] }]} />
                  <Text style={s.corrLabel}>Dobry nastrój ({moodFoodCorr.goodCount} tydz.)</Text>
                  <Text style={s.corrVal}>{moodFoodCorr.goodFood.toFixed(0)} zł jedzenie</Text>
                  {moodFoodCorr.goodSweets > 0 && (
                    <Text style={[s.corrSub, { color: colors.accent.amber }]}>{moodFoodCorr.goodSweets.toFixed(0)} zł słodycze</Text>
                  )}
                </View>
                <View style={s.corrDivider} />
                <View style={s.corrStat}>
                  <View style={[s.corrDot, { backgroundColor: MOOD_COLORS[2] }]} />
                  <Text style={s.corrLabel}>Słaby nastrój ({moodFoodCorr.badCount} tydz.)</Text>
                  <Text style={s.corrVal}>{moodFoodCorr.badFood.toFixed(0)} zł jedzenie</Text>
                  {moodFoodCorr.badSweets > 0 && (
                    <Text style={[s.corrSub, { color: colors.accent.amber }]}>{moodFoodCorr.badSweets.toFixed(0)} zł słodycze</Text>
                  )}
                </View>
              </View>
              {moodFoodCorr.badSweets > 0 && moodFoodCorr.goodSweets > 0 && (
                <Text style={s.corrInsight}>
                  {moodFoodCorr.badSweets > moodFoodCorr.goodSweets * 1.2
                    ? `Przy słabym nastroju jesz ${Math.round((moodFoodCorr.badSweets / moodFoodCorr.goodSweets - 1) * 100)}% więcej słodyczy.`
                    : moodFoodCorr.goodSweets > moodFoodCorr.badSweets * 1.2
                    ? `Przy dobrym nastroju wydajesz ${Math.round((moodFoodCorr.goodSweets / moodFoodCorr.badSweets - 1) * 100)}% więcej na słodycze.`
                    : 'Nastrój nie ma dużego wpływu na słodycze w twoim przypadku.'}
                </Text>
              )}
            </View>
          )}
        </View>

        {/* ── Reports ─────────────────────────────────────────────────── */}
        <View style={s.card}>
          <View style={s.cardRow}>
            <FileText size={13} color={colors.accent.purple} />
            <Text style={[s.cardLabel, { color: colors.accent.purple }]}>Raporty</Text>
            <TouchableOpacity
              onPress={() => {
                if (reportTab === 'weekly') generateManual(getWeekBounds(weekDates[0]).start);
                else if (reportTab === 'monthly') generateManualMonthly(getPrevMonth());
                else generateManualYearly(new Date().getFullYear());
              }}
              style={s.genBtn}
              disabled={generating}
            >
              <RefreshCw size={11} color={generating ? colors.text.muted : colors.accent.purple} />
              <Text style={[s.genBtnText, generating && { color: colors.text.muted }]}>
                {generating ? '...' : 'Generuj'}
              </Text>
            </TouchableOpacity>
          </View>

          {/* Report type tabs */}
          <View style={s.reportTabRow}>
            {(['weekly', 'monthly', 'yearly'] as const).map(tab => (
              <TouchableOpacity
                key={tab}
                style={[s.reportTabBtn, reportTab === tab && s.reportTabBtnActive]}
                onPress={() => { setReportTab(tab); setExpanded(null); }}
                activeOpacity={0.7}
              >
                <Text style={[s.reportTabText, reportTab === tab && s.reportTabTextActive]}>
                  {tab === 'weekly' ? 'Tygodniowe' : tab === 'monthly' ? 'Miesięczne' : 'Roczne'}
                </Text>
              </TouchableOpacity>
            ))}
          </View>

          {/* Weekly reports */}
          {reportTab === 'weekly' && (
            reports.length === 0
              ? <Text style={s.emptyMood}>Brak raportów. Generują się automatycznie co poniedziałek.</Text>
              : reports.slice(0, 12).map(r => {
                const expanded = expandedReport === r.id;
                const mc = r.mood.avgMood !== null ? moodColor(r.mood.avgMood) : colors.text.muted;
                return (
                  <TouchableOpacity key={r.id} onPress={() => setExpanded(expanded ? null : r.id)} activeOpacity={0.75}>
                    <View style={[s.reportRow, expanded && s.reportRowExpanded]}>
                      <View style={[s.reportMoodDot, { backgroundColor: mc }]}>
                        {r.mood.avgMood !== null && <Text style={s.reportMoodVal}>{r.mood.avgMood.toFixed(1)}</Text>}
                      </View>
                      <View style={s.reportInfo}>
                        <Text style={s.reportWeek}>{r.weekStart.slice(5).replace('-', '.')} – {r.weekEnd.slice(5).replace('-', '.')}</Text>
                        <Text style={s.reportHighlight} numberOfLines={expanded ? 5 : 1}>{r.highlight}</Text>
                      </View>
                      <View style={s.reportQuick}>
                        {r.tasks.total > 0 && <Text style={s.reportQuickText}>{Math.round(r.tasks.rate * 100)}%</Text>}
                        {r.finances.sweetsSpend > 0 && <Text style={[s.reportQuickText, { color: colors.accent.amber }]}>{r.finances.sweetsSpend.toFixed(0)} zł</Text>}
                      </View>
                    </View>
                    {expanded && (
                      <View style={s.reportDetail}>
                        <View style={s.reportDetailRow}>
                          <View style={s.reportDetailStat}>
                            <Text style={[s.reportDetailVal, { color: mc }]}>{r.mood.avgMood?.toFixed(1) ?? '—'}</Text>
                            <Text style={s.reportDetailLabel}>śr. nastrój</Text>
                          </View>
                          <View style={s.reportDetailStat}>
                            <Text style={s.reportDetailVal}>{r.mood.loggedDays}/7</Text>
                            <Text style={s.reportDetailLabel}>dni</Text>
                          </View>
                          {r.tasks.total > 0 && (
                            <View style={s.reportDetailStat}>
                              <Text style={s.reportDetailVal}>{r.tasks.completed}/{r.tasks.total}</Text>
                              <Text style={s.reportDetailLabel}>zadania</Text>
                            </View>
                          )}
                          {r.finances.totalSpend > 0 && (
                            <View style={s.reportDetailStat}>
                              <Text style={s.reportDetailVal}>{r.finances.totalSpend.toFixed(0)}</Text>
                              <Text style={s.reportDetailLabel}>wydatki zł</Text>
                            </View>
                          )}
                        </View>
                        {r.mood.topNote && <Text style={s.reportDetailNote}>"{r.mood.topNote}"</Text>}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
          )}

          {/* Monthly reports */}
          {reportTab === 'monthly' && (
            monthlyReports.length === 0
              ? <Text style={s.emptyMood}>Brak raportów miesięcznych. Naciśnij "Generuj" aby stworzyć.</Text>
              : monthlyReports.slice(0, 12).map(r => {
                const expanded = expandedReport === r.id;
                const mc = r.mood.avgMood !== null ? moodColor(r.mood.avgMood) : colors.text.muted;
                const balColor = r.finances.balance >= 0 ? colors.accent.green : colors.accent.red;
                return (
                  <TouchableOpacity key={r.id} onPress={() => setExpanded(expanded ? null : r.id)} activeOpacity={0.75}>
                    <View style={[s.reportRow, expanded && s.reportRowExpanded]}>
                      <View style={[s.reportMoodDot, { backgroundColor: mc }]}>
                        {r.mood.avgMood !== null && <Text style={s.reportMoodVal}>{r.mood.avgMood.toFixed(1)}</Text>}
                      </View>
                      <View style={s.reportInfo}>
                        <Text style={s.reportWeek}>{r.month.replace('-', '/')}</Text>
                        <Text style={s.reportHighlight} numberOfLines={expanded ? 5 : 1}>{r.highlight}</Text>
                      </View>
                      <View style={s.reportQuick}>
                        {r.finances.balance !== 0 && (
                          <Text style={[s.reportQuickText, { color: balColor }]}>
                            {r.finances.balance >= 0 ? '+' : ''}{r.finances.balance.toFixed(0)} zł
                          </Text>
                        )}
                      </View>
                    </View>
                    {expanded && (
                      <View style={s.reportDetail}>
                        <View style={s.reportDetailRow}>
                          <View style={s.reportDetailStat}>
                            <Text style={[s.reportDetailVal, { color: mc }]}>{r.mood.avgMood?.toFixed(1) ?? '—'}</Text>
                            <Text style={s.reportDetailLabel}>śr. nastrój</Text>
                          </View>
                          <View style={s.reportDetailStat}>
                            <Text style={s.reportDetailVal}>{r.mood.loggedDays}</Text>
                            <Text style={s.reportDetailLabel}>dni z wpisem</Text>
                          </View>
                          {r.tasks.total > 0 && (
                            <View style={s.reportDetailStat}>
                              <Text style={s.reportDetailVal}>{r.tasks.completed}/{r.tasks.total}</Text>
                              <Text style={s.reportDetailLabel}>zadania</Text>
                            </View>
                          )}
                          <View style={s.reportDetailStat}>
                            <Text style={[s.reportDetailVal, { color: balColor }]}>
                              {r.finances.balance >= 0 ? '+' : ''}{r.finances.balance.toFixed(0)}
                            </Text>
                            <Text style={s.reportDetailLabel}>saldo zł</Text>
                          </View>
                        </View>
                        {r.finances.foodSpend > 0 && (
                          <Text style={s.reportDetailNote}>
                            Jedzenie: {r.finances.foodSpend.toFixed(0)} zł
                            {r.finances.sweetsSpend > 0 ? ` · słodycze: ${r.finances.sweetsSpend.toFixed(0)} zł` : ''}
                          </Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
          )}

          {/* Yearly reports */}
          {reportTab === 'yearly' && (
            yearlyReports.length === 0
              ? <Text style={s.emptyMood}>Brak raportów rocznych. Naciśnij "Generuj" aby stworzyć.</Text>
              : yearlyReports.map(r => {
                const expanded = expandedReport === r.id;
                const mc = r.mood.avgMood !== null ? moodColor(r.mood.avgMood) : colors.text.muted;
                const balColor = r.finances.balance >= 0 ? colors.accent.green : colors.accent.red;
                return (
                  <TouchableOpacity key={r.id} onPress={() => setExpanded(expanded ? null : r.id)} activeOpacity={0.75}>
                    <View style={[s.reportRow, expanded && s.reportRowExpanded]}>
                      <View style={[s.reportMoodDot, { backgroundColor: mc }]}>
                        {r.mood.avgMood !== null && <Text style={s.reportMoodVal}>{r.mood.avgMood.toFixed(1)}</Text>}
                      </View>
                      <View style={s.reportInfo}>
                        <Text style={s.reportWeek}>{r.year}</Text>
                        <Text style={s.reportHighlight} numberOfLines={expanded ? 5 : 1}>{r.highlight}</Text>
                      </View>
                      <View style={s.reportQuick}>
                        {r.finances.balance !== 0 && (
                          <Text style={[s.reportQuickText, { color: balColor }]}>
                            {r.finances.balance >= 0 ? '+' : ''}{r.finances.balance.toFixed(0)} zł
                          </Text>
                        )}
                      </View>
                    </View>
                    {expanded && (
                      <View style={s.reportDetail}>
                        <View style={s.reportDetailRow}>
                          <View style={s.reportDetailStat}>
                            <Text style={[s.reportDetailVal, { color: mc }]}>{r.mood.avgMood?.toFixed(1) ?? '—'}</Text>
                            <Text style={s.reportDetailLabel}>śr. nastrój</Text>
                          </View>
                          <View style={s.reportDetailStat}>
                            <Text style={s.reportDetailVal}>{r.mood.loggedDays}</Text>
                            <Text style={s.reportDetailLabel}>dni z wpisem</Text>
                          </View>
                          {r.tasks.total > 0 && (
                            <View style={s.reportDetailStat}>
                              <Text style={s.reportDetailVal}>{r.tasks.completed}</Text>
                              <Text style={s.reportDetailLabel}>zadań done</Text>
                            </View>
                          )}
                          <View style={s.reportDetailStat}>
                            <Text style={s.reportDetailVal}>{r.finances.avgMonthlySpend.toFixed(0)}</Text>
                            <Text style={s.reportDetailLabel}>śr. mies. zł</Text>
                          </View>
                        </View>
                        {r.mood.bestMonth && (
                          <Text style={s.reportDetailNote}>
                            Najlepszy miesiąc: {r.mood.bestMonth}
                            {r.mood.worstMonth && r.mood.worstMonth !== r.mood.bestMonth ? ` · najgorszy: ${r.mood.worstMonth}` : ''}
                          </Text>
                        )}
                      </View>
                    )}
                  </TouchableOpacity>
                );
              })
          )}
        </View>

      </ScrollView>
    </SafeAreaView>
  );
}

// ─── Styles ────────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 140 },

  header:      { gap: spacing[2] },
  screenTitle: { fontSize: 26, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  weekNav:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  navBtn:      {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  weekLabel:   { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.text.primary },

  card: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    padding: spacing[4], gap: spacing[3],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  cardRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardLabel: { ...typography.label, color: colors.text.secondary, flex: 1, fontWeight: '600' },
  cardMeta:  { fontSize: 10, color: colors.text.muted },

  // Trend badge
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  trendText:  { fontSize: 10, fontWeight: '600' },

  // Day grid
  dayGrid: { flexDirection: 'row', gap: 4 },
  dayCol:  { flex: 1, alignItems: 'center', gap: 4 },
  dayLabel:{ fontSize: 10, color: colors.text.muted, fontWeight: '500' },
  dayDot:  {
    width: 38, height: 38, borderRadius: 19,
    alignItems: 'center', justifyContent: 'center',
  },
  dayVal:      { fontSize: 11, fontWeight: '800', color: '#fff' },
  countBadge:  {
    position: 'absolute', top: 22, right: 0,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.bg.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  countBadgeText: { fontSize: 8, fontWeight: '700', color: colors.text.muted },
  energyBar:   { width: 28, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  energyFill:  { height: 3, borderRadius: 2 },

  // Summary
  summaryRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  summaryItem:  { flex: 1, alignItems: 'center', gap: 2 },
  summaryVal:   { fontSize: 22, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  summaryLabel: { fontSize: 10, color: colors.text.muted },
  summaryDetail:{ fontSize: 10, fontWeight: '600' },
  summarySep:   { width: 1, height: 36, backgroundColor: 'rgba(255,255,255,0.06)' },
  energyRow:    { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  emptyMood:    { fontSize: 13, color: colors.text.muted, textAlign: 'center', paddingVertical: spacing[2] },

  // Notes
  notesSection:      { gap: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  notesSectionLabel: { fontSize: 9, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.5 },
  noteRow:     { flexDirection: 'row', alignItems: 'flex-start', gap: spacing[2] },
  noteDot:     { width: 7, height: 7, borderRadius: 4, marginTop: 4 },
  noteDate:    { fontSize: 10, color: colors.text.muted, width: 32, marginTop: 1 },
  noteText:    { flex: 1, fontSize: 12, color: colors.text.secondary, lineHeight: 17 },

  // Finance
  incomeRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[1], paddingHorizontal: spacing[3], borderRadius: radius.md, backgroundColor: colors.accent.green + '0F' },
  incomeText:  { fontSize: 13, fontWeight: '700' },
  finRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  finStat:     { flex: 1, alignItems: 'center', gap: 2 },
  finVal:      { fontSize: 20, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3 },
  finLabel:    { fontSize: 10, color: colors.text.muted },
  finSep:      { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.06)' },
  finIconRow:  { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  bigExpSection:{ gap: 4, paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  bigExpRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  bigExpDate:  { fontSize: 10, color: colors.text.muted, width: 32 },
  bigExpNote:  { flex: 1, fontSize: 12, color: colors.text.secondary },
  bigExpAmt:   { fontSize: 12, fontWeight: '700' },
  insightBox:  { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, padding: spacing[3] },
  insightText: { fontSize: 12, color: colors.text.secondary, lineHeight: 18, fontStyle: 'italic' },
  finNote:     { fontSize: 11, color: colors.text.muted, paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },

  // Events
  eventRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 4 },
  eventDot:   { width: 8, height: 8, borderRadius: 4 },
  eventDate:  { fontSize: 10, color: colors.text.muted, width: 32 },
  eventTitle: { flex: 1, fontSize: 13, color: colors.text.secondary },

  // 8-week overview
  overviewRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 6 },
  overviewRowCurrent: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, paddingHorizontal: spacing[2] },
  overviewLabel:      { width: 80, fontSize: 11, color: colors.text.muted },
  overviewDot:        { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  overviewDotVal:     { fontSize: 10, fontWeight: '800', color: '#fff' },
  overviewSweetsWrap: { flex: 1, height: 36, justifyContent: 'flex-end', alignItems: 'center' },
  overviewSweetsBar:  { width: 8, borderRadius: 4 },
  overviewSweetsAmt:  { width: 38, fontSize: 9, color: colors.accent.amber, textAlign: 'right' },
  overviewBarsWrap:   { flex: 1, height: 36, flexDirection: 'row', justifyContent: 'center', alignItems: 'flex-end', gap: 3 },
  overviewBar:        { width: 7, borderRadius: 3, minHeight: 2 },
  overviewAmtCol:     { width: 42, alignItems: 'flex-end', gap: 1 },
  overviewAmt:        { fontSize: 9, fontWeight: '600' },
  overviewIncomeDot:  { width: 8, height: 8, borderRadius: 4, backgroundColor: colors.accent.green },

  overviewLegend: { flexDirection: 'row', gap: spacing[3], alignItems: 'center', paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  legendItem:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:   { width: 8, height: 8, borderRadius: 4 },
  legendText:  { fontSize: 10, color: colors.text.muted },

  // Mood heatmap
  heatNavRow:      { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heatNavBtn:      { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' },
  heatMonthLabel:  { fontSize: 13, fontWeight: '700', color: colors.text.primary, textTransform: 'capitalize' },
  heatHeaderRow:   { flexDirection: 'row', gap: 3 },
  heatHeaderCell:  { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '600', color: colors.text.muted, textTransform: 'uppercase' },
  heatGridWrap:    { gap: 3 },
  heatWeekRow:     { flexDirection: 'row', gap: 3 },
  heatCell:        { flex: 1, aspectRatio: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  heatCellEmpty:   { flex: 1, aspectRatio: 1 },
  heatCellToday:   { borderWidth: 1.5, borderColor: colors.accent.blue + '80' },
  heatCellDay:     { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.25)' },
  heatCellDayFilled: { color: '#fff', fontWeight: '700' },
  heatLegend:      { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  heatLegendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heatLegendDot:   { width: 10, height: 10, borderRadius: 3 },
  heatLegendText:  { fontSize: 10, color: colors.text.muted },

  // Correlation box
  corrBox:     { backgroundColor: 'rgba(255,255,255,0.04)', borderRadius: radius.md, padding: spacing[3], gap: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', marginTop: spacing[1] },
  corrTitle:   { fontSize: 10, fontWeight: '700', color: colors.text.muted, letterSpacing: 0.8, textTransform: 'uppercase' },
  corrRow:     { flexDirection: 'row', gap: spacing[3] },
  corrStat:    { flex: 1, gap: 3 },
  corrDot:     { width: 8, height: 8, borderRadius: 4 },
  corrLabel:   { fontSize: 10, color: colors.text.muted, fontWeight: '500' },
  corrVal:     { fontSize: 14, fontWeight: '800', color: colors.text.primary },
  corrSub:     { fontSize: 11, fontWeight: '600' },
  corrDivider: { width: 1, backgroundColor: 'rgba(255,255,255,0.07)' },
  corrInsight: { fontSize: 12, color: colors.text.secondary, lineHeight: 17, fontStyle: 'italic', paddingTop: spacing[1], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)', marginTop: spacing[1] },

  // Report tabs
  reportTabRow:      { flexDirection: 'row', gap: spacing[2] },
  reportTabBtn:      { flex: 1, paddingVertical: spacing[2], borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.default, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  reportTabBtnActive:{ backgroundColor: colors.accent.purple + '20', borderColor: colors.accent.purple + '50' },
  reportTabText:     { fontSize: 11, fontWeight: '500', color: colors.text.muted },
  reportTabTextActive:{ color: colors.accent.purple, fontWeight: '700' },

  // Reports
  genBtn:      { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: colors.accent.purple + '44', backgroundColor: colors.accent.purple + '10' },
  genBtnText:  { fontSize: 10, fontWeight: '600', color: colors.accent.purple },

  reportRow:          { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: spacing[2] },
  reportRowExpanded:  { paddingBottom: 0 },
  reportMoodDot:      { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  reportMoodVal:      { fontSize: 10, fontWeight: '800', color: '#fff' },
  reportInfo:         { flex: 1 },
  reportWeek:         { fontSize: 11, color: colors.text.muted, fontWeight: '500' },
  reportHighlight:    { fontSize: 13, color: colors.text.secondary, lineHeight: 18, marginTop: 2 },
  reportQuick:        { alignItems: 'flex-end', gap: 2 },
  reportQuickText:    { fontSize: 10, fontWeight: '700', color: colors.text.muted },

  reportDetail:       { marginLeft: 48, marginTop: spacing[2], marginBottom: spacing[3], gap: spacing[2] },
  reportDetailRow:    { flexDirection: 'row', gap: spacing[3] },
  reportDetailStat:   { alignItems: 'center', gap: 1 },
  reportDetailVal:    { fontSize: 16, fontWeight: '800', color: colors.text.primary },
  reportDetailLabel:  { fontSize: 9, color: colors.text.muted },
  reportDetailNote:   { fontSize: 12, color: colors.text.secondary, lineHeight: 17, fontStyle: 'italic' },
});
