import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal,
  RefreshControl, TouchableOpacity, Animated as RNAnimated,
} from 'react-native';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  CheckCircle2, ChevronRight, ChevronLeft,
  TrendingUp, TrendingDown,
  Flame, Smile, Zap, CalendarDays,
  Settings, Search, Droplets, Dumbbell,
  BookOpen, Moon, Heart, Sun, Bike,
  BrainCircuit, Plus, ShoppingCart,
  Wallet, FileText, RefreshCw, Calendar,
  Cloud, CloudDrizzle, CloudRain, Snowflake, CloudLightning,
  Briefcase, CreditCard, Check,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import MoodCheckInModal from '@/components/mood/MoodCheckInModal';
import { useExpenses } from '@/hooks/useExpenses';
import { useExpensesStore } from '@/store/expensesStore';
import { useTasks } from '@/hooks/useTasks';
import { useMoodCheckIn } from '@/hooks/useMoodCheckIn';
import { useHabits } from '@/hooks/useHabits';
import { usePomodoroToday } from '@/hooks/usePomodoroToday';
import { useMoodStore } from '@/store/moodStore';
import { useCalendarStore } from '@/store/calendarStore';
import { MOOD_COLORS, MOOD_LABELS, ENERGY_LABELS, MoodEntry, MoodLevel, Expense, Subscription, BillingCycle } from '@/types';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { getBudgets, MonthlyBudgets } from '@/utils/budgets';
import { colors, spacing, radius } from '@/theme';
import { useWorkStore } from '@/store/workStore';
import { useWorkEarnings } from '@/hooks/useWorkEarnings';
import { workService } from '@/services/workService';
import { useTabSwipe } from '@/hooks/useTabSwipe';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { Animated } from 'react-native';
import { weatherService, DayWeather, WeatherIcon } from '@/services/weatherService';
import { googleCalendarService } from '@/services/googleCalendarService';
import { expensesService } from '@/services/expensesService';
import { moodService } from '@/services/moodService';
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

// ─── Constants ────────────────────────────────────────────────────────────────

const SWEETS_TAGS = ['słodycze'];
const DAY_SHORT   = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const MONTH_SHORT = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
const WEEKS_BACK  = 8;

// ─── Helpers ─────────────────────────────────────────────────────────────────

function pad(n: number) { return String(n).padStart(2, '0'); }

