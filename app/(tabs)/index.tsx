import { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal,
  RefreshControl, TouchableOpacity, Animated,
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText } from 'react-native-svg';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  CheckCircle2, ChevronRight, ChevronLeft,
  TrendingUp, TrendingDown, Flame, Smile, Zap,
  CalendarDays, Wallet,
  Briefcase, CreditCard, Check, Plus,
  Timer, CloudSun, Thermometer, FileText, BarChart2, Activity,
  Droplets, Dumbbell, BookOpen, Moon, Heart, Sun, Bike,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import { usePomodoroStore } from '@/store/pomodoroStore';
import MoodCheckInModal from '@/components/mood/MoodCheckInModal';
import { useExpenses } from '@/hooks/useExpenses';
import { useExpensesStore } from '@/store/expensesStore';
import { useTasks } from '@/hooks/useTasks';
import { useHabits } from '@/hooks/useHabits';
import { useMoodCheckIn } from '@/hooks/useMoodCheckIn';
import { useMoodStore } from '@/store/moodStore';
import { useCalendarStore } from '@/store/calendarStore';
import {
  MOOD_COLORS, MOOD_LABELS, ENERGY_COLORS, ENERGY_LABELS,
  MoodEntry, MoodLevel, Expense, Subscription, BillingCycle,
} from '@/types';
import { useSubscriptions } from '@/hooks/useSubscriptions';
import { getBudgets, MonthlyBudgets } from '@/utils/budgets';
import { getTagBudgetRules, TagBudgetRule } from '@/utils/tagBudgets';
import { setSunTimes, hydrateSunTimes, isoToDecimalHour } from '@/utils/sunTimes';
import { useStatsScope, inScope } from '@/store/statsScope';
import { colors, spacing, radius } from '@/theme';
import { useWorkStore } from '@/store/workStore';
import { useWorkEarnings } from '@/hooks/useWorkEarnings';
import { workService } from '@/services/workService';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { googleCalendarService } from '@/services/googleCalendarService';
import { expensesService } from '@/services/expensesService';
import { moodService } from '@/services/moodService';
import { haptic } from '@/utils/haptics';
import { getTodaySessions } from '@/utils/pomodoroHistory';
import AnimatedCardBg from '@/components/ui/AnimatedCardBg';

// ─── Constants ────────────────────────────────────────────────────────────────

const SWEETS_TAGS = ['słodycze'];

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
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}&current_weather=true&daily=sunrise,sunset&timezone=auto&temperature_unit=celsius`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const cw = data.current_weather;
    // Persist today's sunrise/sunset so the theme follows the real sun.
    const sr = data.daily?.sunrise?.[0];
    const ss = data.daily?.sunset?.[0];
    if (sr && ss) setSunTimes(isoToDecimalHour(sr), isoToDecimalHour(ss)).catch(() => {});
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
// Dynamic tag-limit message that escalates with how much of the limit is used.
function tagLimitMsg(pct: number): string {
  if (pct >= 1)    return 'Przekroczono limit';
  if (pct >= 0.85) return 'Hamuj! Limit prawie wyczerpany';
  if (pct >= 0.6)  return 'Robi się gorąco';
  if (pct >= 0.35) return 'Powoli, powoli';
  if (pct >= 0.15) return 'Kurde, raz Cię pokusiło';
  if (pct > 0)     return 'Na razie idzie dobrze';
  return 'Czysto, zero wydatków';
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

// ─── Wave charts ──────────────────────────────────────────────────────────────

const WAVE_W = 320;
const WAVE_H = 64;

function buildWavePath(data: number[], max: number) {
  const pts = data.map((v, i) => ({
    x: (i / (data.length - 1)) * WAVE_W,
    y: WAVE_H - 6 - ((v / max) * (WAVE_H - 18)),
  }));
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const px = pts[i-1].x, py = pts[i-1].y, cx = pts[i].x, cy = pts[i].y;
    const cpx = (px + cx) / 2;
    line += ` C ${cpx.toFixed(1)} ${py.toFixed(1)}, ${cpx.toFixed(1)} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  const fill = `${line} L ${pts[pts.length-1].x.toFixed(1)} ${WAVE_H} L ${pts[0].x.toFixed(1)} ${WAVE_H} Z`;
  return { line, fill, pts };
}

// Dual-line wave chart: data1 = primary (e.g. food), data2 = secondary (e.g. sweets)
function DualWaveChart({ data1, data2, color1, color2 }: {
  data1: number[]; data2: number[]; color1: string; color2: string;
}) {
  if (data1.length < 2) return null;
  const max = Math.max(...data1, ...data2, 1);
  const p1  = buildWavePath(data1, max);
  const p2  = buildWavePath(data2, max);
  return (
    <Svg width="100%" height={WAVE_H} viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id="dwg1" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color1} stopOpacity="0.28" />
          <Stop offset="1" stopColor={color1} stopOpacity="0" />
        </SvgLinearGradient>
        <SvgLinearGradient id="dwg2" x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color2} stopOpacity="0.16" />
          <Stop offset="1" stopColor={color2} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Path d={p1.fill} fill="url(#dwg1)" />
      <Path d={p2.fill} fill="url(#dwg2)" />
      <Path d={p1.line} stroke={color1} strokeWidth="2" fill="none" strokeLinejoin="round" strokeLinecap="round" />
      <Path d={p2.line} stroke={color2} strokeWidth="1.5" fill="none" strokeLinejoin="round" strokeLinecap="round" strokeDasharray="4 3" />
      {p1.pts.map((p, i) => (
        <Path key={`d1_${i}`}
          d={`M ${p.x.toFixed(1)} ${p.y.toFixed(1)} m -3 0 a 3 3 0 1 0 6 0 a 3 3 0 1 0 -6 0`}
          fill={color1} opacity={data1[i] > 0 ? '1' : '0.15'}
        />
      ))}
    </Svg>
  );
}

