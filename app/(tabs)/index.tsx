import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal,
  RefreshControl, TouchableOpacity, Animated,
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import {
  CheckCircle2, ChevronRight, ChevronLeft,
  TrendingUp, TrendingDown, Flame, Smile, Zap,
  CalendarDays, Settings, Wallet,
  Briefcase, CreditCard, Check, Plus,
  Timer, CloudSun, Thermometer,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { usePomodoroStore } from '@/store/pomodoroStore';
import MoodCheckInModal from '@/components/mood/MoodCheckInModal';
import { useExpenses } from '@/hooks/useExpenses';
import { useExpensesStore } from '@/store/expensesStore';
import { useTasks } from '@/hooks/useTasks';
import { useMoodCheckIn } from '@/hooks/useMoodCheckIn';
import { useMoodStore } from '@/store/moodStore';
import { useCalendarStore } from '@/store/calendarStore';
import {
  MOOD_COLORS, MOOD_LABELS, ENERGY_COLORS, ENERGY_LABELS,
  MoodEntry, MoodLevel, Expense, Subscription, BillingCycle,
} from '@/types';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { getBudgets, MonthlyBudgets } from '@/utils/budgets';
import { colors, spacing, radius } from '@/theme';
import { useWorkStore } from '@/store/workStore';
import { useWorkEarnings } from '@/hooks/useWorkEarnings';
import { workService } from '@/services/workService';
import { useTabSwipe } from '@/hooks/useTabSwipe';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { googleCalendarService } from '@/services/googleCalendarService';
import { expensesService } from '@/services/expensesService';
import { moodService } from '@/services/moodService';
import { haptic } from '@/utils/haptics';

// ─── Constants ────────────────────────────────────────────────────────────────

const SWEETS_TAGS = ['słodycze'];
const MONTH_SHORT = ['Sty','Lut','Mar','Kwi','Maj','Cze','Lip','Sie','Wrz','Paź','Lis','Gru'];
const WEEKS_BACK  = 8;

const MOOD_EMOJIS: Record<MoodLevel, string> = {
  1: '😩', 2: '😕', 3: '😐', 4: '😊', 5: '🤩',
};

const HUMOR: Record<number, string[]> = {
  1: ['Przetrwanie to też sukces.', 'Gorzej nie będzie. Chyba.', 'Dzień jak z horroru. Żyjesz.'],
  2: ['Niskie obroty, rozumiem.', 'Nie jest świetnie. Jest. To wystarczy.', 'Słabo. Ale jutro nowy dzień.'],
  3: ['Standard. Middle ground.', 'Ani super, ani kiepsko.', 'Normalna energia.'],
  4: ['Dobry nastrój? Wykorzystaj go.', 'Całkiem nieźle! Nie psuj tego.', 'Rzadki widok. Doceniam.'],
  5: ['5/5 — dziś możesz wszystko.', 'Energia max. To wykorzystaj.', 'SZCZYT MOŻLIWOŚCI.'],
};

// ─── Weather ──────────────────────────────────────────────────────────────────

const WMO_DESC: Record<number, string> = {
  0: 'Bezchmurnie', 1: 'Głównie jasno', 2: 'Częściowe zachmurzenie', 3: 'Pochmurno',
  45: 'Mgła', 48: 'Mgła z szronem',
  51: 'Mżawka', 53: 'Mżawka', 55: 'Gęsta mżawka',
  61: 'Lekki deszcz', 63: 'Deszcz', 65: 'Ulewny deszcz',
  71: 'Lekki śnieg', 73: 'Śnieg', 75: 'Gęsty śnieg',
  80: 'Przelotny deszcz', 81: 'Deszcz przelotny', 82: 'Gwałtowny deszcz',
  95: 'Burza',
};

interface WeatherData { temp: number; desc: string; wmo: number; }

async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const { latitude, longitude } = loc.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current_weather=true&temperature_unit=celsius`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const cw = data.current_weather;
    return { temp: Math.round(cw.temperature), desc: WMO_DESC[cw.weathercode] ?? 'Nieznana pogoda', wmo: cw.weathercode };
  } catch { return null; }
}

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
    const d = new Date(mon); d.setDate(mon.getDate() + i); return toStr(d);
  });
}
function weekLabel(dates: string[]) {
  const from = new Date(dates[0]), to = new Date(dates[6]);
  const fM = MONTH_SHORT[from.getMonth()], tM = MONTH_SHORT[to.getMonth()];
  return from.getMonth() === to.getMonth()
    ? `${from.getDate()}–${to.getDate()} ${fM}`
    : `${from.getDate()} ${fM} – ${to.getDate()} ${tM}`;
}
function dayAvg(entries: MoodEntry[]) {
  if (!entries.length) return null;
  return {
    mood:   entries.reduce((a, b) => a + b.mood, 0) / entries.length as MoodLevel,
    energy: entries.reduce((a, b) => a + b.energy, 0) / entries.length as MoodLevel,
  };
}
function groceryTotal(expenses: Expense[], dates: string[]): number {
  const set = new Set(dates);
  return expenses.filter(e => (!e.type || e.type === 'expense') && e.category === 'groceries' && set.has(e.date.slice(0, 10)))
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
  return expenses.filter(e => (!e.type || e.type === 'expense') && set.has(e.date.slice(0, 10)))
    .reduce((s, e) => s + e.amount, 0);
}
function weekIncome(expenses: Expense[], dates: string[]): number {
  const set = new Set(dates);
  return expenses.filter(e => e.type === 'income' && set.has(e.date.slice(0, 10)))
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
function humorLine(mood?: number): string {
  if (mood === undefined) return 'Czysty start. Jak się czujesz?';
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

// ─── Wave chart ───────────────────────────────────────────────────────────────

const WAVE_W = 320;
const WAVE_H = 64;

function WaveChart({ data, color, dotColors }: { data: number[]; color: string; dotColors?: (string | null)[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * WAVE_W,
    y: WAVE_H - 6 - ((v / max) * (WAVE_H - 18)),
  }));
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const px = pts[i - 1].x, py = pts[i - 1].y, cx = pts[i].x, cy = pts[i].y;
    const cpx = (px + cx) / 2;
    line += ` C ${cpx.toFixed(1)} ${py.toFixed(1)}, ${cpx.toFixed(1)} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  const fill = `${line} L ${pts[pts.length - 1].x.toFixed(1)} ${WAVE_H} L ${pts[0].x.toFixed(1)} ${WAVE_H} Z`;
  const gradId = `wg_${color.replace('#', '')}`;
  return (
    <Svg width="100%" height={WAVE_H} viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Path d={fill} fill={`url(#${gradId})`} />
      <Path d={line} stroke={color} strokeWidth="1.8" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      {pts.map((p, i) => {
        const dc = dotColors?.[i] ?? color;
        return (
          <Path key={i}
            d={`M ${p.x.toFixed(1)} ${p.y.toFixed(1)} m -3.5 0 a 3.5 3.5 0 1 0 7 0 a 3.5 3.5 0 1 0 -7 0`}
            fill={dc} opacity={data[i] > 0 ? '1' : '0.2'}
          />
        );
      })}
    </Svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { panHandlers, animatedStyle } = useTabSwipe();
  const { color: accentColor, greeting, gradientTop } = useTimeAccent();

  // ── Stores & hooks ────────────────────────────────────────────────────────
  const pomodoro = usePomodoroStore();
  const { stats, isLoading: finLoading, reload: reloadFin } = useExpenses();
  const { expenses, setExpenses } = useExpensesStore();
  const { tasks, isLoading: tasksLoading, reload: reloadTasks } = useTasks();
  const { todayEntry, modalVisible, openCheckIn, closeCheckIn } = useMoodCheckIn();
  const { entries: moodEntries, setEntries: setMood, addEntry } = useMoodStore();
  const { events, gcalEvents, tasks: calTasks, setEvents, setGcalEvents } = useCalendarStore();
  const { subscriptions, update: updateSub } = useSubscriptions();
  const { shifts: workShifts, settings: workSettings, setShifts: setWorkShifts, setSettings: setWorkSettings } = useWorkStore();
  const [budgets, setBudgets]       = useState<MonthlyBudgets>({});
  const [finPeriod, setFinPeriod]   = useState<'week' | 'month'>('week');
  const [weather, setWeather]       = useState<WeatherData | null>(null);

  // ── Subscription payment queue ────────────────────────────────────────────
  const [paymentQueue, setPaymentQueue] = useState<Subscription[]>([]);
  const [paymentConfirming, setPaymentConfirming] = useState(false);
  const checkedSubs = useRef(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // ── Animations ────────────────────────────────────────────────────────────
  const blobScale   = useRef(new Animated.Value(1)).current;
  const blobOpacity = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    const loop = Animated.loop(
      Animated.parallel([
        Animated.sequence([
          Animated.timing(blobScale, { toValue: 1.25, duration: 3400, useNativeDriver: true }),
          Animated.timing(blobScale, { toValue: 0.85, duration: 3400, useNativeDriver: true }),
        ]),
        Animated.sequence([
          Animated.timing(blobOpacity, { toValue: 0.68, duration: 2600, useNativeDriver: true }),
          Animated.timing(blobOpacity, { toValue: 0.30, duration: 2600, useNativeDriver: true }),
        ]),
      ])
    );
    loop.start();
    return () => loop.stop();
  }, []);

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (events.length === 0) {
      import('@/services/calendarService').then(({ calendarService }) => {
        calendarService.getAllEvents().then(setEvents).catch(() => {});
      });
    }
    if (expenses.length === 0) expensesService.getAll().then(setExpenses).catch(() => {});
    if (moodEntries.length === 0) moodService.getAll().then(setMood).catch(() => {});
    getBudgets().then(setBudgets);
    fetchWeather().then(w => { if (w) setWeather(w); });
    workService.getSettings().then(setWorkSettings).catch(() => {});
    workService.getShifts(todayStr(), todayStr()).then(setWorkShifts).catch(() => {});
    googleCalendarService.getStoredToken().then(token => {
      if (token) googleCalendarService.fetchEvents(1, 14).then(evs => setGcalEvents(evs)).catch(() => {});
    });
  }, []);

  // ── Subscription check ────────────────────────────────────────────────────
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
        type: 'expense', amount: currentPayment.amount, currency: currentPayment.currency,
        category: currentPayment.category, tags: [], note: `Subskrypcja: ${currentPayment.name}`, date: todayS,
      });
      const next = advanceNextBillingDate(currentPayment.nextBillingDate, currentPayment.billingCycle);
      await updateSub(currentPayment.id, { nextBillingDate: next });
    } catch {}
    finally { setPaymentConfirming(false); setPaymentQueue(q => q.slice(1)); }
  }, [currentPayment, updateSub]);

  const handlePaymentNo = useCallback(() => setPaymentQueue(q => q.slice(1)), []);

  // ── Work tracking ─────────────────────────────────────────────────────────
  const allEvents  = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);
  const workEarnings = useWorkEarnings(workShifts, allEvents, workSettings, expenses);
  const wc = workSettings.workColor;

  useEffect(() => {
    if (!workSettings.workColor && !workSettings.workPrefix) return;
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
    const salaryIncome = wp2 ? expenses.find(e => e.type === 'income' && e.tags.some(t => t.toLowerCase() === wp2)) : null;
    const effectiveSalary = salaryIncome?.amount ?? workSettings.monthlySalary;
    const perSecond = hrs > 0 ? effectiveSalary / (hrs * 3600) : 0;
    import('@/services/notificationsService').then(({ notificationsService }) => {
      notificationsService.scheduleWorkShiftNotifications(workEvs, perSecond).catch(() => {});
    });
  }, [allEvents, workSettings]);

  // ── Quick mood handler ────────────────────────────────────────────────────
  const handleQuickMood = useCallback(async (level: MoodLevel) => {
    haptic.tap();
    if (todayEntry) { openCheckIn(); return; }
    try {
      const entry = await moodService.add({ date: todayStr(), mood: level, energy: 3, tags: [] });
      addEntry(entry);
    } catch {}
  }, [todayEntry, openCheckIn, addEntry]);

  // ── Derived data ──────────────────────────────────────────────────────────
  const today     = todayStr();
  const isLoading = finLoading || tasksLoading;
  const onRefresh = () => { reloadFin(); reloadTasks(); };

  const pendingTasks = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
  const todayTasks   = useMemo(() => pendingTasks.filter(t => t.deadline?.startsWith(today) || t.scheduledDate === today), [pendingTasks, today]);

  const tomorrow = useMemo(() => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return `${t.getFullYear()}-${pad(t.getMonth()+1).padStart(2,'0')}-${pad(t.getDate()).padStart(2,'0')}`;
  }, []);

  const gcalToday    = useMemo(() => gcalEvents.filter(e => e.date === today).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')), [gcalEvents, today]);
  const gcalTomorrow = useMemo(() => gcalEvents.filter(e => e.date === tomorrow).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')), [gcalEvents, tomorrow]);

  const nextDeadline = useMemo(() => {
    const upcoming = pendingTasks.filter(t => t.deadline).sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? ''))[0];
    if (!upcoming?.deadline) return null;
    const d = upcoming.deadline.split('T')[0];
    if (d === today) return { label: 'dziś', title: upcoming.title };
    const tom = (() => { const t = new Date(); t.setDate(t.getDate()+1); return `${t.getFullYear()}-${pad(t.getMonth()+1)}-${pad(t.getDate())}`; })();
    if (d === tom) return { label: 'jutro', title: upcoming.title };
    const [, m, dd] = d.split('-');
    return { label: `${parseInt(dd)}.${parseInt(m)}`, title: upcoming.title };
  }, [pendingTasks, today]);

  const moodStreak = useMemo(() => {
    const dates = [...new Set(moodEntries.map(e => e.date))].sort().reverse();
    if (!dates.length) return 0;
    const yest = (() => { const d = new Date(); d.setDate(d.getDate() - 1); return toStr(d); })();
    if (dates[0] !== today && dates[0] !== yest) return 0;
    let streak = 0;
    let cursor = new Date(dates[0]);
    for (const d of dates) {
      if (d === toStr(cursor)) { streak++; cursor.setDate(cursor.getDate() - 1); }
      else if (d < toStr(cursor)) break;
    }
    return streak;
  }, [moodEntries, today]);

  const moodByDay = useMemo(() => {
    const map: Record<string, MoodEntry[]> = {};
    for (const e of moodEntries) { if (!map[e.date]) map[e.date] = []; map[e.date].push(e); }
    return map;
  }, [moodEntries]);

  // ── Finance data ──────────────────────────────────────────────────────────
  const weekDates = useMemo(() => getWeekDates(weekOffset), [weekOffset]);

  const monthDates = useMemo(() => {
    const d = new Date(), year = d.getFullYear(), month = d.getMonth();
    const days = new Date(year, month + 1, 0).getDate();
    return Array.from({ length: days }, (_, i) => `${year}-${pad(month + 1)}-${pad(i + 1)}`);
  }, []);

  const activeDates = finPeriod === 'week' ? weekDates : monthDates;
  const weekTotal  = useMemo(() => allSpend(expenses, weekDates), [expenses, weekDates]);
  const weekFood   = useMemo(() => groceryTotal(expenses, weekDates), [expenses, weekDates]);
  const weekSweets = useMemo(() => sweetsTotal(expenses, weekDates), [expenses, weekDates]);
  const monthTotal  = useMemo(() => allSpend(expenses, monthDates), [expenses, monthDates]);
  const monthFood   = useMemo(() => groceryTotal(expenses, monthDates), [expenses, monthDates]);
  const monthSweets = useMemo(() => sweetsTotal(expenses, monthDates), [expenses, monthDates]);

  const displayTotal  = finPeriod === 'week' ? weekTotal  : monthTotal;
  const displayFood   = finPeriod === 'week' ? weekFood   : monthFood;
  const displaySweets = finPeriod === 'week' ? weekSweets : monthSweets;

  // ── 8-week overview (for wave chart) ─────────────────────────────────────
  const weekOverview = useMemo(() => {
    return Array.from({ length: WEEKS_BACK }, (_, i) => {
      const offset = weekOffset - (WEEKS_BACK - 1 - i);
      const dates  = getWeekDates(offset);
      const moodVals = dates.flatMap(d => (moodByDay[d] ?? []).map(e => e.mood));
      const avgMood  = moodVals.length ? moodVals.reduce((a, b) => a + b, 0) / moodVals.length : null;
      const sw = sweetsTotal(expenses, dates);
      return { offset, dates, avgMood, sweets: sw, isCurrent: offset === weekOffset };
    });
  }, [weekOffset, moodByDay, expenses]);

  const dateLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase());

  const humor = useMemo(() => humorLine(todayEntry?.mood), [todayEntry?.mood]);

  // ── Budget remaining ──────────────────────────────────────────────────────
  const budgetRemaining = useMemo(() => {
    const totalBudget = Object.values(budgets).reduce((s, v) => s + (v ?? 0), 0);
    if (totalBudget <= 0) return null;
    const remaining = totalBudget - stats.monthExpenses;
    return { remaining, totalBudget, pct: Math.min(1, stats.monthExpenses / totalBudget) };
  }, [budgets, stats.monthExpenses]);

  // ── Floating Lifebar ──────────────────────────────────────────────────────
  const lifebarState = useMemo(() => {
    // Priority 1: Pomodoro running
    if (pomodoro.isRunning && pomodoro.mode === 'work') {
      const m = Math.floor(pomodoro.remaining / 60);
      const sec = pomodoro.remaining % 60;
      return {
        label: pomodoro.taskTitle ?? 'Focus',
        value: `${m}:${String(sec).padStart(2, '0')}`,
        color: colors.accent.red,
        icon: 'timer' as const,
      };
    }
    // Priority 2: Current calendar event (started ≤ now, ends > now)
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    const currentEvent = gcalToday.find(e => {
      if (!e.startTime || !e.endTime) return false;
      const [sh, sm] = e.startTime.split(':').map(Number);
      const [eh, em] = e.endTime.split(':').map(Number);
      const startMins = sh * 60 + sm, endMins = eh * 60 + em;
      return nowMins >= startMins && nowMins < endMins;
    });
    if (currentEvent) {
      const [eh, em] = currentEvent.endTime!.split(':').map(Number);
      const endMins = eh * 60 + em;
      const left = endMins - nowMins;
      return {
        label: currentEvent.title,
        value: `kończy się za ${left} min`,
        color: currentEvent.color ?? colors.accent.blue,
        icon: 'calendar' as const,
      };
    }
    // Priority 3: Budget near limit (≥ 85%)
    if (budgetRemaining && budgetRemaining.pct >= 0.85) {
      const pct = Math.round(budgetRemaining.pct * 100);
      return {
        label: 'Budżet',
        value: `${pct}% wydane`,
        color: pct >= 100 ? colors.accent.red : colors.accent.amber,
        icon: 'wallet' as const,
      };
    }
    return null;
  }, [pomodoro.isRunning, pomodoro.remaining, pomodoro.mode, pomodoro.taskTitle, gcalToday, budgetRemaining]);

  // ─── Render ───────────────────────────────────────────────────────────────
  const moodBlobColor = todayEntry ? MOOD_COLORS[todayEntry.mood] : accentColor;

  return (
    <View style={s.root}>
      {/* Time-of-day gradient background */}
      <LinearGradient
        colors={[gradientTop, colors.bg.primary] as [string, string]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.4, y: 0 }}
        end={{ x: 0.6, y: 0.52 }}
      />

      <SafeAreaView style={s.safe} edges={['top']} {...panHandlers}>
        <Animated.View style={[{ flex: 1 }, animatedStyle]}>

          {/* Top bar */}
          <View style={s.topBar}>
            <View>
              <Text style={s.greetingText}>{greeting}</Text>
              <Text style={s.dateText}>{dateLabel}</Text>
            </View>
            <TouchableOpacity onPress={() => router.push('/settings' as any)} style={s.settingsBtn} activeOpacity={0.7}>
              <Settings size={17} color={colors.text.secondary} />
            </TouchableOpacity>
          </View>

          {/* ── Floating Lifebar ──────────────────────────────────── */}
          {lifebarState && (
            <View style={s.lifebar}>
              <View style={[s.lifebarDot, { backgroundColor: lifebarState.color }]} />
              <Text style={s.lifebarLabel} numberOfLines={1}>{lifebarState.label}</Text>
              <View style={{ flex: 1 }} />
              <Text style={[s.lifebarValue, { color: lifebarState.color }]}>{lifebarState.value}</Text>
            </View>
          )}

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.text.muted} />}
          >

            {/* ══ GLASSMORPHISM MOOD CARD ══════════════════════════════════ */}
            <TouchableOpacity
              onPress={() => openCheckIn()}
              activeOpacity={0.92}
              style={s.moodWrap}
            >
              {/* Animated color blob — blurred by BlurView above */}
              <Animated.View style={[s.moodBlob, {
                backgroundColor: moodBlobColor,
                transform: [{ scale: blobScale }],
                opacity: blobOpacity,
              }]} />

              <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill}>
                {/* Glass border overlay */}
                <View style={s.moodGlassBorder} />

                {todayEntry ? (
                  /* ── Filled state ───────────────────────────────────── */
                  <View style={s.moodFilled}>
                    <View style={s.moodTopRow}>
                      <Text style={[s.moodBigLabel, { color: moodBlobColor }]}>
                        {MOOD_LABELS[todayEntry.mood]}
                      </Text>
                      {moodStreak > 1 && (
                        <View style={s.streakPill}>
                          <Flame size={10} color={colors.accent.amber} />
                          <Text style={s.streakText}>{moodStreak}</Text>
                        </View>
                      )}
                    </View>

                    <View style={s.energyRow}>
                      <Zap size={11} color={ENERGY_COLORS[todayEntry.energy]} />
                      <Text style={[s.energyText, { color: ENERGY_COLORS[todayEntry.energy] }]}>
                        {ENERGY_LABELS[todayEntry.energy]}
                      </Text>
                      <View style={s.energyBarTrack}>
                        <View style={[s.energyBarFill, {
                          width: `${(todayEntry.energy / 5) * 100}%`,
                          backgroundColor: ENERGY_COLORS[todayEntry.energy],
                        }]} />
                      </View>
                    </View>

                    {todayEntry.note ? (
                      <Text style={s.moodNote} numberOfLines={2}>{todayEntry.note}</Text>
                    ) : null}
                    <Text style={s.humorText}>{humor}</Text>
                  </View>
                ) : (
                  /* ── Empty state — quick picker ─────────────────────── */
                  <View style={s.moodEmpty}>
                    <Smile size={20} color={colors.text.muted} />
                    <Text style={s.moodPrompt}>Jak się czujesz?</Text>
                    <View style={s.quickMoodRow}>
                      {([1, 2, 3, 4, 5] as MoodLevel[]).map(level => (
                        <TouchableOpacity
                          key={level}
                          style={[s.quickMoodBtn, { borderColor: MOOD_COLORS[level] + '40' }]}
                          onPress={(e) => { (e as any).stopPropagation?.(); handleQuickMood(level); }}
                          activeOpacity={0.75}
                        >
                          <Text style={s.quickMoodEmoji}>{MOOD_EMOJIS[level]}</Text>
                        </TouchableOpacity>
                      ))}
                    </View>
                  </View>
                )}
              </BlurView>
            </TouchableOpacity>

            {/* ══ WEATHER TILE ════════════════════════════════════════════ */}
            {weather && (
              <View style={s.weatherRow}>
                <CloudSun size={14} color={accentColor} />
                <Text style={s.weatherTemp}>{weather.temp}°C</Text>
                <Text style={s.weatherDesc}>{weather.desc}</Text>
              </View>
            )}

            {/* ══ TASKS + WORK ROW ═════════════════════════════════════════ */}
            <View style={s.miniRow}>
              {/* Tasks tile */}
              <TouchableOpacity
                style={[s.miniCard, { borderColor: colors.tabs.tasks + '30' }]}
                onPress={() => router.push('/(tabs)/tasks' as any)}
                activeOpacity={0.8}
              >
                <View style={s.miniCardTop}>
                  <CheckCircle2 size={13} color={colors.tabs.tasks} />
                  <Text style={[s.miniCardNum, { color: colors.tabs.tasks }]}>{pendingTasks.length}</Text>
                </View>
                <Text style={s.miniCardLabel}>{plTasks(pendingTasks.length)}</Text>
                {todayTasks.length > 0 && (
                  <Text style={[s.miniCardSub, { color: colors.tabs.tasks }]}>{todayTasks.length} na dziś</Text>
                )}
                {nextDeadline && (
                  <Text style={s.miniCardSub} numberOfLines={1}>→ {nextDeadline.label}</Text>
                )}
              </TouchableOpacity>

              {/* Work live tile (only when working) */}
              {workEarnings.isWorking ? (
                <View style={[s.miniCard, { borderColor: (wc ?? colors.accent.blue) + '30' }]}>
                  <View style={s.miniCardTop}>
                    <Briefcase size={13} color={wc ?? colors.accent.blue} />
                    <Text style={[s.miniCardNum, { color: wc ?? colors.accent.blue }]}>
                      {workEarnings.totalEarned.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={s.miniCardLabel}>zł zarobione</Text>
                  <View style={s.miniWorkTrack}>
                    <View style={[s.miniWorkFill, {
                      width: `${workEarnings.progressPct * 100}%`,
                      backgroundColor: wc ?? colors.accent.blue,
                    }]} />
                  </View>
                </View>
              ) : (
                /* Budget tile when not working */
                <TouchableOpacity
                  style={[s.miniCard, { borderColor: colors.tabs.finances + '30' }]}
                  onPress={() => router.push('/(tabs)/finances' as any)}
                  activeOpacity={0.8}
                >
                  <View style={s.miniCardTop}>
                    <Wallet size={13} color={colors.tabs.finances} />
                    <Text style={[s.miniCardNum, { color: budgetRemaining && budgetRemaining.remaining < 0 ? colors.accent.red : colors.tabs.finances }]}>
                      {budgetRemaining ? Math.abs(Math.round(budgetRemaining.remaining)) : Math.round(stats.monthExpenses)}
                    </Text>
                  </View>
                  <Text style={s.miniCardLabel}>
                    {budgetRemaining ? (budgetRemaining.remaining >= 0 ? 'zł zostało' : 'zł przekr.') : 'zł ten mies.'}
                  </Text>
                  {budgetRemaining && (
                    <View style={s.miniWorkTrack}>
                      <View style={[s.miniWorkFill, {
                        width: `${budgetRemaining.pct * 100}%`,
                        backgroundColor: budgetRemaining.pct >= 0.9 ? colors.accent.red : colors.tabs.finances,
                      }]} />
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* ══ WEEKLY / MONTHLY FINANCES ════════════════════════════════ */}
            <View style={s.card}>
              <View style={s.cardHeader}>
                <Wallet size={13} color={colors.tabs.finances} />
                <Text style={[s.cardTitle, { color: colors.tabs.finances }]}>
                  {finPeriod === 'week' ? 'Tydzień' : MONTH_SHORT[new Date().getMonth()]}
                </Text>

                {/* Period toggle */}
                <View style={s.periodToggle}>
                  <TouchableOpacity
                    style={[s.periodBtn, finPeriod === 'week' && s.periodBtnActive]}
                    onPress={() => setFinPeriod('week')}
                  >
                    <Text style={[s.periodBtnText, finPeriod === 'week' && { color: colors.tabs.finances }]}>7 dni</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.periodBtn, finPeriod === 'month' && s.periodBtnActive]}
                    onPress={() => setFinPeriod('month')}
                  >
                    <Text style={[s.periodBtnText, finPeriod === 'month' && { color: colors.tabs.finances }]}>Mies.</Text>
                  </TouchableOpacity>
                </View>

                {finPeriod === 'week' && (
                  <>
                    <TouchableOpacity onPress={() => setWeekOffset(o => o - 1)} style={s.navArrow}>
                      <ChevronLeft size={14} color={colors.text.muted} />
                    </TouchableOpacity>
                    <Text style={s.weekLabelText}>{weekLabel(weekDates)}</Text>
                    <TouchableOpacity
                      onPress={() => setWeekOffset(o => Math.min(o + 1, 0))}
                      disabled={weekOffset >= 0}
                      style={s.navArrow}
                    >
                      <ChevronRight size={14} color={weekOffset >= 0 ? colors.text.muted + '60' : colors.text.muted} />
                    </TouchableOpacity>
                  </>
                )}
              </View>

              <View style={s.finRow}>
                <View style={s.finStat}>
                  <Text style={s.finVal}>{displayTotal.toFixed(0)}</Text>
                  <Text style={s.finKey}>zł wydatki</Text>
                </View>
                <View style={s.finDivider} />
                <View style={s.finStat}>
                  <Text style={s.finVal}>{displayFood.toFixed(0)}</Text>
                  <Text style={s.finKey}>zł jedzenie</Text>
                  {displayTotal > 0 && (
                    <Text style={s.finPct}>{((displayFood / displayTotal) * 100).toFixed(0)}%</Text>
                  )}
                </View>
                <View style={s.finDivider} />
                <View style={s.finStat}>
                  <Text style={s.finVal}>{displaySweets.toFixed(0)}</Text>
                  <Text style={s.finKey}>zł słodycze</Text>
                  {displayFood > 0 && (
                    <Text style={s.finPct}>{((displaySweets / displayFood) * 100).toFixed(0)}% jed.</Text>
                  )}
                </View>
              </View>
            </View>

            {/* ══ 8-WEEK MOOD WAVE ════════════════════════════════════════ */}
            {weekOverview.filter(w => w.avgMood !== null).length >= 3 && (
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <Smile size={13} color={colors.text.muted} />
                  <Text style={s.cardTitle}>Nastrój — 8 tygodni</Text>
                  {weekOverview.find(w => w.isCurrent)?.avgMood != null && (
                    <View style={[s.avgPill, { backgroundColor: moodColor(weekOverview.find(w => w.isCurrent)!.avgMood!) + '25' }]}>
                      <Text style={[s.avgPillText, { color: moodColor(weekOverview.find(w => w.isCurrent)!.avgMood!) }]}>
                        {weekOverview.find(w => w.isCurrent)!.avgMood!.toFixed(1)}
                      </Text>
                    </View>
                  )}
                </View>
                <WaveChart
                  data={weekOverview.map(w => w.avgMood ?? 0)}
                  color={accentColor}
                  dotColors={weekOverview.map(w => w.avgMood ? moodColor(w.avgMood) : null)}
                />
                <View style={s.waveLabels}>
                  {weekOverview.map((w, i) => (
                    <Text key={i} style={[s.waveLabel, w.isCurrent && { color: accentColor, fontWeight: '700' }]}>
                      {weekLabel(w.dates).split(' ')[0]}
                    </Text>
                  ))}
                </View>
              </View>
            )}

            {/* ══ HUMOR TILE ══════════════════════════════════════════════ */}
            {todayEntry && (
              <View style={s.humorTile}>
                <Text style={s.humorTileEmoji}>{MOOD_EMOJIS[todayEntry.mood]}</Text>
                <Text style={s.humorTileText}>{humor}</Text>
              </View>
            )}

            {/* ══ MONTH TASK STATS ════════════════════════════════════════ */}
            {(() => {
              const now = new Date();
              const monthStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
              const monthDone   = calTasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(monthStr)).length;
              const monthActive = calTasks.filter(t => t.status !== 'done').length;
              if (monthDone + monthActive === 0) return null;
              return (
                <TouchableOpacity style={s.card} onPress={() => router.push('/(tabs)/tasks' as any)} activeOpacity={0.8}>
                  <View style={s.cardHeader}>
                    <CheckCircle2 size={13} color={colors.text.muted} />
                    <Text style={s.cardTitle}>{MONTH_SHORT[now.getMonth()]} — zadania</Text>
                    <ChevronRight size={13} color={colors.text.muted} style={{ marginLeft: 'auto' as any }} />
                  </View>
                  <View style={s.finRow}>
                    <View style={s.finStat}>
                      <Text style={[s.finVal, { color: colors.accent.green }]}>{monthDone}</Text>
                      <Text style={s.finKey}>ukończone</Text>
                    </View>
                    <View style={s.finDivider} />
                    <View style={s.finStat}>
                      <Text style={[s.finVal, { color: colors.tabs.tasks }]}>{monthActive}</Text>
                      <Text style={s.finKey}>aktywne</Text>
                    </View>
                    {todayTasks.length > 0 && (
                      <>
                        <View style={s.finDivider} />
                        <View style={s.finStat}>
                          <Text style={[s.finVal, { color: colors.accent.amber }]}>{todayTasks.length}</Text>
                          <Text style={s.finKey}>na dziś</Text>
                        </View>
                      </>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })()}

            {/* ══ GOOGLE CALENDAR ═════════════════════════════════════════ */}
            {(gcalToday.length > 0 || gcalTomorrow.length > 0) && (
              <View style={s.card}>
                <View style={s.cardHeader}>
                  <CalendarDays size={13} color={colors.text.muted} />
                  <Text style={s.cardTitle}>Google Kalendarz</Text>
                </View>
                {gcalToday.length > 0 && (
                  <>
                    <Text style={s.gcalDayLabel}>Dziś</Text>
                    {gcalToday.map(e => (
                      <View key={e.id} style={s.gcalRow}>
                        <View style={[s.gcalDot, { backgroundColor: e.color ?? colors.brand.gcal }]} />
                        {e.startTime ? <Text style={s.gcalTime}>{e.startTime}</Text> : null}
                        <Text style={s.gcalTitle} numberOfLines={1}>{e.title}</Text>
                      </View>
                    ))}
                  </>
                )}
                {gcalTomorrow.length > 0 && (
                  <>
                    <Text style={[s.gcalDayLabel, { marginTop: gcalToday.length > 0 ? spacing[2] : 0 }]}>Jutro</Text>
                    {gcalTomorrow.map(e => (
                      <View key={e.id} style={s.gcalRow}>
                        <View style={[s.gcalDot, { backgroundColor: e.color ?? colors.brand.gcal }]} />
                        {e.startTime ? <Text style={s.gcalTime}>{e.startTime}</Text> : null}
                        <Text style={s.gcalTitle} numberOfLines={1}>{e.title}</Text>
                      </View>
                    ))}
                  </>
                )}
              </View>
            )}

            <View style={{ height: 120 }} />
          </ScrollView>
        </Animated.View>
      </SafeAreaView>

      {/* Mood check-in modal */}
      <MoodCheckInModal visible={modalVisible} onClose={closeCheckIn} existingEntry={todayEntry ?? null} />

      {/* Subscription payment modal */}
      {currentPayment && (
        <Modal visible transparent animationType="fade" statusBarTranslucent onRequestClose={handlePaymentNo}>
          <View style={s.payOverlay}>
            <View style={s.payCard}>
              <View style={s.payIconWrap}>
                <CreditCard size={24} color={colors.tabs.tasks} />
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
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  root: { flex: 1, backgroundColor: colors.bg.primary },
  safe: { flex: 1 },

  // Top bar
  topBar: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between',
    paddingHorizontal: spacing[5], paddingTop: spacing[3], paddingBottom: spacing[2],
  },
  greetingText: {
    fontSize: 28, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.6,
  },
  dateText: { fontSize: 12, color: colors.text.muted, marginTop: 2 },
  settingsBtn: {
    width: 34, height: 34, borderRadius: radius.md,
    backgroundColor: colors.bg.card, borderWidth: 1, borderColor: colors.border.default,
    alignItems: 'center', justifyContent: 'center', marginTop: 4,
  },

  scroll: { paddingHorizontal: spacing[4], gap: spacing[3], paddingTop: spacing[2] },

  // ── Glassmorphism mood card ────────────────────────────────────────────────
  moodWrap: {
    height: 190,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  moodBlob: {
    position: 'absolute',
    width: 240,
    height: 240,
    borderRadius: 120,
    top: -40,
    left: '20%',
  },
  moodGlassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  moodFilled: {
    flex: 1, padding: spacing[5], justifyContent: 'center', gap: spacing[2],
  },
  moodTopRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  moodBigLabel: { fontSize: 26, fontWeight: '800', letterSpacing: -0.5 },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accent.amber + '20',
    borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3,
    borderWidth: 1, borderColor: colors.accent.amber + '40',
  },
  streakText: { fontSize: 11, fontWeight: '700', color: colors.accent.amber },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  energyText: { fontSize: 12, fontWeight: '600' },
  energyBarTrack: {
    flex: 1, height: 3, backgroundColor: 'rgba(255,255,255,0.12)', borderRadius: 2, overflow: 'hidden',
  },
  energyBarFill: { height: '100%', borderRadius: 2 },
  moodNote: { fontSize: 13, color: 'rgba(255,255,255,0.65)', fontStyle: 'italic', lineHeight: 18 },
  humorText: { fontSize: 11, color: 'rgba(255,255,255,0.40)' },

  moodEmpty: {
    flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], padding: spacing[5],
  },
  moodPrompt: { fontSize: 15, fontWeight: '600', color: colors.text.secondary },
  quickMoodRow: { flexDirection: 'row', gap: spacing[3] },
  quickMoodBtn: {
    width: 44, height: 44, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  quickMoodEmoji: { fontSize: 22 },

  // ── Mini row: tasks + work/budget ──────────────────────────────────────────
  miniRow: { flexDirection: 'row', gap: spacing[3] },
  miniCard: {
    flex: 1, backgroundColor: colors.bg.card,
    borderRadius: radius.xl, padding: spacing[4],
    borderWidth: 1, borderColor: colors.border.card,
    gap: spacing[1],
  },
  miniCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  miniCardNum: { fontSize: 22, fontWeight: '800', letterSpacing: -0.5 },
  miniCardLabel: { fontSize: 11, color: colors.text.muted },
  miniCardSub: { fontSize: 11, color: colors.text.muted },
  miniWorkTrack: {
    height: 2, backgroundColor: 'rgba(255,255,255,0.08)',
    borderRadius: 1, overflow: 'hidden', marginTop: spacing[1],
  },
  miniWorkFill: { height: '100%', borderRadius: 1 },

  // ── Floating Lifebar ──────────────────────────────────────────────────────
  lifebar: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    marginHorizontal: spacing[4], marginBottom: spacing[2],
    paddingHorizontal: spacing[4], paddingVertical: 10,
    backgroundColor: 'rgba(18,18,18,0.92)',
    borderRadius: radius.full,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.10)',
  },
  lifebarDot: { width: 6, height: 6, borderRadius: 3 },
  lifebarLabel: { fontSize: 12, fontWeight: '600', color: colors.text.secondary, flex: 1 },
  lifebarValue: { fontSize: 12, fontWeight: '700' },

  // ── Weather ────────────────────────────────────────────────────────────────
  weatherRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingHorizontal: spacing[2],
  },
  weatherTemp: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  weatherDesc: { fontSize: 12, color: colors.text.muted },

  // ── Humor tile ─────────────────────────────────────────────────────────────
  humorTile: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
  },
  humorTileEmoji: { fontSize: 20 },
  humorTileText: { flex: 1, fontSize: 13, fontWeight: '500', color: colors.text.secondary, lineHeight: 18, fontStyle: 'italic' },

  // ── Standard card ──────────────────────────────────────────────────────────
  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.card,
    gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardTitle: { fontSize: 12, fontWeight: '700', color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },

  // ── Period toggle ──────────────────────────────────────────────────────────
  periodToggle: { flexDirection: 'row', marginLeft: spacing[2], gap: 2, marginRight: 'auto' as any },
  periodBtn: {
    paddingHorizontal: spacing[2], paddingVertical: 3,
    borderRadius: radius.sm, borderWidth: 1, borderColor: 'transparent',
  },
  periodBtnActive: { borderColor: colors.tabs.finances + '50', backgroundColor: colors.tabs.finances + '15' },
  periodBtnText: { fontSize: 10, fontWeight: '600', color: colors.text.muted },
  navArrow: { padding: 2 },
  weekLabelText: { fontSize: 10, color: colors.text.muted },

  // ── Finance stats row ──────────────────────────────────────────────────────
  finRow: { flexDirection: 'row', alignItems: 'flex-start' },
  finStat: { flex: 1, alignItems: 'center', gap: 2 },
  finVal: { fontSize: 20, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  finKey: { fontSize: 10, color: colors.text.muted },
  finPct: { fontSize: 10, color: colors.tabs.finances, fontWeight: '600' },
  finDivider: { width: 1, height: 40, backgroundColor: colors.border.subtle, alignSelf: 'center' },

  // ── Wave chart labels ──────────────────────────────────────────────────────
  avgPill: {
    marginLeft: 'auto' as any, paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: radius.full,
  },
  avgPillText: { fontSize: 11, fontWeight: '700' },
  waveLabels: { flexDirection: 'row' },
  waveLabel: { flex: 1, fontSize: 8, color: colors.text.muted, textAlign: 'center' },

  // ── Google Calendar ────────────────────────────────────────────────────────
  gcalDayLabel: { fontSize: 9, fontWeight: '700', color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  gcalRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  gcalDot:      { width: 6, height: 6, borderRadius: 3 },
  gcalTime:     { fontSize: 10, color: colors.text.muted, width: 36, fontWeight: '600' },
  gcalTitle:    { flex: 1, fontSize: 13, color: colors.text.secondary },

  // ── Subscription payment modal ─────────────────────────────────────────────
  payOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
  payCard: {
    width: '100%', backgroundColor: colors.bg.card, borderRadius: radius.xl,
    padding: spacing[6], alignItems: 'center', gap: spacing[3],
    borderWidth: 1, borderColor: colors.border.default,
  },
  payIconWrap: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: colors.tabs.tasks + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  payTitle:  { fontSize: 10, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  payName:   { fontSize: 20, fontWeight: '800', color: colors.text.primary, textAlign: 'center' },
  payAmount: { fontSize: 28, fontWeight: '800', color: colors.tabs.tasks },
  payHint:   { fontSize: 14, color: colors.text.secondary, textAlign: 'center' },
  payQueue:  { fontSize: 11, color: colors.text.muted },
  payBtns:   { flexDirection: 'row', gap: spacing[3], width: '100%', marginTop: spacing[2] },
  payBtnNo: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.md,
    backgroundColor: colors.bg.elevated, alignItems: 'center',
    borderWidth: 1, borderColor: colors.border.default,
  },
  payBtnNoText: { fontSize: 14, fontWeight: '600', color: colors.text.secondary },
  payBtnYes: {
    flex: 2, paddingVertical: spacing[3], borderRadius: radius.md,
    backgroundColor: colors.tabs.tasks, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: spacing[2],
  },
  payBtnYesText: { fontSize: 14, fontWeight: '700', color: colors.bg.primary },
});
