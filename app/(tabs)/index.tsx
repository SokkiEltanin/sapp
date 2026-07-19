import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal, Alert,
  RefreshControl, TouchableOpacity, Animated, AppState, AccessibilityInfo,
  TextInput, KeyboardAvoidingView, Platform, Image, Pressable, InteractionManager,
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import Svg, { Path, Defs, LinearGradient as SvgLinearGradient, Stop, Text as SvgText, Circle as SvgCircle, Line as SvgLine } from 'react-native-svg';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  CheckCircle2, ChevronRight, ChevronLeft,
  TrendingUp, TrendingDown, Flame, Smile, Zap, History,
  CalendarDays, Wallet,
  Briefcase, CreditCard, Check, Plus,
  Timer, CloudSun, Thermometer, FileText, BarChart2, Activity,
  Droplets, Dumbbell, BookOpen, Moon, Heart, Sun, Bike, Footprints, CheckSquare,
  ShoppingCart, Candy, Store, Package, Sparkles, Scale, Pin, Wrench, Link2,
  ChevronUp, ChevronDown, Eye, EyeOff, Trash2, GripVertical, Pencil, RotateCcw, X,
  Cloud, CloudDrizzle, CloudRain, Snowflake, Trophy, Hourglass, CalendarClock, Layers,
  PiggyBank, Utensils, Coins, Apple, ListChecks,
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
import { todayISO, ymd } from '@/utils/date';
import { getTagBudgetRules, TagBudgetRule, ruleTags, ruleLabel, attributedPrice } from '@/utils/tagBudgets';
import { getPayers } from '@/utils/payers';
import { setSunTimes, hydrateSunTimes, isoToDecimalHour } from '@/utils/sunTimes';
import { useStatsScope, inScope, countsForConsumption, consumesInScope, StatsScope } from '@/store/statsScope';
import { useHeroFont, heroFontById, HeroFont } from '@/store/heroFont';
import { loadNameAliases, canonicalProductName, normalizeProductName, productGroupKey, productGroupLabel, loadWeightMemory, weightFor, WeightMemory } from '@/utils/productMemory';
import { getCategoryMeta } from '@/utils/categories';
import { shiftHours, isWorkEvent, shiftClockRange } from '@/utils/workEvents';
import { getAllNotes, Note } from '@/utils/notesStorage';
import { getHealthHistory, saveTodayWeight } from '@/utils/healthHistory';
import { getHealthGoals } from '@/utils/healthGoals';
import DailyRings, { RingSpec } from '@/components/dashboard/DailyRings';
import MonthWrappedCard from '@/components/dashboard/MonthWrappedCard';
import MonthCardUnlock from '@/components/dashboard/MonthCardUnlock';
import { buildMonthCards, buildMonthPace, MonthCard } from '@/utils/monthCards';
import WhoAteCard from '@/components/dashboard/WhoAteCard';
import PersonalRecordsCard from '@/components/dashboard/PersonalRecordsCard';
import StreakWallCard, { StreakItem } from '@/components/dashboard/StreakWallCard';
import TriviaCard from '@/components/dashboard/TriviaCard';
import { stepsToDistanceFact } from '@/utils/funComparisons';
import { buildRecords } from '@/utils/personalRecords';
import { buildPersonConsumption } from '@/utils/personConsumption';
import PetTile from '@/components/pet/PetTile';
import { computePetState } from '@/utils/petState';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { buildQuests, sweetlessDaysFrom } from '@/utils/quests';
import { correlationInsights, DailyPoint } from '@/utils/correlations';
import { deserializeBlocks } from '@/utils/richText';
import { weatherLucide } from '@/utils/weatherIcon';
import { updateCardBalancePeak } from '@/utils/accountBalance';
import { detectRecurringBills, nextBillingDate, getDismissedBills, dismissBill } from '@/utils/recurringBills';
import { loadSubConfirms, removeSubConfirm, advanceBillingDate, PendingSubConfirm } from '@/utils/subscriptionAuto';
import { fixedVariableMonths, fixedBreakdown } from '@/utils/fixedVariable';
import { buildAchCtx, evaluateAchievements, syncEarned, getEarned } from '@/utils/achievements';
import { useCelebration } from '@/store/celebrationStore';
import { useCounters, daysUntil, untilProgress, daysSince, autoDaysWithout, isDuringEvent, daysUntilEnd, isOver, eventProgress } from '@/store/countersStore';
import { useUiActions } from '@/store/uiActions';
import { useBankQueue } from '@/store/bankQueueStore';
import { processAutoBankQueue } from '@/services/bankAutoProcess';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WalkProgress from '@/components/counters/WalkProgress';
import StreakFlame, { streakColor } from '@/components/counters/StreakFlame';
import StreakCard from '@/components/counters/StreakCard';
// Route-level crash boundary — catches a dashboard render crash as a recoverable,
// persisted screen instead of expo-router's blank production fallback.
export { ErrorBoundary } from '@/components/RouteErrorBoundary';
import { vehiclesService } from '@/services/vehiclesService';
import { maintenanceService, dueInDays } from '@/services/maintenanceService';
import { maintenanceDueMonths } from '@/utils/vehicleMatch';
import { Vehicle, MaintenanceItem } from '@/types';
import { useDashboardLayout, effectiveOrder, SECTION_TITLES, SECTION_DESC, SECTION_GROUP, SECTION_GROUP_ORDER, isAutoSection, CustomTile } from '@/store/dashboardLayout';
import { StatCtx, metricById, metricNumber, metricSeries, metricList, isSelfTransfer, dailyValue, isMoodPixelMetric, pixelTiers } from '@/utils/statWidgets';
import YearPixels from '@/components/dashboard/YearPixels';
import WeeklyBoard, { WeeklyNote } from '@/components/dashboard/WeeklyBoard';
import Reanimated, { useSharedValue, useAnimatedStyle, withTiming, runOnJS } from 'react-native-reanimated';
import { Gesture, GestureDetector } from 'react-native-gesture-handler';
import { colors, spacing, radius } from '@/theme';
import { useColors } from '@/theme/useColors';
import { useWorkStore } from '@/store/workStore';
import { useWorkEarnings, isPaycheck } from '@/hooks/useWorkEarnings';
import { computePayMonths, payMonthsSummary } from '@/utils/workSummary';
import { paycheckTargetMonth } from '@/utils/paycheck';
import { workService } from '@/services/workService';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { googleCalendarService } from '@/services/googleCalendarService';
import { expensesService } from '@/services/expensesService';
import { getPaydayConfig, getPaydayHandledMonth, setPaydayHandledMonth, paydayDue, currentMonth, PaydayConfig, getPaydayDismissedDate, setPaydayDismissedToday } from '@/utils/payday';
import { debtsService } from '@/services/debtsService';
import { Debt, PaymentMethod } from '@/types';
import { moodService } from '@/services/moodService';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import { getTodaySessions } from '@/utils/pomodoroHistory';
import AnimatedCardBg from '@/components/ui/AnimatedCardBg';

// ─── Constants ────────────────────────────────────────────────────────────────

const SWEETS_TAGS = ['słodycze', 'przekąski']; // junk side: sweets + snacks (combined everywhere)

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

// Per-metric icon for custom stat tiles, so each widget's preview is glanceable at a
// distance instead of every card wearing the same generic bar-chart glyph. Falls back
// to a per-group icon, then a bar chart.
const STAT_METRIC_ICON: Record<string, React.ComponentType<any>> = {
  spend: CreditCard, food: Utensils, sweets: Candy, income: Wallet, net: Scale,
  savings: PiggyBank, avgExpense: CreditCard, expenseCount: CreditCard, biggestExpense: CreditCard,
  byCategory: BarChart2, cheeseKg: Package, meatKg: Package, fruitKg: Apple, vegKg: Apple,
  topProducts: Package, favSweets: Candy, itemsCount: ShoppingCart, tagSpend: Store,
  tagCount: Package, tagKg: Scale, moodAvg: Smile, energyAvg: Zap, moodStreak: Flame,
  steps: Footprints, sleepAvg: Moon, weight: Scale, workHours: Briefcase, earnings: Coins,
  lastShift: Briefcase, tasksDone: ListChecks,
};
const STAT_GROUP_ICON: Record<string, React.ComponentType<any>> = {
  'Finanse': Wallet, 'Konsumpcja': ShoppingCart, 'Nastrój i zdrowie': Heart, 'Praca i zadania': Briefcase,
};
function metricIcon(def: { id: string; group: string }): React.ComponentType<any> {
  return STAT_METRIC_ICON[def.id] ?? STAT_GROUP_ICON[def.group] ?? BarChart2;
}

// A tag metric's registry label is generic ("Wydatki na tag…") — for a widget it must
// name the actual tag, or a "przekąski vs słodycze" tile shows "Wydatki na tag…".
function metricTagLabel(def: { label: string; unit: string; needsTag?: boolean } | undefined, tag?: string): string {
  if (def?.needsTag && tag) {
    const kind = def.unit === 'zł' ? 'wydatki' : def.unit === 'kg' ? 'kg' : 'szt.';
    return `${tag.charAt(0).toUpperCase()}${tag.slice(1)} (${kind})`;
  }
  return def?.label ?? '';
}

// Compact per-point label for the trend charts (value shown ABOVE each dot). Kept
// short so 6 across a narrow card stay legible: decimals for kg/h/rating, exact
// (grouped) number up to 5 digits, then k-notation. Empty for a zero/no-data point.
function fmtChartPt(v: number, unit: string): string {
  if (!(v > 0)) return '';
  if (unit === 'kg' || unit === 'h' || unit === '/5') return v.toFixed(1).replace('.', ',');
  if (v >= 100000) return `${Math.round(v / 1000)}k`;
  return Math.round(v).toLocaleString('pl-PL');
}

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

interface WeatherDay { date: string; wmo: number; hi: number; lo: number }
interface WeatherData {
  temp: number; desc: string; wmo: number;
  feels?: number; wind?: number; humidity?: number;
  hi?: number; lo?: number;
  sunrise?: string; sunset?: string;
  forecast?: WeatherDay[];
}