function WaveChart({ data, color, dotColors }: { data: number[]; color: string; dotColors?: (string | null)[] }) {
  if (data.length < 2) return null;
  const max = Math.max(...data, 1);
  const { line, fill, pts } = buildWavePath(data, max);
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

// ─── Mood mini calendar ────────────────────────────────────────────────────────

const MINI_DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

function MoodMiniCal({ moodByDay }: { moodByDay: Record<string, MoodEntry[]> }) {
  const now = new Date();
  const year  = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const today = now.getDate();
  const firstDow = (new Date(year, month, 1).getDay() + 6) % 7; // Mon=0
  const p2 = (n: number) => String(n).padStart(2, '0');

  const cells: (number | null)[] = [
    ...Array(firstDow).fill(null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];
  while (cells.length % 7 !== 0) cells.push(null);

  const rows: (number | null)[][] = [];
  for (let i = 0; i < cells.length; i += 7) rows.push(cells.slice(i, i + 7));

  return (
    <View style={{ gap: 4 }}>
      <View style={{ flexDirection: 'row' }}>
        {MINI_DAYS.map(d => (
          <View key={d} style={{ flex: 1, alignItems: 'center' }}>
            <Text style={{ fontSize: 7, fontWeight: '700', color: colors.text.muted, letterSpacing: 0.4 }}>{d}</Text>
          </View>
        ))}
      </View>
      {rows.map((row, ri) => (
        <View key={ri} style={{ flexDirection: 'row' }}>
          {row.map((day, ci) => {
            if (!day) return <View key={ci} style={{ flex: 1 }} />;
            const dateStr = `${year}-${p2(month + 1)}-${p2(day)}`;
            const entries = moodByDay[dateStr] ?? [];
            const avgM = entries.length ? entries.reduce((a, b) => a + b.mood, 0) / entries.length : null;
            const mc = avgM != null ? moodColor(avgM) : null;
            const isT = day === today;
            return (
              <View key={ci} style={{ flex: 1, alignItems: 'center', paddingVertical: 2 }}>
                <View style={{
                  width: 14, height: 14, borderRadius: 7,
                  backgroundColor: mc ? mc : 'rgba(255,255,255,0.05)',
                  opacity: mc ? 0.88 : 1,
                  borderWidth: isT ? 1.5 : 0,
                  borderColor: isT ? 'rgba(255,255,255,0.45)' : 'transparent',
                }} />
              </View>
            );
          })}
        </View>
      ))}
    </View>
  );
}

// ─── Gradient greeting (big bold title with a subtle top-light gradient) ───────

function GradientGreeting({ text, baseColor }: { text: string; baseColor: string }) {
  return (
    <Svg height={46} width="100%">
      <Defs>
        <SvgLinearGradient id="greetGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0"    stopColor="#FFFFFF"   stopOpacity="0.98" />
          <Stop offset="0.5"  stopColor="#FFFFFF"   stopOpacity="0.9" />
          <Stop offset="1"    stopColor={baseColor} stopOpacity="1" />
        </SvgLinearGradient>
      </Defs>
      <SvgText
        x={0}
        y={37}
        fontSize={40}
        fontWeight="900"
        fill="url(#greetGrad)"
        letterSpacing={-1.5}
      >
        {text}
      </SvgText>
    </Svg>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const { color: accentColor, greeting, gradientTop, cardBg, cardBgDark, timeOfDay } = useTimeAccent();

  // ── Stores & hooks ────────────────────────────────────────────────────────
  const pomodoro = usePomodoroStore();
  const { stats, isLoading: finLoading, reload: reloadFin } = useExpenses();
  const { expenses, setExpenses } = useExpensesStore();
  const scope = useStatsScope(s => s.scope);
  const toggleScope = useStatsScope(s => s.toggle);
  // Consumption stats (food, sweets, spending charts) use this scoped view;
  // "all" = whole household, "mine" = only what I paid. Synced with Finances.
  const scopedExpenses = useMemo(() => expenses.filter(e => inScope(e, scope)), [expenses, scope]);
  const { tasks, isLoading: tasksLoading, reload: reloadTasks, toggle: toggleTask } = useTasks();
  const { habits, todayDone: habitsDoneIds, toggle: toggleHabit, increment: incrementHabit, getTodayCount, getStreak } = useHabits();
  const { todayEntry, modalVisible, openCheckIn, closeCheckIn } = useMoodCheckIn();
  const { entries: moodEntries, setEntries: setMood, addEntry } = useMoodStore();
  const { events, gcalEvents, tasks: calTasks, setEvents, setGcalEvents } = useCalendarStore();
  const { subscriptions, update: updateSub } = useSubscriptions();
  const { shifts: workShifts, settings: workSettings, setShifts: setWorkShifts, setSettings: setWorkSettings } = useWorkStore();
  const [budgets, setBudgets]       = useState<MonthlyBudgets>({});
  const [tagRules, setTagRules]     = useState<TagBudgetRule[]>([]);
  const [finPeriod, setFinPeriod]   = useState<'week' | 'month'>('week');
  const [workHoursChart, setWorkHoursChart] = useState(false);
  const [weather, setWeather]       = useState<WeatherData | null>(null);
  const [todayPomCount, setTodayPomCount] = useState(0);

  // ── Subscription payment queue ────────────────────────────────────────────
  const [paymentQueue, setPaymentQueue] = useState<Subscription[]>([]);
  const [paymentConfirming, setPaymentConfirming] = useState(false);
  const checkedSubs = useRef(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // ── Animations ────────────────────────────────────────────────────────────
  // static blob — subtle color tint behind glassmorphism, no pulsing

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
    getTagBudgetRules().then(setTagRules).catch(() => {});
    hydrateSunTimes().then(() => fetchWeather()).then(w => { if (w) setWeather(w); });
    workService.getSettings().then(setWorkSettings).catch(() => {});
    workService.getShifts(todayStr(), todayStr()).then(setWorkShifts).catch(() => {});
    googleCalendarService.getStoredToken().then(token => {
      if (token) {
        googleCalendarService.fetchEvents(1, 14).then(evs => setGcalEvents(evs)).catch(() => {});
      } else {
        setGcalEvents([]);  // clear any cached events from a previous session
      }
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
    haptic.success();
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

  const handlePaymentNo = useCallback(() => { haptic.tap(); setPaymentQueue(q => q.slice(1)); }, []);

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

  // ── Pomodoro history ──────────────────────────────────────────────────────
  const loadPomSessions = useCallback(async () => {
    const sessions = await getTodaySessions();
    setTodayPomCount(sessions.length);
  }, []);

  useEffect(() => { loadPomSessions(); }, []);
  useFocusEffect(useCallback(() => {
    loadPomSessions();
    // Reload budgets + tag rules so a limit added in Settings shows immediately
    // (and persists across app restarts via their AsyncStorage backing).
    getBudgets().then(setBudgets).catch(() => {});
    getTagBudgetRules().then(setTagRules).catch(() => {});
  }, [loadPomSessions]));

  // ── Derived data ──────────────────────────────────────────────────────────
  const today     = todayStr();
  const isLoading = finLoading || tasksLoading;
  const onRefresh = () => { reloadFin(); reloadTasks(); loadPomSessions(); };

  const pendingTasks   = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
  const overdueTasks   = useMemo(() => pendingTasks.filter(t => t.deadline && t.deadline.split('T')[0] < today).sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')), [pendingTasks, today]);
  const todayTasks     = useMemo(() => pendingTasks.filter(t => t.deadline?.startsWith(today) || t.scheduledDate === today), [pendingTasks, today]);
  const doneToday      = useMemo(() => tasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(today)).length, [tasks, today]);

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
  const weekTotal  = useMemo(() => allSpend(scopedExpenses, weekDates), [scopedExpenses, weekDates]);
  const weekFood   = useMemo(() => groceryTotal(scopedExpenses, weekDates), [scopedExpenses, weekDates]);
  const weekSweets = useMemo(() => sweetsTotal(scopedExpenses, weekDates), [scopedExpenses, weekDates]);
  const monthTotal  = useMemo(() => allSpend(scopedExpenses, monthDates), [scopedExpenses, monthDates]);
  const monthFood   = useMemo(() => groceryTotal(scopedExpenses, monthDates), [scopedExpenses, monthDates]);
  const monthSweets = useMemo(() => sweetsTotal(scopedExpenses, monthDates), [scopedExpenses, monthDates]);

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
      const sw = sweetsTotal(scopedExpenses, dates);
      const food      = groceryTotal(scopedExpenses, dates);
      const totalSpend = allSpend(scopedExpenses, dates);
      return { offset, dates, avgMood, sweets: sw, food, totalSpend, isCurrent: offset === weekOffset };
    });
  }, [weekOffset, moodByDay, scopedExpenses]);

  // Average spending on FOOD per day-of-week (groceries only — other expenses
  // filtered out, per design). Data-driven from all historical grocery entries.
  const weekdayAvg = useMemo(() => {
    const days = ['Pon', 'Wt', 'Śr', 'Czw', 'Pt', 'Sob', 'Nd'];
    const totals  = [0, 0, 0, 0, 0, 0, 0];
    const dateSets: Set<string>[] = Array.from({ length: 7 }, () => new Set());
    for (const e of scopedExpenses) {
      if (e.type && e.type !== 'expense') continue;
      if (e.category !== 'groceries') continue; // food only
      if (!e.date) continue;
      const d = new Date(e.date + 'T12:00:00');
      if (isNaN(d.getTime())) continue;
      const dow = (d.getDay() + 6) % 7;
      totals[dow] += e.amount;
      dateSets[dow].add(e.date.slice(0, 10));
    }
    const avgs = totals.map((t, i) => dateSets[i].size > 0 ? t / dateSets[i].size : 0);
    const maxAvg = Math.max(...avgs, 1);
    return days.map((label, i) => ({ label, avg: avgs[i], pct: avgs[i] / maxAvg }));
  }, [scopedExpenses]);

  // Work hours per month over the last 6 months (from work events identified by
  // workColor / workPrefix). Data-driven — null if work tracking isn't set up.
  const workMonthly = useMemo(() => {
    const wcol = workSettings.workColor;
    const wp   = workSettings.workPrefix?.trim().toLowerCase();
    if (!wcol && !wp) return null;
    const isWork = (e: typeof allEvents[number]) => {
      if (!e.startTime || !e.endTime) return false;
      if (wcol && e.color === wcol) return true;
      if (wp && e.title?.toLowerCase().startsWith(wp)) return true;
      return false;
    };
    const dur = (e: typeof allEvents[number]) => {
      const [sh, sm] = e.startTime!.split(':').map(Number);
      const [eh, em] = e.endTime!.split(':').map(Number);
      return Math.max(0, (eh * 60 + em) - (sh * 60 + sm)) / 60;
    };
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx;
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const hours = allEvents
        .filter(e => isWork(e) && (e.date ?? '').slice(0, 7) === ym)
        .reduce((s, e) => s + dur(e), 0);
      return { ym, label: MONTH_SHORT[d.getMonth()], hours, isCurrent: i === 0 };
    });
    return { months, currentHours: months[5].hours };
  }, [allEvents, workSettings]);

  const dateLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' })
    .replace(/^\w/, c => c.toUpperCase());

  const humor = useMemo(() => humorLine(todayEntry?.mood), [todayEntry?.mood]);

  // ── Budget remaining (overall, for mini tile) ─────────────────────────────
  const budgetRemaining = useMemo(() => {
    const totalBudget = Object.values(budgets).reduce((s, v) => s + (v ?? 0), 0);
    if (totalBudget <= 0) return null;
    const remaining = totalBudget - stats.monthExpenses;
    return { remaining, totalBudget, pct: Math.min(1, stats.monthExpenses / totalBudget) };
  }, [budgets, stats.monthExpenses]);

  // ── Per-category budget alert (for warning card) ───────────────────────────
  const budgetAlertCard = useMemo(() => {
    const monthKey = today.slice(0, 7);
    const monthlySpend: Record<string, number> = {};
    for (const e of expenses) {
      if (e.type && e.type !== 'expense') continue;
      if (e.date.slice(0, 7) !== monthKey) continue;
      monthlySpend[e.category] = (monthlySpend[e.category] ?? 0) + e.amount;
    }
    const alerts = Object.entries(budgets)
      .filter(([, limit]) => limit != null && (limit as number) > 0)
      .map(([cat, limit]) => ({
        cat, spend: monthlySpend[cat] ?? 0, limit: limit as number,
        pct: (monthlySpend[cat] ?? 0) / (limit as number),
      }))
      .filter(a => a.pct >= 0.70)
      .sort((a, b) => b.pct - a.pct);
    return alerts[0] ?? null;
  }, [expenses, budgets, today]);

  // ── Tag limit bars (e.g. #słodycze) — ALWAYS shown with current % ───────────
  const tagLimits = useMemo(() => {
    const inPeriod = (date: string, period: 'week' | 'month') => {
      const d = date.slice(0, 10);
      if (period === 'month') return d.slice(0, 7) === today.slice(0, 7);
      return weekDates.includes(d);
    };
    return tagRules
      .filter(r => r.limit > 0)
      .map(rule => {
        let spend = 0;
        for (const e of scopedExpenses) {
          if (e.type === 'income') continue;
          if (!inPeriod(e.date, rule.period)) continue;
          if (e.tags?.includes(rule.tag)) spend += e.amount;
          else if (e.receiptItems?.some(it => it.tags.includes(rule.tag))) {
            spend += e.receiptItems
              .filter(it => it.tags.includes(rule.tag))
              .reduce((s, it) => s + it.price, 0);
          }
        }
        return { ...rule, spend, pct: spend / rule.limit };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [tagRules, scopedExpenses, today, weekDates]);

  // ── Floating Lifebar ──────────────────────────────────────────────────────
  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      {/* Time-of-day gradient background */}
      <LinearGradient
        colors={[gradientTop, colors.bg.primary] as [string, string]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.4, y: 0 }}
        end={{ x: 0.6, y: 0.52 }}
      />

      <SafeAreaView style={s.safe} edges={[]}>
        <View style={{ flex: 1 }}>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={s.scroll}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.text.muted} />}
          >

            {/* ══ MAIN GLASSMORPHISM CARD ══════════════════════════════════ */}
            <TouchableOpacity
              onPress={() => { haptic.tap(); openCheckIn(); }}
              activeOpacity={0.92}
              style={s.mainCard}
            >
              <AnimatedCardBg timeOfDay={timeOfDay} />

              <BlurView intensity={26} tint="dark" style={StyleSheet.absoluteFill}>
                {/* Soft bottom-up gradient inside card */}
                <LinearGradient
                  colors={['transparent', 'rgba(0,0,0,0.18)']}
                  style={StyleSheet.absoluteFill}
                  start={{ x: 0, y: 0 }} end={{ x: 0, y: 1 }}
                  pointerEvents="none"
                />
                <View style={s.moodGlassBorder} />

                <View style={s.mainCardInner}>
                  {/* Weather widget — top right */}
                  {weather && (
                    <View style={s.mainWeatherRow}>
                      <CloudSun size={22} color={accentColor} strokeWidth={1.6} />
                      <View style={s.mainWeatherInfo}>
                        <Text style={s.mainWeatherTemp}>{weather.temp}°C</Text>
                        <Text style={s.mainWeatherDesc}>{weather.desc.toUpperCase()}</Text>
                      </View>
                    </View>
                  )}

                  {/* Date label + greeting — compact stacked. Greeting tinted with
                      the time-of-day accent (cyan by day, blue by night). */}
                  <View style={s.mainGreetingBlock}>
                    <Text style={s.mainDate}>{dateLabel.toUpperCase()}</Text>
                    <GradientGreeting text={greeting.toUpperCase()} baseColor={accentColor} />
                  </View>

                  {/* Bottom: task count — BOLD */}
                  <Text style={s.mainTaskLine}>
                    {'Masz do zrobienia '}
                    <Text style={s.mainTaskBold}>
                      {`${todayTasks.length + overdueTasks.length} ${plTasks(todayTasks.length + overdueTasks.length)}`}
                    </Text>
                    {' na dziś.'}
                  </Text>
                </View>
              </BlurView>
            </TouchableOpacity>

            {/* ══ HUMOR LINE — after main card ════════════════════════════ */}
            {todayEntry && (
              <Text style={s.humorLine}>{humor}</Text>
            )}

            {/* ══ TAG LIMIT BARS (#słodycze itp.) — always visible with % ════ */}
            {tagLimits.map(t => {
              const pctClamped = Math.min(100, Math.round(t.pct * 100));
              const over = t.pct >= 1;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[s.budgetWarnCard, { backgroundColor: cardBgDark }]}
                  onPress={() => { haptic.tap(); router.push('/(tabs)/finances' as any); }}
                  activeOpacity={0.8}
                >
                  <Text style={s.budgetWarnText}>
                    {tagLimitMsg(t.pct)}{' · '}
                    <Text style={s.budgetWarnBold}>#{t.tag}</Text>
                    {'   '}
                    <Text style={[s.budgetWarnPct, over && { color: colors.accent.red }]}>
                      {Math.round(t.pct * 100)}%
                    </Text>
                  </Text>
                  <View style={s.budgetWarnTrack}>
                    <View style={[s.budgetWarnFill, {
                      width: `${pctClamped}%` as any,
                      backgroundColor: over ? colors.accent.red : accentColor,
                    }]} />
                  </View>
                </TouchableOpacity>
              );
            })}

            {/* ══ BUDGET WARNING CARD (category budgets) ════════════════════ */}
            {budgetAlertCard && (
              <TouchableOpacity
                style={[s.budgetWarnCard, { backgroundColor: cardBgDark }]}
                onPress={() => { haptic.tap(); router.push('/(tabs)/finances' as any); }}
                activeOpacity={0.8}
              >
                <Text style={s.budgetWarnText}>
                  {'Zbliżasz się do limitu wydatków '}
                  <Text style={s.budgetWarnBold}>#{budgetAlertCard.cat}</Text>
                  {'   '}
                  <Text style={s.budgetWarnPct}>{Math.round(budgetAlertCard.pct * 100)}%</Text>
                </Text>
                <View style={s.budgetWarnTrack}>
                  <View style={[s.budgetWarnFill, {
                    width: `${Math.min(100, budgetAlertCard.pct * 100)}%` as any,
                    backgroundColor: accentColor,
                  }]} />
                </View>
              </TouchableOpacity>
            )}

            {/* ══ TODAY ACTIVITY STRIP ════════════════════════════════════ */}
            {(doneToday > 0 || habitsDoneIds.length > 0 || !!todayEntry || todayPomCount > 0) && (() => {
              const items = [
                {
                  icon: <CheckCircle2 size={11} color={doneToday > 0 ? accentColor : colors.text.muted} strokeWidth={2} />,
                  label: `${doneToday} zad.`,
                  active: doneToday > 0,
                  color: accentColor,
                },
                {
                  icon: <Flame size={11} color={habitsDoneIds.length > 0 ? accentColor : colors.text.muted} />,
                  label: habits.length > 0 ? `${habitsDoneIds.length}/${habits.length}` : `${habitsDoneIds.length}`,
                  active: habitsDoneIds.length > 0,
                  color: accentColor,
                },
                {
                  icon: <Smile size={11} color={todayEntry ? accentColor : colors.text.muted} />,
                  label: todayEntry ? 'nastrój' : 'brak',
                  active: !!todayEntry,
                  color: accentColor,
                },
                {
                  icon: <Timer size={11} color={todayPomCount > 0 ? accentColor : colors.text.muted} />,
                  label: `${todayPomCount}×`,
                  active: todayPomCount > 0,
                  color: accentColor,
                },
              ];
              return (
                <View style={s.activityStrip}>
                  {items.map((item, i) => (
                    <View key={i} style={[s.activityBadge, item.active && { backgroundColor: item.color + '15', borderColor: item.color + '35' }]}>
                      {item.icon}
                      <Text style={[s.activityLabel, item.active && { color: item.color }]}>{item.label}</Text>
                    </View>
                  ))}
                </View>
              );
            })()}

            {/* ══ TASKS + WORK ROW ═════════════════════════════════════════ */}
            <View style={s.miniRow}>
              {/* Tasks tile */}
              <TouchableOpacity
                style={[s.miniCard, { backgroundColor: cardBgDark }]}
                onPress={() => router.push('/(tabs)/tasks' as any)}
                activeOpacity={0.8}
              >
                <View style={s.miniCardTop}>
                  <CheckCircle2 size={13} color={accentColor} />
                  <Text style={[s.miniCardNum, { color: '#FFFFFF' }]}>{pendingTasks.length}</Text>
                </View>
                <Text style={s.miniCardLabel}>{plTasks(pendingTasks.length)}</Text>
                {todayTasks.length > 0 && (
                  <Text style={[s.miniCardSub, { color: accentColor }]}>{todayTasks.length} na dziś</Text>
                )}
                {nextDeadline && (
                  <Text style={s.miniCardSub} numberOfLines={1}>→ {nextDeadline.label}</Text>
                )}
                {doneToday > 0 && (
                  <Text style={[s.miniCardSub, { color: accentColor }]}>✓ {doneToday} dziś</Text>
                )}
              </TouchableOpacity>

              {/* Work live tile (only when working) */}
              {workEarnings.isWorking ? (
                <View style={[s.miniCard, { backgroundColor: cardBgDark }]}>
                  <View style={s.miniCardTop}>
                    <Briefcase size={13} color={accentColor} />
                    <Text style={[s.miniCardNum, { color: '#FFFFFF' }]}>
                      {workEarnings.totalEarned.toFixed(2)}
                    </Text>
                  </View>
                  <Text style={s.miniCardLabel}>zł zarobione</Text>
                  <View style={s.miniWorkTrack}>
                    <View style={[s.miniWorkFill, {
                      width: `${workEarnings.progressPct * 100}%`,
                      backgroundColor: accentColor,
                    }]} />
                  </View>
                </View>
              ) : (
                /* Budget tile when not working */
                <TouchableOpacity
                  style={[s.miniCard, { backgroundColor: cardBgDark }]}
                  onPress={() => router.push('/(tabs)/finances' as any)}
                  activeOpacity={0.8}
                >
                  <View style={s.miniCardTop}>
                    <Wallet size={13} color={accentColor} />
                    <Text style={[s.miniCardNum, { color: '#FFFFFF' }]}>
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
                        backgroundColor: accentColor,
                      }]} />
                    </View>
                  )}
                </TouchableOpacity>
              )}
            </View>

            {/* ══ TODAY'S + OVERDUE TASKS ══════════════════════════════════ */}
            {(todayTasks.length > 0 || overdueTasks.length > 0) && (() => {
              const PORD: Record<string, number> = { high: 0, normal: 1, low: 2 };
              const todaySorted    = [...todayTasks].sort((a, b) => (PORD[a.priority] ?? 1) - (PORD[b.priority] ?? 1));
              const combined       = [...overdueTasks, ...todaySorted];
              const shown          = combined.slice(0, 4);
              const totalCount     = combined.length;
              const hasOverdue     = overdueTasks.length > 0;
              return (
                <View style={[s.todayCard, { backgroundColor: cardBgDark }, hasOverdue && { borderColor: colors.accent.red + '30' }]}>
                  <View style={s.todayHeader}>
                    <Check size={12} color={hasOverdue ? colors.accent.red : accentColor} strokeWidth={3} />
                    <Text style={[s.todayTitle, hasOverdue && { color: colors.accent.red }]}>
                      {hasOverdue ? 'ZALEGŁE & DZIŚ' : 'DZIŚ'}
                    </Text>
                    <View style={[s.todayBadge, hasOverdue && { backgroundColor: colors.accent.red + '20' }]}>
                      <Text style={[s.todayBadgeText, hasOverdue && { color: colors.accent.red }]}>{totalCount}</Text>
                    </View>
                    {totalCount > 4 && (
                      <TouchableOpacity onPress={() => { haptic.tap(); router.push('/(tabs)/tasks' as any); }} style={s.todayMore}>
                        <Text style={[s.todayMoreText, hasOverdue && { color: colors.accent.red }]}>+{totalCount - 4} więcej</Text>
                        <ChevronRight size={11} color={hasOverdue ? colors.accent.red : accentColor} />
                      </TouchableOpacity>
                    )}
                  </View>
                  {shown.map(task => {
                    const isOverdue = task.deadline && task.deadline.split('T')[0] < today;
                    const checkColor = isOverdue ? colors.accent.red : task.priority === 'high' ? colors.accent.red : accentColor;
                    return (
                      <TouchableOpacity
                        key={task.id}
                        style={s.todayRow}
                        onPress={() => { haptic.tap(); router.push('/(tabs)/tasks' as any); }}
                        activeOpacity={0.7}
                      >
                        <TouchableOpacity
                          style={[s.todayCheck, (isOverdue || task.priority === 'high') && s.todayCheckUrgent]}
                          onPress={() => { haptic.success(); toggleTask(task.id); }}
                          hitSlop={8}
                          activeOpacity={0.7}
                        >
                          <Check size={11} color={checkColor} strokeWidth={3} />
                        </TouchableOpacity>
                        <Text style={[s.todayRowTitle, (isOverdue || task.priority === 'high') && { color: colors.accent.red }]} numberOfLines={1}>
                          {task.title}
                        </Text>
                        {isOverdue && (
                          <View style={s.overduePill}>
                            <Text style={s.overduePillText}>ZALEGŁE</Text>
                          </View>
                        )}
                        {!isOverdue && task.priority === 'high' && (
                          <View style={s.urgentPill}>
                            <Text style={s.urgentPillText}>PILNE</Text>
                          </View>
                        )}
                        <TouchableOpacity
                          onPress={(e) => {
                            (e as any).stopPropagation?.();
                            haptic.tap();
                            pomodoro.startFor(task.id, task.title);
                            router.push('/pomodoro' as any);
                          }}
                          hitSlop={8}
                          activeOpacity={0.7}
                          style={s.todayPomBtn}
                        >
                          <Timer size={12} color='rgba(43,200,224,0.7)' />
                        </TouchableOpacity>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              );
            })()}

            {/* ══ TOOLS ROW ════════════════════════════════════════════════ */}
            <View style={s.toolsRow}>
              {([
                { label: 'Humor',     Icon: Smile,     route: '/(tabs)/mood', sub: todayEntry ? '✓' : null         },
                { label: 'Nawyki',    Icon: Flame,    route: '/habits',   sub: null                               },
                { label: 'Notatki',   Icon: FileText,  route: '/notes',    sub: null                               },
                { label: 'Skupienie', Icon: Activity,  route: '/focus',    sub: null                               },
                { label: 'Pomodoro',  Icon: Timer,     route: '/pomodoro', sub: todayPomCount > 0 ? `${todayPomCount}×` : null },
              ] as const).map(tool => (
                <TouchableOpacity
                  key={tool.route}
                  style={[s.toolTile, { backgroundColor: cardBgDark }]}
                  onPress={() => router.push(tool.route as any)}
                  activeOpacity={0.75}
                >
                  <View style={s.toolIcon}>
                    <tool.Icon size={18} color={accentColor} />
                  </View>
                  <Text style={s.toolLabel}>{tool.label}</Text>
                  {tool.sub && (
                    <Text style={[s.toolSub, { color: accentColor }]}>{tool.sub}</Text>
                  )}
                </TouchableOpacity>
              ))}
            </View>

            {/* ══ EVENING HABITS NUDGE ════════════════════════════════════ */}
            {habits.length > 0 && new Date().getHours() >= 17 && (() => {
              const notDone = habits.filter(h => !habitsDoneIds.includes(h.id));
              if (notDone.length === 0) return null;
              const maxStreak = Math.max(...notDone.map(h => getStreak(h.id)));
              return (
                <TouchableOpacity
                  style={s.habitsNudge}
                  onPress={() => { haptic.tap(); router.push('/habits' as any); }}
                  activeOpacity={0.8}
                >
                  <Flame size={14} color={accentColor} />
                  <View style={{ flex: 1 }}>
                    <Text style={s.habitsNudgeTitle}>
                      {notDone.length === 1 ? 'Jeszcze 1 nawyk dziś'
                        : `Jeszcze ${notDone.length} nawyki dziś`}
                      {maxStreak >= 2 ? ` · ${maxStreak}d seria!` : ''}
                    </Text>
                    <Text style={s.habitsNudgeSub} numberOfLines={1}>
                      {notDone.slice(0, 3).map(h => h.title).join(' · ')}{notDone.length > 3 ? ` +${notDone.length - 3}` : ''}
                    </Text>
                  </View>
                  <ChevronRight size={13} color={accentColor + '80'} />
                </TouchableOpacity>
              );
            })()}

            {/* ══ HABITS TODAY ════════════════════════════════════════════ */}
            {habits.length > 0 && (() => {
              const doneCount = habitsDoneIds.length;
              const allDone   = doneCount === habits.length;
              const pct       = habits.length > 0 ? doneCount / habits.length : 0;
              return (
                <TouchableOpacity
                  style={[s.habitsCard, { backgroundColor: cardBgDark }]}
                  onPress={() => router.push('/habits' as any)}
                  activeOpacity={0.8}
                >
                  <View style={s.habitsHeader}>
                    <View style={s.habitsHeaderLeft}>
                      <Flame size={13} color={accentColor} />
                      <Text style={[s.habitsTitle, allDone && { color: accentColor }]}>
                        {allDone ? 'Nawyki na dziś gotowe!' : 'Nawyki — dziś'}
                      </Text>
                    </View>
                    <Text style={[s.habitsBadge, allDone && { color: accentColor }]}>
                      {doneCount}/{habits.length}
                    </Text>
                  </View>

                  {/* Progress bar */}
                  <View style={s.habitsTrack}>
                    <View style={[s.habitsFill, {
                      width: `${pct * 100}%` as any,
                      backgroundColor: accentColor,
                    }]} />
                  </View>

                  {/* Per-habit quick dots */}
                  <View style={s.habitsDotsRow}>
                    {habits.slice(0, 7).map(h => {
                      const done = habitsDoneIds.includes(h.id);
                      const isCount = h.type === 'count';
                      const count = isCount ? getTodayCount(h.id) : 0;
                      const goal = h.dailyGoal ?? 1;
                      const HIcon = HABIT_ICON_MAP[h.icon] ?? Zap;
                      return (
                        <TouchableOpacity
                          key={h.id}
                          onPress={(e) => {
                            (e as any).stopPropagation?.();
                            if (isCount && !done) {
                              haptic.tap();
                              incrementHabit(h.id);
                            } else if (!isCount) {
                              haptic.tap();
                              toggleHabit(h.id);
                            }
                          }}
                          style={[
                            s.habitsDot,
                            { backgroundColor: done ? h.color + 'CC' : h.color + '20', borderColor: h.color + (done ? 'CC' : '40') },
                          ]}
                          activeOpacity={0.7}
                        >
                          <HIcon size={12} color={done ? colors.bg.primary : h.color} strokeWidth={2} />
                          {isCount && !done && count > 0 && (
                            <View style={[s.habitCountBadge, { backgroundColor: h.color }]}>
                              <Text style={s.habitCountText}>{count}</Text>
                            </View>
                          )}
                        </TouchableOpacity>
                      );
                    })}
                    {habits.length > 7 && (
                      <Text style={s.habitsMore}>+{habits.length - 7}</Text>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })()}

            {/* ══ STATS SCOPE TOGGLE (everyone vs only me) ════════════════ */}
            <View style={s.scopeRow}>
              <Text style={s.scopeLabel}>Statystyki:</Text>
              <View style={s.scopeToggle}>
                <TouchableOpacity
                  style={[s.scopeBtn, scope === 'all' && { backgroundColor: accentColor + '30' }]}
                  onPress={() => { haptic.tap(); if (scope !== 'all') toggleScope(); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.scopeBtnText, scope === 'all' && { color: accentColor }]}>Wszyscy</Text>
                </TouchableOpacity>
                <TouchableOpacity
                  style={[s.scopeBtn, scope === 'mine' && { backgroundColor: accentColor + '30' }]}
                  onPress={() => { haptic.tap(); if (scope !== 'mine') toggleScope(); }}
                  activeOpacity={0.8}
                >
                  <Text style={[s.scopeBtnText, scope === 'mine' && { color: accentColor }]}>Tylko ja</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* ══ WEEKLY / MONTHLY FINANCES ════════════════════════════════ */}
            <View style={[s.card, { backgroundColor: cardBgDark }]}>
              <View style={s.cardHeader}>
                <Wallet size={13} color={accentColor} />
                <Text style={[s.cardTitle]}>
                  {finPeriod === 'week' ? 'Tydzień' : MONTH_SHORT[new Date().getMonth()]}
                </Text>

                {/* Period toggle */}
                <View style={s.periodToggle}>
                  <TouchableOpacity
                    style={[s.periodBtn, finPeriod === 'week' && s.periodBtnActive]}
                    onPress={() => { haptic.tap(); setFinPeriod('week'); }}
                  >
                    <Text style={[s.periodBtnText, finPeriod === 'week' && { color: accentColor }]}>7 dni</Text>
                  </TouchableOpacity>
                  <TouchableOpacity
                    style={[s.periodBtn, finPeriod === 'month' && s.periodBtnActive]}
                    onPress={() => { haptic.tap(); setFinPeriod('month'); }}
                  >
                    <Text style={[s.periodBtnText, finPeriod === 'month' && { color: accentColor }]}>Mies.</Text>
                  </TouchableOpacity>
                </View>

                {finPeriod === 'week' && (
                  <>
                    <TouchableOpacity onPress={() => { haptic.tap(); setWeekOffset(o => o - 1); }} style={s.navArrow}>
                      <ChevronLeft size={14} color={colors.text.muted} />
                    </TouchableOpacity>
                    <Text style={s.weekLabelText}>{weekLabel(weekDates)}</Text>
                    <TouchableOpacity
                      onPress={() => { haptic.tap(); setWeekOffset(o => Math.min(o + 1, 0)); }}
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

            {/* ══ SŁODYCZE VS JEDZENIE — 8 TYGODNI ═══════════════════════ */}
            {weekOverview.filter(w => w.food > 0 || w.sweets > 0).length >= 2 && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Wallet size={13} color={accentColor} />
                  <Text style={[s.cardTitle]}>Słodycze vs jedzenie</Text>
                  <View style={s.dualLegend}>
                    <View style={s.dualLegendItem}>
                      <View style={[s.dualLegendLine, { backgroundColor: accentColor }]} />
                      <Text style={s.dualLegendLabel}>jedzenie</Text>
                    </View>
                    <View style={s.dualLegendItem}>
                      <View style={[s.dualLegendLine, { backgroundColor: accentColor, opacity: 0.4 }]} />
                      <Text style={s.dualLegendLabel}>słodycze</Text>
                    </View>
                  </View>
                </View>
                {/* Values above each point — food spend per week (rounded zł) */}
                <View style={s.waveValues}>
                  {weekOverview.map((w, i) => (
                    <Text key={i} style={[s.waveValue, w.isCurrent && { color: accentColor, fontWeight: '800' }]}>
                      {w.food > 0 ? Math.round(w.food) : ''}
                    </Text>
                  ))}
                </View>
                <DualWaveChart
                  data1={weekOverview.map(w => w.food)}
                  data2={weekOverview.map(w => w.sweets)}
                  color1={accentColor}
                  color2={accentColor + '60'}
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

            {/* ══ W JAKIE DNI WYDAJESZ NAJWIĘCEJ? ════════════════════════ */}
            {weekdayAvg.some(d => d.avg > 0) && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <BarChart2 size={13} color={accentColor} />
                  <Text style={[s.cardTitle]}>W jakie dni jesz najwięcej?</Text>
                  <Text style={[s.cardTitle, { marginLeft: 'auto' as any, color: colors.text.muted }]}>śr. zł/dzień</Text>
                </View>
                <View style={s.dowRow}>
                  {weekdayAvg.map((d, i) => {
                    const isWeekend = i >= 5;
                    const barColor = isWeekend ? accentColor + 'AA' : accentColor;
                    return (
                      <View key={i} style={s.dowCol}>
                        {d.avg > 0 && (
                          <Text style={[s.dowAvgLabel, { color: isWeekend ? accentColor + 'AA' : accentColor }]}>
                            {d.avg >= 100 ? `${(d.avg / 1).toFixed(0)}` : d.avg.toFixed(0)}
                          </Text>
                        )}
                        <View style={s.dowBar}>
                          <View style={[s.dowFill, {
                            height: Math.max(d.pct * 44, d.avg > 0 ? 4 : 0),
                            backgroundColor: barColor,
                            opacity: d.avg > 0 ? 1 : 0.1,
                          }]} />
                        </View>
                        <Text style={[s.dowLabel, isWeekend && { color: accentColor + 'AA' }]}>{d.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            )}

            {/* ══ GODZINY PRACY — miesiąc / 6 msc wave ════════════════════ */}
            {workMonthly && (workMonthly.currentHours > 0 || workMonthly.months.some(m => m.hours > 0)) && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Briefcase size={13} color={accentColor} />
                  <Text style={s.cardTitle}>Godziny pracy</Text>
                  <TouchableOpacity
                    onPress={() => { haptic.tap(); setWorkHoursChart(v => !v); }}
                    style={s.workToggle}
                    activeOpacity={0.8}
                  >
                    <Text style={[s.workToggleText, { color: accentColor }]}>
                      {workHoursChart ? 'Ten miesiąc' : 'Ostatnie 6 msc'}
                    </Text>
                  </TouchableOpacity>
                </View>

                {!workHoursChart ? (
                  <View style={s.workHoursRow}>
                    <Text style={[s.workHoursBig, { color: '#FFFFFF' }]}>
                      {workMonthly.currentHours.toFixed(0)}
                      <Text style={s.workHoursUnit}> h</Text>
                    </Text>
                    <Text style={s.workHoursSub}>przepracowane w tym miesiącu</Text>
                  </View>
                ) : (
                  <>
                    <View style={s.waveValues}>
                      {workMonthly.months.map((m, i) => (
                        <Text key={i} style={[s.waveValue, m.isCurrent && { color: accentColor, fontWeight: '800' }]}>
                          {m.hours > 0 ? `${Math.round(m.hours)}h` : ''}
                        </Text>
                      ))}
                    </View>
                    <WaveChart
                      data={workMonthly.months.map(m => m.hours)}
                      color={accentColor}
                    />
                    <View style={s.waveLabels}>
                      {workMonthly.months.map((m, i) => (
                        <Text key={i} style={[s.waveLabel, m.isCurrent && { color: accentColor, fontWeight: '700' }]}>
                          {m.label}
                        </Text>
                      ))}
                    </View>
                  </>
                )}
              </View>
            )}

            {/* ══ NASTRÓJ — KALENDARZ MIESIĄCA ════════════════════════════ */}
            {Object.keys(moodByDay).some(d => d.startsWith(`${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`)) && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Smile size={13} color={colors.text.muted} />
                  <Text style={s.cardTitle}>Nastrój — ten miesiąc</Text>
                </View>
                <MoodMiniCal moodByDay={moodByDay} />
              </View>
            )}

            {/* ══ 8-WEEK MOOD WAVE ════════════════════════════════════════ */}
            {weekOverview.filter(w => w.avgMood !== null).length >= 3 && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
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


            {/* ══ MONTH TASK STATS ════════════════════════════════════════ */}
            {(() => {
              const now = new Date();
              const monthStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
              const monthDone   = calTasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(monthStr)).length;
              const monthActive = calTasks.filter(t => t.status !== 'done').length;
              if (monthDone + monthActive === 0) return null;
              return (
                <TouchableOpacity style={[s.card, { backgroundColor: cardBgDark }]} onPress={() => router.push('/(tabs)/tasks' as any)} activeOpacity={0.8}>
                  <View style={s.cardHeader}>
                    <CheckCircle2 size={13} color={colors.text.muted} />
                    <Text style={s.cardTitle}>{MONTH_SHORT[now.getMonth()]} — zadania</Text>
                    <ChevronRight size={13} color={colors.text.muted} style={{ marginLeft: 'auto' as any }} />
                  </View>
                  <View style={s.finRow}>
                    <View style={s.finStat}>
                      <Text style={[s.finVal, { color: accentColor }]}>{monthDone}</Text>
                      <Text style={s.finKey}>ukończone</Text>
                    </View>
                    <View style={s.finDivider} />
                    <View style={s.finStat}>
                      <Text style={[s.finVal, { color: colors.accent.blue }]}>{monthActive}</Text>
                      <Text style={s.finKey}>aktywne</Text>
                    </View>
                    {todayTasks.length > 0 && (
                      <>
                        <View style={s.finDivider} />
                        <View style={s.finStat}>
                          <Text style={[s.finVal, { color: accentColor }]}>{todayTasks.length}</Text>
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
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
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

            <View style={{ height: 220 }} />
          </ScrollView>
        </View>
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

  scroll: { paddingHorizontal: spacing[4], gap: spacing[3], paddingTop: spacing[5] },

  // ── Main glassmorphism card (Figma) ───────────────────────────────────────
  mainCard: {
    height: 176,
    borderRadius: radius.xl,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: colors.border.glass,
  },
  moodBlob: {
    position: 'absolute',
    width: 280,
    height: 280,
    borderRadius: 140,
    top: -60,
    left: '15%',
  },
  moodGlassBorder: {
    ...StyleSheet.absoluteFillObject,
    borderRadius: radius.xl,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.10)',
  },
  mainCardInner: {
    flex: 1, paddingHorizontal: spacing[5], paddingVertical: spacing[4],
    justifyContent: 'space-between',
  },
  mainWeatherRow: {
    flexDirection: 'row', alignItems: 'center', gap: 8, alignSelf: 'flex-end',
  },
  mainWeatherInfo: { alignItems: 'flex-end' },
  mainWeatherTemp: {
    fontSize: 18, fontWeight: '700', color: colors.white, lineHeight: 20,
  },
  mainWeatherDesc: {
    fontSize: 8, fontWeight: '600', color: 'rgba(255,255,255,0.40)', letterSpacing: 0.6,
  },
  mainGreetingBlock: { gap: 0 },
  mainDate: {
    fontSize: 11, fontWeight: '500', color: 'rgba(255,255,255,0.40)', letterSpacing: 1,
  },
  mainGreeting: {
    fontSize: 40, fontWeight: '900', color: colors.white,
    letterSpacing: -2, lineHeight: 42,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  mainTaskLine: {
    fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.80)',
  },
  mainTaskBold: { fontWeight: '900', color: colors.white },
  moodStateRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
  },
  moodStateEmoji: { fontSize: 16 },
  moodStateName: { fontSize: 12, fontWeight: '700' },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: colors.accent.amber + '20',
    borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3,
    borderWidth: 1, borderColor: colors.accent.amber + '40',
  },
  streakText: { fontSize: 11, fontWeight: '700', color: colors.accent.amber },
  humorText: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },

  quickMoodRow: { flexDirection: 'row', gap: spacing[3] },
  quickMoodBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.06)',
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  quickMoodEmoji: { fontSize: 20 },

  // ── Budget warning card ───────────────────────────────────────────────────
  budgetWarnCard: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(81,102,245,0.25)',
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
    gap: spacing[3],
  },
  budgetWarnText: {
    fontSize: 13, fontWeight: '400', color: 'rgba(255,255,255,0.55)',
  },
  budgetWarnBold: { fontWeight: '800', color: '#FFFFFF' },
  budgetWarnPct: { fontWeight: '700', color: '#FFFFFF' },
  budgetWarnTrack: {
    height: 10, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 5, overflow: 'hidden',
  },
  budgetWarnFill: {
    height: '100%', borderRadius: 5,
    backgroundColor: '#5166F5',
  },

  // ── Humor line (below main card) ──────────────────────────────────────────
  humorLine: {
    fontSize: 12, fontStyle: 'italic',
    color: 'rgba(255,255,255,0.32)',
    textAlign: 'center',
    paddingHorizontal: spacing[2],
  },

  // ── Tools row ─────────────────────────────────────────────────────────────
  toolsRow: { flexDirection: 'row', gap: spacing[2] },
  toolTile: {
    flex: 1, alignItems: 'center', gap: spacing[2],
    borderRadius: radius.xl,
    borderWidth: 1, paddingVertical: spacing[3],
  },
  toolIcon: {
    width: 38, height: 38, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  toolLabel: { fontSize: 10, fontWeight: '700', color: colors.text.secondary, letterSpacing: 0.3 },
  toolSub: { fontSize: 11, fontWeight: '800', letterSpacing: -0.3 },

  // ── Evening habits nudge ──────────────────────────────────────────────────
  habitsNudge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.xl, padding: spacing[4],
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  habitsNudgeTitle: { fontSize: 13, fontWeight: '700', color: colors.text.primary, marginBottom: 2 },
  habitsNudgeSub: { fontSize: 11, color: colors.text.muted },

  // ── Habits today card ─────────────────────────────────────────────────────
  habitsCard: {
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
    padding: spacing[4], gap: spacing[3],
  },
  habitsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  habitsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  habitsTitle: { fontSize: 13, fontWeight: '700', color: colors.text.primary },
  habitsBadge: { fontSize: 14, fontWeight: '800', color: colors.text.secondary },
  habitsTrack: {
    height: 8, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 4, overflow: 'hidden',
  },
  habitsFill: { height: '100%', borderRadius: 4 },
  habitsDotsRow: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  habitsDot: {
    width: 32, height: 32, borderRadius: 16,
    borderWidth: 1.5,
    alignItems: 'center', justifyContent: 'center',
  },
  habitCountBadge: {
    position: 'absolute', bottom: -3, right: -3,
    minWidth: 14, height: 14, borderRadius: 7,
    alignItems: 'center', justifyContent: 'center',
    paddingHorizontal: 2,
  },
  habitCountText: { fontSize: 8, fontWeight: '800', color: colors.bg.primary },

  // ── Stats scope toggle (everyone / only me) ─────────────────────────────────
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  scopeLabel: { fontSize: 12, fontWeight: '600', color: colors.text.muted },
  scopeToggle: {
    flexDirection: 'row', gap: 2, marginLeft: 'auto',
    backgroundColor: 'rgba(255,255,255,0.05)', borderRadius: radius.full, padding: 2,
  },
  scopeBtn: { paddingHorizontal: spacing[3], paddingVertical: 5, borderRadius: radius.full },
  scopeBtnText: { fontSize: 11, fontWeight: '700', color: colors.text.muted },
  habitsMore: { fontSize: 11, color: colors.text.muted, alignSelf: 'center' },

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
  miniCardLabel: { fontSize: 11, fontWeight: '600', color: colors.text.secondary },
  miniCardSub: { fontSize: 11, color: colors.text.secondary },
  miniWorkTrack: {
    height: 6, backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: 3, overflow: 'hidden', marginTop: spacing[1],
  },
  miniWorkFill: { height: '100%', borderRadius: 3 },


  activityStrip: {
    flexDirection: 'row', gap: spacing[2],
  },
  activityBadge: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: spacing[2], paddingHorizontal: spacing[2],
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderRadius: radius.lg, borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
  },
  activityLabel: { fontSize: 10, fontWeight: '700', color: colors.text.muted },

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
  // ── Work hours widget ──────────────────────────────────────────────────────
  workToggle: {
    marginLeft: 'auto', paddingHorizontal: spacing[3], paddingVertical: 4,
    borderRadius: radius.full, backgroundColor: 'rgba(255,255,255,0.06)',
  },
  workToggleText: { fontSize: 10, fontWeight: '700' },
  workHoursRow: { marginTop: spacing[1], gap: 2 },
  workHoursBig: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  workHoursUnit: { fontSize: 16, fontWeight: '700', color: colors.text.muted },
  workHoursSub: { fontSize: 12, color: colors.text.secondary },

  card: {
    backgroundColor: colors.bg.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: colors.border.card,
    gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardTitle: { fontSize: 12, fontWeight: '800', color: '#FFFFFF', textTransform: 'uppercase', letterSpacing: 0.8 },

  // ── Period toggle ──────────────────────────────────────────────────────────
  periodToggle: { flexDirection: 'row', marginLeft: spacing[2], gap: 2, marginRight: 'auto' as any },
  periodBtn: {
    paddingHorizontal: spacing[2], paddingVertical: 3,
    borderRadius: radius.sm, borderWidth: 1, borderColor: 'transparent',
  },
  periodBtnActive: { borderColor: colors.accent.blue + '50', backgroundColor: colors.accent.blue + '15' },
  periodBtnText: { fontSize: 10, fontWeight: '600', color: colors.text.muted },
  navArrow: { padding: 2 },
  weekLabelText: { fontSize: 10, color: colors.text.muted },

  // ── Finance stats row ──────────────────────────────────────────────────────
  finRow: { flexDirection: 'row', alignItems: 'flex-start' },
  finStat: { flex: 1, alignItems: 'center', gap: 2 },
  finVal: { fontSize: 20, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  finKey: { fontSize: 10, color: colors.text.muted },
  finPct: { fontSize: 10, color: colors.accent.blue, fontWeight: '600' },
  finDivider: { width: 1, height: 40, backgroundColor: colors.border.subtle, alignSelf: 'center' },

  // ── Wave chart labels ──────────────────────────────────────────────────────
  avgPill: {
    marginLeft: 'auto' as any, paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: radius.full,
  },
  avgPillText: { fontSize: 11, fontWeight: '700' },
  waveLabels: { flexDirection: 'row' },
  waveLabel: { flex: 1, fontSize: 8, color: colors.text.muted, textAlign: 'center' },
  waveValues: { flexDirection: 'row', marginBottom: 2 },
  waveValue: { flex: 1, fontSize: 9, fontWeight: '700', color: colors.text.secondary, textAlign: 'center' },

  // ── Google Calendar ────────────────────────────────────────────────────────
  gcalDayLabel: { fontSize: 9, fontWeight: '700', color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  gcalRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  gcalDot:      { width: 6, height: 6, borderRadius: 3 },
  gcalTime:     { fontSize: 10, color: colors.text.muted, width: 36, fontWeight: '600' },
  gcalTitle:    { flex: 1, fontSize: 13, color: colors.text.secondary },

  // ── Today tasks strip ─────────────────────────────────────────────────────
  todayCard: {
    backgroundColor: colors.bg.card, borderRadius: radius.xl,
    padding: spacing[4], borderWidth: 1,
    borderColor: colors.accent.blue + '28',
    gap: 0,
  },
  todayHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingBottom: spacing[2],
  },
  todayTitle: {
    fontSize: 10, fontWeight: '800', color: colors.accent.blue, letterSpacing: 1.5,
  },
  todayBadge: {
    backgroundColor: colors.accent.blue + '20', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  todayBadgeText: { fontSize: 11, fontWeight: '800', color: colors.accent.blue },
  todayMore: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2 },
  todayMoreText: { fontSize: 11, fontWeight: '600', color: colors.accent.blue },
  todayRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: 7,
    borderTopWidth: 1, borderTopColor: colors.accent.blue + '12',
  },
  todayCheck: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: colors.accent.blue + '15',
    borderWidth: 1.5, borderColor: colors.accent.blue + '45',
    alignItems: 'center', justifyContent: 'center',
  },
  todayCheckUrgent: {
    backgroundColor: colors.accent.red + '15',
    borderColor: colors.accent.red + '45',
  },
  todayRowTitle: {
    flex: 1, fontSize: 13, fontWeight: '700', color: colors.text.primary, letterSpacing: 0.1,
  },
  urgentPill: {
    backgroundColor: colors.accent.red + '15', borderRadius: radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.accent.red + '30',
  },
  urgentPillText: { fontSize: 9, fontWeight: '800', color: colors.accent.red, letterSpacing: 0.8 },
  overduePill: {
    backgroundColor: colors.accent.red + '20', borderRadius: radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: colors.accent.red + '45',
  },
  overduePillText: { fontSize: 9, fontWeight: '800', color: colors.accent.red, letterSpacing: 0.8 },
  todayPomBtn: {
    width: 26, height: 26, borderRadius: 13,
    alignItems: 'center', justifyContent: 'center',
    backgroundColor: 'rgba(43,200,224,0.08)',
  },

  // ── Day-of-week bar chart ──────────────────────────────────────────────────
  dowRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 4 },
  dowCol: { flex: 1, alignItems: 'center', gap: 4 },
  dowBar: {
    width: '100%', height: 48,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end',
  },
  dowFill: { width: '100%', borderRadius: 4 },
  dowLabel:    { fontSize: 9, fontWeight: '600', color: colors.text.muted },
  dowAvgLabel: { fontSize: 8, fontWeight: '700', letterSpacing: -0.2, marginBottom: 2 },

  // ── Dual-wave legend ───────────────────────────────────────────────────────
  dualLegend:      { flexDirection: 'row', gap: 10, marginLeft: 'auto' as any },
  dualLegendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dualLegendLine:  { width: 10, height: 2, borderRadius: 1 },
  dualLegendLabel: { fontSize: 9, color: colors.text.muted },

  // ── Subscription payment modal ─────────────────────────────────────────────
  payOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
  payCard: {
    width: '100%', backgroundColor: colors.bg.card, borderRadius: radius.xl,
    padding: spacing[6], alignItems: 'center', gap: spacing[3],
    borderWidth: 1, borderColor: colors.border.default,
  },
  payIconWrap: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: colors.accent.blue + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  payTitle:  { fontSize: 10, color: colors.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  payName:   { fontSize: 20, fontWeight: '800', color: colors.text.primary, textAlign: 'center' },
  payAmount: { fontSize: 28, fontWeight: '800', color: colors.accent.blue },
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