function todayStr() {
  const d = new Date();
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

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

function plTasks(n: number): string {
  const m10 = n % 10, m100 = n % 100;
  if (m10 === 1 && m100 !== 11) return 'zadanie';
  if (m10 >= 2 && m10 <= 4 && (m100 < 12 || m100 > 14)) return 'zadania';
  return 'zadań';
}

const HUMOR: Record<number, string[]> = {
  1: ['Dzień jak z horroru. Przeżyłeś. Na razie.', 'Gorzej nie będzie. Chyba.', 'Przetrwanie to też sukces.'],
  2: ['Słabo. Ale przynajmniej żyjesz.', 'Nie jest świetnie. Jest. To wystarczy.', 'Niskie obroty, rozumiem.'],
  3: ['Tak sobie. Normalna energia.', 'Middle ground — ani super ani kiepsko.', 'Standard. Nic specjalnego.'],
  4: ['Całkiem nieźle! Nie psuj tego.', 'Dobry nastrój? Wykorzystaj go.', 'Rzadki widok. Doceniam.'],
  5: ['SZCZYT MOŻLIWOŚCI. Serio co zrobiłeś?', '5/5 — dziś możesz wszystko.', 'Energia max. Pisz to sprawozdanie.'],
};
function humorLine(mood?: number, pending = 0, done = 0): string {
  if (mood === undefined) {
    if (done > 0) return `${done} ukończone dziś. Jak się czujesz?`;
    if (pending > 0) return `Masz ${pending} zadań. I jeszcze nie wiesz jak się czujesz.`;
    return 'Czysty start. Nastrój nieznany. Typowe.';
  }
  const opts = HUMOR[mood] ?? HUMOR[3];
  return opts[(new Date().getDate()) % opts.length];
}

function isDurationExpired(sub: Subscription): boolean {
  if (!sub.durationMonths || sub.durationMonths === 0 || !sub.startDate) return false;
  const end = new Date(sub.startDate + 'T00:00:00');
  end.setMonth(end.getMonth() + sub.durationMonths);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return end <= today;
}

function advanceNextBillingDate(current: string, cycle: BillingCycle): string {
  const d = new Date(current + 'T00:00:00');
  switch (cycle) {
    case 'weekly':    d.setDate(d.getDate() + 7); break;
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
  }
  return d.toISOString().split('T')[0];
}

// ─── Sub-components ───────────────────────────────────────────────────────────

const HABIT_ICON_MAP: Record<string, React.ComponentType<any>> = {
  droplets: Droplets, dumbbell: Dumbbell, 'book-open': BookOpen,
  moon: Moon, zap: Zap, heart: Heart, sun: Sun, bike: Bike,
};
function HabitIcon({ name, size, color }: { name: string; size: number; color: string }) {
  const Icon = HABIT_ICON_MAP[name] ?? Zap;
  return <Icon size={size} color={color} />;
}

function WeatherIco({ icon, size, color }: { icon: WeatherIcon; size: number; color: string }) {
  const props = { size, color };
  switch (icon) {
    case 'sun':           return <Sun {...props} />;
    case 'cloud-sun':     return <Cloud {...props} />;
    case 'cloud':         return <Cloud {...props} />;
    case 'cloud-drizzle': return <CloudDrizzle {...props} />;
    case 'cloud-rain':    return <CloudRain {...props} />;
    case 'snowflake':     return <Snowflake {...props} />;
    case 'zap':           return <CloudLightning {...props} />;
    default:              return <Sun {...props} />;
  }
}

// ─── Wave chart ───────────────────────────────────────────────────────────────

const WAVE_W = 320;
const WAVE_H = 72;

function WaveChart({ data, color, dotColors }: { data: number[]; color: string; dotColors?: (string | null)[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * WAVE_W,
    y: WAVE_H - 8 - ((v / max) * (WAVE_H - 20)),
  }));

  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const px = pts[i - 1].x, py = pts[i - 1].y;
    const cx = pts[i].x,     cy = pts[i].y;
    const cpx = (px + cx) / 2;
    line += ` C ${cpx.toFixed(1)} ${py.toFixed(1)}, ${cpx.toFixed(1)} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  const fill = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${WAVE_H} L ${pts[0].x.toFixed(1)} ${WAVE_H} Z`;

  return (
    <Svg width="100%" height={WAVE_H} viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id={`wg_${color.replace('#', '')}`} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.35" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Path d={fill} fill={`url(#wg_${color.replace('#', '')})`} />
      <Path d={line} stroke={color} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => {
        const dotColor = dotColors?.[i] ?? color;
        return (
          <Path
            key={i}
            d={`M ${p.x.toFixed(1)} ${p.y.toFixed(1)} m -4 0 a 4 4 0 1 0 8 0 a 4 4 0 1 0 -8 0`}
            fill={dotColor}
            opacity={data[i] > 0 ? '1' : '0.2'}
          />
        );
      })}
    </Svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { panHandlers, animatedStyle } = useTabSwipe();
  const { color: accentColor, greeting } = useTimeAccent();

  // ── Dashboard data ─────────────────────────────────────────────────────────
  const { stats, isLoading: finLoading, reload: reloadFin } = useExpenses();
  const { expenses, setExpenses } = useExpensesStore();
  const { tasks, isLoading: tasksLoading, reload: reloadTasks } = useTasks();
  const { habits, todayDone: habitsDone, toggle: toggleHabit, getStreak } = useHabits();
  const pomodoro    = usePomodoroToday();
  const { shifts: workShifts, settings: workSettings, setShifts: setWorkShifts, setSettings: setWorkSettings } = useWorkStore();
  const { todayEntry, modalVisible, openCheckIn, closeCheckIn } = useMoodCheckIn();
  const { entries: moodEntries, setEntries: setMood } = useMoodStore();
  const { events, gcalEvents, tasks: calTasks, setEvents, setGcalEvents } = useCalendarStore();
  const { subscriptions, update: updateSub } = useSubscriptions();
  const [budgets, setBudgets] = useState<MonthlyBudgets>({});

  // ── Subscription payment queue ─────────────────────────────────────────────
  const [paymentQueue, setPaymentQueue] = useState<Subscription[]>([]);
  const [paymentConfirming, setPaymentConfirming] = useState(false);
  const checkedSubs = useRef(false);

  // ── Stats data ─────────────────────────────────────────────────────────────
  const [weatherData, setWeatherData]   = useState<DayWeather[]>([]);
  const [statsWeekOffset, setStatsWeekOffset] = useState(0);
  const [heatOffset, setHeatOffset]     = useState(0);
  const [reportTab, setReportTab]       = useState<'weekly' | 'monthly' | 'yearly'>('weekly');
  const [reports, setReports]           = useState<WeeklyReport[]>([]);
  const [monthlyReports, setMonthlyRep] = useState<MonthlyReport[]>([]);
  const [yearlyReports, setYearlyRep]   = useState<YearlyReport[]>([]);
  const [expandedReport, setExpanded]   = useState<string | null>(null);
  const [reportsOpen, setReportsOpen]   = useState(false);
  const [generating, setGenerating]     = useState(false);
  const [waveTab, setWaveTab]           = useState<'food' | 'sweets'>('food');
  const [weekFinExpanded, setWeekFinExpanded] = useState(false);
  const [weekFinFoodOnly, setWeekFinFoodOnly] = useState(false);

  const allEvents = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);
  const workEarnings = useWorkEarnings(workShifts, allEvents, workSettings, expenses);

  useEffect(() => {
    if (events.length === 0) {
      import('@/services/calendarService').then(({ calendarService }) => {
        calendarService.getAllEvents().then(setEvents).catch(() => {});
      });
    }
    if (expenses.length === 0) expensesService.getAll().then(setExpenses).catch(() => {});
    if (moodEntries.length === 0) moodService.getAll().then(setMood).catch(() => {});
    getBudgets().then(setBudgets);
    workService.getSettings().then(setWorkSettings).catch(() => {});
    workService.getShifts(todayStr(), todayStr()).then(setWorkShifts).catch(() => {});
    loadReports().then(setReports);
    loadMonthlyReports().then(setMonthlyRep);
    loadYearlyReports().then(setYearlyRep);
    weatherService.getWeather().then(setWeatherData).catch(() => {});
    googleCalendarService.getStoredToken().then(token => {
      if (token) googleCalendarService.fetchEvents(1, 14).then(evs => {
        setGcalEvents(evs);
      }).catch(() => {});
    });
  }, []);

  // Subscription payment queue check
  useEffect(() => {
    if (checkedSubs.current || subscriptions.length === 0) return;
    checkedSubs.current = true;
    const todayS = new Date().toISOString().split('T')[0];
    const due = subscriptions.filter(s => s.active && !isDurationExpired(s) && s.nextBillingDate <= todayS);
    if (due.length > 0) setPaymentQueue(due);
  }, [subscriptions]);

  const currentPayment = paymentQueue[0] ?? null;

  const handlePaymentYes = useCallback(async () => {
    if (!currentPayment) return;
    setPaymentConfirming(true);
    try {
      const todayS = new Date().toISOString().split('T')[0];
      await expensesService.add({
        type: 'expense',
        amount: currentPayment.amount,
        currency: currentPayment.currency,
        category: currentPayment.category,
        tags: [],
        note: `Subskrypcja: ${currentPayment.name}`,
        date: todayS,
      });
      const next = advanceNextBillingDate(currentPayment.nextBillingDate, currentPayment.billingCycle);
      await updateSub(currentPayment.id, { nextBillingDate: next });
    } catch { }
    finally {
      setPaymentConfirming(false);
      setPaymentQueue(q => q.slice(1));
    }
  }, [currentPayment, updateSub]);

  const handlePaymentNo = useCallback(() => {
    setPaymentQueue(q => q.slice(1));
  }, []);

  // Schedule work shift notifications when events or settings load
  useEffect(() => {
    if (!workSettings.workColor && !workSettings.workPrefix) return;
    const wc = workSettings.workColor;
    const wp = workSettings.workPrefix?.trim().toLowerCase();
    const workEvs = allEvents.filter(e => {
      if (!e.startTime || !e.endTime) return false;
      if (wc && e.color === wc) return true;
      if (wp && e.title.toLowerCase().startsWith(wp)) return true;
      return false;
    });
    if (workEvs.length === 0) return;
    const monthHours = workEvs.reduce((sum, e) => {
      const [sh, sm] = e.startTime!.split(':').map(Number);
      const [eh, em] = e.endTime!.split(':').map(Number);
      return sum + Math.max(0, (eh * 60 + em - sh * 60 - sm)) / 60;
    }, 0);
    const hrs = monthHours > 0 ? monthHours : workSettings.hoursPerMonth;
    const wp2 = wp;
    const salaryIncome = wp2 ? expenses.find(e =>
      e.type === 'income' && e.tags.some(t => t.toLowerCase() === wp2)
    ) : null;
    const effectiveSalary = salaryIncome?.amount ?? workSettings.monthlySalary;
    const perSecond = hrs > 0 ? effectiveSalary / (hrs * 3600) : 0;
    import('@/services/notificationsService').then(({ notificationsService }) => {
      notificationsService.scheduleWorkShiftNotifications(workEvs, perSecond).catch(() => {});
    });
  }, [allEvents, workSettings]);

  // Auto-generate monthly report
  useEffect(() => {
    if (expenses.length === 0 && moodEntries.length === 0) return;
    shouldAutoGenerateMonthly().then(async (should) => {
      if (!should) return;
      const prev = getPrevMonth();
      const report = generateMonthlyReport({ month: prev, moodEntries, tasks: calTasks, expenses, events });
      await saveMonthlyReport(report);
      await markMonthlyGenerated(prev);
      setMonthlyRep(await loadMonthlyReports());
      const year = parseInt(prev.slice(0, 4));
      const yearly = generateYearlyReport({ year, moodEntries, tasks: calTasks, expenses, events });
      await saveYearlyReport(yearly);
      setYearlyRep(await loadYearlyReports());
    });
  }, [expenses.length, moodEntries.length]);

  // Auto-generate weekly report on Monday/Tuesday
  useEffect(() => {
    if (expenses.length === 0 || moodEntries.length === 0) return;
    shouldAutoGenerate().then(async (should) => {
      if (!should) return;
      const currentWeek = getCurrentWeekStart();
      const prevWeek    = getPrevWeekStart(currentWeek);
      const report = generateReport({
        weekStart: prevWeek,
        moodEntries, tasks: calTasks, expenses, events,
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
      moodEntries, tasks: calTasks, expenses, events,
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
    const report = generateMonthlyReport({ month, moodEntries, tasks: calTasks, expenses, events });
    await saveMonthlyReport(report);
    setMonthlyRep(await loadMonthlyReports());
    setGenerating(false);
  };

  const generateManualYearly = async (year: number) => {
    setGenerating(true);
    const report = generateYearlyReport({ year, moodEntries, tasks: calTasks, expenses, events });
    await saveYearlyReport(report);
    setYearlyRep(await loadYearlyReports());
    setGenerating(false);
  };

  // ── Dashboard derived data ─────────────────────────────────────────────────
  const today     = todayStr();
  const isLoading = finLoading || tasksLoading;
  const balance   = stats.monthIncome - stats.monthExpenses;
  const balPos    = balance >= 0;

  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
  const todayTasks   = useMemo(() =>
    pendingTasks.filter(t => t.deadline?.startsWith(today) || t.scheduledDate === today),
    [pendingTasks, today],
  );
  const todayEvents = useMemo(() => events.filter(e => e.date === today), [events, today]);
  const tomorrow = useMemo(() => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`;
  }, []);
  const gcalToday    = useMemo(() => gcalEvents.filter(e => e.date === today).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')), [gcalEvents, today]);
  const gcalTomorrow = useMemo(() => gcalEvents.filter(e => e.date === tomorrow).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')), [gcalEvents, tomorrow]);
  const todayDoneCount = useMemo(() =>
    tasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(today)).length,
    [tasks, today],
  );
  const budgetRemaining = useMemo(() => {
    const totalBudget = Object.values(budgets).reduce((s, v) => s + (v ?? 0), 0);
    if (totalBudget <= 0) return null;
    const remaining = totalBudget - stats.monthExpenses;
    return { remaining, totalBudget, pct: Math.min(1, stats.monthExpenses / totalBudget) };
  }, [budgets, stats.monthExpenses]);

  const nextDeadline = useMemo(() => {
    const upcoming = pendingTasks
      .filter(t => t.deadline)
      .sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))[0];
    if (!upcoming?.deadline) return null;
    const d = upcoming.deadline.split('T')[0];
    if (d === today) return { label: 'dziś', title: upcoming.title };
    const tomorrow = (() => { const t = new Date(); t.setDate(t.getDate()+1); return `${t.getFullYear()}-${String(t.getMonth()+1).padStart(2,'0')}-${String(t.getDate()).padStart(2,'0')}`; })();
    if (d === tomorrow) return { label: 'jutro', title: upcoming.title };
    const [, m, dd] = d.split('-');
    return { label: `${parseInt(dd)}.${parseInt(m)}`, title: upcoming.title };
  }, [pendingTasks, today]);

  const last7Mood = useMemo(() => {
    const seen = new Set<string>();
    const unique: typeof moodEntries = [];
    for (const e of moodEntries) {
      if (!seen.has(e.date)) { seen.add(e.date); unique.push(e); }
      if (unique.length === 7) break;
    }
    return unique.reverse();
  }, [moodEntries]);

  const habitsTotal     = habits.length;
  const habitsDoneCount = habits.filter(h => habitsDone.includes(h.id)).length;
  const onRefresh       = () => { reloadFin(); reloadTasks(); };

  // Mood streak — consecutive days with at least one entry (going back from today or yesterday)
  const moodStreak = useMemo(() => {
    const dates = [...new Set(moodEntries.map(e => e.date))].sort().reverse();
    if (!dates.length) return 0;
    const todayD = todayStr();
    const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toStr(d); })();
    // Start from today or yesterday
    if (dates[0] !== todayD && dates[0] !== yest) return 0;
    let streak = 0;
    let cursor = new Date(dates[0]);
    for (const d of dates) {
      if (d === toStr(cursor)) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else if (d < toStr(cursor)) break;
    }
    return streak;
  }, [moodEntries]);

  const bestStreak = useMemo(() => {
    if (habits.length === 0) return null;
    let best = { streak: 0, habit: habits[0] };
    for (const h of habits) {
      const s = getStreak(h.id);
      if (s > best.streak) best = { streak: s, habit: h };
    }
    return best.streak >= 2 ? best : null;
  }, [habits, getStreak]);

  const pulseAnim = useRef(new RNAnimated.Value(1)).current;
  useEffect(() => {
    if (!bestStreak) return;
    const loop = RNAnimated.loop(
      RNAnimated.sequence([
        RNAnimated.timing(pulseAnim, { toValue: 1.08, duration: 900, useNativeDriver: true }),
        RNAnimated.timing(pulseAnim, { toValue: 1,    duration: 900, useNativeDriver: true }),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, [!!bestStreak]);

  const todayTotal    = todayTasks.length + todayDoneCount;
  const todayProgress = todayTotal > 0 ? todayDoneCount / todayTotal : 0;
  const humor = useMemo(
    () => humorLine(todayEntry?.mood, pendingTasks.length, todayDoneCount),
    [todayEntry?.mood, pendingTasks.length, todayDoneCount],
  );
  const dateLabel = new Date().toLocaleDateString('pl-PL', {
    weekday: 'long', day: 'numeric', month: 'long',
  }).replace(/^\w/, c => c.toUpperCase());

  // ── Stats derived data ─────────────────────────────────────────────────────
  const statWeekDates = useMemo(() => getWeekDates(statsWeekOffset), [statsWeekOffset]);
  const statWeekSet   = useMemo(() => new Set(statWeekDates), [statWeekDates]);

  const moodByDay = useMemo(() => {
    const map: Record<string, MoodEntry[]> = {};
    for (const e of moodEntries) {
      if (!map[e.date]) map[e.date] = [];
      map[e.date].push(e);
    }
    return map;
  }, [moodEntries]);

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
    const startCol = firstDow === 0 ? 6 : firstDow - 1;
    type HeatCell = null | { day: number; dateStr: string; avgMood: number | null; isToday: boolean };
    const todayS = toStr(new Date());
    const grid: HeatCell[][] = [];
    let row: HeatCell[] = Array.from({ length: startCol }, () => null);
    for (let d = 1; d <= daysInMonth; d++) {
      const dateStr = `${year}-${pad(month + 1)}-${pad(d)}`;
      const entries = moodByDay[dateStr] ?? [];
      const avgMood = entries.length
        ? entries.reduce((a, b) => a + b.mood, 0) / entries.length
        : null;
      row.push({ day: d, dateStr, avgMood, isToday: dateStr === todayS });
      if (row.length === 7) { grid.push(row); row = []; }
    }
    if (row.length) {
      while (row.length < 7) row.push(null);
      grid.push(row);
    }
    return grid;
  }, [heatOffset, moodByDay]);

  const weekMoodDays = useMemo(() =>
    statWeekDates.map(d => ({ date: d, avg: dayAvg(moodByDay[d] ?? []) })),
    [statWeekDates, moodByDay],
  );
  const loggedDays     = weekMoodDays.filter(d => d.avg !== null).length;
  const weekMoodValues = weekMoodDays.filter(d => d.avg !== null).map(d => d.avg!.mood);
  const weekAvgMood    = weekMoodValues.length
    ? weekMoodValues.reduce((a, b) => a + b, 0) / weekMoodValues.length : null;
  const weekAvgEnergy  = weekMoodDays.filter(d => d.avg !== null).length
    ? weekMoodDays.filter(d => d.avg).reduce((a, d) => a + d.avg!.energy, 0) / weekMoodDays.filter(d => d.avg).length
    : null;

  const prevStatWeekDates = useMemo(() => getWeekDates(statsWeekOffset - 1), [statsWeekOffset]);
  const prevMoodValues = prevStatWeekDates.map(d => (moodByDay[d] ?? []).map(e => e.mood)).flat();
  const prevAvgMood    = prevMoodValues.length
    ? prevMoodValues.reduce((a, b) => a + b, 0) / prevMoodValues.length : null;

  const moodTrend = useMemo((): 'up' | 'down' | 'stable' | null => {
    if (weekAvgMood === null || prevAvgMood === null) return null;
    const diff = weekAvgMood - prevAvgMood;
    if (diff > 0.3) return 'up';
    if (diff < -0.3) return 'down';
    return 'stable';
  }, [weekAvgMood, prevAvgMood]);

  const weekNotes = useMemo(() =>
    statWeekDates.flatMap(d => (moodByDay[d] ?? []).filter(e => e.note).map(e => ({ date: d, note: e.note! }))),
    [statWeekDates, moodByDay],
  );

  const weekFood   = useMemo(() => groceryTotal(expenses, statWeekDates), [expenses, statWeekDates]);
  const weekSweets = useMemo(() => sweetsTotal(expenses, statWeekDates), [expenses, statWeekDates]);
  const weekTotal  = useMemo(() => allSpend(expenses, statWeekDates), [expenses, statWeekDates]);
  const weekInc    = useMemo(() => weekIncome(expenses, statWeekDates), [expenses, statWeekDates]);

  const bigExpenses = useMemo(() =>
    expenses
      .filter(e => (!e.type || e.type === 'expense') && statWeekSet.has(e.date.slice(0, 10)) && e.amount >= 50)
      .sort((a, b) => b.amount - a.amount)
      .slice(0, 4),
    [expenses, statWeekSet],
  );

  const weekAllExpenses = useMemo(() =>
    expenses
      .filter(e => (!e.type || e.type === 'expense') && statWeekSet.has(e.date.slice(0, 10)))
      .sort((a, b) => b.date.localeCompare(a.date) || b.amount - a.amount),
    [expenses, statWeekSet],
  );

  const weekFoodExpenses = useMemo(() =>
    weekAllExpenses.filter(e => e.category === 'groceries'),
    [weekAllExpenses],
  );

  const statWeekEvents = useMemo(() =>
    events.filter(e => statWeekSet.has(e.date)).sort((a, b) => a.date.localeCompare(b.date)),
    [events, statWeekSet],
  );

  const weekOverview = useMemo(() => {
    return Array.from({ length: WEEKS_BACK }, (_, i) => {
      const offset = statsWeekOffset - (WEEKS_BACK - 1 - i);
      const dates  = getWeekDates(offset);
      const moodVals = dates.flatMap(d => (moodByDay[d] ?? []).map(e => e.mood));
      const avgMood  = moodVals.length ? moodVals.reduce((a, b) => a + b, 0) / moodVals.length : null;
      const sw    = sweetsTotal(expenses, dates);
      const food  = groceryTotal(expenses, dates);
      const inc   = weekIncome(expenses, dates);
      const label = weekLabel(dates);
      const weather = weatherService.weekSummary(weatherData, dates);
      return { offset, dates, avgMood, sweets: sw, food, income: inc, label, isCurrent: offset === statsWeekOffset, weather };
    });
  }, [statsWeekOffset, moodByDay, expenses, weatherData]);

  const moodFoodCorr = useMemo(() => {
    const withMood = weekOverview.filter(w => w.avgMood !== null);
    if (withMood.length < 3) return null;
    const goodMood = withMood.filter(w => w.avgMood! >= 3.5);
    const badMood  = withMood.filter(w => w.avgMood! < 3.5);
    const avgFood   = (arr: typeof withMood) => arr.length > 0 ? arr.reduce((s, w) => s + w.food, 0) / arr.length : 0;
    const avgSweets = (arr: typeof withMood) => arr.length > 0 ? arr.reduce((s, w) => s + w.sweets, 0) / arr.length : 0;
    return {
      goodFood: avgFood(goodMood), badFood: avgFood(badMood),
      goodSweets: avgSweets(goodMood), badSweets: avgSweets(badMood),
      goodCount: goodMood.length, badCount: badMood.length,
    };
  }, [weekOverview]);

  // ─────────────────────────────────────────────────────────────────────────────

  return (
    <SafeAreaView style={s.safe} edges={['top']} {...panHandlers}>
      <Animated.View style={[{ flex: 1 }, animatedStyle]}>
        <ScrollView
          showsVerticalScrollIndicator={false}
          contentContainerStyle={s.scroll}
          refreshControl={
            <RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.text.secondary} />
          }
        >
          {/* ══ DASHBOARD SECTION ══════════════════════════════════════════════ */}

          {/* ── Header ──────────────────────────────────────────────────────── */}
          <View style={s.header}>
            <View style={s.headerTop}>
              <View>
                <Text style={s.dateText}>{dateLabel}</Text>
                <Text style={[s.greeting, { color: accentColor }]}>{greeting}</Text>
              </View>
              <View style={s.headerBtns}>
                <PressableScale onPress={() => router.push('/search' as any)} style={s.iconBtn}>
                  <Search size={17} color={colors.text.secondary} />
                </PressableScale>
                <PressableScale onPress={() => router.push('/settings' as any)} style={s.iconBtn}>
                  <Settings size={17} color={colors.text.secondary} />
                </PressableScale>
              </View>
            </View>
            <PressableScale onPress={openCheckIn} style={s.humorRow}>
              {todayEntry
                ? <View style={[s.moodDot, { backgroundColor: MOOD_COLORS[todayEntry.mood] }]} />
                : <Smile size={12} color={colors.text.muted} />}
              <Text style={s.humorText} numberOfLines={1}>{humor}</Text>
            </PressableScale>
          </View>

          {/* ── Tasks hero ──────────────────────────────────────────────────── */}
          <PressableScale onPress={() => router.push('/(tabs)/tasks' as any)}>
            <View style={s.card}>
              <View style={s.taskHeader}>
                <View style={s.taskCountRow}>
                  <Text style={s.taskBig}>{pendingTasks.length}</Text>
                  <View>
                    <Text style={s.taskLabel}>{plTasks(pendingTasks.length)}</Text>
                    {todayTasks.length > 0 && (
                      <Text style={[s.taskSub, { color: accentColor }]}>{todayTasks.length} na dziś</Text>
                    )}
                  </View>
                </View>
                <View style={{ flex: 1 }} />
                {todayDoneCount > 0 && (
                  <View style={s.doneBadge}>
                    <CheckCircle2 size={10} color={colors.accent.green} />
                    <Text style={s.doneBadgeText}>{todayDoneCount} dziś</Text>
                  </View>
                )}
                <ChevronRight size={16} color={colors.text.muted} />
              </View>
              {todayTotal > 0 && (
                <View style={s.progressRow}>
                  <View style={s.progressTrack}>
                    <View style={[s.progressFill, { width: `${todayProgress * 100}%`, backgroundColor: accentColor }]} />
                  </View>
                  <Text style={s.progressLabel}>{todayDoneCount}/{todayTotal} dziś</Text>
                </View>
              )}
              <PressableScale onPress={() => router.push('/tasks/add' as any)} style={s.addRow}>
                <Plus size={12} color={colors.text.muted} />
                <Text style={s.addText}>Dodaj zadanie</Text>
              </PressableScale>
            </View>
          </PressableScale>

          {/* ── Stats row ───────────────────────────────────────────────────── */}
          <View style={s.statsRow}>
            <PressableScale style={s.statTile} onPress={() => router.push('/expenses/stats' as any)}>
              {budgetRemaining
                ? <>
                    <TrendingDown size={12} color={budgetRemaining.remaining >= 0 ? colors.accent.green : colors.accent.red} />
                    <Text style={[s.statVal, { color: budgetRemaining.remaining >= 0 ? colors.text.primary : colors.accent.red }]}>
                      {Math.round(Math.abs(budgetRemaining.remaining))}
                    </Text>
                    <Text style={s.statLabel}>{budgetRemaining.remaining >= 0 ? 'zostało zł' : 'przekr. zł'}</Text>
                    <View style={s.budgetBar}>
                      <View style={[s.budgetFill, { width: `${budgetRemaining.pct * 100}%`, backgroundColor: budgetRemaining.pct >= 1 ? colors.accent.red : colors.accent.green }]} />
                    </View>
                  </>
                : <>
                    {balPos ? <TrendingUp size={12} color={colors.accent.green} /> : <TrendingDown size={12} color={colors.accent.red} />}
                    <Text style={[s.statVal, { color: balPos ? colors.text.primary : colors.accent.red }]}>{balPos ? '+' : ''}{Math.round(balance)}</Text>
                    <Text style={s.statLabel}>saldo zł</Text>
                  </>
              }
            </PressableScale>
            <PressableScale style={s.statTile} onPress={() => router.push('/(tabs)/tasks' as any)}>
              <CalendarDays size={12} color={nextDeadline ? colors.accent.purple : colors.text.muted} />
              <Text style={[s.statVal, { fontSize: nextDeadline ? 13 : 15 }]}>
                {nextDeadline ? nextDeadline.label : '—'}
              </Text>
              <Text style={s.statLabel} numberOfLines={1}>
                {nextDeadline ? nextDeadline.title.slice(0, 10) : 'deadline'}
              </Text>
            </PressableScale>
            <PressableScale style={s.statTile} onPress={() => router.push('/habits' as any)}>
              <Flame size={12} color={habitsTotal > 0 && habitsDoneCount === habitsTotal ? colors.accent.amber : colors.text.muted} />
              <Text style={s.statVal}>{habitsTotal > 0 ? `${habitsDoneCount}/${habitsTotal}` : '—'}</Text>
              <Text style={s.statLabel}>nawyki</Text>
            </PressableScale>
            <PressableScale style={s.statTile} onPress={() => router.push('/focus' as any)}>
              <BrainCircuit size={12} color={pomodoro.totalMins > 0 ? colors.accent.purple : colors.text.muted} />
              <Text style={s.statVal}>
                {pomodoro.totalMins > 0
                  ? pomodoro.totalMins >= 60 ? `${Math.floor(pomodoro.totalMins / 60)}h` : `${pomodoro.totalMins}m`
                  : '—'}
              </Text>
              <Text style={s.statLabel}>fokus</Text>
            </PressableScale>
          </View>

          {/* ── Mood island ─────────────────────────────────────────────────── */}
          {(() => {
            const mc = todayEntry ? MOOD_COLORS[todayEntry.mood] : colors.accent.pink;
            return (
              <PressableScale onPress={() => openCheckIn()}>
                <View style={[s.moodIsland, { borderColor: mc + '44', backgroundColor: mc + '0A' }]}>
                  <View style={[s.moodPill, { backgroundColor: mc + '1A' }]}>
                    <Smile size={12} color={mc} />
                    <Text style={[s.moodPillLabel, { color: mc }]}>NASTRÓJ</Text>
                    {moodStreak >= 2 && (
                      <View style={[s.moodStreakBadge, { backgroundColor: mc + '25' }]}>
                        <Flame size={8} color={mc} />
                        <Text style={[s.moodStreakText, { color: mc }]}>{moodStreak}</Text>
                      </View>
                    )}
                  </View>
                  <View style={s.moodDots}>
                    {last7Mood.map(e => (
                      <View key={e.id} style={[s.moodDotSm, { backgroundColor: MOOD_COLORS[e.mood] }]} />
                    ))}
                    {last7Mood.length === 0 && <Text style={s.moodEmpty}>brak danych</Text>}
                  </View>
                  <View style={{ flex: 1 }} />
                  {last7Mood.length > 0 && (
                    <Text style={[s.moodAvg, { color: mc }]}>
                      {(last7Mood.reduce((a, b) => a + b.mood, 0) / last7Mood.length).toFixed(1)}
                    </Text>
                  )}
                  <TouchableOpacity
                    onPress={(ev) => { ev.stopPropagation?.(); openCheckIn(); }}
                    style={[s.checkInBtn, { borderColor: mc + '44', backgroundColor: mc + '18' }]}
                    hitSlop={8}
                  >
                    <Text style={[s.checkInText, { color: mc }]}>{todayEntry ? 'edytuj' : '+ check-in'}</Text>
                  </TouchableOpacity>
                </View>
              </PressableScale>
            );
          })()}

          {/* ── Streak card ─────────────────────────────────────────────────── */}
          {bestStreak && (
            <TouchableOpacity onPress={() => router.push('/habits' as any)} activeOpacity={0.85}>
              <RNAnimated.View style={[
                s.streakCard,
                { transform: [{ scale: pulseAnim }] },
                { borderColor: bestStreak.habit.color + '60', backgroundColor: bestStreak.habit.color + '10' },
              ]}>
                <View style={[s.streakFlame, { backgroundColor: bestStreak.habit.color + '20' }]}>
                  <Flame size={22} color={bestStreak.habit.color} />
                </View>
                <View style={s.streakBody}>
                  <Text style={[s.streakNum, { color: bestStreak.habit.color }]}>{bestStreak.streak}</Text>
                  <View>
                    <Text style={s.streakLabel}>dni z rzędu</Text>
                    <Text style={s.streakName} numberOfLines={1}>{bestStreak.habit.title}</Text>
                  </View>
                </View>
                <View style={s.streakBadge}>
                  <Text style={[s.streakBadgeText, { color: bestStreak.habit.color }]}>
                    {bestStreak.streak >= 30 ? 'Legenda!' : bestStreak.streak >= 14 ? 'Niesamowite' : bestStreak.streak >= 7 ? 'Tydzień!' : 'Tak trzymaj!'}
                  </Text>
                </View>
              </RNAnimated.View>
            </TouchableOpacity>
          )}

          {/* ── Habits compact ──────────────────────────────────────────────── */}
          {habitsTotal > 0 && (
            <View style={s.card}>
              <View style={s.cardRow}>
                <Text style={s.cardLabel}>NAWYKI</Text>
                <Text style={[s.cardLabel, {
                  color: habitsDoneCount === habitsTotal ? colors.accent.green : colors.accent.purple,
                }]}>
                  {habitsDoneCount}/{habitsTotal}
                </Text>
                <View style={{ flex: 1 }} />
                <PressableScale onPress={() => router.push('/habits' as any)} style={s.seeAll}>
                  <Text style={s.seeAllText}>Wszystkie</Text>
                  <ChevronRight size={12} color={colors.text.muted} />
                </PressableScale>
              </View>
              <View style={s.habitsBubbles}>
                {habits.slice(0, 5).map(h => {
                  const done = habitsDone.includes(h.id);
                  return (
                    <TouchableOpacity
                      key={h.id}
                      onPress={() => toggleHabit(h.id)}
                      activeOpacity={0.75}
                      style={[s.habitBubble, done && { borderColor: h.color, backgroundColor: h.color + '18' }]}
                    >
                      <HabitIcon name={h.icon} size={13} color={done ? h.color : colors.text.muted} />
                      <Text style={[s.habitText, done && { color: h.color }]} numberOfLines={1}>{h.title}</Text>
                      {done && <CheckCircle2 size={10} color={h.color} />}
                    </TouchableOpacity>
                  );
                })}
                {habitsTotal > 5 && (
                  <View style={s.habitMore}>
                    <Text style={s.habitMoreText}>+{habitsTotal - 5}</Text>
                  </View>
                )}
              </View>
            </View>
          )}

          {/* ── Work earnings widget ────────────────────────────────────── */}
          {workEarnings.isWorking && (() => {
            const { totalEarned, perSecond, progressPct, shiftDurationMin, secondsWorked, activeEventTitle, isColorMode, monthWorkHours, salaryUsed } = workEarnings;
            const h = Math.floor(secondsWorked / 3600);
            const m = Math.floor((secondsWorked % 3600) / 60);
            const timeLabel = h > 0 ? `${h}h ${m}m` : `${m}m`;
            const durLabel = shiftDurationMin > 0
              ? `${Math.floor(shiftDurationMin / 60)}h${shiftDurationMin % 60 > 0 ? ` ${shiftDurationMin % 60}m` : ''}`
              : '';
            const wc = workSettings.workColor;
            return (
              <TouchableOpacity onPress={() => router.push('/work/add' as any)} activeOpacity={0.85}>
                <View style={[s.workCard, wc && { borderColor: wc + '40', backgroundColor: wc + '0A' }]}>
                  <View style={s.workHeader}>
                    <View style={[s.workIconWrap, wc && { backgroundColor: wc + '20' }]}>
                      <Briefcase size={16} color={wc ?? '#60A5FA'} />
                    </View>
                    <View style={s.workTitles}>
                      <Text style={s.workTitle} numberOfLines={1}>
                        {isColorMode && activeEventTitle ? activeEventTitle : 'W pracy'}
                      </Text>
                      <Text style={s.workSub}>
                        {timeLabel}{durLabel ? ` z ${durLabel}` : ''}
                        {isColorMode && monthWorkHours > 0 ? ` · ${monthWorkHours.toFixed(1)}h ten miesiąc` : ''}
                      </Text>
                    </View>
                    <View style={s.workEarnCol}>
                      <Text style={[s.workEarned, wc && { color: wc }]}>{totalEarned.toFixed(2)} zł</Text>
                      <Text style={[s.workRate, wc && { color: wc + 'AA' }]}>+{perSecond.toFixed(4)} zł/s</Text>
                    </View>
                  </View>
                  <View style={s.workProgressTrack}>
                    <View style={[s.workProgressFill, { width: `${progressPct * 100}%`, backgroundColor: wc ?? '#60A5FA' }]} />
                  </View>
                </View>
              </TouchableOpacity>
            );
          })()}

          {/* ══ STATS SECTION ══════════════════════════════════════════════════ */}

          <View style={s.sectionDivider}>
            <View style={s.sectionDividerLine} />
            <Text style={s.sectionDividerLabel}>STATYSTYKI</Text>
            <View style={s.sectionDividerLine} />
          </View>

          {/* ── Week nav ────────────────────────────────────────────────────── */}
          <View style={s.weekNav}>
            <TouchableOpacity onPress={() => setStatsWeekOffset(o => o - 1)} style={s.navBtn}>
              <ChevronLeft size={16} color={colors.text.secondary} />
            </TouchableOpacity>
            <Text style={s.weekNavLabel}>{weekLabel(statWeekDates)}</Text>
            <TouchableOpacity
              onPress={() => setStatsWeekOffset(o => Math.min(o + 1, 0))}
              style={[s.navBtn, statsWeekOffset >= 0 && s.navBtnDisabled]}
              disabled={statsWeekOffset >= 0}
            >
              <ChevronRight size={16} color={statsWeekOffset >= 0 ? colors.text.muted : colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* ── Mood timeline ───────────────────────────────────────────────── */}
          <View style={s.statCard}>
            <View style={s.statCardRow}>
              <Smile size={13} color={colors.text.muted} />
              <Text style={s.statCardLabel}>Nastrój tygodnia</Text>
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
            {loggedDays === 0 && <Text style={s.emptyMood}>Brak wpisów w tym tygodniu</Text>}

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

          {/* ── Mood heatmap ────────────────────────────────────────────────── */}
          <View style={s.statCard}>
            <View style={s.statCardRow}>
              <Calendar size={13} color={colors.text.muted} />
              <Text style={s.statCardLabel}>Kalendarz nastrojów</Text>
            </View>
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
            <View style={s.heatHeaderRow}>
              {DAY_SHORT.map(d => (
                <Text key={d} style={s.heatHeaderCell}>{d}</Text>
              ))}
            </View>
            <View style={s.heatGridWrap}>
              {heatGrid.map((week, ri) => (
                <View key={ri} style={s.heatWeekRow}>
                  {week.map((cell, ci) => {
                    if (!cell) return <View key={ci} style={s.heatCellEmpty} />;
                    const bg = cell.avgMood
                      ? moodColor(cell.avgMood) + '55'
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
                          cell.avgMood ? { color: moodColor(cell.avgMood), fontWeight: '700' } : cell.isToday ? { color: colors.accent.blue } : null,
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

          {/* ── Finances week ───────────────────────────────────────────────── */}
          {(weekTotal > 0 || weekInc > 0) && (() => {
            const displayList = weekFinExpanded
              ? (weekFinFoodOnly ? weekFoodExpenses : weekAllExpenses)
              : bigExpenses;
            return (
              <View style={s.statCard}>
                <TouchableOpacity
                  style={s.statCardRow}
                  onPress={() => { setWeekFinExpanded(e => !e); if (!weekFinExpanded) setWeekFinFoodOnly(false); }}
                  activeOpacity={0.7}
                >
                  <Wallet size={13} color={colors.text.muted} />
                  <Text style={s.statCardLabel}>Tydzień finansowo</Text>
                  {weekFinExpanded
                    ? <ChevronRight size={13} color={colors.text.muted} style={{ transform: [{ rotate: '90deg' }] }} />
                    : <ChevronRight size={13} color={colors.text.muted} />
                  }
                </TouchableOpacity>
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
                {weekFinExpanded && (
                  <View style={s.finFilterRow}>
                    <TouchableOpacity
                      style={[s.finFilterBtn, !weekFinFoodOnly && s.finFilterBtnActive]}
                      onPress={() => setWeekFinFoodOnly(false)}
                      activeOpacity={0.7}
                    >
                      <Text style={[s.finFilterText, !weekFinFoodOnly && s.finFilterTextActive]}>Wszystkie</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                      style={[s.finFilterBtn, weekFinFoodOnly && s.finFilterBtnActive]}
                      onPress={() => setWeekFinFoodOnly(true)}
                      activeOpacity={0.7}
                    >
                      <ShoppingCart size={10} color={weekFinFoodOnly ? colors.accent.green : colors.text.muted} />
                      <Text style={[s.finFilterText, weekFinFoodOnly && { color: colors.accent.green, fontWeight: '700' }]}>Jedzenie</Text>
                    </TouchableOpacity>
                  </View>
                )}
                {displayList.length > 0 && (
                  <View style={s.bigExpSection}>
                    {displayList.map(e => (
                      <View key={e.id} style={s.bigExpRow}>
                        <Text style={s.bigExpDate}>{e.date.slice(5, 10).replace('-', '.')}</Text>
                        <Text style={s.bigExpNote} numberOfLines={1}>{e.storeName || e.note || e.category}</Text>
                        <Text style={[s.bigExpAmt, { color: colors.text.primary }]}>
                          -{e.amount.toFixed(0)} zł
                        </Text>
                      </View>
                    ))}
                    {!weekFinExpanded && weekAllExpenses.length > bigExpenses.length && (
                      <TouchableOpacity onPress={() => setWeekFinExpanded(true)} style={s.showMoreBtn}>
                        <Text style={s.showMoreText}>+ {weekAllExpenses.length - bigExpenses.length} więcej</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
                {weekFinExpanded && displayList.length === 0 && (
                  <Text style={s.emptyMood}>Brak wydatków{weekFinFoodOnly ? ' na jedzenie' : ''} w tym tygodniu</Text>
                )}
                {weekSweets > 0 && weekFood > 0 && (
                  <Text style={s.finNote}>
                    Słodycze: {weekSweets.toFixed(0)} zł ({Math.round(weekSweets / weekFood * 100)}% jedzenia tego tygodnia)
                  </Text>
                )}
              </View>
            );
          })()}

          {/* ── Google Calendar: dziś + jutro ──────────────────────────────── */}
          {(gcalToday.length > 0 || gcalTomorrow.length > 0) && (
            <View style={s.statCard}>
              <View style={s.statCardRow}>
                <CalendarDays size={13} color={colors.text.muted} />
                <Text style={s.statCardLabel}>Google Kalendarz</Text>
              </View>
              {gcalToday.length > 0 && (
                <>
                  <Text style={s.gcalDayLabel}>Dziś</Text>
                  {gcalToday.map(e => (
                    <View key={e.id} style={s.gcalRow}>
                      <View style={[s.gcalDot, { backgroundColor: e.color ?? '#039BE5' }]} />
                      {e.startTime ? <Text style={s.gcalTime}>{e.startTime}</Text> : null}
                      <Text style={s.gcalTitle} numberOfLines={1}>{e.title}</Text>
                    </View>
                  ))}
                </>
              )}
              {gcalTomorrow.length > 0 && (
                <>
                  <Text style={[s.gcalDayLabel, { marginTop: gcalToday.length > 0 ? 8 : 0 }]}>Jutro</Text>
                  {gcalTomorrow.map(e => (
                    <View key={e.id} style={s.gcalRow}>
                      <View style={[s.gcalDot, { backgroundColor: e.color ?? '#039BE5' }]} />
                      {e.startTime ? <Text style={s.gcalTime}>{e.startTime}</Text> : null}
                      <Text style={s.gcalTitle} numberOfLines={1}>{e.title}</Text>
                    </View>
                  ))}
                </>
              )}
            </View>
          )}

          {/* ── 8-week overview ─────────────────────────────────────────────── */}
          <View style={s.statCard}>
            <View style={s.statCardRow}>
              <Text style={s.statCardLabel}>Ostatnie {WEEKS_BACK} tygodni</Text>
              <View style={s.waveToggleRow}>
                <TouchableOpacity
                  style={[s.waveToggleBtn, waveTab === 'food' && s.waveToggleBtnActive]}
                  onPress={() => setWaveTab('food')}
                  activeOpacity={0.7}
                >
                  <Text style={[s.waveToggleText, waveTab === 'food' && { color: colors.accent.green, fontWeight: '700' }]}>Jedzenie</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.waveToggleBtn, waveTab === 'sweets' && s.waveToggleBtnActive]}
                  onPress={() => setWaveTab('sweets')}
                  activeOpacity={0.7}
                >
                  <Text style={[s.waveToggleText, waveTab === 'sweets' && { color: colors.accent.amber, fontWeight: '700' }]}>Słodycze</Text>
                </TouchableOpacity>
              </View>
            </View>
            <View style={s.waveChartWrap}>
              <WaveChart
                data={weekOverview.map(w => waveTab === 'food' ? w.food : w.sweets)}
                color={waveTab === 'food' ? colors.accent.green : colors.accent.amber}
                dotColors={weekOverview.map(w => w.avgMood ? moodColor(w.avgMood) : null)}
              />
              <View style={s.waveLabels}>
                {weekOverview.map((w, i) => (
                  <TouchableOpacity
                    key={i}
                    onPress={() => setStatsWeekOffset(w.offset)}
                    style={s.waveLabelBtn}
                    activeOpacity={0.7}
                  >
                    <Text style={[s.waveLabel, w.isCurrent && { color: colors.text.primary, fontWeight: '700' }]} numberOfLines={1}>
                      {w.label.slice(0, 5)}
                    </Text>
                    <Text style={[s.waveAmt, { color: waveTab === 'food' ? colors.accent.green : colors.accent.amber }]}>
                      {(waveTab === 'food' ? w.food : w.sweets) > 0
                        ? `${(waveTab === 'food' ? w.food : w.sweets).toFixed(0)}`
                        : '—'}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          </View>

          {/* ── Reports ─────────────────────────────────────────────────────── */}
          <View style={s.statCard}>
            <TouchableOpacity
              style={s.statCardRow}
              onPress={() => setReportsOpen(o => !o)}
              activeOpacity={0.7}
            >
              <FileText size={13} color={colors.text.muted} />
              <Text style={s.statCardLabel}>Raporty</Text>
              <View style={{ flex: 1 }} />
              <ChevronRight
                size={13} color={colors.text.muted}
                style={reportsOpen ? { transform: [{ rotate: '90deg' }] } : undefined}
              />
            </TouchableOpacity>

            {reportsOpen && (
              <>
            <View style={s.reportTabRow}>
              {(['weekly', 'monthly', 'yearly'] as const).map(tab => (
                <TouchableOpacity
                  key={tab}
                  style={[s.reportTabBtn, reportTab === tab && s.reportTabBtnActive]}
                  onPress={() => setReportTab(tab)}
                  activeOpacity={0.7}
                >
                  <Text style={[s.reportTabText, reportTab === tab && s.reportTabTextActive]}>
                    {tab === 'weekly' ? 'Tygodniowe' : tab === 'monthly' ? 'Miesięczne' : 'Roczne'}
                  </Text>
                </TouchableOpacity>
              ))}
            </View>

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
              </>
            )}
          </View>

        </ScrollView>

        <MoodCheckInModal visible={modalVisible} onClose={closeCheckIn} existingEntry={null} />

        {/* ── Subscription payment confirmation ─────────────────────────── */}
        {currentPayment && (
          <Modal visible transparent animationType="fade" onRequestClose={handlePaymentNo}>
            <View style={s.payOverlay}>
              <View style={s.payCard}>
                <View style={s.payIconWrap}>
                  <CreditCard size={24} color={colors.accent.blue} />
                </View>
                <Text style={s.payTitle}>Płatność należna</Text>
                <Text style={s.payName}>{currentPayment.name}</Text>
                <Text style={s.payAmount}>{currentPayment.amount.toFixed(2)} zł</Text>
                <Text style={s.payHint}>Czy opłaciłeś tę subskrypcję?</Text>
                {paymentQueue.length > 1 && (
                  <Text style={s.payQueue}>+{paymentQueue.length - 1} kolejnych</Text>
                )}
                <View style={s.payBtns}>
                  <PressableScale onPress={handlePaymentNo} style={s.payBtnNo}>
                    <Text style={s.payBtnNoText}>Nie teraz</Text>
                  </PressableScale>
                  <PressableScale
                    onPress={handlePaymentYes}
                    style={[s.payBtnYes, paymentConfirming && { opacity: 0.6 }]}
                    disabled={paymentConfirming}
                  >
                    <Check size={16} color={colors.bg.primary} />
                    <Text style={s.payBtnYesText}>{paymentConfirming ? 'Zapisuję...' : 'Tak, opłaciłem'}</Text>
                  </PressableScale>
                </View>
              </View>
            </View>
          </Modal>
        )}
      </Animated.View>
    </SafeAreaView>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  safe:   { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 140 },

  // Header
  header:     { gap: spacing[2], marginBottom: spacing[1] },
  headerTop:  { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between' },
  headerBtns: { flexDirection: 'row', gap: spacing[2], marginTop: 6 },
  dateText:   { fontSize: 11, color: colors.text.muted, marginBottom: 2, letterSpacing: 0.2 },
  greeting:   { fontSize: 30, fontWeight: '800', letterSpacing: -0.5, lineHeight: 34 },
  iconBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  humorRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    backgroundColor: colors.bg.card, borderRadius: radius.md,
    paddingHorizontal: spacing[3], paddingVertical: spacing[2],
    borderWidth: 1, borderColor: colors.border.subtle,
  },
  humorText: { flex: 1, fontSize: 12, color: colors.text.secondary, fontStyle: 'italic' },
  moodDot:   { width: 7, height: 7, borderRadius: 4 },

  // Card (dashboard cards)
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: colors.border.default,
    padding: spacing[4],
  },

  // Tasks
  taskHeader:   { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginBottom: spacing[3] },
  taskCountRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  taskBig:      { fontSize: 44, fontWeight: '900', color: colors.text.primary, letterSpacing: -2, lineHeight: 46 },
  taskLabel:    { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
  taskSub:      { fontSize: 11, fontWeight: '500' },
  doneBadge: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    backgroundColor: colors.accent.green + '14',
    paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full,
  },
  doneBadgeText: { fontSize: 10, fontWeight: '600', color: colors.accent.green },
  seeAll:        { flexDirection: 'row', alignItems: 'center', gap: 2 },
  seeAllText:    { fontSize: 11, color: colors.text.muted },
  progressRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  progressTrack: { flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.full, overflow: 'hidden' },
  progressFill:  { height: 3, borderRadius: radius.full },
  progressLabel: { fontSize: 10, color: colors.text.muted, minWidth: 28 },
  addRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingTop: spacing[3], marginTop: spacing[2],
    borderTopWidth: 1, borderTopColor: colors.border.subtle,
  },
  addText: { fontSize: 12, color: colors.text.muted },

  // Stats row (4 tiles)
  statsRow: { flexDirection: 'row', gap: spacing[2] },
  statTile: {
    flex: 1, alignItems: 'center', gap: 3,
    backgroundColor: colors.bg.card, borderRadius: radius.lg,
    borderWidth: 1, borderColor: colors.border.default,
    paddingVertical: spacing[3], paddingHorizontal: spacing[2],
  },
  statVal:    { fontSize: 15, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3 },
  statLabel:  { fontSize: 9, fontWeight: '500', color: colors.text.muted, textAlign: 'center' },
  budgetBar:  { width: '100%', height: 2, backgroundColor: 'rgba(255,255,255,0.08)', borderRadius: 1, overflow: 'hidden', marginTop: 2 },
  budgetFill: { height: 2, borderRadius: 1 },

  // Mood island
  moodIsland: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    borderRadius: 28, borderWidth: 1,
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  moodPill: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3,
  },
  moodPillLabel:  { fontSize: 9, fontWeight: '800', letterSpacing: 1.5 },
  moodStreakBadge:{ flexDirection: 'row', alignItems: 'center', gap: 2, borderRadius: radius.full, paddingHorizontal: 5, paddingVertical: 2 },
  moodStreakText: { fontSize: 9, fontWeight: '800' },
  moodDots:      { flexDirection: 'row', gap: 4, alignItems: 'center', marginLeft: spacing[1] },
  moodDotSm:     { width: 7, height: 7, borderRadius: 4 },
  moodEmpty:     { fontSize: 11, color: colors.text.muted },
  moodAvg:       { fontSize: 15, fontWeight: '800', letterSpacing: -0.3, marginRight: spacing[1] },
  checkInBtn:    { paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  checkInText:   { fontSize: 11, fontWeight: '600' },

  // Streak card
  streakCard: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    borderRadius: radius.xl, borderWidth: 1,
    paddingVertical: spacing[3], paddingHorizontal: spacing[4],
  },
  streakFlame:    { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  streakBody:     { flex: 1, flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  streakNum:      { fontSize: 36, fontWeight: '900', letterSpacing: -1, lineHeight: 38 },
  streakLabel:    { fontSize: 11, color: colors.text.muted, marginBottom: 1 },
  streakName:     { fontSize: 13, fontWeight: '700', color: colors.text.secondary, maxWidth: 120 },
  streakBadge:    { paddingHorizontal: spacing[2], paddingVertical: 4, borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.06)' },
  streakBadgeText:{ fontSize: 10, fontWeight: '700' },

  // Habits
  cardRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginBottom: spacing[3] },
  cardLabel:     { fontSize: 10, fontWeight: '700', color: colors.text.muted, letterSpacing: 1.5, textTransform: 'uppercase' },
  habitsBubbles: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  habitBubble: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    paddingHorizontal: spacing[3], paddingVertical: 6,
    borderRadius: radius.full, borderWidth: 1,
    borderColor: colors.border.default, backgroundColor: colors.bg.elevated,
  },
  habitText:     { fontSize: 12, fontWeight: '500', color: colors.text.secondary },
  habitMore:     { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: colors.border.default, backgroundColor: colors.bg.elevated },
  habitMoreText: { fontSize: 12, color: colors.text.muted },

  // Section divider
  sectionDivider:     { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginVertical: spacing[1] },
  sectionDividerLine: { flex: 1, height: 1, backgroundColor: 'rgba(255,255,255,0.06)' },
  sectionDividerLabel:{ fontSize: 9, fontWeight: '700', color: colors.text.muted, letterSpacing: 2 },

  // Week nav (stats)
  weekNav:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  navBtn: {
    width: 32, height: 32, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  navBtnDisabled: { opacity: 0.3 },
  weekNavLabel:   { flex: 1, textAlign: 'center', fontSize: 14, fontWeight: '700', color: colors.text.primary },

  // Stats cards
  statCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    padding: spacing[4], gap: spacing[3],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.05)',
  },
  statCardRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  statCardLabel: { fontSize: 12, color: colors.text.secondary, flex: 1, fontWeight: '600' },
  statCardMeta:  { fontSize: 10, color: colors.text.muted },

  // Trend badge
  trendBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full },
  trendText:  { fontSize: 10, fontWeight: '600' },

  // Day grid
  dayGrid: { flexDirection: 'row', gap: 4 },
  dayCol:  { flex: 1, alignItems: 'center', gap: 4 },
  dayLabel:{ fontSize: 10, color: colors.text.muted, fontWeight: '500' },
  dayDot:  { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  dayVal:  { fontSize: 11, fontWeight: '800', color: '#fff' },
  countBadge: {
    position: 'absolute', top: 22, right: 0,
    width: 14, height: 14, borderRadius: 7,
    backgroundColor: colors.bg.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  countBadgeText: { fontSize: 8, fontWeight: '700', color: colors.text.muted },
  energyBar:  { width: 28, height: 3, borderRadius: 2, overflow: 'hidden', backgroundColor: 'rgba(255,255,255,0.05)' },
  energyFill: { height: 3, borderRadius: 2 },

  // Summary row
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

  // Finances
  finRow:       { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  finStat:      { flex: 1, alignItems: 'center', gap: 2 },
  finVal:       { fontSize: 20, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.3 },
  finLabel:     { fontSize: 10, color: colors.text.muted },
  finSep:       { width: 1, height: 28, backgroundColor: 'rgba(255,255,255,0.06)' },
  finIconRow:   { flexDirection: 'row', alignItems: 'baseline', gap: 3 },
  bigExpSection:{ gap: 4, paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  bigExpRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  bigExpDate:   { fontSize: 10, color: colors.text.muted, width: 32 },
  bigExpNote:   { flex: 1, fontSize: 12, color: colors.text.secondary },
  bigExpAmt:    { fontSize: 12, fontWeight: '700' },
  finNote:      { fontSize: 11, color: colors.text.muted, paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },

  // Events
  eventRow:   { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 4 },
  eventDot:   { width: 8, height: 8, borderRadius: 4 },
  eventDate:  { fontSize: 10, color: colors.text.muted, width: 32 },
  eventTitle: { flex: 1, fontSize: 13, color: colors.text.secondary },

  gcalDayLabel: { fontSize: 9, fontWeight: '700', color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8, marginBottom: 4 },
  gcalRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  gcalDot:      { width: 6, height: 6, borderRadius: 3 },
  gcalTime:     { fontSize: 10, color: colors.text.muted, width: 36, fontWeight: '600' },
  gcalTitle:    { flex: 1, fontSize: 13, color: colors.text.secondary },

  // 8-week overview
  overviewRow:        { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 6 },
  overviewRowCurrent: { backgroundColor: 'rgba(255,255,255,0.03)', borderRadius: radius.md, paddingHorizontal: spacing[2] },
  overviewLabel:      { width: 80, fontSize: 11, color: colors.text.muted },
  overviewDot:        { width: 32, height: 32, borderRadius: 16, alignItems: 'center', justifyContent: 'center' },
  overviewDotVal:     { fontSize: 10, fontWeight: '800', color: '#fff' },
  overviewAmtCol:     { width: 42, alignItems: 'flex-end', gap: 1 },
  overviewAmt:        { fontSize: 9, fontWeight: '600' },
  overviewWeather:    { flexDirection: 'row', alignItems: 'center', gap: 2, width: 34 },
  overviewTemp:       { fontSize: 9, fontWeight: '600', color: colors.text.muted },
  overviewLegend:     { flexDirection: 'row', gap: spacing[3], alignItems: 'center', paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: 'rgba(255,255,255,0.05)' },
  legendItem:         { flexDirection: 'row', alignItems: 'center', gap: 6 },
  legendDot:          { width: 8, height: 8, borderRadius: 4 },
  legendText:         { fontSize: 10, color: colors.text.muted },

  // Mood heatmap
  heatNavRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  heatNavBtn:     { width: 28, height: 28, borderRadius: radius.sm, backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default, alignItems: 'center', justifyContent: 'center' },
  heatMonthLabel: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  heatHeaderRow:  { flexDirection: 'row', gap: 3 },
  heatHeaderCell: { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '600', color: colors.text.muted, textTransform: 'uppercase' },
  heatGridWrap:   { gap: 3 },
  heatWeekRow:    { flexDirection: 'row', gap: 3 },
  heatCell:       { flex: 1, aspectRatio: 1, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  heatCellEmpty:  { flex: 1, aspectRatio: 1 },
  heatCellToday:  { borderWidth: 1.5, borderColor: colors.accent.blue + '80' },
  heatCellDay:    { fontSize: 10, fontWeight: '500', color: 'rgba(255,255,255,0.25)' },
  heatCellDayFilled: { color: '#fff', fontWeight: '700' },

  // Correlation
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
  reportTabRow:       { flexDirection: 'row', gap: spacing[2] },
  reportTabBtn:       { flex: 1, paddingVertical: spacing[2], borderRadius: radius.md, borderWidth: 1, borderColor: colors.border.default, alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.03)' },
  reportTabBtnActive: { backgroundColor: colors.accent.purple + '20', borderColor: colors.accent.purple + '50' },
  reportTabText:      { fontSize: 11, fontWeight: '500', color: colors.text.muted },
  reportTabTextActive:{ color: colors.accent.purple, fontWeight: '700' },

  // Reports
  genBtn:     { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: colors.accent.purple + '44', backgroundColor: colors.accent.purple + '10' },
  genBtnText: { fontSize: 10, fontWeight: '600', color: colors.accent.purple },

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

  // Work earnings widget
  workCard: {
    backgroundColor: 'rgba(96,165,250,0.08)', borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(96,165,250,0.25)',
    padding: spacing[4], gap: spacing[3],
  },
  workHeader:       { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  workIconWrap:     { width: 40, height: 40, borderRadius: 20, backgroundColor: 'rgba(96,165,250,0.15)', alignItems: 'center', justifyContent: 'center' },
  workTitles:       { flex: 1, gap: 2 },
  workTitle:        { fontSize: 14, fontWeight: '700', color: colors.text.primary },
  workSub:          { fontSize: 11, color: colors.text.muted },
  workEarnCol:      { alignItems: 'flex-end', gap: 2 },
  workEarned:       { fontSize: 20, fontWeight: '900', color: '#60A5FA', letterSpacing: -0.5 },
  workRate:         { fontSize: 10, color: 'rgba(96,165,250,0.7)' },
  workProgressTrack:{ height: 3, backgroundColor: 'rgba(96,165,250,0.15)', borderRadius: 2, overflow: 'hidden' },
  workProgressFill: { height: 3, backgroundColor: '#60A5FA', borderRadius: 2 },

  // Wave chart
  waveToggleRow:      { flexDirection: 'row', gap: spacing[1] },
  waveToggleBtn:      { paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)' },
  waveToggleBtnActive:{ backgroundColor: 'rgba(255,255,255,0.06)', borderColor: 'rgba(255,255,255,0.14)' },
  waveToggleText:     { fontSize: 10, fontWeight: '500', color: colors.text.muted },
  waveChartWrap:      { gap: spacing[1] },
  waveLabels:         { flexDirection: 'row' },
  waveLabelBtn:       { flex: 1, alignItems: 'center', gap: 1 },
  waveLabel:          { fontSize: 8, color: colors.text.muted },
  waveAmt:            { fontSize: 9, fontWeight: '700' },

  // Finances expanded
  finFilterRow:       { flexDirection: 'row', gap: spacing[2] },
  finFilterBtn:       { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: spacing[3], paddingVertical: 4, borderRadius: radius.full, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)', backgroundColor: 'rgba(255,255,255,0.03)' },
  finFilterBtnActive: { borderColor: colors.accent.blue + '50', backgroundColor: colors.accent.blue + '10' },
  finFilterText:      { fontSize: 11, color: colors.text.muted, fontWeight: '500' },
  finFilterTextActive:{ color: colors.accent.blue, fontWeight: '700' },
  showMoreBtn:        { paddingVertical: 6, alignItems: 'center' },
  showMoreText:       { fontSize: 11, color: colors.text.muted },

  // Payment modal
  payOverlay: {
    flex: 1, backgroundColor: 'rgba(0,0,0,0.75)',
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: spacing[6],
  },
  payCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    borderWidth: 1, borderColor: colors.border.default,
    padding: spacing[6], alignItems: 'center', gap: spacing[2], width: '100%',
  },
  payIconWrap: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: colors.accent.blue + '18',
    alignItems: 'center', justifyContent: 'center', marginBottom: spacing[1],
  },
  payTitle:   { fontSize: 10, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  payName:    { fontSize: 20, fontWeight: '800', color: colors.text.primary, textAlign: 'center' },
  payAmount:  { fontSize: 28, fontWeight: '800', color: colors.accent.blue },
  payHint:    { fontSize: 14, color: colors.text.secondary, textAlign: 'center', marginTop: spacing[1] },
  payQueue:   { fontSize: 11, color: colors.text.muted, marginTop: 2 },
  payBtns: { flexDirection: 'row', gap: spacing[3], marginTop: spacing[3], width: '100%' },
  payBtnNo: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.md,
    backgroundColor: colors.bg.elevated, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center',
  },
  payBtnNoText: { fontSize: 13, color: colors.text.secondary, fontWeight: '600' },
  payBtnYes: {
    flex: 2, paddingVertical: spacing[3], borderRadius: radius.md,
    backgroundColor: colors.accent.blue, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: spacing[2],
  },
  payBtnYesText: { fontSize: 13, color: colors.bg.primary, fontWeight: '700' },
});