async function fetchWeather(): Promise<WeatherData | null> {
  try {
    const { status } = await Location.requestForegroundPermissionsAsync();
    if (status !== 'granted') return null;
    const loc = await Location.getCurrentPositionAsync({ accuracy: Location.Accuracy.Low });
    const { latitude, longitude } = loc.coords;
    const url = `https://api.open-meteo.com/v1/forecast?latitude=${latitude.toFixed(4)}&longitude=${longitude.toFixed(4)}`
      + `&current=temperature_2m,apparent_temperature,relative_humidity_2m,wind_speed_10m,weather_code`
      + `&daily=weather_code,temperature_2m_max,temperature_2m_min,sunrise,sunset&forecast_days=6&timezone=auto&temperature_unit=celsius`;
    const res = await fetch(url);
    if (!res.ok) return null;
    const data = await res.json();
    const cur = data.current ?? {};
    const d = data.daily ?? {};
    // Persist today's sunrise/sunset so the theme follows the real sun.
    const sr = d.sunrise?.[0];
    const ss = d.sunset?.[0];
    if (sr && ss) setSunTimes(isoToDecimalHour(sr), isoToDecimalHour(ss)).catch(() => {});
    const forecast: WeatherDay[] = (d.time ?? []).map((date: string, i: number) => ({
      date, wmo: d.weather_code?.[i] ?? 0, hi: Math.round(d.temperature_2m_max?.[i] ?? 0), lo: Math.round(d.temperature_2m_min?.[i] ?? 0),
    }));
    const wmo = cur.weather_code ?? 0;
    return {
      temp: Math.round(cur.temperature_2m ?? 0),
      desc: WMO_DESC[wmo] ?? 'Nieznana pogoda',
      wmo,
      feels: cur.apparent_temperature != null ? Math.round(cur.apparent_temperature) : undefined,
      wind: cur.wind_speed_10m != null ? Math.round(cur.wind_speed_10m) : undefined,
      humidity: cur.relative_humidity_2m != null ? Math.round(cur.relative_humidity_2m) : undefined,
      hi: forecast[0]?.hi, lo: forecast[0]?.lo,
      sunrise: sr ? sr.slice(11, 16) : undefined,
      sunset: ss ? ss.slice(11, 16) : undefined,
      forecast: forecast.slice(0, 6),
    };
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
function sweetsTotal(expenses: Expense[], dates: string[], scope: StatsScope = 'all'): number {
  const set = new Set(dates);
  let total = 0;
  for (const e of expenses) {
    if (e.type && e.type !== 'expense') continue;
    if (!set.has(e.date.slice(0, 10))) continue;
    for (const it of (e.receiptItems ?? [])) {
      if (consumesInScope(it, scope) && (it.tags ?? []).some(t => SWEETS_TAGS.includes(t))) total += it.price;
    }
  }
  return total;
}
function allSpend(expenses: Expense[], dates: string[]): number {
  const set = new Set(dates);
  return expenses.filter(e => (!e.type || e.type === 'expense') && set.has(e.date.slice(0, 10)))
    .reduce((s, e) => s + e.amount, 0);
}
// A spend delta chip: lower spend = green, higher = red (opposite of "growth good").
function SpendDelta({ pct, label, muted }: { pct: number; label: string; muted: string }) {
  const up = pct > 0;
  const color = pct === 0 ? muted : up ? '#F87171' : '#2AC68F';
  return (
    <View style={sd.chip}>
      {up ? <TrendingUp size={11} color={color} /> : <TrendingDown size={11} color={color} />}
      <Text style={[sd.val, { color }]}>{up ? '+' : ''}{pct}%</Text>
      <Text style={[sd.label, { color: muted }]} numberOfLines={1}>{label}</Text>
    </View>
  );
}
const sd = StyleSheet.create({
  chip: { flexDirection: 'row', alignItems: 'center', gap: 3, flexShrink: 1 },
  val: { fontSize: 12, fontWeight: '800' },
  label: { fontSize: 11, fontWeight: '600' },
});
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
  if (n === 1) return 'zadanie'; // only exactly 1 — "21 zadań", not "21 zadanie"
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
  return ymd(d);
}

// ─── Wave charts ──────────────────────────────────────────────────────────────

const WAVE_W = 320;
const WAVE_H = 64;

function buildWavePath(data: number[], max: number, min = 0) {
  // Plot points at COLUMN CENTRES ((i+0.5)/n) so they line up with the flex:1
  // value/label rows underneath. (Edge-to-edge i/(n-1) drifts out of alignment.)
  const n = data.length;
  const span = max - min || 1;
  const yFor = (v: number) => WAVE_H - 6 - (Math.max(0, Math.min(1, (v - min) / span)) * (WAVE_H - 18));
  const pts = data.map((v, i) => ({
    x: ((i + 0.5) / n) * WAVE_W,
    y: yFor(v),
  }));
  let line = `M ${pts[0].x.toFixed(1)} ${pts[0].y.toFixed(1)}`;
  for (let i = 1; i < pts.length; i++) {
    const px = pts[i-1].x, py = pts[i-1].y, cx = pts[i].x, cy = pts[i].y;
    const cpx = (px + cx) / 2;
    line += ` C ${cpx.toFixed(1)} ${py.toFixed(1)}, ${cpx.toFixed(1)} ${cy.toFixed(1)}, ${cx.toFixed(1)} ${cy.toFixed(1)}`;
  }
  // Fill drops straight DOWN at the first/last point (no diagonal wedge to the
  // card corners — that slant looked off).
  const fx0 = pts[0].x.toFixed(1);
  const fxN = pts[pts.length - 1].x.toFixed(1);
  const fill = `${line} L ${fxN} ${WAVE_H} L ${fx0} ${WAVE_H} Z`;
  return { line, fill, pts };
}

// Weight (and other never-zero trends) read 0 for buckets with no reading; carry the
// last known value forward so a sparse series is a continuous line, not spikes to 0.
function carryForward(values: number[]): number[] {
  const first = values.find(v => v > 0) ?? 0;
  let last = first;
  return values.map(v => (v > 0 ? (last = v) : last));
}
function lastNonZero(values: number[]): number {
  for (let i = values.length - 1; i >= 0; i--) if (values[i] > 0) return values[i];
  return 0;
}
// A lower bound that zooms a narrow high band (e.g. weight 71–73 kg) so variance shows
// instead of a flat line pinned to the top. 0 = don't zoom.
function zoomFloor(values: number[]): number {
  const nz = values.filter(v => v > 0);
  if (nz.length < 2) return 0;
  const lo = Math.min(...nz), hi = Math.max(...nz);
  return (hi - lo > 0 && lo > hi * 0.3) ? Math.max(0, lo - (hi - lo) * 0.5) : 0;
}

// Dual-line wave chart: data1 = primary (e.g. food), data2 = secondary (e.g. sweets)
function DualWaveChart({ data1, data2, color1, color2, independent, min1 = 0, min2 = 0 }: {
  data1: number[]; data2: number[]; color1: string; color2: string; independent?: boolean;
  min1?: number; min2?: number;
}) {
  if (data1.length < 2) return null;
  // Shared scale by default (comparable magnitudes, e.g. food vs sweets); when
  // `independent`, each line uses its own max so cross-unit trends are visible.
  // min1/min2 zoom a narrow high band (e.g. weight) so its variance is visible.
  const shared = Math.max(...data1, ...data2, 1);
  const max1 = independent ? Math.max(...data1, 1) : shared;
  const max2 = independent ? Math.max(...data2, 1) : shared;
  const p1  = buildWavePath(data1, max1, min1);
  const p2  = buildWavePath(data2, max2, min2);
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

function WaveChart({ data, color, dotColors, target, zoom }: { data: number[]; color: string; dotColors?: (string | null)[]; target?: number; zoom?: boolean }) {
  if (data.length < 2) return null;
  let min = 0;
  let max = Math.max(...data, target ?? 0, 1);
  // zoom (e.g. weight): when the values sit in a narrow band well above 0, scale to
  // that band so small week-to-week changes are actually visible instead of a flat line.
  if (zoom) {
    const nz = data.filter(v => v > 0);
    if (nz.length >= 2) {
      const lo = Math.min(...nz), hi = Math.max(...nz, target && target > 0 ? target : 0);
      if (hi - lo > 0 && lo > hi * 0.3) {
        const pad = (hi - lo) * 0.35;
        min = Math.max(0, lo - pad);
        max = hi + pad;
      }
    }
  }
  const span = max - min || 1;
  const { line, fill, pts } = buildWavePath(data, max, min);
  const gradId = `wg_${color.replace('#', '')}`;
  const targetY = target && target > 0 ? WAVE_H - 6 - (Math.max(0, Math.min(1, (target - min) / span)) * (WAVE_H - 18)) : null;
  return (
    <Svg width="100%" height={WAVE_H} viewBox={`0 0 ${WAVE_W} ${WAVE_H}`} preserveAspectRatio="none">
      <Defs>
        <SvgLinearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
          <Stop offset="0" stopColor={color} stopOpacity="0.3" />
          <Stop offset="1" stopColor={color} stopOpacity="0" />
        </SvgLinearGradient>
      </Defs>
      <Path d={fill} fill={`url(#${gradId})`} />
      {targetY != null && (
        <SvgLine x1="0" y1={targetY} x2={WAVE_W} y2={targetY} stroke="#FBBF24" strokeWidth="1" strokeDasharray="5 4" opacity="0.8" />
      )}
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

// ─── Donut chart (stat widgets) ─────────────────────────────────────────────────

const DONUT_COLORS = ['#6C9EFF', '#4ECBA8', '#FBBF24', '#F472B6', '#A78BFA', '#FB923C', '#9CA3AF'];

function StatDonut({ rows, fmt }: { rows: { label: string; value: number; unit: string }[]; fmt: (v: number, u: string) => string }) {
  const colors = useColors();
  const total = rows.reduce((s, r) => s + r.value, 0) || 1;
  const R = 30, SW = 12, C = 2 * Math.PI * R;
  let acc = 0;
  const unit = rows[0]?.unit ?? '';
  const totalLabel = unit === 'zł' ? `${Math.round(total)}` : unit === '×' ? `${Math.round(total)}` : `${Math.round(total)}`;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3] }}>
      <View style={{ width: 84, height: 84, alignItems: 'center', justifyContent: 'center' }}>
        <Svg width={84} height={84} viewBox="0 0 84 84" style={{ position: 'absolute' }}>
          <SvgCircle cx={42} cy={42} r={R} stroke={colors.border.default} strokeWidth={SW} fill="none" />
          {rows.map((r, i) => {
            const frac = r.value / total;
            const dash = `${(frac * C).toFixed(2)} ${C.toFixed(2)}`;
            const off = -(acc * C);
            acc += frac;
            return (
              <SvgCircle key={i} cx={42} cy={42} r={R}
                stroke={DONUT_COLORS[i % DONUT_COLORS.length]} strokeWidth={SW} fill="none"
                strokeDasharray={dash} strokeDashoffset={off} transform="rotate(-90 42 42)" />
            );
          })}
        </Svg>
        <Text style={{ fontSize: 15, fontWeight: '900', color: colors.text.primary }}>{totalLabel}</Text>
        <Text style={{ fontSize: 8, color: colors.text.muted, fontWeight: '700' }}>{unit === 'zł' ? 'zł' : 'razem'}</Text>
      </View>
      <View style={{ flex: 1, gap: 4 }}>
        {rows.map((r, i) => (
          <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
            <View style={{ width: 8, height: 8, borderRadius: 4, backgroundColor: DONUT_COLORS[i % DONUT_COLORS.length] }} />
            <Text style={{ flex: 1, fontSize: 11.5, color: colors.text.secondary }} numberOfLines={1}>{r.label}</Text>
            <Text style={{ fontSize: 11.5, fontWeight: '700', color: colors.text.primary }}>{fmt(r.value, r.unit)}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

// ─── Mood mini calendar ────────────────────────────────────────────────────────

const MINI_DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

function MoodMiniCal({ moodByDay }: { moodByDay: Record<string, MoodEntry[]> }) {
  const colors = useColors();
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
                  backgroundColor: mc ? mc : colors.border.subtle,
                  opacity: mc ? 0.88 : 1,
                  borderWidth: isT ? 1.5 : 0,
                  borderColor: isT ? colors.border.focus : 'transparent',
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

function GradientGreeting({ text, baseColor, font }: { text: string; baseColor: string; font: HeroFont }) {
  // Title with a LIGHT gradient (accent washing in from the LEFT). Font family,
  // size and line box come from the chosen preset; the user can additionally
  // scale the size and nudge the position, and pick a custom-loaded font family.
  const scale = useHeroFont(s => s.sizeScale);
  const offsetX = useHeroFont(s => s.offsetX);
  const offsetY = useHeroFont(s => s.offsetY);
  const customFamily = useHeroFont(s => s.customFamily);

  const label = font.upper ? text.toUpperCase() : text;
  // Shrink long greetings so they never clip (e.g. "DOBRY WIECZÓR" vs "DOBRANOC").
  const fit = label.length > 11 ? 11 / label.length : 1;
  const size = font.size * scale * fit;
  const baseY = font.baseY * scale + offsetY;
  const height = Math.ceil(font.height * scale) + Math.max(0, offsetY) + 6;
  return (
    <Svg height={height} width="100%">
      <Defs>
        <SvgLinearGradient id="greetGrad" x1="0" y1="0" x2="1" y2="0">
          <Stop offset="0"    stopColor={baseColor} stopOpacity="1" />
          <Stop offset="0.32" stopColor="#FFFFFF"   stopOpacity="0.97" />
          <Stop offset="1"    stopColor="#FFFFFF"   stopOpacity="0.86" />
        </SvgLinearGradient>
      </Defs>
      <SvgText
        x={offsetX}
        y={baseY}
        fontSize={size}
        fontWeight={font.weight as any}
        fontFamily={customFamily || font.family}
        fontStyle={font.italic ? 'italic' : 'normal'}
        fill="url(#greetGrad)"
        letterSpacing={font.spacing}
      >
        {label}
      </SvgText>
    </Svg>
  );
}

// ─── Edit-mode draggable row ──────────────────────────────────────────────────

// Row pitch used to turn a drag distance into an index. Measured, not guessed:
// editCtrlBtn2 height 40 + editRow paddingVertical 8×2 + borderWidth 1×2 = 58, plus the
// list's gap: spacing[2] = 8  →  66. (It was 68, which drifted a row every ~16 rows.)
const EDIT_ROW_H = 66;

function DashEditRow({
  id, index, count, title, desc, isCustom, hiddenNow, empty, accent, cardBg,
  onMoveDir, onMoveTo, onToggleHidden, onRemove, onEdit,
}: {
  id: string; index: number; count: number; title: string; desc?: string;
  isCustom: boolean; hiddenNow: boolean; empty?: boolean; accent: string; cardBg: string;
  onMoveDir: (id: string, dir: -1 | 1) => void;
  onMoveTo: (id: string, target: number) => void;
  onToggleHidden: (id: string) => void;
  onRemove: (id: string) => void;
  onEdit?: (id: string) => void;
}) {
  const colors = useColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const ty = useSharedValue(0);
  const lifted = useSharedValue(0);

  // Dragging used to be unreadable: the row slid freely, every other row stayed put, and
  // nothing said where it would land — you let go and it teleported. Now it SNAPS to slot
  // positions, so the row visibly clicks into the slot it will take, and it's clamped to
  // the list so you can't drag it into nowhere.
  const pan = Gesture.Pan()
    .activateAfterLongPress(120)
    .onStart(() => { lifted.value = 1; })
    .onUpdate(e => {
      const minY = -index * EDIT_ROW_H;                 // can't go above the first slot
      const maxY = (count - 1 - index) * EDIT_ROW_H;    // ...or below the last
      const raw = Math.max(minY, Math.min(maxY, e.translationY));
      ty.value = Math.round(raw / EDIT_ROW_H) * EDIT_ROW_H;
    })
    .onEnd(() => {
      const target = index + Math.round(ty.value / EDIT_ROW_H);
      lifted.value = 0;
      ty.value = withTiming(0, { duration: 140 });
      if (target !== index) runOnJS(onMoveTo)(id, target);
    });

  // A lifted row reads as picked up: bigger, opaque, on top, with a real shadow.
  const aStyle = useAnimatedStyle(() => ({
    transform: [{ translateY: withTiming(ty.value, { duration: 90 }) }, { scale: lifted.value ? 1.04 : 1 }],
    zIndex: lifted.value ? 20 : 0,
    elevation: lifted.value ? 12 : 0,
    shadowOpacity: lifted.value ? 0.35 : 0,
    shadowRadius: 12,
    shadowOffset: { width: 0, height: 6 },
    shadowColor: '#000',
  }));

  // keep the row's normal subtle border when it's down — only the lifted row goes accent
  const idleBorder = colors.border.subtle;
  const liftStyle = useAnimatedStyle(() => ({
    borderColor: lifted.value ? accent : idleBorder,
    borderWidth: lifted.value ? 1.5 : 1,
  }));

  return (
    <Reanimated.View style={aStyle}>
      <Reanimated.View style={[s.editRow, { backgroundColor: cardBg }, liftStyle]}>
        <GestureDetector gesture={pan}>
          {/* the grab handle is the whole left block, not a 20px icon */}
          <View style={[s.editCtrlBtn2, { width: 44 }]} hitSlop={{ top: 12, bottom: 12, left: 12, right: 6 }}>
            <GripVertical size={22} color={accent} />
          </View>
        </GestureDetector>
        <View style={s.editArrows}>
          <TouchableOpacity disabled={index === 0} onPress={() => { haptic.tap(); onMoveDir(id, -1); }} style={s.editArrowBtn2} hitSlop={8}>
            <ChevronUp size={20} color={index === 0 ? colors.text.muted + '50' : colors.text.secondary} />
          </TouchableOpacity>
          <TouchableOpacity disabled={index === count - 1} onPress={() => { haptic.tap(); onMoveDir(id, 1); }} style={s.editArrowBtn2} hitSlop={8}>
            <ChevronDown size={20} color={index === count - 1 ? colors.text.muted + '50' : colors.text.secondary} />
          </TouchableOpacity>
        </View>
        {/* name + a plain-language "what it shows" line, so rows aren't just cryptic
            titles you can't tell apart while dragging */}
        <View style={{ flex: 1, minWidth: 0, gap: 1 }}>
          <Text style={[s.editRowTitle, empty && { opacity: 0.5 }]} numberOfLines={1}>
            {title}{isCustom ? '  · własny' : ''}
          </Text>
          {(desc || empty) ? (
            <Text style={s.editRowDesc} numberOfLines={1}>
              {empty ? 'brak danych teraz — pokaże się, gdy będą' : desc}
            </Text>
          ) : null}
        </View>
        {onEdit && (
          <TouchableOpacity onPress={() => { haptic.tap(); onEdit(id); }} style={s.editCtrlBtn2} hitSlop={10}>
            <Pencil size={19} color={accent} />
          </TouchableOpacity>
        )}
        <TouchableOpacity onPress={() => { haptic.tap(); onToggleHidden(id); }} style={s.editCtrlBtn2} hitSlop={10}>
          {hiddenNow ? <EyeOff size={20} color={colors.text.muted} /> : <Eye size={20} color={accent} />}
        </TouchableOpacity>
        {isCustom && (
          <TouchableOpacity onPress={() => { haptic.medium(); onRemove(id); }} style={[s.editCtrlBtn2, { backgroundColor: 'rgba(228,52,52,0.12)' }]} hitSlop={10}>
            <Trash2 size={19} color={colors.accent.red} />
          </TouchableOpacity>
        )}
      </Reanimated.View>
    </Reanimated.View>
  );
}

// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const colors = useColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { color: accentColor, greeting, gradientTop, cardBg, timeOfDay } = useTimeAccent();
  // Stat cards flip with the theme; the hero stays immersive (cardBg/gradientTop).
  const cardBgDark = colors.bg.card;
  const heroFont = heroFontById('black'); // single, fixed greeting font (picker removed)

  // ── Stores & hooks ────────────────────────────────────────────────────────
  const pomodoro = usePomodoroStore();
  const { stats, isLoading: finLoading, reload: reloadFin } = useExpenses();
  const insets = useSafeAreaInsets();
  const { expenses: liveExpenses, setExpenses } = useExpensesStore();
  // ── Trigger-based stats snapshot ────────────────────────────────────────────
  // Every heavy widget memo below reads THIS `expenses` (a snapshot), NOT the live
  // store. The store churns constantly (bank sync, other screens calling setExpenses,
  // reloads) and this screen stays mounted-but-frozen in the background; without the
  // snapshot, returning to the dashboard THAWED it and every memo recomputed over the
  // whole history at once → the 4-6s tab-switch freeze. The snapshot refreshes only on
  // deliberate triggers — landing on the dashboard, and (while we're here) after the
  // data actually changes — DEFERRED past the tab transition so switching in never
  // blocks on the recompute. "Aktualizacja raz, na wejściu / po dodaniu paragonu."
  const [expenses, setStatsExpenses] = useState(() => useExpensesStore.getState().expenses);
  const refreshStatsSnapshot = useCallback(() => setStatsExpenses(useExpensesStore.getState().expenses), []);
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
  const { subscriptions, update: updateSub, add: addSub } = useSubscriptions();
  const { shifts: workShifts, settings: workSettings, setShifts: setWorkShifts, setSettings: setWorkSettings } = useWorkStore();
  const [budgets, setBudgets]       = useState<MonthlyBudgets>({});
  const [weatherPanel, setWeatherPanel] = useState(false);
  const [workPanel, setWorkPanel]   = useState(false);
  const [statDetail, setStatDetail] = useState<CustomTile | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<'week' | 'month'>('month'); // tydzień/miesiąc toggle in the detail view
  const [weightInput, setWeightInput] = useState('');
  const [subConfirms, setSubConfirms] = useState<PendingSubConfirm[]>([]);
  const workPanelTrigger = useUiActions(s => s.workPanelTrigger);
  // Consume the trigger so it can't re-open the panel on a later remount/startup
  // (the counter otherwise stays > 0 after the first open and the mount effect fires again).
  useEffect(() => {
    if (workPanelTrigger > 0) { setWorkPanel(true); useUiActions.setState({ workPanelTrigger: 0 }); }
  }, [workPanelTrigger]);
  const bankPendingCount = useBankQueue(st => st.pending.reduce((n, p) => n + (p.auto ? 0 : 1), 0)); // manual review only
  const bankAutoCount = useBankQueue(st => st.pending.reduce((n, p) => n + (p.auto ? 1 : 0), 0));
  const [tagRules, setTagRules]     = useState<TagBudgetRule[]>([]);
  const [payers, setPayers]         = useState<string[]>(['Ja', 'Partnerka']);
  const [tagModal, setTagModal]     = useState<any>(null);  // open tag-limit's item list
  const [expandedProduct, setExpandedProduct] = useState<string | null>(null); // top-products variant expand
  const [finPeriod, setFinPeriod]   = useState<'week' | 'month'>('week');
  const [workHoursChart, setWorkHoursChart] = useState(false);
  const [weather, setWeather]       = useState<WeatherData | null>(null);
  const [todayPomCount, setTodayPomCount] = useState(0);
  const [nameAliases, setNameAliases] = useState<Record<string, string>>({});
  const [weightMemory, setWeightMemory] = useState<WeightMemory>({});
  const [healthDays, setHealthDays] = useState<StatCtx['healthDays']>({});
  const [healthGoals, setHealthGoals] = useState({ stepGoal: 10000, waterGoal: 8, weightGoal: 0 });
  const [vehicles, setVehicles] = useState<Vehicle[]>([]);
  const [maintItems, setMaintItems] = useState<MaintenanceItem[]>([]);
  const [pinnedNotes, setPinnedNotes] = useState<Note[]>([]);
  const [allNotes, setAllNotes] = useState<Note[]>([]);

  // ── Dashboard layout (edit mode) ──────────────────────────────────────────
  const dashOrder      = useDashboardLayout(s => s.order);
  const dashHidden     = useDashboardLayout(s => s.hidden);
  const customTiles    = useDashboardLayout(s => s.customTiles);
  const moveSection    = useDashboardLayout(s => s.move);
  const setSectionOrder = useDashboardLayout(s => s.setOrder);
  const toggleHiddenSection = useDashboardLayout(s => s.toggleHidden);
  const addCustomTile  = useDashboardLayout(s => s.addCustomTile);
  const removeCustomTile = useDashboardLayout(s => s.removeCustomTile);
  const resetLayout    = useDashboardLayout(s => s.reset);
  const editRequested  = useDashboardLayout(s => s.editRequested);
  const clearEditRequest = useDashboardLayout(s => s.clearEditRequest);
  const [editingDash, setEditingDash] = useState(false);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [showHiddenPool, setShowHiddenPool] = useState(false);
  const orderedSections = useMemo(() => effectiveOrder(dashOrder, customTiles), [dashOrder, customTiles]);
  const hiddenSet = useMemo(() => new Set(dashHidden), [dashHidden]);
  // The editor list shows only VISIBLE sections (not hidden, not auto-managed alerts),
  // so drag/arrow indices are positions in THAT list. Both handlers reorder the visible
  // sequence and then write it back into the full order, filling only the visible slots —
  // hidden and auto sections stay exactly where they are. Doing the splice directly on
  // the full order was the "drops in the wrong place" bug: a visible index N is not the
  // same as full-order index N once anything hidden/auto sits between the rows.
  const reorderVisible = useCallback((id: string, target: number) => {
    const st = useDashboardLayout.getState();
    const cur = effectiveOrder(st.order, st.customTiles);
    const hidden = new Set(st.hidden);
    const isVis = (x: string) => !hidden.has(x) && !isAutoSection(x);
    const vis = cur.filter(isVis);
    const from = vis.indexOf(id);
    const to = Math.max(0, Math.min(vis.length - 1, target));
    if (from < 0 || from === to) return;
    vis.splice(from, 1);
    vis.splice(to, 0, id);
    let k = 0;
    const next = cur.map(x => (isVis(x) ? vis[k++] : x));
    setSectionOrder(next);
    haptic.tap();
  }, [setSectionOrder]);

  const handleMoveTo = useCallback((id: string, target: number) => reorderVisible(id, target), [reorderVisible]);
  const moveVisible = useCallback((id: string, dir: -1 | 1) => {
    const st = useDashboardLayout.getState();
    const cur = effectiveOrder(st.order, st.customTiles);
    const hidden = new Set(st.hidden);
    const vis = cur.filter(x => !hidden.has(x) && !isAutoSection(x));
    const from = vis.indexOf(id);
    if (from < 0) return;
    reorderVisible(id, from + dir);
  }, [reorderVisible]);

  // ── Subscription payment queue ────────────────────────────────────────────
  const [paymentQueue, setPaymentQueue] = useState<Subscription[]>([]);
  const [paymentConfirming, setPaymentConfirming] = useState(false);

  // Payday prompt — ask (on a configurable day) whether the paycheck arrived.
  const [paydayCfg, setPaydayCfg] = useState<PaydayConfig>({ enabled: false, day: 10 });
  const [paydayHandled, setPaydayHandled] = useState<string | null>(null);
  const [paydayDismissedDate, setPaydayDismissedDate] = useState<string | null>(null);
  const [paydayModal, setPaydayModal] = useState(false);
  const [paydayInput, setPaydayInput] = useState('');
  // Tapping the "Wypłata?" notification opens the add-paycheck modal directly, so it
  // works even if the on-dashboard prompt tile isn't currently in the day window.
  const paydayTrigger = useUiActions(s => s.paydayTrigger);
  useEffect(() => {
    if (paydayTrigger > 0) { setPaydayInput(''); setPaydayModal(true); useUiActions.setState({ paydayTrigger: 0 }); }
  }, [paydayTrigger]);

  // Debts — ask on the due day whether someone returned the money.
  const [debts, setDebts] = useState<Debt[]>([]);
  const [debtDismissed, setDebtDismissed] = useState<Set<string>>(new Set());
  const checkedSubs = useRef(false);
  const [weekOffset, setWeekOffset] = useState(0);

  // Recurring-bill auto-detect — spot bills logged by hand every month (rent, prąd,
  // internet) and offer to turn them into a tracked bill with a "paid?" prompt.
  const [billDismissed, setBillDismissed] = useState<string[]>([]);
  useEffect(() => { getDismissedBills().then(setBillDismissed).catch(() => {}); }, []);
  const billSuggest = useMemo(() => {
    const cands = detectRecurringBills(expenses, subscriptions).filter(c => !billDismissed.includes(c.tag));
    return cands[0] ?? null;
  }, [expenses, subscriptions, billDismissed]);
  const addBillSubscription = useCallback(async (cand: NonNullable<typeof billSuggest>) => {
    haptic.success();
    await addSub({
      name: cand.name, amount: cand.avgAmount, currency: 'PLN', category: 'housing',
      billingCycle: 'monthly', nextBillingDate: nextBillingDate(cand.dayOfMonth),
      reminderDaysBefore: 2, active: true, tags: [cand.tag],
    });
    toast.success(`Dodano rachunek: ${cand.name}`);
  }, [addSub]);
  const dismissBillSuggest = useCallback((tag: string) => {
    haptic.tap();
    dismissBill(tag).then(setBillDismissed).catch(() => {});
  }, []);

  // Fixed vs variable spend — last 4 months so you see your real discretionary
  // "kieszonkowe" once rent/bills are taken out.
  const fvMonths = useMemo(() => fixedVariableMonths(expenses, 4), [expenses]);
  const fvFixedItems = useMemo(() => {
    const cur = fvMonths[fvMonths.length - 1];
    return cur ? fixedBreakdown(expenses, cur.month) : [];
  }, [expenses, fvMonths]);
  const [cardPeak, setCardPeak] = useState(0);
  useEffect(() => { updateCardBalancePeak(expenses).then(setCardPeak).catch(() => {}); }, [expenses]);

  // A day-key that changes when the calendar day rolls over (checked every minute and
  // on every foreground). The dashboard stays mounted, so the countdown memos below —
  // whose freshness depends on "now" — would otherwise keep a stale day and let a passed
  // event linger. Feeding dayKey into their deps makes them re-filter the moment the day
  // turns. setDayKey only fires a real re-render when the string actually changes.
  const [dayKey, setDayKey] = useState(todayStr());
  useEffect(() => {
    const tick = () => setDayKey(todayStr());
    const id = setInterval(tick, 60_000);
    const sub = AppState.addEventListener('change', s => { if (s === 'active') tick(); });
    return () => { clearInterval(id); sub.remove(); };
  }, []);

  // Countdowns (event "walk" tiles) — nearest upcoming first. Events disappear once
  // they're over: a no-end event the day after its date, an end-dated event the day
  // after its endDate (isOver), while staying visible during a multi-day event.
  const counters = useCounters(st => st.counters);
  const activeCountdowns = useMemo(
    () => counters.filter(cn => cn.kind === 'until' && !isOver(cn) && (daysUntil(cn) >= 0 || isDuringEvent(cn))).sort((a, b) => a.date.localeCompare(b.date)),
    [counters, dayKey],
  );
  const nextCountdownDays = activeCountdowns.length ? daysUntil(activeCountdowns[0]) : null;
  const dashSince = useMemo(
    () => counters.filter(cn => cn.kind === 'since' && cn.onDashboard !== false)
      .map(cn => ({ cn, days: cn.mode === 'auto' ? autoDaysWithout(cn, expenses) : daysSince(cn) }))
      .sort((a, b) => b.days - a.days),
    [counters, expenses, dayKey],
  );

  // "Rekordy życiowe" widget — all-time bests from the data already loaded.
  const records = useMemo(() => buildRecords(healthDays, expenses, moodEntries), [healthDays, expenses, moodEntries]);

  // "Ściana serii" widget — every active streak: habit streaks + "dni bez"/since counters.
  const streakWall = useMemo<StreakItem[]>(() => {
    const fromHabits = habits.map(h => ({ key: `h:${h.id}`, name: h.title, days: getStreak(h.id) }));
    const fromCounters = counters
      .filter(cn => cn.kind === 'since')
      .map(cn => ({ key: `c:${cn.id}`, name: cn.mode === 'auto' ? `bez ${cn.name}` : cn.name, days: cn.mode === 'auto' ? autoDaysWithout(cn, expenses) : daysSince(cn) }));
    return [...fromHabits, ...fromCounters];
  }, [habits, getStreak, counters, expenses, dayKey]);

  // ── Animations ────────────────────────────────────────────────────────────
  // static blob — subtle color tint behind glassmorphism, no pulsing

  // ── Data loading ──────────────────────────────────────────────────────────
  useEffect(() => {
    if (events.length === 0) {
      import('@/services/calendarService').then(({ calendarService }) => {
        calendarService.getAllEvents().then(setEvents).catch(() => {});
      });
    }
    if (liveExpenses.length === 0) expensesService.getAll().then(setExpenses).catch(() => {});
    if (moodEntries.length === 0) moodService.getAll().then(setMood).catch(() => {});
    getBudgets().then(setBudgets);
    getTagBudgetRules().then(setTagRules).catch(() => {});
    getPayers().then(setPayers).catch(() => {});
    hydrateSunTimes().then(() => fetchWeather()).then(w => { if (w) setWeather(w); });
    workService.getSettings().then(setWorkSettings).catch(() => {});
    workService.getShifts(todayStr(), todayStr()).then(setWorkShifts).catch(() => {});
    googleCalendarService.getStoredToken().then(token => {
      if (token) {
        // Fetch a WIDE window (≈2.5 months back) — this overwrites the shared
        // gcalEvents store, and Settings derives monthly work hours from it.
        // A narrow window here was silently undercounting work shifts.
        googleCalendarService.fetchEvents().then(evs => setGcalEvents(evs)).catch(() => {});
      } else {
        setGcalEvents([]);  // clear any cached events from a previous session
      }
    });
  }, []);

  // ── Subscription check ────────────────────────────────────────────────────
  // A due bill you don't pay ("Nie") stays due, so this used to nag on EVERY app
  // open. Limit it to once per half-day (morning / evening → at most twice a day),
  // persisted so it survives app restarts.
  useEffect(() => {
    if (checkedSubs.current || subscriptions.length === 0) return;
    checkedSubs.current = true;
    (async () => {
      const now = new Date();
      const period = `${ymd(now)}-${now.getHours() < 15 ? 'am' : 'pm'}`;
      try { if ((await AsyncStorage.getItem('subs_prompt_period')) === period) return; } catch {}
      const todayS = ymd(now);
      const due = subscriptions.filter(s => s.active && !isDurationExpired(s) && s.nextBillingDate <= todayS);
      if (due.length > 0) {
        setPaymentQueue(due);
        AsyncStorage.setItem('subs_prompt_period', period).catch(() => {});
      }
    })();
  }, [subscriptions]);

  // If a queued subscription got auto-paid (e.g. bank notification advanced its
  // billing date), drop it from the "zapłaciłeś?" prompt so it stops asking.
  useEffect(() => {
    const todayS = ymd(new Date());
    setPaymentQueue(q => q.filter(s => {
      const cur = subscriptions.find(x => x.id === s.id);
      return !!cur && cur.active && cur.nextBillingDate <= todayS;
    }));
  }, [subscriptions]);

  const currentPayment = paymentQueue[0] ?? null;

  const handlePaymentYes = useCallback(async () => {
    if (!currentPayment) return;
    haptic.success();
    setPaymentConfirming(true);
    try {
      const todayS = todayISO();
      await expensesService.add({
        type: 'expense', amount: currentPayment.amount, currency: currentPayment.currency,
        category: currentPayment.category, tags: currentPayment.tags ?? [], note: `Subskrypcja: ${currentPayment.name}`, date: todayS,
      });
      const next = advanceNextBillingDate(currentPayment.nextBillingDate, currentPayment.billingCycle);
      await updateSub(currentPayment.id, { nextBillingDate: next });
    } catch {
      haptic.error();
      toast.error('Nie udało się zapisać płatności — sprawdź połączenie');
    }
    finally { setPaymentConfirming(false); setPaymentQueue(q => q.slice(1)); }
  }, [currentPayment, updateSub]);

  const handlePaymentNo = useCallback(() => { haptic.tap(); setPaymentQueue(q => q.slice(1)); }, []);

  // Confirm (or reject) a bank payment as a subscription charge (EUR-by-rate case).
  const confirmSub = useCallback(async (c: PendingSubConfirm) => {
    haptic.success();
    setSubConfirms(list => list.filter(x => x.id !== c.id));
    removeSubConfirm(c.id).catch(() => {});
    const sub = subscriptions.find(s => s.id === c.subId);
    if (!sub) return;
    const next = advanceBillingDate(sub.nextBillingDate, sub.billingCycle);
    if (next !== sub.nextBillingDate) { try { await updateSub(sub.id, { nextBillingDate: next }); } catch {} }
    toast.success(`Oznaczono „${c.subName}" jako opłaconą`);
  }, [subscriptions, updateSub]);
  const dismissSub = useCallback((c: PendingSubConfirm) => {
    haptic.tap();
    setSubConfirms(list => list.filter(x => x.id !== c.id));
    removeSubConfirm(c.id).catch(() => {});
  }, []);

  // First open, due, not-yet-dismissed debt → the dashboard asks about it.
  const dueDebt = useMemo(() => {
    const t = todayISO();
    return debts.find(d => !d.settled && d.askDate <= t && !debtDismissed.has(d.id)) ?? null;
  }, [debts, debtDismissed]);

  const settleDebt = useCallback(async (d: Debt, method: PaymentMethod) => {
    haptic.success();
    try {
      const todayS = todayISO();
      await expensesService.add({
        type: 'income', amount: d.amount, currency: 'PLN', category: 'transfer' as any,
        tags: [], note: `Zwrot: ${d.person}`, date: todayS, paymentMethod: method,
      });
      await debtsService.update(d.id, { settled: true, settledMethod: method, settledDate: todayS });
      setDebts(prev => prev.map(x => x.id === d.id ? { ...x, settled: true } : x));
      expensesService.getAll().then(setExpenses).catch(() => {});
      toast.success(`Zwrot dodany (${method === 'cash' ? 'gotówka' : 'karta'})`);
    } catch { haptic.error(); toast.error('Nie udało się zapisać — sprawdź połączenie'); }
  }, [setExpenses]);

  // Load payday config + handled-month on focus so the prompt is current.
  useFocusEffect(useCallback(() => {
    let alive = true;
    Promise.all([getPaydayConfig(), getPaydayHandledMonth(), getPaydayDismissedDate()]).then(([cfg, handled, dismissed]) => {
      if (!alive) return;
      setPaydayCfg(cfg); setPaydayHandled(handled); setPaydayDismissedDate(dismissed);
      import('@/services/notificationsService')
        .then(({ notificationsService }) => notificationsService.refreshPaydayReminder(cfg.enabled, cfg.day, handled))
        .catch(() => {});
    }).catch(() => {});
    debtsService.getAll().then(ds => { if (alive) setDebts(ds); }).catch(() => {});
    return () => { alive = false; };
  }, []));

  const confirmPayday = useCallback(async () => {
    const amt = parseFloat(paydayInput.replace(',', '.'));
    if (isNaN(amt) || amt <= 0) { haptic.error(); toast.error('Podaj prawidłową kwotę'); return; }
    haptic.success();
    try {
      const todayS = todayISO();
      // Tag with the work prefix so it becomes the "last paycheck" the rate is
      // derived from; Settings then offers to add the month to the average.
      const wp = workSettings.workPrefix?.trim().toLowerCase();
      await expensesService.add({
        type: 'income', amount: amt, currency: 'PLN', category: 'salary',
        tags: wp ? [wp] : [], note: 'Wypłata', date: todayS,
      });
      const m = currentMonth();
      await setPaydayHandledMonth(m);
      setPaydayHandled(m);
      import('@/services/notificationsService')
        .then(({ notificationsService }) => notificationsService.refreshPaydayReminder(paydayCfg.enabled, paydayCfg.day, m))
        .catch(() => {});
      expensesService.getAll().then(setExpenses).catch(() => {});
      toast.success('Dodano wypłatę do przychodów');
    } catch { haptic.error(); toast.error('Nie udało się zapisać — sprawdź połączenie'); }
    finally { setPaydayModal(false); setPaydayInput(''); }
  }, [paydayInput, workSettings.workPrefix, setExpenses, paydayCfg.enabled, paydayCfg.day]);

  // ── Work tracking ─────────────────────────────────────────────────────────
  const allEvents  = useMemo(() => [...events, ...gcalEvents], [events, gcalEvents]);
  const workEarnings = useWorkEarnings(workShifts, allEvents, workSettings, expenses);
  const wc = workSettings.workColor;

  useEffect(() => {
    if (!workSettings.workColor && !workSettings.workPrefix) return;
    const wp = workSettings.workPrefix?.trim().toLowerCase();
    const workEvs = allEvents.filter(e => isWorkEvent(e, { workColor: wc, workPrefix: wp }));
    if (workEvs.length === 0) return;
    // Use the SAME per-second rate the live earnings show (paid-in-arrears: last
    // paycheck ÷ that month's hours, with overrides). The old per-shift notif
    // diluted it by ALL logged hours, so a 12h shift read as ~100 zł.
    const perSecond = workEarnings.perSecond;
    if (!(perSecond > 0)) return;
    import('@/services/notificationsService').then(({ notificationsService }) => {
      notificationsService.scheduleWorkShiftNotifications(workEvs, perSecond).catch(() => {});
    });
  }, [allEvents, workSettings, workEarnings.perSecond]);

  // ── Quick mood handler ────────────────────────────────────────────────────
  const handleQuickMood = useCallback(async (level: MoodLevel) => {
    haptic.tap();
    try {
      const entry = await moodService.add({ date: todayStr(), mood: level, energy: 3, tags: [] });
      addEntry(entry);
      const n = moodEntries.filter(e => e.date === todayStr()).length + 1; // +1 = the one just added
      toast.success(n > 1 ? `Zapisano nastrój · ${n}. raz dziś` : 'Zapisano nastrój');
    } catch {
      haptic.error();
      toast.error('Nie zapisano nastroju — spróbuj ponownie');
    }
  }, [addEntry, moodEntries]);

  // ── Pomodoro history ──────────────────────────────────────────────────────
  const loadPomSessions = useCallback(async () => {
    const sessions = await getTodaySessions();
    setTodayPomCount(sessions.length);
  }, []);

  useEffect(() => { loadPomSessions(); }, []);
  useEffect(() => { loadNameAliases().then(setNameAliases).catch(() => {}); }, []);
  const reloadHealth = useCallback((force = false) => {
    const read = () => {
      getHealthHistory(150).then(h => {
        const m: StatCtx['healthDays'] = {};
        for (const [d, v] of Object.entries(h)) m[d] = { steps: v.steps, sleepMinutes: v.sleepMinutes, weightKg: v.weight > 0 ? v.weight : null };
        setHealthDays(m);
      }).catch(() => {});
      getHealthGoals().then(g => setHealthGoals({ stepGoal: g.stepGoal || 10000, waterGoal: g.waterGoal || 8, weightGoal: g.weightGoal || 0 })).catch(() => {});
    };
    read();
    // Pull fresh steps/sleep from the watch. force=true (app ENTRY: cold start + resume)
    // bypasses the 10-min throttle so widgets show current data straight away. A plain
    // mid-session TAB FOCUS passes force=false — the throttle then skips the native read
    // if it ran within 10 min, so switching tabs doesn't re-hit Health Connect + rewrite
    // the per-day cache every time (that setHealthDays churn kept re-dirtying this frozen
    // screen, so returning to the dashboard had a bigger thaw to reconcile → the lag).
    import('@/services/healthAutoSync').then(({ autoSyncHealth }) => autoSyncHealth(7, force)).then(n => { if (n > 0) read(); }).catch(() => {});
  }, []);
  useEffect(() => { reloadHealth(true); }, [reloadHealth]);  // cold start → force fresh
  // Re-read local health on focus (cheap multiGet) so a weight/steps logged elsewhere
  // isn't stale; the watch sync itself is throttled (force=false) via reloadHealth's default.
  useFocusEffect(useCallback(() => { reloadHealth(false); }, [reloadHealth]));
  // Quick weight entry from the weight widget's popup.
  const saveWeightEntry = useCallback(async () => {
    const kg = parseFloat(weightInput.replace(',', '.'));
    if (!(kg > 0) || kg > 400) { haptic.error(); toast.error('Podaj poprawną wagę'); return; }
    haptic.success();
    try {
      await saveTodayWeight(kg);
      reloadHealth();
      setWeightInput('');
      toast.success(`Waga zapisana: ${kg} kg`);
      setStatDetail(null);
    } catch { haptic.error(); toast.error('Nie zapisano — spróbuj ponownie'); }
  }, [weightInput, reloadHealth]);
  useFocusEffect(useCallback(() => {
    vehiclesService.getAll().then(setVehicles).catch(() => {});
    maintenanceService.getAll().then(setMaintItems).catch(() => {});
  }, []));

  // Maintenance reminders surfaced on the dashboard (vehicle service + items due/overdue).
  const maintReminders = useMemo(() => {
    type R = { key: string; label: string; sub: string; overdue: boolean; route: string };
    const out: R[] = [];
    for (const v of vehicles) {
      for (const m of (v.maintenance ?? [])) {
        const due = maintenanceDueMonths(m);
        if (due == null || due > 1) continue;
        out.push({ key: `v-${v.id}-${m.id}`, label: `${v.name}: ${m.label}`, sub: due <= 0 ? 'zaległe' : `za ~${Math.round(due)} mies.`, overdue: due <= 0, route: '/vehicles' });
      }
    }
    for (const it of maintItems) {
      const d = dueInDays(it);
      if (d > 7) continue;
      out.push({ key: `i-${it.id}`, label: it.name, sub: d < 0 ? `${-d} dni po terminie` : d === 0 ? 'dziś' : `za ${d} dni`, overdue: d < 0, route: '/items' });
    }
    return out.sort((a, b) => (a.overdue === b.overdue ? 0 : a.overdue ? -1 : 1)).slice(0, 5);
  }, [vehicles, maintItems]);

  // Re-arm a real notification for due maintenance (so it nudges with the app closed).
  useEffect(() => {
    const labels = maintReminders.map(r => `${r.label}${r.overdue ? ' (zaległe)' : ''}`);
    import('@/services/notificationsService')
      .then(({ notificationsService }) => notificationsService.refreshMaintenanceReminder(labels))
      .catch(() => {});
  }, [maintReminders]);
  useEffect(() => { loadWeightMemory().then(setWeightMemory).catch(() => {}); }, []);
  useFocusEffect(useCallback(() => {
    loadPomSessions();
    // Reload budgets + tag rules so a limit added in Settings shows immediately
    // (and persists across app restarts via their AsyncStorage backing).
    getBudgets().then(setBudgets).catch(() => {});
    getTagBudgetRules().then(setTagRules).catch(() => {});
    getAllNotes().then(ns => { setAllNotes(ns); setPinnedNotes(ns.filter(n => n.pinned)); }).catch(() => {});
    loadSubConfirms().then(setSubConfirms).catch(() => {});
    if (editRequested) { setEditingDash(true); clearEditRequest(); }
  }, [loadPomSessions, editRequested]));

  // Hero animations run only while the dashboard is the active screen AND the app
  // is foregrounded — paused otherwise so clouds/rain don't drain the battery on
  // other tabs or in the background.
  const [screenFocused, setScreenFocused] = useState(true);
  useFocusEffect(useCallback(() => { setScreenFocused(true); return () => setScreenFocused(false); }, []));

  // Stats-snapshot triggers (see the snapshot declaration up top).
  // A) Landing on the dashboard → refresh AFTER the tab transition settles, so the
  //    switch itself never pays for the recompute (this is the 4-6s-freeze fix).
  useFocusEffect(useCallback(() => {
    const task = InteractionManager.runAfterInteractions(refreshStatsSnapshot);
    return () => task.cancel();
  }, [refreshStatsSnapshot]));
  // B) Data changed (receipt added/edited, income logged, bank auto-book) WHILE we're on
  //    the dashboard → reflect it once, debounced. Off-screen changes are ignored until
  //    the next focus (A) — the frozen screen shouldn't recompute in the background.
  useEffect(() => {
    if (!screenFocused) return;
    const t = setTimeout(refreshStatsSnapshot, 300);
    return () => clearTimeout(t);
  }, [liveExpenses, screenFocused, refreshStatsSnapshot]);

  const [appActive, setAppActive] = useState(true);
  // Pull fresh calendar + work data when the app returns to the foreground (screens
  // stay mounted, so a plain mount effect never re-runs). Health is refreshed via
  // reloadHealth below; together this keeps the dashboard + pet current "od razu po
  // włączeniu apki" instead of showing yesterday's state.
  const refreshOnResume = useCallback(() => {
    import('@/services/calendarService').then(({ calendarService }) => calendarService.getAllEvents().then(setEvents).catch(() => {})).catch(() => {});
    googleCalendarService.getStoredToken().then(token => { if (token) googleCalendarService.fetchEvents().then(setGcalEvents).catch(() => {}); }).catch(() => {});
    workService.getSettings().then(setWorkSettings).catch(() => {});
    workService.getShifts(todayStr(), todayStr()).then(setWorkShifts).catch(() => {});
    reloadHealth(true);   // returning to the app = entry → force fresh watch data
    // Re-snapshot the stats too (deferred), so anything logged while away — a bank
    // auto-book, a receipt via the shortcut — shows once we're back, not stale.
    InteractionManager.runAfterInteractions(refreshStatsSnapshot);
  }, [reloadHealth, refreshStatsSnapshot]);
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => {
      setAppActive(s === 'active');
      if (s === 'active') refreshOnResume();
      // Close the work slide-panel when leaving, but DON'T touch the payday modal here:
      // tapping the "Wypłata?" notification foregrounds the app (often via a transient
      // 'inactive' → 'active'), and this handler was firing on that 'inactive' and
      // closing the modal the tap had just opened — "popup pojawia się i znika".
      if (s !== 'active') { setWorkPanel(false); }
    });
    return () => sub.remove();
  }, [refreshOnResume]);
  // Auto-accept queued payments from trusted (auto) merchants once expenses are
  // loaded (so receipt-matching is reliable). Re-runs when the app comes back to
  // the foreground — the native listener may have queued new ones while away.
  useEffect(() => {
    if (appActive && expenses.length > 0 && bankAutoCount > 0) processAutoBankQueue().catch(() => {});
  }, [appActive, expenses.length, bankAutoCount]);
  // Respect the OS "reduce motion" accessibility setting — static hero when on.
  const [reduceMotion, setReduceMotion] = useState(false);
  useEffect(() => {
    AccessibilityInfo.isReduceMotionEnabled().then(setReduceMotion).catch(() => {});
    const sub = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduceMotion);
    return () => sub.remove();
  }, []);
  const heroActive = screenFocused && appActive && !reduceMotion;

  // ── Derived data ──────────────────────────────────────────────────────────
  const today     = todayStr();
  const isLoading = finLoading || tasksLoading;
  const onRefresh = () => { reloadFin(); reloadTasks(); loadPomSessions(); };

  // Remove a wrongly-counted entry from a tag limit. Two cases:
  //  • receipt item (kind 'item') → mark it excluded (drops out of the limit +
  //    consumption stats, the money still counts in the spend total).
  //  • whole expense (kind 'expense', idx -1) → strip the rule's tags so it stops
  //    counting toward this bar (the expense itself stays).
  const removeTagItem = useCallback(async (
    item: { expenseId: string; idx: number; kind: 'expense' | 'item' },
    ruleTagList: string[],
  ) => {
    // Read + write the LIVE store here (not the deferred `expenses` snapshot): mapping a
    // stale snapshot back into setExpenses would drop anything the store gained since the
    // last snapshot refresh. The snapshot then catches up via its data-change trigger.
    const live = useExpensesStore.getState().expenses;
    const e = live.find(x => x.id === item.expenseId);
    if (!e) return;
    let updates: Partial<Expense>;
    if (item.kind === 'expense') {
      const newTags = (e.tags ?? []).filter(t => !ruleTagList.includes(t));
      updates = { tags: newTags };
      setExpenses(live.map(x => x.id === item.expenseId ? { ...x, tags: newTags } : x));
    } else {
      if (!e.receiptItems) return;
      const newItems = e.receiptItems.map((it, i) => i === item.idx ? { ...it, excluded: true } : it);
      updates = { receiptItems: newItems };
      setExpenses(live.map(x => x.id === item.expenseId ? { ...x, receiptItems: newItems } : x));
    }
    setTagModal((m: any) => m ? { ...m, items: m.items.filter((it: any) => !(it.expenseId === item.expenseId && it.idx === item.idx)) } : m);
    haptic.medium();
    try { await expensesService.update(item.expenseId, updates); }
    catch { haptic.error(); toast.error('Nie usunięto — sprawdź połączenie'); }
  }, [setExpenses]);

  // Render a user-added custom tile (a pinned note, or a quick link).
  // Data context for stat widgets (custom tiles of type 'stat').
  const statCtx = useMemo<StatCtx>(() => ({
    expenses,
    scope,
    moodEntries,
    workEvents: allEvents,
    workSettings,
    ratePerHour: (workEarnings?.perSecond ?? 0) * 3600,
    tasks: calTasks,
    habitsTotal: habits.length,
    habitsDone: habitsDoneIds.length,
    nameAliases,
    weightMemory,
    healthDays,
    // Actual [JD] paycheck per target month (arrears-aware) — lets the earnings widget
    // show REAL past-month pay instead of an hours×rate estimate. One per month (most
    // recent), matching the Praca panel.
    paycheckByMonth: (() => {
      const m: Record<string, number> = {};
      const seen = new Set<string>();
      const pcs = expenses.filter(e => isPaycheck(e, workSettings.workPrefix)).sort((a, b) => b.date.localeCompare(a.date));
      for (const e of pcs) { const tm = paycheckTargetMonth(e); if (seen.has(tm)) continue; seen.add(tm); m[tm] = e.amount; }
      return m;
    })(),
  }), [expenses, scope, moodEntries, allEvents, workSettings, workEarnings, calTasks, habits, habitsDoneIds, nameAliases, weightMemory, healthDays]);

  // Achievements — evaluate against live data so a newly-earned badge fires a
  // toast + haptic the moment you land on the dashboard (the ADHD dopamine hit).
  const achStates = useMemo(() => evaluateAchievements(buildAchCtx({
    expenses, moodEntries, workEvents: allEvents, workSettings,
    habitBestStreak: habits.length ? Math.max(0, ...habits.map(h => getStreak(h.id))) : 0,
    healthDays, tasksDone: tasks.filter(t => t.status === 'done').length,
    budgetTotal: Object.values(budgets).reduce((s2, v) => s2 + (v ?? 0), 0),
    billTracked: subscriptions.some(sb => sb.active), cardBalancePeak: cardPeak,
  })), [expenses, moodEntries, allEvents, workSettings, habits, getStreak, healthDays, tasks, budgets, subscriptions, cardPeak]);
  const earnedBadges = useMemo(() => achStates.filter(st => st.unlocked && st.a.kind !== 'bad').length, [achStates]);
  const celebrate = useCelebration(st => st.celebrate);
  useEffect(() => {
    (async () => {
      const firstEver = Object.keys(await getEarned()).length === 0;
      const fresh = await syncEarned(achStates);
      // Celebrate only genuine incremental unlocks. First run OR a big batch (e.g. after
      // an update that adds many badges you already qualify for) is seeded silently —
      // no avalanche of full-screen modals to tap through.
      if (fresh.length && !firstEver && fresh.length <= 3) celebrate(fresh);
    })().catch(() => {});
  }, [achStates]);

  // ── Weekly auto-review: cross-domain nuggets (this week vs last) ───────────
  // Smart, qualitative notes only — the raw per-metric numbers now live in the
  // interactive tile board (WeeklyBoard), so here we keep the forecast, balance,
  // streaks and cross-domain correlations that a flat number can't express.
  const weeklyNotes = useMemo<WeeklyNote[]>(() => {
    const wk = (metric: string) => { const sr = metricSeries(metric, statCtx, 'week', 2); return { now: sr.values[1] ?? 0, prev: sr.values[0] ?? 0 }; };
    type Ins = WeeklyNote;
    const out: Ins[] = [];
    const sp = wk('spend');
    // Month-end spending forecast. Only the DAILY/variable spend is extrapolated;
    // one-offs (rent, bills, subscriptions, big purchases) are kept flat — they
    // already happened and won't recur every week. Savings moves / transfers to
    // Revolut aren't real spending, so they're dropped entirely.
    const dnow = new Date();
    const dayOfMonth = dnow.getDate();
    const daysInMonth = new Date(dnow.getFullYear(), dnow.getMonth() + 1, 0).getDate();
    const monthKey = `${dnow.getFullYear()}-${pad(dnow.getMonth() + 1)}`;
    const isSavingsMove = (e: Expense) =>
      e.category === 'transfer' ||
      (e.tags ?? []).some(t => ['oszczednosci', 'oszczędnościowe', 'przelew', 'revolut'].includes(t.toLowerCase()));
    let oneOff = 0, daily = 0;
    for (const e of scopedExpenses) {
      if (e.type === 'income' || !(e.date ?? '').startsWith(monthKey)) continue;
      if (isSavingsMove(e)) continue;                    // money to savings ≠ spending
      if (e.category === 'housing' || e.category === 'subscriptions' || e.amount >= 250) oneOff += e.amount;
      else daily += e.amount;                            // groceries / small day-to-day
    }
    const realSpend = oneOff + daily;
    if (realSpend > 0 && dayOfMonth >= 4 && dayOfMonth < daysInMonth) {
      const projected = Math.round(oneOff + (daily / dayOfMonth) * daysInMonth);
      out.push({ tone: 'neutral', text: `Tempo: ~${projected} zł do końca mies. (${Math.round(realSpend)} zł dotąd, w tym stałe ${Math.round(oneOff)})` });
    }
    const sw = wk('sweets');
    const md = wk('moodAvg');
    const wh = wk('workHours');

    // ── "Days without junk" streak (sweets/snacks) ───────────────────────────
    const lastJunk = (() => {
      let last: string | null = null;
      for (const e of scopedExpenses) {
        if (e.type === 'income') continue;
        const items = e.receiptItems ?? [];
        const hasJunk = items.length > 0
          ? items.some(it => countsForConsumption(it) && (it.tags ?? []).some(t => SWEETS_TAGS.includes(t)))
          : (e.tags ?? []).some(t => SWEETS_TAGS.includes(t));
        if (hasJunk) { const d = e.date.slice(0, 10); if (!last || d > last) last = d; }
      }
      return last;
    })();
    if (lastJunk) {
      const days = Math.floor((Date.now() - new Date(lastJunk + 'T00:00:00').getTime()) / 86_400_000);
      if (days >= 2) out.push({ tone: 'good', text: `${days} dni bez słodyczy i przekąsek — tak trzymaj!` });
    } else if (scopedExpenses.length > 5) {
      out.push({ tone: 'good', text: 'Brak słodyczy/przekąsek w historii — mocne!' });
    }

    // ── Weekly balance ───────────────────────────────────────────────────────
    const inc = wk('income');
    if (inc.now > 0 || sp.now > 0) {
      const net = Math.round(inc.now - sp.now);
      out.push({ tone: net >= 0 ? 'good' : 'warn', text: `Bilans tygodnia: ${net >= 0 ? '+' : ''}${net} zł` });
    }

    const sl = wk('sleepAvg');
    const st = wk('steps');

    // ── Cross-domain correlations — the app actually reads the data together ──
    if (wh.now >= 30 && sw.prev > 0 && sw.now > sw.prev * 1.2) out.push({ tone: 'warn', text: `Pracowity tydzień (${wh.now.toFixed(0)} h) i więcej słodyczy niż zwykle` });
    if (sl.now > 0 && sl.now < 6.5 && md.now > 0 && md.prev > 0 && md.now < md.prev) out.push({ tone: 'warn', text: `Mniej snu (${sl.now.toFixed(1)} h) i niższy nastrój — odespij` });
    if (st.now >= 8000 && md.now >= 3.6) out.push({ tone: 'good', text: `Ruch robi swoje: ${Math.round(st.now / 1000)}k kroków i dobry nastrój` });
    if (sl.now > 0 && sl.now < 6.5 && sw.prev > 0 && sw.now > sw.prev * 1.2) out.push({ tone: 'warn', text: 'Krótki sen i więcej słodyczy — klasyczny duet' });
    if (wh.now >= 35 && sl.now > 0 && sl.now < 6.5) out.push({ tone: 'warn', text: `Dużo pracy (${wh.now.toFixed(0)} h) i mało snu — uważaj na wypalenie` });

    if (habits.length > 0 && habitsDoneIds.length === habits.length) out.push({ tone: 'good', text: 'Wszystkie dzisiejsze nawyki odhaczone' });
    return out;
  }, [statCtx, scopedExpenses, habits.length, habitsDoneIds.length]);

  const fmtStat = (v: number, unit: string): string => {
    const g = (x: number) => Math.round(x).toLocaleString('pl-PL'); // thousands grouping
    if (unit === 'zł')   return `${g(v)} zł`;
    if (unit === 'kg')   return `${v.toFixed(1).replace('.0', '')} kg`;
    if (unit === 'h')    return `${v.toFixed(1).replace('.0', '')} h`;
    if (unit === '/5')   return v.toFixed(1);
    if (unit === 'szt.') return `${g(v)} szt.`;
    if (unit === '×')    return `×${g(v)}`;
    if (unit === 'dni')  return `${Math.round(v)} dni`;
    if (unit.startsWith('/')) return `${Math.round(v)} ${unit}`; // e.g. habits "/ 5"
    return g(v);
  };

  // Compact value for above wave points (unit-aware, blank when zero).
  const fmtWave = (v: number, unit: string): string => {
    if (v <= 0) return '';
    if (unit === 'kg' || unit === 'h') return v.toFixed(1).replace('.0', '');
    if (unit === '/5') return v.toFixed(1);
    return `${Math.round(v)}`;
  };

  // A clear, human unit for the header chip — so every tile SAYS what it's counting
  // (PLN / szt / kg / …), which the bare chart numbers never made obvious.
  const unitChip = (unit: string): string => {
    switch (unit) {
      case 'zł':   return 'PLN';
      case 'szt.': return 'szt.';
      case '×':    return 'razy';
      case 'kg':   return 'kg';
      case 'h':    return 'godziny';
      case '/5':   return 'ocena /5';
      case 'kroki':return 'kroki';
      case 'dni':  return 'dni';
      default:     return unit.startsWith('/') ? unit : '';
    }
  };
  // What window the chart covers + what its x-labels mean — kills the "jakie tygodnie?"
  // ambiguity (week labels are the Monday of each week).
  const periodCaption = (p: 'week' | 'month', count: number): string =>
    p === 'month' ? `Ostatnie ${count} mies.` : `Ostatnie ${count} tyg. · etykieta = poniedziałek tygodnia`;

  const renderStatTile = (t: CustomTile): React.ReactNode => {
    const def = metricById(t.metric);
    if (!def) return <View style={[s.card, { backgroundColor: cardBgDark }]}><Text style={s.cardTitle}>Widget — błąd</Text></View>;
    const period = (t.period ?? 'month') as 'week' | 'month';
    const viz = t.viz ?? 'number';
    const Ic = metricIcon(def);
    // ZAROBEK: a month is CONFIRMED once its real [JD] paycheck is known; the current
    // month is only a projection (all calendar hours × rate). Surface that — a lone
    // big number read as "I'm definitely earning this".
    const paidBy = statCtx.paycheckByMonth ?? {};
    const ymBack = (back: number) => { const d = new Date(); d.setDate(1); d.setMonth(d.getMonth() - back); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`; };
    // month buckets only — ymBack maps bucket→month, which is meaningless for weeks
    const isEarnings = t.metric === 'earnings' && period === 'month';
    const earningsForecast = isEarnings && !((paidBy[ymBack(0)] ?? 0) > 0);
    const uChip = unitChip(def.unit);
    const header = (
      <View style={s.cardHeader}>
        <View style={[s.statIconChip, { backgroundColor: accentColor + '1A' }]}><Ic size={13} color={accentColor} /></View>
        <Text style={s.cardTitle} numberOfLines={1}>{t.title || def.label}</Text>
        {uChip ? <View style={[s.unitPill, { borderColor: accentColor + '44', backgroundColor: accentColor + '14' }]}><Text style={[s.unitPillTxt, { color: accentColor }]}>{uChip}</Text></View> : null}
      </View>
    );

    // PIXELS — a year-in-pixels calendar grid, one square per day coloured by the
    // metric's daily value. Checked FIRST so a 'weight'/'mood' pixels tile isn't
    // swallowed by the weight/number branches below.
    if (viz === 'pixels') {
      const year = new Date().getFullYear();
      const mood = isMoodPixelMetric(t.metric!);
      const valueFor = (d: string) => dailyValue(t.metric!, statCtx, d);
      const tiers = pixelTiers(t.metric!);
      // human hint of the absolute tiers (steps: "co 5k · 30k+ złoty")
      const tierHint = tiers ? (t.metric === 'steps' ? 'co 5k kroków · 30k+ = złoty'
        : t.metric === 'sleepAvg' ? 'progi snu · ≥8,5 h = złoty'
        : t.metric === 'tasksDone' ? 'liczba zadań · ≥8 = złoty' : null) : null;
      return (
        <View style={[s.card, { backgroundColor: cardBgDark }]}>
          {header}
          <YearPixels year={year} valueFor={valueFor} mood={mood} accent={accentColor} tiers={tiers} />
          <View style={s.pxLegendRow}>
            <Text style={s.statSub}>Rok {year}{tierHint ? ` · ${tierHint}` : ''}</Text>
            {!mood && (
              <View style={s.pxLegend}>
                <Text style={[s.statSub, { fontSize: 10 }]}>mniej</Text>
                {['26', '58', 'A0', 'CC'].map((a, i) => (
                  <View key={i} style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: accentColor + a }} />
                ))}
                <View style={{ width: 9, height: 9, borderRadius: 2, backgroundColor: '#FFCB47' }} />
              </View>
            )}
          </View>
        </View>
      );
    }

    // WEIGHT — always a clean, readable tile no matter which viz was picked: big
    // current weight on the right, delta vs the previous reading (green = toward the
    // goal when one is set), a zoomed trend line so tiny changes are visible, and the
    // range. (Weight in a generic 'number'/'compare' tile was the unreadable case.)
    if (t.metric === 'weight' && viz !== 'compare') {
      const ser = metricSeries('weight', statCtx, period, 8, t.tag);
      const raw = ser.values;                     // per-bucket latest reading, 0 = no reading
      const nz = raw.filter(v => v > 0);
      const latest = nz.length ? nz[nz.length - 1] : 0;
      const prev   = nz.length > 1 ? nz[nz.length - 2] : 0;
      const delta  = latest && prev ? latest - prev : 0;
      const lo = nz.length ? Math.min(...nz) : 0;
      const hi = nz.length ? Math.max(...nz) : 0;
      const towardGoal = t.target && t.target > 0 && latest && prev
        ? Math.abs(latest - t.target) < Math.abs(prev - t.target) : null;
      const deltaColor = towardGoal == null ? colors.text.muted : towardGoal ? '#2AC68F' : '#F87171';
      // Weight never legitimately drops to 0, but empty buckets (no reading that
      // month) would plunge the line to the axis and look broken. Carry the last
      // known weight forward (and backfill leading gaps with the first reading) so
      // the trend line is continuous; only REAL readings get a dot + a number.
      const filled = carryForward(raw);
      const dotColors = raw.map(v => (v > 0 ? accentColor : 'transparent'));
      return (
        <View style={[s.card, { backgroundColor: cardBgDark }]}>
          <View style={s.waveHeadRow}>
            <View style={[s.cardHeader, { flex: 1, marginBottom: 0 }]}>
              <View style={[s.statIconChip, { backgroundColor: accentColor + '1A' }]}><Ic size={13} color={accentColor} /></View>
              <Text style={s.cardTitle} numberOfLines={1}>{t.title || def.label}</Text>
              {uChip ? <View style={[s.unitPill, { borderColor: accentColor + '44', backgroundColor: accentColor + '14' }]}><Text style={[s.unitPillTxt, { color: accentColor }]}>{uChip}</Text></View> : null}
            </View>
            <View style={s.waveNowWrap}>
              <Text style={[s.waveNow, { color: accentColor }]} numberOfLines={1}>{latest > 0 ? `${latest.toFixed(1)} kg` : '—'}</Text>
              {delta !== 0 && <Text style={[s.waveDelta, { color: deltaColor }]}>{delta > 0 ? '+' : '−'}{Math.abs(delta).toFixed(1)} kg</Text>}
            </View>
          </View>
          {nz.length === 0 ? (
            <Text style={[s.statSub, { marginTop: spacing[2] }]}>Brak wpisów wagi — dodaj wagę w Zdrowiu lub zsynchronizuj zegarek.</Text>
          ) : (
            <>
              {/* value above each REAL reading — numbers ON the chart, placed
                  proportionally over the wave (carried-forward points stay unlabelled). */}
              <View style={{ height: 13 }}>
                {raw.map((v, i) => v > 0 ? (
                  <Text key={i} style={[s.wDot, { left: `${((i + 0.5) / raw.length) * 100}%` }]} numberOfLines={1}>{v.toFixed(1)}</Text>
                ) : null)}
              </View>
              <WaveChart data={filled} color={accentColor} dotColors={dotColors} target={t.target} zoom />
              <Text style={s.chartCaption}>{periodCaption(period, raw.length)}</Text>
              {nz.length > 1 && (
                <Text style={s.statSub}>Zakres {lo.toFixed(1)}–{hi.toFixed(1)} kg{t.target ? ` · cel ${Number(t.target).toFixed(1)} kg` : ''}</Text>
              )}
            </>
          )}
        </View>
      );
    }

    if (viz === 'wave') {
      const ser = metricSeries(t.metric!, statCtx, period, 6, t.tag);
      // Prominent CURRENT value (last non-zero) on the right; the history stays on
      // the chart. The old row of 6 tiny numbers above the wave was unreadable for
      // weight — near-identical values, no way to tell which one is "now".
      const nz = ser.values.filter(v => v > 0);
      const latest = nz.length ? nz[nz.length - 1] : 0;
      const prev   = nz.length > 1 ? nz[nz.length - 2] : 0;
      const delta  = latest && prev ? latest - prev : 0;
      const dec    = (ser.unit === 'kg' || ser.unit === 'h') ? 1 : 0;
      return (
        <View style={[s.card, { backgroundColor: cardBgDark }]}>
          <View style={s.waveHeadRow}>
            <View style={[s.cardHeader, { flex: 1, marginBottom: 0 }]}>
              <View style={[s.statIconChip, { backgroundColor: accentColor + '1A' }]}><Ic size={13} color={accentColor} /></View>
              <Text style={s.cardTitle} numberOfLines={1}>{t.title || def.label}</Text>
              {uChip ? <View style={[s.unitPill, { borderColor: accentColor + '44', backgroundColor: accentColor + '14' }]}><Text style={[s.unitPillTxt, { color: accentColor }]}>{uChip}</Text></View> : null}
            </View>
            <View style={s.waveNowWrap}>
              <Text style={[s.waveNow, { color: accentColor }]} numberOfLines={1}>{fmtStat(latest, ser.unit)}</Text>
              {delta !== 0 && (
                <Text style={s.waveDelta}>{delta > 0 ? '+' : '−'}{Math.abs(delta).toFixed(dec)}{ser.unit}</Text>
              )}
            </View>
          </View>
          <View style={s.waveValRow}>
            {ser.values.map((v, i) => (
              <Text key={i} style={[s.waveValLabel, i === ser.values.length - 1 && { color: accentColor, fontWeight: '800' }]} numberOfLines={1}>{fmtChartPt(v, ser.unit)}</Text>
            ))}
          </View>
          <WaveChart data={ser.values} color={accentColor} target={t.target} zoom={t.metric === 'weight'}
            dotColors={isEarnings ? ser.values.map((_, i) => ((paidBy[ymBack(ser.values.length - 1 - i)] ?? 0) > 0 ? '#2AC68F' : '#FBBF24')) : undefined} />
          <View style={s.waveLabels}>
            {ser.labels.map((l, i) => (
              <Text key={i} style={[s.waveLabel, i === ser.labels.length - 1 && { color: accentColor, fontWeight: '700' }]}>{l}</Text>
            ))}
          </View>
          <Text style={s.chartCaption}>{periodCaption(period, ser.values.length)}</Text>
          {isEarnings && (
            <View style={s.fvLegend}>
              <View style={s.fvLegItem}><View style={[s.fvDotSm, { backgroundColor: '#2AC68F' }]} /><Text style={s.fvLegTxt}>potwierdzone wypłatą</Text></View>
              <View style={s.fvLegItem}><View style={[s.fvDotSm, { backgroundColor: '#FBBF24' }]} /><Text style={s.fvLegTxt}>prognoza</Text></View>
            </View>
          )}
          {earningsForecast && <Text style={s.forecastNote}>Bieżący miesiąc to szacunek z kalendarza × stawka — nie potwierdzony wypłatą.</Text>}
          {t.target ? <Text style={s.statSub}>Cel: {fmtStat(t.target, ser.unit)}</Text> : null}
        </View>
      );
    }

    if (viz === 'donut') {
      const rows = metricList(t.metric!, statCtx, 6);
      return (
        <View style={[s.card, { backgroundColor: cardBgDark }]}>
          {header}
          {rows.length === 0
            ? <Text style={s.statSub}>Brak danych jeszcze.</Text>
            : <StatDonut rows={rows} fmt={fmtStat} />}
        </View>
      );
    }

    if (viz === 'compare') {
      // Self-comparison: same metric, current period vs `compareOffset` periods ago.
      if (t.metric2 === '__self__') {
        const off = t.compareOffset ?? 1;
        const n = Math.max(6, off + 1);
        const ser = metricSeries(t.metric!, statCtx, period, n, t.tag);
        const vals = t.metric === 'weight' ? carryForward(ser.values) : ser.values;
        const nowV = vals[vals.length - 1] ?? 0;
        const thenIdx = vals.length - 1 - off;
        const thenV = thenIdx >= 0 ? vals[thenIdx] : 0;
        const nowL = ser.labels[ser.labels.length - 1] ?? 'teraz';
        const thenL = thenIdx >= 0 ? ser.labels[thenIdx] : '—';
        const dPct = thenV > 0 ? Math.round(((nowV - thenV) / thenV) * 100) : null;
        const up = nowV >= thenV;
        return (
          <View style={[s.card, { backgroundColor: cardBgDark }]}>
            {header}
            <View style={s.statCmpRow}>
              <View><Text style={[s.statCmpVal, { color: accentColor }]}>{fmtStat(nowV, ser.unit)}</Text><Text style={s.statCmpKey}>{nowL}</Text></View>
              {dPct != null && (
                <View style={[s.statDelta, { backgroundColor: (up ? '#2AC68F' : '#FF6B6B') + '1E' }]}>
                  {up ? <TrendingUp size={11} color="#2AC68F" /> : <TrendingDown size={11} color="#FF6B6B" />}
                  <Text style={[s.statDeltaText, { color: up ? '#2AC68F' : '#FF6B6B' }]}>{dPct >= 0 ? '+' : ''}{dPct}%</Text>
                </View>
              )}
              <View style={{ alignItems: 'flex-end' }}><Text style={[s.statCmpVal, { color: '#9CA3AF' }]}>{fmtStat(thenV, ser.unit)}</Text><Text style={s.statCmpKey}>{thenL}</Text></View>
            </View>
            <View style={s.waveValRow}>
              {vals.map((v, i) => (
                <Text key={i} style={[s.waveValLabel, (i === vals.length - 1 || i === thenIdx) && { color: accentColor, fontWeight: '800' }]} numberOfLines={1}>{fmtChartPt(v, ser.unit)}</Text>
              ))}
            </View>
            <WaveChart data={vals} color={accentColor} zoom={t.metric === 'weight'} />
            <View style={s.waveLabels}>
              {ser.labels.map((l, i) => <Text key={i} style={[s.waveLabel, (i === ser.labels.length - 1 || i === thenIdx) && { color: accentColor, fontWeight: '700' }]}>{l}</Text>)}
            </View>
            <Text style={s.chartCaption}>{periodCaption(period, vals.length)}</Text>
          </View>
        );
      }
      // Compare vs your own recent average.
      if (t.metric2 === '__avg__') {
        const ser = metricSeries(t.metric!, statCtx, period, 6, t.tag);
        const vals = t.metric === 'weight' ? carryForward(ser.values) : ser.values;
        const nowV = vals[vals.length - 1] ?? 0;
        const prior = vals.slice(0, -1).filter(v => v !== 0);
        const avgV = prior.length ? prior.reduce((s, v) => s + v, 0) / prior.length : 0;
        const dPct = avgV > 0 ? Math.round(((nowV - avgV) / avgV) * 100) : null;
        const up = nowV >= avgV;
        return (
          <View style={[s.card, { backgroundColor: cardBgDark }]}>
            {header}
            <View style={s.statCmpRow}>
              <View><Text style={[s.statCmpVal, { color: accentColor }]}>{fmtStat(nowV, ser.unit)}</Text><Text style={s.statCmpKey}>teraz</Text></View>
              {dPct != null && (
                <View style={[s.statDelta, { backgroundColor: (up ? '#2AC68F' : '#FF6B6B') + '1E' }]}>
                  {up ? <TrendingUp size={11} color="#2AC68F" /> : <TrendingDown size={11} color="#FF6B6B" />}
                  <Text style={[s.statDeltaText, { color: up ? '#2AC68F' : '#FF6B6B' }]}>{dPct >= 0 ? '+' : ''}{dPct}%</Text>
                </View>
              )}
              <View style={{ alignItems: 'flex-end' }}><Text style={[s.statCmpVal, { color: '#9CA3AF' }]}>{fmtStat(avgV, ser.unit)}</Text><Text style={s.statCmpKey}>Twoja średnia</Text></View>
            </View>
            <View style={s.waveValRow}>
              {vals.map((v, i) => (
                <Text key={i} style={[s.waveValLabel, i === vals.length - 1 && { color: accentColor, fontWeight: '800' }]} numberOfLines={1}>{fmtChartPt(v, ser.unit)}</Text>
              ))}
            </View>
            <WaveChart data={vals} color={accentColor} zoom={t.metric === 'weight'} />
            <View style={s.waveLabels}>{ser.labels.map((l, i) => <Text key={i} style={[s.waveLabel, i === ser.labels.length - 1 && { color: accentColor, fontWeight: '700' }]}>{l}</Text>)}</View>
            <Text style={s.chartCaption}>{periodCaption(period, vals.length)}</Text>
          </View>
        );
      }
      const a = metricSeries(t.metric!, statCtx, period, 6, t.tag);
      const defB = metricById(t.metric2);
      const b = defB ? metricSeries(t.metric2!, statCtx, period, 6) : { values: a.values.map(() => 0), labels: a.labels, unit: '' };
      // Weight side(s) carry forward so the line is continuous, use the last real
      // reading for the headline, and zoom their band so variance is visible even
      // next to a big-magnitude metric like steps.
      const aW = t.metric === 'weight', bW = t.metric2 === 'weight';
      const aVals = aW ? carryForward(a.values) : a.values;
      const bVals = bW ? carryForward(b.values) : b.values;
      const aNow = aW ? lastNonZero(a.values) : (a.values[a.values.length - 1] ?? 0);
      const bNow = bW ? lastNonZero(b.values) : (b.values[b.values.length - 1] ?? 0);
      // A tag metric's generic label ("Wydatki na tag…") never says WHICH tag, so a
      // "przekąski vs słodycze" tile read as "Wydatki na tag… vs Słodycze" — unreadable.
      const aLabel = metricTagLabel(def, t.tag);
      const bLabel = defB?.label ?? '—';
      // clearer than "X to 395% Y": name the bigger side and by how many ×
      const ratio = aNow > 0 && bNow > 0
        ? (bNow >= aNow ? `${bLabel}: ${(bNow / aNow).toFixed(1)}× tego co „${aLabel}"` : `${aLabel}: ${(aNow / bNow).toFixed(1)}× tego co „${bLabel}"`)
        : null;
      return (
        <View style={[s.card, { backgroundColor: cardBgDark }]}>
          {header}
          <View style={s.statCmpRow}>
            <View style={{ flex: 1 }}>
              <View style={s.cmpDotRow}><View style={[s.cmpDot, { backgroundColor: accentColor }]} /><Text style={s.statCmpKey} numberOfLines={1}>{aLabel}</Text></View>
              <Text style={[s.statCmpVal, { color: accentColor }]}>{fmtStat(aNow, a.unit)}</Text>
            </View>
            <View style={{ flex: 1, alignItems: 'flex-end' }}>
              <View style={s.cmpDotRow}><View style={[s.cmpDot, { backgroundColor: '#FBBF24' }]} /><Text style={s.statCmpKey} numberOfLines={1}>{bLabel}</Text></View>
              <Text style={[s.statCmpVal, { color: '#FBBF24' }]}>{fmtStat(bNow, b.unit)}</Text>
            </View>
          </View>
          {ratio && a.unit === b.unit && <Text style={[s.statSub, { marginTop: 2 }]}>{ratio}</Text>}
          <View style={s.waveValRow}>
            {a.values.map((v, i) => (
              <Text key={i} style={[s.waveValLabel, { color: accentColor, fontWeight: i === a.values.length - 1 ? '800' : '600' }]} numberOfLines={1}>{fmtChartPt(v, a.unit)}</Text>
            ))}
          </View>
          <View style={s.waveValRow}>
            {b.values.map((v, i) => (
              <Text key={i} style={[s.waveValLabel, { color: '#FBBF24', fontWeight: i === b.values.length - 1 ? '800' : '600' }]} numberOfLines={1}>{fmtChartPt(v, b.unit)}</Text>
            ))}
          </View>
          <DualWaveChart data1={aVals} data2={bVals} color1={accentColor} color2={'#FBBF24'} independent={a.unit !== b.unit}
            min1={aW ? zoomFloor(aVals) : 0} min2={bW ? zoomFloor(bVals) : 0} />
          <View style={s.waveLabels}>
            {a.labels.map((l, i) => <Text key={i} style={s.waveLabel}>{l}</Text>)}
          </View>
          <Text style={s.chartCaption}>{periodCaption(period, a.values.length)}</Text>
        </View>
      );
    }

    if (viz === 'list') {
      const rows = metricList(t.metric!, statCtx);
      const maxV = rows[0]?.value || 1;
      return (
        <View style={[s.card, { backgroundColor: cardBgDark }]}>
          {header}
          {rows.length === 0 ? (
            <Text style={s.statSub}>Brak danych jeszcze.</Text>
          ) : rows.map((r, i) => (
            <View key={r.label + i} style={s.statListRow2}>
              <Text style={s.statListRank}>{i + 1}</Text>
              <View style={{ flex: 1, gap: 4 }}>
                <View style={s.topNameRow}>
                  <Text style={s.statListLabel} numberOfLines={1}>{r.label}</Text>
                  <Text style={[s.statListVal, { color: accentColor }]}>{fmtStat(r.value, r.unit)}</Text>
                </View>
                <View style={s.topBarTrack}>
                  <View style={[s.topBarFill, { width: `${Math.max(6, (r.value / maxV) * 100)}%`, backgroundColor: accentColor }]} />
                </View>
              </View>
            </View>
          ))}
        </View>
      );
    }

    // number — big value + trend vs previous period + optional goal/sparkline
    const r = metricNumber(t.metric!, statCtx, period, t.tag);
    const pct = t.target && t.target > 0 ? Math.min(1, r.value / t.target) : null;
    const over = t.target ? r.value > t.target : false;
    let deltaPct: number | null = null; let trendUp = false; let spark: number[] | null = null; let sparkLabels: string[] = [];
    if (def.periodic) {
      const ser = metricSeries(t.metric!, statCtx, period, 6, t.tag);
      spark = ser.values;
      sparkLabels = ser.labels;
      const cur = ser.values[ser.values.length - 1] ?? 0;
      const prev = ser.values[ser.values.length - 2] ?? 0;
      if (prev > 0) { deltaPct = Math.round(((cur - prev) / prev) * 100); trendUp = cur >= prev; }
    }
    return (
      <View style={[s.card, { backgroundColor: cardBgDark }]}>
        {header}
        <View style={s.statNumRow}>
          <Text style={[s.statBig, { color: over ? colors.accent.red : accentColor }]}>{fmtStat(r.value, r.unit)}</Text>
          {earningsForecast && (
            <View style={s.forecastChip}><Text style={s.forecastChipTxt}>PROGNOZA</Text></View>
          )}
          {deltaPct != null && (
            <View style={[s.statDelta, { backgroundColor: (trendUp ? '#2AC68F' : '#FF6B6B') + '1E' }]}>
              {trendUp ? <TrendingUp size={11} color="#2AC68F" /> : <TrendingDown size={11} color="#FF6B6B" />}
              <Text style={[s.statDeltaText, { color: trendUp ? '#2AC68F' : '#FF6B6B' }]}>{deltaPct >= 0 ? '+' : ''}{deltaPct}%</Text>
            </View>
          )}
        </View>
        {earningsForecast && (
          <Text style={s.forecastNote}>Szacunek na CAŁY miesiąc (godziny z kalendarza × stawka) — jeszcze nie potwierdzone wypłatą. Poprzednie miesiące to realne wypłaty.</Text>
        )}
        {pct != null ? (
          <>
            <View style={s.statTargetTrack}>
              <View style={[s.statTargetFill, { width: `${pct * 100}%`, backgroundColor: over ? colors.accent.red : accentColor }]} />
            </View>
            <Text style={s.statSub}>{Math.round((r.value / t.target!) * 100)}% celu ({fmtStat(t.target!, r.unit)})</Text>
          </>
        ) : (
          <Text style={s.statSub}>
            {r.sub}{deltaPct != null ? `  ·  ${trendUp ? '↑' : '↓'} vs ${period === 'month' ? 'poprz. miesiąc' : 'poprz. tydzień'}` : ''}
          </Text>
        )}
        {spark && spark.some(v => v > 0) && (
          <View style={{ marginTop: spacing[2] }}>
            <View style={s.waveValRow}>
              {spark.map((v, i) => (
                <Text key={i} style={[s.waveValLabel, i === spark!.length - 1 && { color: over ? colors.accent.red : accentColor, fontWeight: '800' }]} numberOfLines={1}>{fmtChartPt(v, r.unit)}</Text>
              ))}
            </View>
            <View style={{ opacity: 0.85 }}>
              <WaveChart data={spark} color={over ? colors.accent.red : accentColor} target={t.target} zoom={t.metric === 'weight'}
                dotColors={isEarnings ? spark.map((_, i) => ((paidBy[ymBack(spark!.length - 1 - i)] ?? 0) > 0 ? '#2AC68F' : '#FBBF24')) : undefined} />
            </View>
            {sparkLabels.length === spark.length && (
              <View style={s.waveLabels}>
                {sparkLabels.map((l, i) => <Text key={i} style={[s.waveLabel, i === sparkLabels.length - 1 && { color: over ? colors.accent.red : accentColor, fontWeight: '700' }]}>{l}</Text>)}
              </View>
            )}
            <Text style={s.chartCaption}>{periodCaption(period, spark.length)}</Text>
            {isEarnings && (
              <View style={s.fvLegend}>
                <View style={s.fvLegItem}><View style={[s.fvDotSm, { backgroundColor: '#2AC68F' }]} /><Text style={s.fvLegTxt}>potwierdzone wypłatą</Text></View>
                <View style={s.fvLegItem}><View style={[s.fvDotSm, { backgroundColor: '#FBBF24' }]} /><Text style={s.fvLegTxt}>prognoza</Text></View>
              </View>
            )}
          </View>
        )}
      </View>
    );
  };

  const renderWeatherTile = (t: CustomTile): React.ReactNode => {
    const code = weather?.wmo ?? -1;
    const temp = weather?.temp ?? null;
    const warm = (temp ?? 15) >= 18;
    const grad: [string, string] = warm ? ['#3A2A12', '#1A1410'] : ['#10243A', '#0F1620'];
    return (
      <TouchableOpacity activeOpacity={0.85} onPress={() => { if (temp != null) { haptic.tap(); setWeatherPanel(true); } }}>
        <LinearGradient colors={grad} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={[s.card, { borderWidth: 1, borderColor: accentColor + '30' }]}>
          <View style={s.cardHeader}>
            <CloudSun size={13} color={accentColor} />
            <Text style={s.cardTitle}>{t.title || 'Pogoda'}</Text>
            {temp != null && <Text style={{ marginLeft: 'auto', fontSize: 11, color: colors.text.muted }}>szczegóły ›</Text>}
          </View>
          {temp == null ? (
            <Text style={s.statSub}>Pobieram pogodę…</Text>
          ) : (
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[1] }}>
              {(() => { const { Icon, color } = weatherLucide(code); return <Icon size={48} color={color} strokeWidth={1.6} />; })()}
              <View style={{ flex: 1 }}>
                <Text style={s.weatherTemp}>{temp}°C</Text>
                <Text style={s.weatherDesc}>{(weather?.desc ?? '').toUpperCase()}</Text>
              </View>
            </View>
          )}
        </LinearGradient>
      </TouchableOpacity>
    );
  };

  const renderCustomTile = (t: CustomTile): React.ReactNode => {
    if (t.type === 'stat') return (
      <TouchableOpacity activeOpacity={0.9} onPress={() => { haptic.tap(); setDetailPeriod((t.period as 'week' | 'month') ?? 'month'); setStatDetail(t); }}>
        {renderStatTile(t)}
      </TouchableOpacity>
    );
    if (t.type === 'weather') return renderWeatherTile(t);
    if (t.type === 'note') {
      const note = allNotes.find(n => n.id === t.noteId);
      return (
        <TouchableOpacity
          style={[s.card, { backgroundColor: cardBgDark, gap: spacing[1] }]}
          onPress={() => { haptic.tap(); router.navigate((note ? `/notes?noteId=${note.id}` : '/notes') as any); }}
          activeOpacity={0.85}
        >
          <View style={s.cardHeader}>
            <Pin size={13} color={accentColor} />
            <Text style={s.cardTitle} numberOfLines={1}>{t.title || note?.title || 'Notatka'}</Text>
          </View>
          {(() => {
            if (!note) return <Text style={s.pinNoteBody}>Notatka usunięta — edytuj kafelek.</Text>;
            const blks = note.bodyRich ? deserializeBlocks(note.bodyRich).filter(b => b.text.trim()) : [];
            if (blks.length > 0) {
              // Render the note's own bold / colour / size 1:1 (first few lines).
              return (
                <View>
                  {blks.slice(0, 4).map(b => (
                    <Text key={b.id} numberOfLines={2} style={[s.pinNoteBody, {
                      fontWeight: b.bold ? '700' : '400',
                      fontStyle: b.italic ? 'italic' : 'normal',
                      textDecorationLine: b.underline ? 'underline' : 'none',
                      color: b.color ?? colors.text.secondary,
                      fontSize: Math.min(b.size ?? 11.5, 14),
                      lineHeight: Math.min(b.size ?? 11.5, 14) * 1.4,
                    }]}>{b.text}</Text>
                  ))}
                </View>
              );
            }
            return note.body?.trim()
              ? <Text style={s.pinNoteBody} numberOfLines={3}>{note.body.trim()}</Text>
              : <Text style={s.pinNoteBody} />;
          })()}
        </TouchableOpacity>
      );
    }
    // link tile
    return (
      <TouchableOpacity
        style={[s.card, { backgroundColor: cardBgDark, flexDirection: 'row', alignItems: 'center', gap: spacing[3] }]}
        onPress={() => { haptic.tap(); if (t.route) router.navigate(t.route as any); }}
        activeOpacity={0.85}
      >
        <View style={s.toolIcon}><Pin size={16} color={accentColor} /></View>
        <Text style={s.cardTitle}>{t.title || 'Skrót'}</Text>
        <ChevronRight size={14} color={colors.text.muted} style={{ marginLeft: 'auto' }} />
      </TouchableOpacity>
    );
  };

  const pendingTasks   = useMemo(() => tasks.filter(t => t.status !== 'done'), [tasks]);
  const overdueTasks   = useMemo(() => pendingTasks.filter(t => t.deadline && t.deadline.split('T')[0] < today).sort((a, b) => (a.deadline ?? '').localeCompare(b.deadline ?? '')), [pendingTasks, today]);
  const todayTasks     = useMemo(() => pendingTasks.filter(t => t.deadline?.startsWith(today) || t.scheduledDate === today), [pendingTasks, today]);
  const doneToday      = useMemo(() => tasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(today)).length, [tasks, today]);

  const tomorrow = useMemo(() => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return `${t.getFullYear()}-${pad(t.getMonth()+1).padStart(2,'0')}-${pad(t.getDate()).padStart(2,'0')}`;
  }, []);

  // Today's events, but DROP ones that have already ended (an event 10–21 stops
  // showing as "today" after 21:00). All-day events (no time) always stay.
  const gcalToday    = useMemo(() => {
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    const t2m = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    return gcalEvents
      .filter(e => e.date === today)
      .filter(e => {
        const r = shiftClockRange(e);
        if (!r) return true;             // all-day / untimed → keep
        return t2m(r.end) >= nowMins;    // keep only not-yet-ended
      })
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  }, [gcalEvents, today]);
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
  const weekSweets = useMemo(() => sweetsTotal(expenses, weekDates, scope), [expenses, weekDates, scope]);
  const monthTotal  = useMemo(() => allSpend(scopedExpenses, monthDates), [scopedExpenses, monthDates]);
  const monthFood   = useMemo(() => groceryTotal(scopedExpenses, monthDates), [scopedExpenses, monthDates]);
  const monthSweets = useMemo(() => sweetsTotal(expenses, monthDates, scope), [expenses, monthDates, scope]);

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
      const sw = sweetsTotal(expenses, dates, scope);
      const food      = groceryTotal(scopedExpenses, dates);
      const totalSpend = allSpend(scopedExpenses, dates);
      return { offset, dates, avgMood, sweets: sw, food, totalSpend, isCurrent: offset === weekOffset };
    });
  }, [weekOffset, moodByDay, scopedExpenses, expenses, scope]);

  // Spend comparison for the Finanse card: this period vs the PREVIOUS one and vs
  // the AVERAGE of prior periods (mirrors the work panel's rate comparison).
  const finCompare = useMemo(() => {
    const pct = (cur: number, base: number) => base > 0 ? Math.round((cur - base) / base * 100) : null;
    if (finPeriod === 'week') {
      const cur = weekOverview[weekOverview.length - 1]?.totalSpend ?? 0;
      const prev = weekOverview[weekOverview.length - 2]?.totalSpend ?? 0;
      const priors = weekOverview.slice(0, -1).map(w => w.totalSpend).filter(v => v > 0);
      const avg = priors.length ? priors.reduce((a, b) => a + b, 0) / priors.length : 0;
      return { vsPrev: pct(cur, prev), vsAvg: pct(cur, avg) };
    }
    // month: bucket scoped spend by calendar month
    const byMonth: Record<string, number> = {};
    for (const e of scopedExpenses) {
      if ((e.type && e.type !== 'expense') || isSelfTransfer(e)) continue;
      const m = (e.date ?? '').slice(0, 7); if (!m) continue;
      byMonth[m] = (byMonth[m] ?? 0) + e.amount;
    }
    const months = Object.keys(byMonth).sort();
    const curKey = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
    const cur = byMonth[curKey] ?? 0;
    const priorKeys = months.filter(m => m < curKey);
    const prev = priorKeys.length ? byMonth[priorKeys[priorKeys.length - 1]] : 0;
    const priorVals = priorKeys.slice(-6).map(m => byMonth[m]);
    const avg = priorVals.length ? priorVals.reduce((a, b) => a + b, 0) / priorVals.length : 0;
    return { vsPrev: pct(cur, prev), vsAvg: pct(cur, avg) };
  }, [finPeriod, weekOverview, scopedExpenses]);

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
    const isWork = (e: typeof allEvents[number]) => isWorkEvent(e, { workColor: wcol, workPrefix: wp });
    const dur = (e: typeof allEvents[number]) => shiftHours(e);
    const rate = (workEarnings?.perSecond ?? 0) * 3600;
    const now = new Date();
    const months = Array.from({ length: 6 }, (_, idx) => {
      const i = 5 - idx;
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const hours = allEvents
        .filter(e => isWork(e) && (e.date ?? '').slice(0, 7) === ym)
        .reduce((s, e) => s + dur(e), 0);
      return { ym, label: MONTH_SHORT[d.getMonth()], hours, earnings: Math.round(hours * rate), isCurrent: i === 0 };
    });
    // This month: split worked-so-far vs still-scheduled (gcal holds future shifts),
    // and count distinct days worked for an avg-per-day figure.
    const ymCur = months[5].ym;
    let workedH = 0, plannedH = 0;
    const dayset = new Set<string>();
    for (const e of allEvents) {
      if (!isWork(e) || (e.date ?? '').slice(0, 7) !== ymCur) continue;
      const h = dur(e); const day = (e.date ?? '').slice(0, 10);
      if (day <= today) { workedH += h; if (h > 0) dayset.add(day); }
      else plannedH += h;
    }
    const currentHours = months[5].hours;
    const projectedH = workedH + plannedH;
    // Average over the completed prior months that had any work (months[0..4]).
    const prior = months.slice(0, 5).filter(m => m.hours > 0);
    const avgHours = prior.length ? prior.reduce((a, m) => a + m.hours, 0) / prior.length : 0;
    const avgEarnings = prior.length ? Math.round(prior.reduce((a, m) => a + m.earnings, 0) / prior.length) : 0;
    // This calendar year + shifts this month + best of the last 12 months.
    const yearPrefix = `${now.getFullYear()}-`;
    let yearHours = 0, shiftCount = 0;
    for (const e of allEvents) {
      if (!isWork(e)) continue;
      const ym = (e.date ?? '').slice(0, 7);
      if (ym.startsWith(yearPrefix) && ym <= ymCur) yearHours += dur(e);
      if (ym === ymCur && (e.date ?? '').slice(0, 10) <= today && dur(e) > 0) shiftCount++;
    }
    const best12 = Array.from({ length: 12 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() - k, 1);
      const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      const h = allEvents.filter(e => isWork(e) && (e.date ?? '').slice(0, 7) === ym).reduce((s, e) => s + dur(e), 0);
      return { label: MONTH_SHORT[d.getMonth()], year: d.getFullYear(), hours: h, earnings: Math.round(h * rate) };
    });
    const bestMonth = best12.reduce((m, x) => (x.earnings > m.earnings ? x : m), best12[0]);
    return {
      months, currentHours, rate,
      currentEarnings: Math.round(currentHours * rate),
      workedH, plannedH, workedEarnings: Math.round(workedH * rate),
      projectedH, projectedEarnings: Math.round(projectedH * rate),
      daysWorked: dayset.size,
      avgPerDay: dayset.size > 0 ? workedH / dayset.size : 0,
      prevHours: months[4].hours, prevEarnings: months[4].earnings,
      avgHours, avgEarnings,
      yearHours, yearEarnings: Math.round(yearHours * rate),
      shiftCount, perShift: shiftCount > 0 ? Math.round((workedH * rate) / shiftCount) : 0,
      bestMonth,
    };
  }, [allEvents, workSettings, workEarnings, today]);

  // Paycheck-driven pay breakdown + average zł/h (Σ included paycheck ÷ Σ hours),
  // across ALL confirmed months — shown in the work panel, matches Settings.
  const workPayMonths = useMemo(
    () => computePayMonths(expenses, allEvents, workSettings),
    [expenses, allEvents, workSettings.workPrefix, workSettings.workColor, workSettings.excludedPayMonths],
  );
  const workAvg = useMemo(() => payMonthsSummary(workPayMonths), [workPayMonths]);

  // Collectible "Wrapped" month cards — one per month, newest first.
  const monthCards = useMemo(
    () => buildMonthCards({ expenses, moodEntries, healthDays, payMonths: workPayMonths, nameAliases, scope }),
    [expenses, moodEntries, healthDays, workPayMonths, nameAliases, scope],
  );
  // The card to surface on the dashboard = the month you're IN (with its pace vs last
  // month at the same date); the last sealed month is the fallback before this month
  // has any data.
  const featuredCard = useMemo(() => monthCards.find(c => c.inProgress) ?? monthCards[0], [monthCards]);
  const monthPace = useMemo(
    () => buildMonthPace({ expenses, moodEntries, healthDays, payMonths: workPayMonths, nameAliases, scope }),
    [expenses, moodEntries, healthDays, workPayMonths, nameAliases, scope],
  );

  // "Nowa karta!" unlock moment: when a freshly-sealed month appears that we
  // haven't celebrated yet. First run just records the baseline (no confetti spam
  // over historical data); after that, each new sealed month pops a celebration.
  const [unlockCard, setUnlockCard] = useState<MonthCard | null>(null);
  useEffect(() => {
    const sealed = monthCards.find(c => !c.inProgress);
    if (!sealed) return;
    (async () => {
      try {
        const seen = await AsyncStorage.getItem('month_card_seen');
        if (seen == null) { await AsyncStorage.setItem('month_card_seen', sealed.month); return; }
        if (sealed.month > seen) {
          setUnlockCard(sealed);
          await AsyncStorage.setItem('month_card_seen', sealed.month);
        }
      } catch {}
    })();
  }, [monthCards]);
  // Schedule the 1st-of-next-month nudge that a new card has joined the collection.
  useEffect(() => {
    import('@/services/notificationsService')
      .then(({ notificationsService }) => notificationsService.refreshMonthCardReminder())
      .catch(() => {});
  }, []);
  // Persist skin-unlock progress (cards collected + any legendary) for the Skórki
  // screen to read without recomputing the whole collection.
  useEffect(() => {
    const sealed = monthCards.filter(c => !c.inProgress).length;
    const legendary = monthCards.some(c => c.tierRank >= 4);
    AsyncStorage.setItem('skin_progress', JSON.stringify({ cards: sealed, legendary })).catch(() => {});
  }, [monthCards]);

  // "Kto zjadł słodycze" — this-month consumption split between people (eaters).
  const personConsumption = useMemo(
    () => buildPersonConsumption(expenses, payers, nameAliases),
    [expenses, payers, nameAliases],
  );

  // ── Companion blob: live mood from today's self-care data ──────────────────
  const petName = usePetStore(st => st.name);
  const petXp = usePetStore(st => st.xp);
  const petCareTick = usePetStore(st => st.careTick);
  const petClaimedQuests = usePetStore(st => st.claimedQuests);
  const petDailyClaims = usePetStore(st => st.dailyClaims);
  const petMonthlyClaims = usePetStore(st => st.monthlyClaims);
  const petState = useMemo(() => {
    const tISO = todayISO();
    const todayMoods = moodEntries.filter(e => e.date === tISO);
    const avgMood = todayMoods.length ? todayMoods.reduce((a, b) => a + b.mood, 0) / todayMoods.length : null;
    const mk = tISO.slice(0, 7);
    const spend: Record<string, number> = {};
    for (const e of expenses) { if (e.type === 'income' || (e.date ?? '').slice(0, 7) !== mk) continue; spend[e.category] = (spend[e.category] ?? 0) + e.amount; }
    const overBudget = Object.entries(budgets).some(([cat, lim]) => !!lim && (spend[cat] ?? 0) > (lim as number));
    return computePetState({
      stepsToday: healthDays[tISO]?.steps ?? 0,
      stepGoal: healthGoals.stepGoal,
      sleepMinutes: healthDays[tISO]?.sleepMinutes ?? 0,
      habitsDone: habitsDoneIds.length, habitsTotal: habits.length,
      moodLoggedToday: todayMoods.length > 0, avgMoodToday: avgMood,
      hour: new Date().getHours(),
      overBudget,
    });
  }, [healthDays, healthGoals, habitsDoneIds.length, habits.length, moodEntries, budgets, expenses]);
  const petLevel = useMemo(() => levelFromXp(petXp).level, [petXp]);
  const petClaimable = useMemo(() => {
    const tISO = todayISO();
    const month = tISO.slice(0, 7);
    const recent = Object.values(healthDays).map(d => d.steps).filter(x => x > 0).slice(0, 14);
    const avgSteps = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
    return buildQuests({
      stepsToday: healthDays[tISO]?.steps ?? 0,
      moodLoggedToday: moodEntries.some(e => e.date === tISO),
      habitsDone: habitsDoneIds.length, habitsTotal: habits.length,
      sweetlessDays: sweetlessDaysFrom(expenses),
      bestStepDay: Object.values(healthDays).reduce((m, d) => Math.max(m, d.steps ?? 0), 0),
      habitBestStreak: habits.length ? Math.max(0, ...habits.map(h => getStreak(h.id))) : 0,
      cardsCollected: monthCards.filter(c => !c.inProgress).length,
      boughtSweetToday: expenses.some(e => e.type !== 'income' && (e.date ?? '').slice(0, 10) === tISO && (e.receiptItems ?? []).some(it => !it.excluded && (it.tags ?? []).some(tg => tg === 'słodycze' || tg === 'przekąski'))),
      stepTarget: avgSteps > 0 ? Math.max(8000, Math.ceil(avgSteps * 1.1 / 500) * 500) : 0,
      sleepMinutes: healthDays[tISO]?.sleepMinutes ?? 0,
      moodDaysThisMonth: new Set(moodEntries.filter(e => (e.date ?? '').startsWith(month)).map(e => e.date)).size,
      stepsThisMonth: Object.entries(healthDays).filter(([d]) => d.startsWith(month)).reduce((m, [, v]) => m + (v.steps ?? 0), 0),
    }, { claimedMilestones: petClaimedQuests, dailyClaims: petDailyClaims, monthlyClaims: petMonthlyClaims, today: tISO }).claimableCount;
  }, [healthDays, moodEntries, habitsDoneIds.length, habits, expenses, monthCards, petClaimedQuests, petDailyClaims, petMonthlyClaims, getStreak]);
  // Passive daily care XP (once/day), scaled by how well you're doing.
  const petTicked = useRef(false);
  useEffect(() => {
    if (petTicked.current) return;
    if ((healthDays[todayISO()]?.steps ?? 0) > 0 || habits.length > 0 || moodEntries.length > 0) {
      petTicked.current = true;
      petCareTick(Math.max(1, Math.round(petState.wellbeing / 12)));
    }
  }, [petState.wellbeing, healthDays, habits.length, moodEntries.length]);

  // Daily goal rings (Apple-Watch style): today's steps / water / budget / habits.
  const dailyRings = useMemo<RingSpec[]>(() => {
    const tISO = todayISO();
    const rings: RingSpec[] = [];
    const stepsToday = healthDays[tISO]?.steps ?? 0;
    rings.push({ key: 'steps', label: 'kroki', Icon: Footprints, value: stepsToday, goal: healthGoals.stepGoal, color: '#2AC68F',
      display: stepsToday > 0 ? (stepsToday >= 1000 ? `${(stepsToday / 1000).toFixed(1)}k` : String(stepsToday)) : '—' });
    const waterHabit = habits.find(h => h.kind === 'water');
    if (waterHabit) {
      const cnt = getTodayCount(waterHabit.id);
      rings.push({ key: 'water', label: 'woda', Icon: Droplets, value: cnt, goal: waterHabit.dailyGoal || 1, color: '#46B0DE', display: `${cnt}/${waterHabit.dailyGoal || 1}` });
    }
    const totalBudget = Object.values(budgets).reduce((s, v) => s + (v ?? 0), 0);
    if (totalBudget > 0) {
      const now = new Date();
      const daily = totalBudget / new Date(now.getFullYear(), now.getMonth() + 1, 0).getDate();
      const spentToday = scopedExpenses.filter(e => (!e.type || e.type === 'expense') && !isSelfTransfer(e) && e.date.slice(0, 10) === tISO).reduce((s, e) => s + e.amount, 0);
      rings.push({ key: 'budget', label: 'budżet dnia', Icon: Wallet, value: spentToday, goal: daily, color: '#FBBF24', over: spentToday > daily, display: `${Math.round(spentToday)} zł` });
    }
    if (habits.length > 0) {
      rings.push({ key: 'habits', label: 'nawyki', Icon: CheckSquare, value: habitsDoneIds.length, goal: habits.length, color: '#A78BFA', display: `${habitsDoneIds.length}/${habits.length}` });
    }
    return rings;
  }, [healthDays, healthGoals, habits, habitsDoneIds, budgets, scopedExpenses, getTodayCount]);

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
        const tags = ruleTags(rule);                    // one or more tags combined
        const hasAny = (arr?: string[]) => !!arr && tags.some(t => arr.includes(t));
        let spend = 0;
        const items: { expenseId: string; idx: number; kind: 'expense' | 'item'; name: string; price: number; date: string }[] = [];
        for (const e of scopedExpenses) {
          if (e.type === 'income') continue;
          if (!inPeriod(e.date, rule.period)) continue;
          // A RECEIPT is always broken down by its items — only the matching
          // products count, never the whole receipt (a 74 zł Lidl shop is not 74 zł
          // of sweets just because it contains some). The expense-level tag only
          // counts a PLAIN expense with no item breakdown (whole amount, listed at
          // idx -1, person-scoped to the payer).
          const hasItems = (e.receiptItems?.length ?? 0) > 0;
          if (hasItems) {
            e.receiptItems!.forEach((it, idx) => {
              if (countsForConsumption(it) && hasAny(it.tags)) {
                spend += attributedPrice(it, rule.person, payers);
                items.push({ expenseId: e.id, idx, kind: 'item', name: it.name, price: it.price, date: e.date });
              }
            });
          } else if (hasAny(e.tags)) {
            if (!rule.person || e.payer === rule.person) {
              spend += e.amount;
              items.push({ expenseId: e.id, idx: -1, kind: 'expense', name: e.storeName || e.note || 'Wydatek', price: e.amount, date: e.date });
            }
          }
        }
        items.sort((a, b) => (a.date < b.date ? 1 : -1));   // newest first
        return { ...rule, spend, pct: spend / rule.limit, label: ruleLabel(rule), items, lastName: items[0]?.name ?? null };
      })
      .sort((a, b) => b.pct - a.pct);
  }, [tagRules, scopedExpenses, today, weekDates, payers]);

  // Multi-month history for the open tag-limit (how much each month vs the limit).
  const MON_SHORT = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
  const tagHistory = useMemo(() => {
    if (!tagModal) return [] as { key: string; label: string; spend: number }[];
    const rule = tagModal;
    const tags = ruleTags(rule);
    const hasAny = (arr?: string[]) => !!arr && tags.some((t: string) => arr.includes(t));
    const now = new Date();
    const out: { key: string; label: string; spend: number }[] = [];
    for (let i = 5; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
      const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      let spend = 0;
      for (const e of scopedExpenses) {
        if (e.type === 'income') continue;
        if ((e.date ?? '').slice(0, 7) !== key) continue;
        if ((e.receiptItems?.length ?? 0) > 0) {
          e.receiptItems!.forEach(it => { if (countsForConsumption(it) && hasAny(it.tags)) spend += attributedPrice(it, rule.person, payers); });
        } else if (hasAny(e.tags) && (!rule.person || e.payer === rule.person)) {
          spend += e.amount;
        }
      }
      out.push({ key, label: MON_SHORT[d.getMonth()], spend: Math.round(spend) });
    }
    return out;
  }, [tagModal, scopedExpenses, payers]);

  // Re-arm a budget notification when a tag-limit is near/over (closed-app nudge).
  useEffect(() => {
    const near = tagLimits.map(t => ({ label: t.label, pct: t.pct, spend: t.spend, limit: t.limit, period: t.period }));
    import('@/services/notificationsService')
      .then(({ notificationsService }) => notificationsService.refreshBudgetReminder(near))
      .catch(() => {});
  }, [tagLimits]);

  // ── Weekly summary (#17): Sunday-evening recap, re-armed on open ─────────────
  const weeklySummary = useMemo(() => {
    const wd = new Set(getWeekDates(0)); // always the CURRENT week, regardless of UI offset
    let spend = 0;
    for (const e of expenses) { if (e.type !== 'income' && wd.has((e.date ?? '').slice(0, 10))) spend += e.amount ?? 0; }
    const moods = moodEntries.filter(e => wd.has(e.date)).map(e => e.mood);
    const moodAvg = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
    const sleeps = [...wd].map(d => healthDays[d]?.sleepMinutes ?? 0).filter(m => m > 0);
    const sleepAvg = sleeps.length ? sleeps.reduce((a, b) => a + b, 0) / sleeps.length : null;
    const steps = [...wd].map(d => healthDays[d]?.steps ?? 0).filter(srx => srx > 0);
    const stepsAvg = steps.length ? Math.round(steps.reduce((a, b) => a + b, 0) / steps.length) : null;
    const parts: string[] = [];
    if (spend > 0) parts.push(`Wydatki: ${spend.toFixed(0)} zł`);
    if (moodAvg != null) parts.push(`Nastrój: ${moodAvg.toFixed(1)}/5`);
    if (sleepAvg != null) parts.push(`Sen śr.: ${Math.floor(sleepAvg / 60)}h ${pad(Math.round(sleepAvg % 60))}m`);
    if (stepsAvg != null) parts.push(`Kroki śr.: ${stepsAvg.toLocaleString('pl-PL')}`);
    return parts;
  }, [expenses, moodEntries, healthDays]);

  useEffect(() => {
    import('@/services/notificationsService')
      .then(({ notificationsService }) => notificationsService.refreshWeeklySummary(weeklySummary))
      .catch(() => {});
  }, [weeklySummary]);

  // ── Dynamic hero briefing ──────────────────────────────────────────────────
  // A contextual one-liner — complements the TopPill (which shows the single top
  // priority) by giving a broader daily summary. { pre, bold, post } parts.
  const heroSummary = useMemo(() => {
    const hour = new Date().getHours();
    const dueCount = todayTasks.length + overdueTasks.length;

    if (workEarnings.isWorking) {
      return { pre: 'Jesteś w pracy — zarobione już ', bold: `${workEarnings.totalEarned.toFixed(2)} zł`, post: '.' };
    }
    if (overdueTasks.length > 0) {
      return { pre: 'Masz ', bold: `${overdueTasks.length} ${plTasks(overdueTasks.length)} po terminie`, post: ' — ogarnij je.' };
    }
    if (todayTasks.length > 0) {
      return {
        pre: 'Na dziś ', bold: `${todayTasks.length} ${plTasks(todayTasks.length)}`,
        post: doneToday > 0 ? `, ${doneToday} już z głowy.` : '.',
      };
    }
    if (gcalToday.length > 0) {
      const ev = gcalToday[0];
      return { pre: 'Dziś w kalendarzu: ', bold: (ev.title || 'wydarzenie'), post: ev.startTime ? ` o ${ev.startTime}.` : '.' };
    }
    if (budgetAlertCard) {
      return { pre: 'Uważaj na wydatki ', bold: `#${budgetAlertCard.cat}`, post: ` — ${Math.round(budgetAlertCard.pct * 100)}% limitu.` };
    }
    if (hour >= 17 && habits.length > 0) {
      const undone = habits.length - habitsDoneIds.length;
      if (undone > 0) return { pre: 'Wieczór — zostało ', bold: `${undone} ${undone === 1 ? 'nawyk' : 'nawyki'}`, post: ' do odhaczenia.' };
    }
    if (hour >= 18 && !todayEntry) {
      return { pre: 'Jak ', bold: 'minął Ci dzień', post: '? Zapisz nastrój.' };
    }
    if (dueCount === 0 && doneToday > 0) {
      return { pre: 'Wszystko ogarnięte — ', bold: `${doneToday} ${plTasks(doneToday)} dziś`, post: '. Dobra robota!' };
    }
    return { pre: 'Czysty grafik — ', bold: 'co dziś zdziałasz', post: '?' };
  }, [
    todayTasks.length, overdueTasks.length, doneToday, gcalToday, budgetAlertCard,
    habits.length, habitsDoneIds.length, todayEntry,
    workEarnings.isWorking, workEarnings.totalEarned,
  ]);

  // ── Fun facts / advanced analytics from all shopping data ──────────────────
  const funFacts = useMemo(() => {
    // Non-obvious, data-driven insights you CAN'T read off the other tiles.
    const WD = ['niedzielę', 'poniedziałek', 'wtorek', 'środę', 'czwartek', 'piątek', 'sobotę'];
    const monthKey = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
    const shoppingDays: string[] = [];
    const seenDay = new Set<string>();
    const wdSpend = Array(7).fill(0);
    const wdDaySet: Set<string>[] = Array.from({ length: 7 }, () => new Set<string>());
    const storeSpend: Record<string, number> = {};
    const sweetDays = new Set<string>();
    let total = 0, weekendSpend = 0, cashSpend = 0, cardUsed = false, cashUsed = false, foodSpend = 0;
    let smallN = 0, smallSum = 0;
    const pm = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 1);
    const prevMonthKey = `${pm.getFullYear()}-${pad(pm.getMonth() + 1)}`;
    let thisMonthTotal = 0, prevMonthTotal = 0, monthTxCount = 0;
    const monthSpendDays = new Set<string>();
    let costliestItem = { name: '', price: 0 };
    for (const e of expenses) {
      if (e.type === 'income' || isSelfTransfer(e)) continue;
      const day = (e.date ?? '').slice(0, 10);
      if (!day) continue;
      const wd = new Date(day + 'T00:00:00').getDay();
      if (!seenDay.has(day)) { seenDay.add(day); shoppingDays.push(day); }
      total += e.amount;
      wdSpend[wd] += e.amount; wdDaySet[wd].add(day);
      if (wd === 0 || wd === 6) weekendSpend += e.amount;
      if (e.paymentMethod === 'cash') { cashSpend += e.amount; cashUsed = true; } else cardUsed = true;
      if (e.storeName) storeSpend[e.storeName] = (storeSpend[e.storeName] ?? 0) + e.amount;
      if (e.category === 'groceries') foodSpend += e.amount;
      if (e.amount < 10 && day.startsWith(monthKey)) { smallN++; smallSum += e.amount; }
      if (day.startsWith(monthKey)) { thisMonthTotal += e.amount; monthTxCount++; monthSpendDays.add(day); }
      else if (day.startsWith(prevMonthKey)) prevMonthTotal += e.amount;
      for (const it of (e.receiptItems ?? [])) {
        if (!consumesInScope(it, scope)) continue;
        if (it.price > costliestItem.price && it.name) costliestItem = { name: canonicalProductName(it.name, nameAliases), price: it.price };
        if ((it.tags ?? []).some(t => SWEETS_TAGS.includes(t))) sweetDays.add(day);
      }
    }
    type Icon = 'calendar' | 'percent' | 'store' | 'wallet' | 'flame' | 'candy' | 'clock' | 'footprints';
    const facts: { icon: Icon; label: string }[] = [];

    // shopping cadence
    if (shoppingDays.length >= 5) {
      const sorted = shoppingDays.slice().sort();
      const span = (new Date(sorted[sorted.length - 1]).getTime() - new Date(sorted[0]).getTime()) / 86400000;
      const every = span / (sorted.length - 1);
      if (every >= 0.5) facts.push({ icon: 'clock', label: `Na zakupy chodzisz średnio co ${every.toFixed(1)} dnia` });
    }
    // priciest weekday (avg per shopping day of that weekday)
    const wdAvg = wdSpend.map((sum, i) => ({ i, avg: wdDaySet[i].size ? sum / wdDaySet[i].size : 0, n: wdDaySet[i].size }));
    const topWd = wdAvg.filter(w => w.n >= 2).sort((a, b) => b.avg - a.avg)[0];
    if (topWd) facts.push({ icon: 'calendar', label: `Najwięcej wydajesz w ${WD[topWd.i]} — śr. ${Math.round(topWd.avg)} zł` });
    // weekend share vs the 2/7 (≈29%) baseline
    if (total > 0 && shoppingDays.length >= 6) {
      const pct = Math.round(weekendSpend / total * 100);
      const tail = pct >= 40 ? ' — sporo!' : pct <= 18 ? ' — raczej w tygodniu' : '';
      facts.push({ icon: 'percent', label: `Weekendy to ${pct}% Twoich wydatków${tail}` });
    }
    // store loyalty
    const topStore = Object.entries(storeSpend).sort((a, b) => b[1] - a[1])[0];
    if (topStore && total > 0 && topStore[1] / total >= 0.15) {
      facts.push({ icon: 'store', label: `${Math.round(topStore[1] / total * 100)}% pieniędzy zostawiasz w: ${topStore[0]}` });
    }
    // cash vs card
    if (cashUsed && cardUsed && total > 0) {
      facts.push({ icon: 'wallet', label: `Gotówką płacisz ${Math.round(cashSpend / total * 100)}% wydatków` });
    }
    // small buys add up
    if (smallN >= 4) facts.push({ icon: 'wallet', label: `Drobne (<10 zł) w tym mies.: ${smallN} zakupów = ${Math.round(smallSum)} zł` });
    // sweet cadence
    if (sweetDays.size >= 3) {
      const sd = Array.from(sweetDays).sort();
      const span = (new Date(sd[sd.length - 1]).getTime() - new Date(sd[0]).getTime()) / 86400000;
      const every = span / (sd.length - 1);
      if (every >= 0.5) facts.push({ icon: 'candy', label: `Po słodycze sięgasz co ~${every.toFixed(1)} dnia` });
    }
    // food share
    if (foodSpend > 0 && total > 0) facts.push({ icon: 'percent', label: `Jedzenie/spożywka to ${Math.round(foodSpend / total * 100)}% wydatków` });
    // costliest single product (not receipt)
    if (costliestItem.price > 0) facts.push({ icon: 'flame', label: `Najdroższy produkt: ${costliestItem.name} (${Math.round(costliestItem.price)} zł)` });
    // this month vs previous month
    if (prevMonthTotal > 0 && thisMonthTotal > 0) {
      const pct = Math.round((thisMonthTotal - prevMonthTotal) / prevMonthTotal * 100);
      if (Math.abs(pct) >= 5) facts.push({ icon: 'percent', label: pct > 0 ? `Ten miesiąc o ${pct}% drożej niż poprzedni` : `Ten miesiąc o ${-pct}% taniej niż poprzedni` });
    }
    // no-spend days this month
    const noSpend = new Date().getDate() - monthSpendDays.size;
    if (noSpend >= 3) facts.push({ icon: 'calendar', label: `W tym miesiącu ${noSpend} dni bez żadnego wydatku` });
    // average transaction this month
    if (monthTxCount >= 5) facts.push({ icon: 'wallet', label: `Średni wydatek w tym mies.: ${Math.round(thisMonthTotal / monthTxCount)} zł (${monthTxCount} transakcji)` });

    // steps this month as a relatable distance — the kind of "ciekawostka" the user loves
    const monthPref = todayStr().slice(0, 7);
    const stepsMonth = Object.entries(healthDays).filter(([d]) => d.startsWith(monthPref)).reduce((sum, [, v]) => sum + (v.steps || 0), 0);
    const stepFact = stepsToDistanceFact(stepsMonth);
    if (stepFact) facts.unshift({ icon: 'footprints', label: `W tym miesiącu przeszedłeś ${stepFact}` });

    return facts.slice(0, 8);
  }, [expenses, nameAliases, scope, healthDays]);

  // ── Weight ciekawostka: kg per food group THIS MONTH, with top-2 breakdown ──
  // e.g. "10 kg sera — 4 kg gouda, 6 kg cesarski". Best-effort: only weighed
  // items (fractional quantity = kg) of the same tag group are summed.
  const weightFacts = useMemo(() => {
    const monthKey = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
    const GROUPS: { tag: string; label: string }[] = [
      { tag: 'nabiał', label: 'sera/nabiału' },
      { tag: 'mięso', label: 'mięsa' },
      { tag: 'owoce', label: 'owoców' },
      { tag: 'warzywa', label: 'warzyw' },
    ];
    const groupKg: Record<string, number> = {};
    const groupItems: Record<string, Record<string, number>> = {};
    for (const e of expenses) {
      if (e.type === 'income') continue;
      if (!(e.date ?? '').startsWith(monthKey)) continue;
      for (const it of (e.receiptItems ?? [])) {
        if (!consumesInScope(it, scope)) continue;
        // Only count RELIABLY-weighed items, so the kg totals are trustworthy:
        // a fractional quantity (loose-weighed, e.g. 0.636 kg) or an explicit/learned
        // weight that isn't the 1 kg default sentinel. Pack items at the default
        // 1 kg are skipped (we don't actually know their weight).
        const q0 = it.quantity ?? 0;
        const learned = it.name ? weightFor(it.name, weightMemory) : undefined;
        const explicitW = (it.weightKg && it.weightKg > 0 && it.weightKg !== 1) ? it.weightKg : 0;
        const weighedQty = (q0 > 0 && q0 < 50 && !Number.isInteger(q0)) ? q0 : 0;
        const learnedW = (learned && learned !== 1 && q0 > 0 && q0 < 50 && Number.isInteger(q0)) ? learned * q0 : 0;
        const kg = explicitW || weighedQty || learnedW;
        if (kg <= 0) continue;
        const tags = it.tags ?? [];
        for (const g of GROUPS) {
          if (!tags.includes(g.tag)) continue;
          groupKg[g.tag] = (groupKg[g.tag] ?? 0) + kg;
          const canon = canonicalProductName(it.name ?? '', nameAliases);
          (groupItems[g.tag] ??= {})[canon] = (groupItems[g.tag]?.[canon] ?? 0) + kg;
        }
      }
    }
    const out: string[] = [];
    for (const g of GROUPS) {
      const kg = groupKg[g.tag] ?? 0;
      if (kg < 1.5) continue; // only show when there's enough reliably-weighed data
      const parts = Object.entries(groupItems[g.tag] ?? {})
        .sort((a, b) => b[1] - a[1]).slice(0, 2)
        .map(([n, v]) => `${v.toFixed(1).replace('.0', '')} kg ${n}`);
      out.push(`Ten miesiąc: ${kg.toFixed(1).replace('.0', '')} kg ${g.label}${parts.length ? ` — ${parts.join(', ')}` : ''}`);
    }
    return out;
  }, [expenses, nameAliases, weightMemory, scope]);

  // ── Cross-metric correlations (#16): sleep / steps / mood / daily spend ──────
  const correlations = useMemo(() => {
    const spendByDay: Record<string, number> = {};
    for (const e of expenses) {
      if (e.type === 'income') continue;
      const d = (e.date ?? '').slice(0, 10);
      if (d) spendByDay[d] = (spendByDay[d] ?? 0) + (e.amount ?? 0);
    }
    const dates = new Set<string>([...Object.keys(healthDays), ...Object.keys(moodByDay)]);
    const points: DailyPoint[] = [];
    dates.forEach(d => {
      const hd = healthDays[d];
      const md = moodByDay[d];
      points.push({
        sleepH: hd && hd.sleepMinutes > 0 ? hd.sleepMinutes / 60 : undefined,
        steps:  hd && hd.steps > 0 ? hd.steps : undefined,
        mood:   md && md.length ? md.reduce((a, b) => a + b.mood, 0) / md.length : undefined,
        spend:  spendByDay[d], // undefined on no-spend days → excluded from spend pairs
      });
    });
    return correlationInsights(points);
  }, [expenses, healthDays, moodByDay]);

  // ── Top 3 most-bought products (by # of receipt appearances) ──────────────
  // Grouped by CANONICAL identity so OCR variants / cross-store spellings of the
  // same product merge (learned via name aliases when you rename in the scanner).
  // "Rok temu tego dnia" — a nostalgic snapshot from exactly a year back: that day's
  // avg mood, my spend, and steps. Hidden unless at least one of them has data.
  const yearAgo = useMemo(() => {
    const now = new Date();
    const d = new Date(now.getFullYear() - 1, now.getMonth(), now.getDate());
    const key = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
    const moods = (moodByDay[key] ?? []).map(e => e.mood);
    const mood = moods.length ? moods.reduce((a, b) => a + b, 0) / moods.length : null;
    let spend = 0; let hasSpend = false;
    for (const e of expenses) {
      if ((e.date ?? '').slice(0, 10) !== key) continue;
      if (e.type === 'income' || isSelfTransfer(e) || !inScope(e, scope)) continue;
      spend += e.amount; hasSpend = true;
    }
    const steps = healthDays[key]?.steps ?? 0;
    const label = d.toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
    return { mood, spend, hasSpend, steps, label, has: mood != null || hasSpend || steps > 0 };
  }, [expenses, moodByDay, healthDays, scope]);

  // "Co podrożało" — products whose effective unit price in RECENT purchases is
  // meaningfully higher than in earlier ones.
  //
  // ONE observation per (receipt × product): sum the NET price of all same-product
  // lines on that receipt and divide by their total quantity → the real per-szt cost
  // paid that day. That folds a "1+1" promo (a full-price line + a 1 gr line) into one
  // honest price, e.g. (7,99 + 0,01) / 2 = 4,00 — instead of logging the 0,01 zł promo
  // line as its own absurd observation that wrecks the average. Deposits (kaucja) and
  // excluded items are skipped; an implausibly low result (a stray lone-grosz line with
  // no full-price twin) is dropped. Then recent-half vs earlier-half by date, and only a
  // real, sustained rise (≥8% AND ≥0,30 zł, ≥4 purchases, absurd jumps ignored) shows.
  const priceWatch = useMemo(() => {
    const byKey: Record<string, { names: string[]; obs: { t: number; up: number }[] }> = {};
    for (const e of expenses) {
      if (e.type === 'income') continue;
      const t = new Date(e.date ?? '').getTime();
      if (!t) continue;
      const perProduct: Record<string, { sum: number; qty: number; names: string[] }> = {};
      for (const it of (e.receiptItems ?? [])) {
        if (it.excluded || it.kind === 'deposit') continue;
        const name = it.name?.trim(); if (!name) continue;
        const canon = canonicalProductName(name, nameAliases);
        const key = productGroupKey(canon);
        if (!key) continue;
        const p = (perProduct[key] ??= { sum: 0, qty: 0, names: [] });
        p.sum += it.price ?? 0;                            // price is already net of discounts
        p.qty += it.quantity > 0 ? it.quantity : 1;
        p.names.push(canon);
      }
      for (const [key, p] of Object.entries(perProduct)) {
        const up = p.qty > 0 ? p.sum / p.qty : 0;
        if (up < 0.10) continue;                           // implausible — nothing real is <10 gr/szt
        const g = (byKey[key] ??= { names: [], obs: [] });
        g.names.push(...p.names);
        g.obs.push({ t, up });
      }
    }
    const out: { label: string; from: number; to: number; pct: number }[] = [];
    for (const g of Object.values(byKey)) {
      if (g.obs.length < 4) continue;
      g.obs.sort((a, b) => a.t - b.t);
      const half = Math.floor(g.obs.length / 2);
      const avg = (arr: { up: number }[]) => arr.reduce((s, o) => s + o.up, 0) / arr.length;
      const eAvg = avg(g.obs.slice(0, half));
      const rAvg = avg(g.obs.slice(half));
      if (!(eAvg > 0) || rAvg > eAvg * 3) continue;        // absurd jump = leftover mis-scan
      const pct = Math.round(((rAvg - eAvg) / eAvg) * 100);
      if (pct < 8 || rAvg - eAvg < 0.30) continue;         // only a real, meaningful rise
      out.push({ label: productGroupLabel(g.names), from: eAvg, to: rAvg, pct });
    }
    return out.sort((a, b) => b.pct - a.pct).slice(0, 4);
  }, [expenses, nameAliases]);

  // "Bąbelki wydatków" — this month's spend per category as sized bubbles.
  const spendBubbles = useMemo(() => {
    const now = new Date();
    const mk = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
    const sums: Record<string, number> = {};
    for (const e of expenses) {
      if (e.type === 'income' || isSelfTransfer(e) || !inScope(e, scope)) continue;
      if ((e.date ?? '').slice(0, 7) !== mk) continue;
      sums[e.category] = (sums[e.category] ?? 0) + e.amount;
    }
    const rows = Object.entries(sums).filter(([, v]) => v > 0).sort((a, b) => b[1] - a[1]);
    return { rows, max: rows.length ? rows[0][1] : 1, total: rows.reduce((s, [, v]) => s + v, 0) };
  }, [expenses, scope]);

  const topProducts = useMemo(() => {
    const count: Record<string, number> = {};
    const spent: Record<string, number> = {};
    const names: Record<string, string[]> = {};                    // original canon names per group
    const variants: Record<string, Record<string, number>> = {};   // group → variant → count
    for (const e of expenses) {
      if (e.type === 'income') continue;
      for (const it of (e.receiptItems ?? [])) {
        if (!consumesInScope(it, scope)) continue;
        const name = it.name?.trim();
        if (!name) continue;
        const canon = canonicalProductName(name, nameAliases);
        const key = productGroupKey(canon);   // coarse group (serek wiejski* → "serek")
        if (!key) continue;
        count[key] = (count[key] ?? 0) + 1;
        spent[key] = (spent[key] ?? 0) + (it.price ?? 0);
        (names[key] ??= []).push(canon);
        (variants[key] ??= {})[canon] = (variants[key][canon] ?? 0) + 1;
      }
    }
    return Object.entries(count)
      .sort((a, b) => b[1] - a[1])
      .filter(([, c]) => c >= 2)
      .slice(0, 5)
      .map(([key, c]) => ({
        name: productGroupLabel(names[key] ?? [key]),
        count: c,
        spent: spent[key] ?? 0,
        variants: Object.entries(variants[key] ?? {})
          .sort((a, b) => b[1] - a[1])
          .map(([n, cc]) => ({ name: n, count: cc })),
      }));
  }, [expenses, nameAliases, scope]);

  // ── Floating Lifebar ──────────────────────────────────────────────────────
  // ─── Render ───────────────────────────────────────────────────────────────

  return (
    <View style={s.root}>
      {/* Subtle accent wash → base bg. A faint accent tint (not a dark band) so it
          works in light mode too. */}
      <LinearGradient
        colors={[accentColor + '14', colors.bg.primary] as [string, string]}
        style={StyleSheet.absoluteFill}
        start={{ x: 0.4, y: 0 }}
        end={{ x: 0.6, y: 0.52 }}
      />

      {unlockCard && <MonthCardUnlock card={unlockCard} onDismiss={() => setUnlockCard(null)} />}

      <SafeAreaView style={s.safe} edges={[]}>
        <View style={{ flex: 1 }}>

          <ScrollView
            showsVerticalScrollIndicator={false}
            contentContainerStyle={[s.scroll, { paddingTop: insets.top + 50 }]}
            refreshControl={<RefreshControl refreshing={isLoading} onRefresh={onRefresh} tintColor={colors.text.muted} progressViewOffset={insets.top + 50} />}
          >

            {/* ══ HEADER — date + weather + tab shortcuts (Humor / Liczniki / Gablota) */}
            <View style={s.headerMin}>
              <View style={s.headerMinRow}>
                <Text style={s.headerMinDate} numberOfLines={1}>{dateLabel.toUpperCase()}</Text>
                {weather && (
                  <TouchableOpacity style={s.headerMinWeather} activeOpacity={0.7}
                    onPress={() => { haptic.tap(); setWeatherPanel(true); }}>
                    {(() => { const { Icon, color } = weatherLucide(weather.wmo ?? -1); return <Icon size={18} color={color} strokeWidth={1.8} />; })()}
                    <Text style={s.headerMinTemp}>{weather.temp}°</Text>
                  </TouchableOpacity>
                )}
                <View style={{ flexDirection: 'row', gap: 6, marginLeft: 'auto' }}>
                  <TouchableOpacity onPress={() => { haptic.tap(); openCheckIn(); }} style={s.hdrIcon} activeOpacity={0.8}>
                    <Smile size={18} color={todayEntry ? colors.accent.green : colors.accent.purple} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/counters' as any); }} style={s.hdrIcon} activeOpacity={0.8}>
                    <Hourglass size={17} color={colors.text.secondary} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/month-cards' as any); }} style={s.hdrIcon} activeOpacity={0.8}>
                    <Layers size={17} color="#A78BFA" />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/achievements' as any); }} style={s.hdrIcon} activeOpacity={0.8}>
                    <Trophy size={17} color="#FFC83D" />
                  </TouchableOpacity>
                </View>
              </View>
              <View style={s.headerMinRule} />
            </View>

            {/* ══ DASHBOARD SECTIONS (reorderable registry) ═══════════════ */}
            {(() => {
              const nodes: Record<string, React.ReactNode> = {};

              nodes['weekly-insights'] = (
                expenses.length > 0 || moodEntries.length > 0 || Object.keys(healthDays).length > 0 ||
                allEvents.length > 0 || calTasks.length > 0 || weeklyNotes.length > 0
              ) && (
                <WeeklyBoard statCtx={statCtx} notes={weeklyNotes} accent={accentColor} />
              );

              nodes['maintenance-reminders'] = maintReminders.length > 0 && (
                <View style={[s.card, { backgroundColor: cardBgDark }]}>
                  <View style={s.cardHeader}>
                    <Wrench size={13} color={accentColor} />
                    <Text style={s.cardTitle}>Serwis i przypomnienia</Text>
                  </View>
                  <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
                    {maintReminders.map(r => {
                      const col = r.overdue ? colors.accent.red : colors.accent.amber;
                      return (
                        <TouchableOpacity key={r.key} style={s.factRow} activeOpacity={0.7} onPress={() => { haptic.tap(); router.navigate(r.route as any); }}>
                          <View style={[s.insightDot, { backgroundColor: col }]} />
                          <Text style={[s.factText, { flex: 1 }]} numberOfLines={1}>{r.label}</Text>
                          <Text style={{ fontSize: 11, fontWeight: '800', color: col }}>{r.sub}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                </View>
              );

              // Don't ask if a paycheck already landed this month — whether logged by
              // hand, via this prompt, or auto-captured from a [JD]/salary bank credit.
              const wpLc = (workSettings.workPrefix ?? '').trim().toLowerCase();
              const gotPaidThisMonth = expenses.some(e =>
                e.type === 'income' && (e.date ?? '').slice(0, 7) === currentMonth() &&
                (e.category === 'salary' || (!!wpLc && (e.tags ?? []).some(t => (t ?? '').toLowerCase() === wpLc))));
              nodes['payday-prompt'] = paydayDue(paydayCfg, paydayHandled, paydayDismissedDate) && !gotPaidThisMonth && (
                <View style={[s.card, { backgroundColor: cardBgDark }]}>
                  <View style={s.cardHeader}>
                    <Wallet size={13} color={colors.accent.green} />
                    <Text style={s.cardTitle}>Wypłata</Text>
                  </View>
                  <Text style={[s.factText, { marginTop: spacing[1] }]}>Dostałeś już wypłatę w tym miesiącu?</Text>
                  <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
                    <TouchableOpacity style={[s.paydayBtn, { backgroundColor: colors.accent.green }]} activeOpacity={0.85}
                      onPress={() => { haptic.tap(); setPaydayInput(''); setPaydayModal(true); }}>
                      <Text style={[s.paydayBtnText, { color: colors.bg.primary }]}>Tak — dodaj</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.paydayBtn, s.paydayBtnGhost]} activeOpacity={0.7}
                      onPress={() => { haptic.tap(); setPaydayDismissedToday(); setPaydayDismissedDate(todayISO()); }}>
                      <Text style={[s.paydayBtnText, { color: colors.text.secondary }]}>Jeszcze nie</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );

              nodes['debt-prompt'] = dueDebt && (
                <View style={[s.card, { backgroundColor: cardBgDark }]}>
                  <View style={s.cardHeader}>
                    <Wallet size={13} color={colors.accent.amber} />
                    <Text style={s.cardTitle}>Dług</Text>
                  </View>
                  <Text style={[s.factText, { marginTop: spacing[1] }]}>Czy {dueDebt.person} oddał Ci {dueDebt.amount.toFixed(2)} zł?</Text>
                  <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
                    <TouchableOpacity style={[s.paydayBtn, { backgroundColor: colors.accent.green }]} activeOpacity={0.85}
                      onPress={() => settleDebt(dueDebt, 'cash')}>
                      <Text style={[s.paydayBtnText, { color: colors.bg.primary }]}>Gotówka</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.paydayBtn, { backgroundColor: colors.accent.blue }]} activeOpacity={0.85}
                      onPress={() => settleDebt(dueDebt, 'card')}>
                      <Text style={[s.paydayBtnText, { color: colors.bg.primary }]}>Karta</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.paydayBtn, s.paydayBtnGhost]} activeOpacity={0.7}
                      onPress={() => { haptic.tap(); setDebtDismissed(prev => new Set(prev).add(dueDebt.id)); }}>
                      <Text style={[s.paydayBtnText, { color: colors.text.secondary }]}>Nie</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );

              nodes['bill-suggest'] = billSuggest && (
                <View style={[s.card, { backgroundColor: cardBgDark }]}>
                  <View style={s.cardHeader}>
                    <Wallet size={13} color={colors.accent.blue} />
                    <Text style={s.cardTitle}>Stały rachunek?</Text>
                  </View>
                  <Text style={[s.factText, { marginTop: spacing[1] }]}>
                    Płacisz „{billSuggest.name}" co miesiąc (~{billSuggest.avgAmount} zł, {billSuggest.months} mies.). Dodać jako rachunek z przypomnieniem „zapłaciłeś?"?
                  </Text>
                  <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
                    <TouchableOpacity style={[s.paydayBtn, { backgroundColor: colors.accent.blue }]} activeOpacity={0.85}
                      onPress={() => addBillSubscription(billSuggest)}>
                      <Text style={[s.paydayBtnText, { color: colors.bg.primary }]}>Tak — dodaj</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={[s.paydayBtn, s.paydayBtnGhost]} activeOpacity={0.7}
                      onPress={() => dismissBillSuggest(billSuggest.tag)}>
                      <Text style={[s.paydayBtnText, { color: colors.text.secondary }]}>Nie pytaj</Text>
                    </TouchableOpacity>
                  </View>
                </View>
              );

              nodes['sub-confirm'] = subConfirms.length > 0 && (() => {
                const c = subConfirms[0];
                return (
                  <View style={[s.card, { backgroundColor: cardBgDark }]}>
                    <View style={s.cardHeader}>
                      <Wallet size={13} color={colors.accent.amber} />
                      <Text style={s.cardTitle}>Płatność za subskrypcję?</Text>
                    </View>
                    <Text style={[s.factText, { marginTop: spacing[1] }]}>
                      Z banku: <Text style={{ fontWeight: '800', color: colors.text.primary }}>{c.amount.toFixed(2)} {c.currency}</Text> w „{c.merchant}". Wygląda na Twoją subskrypcję <Text style={{ fontWeight: '800', color: colors.text.primary }}>{c.subName}</Text> (kwota w innej walucie zależy od kursu). Oznaczyć jako opłaconą za ten okres?
                    </Text>
                    <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
                      <TouchableOpacity style={[s.paydayBtn, { backgroundColor: colors.accent.green }]} activeOpacity={0.85} onPress={() => confirmSub(c)}>
                        <Text style={[s.paydayBtnText, { color: colors.bg.primary }]}>Tak, opłacona</Text>
                      </TouchableOpacity>
                      <TouchableOpacity style={[s.paydayBtn, s.paydayBtnGhost]} activeOpacity={0.7} onPress={() => dismissSub(c)}>
                        <Text style={[s.paydayBtnText, { color: colors.text.secondary }]}>Nie</Text>
                      </TouchableOpacity>
                    </View>
                  </View>
                );
              })();

              nodes['pet'] = (
                <TouchableOpacity activeOpacity={0.85} onPress={() => { haptic.tap(); router.navigate('/pet' as any); }}>
                  <PetTile name={petName} pet={petState} level={petLevel} claimable={petClaimable} />
                </TouchableOpacity>
              );

              nodes['month-summary'] = featuredCard && (
                <MonthWrappedCard card={featuredCard} compact pace={monthPace} onPress={() => router.navigate('/month-cards' as any)} />
              );

              nodes['tag-limits'] = tagLimits.map(t => {
              const pctClamped = Math.min(100, Math.round(t.pct * 100));
              const over = t.pct >= 1;
              return (
                <TouchableOpacity
                  key={t.id}
                  style={[s.budgetWarnCard, { backgroundColor: cardBgDark }]}
                  onPress={() => { haptic.tap(); setTagModal(t); }}
                  activeOpacity={0.8}
                >
                  <Text style={s.budgetWarnText}>
                    {tagLimitMsg(t.pct)}{' · '}
                    <Text style={s.budgetWarnBold}>{t.label}</Text>
                    <Text style={s.budgetWarnPeriod}>{t.period === 'week' ? '  tygodniowy' : '  miesięczny'}</Text>
                    {'   '}
                    <Text style={[s.budgetWarnPct, over && { color: colors.accent.red }]}>
                      {Math.round(t.pct * 100)}%
                    </Text>
                    <Text style={s.budgetWarnAmt}>{'   '}{Math.round(t.spend)}/{Math.round(t.limit)} zł</Text>
                  </Text>
                  <View style={s.budgetWarnTrack}>
                    <View style={[s.budgetWarnFill, {
                      width: `${pctClamped}%` as any,
                      backgroundColor: over ? colors.accent.red : accentColor,
                    }]} />
                  </View>
                  {t.lastName && (
                    <Text style={s.tagLastItem} numberOfLines={1}>
                      ostatnio: {t.lastName} · dotknij, by zobaczyć/usunąć
                    </Text>
                  )}
                </TouchableOpacity>
              );
            });

            nodes['budget-warning'] = budgetAlertCard && (
              <TouchableOpacity
                style={[s.budgetWarnCard, { backgroundColor: cardBgDark }]}
                onPress={() => { haptic.tap(); router.navigate('/(tabs)/finances' as any); }}
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
            );

            nodes['pinned-notes'] = pinnedNotes.length > 0 && (
              <View style={[s.card, { backgroundColor: cardBgDark, gap: spacing[2] }]}>
                <View style={s.cardHeader}>
                  <Pin size={13} color={accentColor} />
                  <Text style={s.cardTitle}>Przypięte notatki</Text>
                </View>
                {pinnedNotes.slice(0, 4).map(n => (
                  <TouchableOpacity
                    key={n.id}
                    style={s.pinNoteRow}
                    onPress={() => { haptic.tap(); router.navigate(`/notes?noteId=${n.id}` as any); }}
                    activeOpacity={0.8}
                  >
                    <FileText size={13} color={accentColor} style={{ marginTop: 1 }} />
                    <View style={{ flex: 1 }}>
                      <Text style={s.pinNoteTitle} numberOfLines={1}>{n.title || 'Bez tytułu'}</Text>
                      {!!n.body?.trim() && <Text style={s.pinNoteBody} numberOfLines={2}>{n.body.trim()}</Text>}
                      {(n.tags ?? []).length > 0 && (
                        <Text style={s.pinNoteTags} numberOfLines={1}>{n.tags.map(t => `#${t}`).join(' ')}</Text>
                      )}
                    </View>
                  </TouchableOpacity>
                ))}
                <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/notes' as any); }} activeOpacity={0.7}>
                  <Text style={[s.pinNoteMore, { color: accentColor }]}>Wszystkie notatki →</Text>
                </TouchableOpacity>
              </View>
            );

            nodes['tasks-work-row'] = (
            <View style={s.miniRow}>
              {/* Tasks tile */}
              <TouchableOpacity
                style={[s.miniCard, { backgroundColor: cardBgDark }]}
                onPress={() => router.navigate('/(tabs)/tasks' as any)}
                activeOpacity={0.8}
              >
                <View style={s.miniCardTop}>
                  <CheckCircle2 size={13} color={accentColor} />
                  <Text style={[s.miniCardNum, { color: colors.text.primary }]}>{pendingTasks.length}</Text>
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
                    <Text style={[s.miniCardNum, { color: colors.text.primary }]}>
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
                  onPress={() => router.navigate('/(tabs)/finances' as any)}
                  activeOpacity={0.8}
                >
                  <View style={s.miniCardTop}>
                    <Wallet size={13} color={accentColor} />
                    <Text style={[s.miniCardNum, { color: colors.text.primary }]}>
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
            );

            nodes['today-tasks'] = (todayTasks.length > 0 || overdueTasks.length > 0) && (() => {
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
                      <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/(tabs)/tasks' as any); }} style={s.todayMore}>
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
                        onPress={() => { haptic.tap(); router.navigate('/(tabs)/tasks' as any); }}
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
                            router.navigate('/pomodoro' as any);
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
            })();

            // tools-row removed — its shortcuts moved to tab headers (Humor/Liczniki/
            // Gablota → dashboard header, Skupienie/Pomodoro → tasks header) and the
            // per-tab action buttons (Nawyki, Notatki).

            nodes['countdowns'] = activeCountdowns.length > 0 && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <CalendarClock size={13} color={accentColor} />
                  <Text style={s.cardTitle}>Odliczania</Text>
                  <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/counters' as any); }} style={{ marginLeft: 'auto' }} activeOpacity={0.7}>
                    <Text style={[s.workToggleText, { color: accentColor }]}>Wszystkie</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ gap: spacing[3], marginTop: spacing[2] }}>
                  {activeCountdowns.slice(0, 3).map(cn => {
                    const during = isDuringEvent(cn);
                    const left = daysUntil(cn);
                    const endLeft = daysUntilEnd(cn);
                    const label = during
                      ? (endLeft <= 0 ? 'ostatni dzień!' : endLeft === 1 ? 'koniec jutro' : `koniec za ${endLeft} dni`)
                      : (left === 0 ? 'dziś!' : left === 1 ? 'jutro!' : `za ${left} dni`);
                    return (
                      <View key={cn.id}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 1 }}>
                          <Text style={s.cdName} numberOfLines={1}>{cn.name}</Text>
                          <Text style={[s.cdDays, during && { color: '#2AC68F' }]}>{label}</Text>
                        </View>
                        <WalkProgress progress={during ? eventProgress(cn) : untilProgress(cn)} color={during ? '#2AC68F' : accentColor} mode={during ? 'drive' : 'walk'} emoji={cn.emoji} />
                      </View>
                    );
                  })}
                </View>
              </View>
            );

            nodes['bank-queue'] = bankPendingCount > 0 && (
              <TouchableOpacity style={[s.card, { backgroundColor: cardBgDark }]} activeOpacity={0.85}
                onPress={() => { haptic.tap(); router.navigate('/bank-review' as any); }}>
                <View style={s.cardHeader}>
                  <Wallet size={13} color={colors.accent.green} />
                  <Text style={s.cardTitle}>Płatności z banku</Text>
                  <View style={{ marginLeft: 'auto', backgroundColor: colors.accent.green, borderRadius: 999, minWidth: 22, paddingHorizontal: 6, paddingVertical: 2, alignItems: 'center' }}>
                    <Text style={{ color: colors.bg.primary, fontWeight: '800', fontSize: 12 }}>{bankPendingCount}</Text>
                  </View>
                </View>
                <Text style={[s.factText, { marginTop: spacing[1] }]}>{bankPendingCount === 1 ? '1 płatność do zatwierdzenia' : `${bankPendingCount} płatności do zatwierdzenia`} · stuknij</Text>
              </TouchableOpacity>
            );

            nodes['counters-since'] = dashSince.length > 0 && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Hourglass size={13} color={accentColor} />
                  <Text style={s.cardTitle}>Liczniki</Text>
                  <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/counters' as any); }} style={{ marginLeft: 'auto' }} activeOpacity={0.7}>
                    <Text style={[s.workToggleText, { color: accentColor }]}>Wszystkie</Text>
                  </TouchableOpacity>
                </View>
                {/* The longest streak gets the rich card (flame + Mon–Sun strip); the
                    rest stay in the compact flame grid below it. */}
                {(() => {
                  const top = dashSince[0];
                  const topName = top.cn.mode === 'auto' ? `bez ${top.cn.name}` : top.cn.name;
                  return <StreakCard name={topName} days={top.days} />;
                })()}
                {dashSince.length > 1 && (
                  <View style={[s.sinceGrid, { marginTop: spacing[3] }]}>
                    {dashSince.slice(1, 7).map(({ cn, days }) => (
                      <View key={cn.id} style={s.sinceTile}>
                        <StreakFlame days={days} size={46} />
                        <Text style={s.sinceTileUnit}>{days === 1 ? 'dzień' : 'dni'}</Text>
                        <Text style={s.sinceTileName} numberOfLines={1}>{cn.mode === 'auto' ? `bez ${cn.name}` : cn.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            );

            nodes['streak-wall'] = streakWall.some(x => x.days > 0) && <StreakWallCard streaks={streakWall} cardBg={cardBgDark} />;
            nodes['personal-records'] = records.length > 0 && <PersonalRecordsCard records={records} cardBg={cardBgDark} />;
            nodes['trivia'] = <TriviaCard cardBg={cardBgDark} />;

            nodes['year-ago'] = yearAgo.has && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <History size={13} color={accentColor} />
                  <Text style={s.cardTitle}>Rok temu tego dnia</Text>
                </View>
                <Text style={[s.statSub, { marginBottom: spacing[2] }]}>{yearAgo.label}</Text>
                <View style={s.yearAgoRow}>
                  {yearAgo.mood != null && (
                    <View style={s.yearAgoStat}><Text style={[s.yearAgoVal, { color: accentColor }]}>{yearAgo.mood.toFixed(1)}/5</Text><Text style={s.yearAgoKey}>nastrój</Text></View>
                  )}
                  {yearAgo.hasSpend && (
                    <View style={s.yearAgoStat}><Text style={[s.yearAgoVal, { color: accentColor }]}>{Math.round(yearAgo.spend)} zł</Text><Text style={s.yearAgoKey}>wydane</Text></View>
                  )}
                  {yearAgo.steps > 0 && (
                    <View style={s.yearAgoStat}><Text style={[s.yearAgoVal, { color: accentColor }]}>{yearAgo.steps >= 1000 ? `${(yearAgo.steps / 1000).toFixed(1).replace('.0', '')}k` : yearAgo.steps}</Text><Text style={s.yearAgoKey}>kroków</Text></View>
                  )}
                </View>
              </View>
            );

            nodes['spend-bubbles'] = spendBubbles.rows.length > 0 && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Wallet size={13} color={accentColor} />
                  <Text style={s.cardTitle}>Wydatki — bąbelki</Text>
                  <Text style={s.bubbleTotal}>{Math.round(spendBubbles.total)} zł</Text>
                </View>
                <View style={s.bubbleWrap}>
                  {spendBubbles.rows.map(([cat, amt]) => {
                    const meta = getCategoryMeta(cat as any);
                    const d = 46 + Math.round(Math.sqrt(amt / spendBubbles.max) * 66); // 46..112 px
                    return (
                      <View key={cat} style={s.bubbleCol}>
                        <View style={[s.bubble, { width: d, height: d, borderRadius: d / 2, backgroundColor: meta.color + '24', borderColor: meta.color + '70' }]}>
                          <Text style={[s.bubbleAmt, { color: meta.color, fontSize: d < 62 ? 11 : 14 }]} numberOfLines={1}>{Math.round(amt)}</Text>
                        </View>
                        <Text style={s.bubbleLabel} numberOfLines={1}>{meta.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );

            nodes['price-watch'] = priceWatch.length > 0 && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <TrendingUp size={13} color="#F87171" />
                  <Text style={s.cardTitle}>Co podrożało</Text>
                </View>
                <Text style={[s.statSub, { marginBottom: spacing[1] }]}>Droższe niż wcześniej — ostatnie zakupy vs starsze</Text>
                {priceWatch.map((p, i) => (
                  <View key={i} style={s.pwRow}>
                    <Text style={s.pwName} numberOfLines={1}>{p.label}</Text>
                    <Text style={s.pwPrice}>{p.from.toFixed(2)} → {p.to.toFixed(2)} zł</Text>
                    <View style={s.pwPct}><Text style={s.pwPctTxt}>+{p.pct}%</Text></View>
                  </View>
                ))}
              </View>
            );

            nodes['gablota-card'] = (() => {
              const total = achStates.filter(st => st.a.kind !== 'bad').length;
              if (total === 0) return false;
              const pct = Math.min(1, earnedBadges / total);
              const left = total - earnedBadges;
              return (
                <TouchableOpacity style={[s.card, { backgroundColor: cardBgDark }]} activeOpacity={0.85}
                  onPress={() => { haptic.tap(); router.navigate('/achievements' as any); }}>
                  <View style={s.cardHeader}>
                    <Trophy size={13} color="#FFC83D" />
                    <Text style={s.cardTitle}>Gablota osiągnięć</Text>
                    <Text style={{ marginLeft: 'auto', fontSize: 13, fontWeight: '800', color: '#FFC83D' }}>{earnedBadges} / {total}</Text>
                  </View>
                  <View style={{ height: 9, borderRadius: 5, backgroundColor: colors.fill.subtle, overflow: 'hidden', marginTop: spacing[2] }}>
                    <View style={{ width: `${Math.round(pct * 100)}%`, height: '100%', backgroundColor: '#FFC83D', borderRadius: 5 }} />
                  </View>
                  <Text style={[s.factText, { marginTop: spacing[2] }]}>
                    {left > 0 ? `Jeszcze ${left} ${left === 1 ? 'odznaka' : 'odznak'} do zdobycia · stuknij` : 'Wszystkie zdobyte! 👑 stuknij'}
                  </Text>
                </TouchableOpacity>
              );
            })();

            nodes['habits-nudge'] = habits.length > 0 && new Date().getHours() >= 17 && (() => {
              const notDone = habits.filter(h => !habitsDoneIds.includes(h.id));
              if (notDone.length === 0) return null;
              const maxStreak = Math.max(...notDone.map(h => getStreak(h.id)));
              return (
                <TouchableOpacity
                  style={s.habitsNudge}
                  onPress={() => { haptic.tap(); router.navigate('/habits' as any); }}
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
            })();

            nodes['daily-rings'] = dailyRings.length > 0 && (
              <View style={[s.habitsCard, { backgroundColor: cardBgDark }]}>
                <View style={s.habitsHeader}>
                  <View style={s.habitsHeaderLeft}>
                    <Sparkles size={13} color={accentColor} />
                    <Text style={s.habitsTitle}>Cele na dziś</Text>
                  </View>
                </View>
                <DailyRings rings={dailyRings} />
              </View>
            );

            // One row per habit: the old widget only had a "how many habits are ticked"
            // bar + dots, so a count habit like water showed nothing but "not done" —
            // you couldn't see 3/8 glasses. Now each habit carries its OWN progress and
            // its streak, the same flame the Liczniki card uses.
            nodes['habits-today'] = habits.length > 0 && (() => {
              const doneCount = habitsDoneIds.length;
              const allDone   = doneCount === habits.length;
              const SHOWN = 6;
              return (
                <View style={[s.habitsCard, { backgroundColor: cardBgDark }]}>
                  <TouchableOpacity style={s.habitsHeader} activeOpacity={0.8}
                    onPress={() => { haptic.tap(); router.navigate('/habits' as any); }}>
                    <View style={s.habitsHeaderLeft}>
                      <Flame size={13} color={accentColor} />
                      <Text style={[s.habitsTitle, allDone && { color: accentColor }]}>
                        {allDone ? 'Nawyki na dziś gotowe!' : 'Nawyki — dziś'}
                      </Text>
                    </View>
                    <Text style={[s.habitsBadge, allDone && { color: accentColor }]}>
                      {doneCount}/{habits.length}
                    </Text>
                  </TouchableOpacity>

                  <View style={{ gap: spacing[2] }}>
                    {habits.slice(0, SHOWN).map(h => {
                      const done = habitsDoneIds.includes(h.id);
                      const isCount = h.type === 'count';
                      const goal = Math.max(1, h.dailyGoal ?? 1);
                      const count = isCount ? getTodayCount(h.id) : 0;
                      // count habits show REAL progress; a check habit is yes/no, so its
                      // bar is simply empty or full
                      const pct = isCount ? Math.min(1, count / goal) : (done ? 1 : 0);
                      const streak = getStreak(h.id);
                      const sc = streakColor(streak);
                      const HIcon = HABIT_ICON_MAP[h.icon] ?? Zap;
                      return (
                        <TouchableOpacity
                          key={h.id}
                          activeOpacity={0.7}
                          onPress={() => {
                            haptic.tap();
                            if (isCount) incrementHabit(h.id); else toggleHabit(h.id);
                          }}
                          style={s.hRow}
                        >
                          <View style={[s.hIcon, { backgroundColor: h.color + (done ? 'CC' : '22'), borderColor: h.color + (done ? 'CC' : '44') }]}>
                            <HIcon size={14} color={done ? colors.bg.primary : h.color} strokeWidth={2} />
                          </View>
                          <View style={{ flex: 1, minWidth: 0, gap: 5 }}>
                            <View style={s.hTop}>
                              <Text style={s.hName} numberOfLines={1}>{h.title}</Text>
                              {streak > 0 && (
                                <View style={[s.hStreak, { backgroundColor: sc + '22', borderColor: sc + '66' }]}>
                                  <Flame size={12} color={sc} fill={sc} />
                                  <Text style={[s.hStreakTxt, { color: sc }]}>{streak} {streak === 1 ? 'dzień' : 'dni'}</Text>
                                </View>
                              )}
                              <Text style={[s.hVal, { color: done ? h.color : colors.text.muted }]}>
                                {isCount ? `${count}/${goal}${h.unit ? ` ${h.unit}` : ''}` : (done ? 'zrobione' : '—')}
                              </Text>
                            </View>
                            <View style={s.hTrack}>
                              <View style={[s.hFill, { width: `${pct * 100}%` as any, backgroundColor: h.color }]} />
                            </View>
                          </View>
                          <View style={[s.hBtn, { borderColor: h.color + '55', backgroundColor: h.color + '14' }]}>
                            {isCount
                              ? <Plus size={15} color={h.color} />
                              : done
                                ? <Check size={15} color={h.color} />
                                : <View style={[s.hEmptyTick, { borderColor: h.color }]} />}
                          </View>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  {habits.length > SHOWN && (
                    <Text style={s.habitsMore}>+{habits.length - SHOWN} więcej — stuknij nagłówek</Text>
                  )}
                </View>
              );
            })();

            nodes['stats-scope'] = (
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
            );

            nodes['finances'] = (
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

              {/* spend vs previous period + vs average (lower = green, higher = red) */}
              {(finCompare.vsPrev != null || finCompare.vsAvg != null) && (
                <View style={s.finCompareRow}>
                  {finCompare.vsPrev != null && <SpendDelta pct={finCompare.vsPrev} label={finPeriod === 'week' ? 'vs poprz. tydzień' : 'vs poprz. mies.'} muted={colors.text.muted} />}
                  {finCompare.vsAvg != null && <SpendDelta pct={finCompare.vsAvg} label="vs Twoja średnia" muted={colors.text.muted} />}
                </View>
              )}
            </View>
            );

            nodes['sweets-vs-food'] = weekOverview.filter(w => w.food > 0 || w.sweets > 0).length >= 2 && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Wallet size={13} color={accentColor} />
                  <Text style={[s.cardTitle]} numberOfLines={1}>Słodkie vs jedzenie</Text>
                  <View style={s.dualLegend}>
                    <View style={s.dualLegendItem}>
                      <View style={[s.dualLegendLine, { backgroundColor: accentColor }]} />
                      <Text style={s.dualLegendLabel}>jedzenie</Text>
                    </View>
                    <View style={s.dualLegendItem}>
                      <View style={[s.dualLegendLine, { backgroundColor: accentColor, opacity: 0.4 }]} />
                      <Text style={s.dualLegendLabel}>słodkie</Text>
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
            );

            nodes['who-ate'] = personConsumption.totalSweets > 0 && payers.length >= 2 && (
              <WhoAteCard data={personConsumption} monthLabel={MONTH_SHORT[new Date().getMonth()]} />
            );

            nodes['fixed-variable'] = (() => {
              const cur = fvMonths[fvMonths.length - 1];
              if (!cur) return false;
              const totalCur = cur.fixed + cur.variable + cur.food;
              if (totalCur === 0) return false;
              const prev = fvMonths.slice(0, -1).filter(m => m.fixed + m.variable + m.food > 0);
              const avg = (sel: (m: typeof cur) => number) => prev.length ? Math.round(prev.reduce((a, m) => a + sel(m), 0) / prev.length) : sel(cur);
              const maxMonth = Math.max(...fvMonths.map(m => m.fixed + m.variable + m.food), 1);
              const MON = ['sty', 'lut', 'mar', 'kwi', 'maj', 'cze', 'lip', 'sie', 'wrz', 'paź', 'lis', 'gru'];
              const fixedC = '#8893A8', varC = accentColor, foodC = '#4CA96B';
              const H = 46;
              const fmt = (n: number) => n.toLocaleString('pl-PL');
              return (
                <View style={[s.card, { backgroundColor: cardBgDark }]}>
                  <View style={s.cardHeader}>
                    <Wallet size={13} color={accentColor} />
                    <Text style={s.cardTitle} numberOfLines={1}>Na co idą pieniądze</Text>
                    <Text style={s.fvHint}>ten miesiąc</Text>
                  </View>
                  {/* three categories as readable rows: dot · label · % · amount */}
                  <View style={{ gap: 7 }}>
                    {([['Stałe', cur.fixed, fixedC], ['Zmienne', cur.variable, varC], ['Jedzenie', cur.food, foodC]] as const).map(([lbl, val, col]) => (
                      <View key={lbl} style={s.fvRow}>
                        <View style={[s.fvDot, { backgroundColor: col }]} />
                        <Text style={s.fvRowLbl}>{lbl}</Text>
                        <Text style={s.fvRowPct}>{Math.round((val / totalCur) * 100)}%</Text>
                        <Text style={[s.fvRowAmt, { color: col }]}>{fmt(val)} zł</Text>
                      </View>
                    ))}
                  </View>
                  <View style={s.fvBar}>
                    <View style={{ flex: Math.max(cur.fixed, 0.001), backgroundColor: fixedC }} />
                    <View style={{ flex: Math.max(cur.variable, 0.001), backgroundColor: varC }} />
                    <View style={{ flex: Math.max(cur.food, 0.001), backgroundColor: foodC }} />
                  </View>

                  {/* what the FIXED cost is made of — one item per row, not a cram */}
                  {fvFixedItems.length > 0 && (
                    <View style={s.fvFixBox}>
                      <Text style={s.fvFixHead}>STAŁE — SKŁADNIKI</Text>
                      {fvFixedItems.slice(0, 4).map(it => (
                        <View key={it.label} style={s.fvFixRow}>
                          <Text style={s.fvFixLbl} numberOfLines={1}>{it.label}</Text>
                          <Text style={s.fvFixAmt}>{fmt(it.amount)} zł</Text>
                        </View>
                      ))}
                      {fvFixedItems.length > 4 && <Text style={s.fvFixMore}>+{fvFixedItems.length - 4} więcej</Text>}
                    </View>
                  )}

                  {prev.length > 0 && (
                    <>
                      <View style={s.fvLegend}>
                        {([['Stałe', fixedC], ['Zmienne', varC], ['Jedzenie', foodC]] as const).map(([lbl, col]) => (
                          <View key={lbl} style={s.fvLegItem}><View style={[s.fvDotSm, { backgroundColor: col }]} /><Text style={s.fvLegTxt}>{lbl}</Text></View>
                        ))}
                      </View>
                      <View style={s.fvTrend}>
                        {fvMonths.map((m, i) => (
                          <View key={m.month} style={{ flex: 1, alignItems: 'center', gap: 5 }}>
                            <View style={{ width: 20, height: H, justifyContent: 'flex-end', borderRadius: 4, overflow: 'hidden', backgroundColor: colors.fill.subtle }}>
                              <View style={{ height: (m.food / maxMonth) * H, backgroundColor: foodC }} />
                              <View style={{ height: (m.variable / maxMonth) * H, backgroundColor: varC }} />
                              <View style={{ height: (m.fixed / maxMonth) * H, backgroundColor: fixedC }} />
                            </View>
                            <Text style={[s.fvMonthLbl, i === fvMonths.length - 1 && { color: accentColor, fontWeight: '800' }]}>{MON[parseInt(m.month.slice(5, 7), 10) - 1]}</Text>
                          </View>
                        ))}
                      </View>
                      <Text style={s.fvAvg}>śr. {prev.length} mies.: stałe {fmt(avg(m => m.fixed))} · zmienne {fmt(avg(m => m.variable))} · jedzenie {fmt(avg(m => m.food))} zł</Text>
                    </>
                  )}
                </View>
              );
            })();

            nodes['spend-by-day'] = weekdayAvg.some(d => d.avg > 0) && (
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
            );

            nodes['work-hours'] = workMonthly && (workMonthly.currentHours > 0 || workMonthly.months.some(m => m.hours > 0)) && (() => {
              const wm = workMonthly;
              const hasRate = wm.rate > 0;
              return (
                <TouchableOpacity style={[s.card, { backgroundColor: cardBgDark }]} activeOpacity={0.9}
                  onPress={() => { haptic.tap(); setWorkPanel(true); }}>
                  <View style={s.cardHeader}>
                    <Briefcase size={13} color={accentColor} />
                    <Text style={s.cardTitle}>Praca</Text>
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
                    <>
                      <View style={s.workHeroRow}>
                        <View style={{ flex: 1 }}>
                          <Text style={[s.workHoursBig, { color: colors.text.primary }]}>
                            {wm.workedH.toFixed(0)}
                            <Text style={s.workHoursUnit}> h</Text>
                          </Text>
                          <Text style={s.workHoursSub}>
                            przepracowane w tym miesiącu{hasRate ? `  ·  ≈ ${wm.workedEarnings.toLocaleString('pl-PL')} zł` : ''}
                          </Text>
                        </View>
                      </View>

                      {wm.plannedH > 0 && (
                        <View style={{ marginTop: spacing[3] }}>
                          <View style={s.workSplitBar}>
                            <View style={{ flex: Math.max(wm.workedH, 0.001), backgroundColor: accentColor }} />
                            <View style={{ flex: Math.max(wm.plannedH, 0.001), backgroundColor: accentColor + '40' }} />
                          </View>
                          <Text style={s.workSplitText}>
                            <Text style={{ color: accentColor, fontWeight: '700' }}>{wm.workedH.toFixed(0)} h do teraz</Text>
                            {`  ·  zaplanowane +${wm.plannedH.toFixed(0)} h`}
                          </Text>
                        </View>
                      )}

                      {wm.daysWorked > 0 && (
                        <Text style={s.workMeta}>
                          {wm.daysWorked} {wm.daysWorked === 1 ? 'dzień' : 'dni'} · śr. {wm.avgPerDay.toFixed(1)} h/dzień{hasRate ? ` · ${Math.round(wm.avgPerDay * wm.rate).toLocaleString('pl-PL')} zł/dzień` : ''}
                        </Text>
                      )}
                    </>
                  ) : (
                    <>
                      <View style={s.waveValues}>
                        {wm.months.map((m, i) => (
                          <Text key={i} style={[s.waveValue, m.isCurrent && { color: accentColor, fontWeight: '800' }]}>
                            {hasRate
                              ? (m.earnings > 0 ? (m.earnings >= 1000 ? `${(m.earnings / 1000).toFixed(1)}k` : String(m.earnings)) : '')
                              : (m.hours > 0 ? `${Math.round(m.hours)}h` : '')}
                          </Text>
                        ))}
                      </View>
                      <WaveChart data={wm.months.map(m => hasRate ? m.earnings : m.hours)} color={accentColor} />
                      <View style={s.waveLabels}>
                        {wm.months.map((m, i) => (
                          <Text key={i} style={[s.waveLabel, m.isCurrent && { color: accentColor, fontWeight: '700' }]}>
                            {m.label}
                          </Text>
                        ))}
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              );
            })();

            nodes['top-products'] = topProducts.length > 0 && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <ShoppingCart size={13} color={accentColor} />
                  <Text style={s.cardTitle}>Najczęściej kupowane</Text>
                </View>
                <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
                  {topProducts.map((p, i) => {
                    const max = topProducts[0].count || 1;
                    const medals = ['#FBBF24', '#9CA3AF', '#B45309', accentColor, accentColor];
                    const hasVariants = p.variants.length > 1;
                    const open = expandedProduct === p.name;
                    return (
                      <TouchableOpacity
                        key={p.name}
                        activeOpacity={hasVariants ? 0.7 : 1}
                        onPress={() => { if (hasVariants) { haptic.tap(); setExpandedProduct(open ? null : p.name); } }}
                        style={s.topRow}
                      >
                        <View style={[s.topRank, { backgroundColor: medals[i] + '22', borderColor: medals[i] + '55' }]}>
                          <Text style={[s.topRankText, { color: medals[i] }]}>{i + 1}</Text>
                        </View>
                        <View style={{ flex: 1 }}>
                          <View style={s.topNameRow}>
                            <Text style={s.topName} numberOfLines={1}>{p.name}{hasVariants ? ` · ${p.variants.length} rodz.` : ''}</Text>
                            <Text style={s.topCount}>×{p.count}</Text>
                          </View>
                          <View style={s.topBarTrack}>
                            <View style={[s.topBarFill, { width: `${Math.max(8, (p.count / max) * 100)}%`, backgroundColor: accentColor }]} />
                          </View>
                          {open && (
                            <View style={s.variantWrap}>
                              {p.variants.map(v => (
                                <View key={v.name} style={s.variantRow}>
                                  <Text style={s.variantName} numberOfLines={1}>{v.name}</Text>
                                  <Text style={s.variantCount}>×{v.count}</Text>
                                </View>
                              ))}
                            </View>
                          )}
                        </View>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );

            nodes['fun-facts'] = (funFacts.length > 0 || weightFacts.length > 0) && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Sparkles size={13} color={accentColor} />
                  <Text style={s.cardTitle}>Ciekawostki</Text>
                </View>
                <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
                  {weightFacts.map((label, i) => (
                    <View key={`w${i}`} style={s.factRow}>
                      <View style={[s.factIcon, { backgroundColor: accentColor + '18' }]}>
                        <Scale size={13} color={accentColor} />
                      </View>
                      <Text style={s.factText} numberOfLines={2}>{label}</Text>
                    </View>
                  ))}
                  {funFacts.map((f, i) => {
                    const Icon = f.icon === 'calendar' ? CalendarDays
                      : f.icon === 'percent' ? BarChart2
                      : f.icon === 'store' ? Store
                      : f.icon === 'wallet' ? Wallet
                      : f.icon === 'candy' ? Candy
                      : f.icon === 'footprints' ? Footprints
                      : f.icon === 'clock' ? Timer : Flame;
                    return (
                      <View key={i} style={s.factRow}>
                        <View style={[s.factIcon, { backgroundColor: accentColor + '18' }]}>
                          <Icon size={13} color={accentColor} />
                        </View>
                        <Text style={s.factText} numberOfLines={2}>{f.label}</Text>
                      </View>
                    );
                  })}
                </View>
              </View>
            );

            nodes['correlations'] = correlations.length > 0 && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Link2 size={13} color={accentColor} />
                  <Text style={s.cardTitle}>Zależności</Text>
                </View>
                <View style={{ gap: spacing[2], marginTop: spacing[1] }}>
                  {correlations.map((co, i) => (
                    <View key={i} style={s.factRow}>
                      <View style={[s.factIcon, { backgroundColor: accentColor + '18' }]}>
                        <Link2 size={13} color={accentColor} />
                      </View>
                      <Text style={s.factText} numberOfLines={2}>{co.text}</Text>
                    </View>
                  ))}
                </View>
                <Text style={[s.factText, { color: colors.text.muted, fontSize: 10, marginTop: spacing[2] }]}>
                  Obserwacja z Twoich dni — nie musi oznaczać przyczyny.
                </Text>
              </View>
            );

            nodes['mood-cal'] = Object.keys(moodByDay).some(d => d.startsWith(`${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`)) && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Smile size={13} color={colors.text.muted} />
                  <Text style={s.cardTitle}>Nastrój — ten miesiąc</Text>
                </View>
                <MoodMiniCal moodByDay={moodByDay} />
              </View>
            );

            nodes['mood-wave'] = weekOverview.filter(w => w.avgMood !== null).length >= 3 && (
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
            );

            nodes['month-tasks'] = (() => {
              const now = new Date();
              const monthStr = `${now.getFullYear()}-${pad(now.getMonth() + 1)}`;
              const monthDone   = calTasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(monthStr)).length;
              const monthActive = calTasks.filter(t => t.status !== 'done').length;
              if (monthDone + monthActive === 0) return null;
              return (
                <TouchableOpacity style={[s.card, { backgroundColor: cardBgDark }]} onPress={() => router.navigate('/(tabs)/tasks' as any)} activeOpacity={0.8}>
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
            })();

            nodes['gcal'] = (gcalToday.length > 0 || gcalTomorrow.length > 0) && (
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
            );

              // custom user tiles
              for (const t of customTiles) nodes[t.id] = renderCustomTile(t);

              // ── Edit mode: reorder / hide / add / reset ──────────────────
              if (editingDash) {
                return (
                  <View style={{ gap: spacing[2] }}>
                    <View style={s.editBanner}>
                      <Text style={[s.editBannerText, { flex: 1 }]}>
                        Trzymaj uchwyt ∥ i przeciągnij, albo strzałki. Oko = ukryj. Alerty
                        (wypłata, bank, budżet) pojawiają się same — nie ma ich tu.
                      </Text>
                      <TouchableOpacity style={[s.editDoneBtn, { borderColor: accentColor + '66', backgroundColor: accentColor + '20' }]} onPress={() => { haptic.tap(); setEditingDash(false); }}>
                        <Check size={13} color={accentColor} />
                        <Text style={[s.editDoneText, { color: accentColor }]}>Gotowe</Text>
                      </TouchableOpacity>
                    </View>
                    {/* Only VISIBLE, USER-ARRANGEABLE sections here — hidden ones live in the
                        add pool, and auto alerts (payday/bank/budget…) are managed by the
                        app, so they never appear in the editor as "brak danych" clutter. */}
                    {orderedSections.filter(id => !hiddenSet.has(id) && !isAutoSection(id)).map((id, idx, arr) => {
                      const isCustom = id.startsWith('custom:');
                      const ct = isCustom ? customTiles.find(t => t.id === id) : null;
                      const title = isCustom ? (ct?.title ?? 'Kafelek') : (SECTION_TITLES[id] ?? id);
                      const desc = isCustom ? (ct?.type === 'stat' ? 'Twój widget statystyk' : ct?.type === 'note' ? 'Notatka' : ct?.type === 'weather' ? 'Pogoda' : 'Twój kafelek') : (SECTION_DESC[id] ?? '');
                      return (
                        <DashEditRow
                          key={id}
                          id={id}
                          index={idx}
                          count={arr.length}
                          title={title}
                          desc={desc}
                          isCustom={isCustom}
                          hiddenNow={false}
                          empty={!nodes[id]}
                          accent={accentColor}
                          cardBg={cardBgDark}
                          onMoveDir={moveVisible}
                          onMoveTo={handleMoveTo}
                          onToggleHidden={toggleHiddenSection}
                          onRemove={(rid) => Alert.alert('Usuń kafelek', `Na pewno usunąć „${title}"?`, [
                            { text: 'Anuluj', style: 'cancel' },
                            { text: 'Usuń', style: 'destructive', onPress: () => removeCustomTile(rid) },
                          ])}
                          onEdit={ct?.type === 'stat' ? () => router.navigate(`/widget-builder?edit=${id}` as any) : undefined}
                        />
                      );
                    })}

                    {/* Hidden sections live in a collapsible pool — tap + to bring one back. */}
                    {(() => {
                      // auto alerts are never in the pool either — they aren't yours to add
                      const hidden = orderedSections.filter(id => hiddenSet.has(id) && !isAutoSection(id));
                      if (hidden.length === 0) return null;
                      return (
                        <>
                          <TouchableOpacity style={[s.editAddBtn, { borderStyle: 'solid' }]} onPress={() => { haptic.tap(); setShowHiddenPool(v => !v); }} activeOpacity={0.85}>
                            <Plus size={15} color={accentColor} />
                            <Text style={[s.editAddText, { color: accentColor }]}>Dodaj sekcję ({hidden.length} wyłączonych)</Text>
                            <ChevronDown size={14} color={accentColor} style={showHiddenPool && { transform: [{ rotate: '180deg' }] }} />
                          </TouchableOpacity>
                          {showHiddenPool && (() => {
                            // Group the hidden sections by category (+ custom tiles last)
                            // so the picker reads as a tidy menu with descriptions.
                            const byGroup: Record<string, string[]> = {};
                            for (const id of hidden) {
                              const g = id.startsWith('custom:') ? 'Twoje kafelki' : (SECTION_GROUP[id] ?? 'Inne');
                              (byGroup[g] ??= []).push(id);
                            }
                            const groupOrder = [...SECTION_GROUP_ORDER, 'Twoje kafelki'].filter(g => byGroup[g]?.length);
                            return groupOrder.map(g => (
                              <View key={g} style={{ marginTop: spacing[2] }}>
                                <Text style={s.hiddenGroupLabel}>{g}</Text>
                                {byGroup[g].map(id => {
                                  const isCustom = id.startsWith('custom:');
                                  const ct = isCustom ? customTiles.find(t => t.id === id) : null;
                                  const title = isCustom ? (ct?.title ?? 'Kafelek') : (SECTION_TITLES[id] ?? id);
                                  const desc = isCustom ? null : SECTION_DESC[id];
                                  return (
                                    <TouchableOpacity key={id} style={s.hiddenRow} onPress={() => { haptic.tap(); toggleHiddenSection(id); setShowHiddenPool(true); }} activeOpacity={0.8}>
                                      <View style={[s.hiddenAddIcon, { borderColor: accentColor + '66' }]}><Plus size={13} color={accentColor} /></View>
                                      <View style={{ flex: 1 }}>
                                        <Text style={s.hiddenRowText} numberOfLines={1}>{title}{!nodes[id] ? '  · brak danych' : ''}</Text>
                                        {desc ? <Text style={s.hiddenRowDesc} numberOfLines={1}>{desc}</Text> : null}
                                      </View>
                                    </TouchableOpacity>
                                  );
                                })}
                              </View>
                            ));
                          })()}
                        </>
                      );
                    })()}

                    <TouchableOpacity style={s.editAddBtn} onPress={() => { haptic.tap(); router.navigate('/widget-builder' as any); }} activeOpacity={0.85}>
                      <BarChart2 size={15} color={accentColor} />
                      <Text style={[s.editAddText, { color: accentColor }]}>Dodaj widget statystyk</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.editAddBtn} onPress={() => { haptic.tap(); setNotePickerOpen(true); }} activeOpacity={0.85}>
                      <Plus size={15} color={accentColor} />
                      <Text style={[s.editAddText, { color: accentColor }]}>Dodaj kafelek z notatką</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.editAddBtn} onPress={() => { haptic.tap(); addCustomTile({ type: 'weather', title: 'Pogoda' }); }} activeOpacity={0.85}>
                      <CloudSun size={15} color={accentColor} />
                      <Text style={[s.editAddText, { color: accentColor }]}>Dodaj kafelek z pogodą</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.editResetBtn} onPress={() => { haptic.medium(); resetLayout(); }} activeOpacity={0.8}>
                      <RotateCcw size={13} color={colors.text.muted} />
                      <Text style={s.editResetText}>Przywróć domyślny układ</Text>
                    </TouchableOpacity>
                  </View>
                );
              }

              // ── Normal mode: render sections in saved order, skip hidden ──
              // The payday prompt is PINNED to the very top whenever it's due, so
              // it can't be reordered/buried — it just stays until you confirm it.
              return (
                <>
                  {/* Bank payments needing confirmation are PINNED to the very top so a
                      flagged/uncertain auto-payment is the first thing you see. */}
                  {!hiddenSet.has('bank-queue') && nodes['bank-queue']}
                  {!hiddenSet.has('payday-prompt') && nodes['payday-prompt']}
                  {!hiddenSet.has('bill-suggest') && nodes['bill-suggest']}
                  {orderedSections.map(id => {
                    if (id === 'payday-prompt') return null; // rendered pinned above
                    if (id === 'bill-suggest') return null;  // rendered pinned above
                    if (id === 'bank-queue') return null;    // rendered pinned above
                    if (hiddenSet.has(id)) return null;
                    const node = nodes[id];
                    if (node === undefined) return null;
                    return <React.Fragment key={id}>{node}</React.Fragment>;
                  })}
                </>
              );
            })()}

            <View style={{ height: 220 }} />
          </ScrollView>
        </View>
      </SafeAreaView>

      {/* Mood check-in modal */}
      <MoodCheckInModal visible={modalVisible} onClose={closeCheckIn} existingEntry={todayEntry ?? null} />

      {/* Work panel */}
      <Modal visible={workPanel} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setWorkPanel(false)}>
        <View style={s.npOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setWorkPanel(false)} />
          <View style={[s.card, { backgroundColor: colors.bg.card }]}>
            <View style={s.cardHeader}>
              <Briefcase size={14} color={accentColor} />
              <Text style={s.cardTitle}>Praca</Text>
              <TouchableOpacity onPress={() => setWorkPanel(false)} hitSlop={10} style={{ marginLeft: 'auto' }}>
                <X size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            {!workMonthly ? (
              <Text style={[s.factText, { marginTop: spacing[2] }]}>Ustaw kolor lub prefiks pracy w kalendarzu, aby liczyć godziny i zarobek.</Text>
            ) : (() => {
              const wm = workMonthly; const hasRate = wm.rate > 0;
              return (
                <ScrollView style={{ maxHeight: 460 }} showsVerticalScrollIndicator={false}>
                  {/* ── Ten miesiąc: fakt = godziny z kalendarza [JD] ── */}
                  <View style={{ marginTop: spacing[2] }}>
                    <Text style={s.wpBig}>{wm.workedH.toFixed(0)}<Text style={s.wpUnit}> h</Text></Text>
                    <Text style={s.wpSub}>
                      przepracowane w tym miesiącu
                      {wm.plannedH > 0 ? ` · +${wm.plannedH.toFixed(0)} h w planie` : ''}
                      {hasRate ? `  ·  ≈ ${wm.workedEarnings.toLocaleString('pl-PL')} zł do teraz` : ''}
                    </Text>
                  </View>

                  {/* ── Stawka: JEDNA liczba, ta sama co live earnings ── */}
                  {hasRate ? (() => {
                    const nowYM = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`;
                    const overridden = !!(workSettings.monthRateOverride?.[nowYM] || (workSettings.rateOverride && workSettings.rateOverride > 0));
                    const lp = workPayMonths[0];
                    const hint = overridden
                      ? 'stawka ustawiona ręcznie'
                      : (workAvg.includedCount <= 1 && lp && lp.hours > 0
                          ? `${Math.round(lp.amount).toLocaleString('pl-PL')} zł (za ${MONTH_SHORT[Number(lp.month.slice(5, 7)) - 1]}) ÷ ${Math.round(lp.hours)} h`
                          : `średnia z ${workAvg.includedCount} ${workAvg.includedCount === 1 ? 'wypłaty' : 'wypłat'} · Σ zł ÷ Σ godzin`);
                    return (
                      <View style={s.wpRateCard}>
                        <Text style={s.wpRateVal}>{wm.rate.toFixed(2)}<Text style={s.wpRateUnit}> zł/h</Text></Text>
                        <Text style={s.wpRateHint}>{hint}</Text>
                      </View>
                    );
                  })() : (
                    <Text style={[s.factText, { marginTop: spacing[2] }]}>Dodaj wypłatę oznaczoną „{workSettings.workPrefix || '[JD]'}", aby policzyć stawkę zł/h.</Text>
                  )}

                  {/* ── Wypłaty: realne dane, jedna na miesiąc (wypłata = za poprzedni) ── */}
                  {workPayMonths.length > 0 && (
                    <View style={{ marginTop: spacing[3], borderTopWidth: 1, borderTopColor: colors.border.subtle, paddingTop: spacing[2] }}>
                      <Text style={s.wxSection}>Wypłaty · stawka = wypłata ÷ godziny miesiąca</Text>
                      {workPayMonths.map(r => {
                        const rate = r.hours > 0 ? r.amount / r.hours : null;
                        const inAvg = !r.excluded && r.hours > 0;
                        return (
                          <View key={r.month} style={s.wmRow}>
                            <Text style={[s.wmMonth, !inAvg && { color: colors.text.muted }]} numberOfLines={1}>{MONTH_SHORT[Number(r.month.slice(5, 7)) - 1]} {r.month.slice(2, 4)}{r.excluded ? ' · poza śr.' : (r.count > 1 ? ` · ${r.count}×` : '')}</Text>
                            <Text style={s.wmH} numberOfLines={1}>{Math.round(r.amount).toLocaleString('pl-PL')} zł · {r.hours > 0 ? `${Math.round(r.hours)} h` : 'brak h'}</Text>
                            <Text style={[s.wmZl, { color: inAvg ? '#FBBF24' : colors.text.muted }]}>{rate != null ? `${rate.toFixed(1)}` : '—'}</Text>
                          </View>
                        );
                      })}
                      {(() => {
                        const paychecks = expenses.filter(e => isPaycheck(e, workSettings.workPrefix));
                        const jdTotal = paychecks.reduce((sum, e) => sum + e.amount, 0);
                        return jdTotal > 0 ? (
                          <View style={s.wpTotalRow}>
                            <Text style={s.wpTotalLabel}>Łącznie{workSettings.workPrefix ? ` (${workSettings.workPrefix})` : ''} · {paychecks.length} wypł.</Text>
                            <Text style={[s.wpTotalVal, { color: accentColor }]}>{Math.round(jdTotal).toLocaleString('pl-PL')} zł</Text>
                          </View>
                        ) : null;
                      })()}
                      <Text style={[s.factText, { color: colors.text.muted, fontSize: 10.5, marginTop: spacing[1] }]}>Kolumna po prawej = zł/h. Miesiące bez godzin w kalendarzu wypadają ze średniej — włącz/wyłącz je w Ustawienia → Praca.</Text>
                    </View>
                  )}

                  {/* ── Godziny: ostatnie 6 miesięcy (najpewniejszy sygnał) ── */}
                  <Text style={s.wxSection}>Godziny — ostatnie 6 miesięcy</Text>
                  <View style={s.waveValues}>
                    {wm.months.map((m, i) => (
                      <Text key={i} style={[s.waveValue, m.isCurrent && { color: accentColor, fontWeight: '800' }]}>
                        {m.hours > 0 ? `${Math.round(m.hours)}h` : ''}
                      </Text>
                    ))}
                  </View>
                  <WaveChart data={wm.months.map(m => m.hours)} color={accentColor} />
                  <View style={s.waveLabels}>
                    {wm.months.map((m, i) => (
                      <Text key={i} style={[s.waveLabel, m.isCurrent && { color: accentColor, fontWeight: '700' }]}>{m.label}</Text>
                    ))}
                  </View>

                  {/* ── Rok: fakty łączne ── */}
                  <View style={s.wxChips}>
                    {wm.daysWorked > 0 && <View style={s.wxChip}><Text style={s.wxChipK}>Dni w pracy (mies.)</Text><Text style={s.wxChipV}>{wm.daysWorked}{wm.avgPerDay > 0 ? ` · ${wm.avgPerDay.toFixed(1)} h/dzień` : ''}</Text></View>}
                    {wm.yearHours > 0 && <View style={s.wxChip}><Text style={s.wxChipK}>Rok {new Date().getFullYear()}</Text><Text style={s.wxChipV}>{wm.yearHours.toFixed(0)} h{hasRate ? ` · ${wm.yearEarnings.toLocaleString('pl-PL')} zł` : ''}</Text></View>}
                  </View>
                </ScrollView>
              );
            })()}
          </View>
        </View>
      </Modal>

      {/* Custom stat widget — multi-month detail */}
      <Modal visible={!!statDetail} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setStatDetail(null)}>
        <TouchableOpacity style={s.npOverlay} activeOpacity={1} onPress={() => setStatDetail(null)}>
          <TouchableOpacity activeOpacity={1} style={[s.card, { backgroundColor: colors.bg.card }]} onPress={() => {}}>
            {statDetail && (() => {
              const def = metricById(statDetail.metric);
              // COMPARE of two DIFFERENT metrics (e.g. przekąski vs słodycze): the single
              // metric detail showed only side A ("9 zł"), which read as nonsense. Show
              // both, with names, over 6 months.
              const m2 = statDetail.metric2;
              if (m2 && m2 !== '__self__' && m2 !== '__avg__') {
                const defB2 = metricById(m2);
                const aS = metricSeries(statDetail.metric!, statCtx, 'month', 6, statDetail.tag);
                const bS = defB2 ? metricSeries(m2, statCtx, 'month', 6) : { values: aS.values.map(() => 0), labels: aS.labels, unit: '' };
                const aLab = metricTagLabel(def, statDetail.tag);
                const bLab = defB2?.label ?? '—';
                const aN = aS.values[aS.values.length - 1] ?? 0;
                const bN = bS.values[bS.values.length - 1] ?? 0;
                const maxB = Math.max(...aS.values, ...bS.values, 1);
                const HB = 60;
                return (
                  <>
                    <View style={s.cardHeader}>
                      <BarChart2 size={14} color={accentColor} />
                      <Text style={s.cardTitle} numberOfLines={1}>{statDetail.title || 'Porównanie'}</Text>
                      <TouchableOpacity onPress={() => setStatDetail(null)} hitSlop={10} style={{ marginLeft: 'auto' }}><X size={18} color={colors.text.muted} /></TouchableOpacity>
                    </View>
                    <View style={[s.statCmpRow, { marginTop: spacing[2] }]}>
                      <View style={{ flex: 1 }}><View style={s.cmpDotRow}><View style={[s.cmpDot, { backgroundColor: accentColor }]} /><Text style={s.statCmpKey} numberOfLines={1}>{aLab}</Text></View><Text style={[s.statCmpVal, { color: accentColor }]}>{fmtStat(aN, aS.unit)}</Text></View>
                      <View style={{ flex: 1, alignItems: 'flex-end' }}><View style={s.cmpDotRow}><View style={[s.cmpDot, { backgroundColor: '#FBBF24' }]} /><Text style={s.statCmpKey} numberOfLines={1}>{bLab}</Text></View><Text style={[s.statCmpVal, { color: '#FBBF24' }]}>{fmtStat(bN, bS.unit)}</Text></View>
                    </View>
                    <Text style={s.wxSection}>Ostatnie 6 miesięcy</Text>
                    <View style={s.tagHistChart}>
                      {aS.values.map((v, i) => (
                        <View key={i} style={s.tagHistCol}>
                          <View style={{ alignItems: 'center' }}>
                            <Text style={[s.tagHistVal, { color: accentColor }]} numberOfLines={1}>{v > 0 ? fmtChartPt(v, aS.unit) : ''}</Text>
                            <Text style={[s.tagHistVal, { color: '#FBBF24' }]} numberOfLines={1}>{(bS.values[i] ?? 0) > 0 ? fmtChartPt(bS.values[i] ?? 0, bS.unit) : ''}</Text>
                          </View>
                          <View style={{ height: HB, width: 26, justifyContent: 'flex-end', flexDirection: 'row', alignItems: 'flex-end', gap: 3 }}>
                            <View style={{ width: 10, height: Math.max(2, (v / maxB) * HB), borderRadius: 3, backgroundColor: accentColor }} />
                            <View style={{ width: 10, height: Math.max(2, ((bS.values[i] ?? 0) / maxB) * HB), borderRadius: 3, backgroundColor: '#FBBF24' }} />
                          </View>
                          <Text style={s.tagHistLbl}>{aS.labels[i]}</Text>
                        </View>
                      ))}
                    </View>
                  </>
                );
              }
              // LIST metrics (favSweets, topProducts, byCategory) have no time series — the
              // detail must show the RANKED LIST, not a 6-month bar chart. Rendering a
              // series for them was the "coś dziwnego" (a chart of zeros / nonsense).
              if (def && !def.periodic) {
                const rows = metricList(statDetail.metric!, statCtx, 12);
                const maxV = rows[0]?.value || 1;
                return (
                  <>
                    <View style={s.cardHeader}>
                      <BarChart2 size={14} color={accentColor} />
                      <Text style={s.cardTitle} numberOfLines={1}>{statDetail.title || def.label || 'Widget'}</Text>
                      <TouchableOpacity onPress={() => setStatDetail(null)} hitSlop={10} style={{ marginLeft: 'auto' }}><X size={18} color={colors.text.muted} /></TouchableOpacity>
                    </View>
                    {rows.length === 0 ? (
                      <Text style={[s.statSub, { marginTop: spacing[3] }]}>Brak danych jeszcze.</Text>
                    ) : (
                      <View style={{ marginTop: spacing[2], gap: spacing[2] }}>
                        {rows.map((r, i) => (
                          <View key={r.label + i} style={s.statListRow2}>
                            <Text style={s.statListRank}>{i + 1}</Text>
                            <View style={{ flex: 1, gap: 4 }}>
                              <View style={s.topNameRow}>
                                <Text style={s.statListLabel} numberOfLines={1}>{r.label}</Text>
                                <Text style={[s.statListVal, { color: accentColor }]}>{fmtStat(r.value, r.unit)}</Text>
                              </View>
                              <View style={s.topBarTrack}><View style={[s.topBarFill, { width: `${Math.max(6, (r.value / maxV) * 100)}%`, backgroundColor: accentColor }]} /></View>
                            </View>
                          </View>
                        ))}
                      </View>
                    )}
                  </>
                );
              }
              const ser = metricSeries(statDetail.metric!, statCtx, detailPeriod, 6, statDetail.tag);
              const cur = metricNumber(statDetail.metric!, statCtx, detailPeriod, statDetail.tag);
              const vals = ser.values;
              const max = Math.max(...vals, statDetail.target ?? 0, 1);
              const H = 64;
              const nz = vals.filter(v => v > 0);
              const avg = nz.length ? nz.reduce((a, b) => a + b, 0) / nz.length : 0;
              const peak = Math.max(...vals, 0);
              // Zoom the axis when values sit in a narrow high band (e.g. weight
              // ~70-72 kg) so small changes are visible, not a row of full bars.
              const nzMin = nz.length ? Math.min(...nz) : 0;
              const floor = (nz.length >= 2 && nzMin > max * 0.5) ? Math.max(0, nzMin - Math.max(0.4, max - nzMin) * 0.8) : 0;
              const span = (max - floor) || 1;
              // overall (all-time) average — for weight, across every logged day.
              const allW = statDetail.metric === 'weight'
                ? Object.values(statCtx.healthDays).map(d => d.weightKg).filter((w): w is number => !!w && w > 0) : [];
              const overallAvg = allW.length ? allW.reduce((a, b) => a + b, 0) / allW.length : 0;
              const u = ser.unit ? ' ' + ser.unit : '';
              const fmt = (v: number) => fmtWave(v, ser.unit);
              return (
                <>
                  <View style={s.cardHeader}>
                    <BarChart2 size={14} color={accentColor} />
                    <Text style={s.cardTitle} numberOfLines={1}>{statDetail.title || def?.label || 'Widget'}</Text>
                    <TouchableOpacity onPress={() => setStatDetail(null)} hitSlop={10} style={{ marginLeft: 'auto' }}><X size={18} color={colors.text.muted} /></TouchableOpacity>
                  </View>
                  {/* week/month toggle — flip the same metric between weekly and monthly view */}
                  <View style={s.detailToggle}>
                    {(['week', 'month'] as const).map(p => {
                      const on = detailPeriod === p;
                      return (
                        <TouchableOpacity key={p} onPress={() => { haptic.tap(); setDetailPeriod(p); }} activeOpacity={0.8}
                          style={[s.detailToggleBtn, on && { backgroundColor: accentColor + '22', borderColor: accentColor }]}>
                          <Text style={[s.detailToggleTxt, on && { color: accentColor, fontWeight: '800' }]}>{p === 'week' ? 'Tydzień' : 'Miesiąc'}</Text>
                        </TouchableOpacity>
                      );
                    })}
                  </View>
                  <View style={{ marginTop: spacing[2] }}>
                    <Text style={s.wpBig}>{fmt(cur.value)}<Text style={s.wpUnit}>{u}</Text></Text>
                    <Text style={s.wpSub}>{detailPeriod === 'week' ? 'ten tydzień' : 'ten miesiąc'}{statDetail.target ? ` · cel ${fmt(statDetail.target)}${u}` : ''}</Text>
                  </View>
                  <Text style={s.wxSection}>{detailPeriod === 'week' ? 'Ostatnie 6 tygodni' : 'Ostatnie 6 miesięcy'}</Text>
                  <View style={s.tagHistChart}>
                    {vals.map((v, i) => {
                      const h = v > 0 ? Math.max(3, ((v - floor) / span) * H) : 0;
                      const isCur = i === vals.length - 1;
                      return (
                        <View key={i} style={s.tagHistCol}>
                          <Text style={[s.tagHistVal, isCur && { color: accentColor }]}>{v > 0 ? fmt(v) : ''}</Text>
                          <View style={{ height: H, width: 22, justifyContent: 'flex-end' }}>
                            {statDetail.target ? <View style={{ position: 'absolute', left: -3, right: -3, bottom: (Math.max(0, Math.min(statDetail.target, max) - floor) / span) * H, height: 1, backgroundColor: colors.text.muted + '80' }} /> : null}
                            <View style={{ height: h, borderRadius: 4, backgroundColor: isCur ? accentColor : accentColor + '88' }} />
                          </View>
                          <Text style={[s.tagHistLbl, isCur && { color: accentColor, fontWeight: '800' }]}>{ser.labels[i]}</Text>
                        </View>
                      );
                    })}
                  </View>
                  <View style={s.wxChips}>
                    <View style={s.wxChip}><Text style={s.wxChipK}>{statDetail.metric === 'weight' ? 'Śr. 6 mies.' : 'Średnia'}</Text><Text style={s.wxChipV}>{fmt(avg)}{u}</Text></View>
                    {statDetail.metric === 'weight' && overallAvg > 0
                      ? <View style={s.wxChip}><Text style={s.wxChipK}>Śr. ogólna</Text><Text style={s.wxChipV}>{fmt(overallAvg)}{u}</Text></View>
                      : <View style={s.wxChip}><Text style={s.wxChipK}>Rekord</Text><Text style={s.wxChipV}>{fmt(peak)}{u}</Text></View>}
                  </View>
                  {statDetail.metric === 'weight' && (
                    <View style={s.weightAddRow}>
                      <TextInput
                        style={s.weightAddInput}
                        value={weightInput}
                        onChangeText={setWeightInput}
                        keyboardType="decimal-pad"
                        placeholder={cur.value > 0 ? `${cur.value} kg` : 'np. 72,5'}
                        placeholderTextColor={colors.text.muted}
                        onSubmitEditing={saveWeightEntry}
                        returnKeyType="done"
                      />
                      <TouchableOpacity style={[s.weightAddBtn, { backgroundColor: accentColor }]} onPress={saveWeightEntry} activeOpacity={0.85}>
                        <Text style={[s.weightAddBtnTxt, { color: colors.bg.primary }]}>Zapisz wagę</Text>
                      </TouchableOpacity>
                    </View>
                  )}
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Weather panel */}
      <Modal visible={weatherPanel} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setWeatherPanel(false)}>
        <TouchableOpacity style={s.npOverlay} activeOpacity={1} onPress={() => setWeatherPanel(false)}>
          <TouchableOpacity activeOpacity={1} style={[s.card, { backgroundColor: colors.bg.card }]} onPress={() => {}}>
            <View style={s.cardHeader}>
              <CloudSun size={14} color={accentColor} />
              <Text style={s.cardTitle}>Pogoda</Text>
              <TouchableOpacity onPress={() => setWeatherPanel(false)} hitSlop={10} style={{ marginLeft: 'auto' }}>
                <X size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            {weather && (
              <>
                <View style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[2] }}>
                  {(() => { const { Icon, color } = weatherLucide(weather.wmo ?? -1); return <Icon size={60} color={color} strokeWidth={1.5} />; })()}
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 40, fontWeight: '900', color: colors.text.primary, letterSpacing: -1.5 }}>{weather.temp}°</Text>
                    <Text style={{ fontSize: 13, color: colors.text.secondary, fontWeight: '600' }}>{weather.desc}</Text>
                    {(weather.hi != null && weather.lo != null) && (
                      <Text style={{ fontSize: 12, color: colors.text.muted, marginTop: 2 }}>maks {weather.hi}° · min {weather.lo}°</Text>
                    )}
                  </View>
                </View>
                <View style={s.wxChips}>
                  {weather.feels != null && <View style={s.wxChip}><Text style={s.wxChipK}>Odczuwalna</Text><Text style={s.wxChipV}>{weather.feels}°</Text></View>}
                  {weather.wind != null && <View style={s.wxChip}><Text style={s.wxChipK}>Wiatr</Text><Text style={s.wxChipV}>{weather.wind} km/h</Text></View>}
                  {weather.humidity != null && <View style={s.wxChip}><Text style={s.wxChipK}>Wilgotność</Text><Text style={s.wxChipV}>{weather.humidity}%</Text></View>}
                  {(weather.sunrise && weather.sunset) && <View style={s.wxChip}><Text style={s.wxChipK}>Wschód/zachód</Text><Text style={s.wxChipV}>{weather.sunrise}–{weather.sunset}</Text></View>}
                </View>
                {weather.forecast && weather.forecast.length > 1 && (
                  <>
                    <Text style={s.wxSection}>Prognoza</Text>
                    <View style={s.wxForecast}>
                      {weather.forecast.map((fd, i) => {
                        const wd = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'][new Date(fd.date + 'T00:00:00').getDay()];
                        return (
                          <View key={fd.date} style={s.wxDay}>
                            <Text style={[s.wxDayLbl, i === 0 && { color: accentColor, fontWeight: '800' }]}>{i === 0 ? 'Dziś' : wd}</Text>
                            <View style={{ marginVertical: 3 }}>{(() => { const { Icon, color } = weatherLucide(fd.wmo); return <Icon size={26} color={color} strokeWidth={1.7} />; })()}</View>
                            <Text style={s.wxHi}>{fd.hi}°</Text>
                            <Text style={s.wxLo}>{fd.lo}°</Text>
                          </View>
                        );
                      })}
                    </View>
                  </>
                )}
              </>
            )}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Tag-limit item list — see/remove what counts toward a limit */}
      <Modal visible={!!tagModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setTagModal(null)}>
        <View style={s.npOverlay}>
          <View style={[s.npCard, { maxHeight: '78%' }]}>
            {tagModal && (
              <>
                <Text style={s.tagModalTitle}>{tagModal.label}</Text>
                <Text style={s.tagModalSub}>{Math.round(tagModal.spend)}/{Math.round(tagModal.limit)} zł · {tagModal.items.length} pozycji · {tagModal.period === 'week' ? 'tydzień' : 'miesiąc'}</Text>
                {tagModal.period === 'month' && tagHistory.length > 0 && (() => {
                  const limit = tagModal.limit;
                  const max = Math.max(limit, ...tagHistory.map(m => m.spend), 1);
                  const H = 58;
                  const overMonths = tagHistory.filter(m => m.spend > limit);
                  const totalOver = overMonths.reduce((a, m) => a + (m.spend - limit), 0);
                  return (
                    <View style={s.tagHistWrap}>
                      <Text style={s.tagHistTitle}>Ostatnie 6 miesięcy · limit {Math.round(limit)} zł</Text>
                      <View style={s.tagHistChart}>
                        {tagHistory.map((m, i) => {
                          const over = m.spend > limit;
                          const h = Math.max(2, (m.spend / max) * H);
                          return (
                            <View key={m.key} style={s.tagHistCol}>
                              <Text style={[s.tagHistVal, over && { color: colors.accent.red }]}>{m.spend}</Text>
                              <View style={{ height: H, width: 22, justifyContent: 'flex-end' }}>
                                <View style={{ position: 'absolute', left: -3, right: -3, bottom: (limit / max) * H, height: 1, backgroundColor: colors.text.muted + '80' }} />
                                <View style={{ height: h, borderRadius: 4, backgroundColor: over ? colors.accent.red : accentColor }} />
                              </View>
                              <Text style={[s.tagHistLbl, i === tagHistory.length - 1 && { color: accentColor, fontWeight: '800' }]}>{m.label}</Text>
                            </View>
                          );
                        })}
                      </View>
                      <Text style={s.tagHistNote}>
                        {overMonths.length === 0
                          ? 'Ani razu nie przekroczyłeś limitu w tym okresie 👏'
                          : `Przekroczone w ${overMonths.length} mies. · łącznie +${Math.round(totalOver)} zł ponad limit`}
                      </Text>
                    </View>
                  );
                })()}
                <Text style={s.tagModalHint}>Dotknij pozycję, by edytować kategorię/tagi · kosz usuwa z tego licznika</Text>
                <ScrollView style={{ marginTop: spacing[2] }}>
                  {tagModal.items.length === 0
                    ? <Text style={s.tagModalEmpty}>Brak pozycji.</Text>
                    : tagModal.items.map((it: any) => (
                      <View key={`${it.expenseId}-${it.idx}`} style={s.tagItemRow}>
                        <TouchableOpacity
                          style={{ flex: 1 }}
                          onPress={() => { setTagModal(null); router.navigate(`/expenses/${it.expenseId}` as any); }}
                          activeOpacity={0.6}
                        >
                          <Text style={s.tagItemName} numberOfLines={1}>{it.name}</Text>
                          <Text style={s.tagItemMeta}>
                            {new Date(it.date).toLocaleDateString('pl-PL', { day: '2-digit', month: 'short' })} · {it.price.toFixed(2)} zł{it.kind === 'expense' ? ' · cały wydatek' : ''}
                          </Text>
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => { setTagModal(null); router.navigate(`/expenses/${it.expenseId}` as any); }} style={s.tagItemEdit} activeOpacity={0.7}>
                          <Pencil size={15} color={colors.text.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={() => removeTagItem(it, ruleTags(tagModal))} style={s.tagItemDel} activeOpacity={0.7}>
                          <Trash2 size={16} color={colors.accent.red} />
                        </TouchableOpacity>
                      </View>
                    ))}
                </ScrollView>
                <TouchableOpacity onPress={() => setTagModal(null)} style={s.tagModalClose} activeOpacity={0.8}>
                  <Text style={s.tagModalCloseText}>Zamknij</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>

      {/* Payday — enter the paycheck amount */}
      <Modal visible={paydayModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPaydayModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={s.npOverlay}>
          <View style={s.npCard}>
            <Text style={s.tagModalTitle}>Wypłata — kwota</Text>
            <Text style={s.tagModalSub}>Dodam ją do przychodów i ustawię jako ostatnią wypłatę (wejdzie do średniej stawki).</Text>
            <TextInput
              style={s.paydayInput}
              value={paydayInput}
              onChangeText={setPaydayInput}
              keyboardType="decimal-pad"
              placeholder="np. 4200"
              placeholderTextColor={colors.text.muted}
              autoFocus
              selectTextOnFocus
            />
            <View style={{ flexDirection: 'row', gap: spacing[2] }}>
              <TouchableOpacity style={[s.paydayBtn, s.paydayBtnGhost]} onPress={() => setPaydayModal(false)} activeOpacity={0.7}>
                <Text style={[s.paydayBtnText, { color: colors.text.secondary }]}>Anuluj</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[s.paydayBtn, { backgroundColor: colors.accent.green }]} onPress={confirmPayday} activeOpacity={0.85}>
                <Text style={[s.paydayBtnText, { color: colors.bg.primary }]}>Dodaj wypłatę</Text>
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Note picker — add a note as a dashboard tile */}
      <Modal visible={notePickerOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setNotePickerOpen(false)}>
        <View style={s.npOverlay}>
          <View style={s.npCard}>
            <View style={s.npHeader}>
              <Text style={s.npTitle}>Wybierz notatkę</Text>
              <TouchableOpacity onPress={() => setNotePickerOpen(false)} hitSlop={8}>
                <X size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            {allNotes.length === 0 ? (
              <Text style={s.npEmpty}>Brak notatek. Dodaj je w sekcji Notatki.</Text>
            ) : (
              <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
                {allNotes.map(n => (
                  <TouchableOpacity
                    key={n.id}
                    style={s.npRow}
                    onPress={() => {
                      haptic.tap();
                      addCustomTile({ type: 'note', title: n.title || 'Notatka', noteId: n.id });
                      setNotePickerOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <FileText size={14} color={accentColor} />
                    <Text style={s.npRowText} numberOfLines={1}>{n.title || 'Bez tytułu'}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            )}
          </View>
        </View>
      </Modal>

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

// This sheet has ~319 styles, and EVERY caller used to build the whole thing: the
// dashboard once, plus each DashEditRow separately. Opening the editor with ~20 visible
// sections meant ~20 × StyleSheet.create(319) — 6000+ style objects on the JS thread in
// one render, which is where the ~30s freeze came from.
//
// useColors() returns a stable module object (darkColors / lightColors), so the sheet can
// simply be cached per palette: built once per theme, a Map lookup after that.
const _styleCache = new Map<any, ReturnType<typeof buildStyles>>();
const makeStyles = (c: any): ReturnType<typeof buildStyles> => {
  let s = _styleCache.get(c);
  if (!s) { s = buildStyles(c); _styleCache.set(c, s); }
  return s;
};

const buildStyles = (c: any) => StyleSheet.create({
  root: { flex: 1, backgroundColor: c.bg.primary },
  safe: { flex: 1 },

  scroll: { paddingHorizontal: spacing[4], gap: spacing[3], paddingTop: spacing[5] },

  // ── Minimal header (date + weather) ───────────────────────────────────────
  headerMin: { paddingTop: spacing[1], marginBottom: spacing[3] },
  headerMinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerMinDate: { fontSize: 13, fontWeight: '800', letterSpacing: 1, color: c.text.primary, flexShrink: 1 },
  headerMinWeather: { flexDirection: 'row', alignItems: 'center', gap: 5, marginLeft: spacing[2] },
  hdrIcon: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: c.border.subtle },
  headerMinTemp: { fontSize: 13, fontWeight: '800', color: c.text.primary },
  headerMinDesc: { fontSize: 11, fontWeight: '600', color: c.text.muted, textTransform: 'capitalize', maxWidth: 110 },
  headerMinRule: { height: 1, backgroundColor: c.border.subtle, marginTop: spacing[2] },

  // ── Main glassmorphism card (Figma) ───────────────────────────────────────
  mainCardBorder: {
    borderRadius: radius.xl + 1,
    padding: 1.3,            // the gradient shows as a thin accent border
  },
  mainCard: {
    height: 190,
    borderRadius: radius.xl,
    overflow: 'hidden',
    backgroundColor: c.bg.primary,
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
  mainTopRow: {
    flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: spacing[3],
  },
  // Weather as a self-contained legible pill (always readable on any sky).
  weatherChip: {
    flexDirection: 'row', alignItems: 'center', gap: 5,
    backgroundColor: 'rgba(8,10,12,0.42)',
    borderRadius: radius.full,
    paddingLeft: 8, paddingRight: 10, paddingVertical: 5,
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.14)',
  },
  weatherChipTemp: { fontSize: 13, fontWeight: '800', color: '#FFFFFF', letterSpacing: -0.2 },
  weatherChipDesc: { fontSize: 8.5, fontWeight: '700', color: 'rgba(255,255,255,0.62)', letterSpacing: 0.5, maxWidth: 74 },
  mainGreetingBlock: { gap: 0 },
  mainDate: {
    flex: 1, fontSize: 11.5, fontWeight: '700', color: 'rgba(255,255,255,0.72)', letterSpacing: 0.8,
    textShadowColor: 'rgba(0,0,0,0.4)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4,
  },
  mainGreeting: {
    fontSize: 40, fontWeight: '900', color: c.white,
    letterSpacing: -2, lineHeight: 42,
    textShadowColor: 'rgba(0,0,0,0.35)',
    textShadowOffset: { width: 0, height: 2 },
    textShadowRadius: 8,
  },
  mainTaskLine: {
    fontSize: 14, fontWeight: '700', color: 'rgba(255,255,255,0.86)',
    textShadowColor: 'rgba(0,0,0,0.45)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 6,
  },
  mainTaskBold: { fontWeight: '900', color: c.white },
  moodStateRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
  },
  moodStateEmoji: { fontSize: 16 },
  moodStateName: { fontSize: 12, fontWeight: '700' },
  streakPill: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    backgroundColor: c.accent.amber + '20',
    borderRadius: radius.full, paddingHorizontal: spacing[2], paddingVertical: 3,
    borderWidth: 1, borderColor: c.accent.amber + '40',
  },
  streakText: { fontSize: 11, fontWeight: '700', color: c.accent.amber },
  humorText: { flex: 1, fontSize: 11, color: 'rgba(255,255,255,0.35)', fontStyle: 'italic' },

  quickMoodRow: { flexDirection: 'row', gap: spacing[3] },
  quickMoodBtn: {
    width: 40, height: 40, borderRadius: radius.md,
    backgroundColor: c.fill.medium,
    alignItems: 'center', justifyContent: 'center',
    borderWidth: 1,
  },
  quickMoodEmoji: { fontSize: 20 },

  // ── Budget warning card ───────────────────────────────────────────────────
  budgetWarnCard: {
    backgroundColor: c.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: 'rgba(81,102,245,0.25)',
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
    gap: spacing[3],
  },
  budgetWarnText: {
    fontSize: 13, fontWeight: '400', color: c.text.secondary,
  },
  tagLastItem: { fontSize: 11, color: c.text.muted, marginTop: -spacing[1] },
  tagModalTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  tagModalSub: { fontSize: 12, color: c.text.muted, marginTop: 2 },
  tagHistWrap: { marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle },
  tagHistTitle: { fontSize: 11, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4, marginBottom: spacing[2] },
  tagHistChart: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-end' },
  tagHistCol: { alignItems: 'center', flex: 1, gap: 3 },
  tagHistVal: { fontSize: 10, fontWeight: '700', color: c.text.secondary },
  tagHistLbl: { fontSize: 9.5, color: c.text.muted, fontWeight: '600' },
  tagHistNote: { fontSize: 11, color: c.text.secondary, marginTop: spacing[2], fontWeight: '600' },
  tagModalHint: { fontSize: 10.5, color: c.text.muted, marginTop: spacing[2], lineHeight: 15, fontStyle: 'italic' },
  tagModalEmpty: { fontSize: 13, color: c.text.muted, textAlign: 'center', paddingVertical: spacing[3] },
  tagItemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  tagItemName: { fontSize: 13, fontWeight: '600', color: c.text.primary },
  tagItemMeta: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  tagItemEdit: { padding: spacing[2], borderRadius: radius.md, backgroundColor: c.border.subtle },
  tagItemDel: { padding: spacing[2], borderRadius: radius.md, backgroundColor: 'rgba(228,52,52,0.10)' },
  tagModalClose: { marginTop: spacing[3], paddingVertical: spacing[3], borderRadius: radius.md, backgroundColor: c.bg.elevated, alignItems: 'center' },
  tagModalCloseText: { fontSize: 13, fontWeight: '700', color: c.text.secondary },

  paydayBtn: { flex: 1, paddingVertical: 11, borderRadius: radius.md, alignItems: 'center' },
  paydayBtnGhost: { backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default },
  paydayBtnText: { fontSize: 13, fontWeight: '800', letterSpacing: 0.2 },
  paydayInput: { backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 12, fontSize: 18, fontWeight: '700', color: c.text.primary, textAlign: 'center' },
  budgetWarnBold: { fontWeight: '800', color: c.text.primary },
  budgetWarnPeriod: { fontWeight: '700', color: c.text.muted, fontSize: 11, textTransform: 'uppercase', letterSpacing: 0.4 },
  budgetWarnPct: { fontWeight: '700', color: c.text.primary },
  budgetWarnAmt: { fontWeight: '600', color: c.text.muted, fontSize: 11 },
  budgetWarnTrack: {
    height: 10, backgroundColor: c.border.subtle,
    borderRadius: 5, overflow: 'hidden',
  },
  budgetWarnFill: {
    height: '100%', borderRadius: 5,
    backgroundColor: '#5166F5',
  },

  // ── Humor line (below main card) ──────────────────────────────────────────
  humorLine: {
    fontSize: 12, fontStyle: 'italic',
    color: c.text.muted,
    textAlign: 'center',
    paddingHorizontal: spacing[2],
  },

  // ── Tools row ─────────────────────────────────────────────────────────────
  toolsRow: { flexDirection: 'row', gap: spacing[2], paddingRight: spacing[1] },
  toolTile: {
    width: 74, alignItems: 'center', gap: spacing[2],
    borderRadius: radius.xl,
    borderWidth: 1, paddingVertical: spacing[3],
  },
  toolIcon: {
    width: 38, height: 38, borderRadius: radius.lg,
    alignItems: 'center', justifyContent: 'center',
  },
  toolLabel: { fontSize: 10, fontWeight: '700', color: c.text.secondary, letterSpacing: 0.3 },
  cdName: { flex: 1, fontSize: 13, fontWeight: '700', color: c.text.primary },
  cdDays: { fontSize: 12, fontWeight: '800', color: c.tabs?.day ?? '#46B0DE' },
  sinceGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  sinceTile: { width: '31.5%', flexGrow: 1, backgroundColor: c.fill.subtle, borderRadius: radius.md, paddingVertical: spacing[3], paddingHorizontal: spacing[2], alignItems: 'center' },
  sinceTileDays: { fontSize: 26, fontWeight: '900', color: c.text.primary, letterSpacing: -1 },
  sinceTileUnit: { fontSize: 10, fontWeight: '700', color: c.text.muted, marginTop: -2 },
  sinceTileName: { fontSize: 11, fontWeight: '600', color: c.text.secondary, marginTop: 3, textAlign: 'center', maxWidth: '100%' },
  toolSub: { fontSize: 11, fontWeight: '800', letterSpacing: -0.3 },

  // ── Evening habits nudge ──────────────────────────────────────────────────
  habitsNudge: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.border.subtle,
    borderRadius: radius.xl, padding: spacing[4],
    borderWidth: 1, borderColor: c.border.default,
  },
  habitsNudgeTitle: { fontSize: 13, fontWeight: '700', color: c.text.primary, marginBottom: 2 },
  habitsNudgeSub: { fontSize: 11, color: c.text.muted },

  // ── Habits today card ─────────────────────────────────────────────────────
  habitsCard: {
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: c.border.default,
    padding: spacing[4], gap: spacing[3],
  },
  habitsHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  habitsHeaderLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  habitsTitle: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  habitsBadge: { fontSize: 14, fontWeight: '800', color: c.text.secondary },
  habitsTrack: {
    height: 8, backgroundColor: c.border.subtle,
    borderRadius: 4, overflow: 'hidden',
  },
  habitsFill: { height: '100%', borderRadius: 4 },

  // one row per habit: icon · name + streak + value · own progress bar · tap target
  hRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  hIcon: { width: 30, height: 30, borderRadius: 15, borderWidth: 1.5, alignItems: 'center', justifyContent: 'center' },
  hTop: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  hName: { flex: 1, fontSize: 13, fontWeight: '700', color: c.text.primary },
  hStreak: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 2, borderRadius: 20, borderWidth: 1 },
  hStreakTxt: { fontSize: 11, fontWeight: '900' },
  hVal: { fontSize: 11.5, fontWeight: '700', fontVariant: ['tabular-nums'] },
  hTrack: { height: 6, borderRadius: 3, backgroundColor: c.border.subtle, overflow: 'hidden' },
  hFill: { height: '100%', borderRadius: 3 },
  hBtn: { width: 32, height: 32, borderRadius: 10, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hEmptyTick: { width: 13, height: 13, borderRadius: 7, borderWidth: 1.5 },

  // ── Stats scope toggle (everyone / only me) ─────────────────────────────────
  scopeRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  scopeLabel: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  scopeToggle: {
    flexDirection: 'row', gap: 2, marginLeft: 'auto',
    backgroundColor: c.border.subtle, borderRadius: radius.full, padding: 2,
  },
  scopeBtn: { paddingHorizontal: spacing[3], paddingVertical: 5, borderRadius: radius.full },
  scopeBtnText: { fontSize: 11, fontWeight: '700', color: c.text.muted },

  // ── Fun facts ───────────────────────────────────────────────────────────────
  factRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  factIcon: {
    width: 26, height: 26, borderRadius: 8,
    alignItems: 'center', justifyContent: 'center',
  },
  factText: { flex: 1, fontSize: 12.5, color: c.text.secondary, fontWeight: '500' },
  topRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  topRank: {
    width: 24, height: 24, borderRadius: 12, borderWidth: 1,
    alignItems: 'center', justifyContent: 'center',
  },
  topRankText: { fontSize: 12, fontWeight: '800' },
  topNameRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  topName: { flex: 1, fontSize: 13, color: c.text.primary, fontWeight: '600' },
  topCount: { fontSize: 12, color: c.text.muted, fontWeight: '700' },
  topBarTrack: { height: 5, borderRadius: 3, backgroundColor: c.border.subtle, marginTop: 5, overflow: 'hidden' },
  topBarFill: { height: 5, borderRadius: 3 },
  variantWrap: { marginTop: spacing[2], gap: 3, paddingLeft: spacing[2], borderLeftWidth: 1, borderLeftColor: c.border.default },
  variantRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  variantName: { flex: 1, fontSize: 11, color: c.text.muted },
  variantCount: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  habitsMore: { fontSize: 11, color: c.text.muted, alignSelf: 'center' },

  // ── Mini row: tasks + work/budget ──────────────────────────────────────────
  miniRow: { flexDirection: 'row', gap: spacing[3] },
  miniCard: {
    flex: 1, minWidth: 0, backgroundColor: c.bg.card,
    borderRadius: radius.xl, padding: spacing[4],
    borderWidth: 1, borderColor: c.border.card,
    gap: spacing[1], overflow: 'hidden',
  },
  miniCardTop: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  miniCardNum: { fontSize: 21, fontWeight: '800', letterSpacing: -0.5, flexShrink: 1 },
  miniCardLabel: { fontSize: 11, fontWeight: '600', color: c.text.secondary },
  miniCardSub: { fontSize: 11, color: c.text.secondary },
  miniWorkTrack: {
    height: 6, backgroundColor: c.border.subtle,
    borderRadius: 3, overflow: 'hidden', marginTop: spacing[1],
  },
  miniWorkFill: { height: '100%', borderRadius: 3 },


  activityStrip: {
    flexDirection: 'row', gap: spacing[2],
  },
  activityBadge: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: spacing[2], paddingHorizontal: spacing[2],
    backgroundColor: c.border.subtle,
    borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
  },
  activityLabel: { fontSize: 10, fontWeight: '700', color: c.text.muted },

  // ── Humor tile ─────────────────────────────────────────────────────────────
  humorTile: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    backgroundColor: c.bg.card, borderRadius: radius.xl,
    paddingHorizontal: spacing[4], paddingVertical: spacing[4],
    borderWidth: 1, borderColor: c.border.default,
  },
  humorTileEmoji: { fontSize: 20 },
  humorTileText: { flex: 1, fontSize: 13, fontWeight: '500', color: c.text.secondary, lineHeight: 18, fontStyle: 'italic' },

  // ── Standard card ──────────────────────────────────────────────────────────
  // ── Work hours widget ──────────────────────────────────────────────────────
  workToggle: {
    marginLeft: 'auto', paddingHorizontal: spacing[3], paddingVertical: 4,
    borderRadius: radius.full, backgroundColor: c.border.subtle,
  },
  workToggleText: { fontSize: 10, fontWeight: '700' },
  workHoursRow: { marginTop: spacing[1], gap: 2 },
  workHoursBig: { fontSize: 32, fontWeight: '900', letterSpacing: -1 },
  workHoursUnit: { fontSize: 16, fontWeight: '700', color: c.text.muted },
  workHoursSub: { fontSize: 12, color: c.text.secondary },
  workHeroRow: { flexDirection: 'row', alignItems: 'flex-start', marginTop: spacing[1] },
  workDelta: { flexDirection: 'row', alignItems: 'center', gap: 1, paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full },
  workDeltaText: { fontSize: 12, fontWeight: '800' },
  workSplitBar: { flexDirection: 'row', height: 8, borderRadius: 4, overflow: 'hidden', backgroundColor: c.fill.subtle },
  workSplitText: { fontSize: 11, color: c.text.secondary, marginTop: 6 },
  workMeta: { fontSize: 11.5, color: c.text.muted, fontWeight: '600', marginTop: spacing[3] },

  card: {
    backgroundColor: c.bg.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: c.border.card,
    gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  cardTitle: { fontSize: 12, fontWeight: '800', color: c.text.primary, textTransform: 'uppercase', letterSpacing: 0.8, flexShrink: 1 },
  statIconChip: { width: 24, height: 24, borderRadius: 7, alignItems: 'center', justifyContent: 'center' },
  forecastChip: { paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full, backgroundColor: '#FBBF241E', borderWidth: 1, borderColor: '#FBBF2455' },
  forecastChipTxt: { fontSize: 9.5, fontWeight: '900', color: '#FBBF24', letterSpacing: 0.6 },
  forecastNote: { fontSize: 10.5, color: c.text.muted, lineHeight: 14, fontStyle: 'italic' },
  pinNoteRow: { flexDirection: 'row', gap: spacing[2], alignItems: 'flex-start', paddingVertical: 4 },
  pinNoteTitle: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  pinNoteBody: { fontSize: 11.5, color: c.text.secondary, lineHeight: 16, marginTop: 1 },
  fvHint: { fontSize: 10, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginLeft: 'auto' },
  fvRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  fvDot: { width: 9, height: 9, borderRadius: 5 },
  fvRowLbl: { flex: 1, fontSize: 13, fontWeight: '700', color: c.text.primary },
  fvRowPct: { fontSize: 12, fontWeight: '700', color: c.text.muted, width: 40, textAlign: 'right' },
  fvRowAmt: { fontSize: 14, fontWeight: '800', letterSpacing: -0.3, width: 92, textAlign: 'right' },
  fvBar: { flexDirection: 'row', height: 10, borderRadius: 5, overflow: 'hidden', backgroundColor: c.fill.subtle },
  fvFixBox: { gap: 5, paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  fvFixHead: { fontSize: 9.5, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6 },
  fvFixRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2] },
  fvFixLbl: { flex: 1, fontSize: 12.5, color: c.text.secondary },
  fvFixAmt: { fontSize: 12.5, fontWeight: '700', color: c.text.primary },
  fvFixMore: { fontSize: 11, color: c.text.muted, fontStyle: 'italic' },
  fvLegend: { flexDirection: 'row', justifyContent: 'center', gap: spacing[3] },
  fvLegItem: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  fvDotSm: { width: 7, height: 7, borderRadius: 4 },
  fvLegTxt: { fontSize: 10, color: c.text.muted, fontWeight: '600' },
  fvTrend: { flexDirection: 'row', alignItems: 'flex-end', marginTop: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  fvMonthLbl: { fontSize: 9.5, color: c.text.muted, fontWeight: '600' },
  fvAvg: { fontSize: 10.5, color: c.text.muted, fontWeight: '600', marginTop: spacing[2], textAlign: 'center' },
  pinNoteTags: { fontSize: 10, color: c.text.muted, marginTop: 2 },
  pinNoteMore: { fontSize: 11, fontWeight: '700', marginTop: 2 },

  // ── Stat widgets ──
  statBig: { fontSize: 32, fontWeight: '900', letterSpacing: -1, marginTop: 2 },
  statNumRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  statDelta: { flexDirection: 'row', alignItems: 'center', gap: 3, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full },
  statDeltaText: { fontSize: 11, fontWeight: '800' },
  statListRow2: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 6 },
  statSub: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  pxLegendRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[2] },
  pxLegend: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  statTargetTrack: { height: 6, borderRadius: 3, backgroundColor: c.border.subtle, marginTop: 8, overflow: 'hidden' },
  statTargetFill: { height: 6, borderRadius: 3 },
  insightDot: { width: 7, height: 7, borderRadius: 4, marginTop: 5 },
  statListRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 5 },
  statListRank: { fontSize: 11, fontWeight: '800', color: c.text.muted, width: 16 },
  statListLabel: { flex: 1, fontSize: 13, color: c.text.primary, fontWeight: '600' },
  statListVal: { fontSize: 13, fontWeight: '800' },
  statCmpRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginVertical: spacing[1], gap: spacing[2] },
  statCmpVal: { fontSize: 19, fontWeight: '800', letterSpacing: -0.5 },
  statCmpKey: { fontSize: 10, color: c.text.muted },
  cmpDotRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginBottom: 1 },
  cmpDot: { width: 8, height: 8, borderRadius: 4 },
  weatherTemp: { fontSize: 30, fontWeight: '900', color: '#FFFFFF', letterSpacing: -1 },
  weatherDesc: { fontSize: 11, fontWeight: '700', color: 'rgba(255,255,255,0.55)', letterSpacing: 0.6 },

  // ── Edit-dashboard mode ──
  editCtrlRow: { flexDirection: 'row', justifyContent: 'flex-end' },
  editCtrlBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingVertical: 6, paddingHorizontal: spacing[3],
    borderRadius: radius.full, borderWidth: 1, borderColor: c.border.subtle,
    backgroundColor: c.border.subtle,
  },
  editCtrlText: { fontSize: 11, fontWeight: '700', color: c.text.muted },
  editBanner: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    padding: spacing[3], borderRadius: radius.md,
    backgroundColor: 'rgba(108,158,255,0.08)', borderWidth: 1, borderColor: 'rgba(108,158,255,0.25)',
  },
  editBannerText: { fontSize: 11.5, color: c.text.secondary, lineHeight: 16 },
  editDoneBtn: { flexDirection: 'row', alignItems: 'center', gap: 5, paddingVertical: 6, paddingHorizontal: spacing[3], borderRadius: radius.full, borderWidth: 1 },
  editDoneText: { fontSize: 12, fontWeight: '800' },
  editRow: {
    flexDirection: 'row', alignItems: 'center', gap: 4,
    paddingVertical: 8, paddingLeft: spacing[2], paddingRight: spacing[1],
    borderRadius: radius.md, borderWidth: 1, borderColor: c.border.subtle,
  },
  editGrip: { paddingVertical: 4, paddingHorizontal: 2 },
  editCtrlBtn2: { width: 38, height: 40, borderRadius: radius.sm, alignItems: 'center', justifyContent: 'center' },
  editArrows: { flexDirection: 'row', alignItems: 'center', gap: 0 },
  editArrowBtn: { padding: 2 },
  editArrowBtn2: { width: 32, height: 40, alignItems: 'center', justifyContent: 'center' },
  editRowTitle: { fontSize: 13, fontWeight: '700', color: c.text.primary },
  editRowDesc: { fontSize: 10.5, color: c.text.muted },
  editAddBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    paddingVertical: 11, borderRadius: radius.md,
    borderWidth: 1, borderStyle: 'dashed', borderColor: 'rgba(108,158,255,0.4)',
  },
  editAddText: { fontSize: 12.5, fontWeight: '700' },
  hiddenRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 9, paddingHorizontal: spacing[3], borderRadius: radius.md, backgroundColor: colors.fill.subtle, marginLeft: spacing[3] },
  hiddenAddIcon: { width: 24, height: 24, borderRadius: 12, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hiddenRowText: { fontSize: 13, fontWeight: '600', color: colors.text.secondary },
  hiddenRowDesc: { fontSize: 10.5, color: colors.text.muted, marginTop: 1 },
  hiddenGroupLabel: { fontSize: 10, fontWeight: '800', color: colors.text.muted, letterSpacing: 0.8, textTransform: 'uppercase', marginLeft: spacing[3], marginBottom: 3 },
  editResetBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 8 },
  editResetText: { fontSize: 11, fontWeight: '600', color: c.text.muted },

  // ── Note picker modal ──
  npOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[4] },
  wxChips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  wxChip: { backgroundColor: c.fill.subtle, borderRadius: radius.md, paddingVertical: spacing[2], paddingHorizontal: spacing[3], minWidth: '47%', flexGrow: 1 },
  wxChipK: { fontSize: 10.5, color: c.text.muted, fontWeight: '600' },
  wxChipV: { fontSize: 15, color: c.text.primary, fontWeight: '800', marginTop: 1 },
  weightAddRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle },
  weightAddInput: { flex: 1, backgroundColor: c.bg.primary, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: 10, fontSize: 16, fontWeight: '700', color: c.text.primary },
  weightAddBtn: { paddingHorizontal: spacing[4], paddingVertical: 11, borderRadius: radius.md },
  weightAddBtnTxt: { fontSize: 13, fontWeight: '800' },
  wxSection: { fontSize: 11, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.5, marginTop: spacing[3], marginBottom: spacing[1] },
  detailToggle: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  detailToggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  detailToggleTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.muted },
  wxForecast: { flexDirection: 'row', justifyContent: 'space-between' },
  wxDay: { alignItems: 'center', flex: 1 },
  wxDayLbl: { fontSize: 11, color: c.text.secondary, fontWeight: '700' },
  wxHi: { fontSize: 12.5, color: c.text.primary, fontWeight: '800' },
  wxLo: { fontSize: 11, color: c.text.muted, fontWeight: '600' },
  wpBig: { fontSize: 38, fontWeight: '900', color: c.text.primary, letterSpacing: -1.2 },
  wpUnit: { fontSize: 18, fontWeight: '700', color: c.text.muted },
  wpSub: { fontSize: 12.5, color: c.text.secondary, marginTop: 1 },
  wpRateCard: { marginTop: spacing[3], backgroundColor: c.fill.subtle, borderRadius: radius.lg, padding: spacing[3], borderWidth: 1, borderColor: '#FBBF2433' },
  wpRateVal: { fontSize: 26, fontWeight: '900', color: '#FBBF24', letterSpacing: -0.6 },
  wpRateUnit: { fontSize: 15, fontWeight: '700', color: '#FBBF24AA' },
  wpRateHint: { fontSize: 11.5, color: c.text.muted, marginTop: 2 },
  wpTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  wpTotalLabel: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  wpTotalVal: { fontSize: 17, fontWeight: '900', letterSpacing: -0.4 },
  wmRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 5, gap: 8 },
  wmMonth: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text.secondary },
  wmH: { width: 118, textAlign: 'right', fontSize: 12.5, fontWeight: '700', color: c.text.primary },
  wmZl: { width: 72, textAlign: 'right', fontSize: 13, fontWeight: '800', color: c.text.primary },
  npCard: { backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4], gap: spacing[3], borderWidth: 1, borderColor: c.border.subtle },
  npHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  npTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  npEmpty: { fontSize: 12, color: c.text.muted, paddingVertical: spacing[3], textAlign: 'center' },
  npRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingVertical: 11, borderBottomWidth: 1, borderBottomColor: c.border.subtle,
  },
  npRowText: { flex: 1, fontSize: 13, color: c.text.primary, fontWeight: '500' },

  // ── Period toggle ──────────────────────────────────────────────────────────
  periodToggle: { flexDirection: 'row', marginLeft: spacing[2], gap: 2, marginRight: 'auto' as any },
  periodBtn: {
    paddingHorizontal: spacing[2], paddingVertical: 3,
    borderRadius: radius.sm, borderWidth: 1, borderColor: 'transparent',
  },
  periodBtnActive: { borderColor: c.accent.blue + '50', backgroundColor: c.accent.blue + '15' },
  periodBtnText: { fontSize: 10, fontWeight: '600', color: c.text.muted },
  navArrow: { padding: 2 },
  weekLabelText: { fontSize: 10, color: c.text.muted },

  // ── Finance stats row ──────────────────────────────────────────────────────
  finRow: { flexDirection: 'row', alignItems: 'flex-start' },
  finStat: { flex: 1, alignItems: 'center', gap: 2 },
  finVal: { fontSize: 20, fontWeight: '800', color: c.text.primary, letterSpacing: -0.5 },
  finKey: { fontSize: 10, color: c.text.muted },
  finPct: { fontSize: 10, color: c.accent.blue, fontWeight: '600' },
  finDivider: { width: 1, height: 40, backgroundColor: c.border.subtle, alignSelf: 'center' },
  finCompareRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[4], marginTop: spacing[3], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle, justifyContent: 'center' },

  // ── Wave chart labels ──────────────────────────────────────────────────────
  avgPill: {
    marginLeft: 'auto' as any, paddingHorizontal: spacing[2], paddingVertical: 2,
    borderRadius: radius.full,
  },
  avgPillText: { fontSize: 11, fontWeight: '700' },
  waveLabels: { flexDirection: 'row' },
  waveLabel: { flex: 1, fontSize: 8, color: c.text.muted, textAlign: 'center' },
  chartCaption: { fontSize: 9.5, color: c.text.muted, textAlign: 'center', marginTop: 4, fontStyle: 'italic' },
  // "Rok temu tego dnia"
  yearAgoRow: { flexDirection: 'row', gap: spacing[2], marginTop: 2 },
  yearAgoStat: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: c.bg.elevated, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle, paddingVertical: spacing[3] },
  yearAgoVal: { fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  yearAgoKey: { fontSize: 10, color: c.text.muted, fontWeight: '600' },
  // "Bąbelki wydatków"
  bubbleTotal: { marginLeft: 'auto', fontSize: 12, fontWeight: '800', color: c.text.secondary },
  bubbleWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3], justifyContent: 'center', alignItems: 'flex-end', marginTop: spacing[3] },
  bubbleCol: { alignItems: 'center', gap: 4 },
  bubble: { alignItems: 'center', justifyContent: 'center', borderWidth: 1.5 },
  bubbleAmt: { fontWeight: '900', letterSpacing: -0.5 },
  bubbleLabel: { fontSize: 10, color: c.text.muted, fontWeight: '600', maxWidth: 76, textAlign: 'center' },
  // "Co podrożało"
  pwRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border.subtle },
  pwName: { flex: 1, fontSize: 13, fontWeight: '600', color: c.text.primary },
  pwPrice: { fontSize: 11.5, color: c.text.secondary, fontVariant: ['tabular-nums'] },
  pwPct: { backgroundColor: '#F8717122', borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  pwPctTxt: { fontSize: 11, fontWeight: '800', color: '#F87171' },
  unitPill: { paddingHorizontal: 7, paddingVertical: 2, borderRadius: radius.full, borderWidth: 1 },
  unitPillTxt: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.4 },
  waveValRow: { flexDirection: 'row', marginBottom: 3 },
  waveValLabel: { flex: 1, fontSize: 8.5, fontWeight: '700', color: c.text.secondary, textAlign: 'center' },
  waveValues: { flexDirection: 'row', marginBottom: 2 },
  waveValue: { flex: 1, fontSize: 9, fontWeight: '700', color: c.text.secondary, textAlign: 'center' },
  // Wave tile: title left, prominent current value right.
  waveHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 6, gap: 8 },
  waveNowWrap: { alignItems: 'flex-end' },
  waveNow: { fontSize: 22, fontWeight: '800', lineHeight: 24 },
  waveDelta: { fontSize: 10, fontWeight: '700', color: c.text.muted, marginTop: 1 },
  wDot: { position: 'absolute', width: 34, marginLeft: -17, textAlign: 'center', fontSize: 8.5, fontWeight: '700', color: c.text.muted },

  // ── Google Calendar ────────────────────────────────────────────────────────
  gcalDayLabel: { fontSize: 9, fontWeight: '700', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  gcalRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 3 },
  gcalDot:      { width: 6, height: 6, borderRadius: 3 },
  gcalTime:     { fontSize: 10, color: c.text.muted, width: 36, fontWeight: '600' },
  gcalTitle:    { flex: 1, fontSize: 13, color: c.text.secondary },

  // ── Today tasks strip ─────────────────────────────────────────────────────
  todayCard: {
    backgroundColor: c.bg.card, borderRadius: radius.xl,
    padding: spacing[4], borderWidth: 1,
    borderColor: c.accent.blue + '28',
    gap: 0,
  },
  todayHeader: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[2],
    paddingBottom: spacing[2],
  },
  todayTitle: {
    fontSize: 10, fontWeight: '800', color: c.accent.blue, letterSpacing: 1.5,
  },
  todayBadge: {
    backgroundColor: c.accent.blue + '20', borderRadius: 10,
    paddingHorizontal: 7, paddingVertical: 2,
  },
  todayBadgeText: { fontSize: 11, fontWeight: '800', color: c.accent.blue },
  todayMore: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 2 },
  todayMoreText: { fontSize: 11, fontWeight: '600', color: c.accent.blue },
  todayRow: {
    flexDirection: 'row', alignItems: 'center', gap: spacing[3],
    paddingVertical: 7,
    borderTopWidth: 1, borderTopColor: c.accent.blue + '12',
  },
  todayCheck: {
    width: 26, height: 26, borderRadius: 13,
    backgroundColor: c.accent.blue + '15',
    borderWidth: 1.5, borderColor: c.accent.blue + '45',
    alignItems: 'center', justifyContent: 'center',
  },
  todayCheckUrgent: {
    backgroundColor: c.accent.red + '15',
    borderColor: c.accent.red + '45',
  },
  todayRowTitle: {
    flex: 1, fontSize: 13, fontWeight: '700', color: c.text.primary, letterSpacing: 0.1,
  },
  urgentPill: {
    backgroundColor: c.accent.red + '15', borderRadius: radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: c.accent.red + '30',
  },
  urgentPillText: { fontSize: 9, fontWeight: '800', color: c.accent.red, letterSpacing: 0.8 },
  overduePill: {
    backgroundColor: c.accent.red + '20', borderRadius: radius.sm,
    paddingHorizontal: 6, paddingVertical: 2,
    borderWidth: 1, borderColor: c.accent.red + '45',
  },
  overduePillText: { fontSize: 9, fontWeight: '800', color: c.accent.red, letterSpacing: 0.8 },
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
    backgroundColor: c.border.subtle,
    borderRadius: 4, overflow: 'hidden', justifyContent: 'flex-end',
  },
  dowFill: { width: '100%', borderRadius: 4 },
  dowLabel:    { fontSize: 9, fontWeight: '600', color: c.text.muted },
  dowAvgLabel: { fontSize: 8, fontWeight: '700', letterSpacing: -0.2, marginBottom: 2 },

  // ── Dual-wave legend ───────────────────────────────────────────────────────
  dualLegend:      { flexDirection: 'row', gap: 10, marginLeft: 'auto' as any },
  dualLegendItem:  { flexDirection: 'row', alignItems: 'center', gap: 4 },
  dualLegendLine:  { width: 10, height: 2, borderRadius: 1 },
  dualLegendLabel: { fontSize: 9, color: c.text.muted },

  // ── Subscription payment modal ─────────────────────────────────────────────
  payOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.80)', justifyContent: 'center', alignItems: 'center', padding: spacing[6] },
  payCard: {
    width: '100%', backgroundColor: c.bg.card, borderRadius: radius.xl,
    padding: spacing[6], alignItems: 'center', gap: spacing[3],
    borderWidth: 1, borderColor: c.border.default,
  },
  payIconWrap: {
    width: 52, height: 52, borderRadius: radius.full,
    backgroundColor: c.accent.blue + '18',
    alignItems: 'center', justifyContent: 'center',
  },
  payTitle:  { fontSize: 10, color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.8 },
  payName:   { fontSize: 20, fontWeight: '800', color: c.text.primary, textAlign: 'center' },
  payAmount: { fontSize: 28, fontWeight: '800', color: c.accent.blue },
  payHint:   { fontSize: 14, color: c.text.secondary, textAlign: 'center' },
  payQueue:  { fontSize: 11, color: c.text.muted },
  payBtns:   { flexDirection: 'row', gap: spacing[3], width: '100%', marginTop: spacing[2] },
  payBtnNo: {
    flex: 1, paddingVertical: spacing[3], borderRadius: radius.md,
    backgroundColor: c.bg.elevated, alignItems: 'center',
    borderWidth: 1, borderColor: c.border.default,
  },
  payBtnNoText: { fontSize: 14, fontWeight: '600', color: c.text.secondary },
  payBtnYes: {
    flex: 2, paddingVertical: spacing[3], borderRadius: radius.md,
    backgroundColor: c.tabs.tasks, flexDirection: 'row',
    alignItems: 'center', justifyContent: 'center', gap: spacing[2],
  },
  payBtnYesText: { fontSize: 14, fontWeight: '700', color: c.bg.primary },
});
