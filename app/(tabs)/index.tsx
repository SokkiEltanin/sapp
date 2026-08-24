import React, { useMemo, useEffect, useState, useRef, useCallback } from 'react';
import {
  View, Text, StyleSheet, ScrollView, Modal, Alert,
  RefreshControl, TouchableOpacity, Animated, AppState, AccessibilityInfo,
  TextInput, KeyboardAvoidingView, Platform, Image, Pressable, InteractionManager,
} from 'react-native';
import * as Location from 'expo-location';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import {
  CheckCircle2, ChevronRight, ChevronLeft, Ban,
  TrendingUp, TrendingDown, Flame, Smile, Zap, Mail,
  CalendarDays, Wallet,
  Briefcase, CreditCard, Check, Plus,
  Timer, CloudSun, Thermometer, FileText, BarChart2, Activity,
  Droplets, Dumbbell, BookOpen, Moon, Heart, Sun, Bike, Footprints, CheckSquare,
  ShoppingCart, Candy, Store, Package, Sparkles, Scale, Pin, Wrench, Link2,
  ChevronDown, Trash2, Pencil, RotateCcw, X,
  Cloud, CloudDrizzle, CloudRain, Snowflake, Trophy, Hourglass, CalendarClock, Layers,
  PiggyBank, Utensils, Coins, Apple, ListChecks, Search, Grid3x3,
} from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import DashEditRow from '@/components/dashboard/DashEditRow';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
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
import { todayISO, ymd, localISO } from '@/utils/date';
import { groceryTotal, allSpend, weekIncome, sweetsTotal, SWEETS_TAGS, weekdaySpendPattern } from '@/utils/dashboard/spend';
import { plTasks, tagLimitMsg, metricTagLabel, fmtChartPt } from '@/utils/dashboard/format';
import { isDurationExpired, advanceNextBillingDate } from '@/utils/dashboard/subs';
import { MONTH_SHORT, getWeekDates, weekLabel, dayAvg, moodStreakFrom } from '@/utils/dashboard/dates';
import { carryForward, lastNonZero, zoomFloor, compareVerdict } from '@/utils/dashboard/chart';
import { humorLine } from '@/utils/dashboard/humor';
import { pctChange, monthSpendCompare } from '@/utils/dashboard/compare';
import { strongestLinks, DailyMetrics } from '@/utils/dashboard/correlations';
import CorrelationsInsightCard from '@/components/dashboard/CorrelationsInsightCard';
import { weatherService } from '@/services/weatherService';
import { getTagBudgetRules, TagBudgetRule, ruleTags, ruleLabel, attributedPrice } from '@/utils/tagBudgets';
import { getPayers } from '@/utils/payers';
import { setSunTimes, hydrateSunTimes, isoToDecimalHour } from '@/utils/sunTimes';
import { useStatsScope, inScope, countsForConsumption, consumesInScope, StatsScope } from '@/store/statsScope';
import { heroFontById } from '@/store/heroFont';
import { loadNameAliases, canonicalProductName, normalizeProductName, productGroupKey, productGroupLabel, loadWeightMemory, weightFor, WeightMemory } from '@/utils/productMemory';
import { getCategoryMeta } from '@/utils/categories';
import { foodAmountOf, isFoodItem, foodSubcat, FOOD_SUBCAT_META, addNonFood, loadNonFood } from '@/utils/food';
import { isUserNonShop, addNonShop, loadNonShop } from '@/utils/shopExclude';
import { useFoodStore, targetIntake, isRecipeProduct } from '@/store/foodStore';
import { useTimeCapsule } from '@/store/timeCapsuleStore';
import { shiftHours, isWorkEvent, shiftClockRange } from '@/utils/workEvents';
import { getAllNotes, Note } from '@/utils/notesStorage';
import { getHealthHistory, saveTodayWeight } from '@/utils/healthHistory';
import { getHealthGoals, bmrMifflin, ACTIVITY_FACTOR } from '@/utils/healthGoals';
import DailyRings, { RingSpec } from '@/components/dashboard/DailyRings';
import MonthWrappedCard from '@/components/dashboard/MonthWrappedCard';
import MonthCardUnlock from '@/components/dashboard/MonthCardUnlock';
import { buildMonthCards, buildMonthPace, MonthCard } from '@/utils/monthCards';
import WhoAteCard from '@/components/dashboard/WhoAteCard';
import PersonalRecordsCard from '@/components/dashboard/PersonalRecordsCard';
import SpendDelta from '@/components/dashboard/SpendDelta';
import DualWaveChart from '@/components/dashboard/DualWaveChart';
import WaveChart from '@/components/dashboard/WaveChart';
import StatDonut from '@/components/dashboard/StatDonut';
import MoodMiniCal from '@/components/dashboard/MoodMiniCal';
import GradientGreeting from '@/components/dashboard/GradientGreeting';
import Confetti from '@/components/achievements/Confetti';
import StreakWallCard, { StreakItem } from '@/components/dashboard/StreakWallCard';
import TriviaCard from '@/components/dashboard/TriviaCard';
import ReflectionCard from '@/components/dashboard/ReflectionCard';
import SweetsVsFoodSection, { WeekOv } from '@/components/dashboard/SweetsVsFoodSection';
import SpendByDaySection from '@/components/dashboard/SpendByDaySection';
import FixedVariableSection from '@/components/dashboard/FixedVariableSection';
import YearAgoSection from '@/components/dashboard/YearAgoSection';
import CalorieBalanceSection from '@/components/dashboard/CalorieBalanceSection';
import CorrelationsSection from '@/components/dashboard/CorrelationsSection';
import TopProductsSection from '@/components/dashboard/TopProductsSection';
import MoodWaveSection from '@/components/dashboard/MoodWaveSection';
import FunFactsSection from '@/components/dashboard/FunFactsSection';
import { stepsToDistanceFact } from '@/utils/funComparisons';
import { buildRecords } from '@/utils/personalRecords';
import { BOSSES } from '@/utils/bosses';
import { buildPersonConsumption } from '@/utils/personConsumption';
import PetTile from '@/components/pet/PetTile';
import { computePetState } from '@/utils/petState';
import { usePetStore, levelFromXp, loginBonusCoins } from '@/store/petStore';
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
import { getLastBackup } from '@/services/backupService';
import { loadMerchantMemory } from '@/utils/merchantMemory';
import AsyncStorage from '@react-native-async-storage/async-storage';
import WalkProgress from '@/components/counters/WalkProgress';
import StreakFlame, { StreakFlameGlow, streakColor, streakTier } from '@/components/counters/StreakFlame';
import StreakCard from '@/components/counters/StreakCard';
// Route-level crash boundary — catches a dashboard render crash as a recoverable,
// persisted screen instead of expo-router's blank production fallback.
export { ErrorBoundary } from '@/components/RouteErrorBoundary';
import { vehiclesService } from '@/services/vehiclesService';
import { maintenanceService, dueInDays } from '@/services/maintenanceService';
import { maintenanceDueMonths } from '@/utils/vehicleMatch';
import { Vehicle, MaintenanceItem } from '@/types';
import { useDashboardLayout, effectiveOrder, SECTION_TITLES, SECTION_DESC, SECTION_GROUP, SECTION_GROUP_ORDER, isAutoSection, CustomTile } from '@/store/dashboardLayout';
import { StatCtx, metricById, metricNumber, metricSeries, metricList, isSelfTransfer, dailyValue, isMoodPixelMetric, pixelTiers, PIXEL_METRICS } from '@/utils/statWidgets';
import YearPixels from '@/components/dashboard/YearPixels';
import WeeklyBoard, { WeeklyNote } from '@/components/dashboard/WeeklyBoard';
import { colors, spacing, radius, fonts } from '@/theme';
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
// SINGLE app accent = MONOCHROME (user: „akcent czarno-biały, kolory tylko dodatki").
// Emfaza przez biel+waga+kontrast, nie kolor. Kolory zostają tylko punktowo (i w kalendarzu).
// Jedno miejsce do zmiany, docelowo rozlać na resztę.
const WORK_ACCENT = colors.text.primary;
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

const MOOD_EMOJIS: Record<MoodLevel, string> = {
  1: '😩', 2: '😕', 3: '😐', 4: '😊', 5: '🤩',
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
// ─── Screen ───────────────────────────────────────────────────────────────────

export default function DashboardScreen() {
  const colors = useColors();
  const s = useMemo(() => makeStyles(colors), [colors]);
  const { color: accentColor, greeting, gradientTop, cardBg, timeOfDay } = useTimeAccent();
  // Stat cards flip with the theme; the hero stays immersive (cardBg/gradientTop).
  const cardBgDark = colors.bg.card;
  const heroFont = heroFontById('black'); // single, fixed greeting font (picker removed)

  // ── Stores & hooks ────────────────────────────────────────────────────────
  // Wąskie selektory zamiast całych store'ów (2026-08-12, krok 3 z hardening_index.md) —
  // wołanie useXStore() bez selektora subskrybuje WSZYSTKO w tym store, więc ten (ogromny)
  // ekran re-renderował się przy zmianie DOWOLNEGO pola, nawet niezwiązanego z dashboardem
  // (np. inny ekran woła setExpenses → dashboard re-renderuje się nawet jeśli akurat czyta
  // tylko `stats`). Ten sam wzorzec co już istniejące usePetStore(st => st.x)/useFoodStore
  // niżej — tylko dociągnięty do reszty store'ów, które tego jeszcze nie miały.
  const pomodoroStartFor = usePomodoroStore(s => s.startFor);
  const { stats, isLoading: finLoading, reload: reloadFin } = useExpenses();
  const insets = useSafeAreaInsets();
  const liveExpenses = useExpensesStore(s => s.expenses);
  const setExpenses = useExpensesStore(s => s.setExpenses);
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
  const moodEntries = useMoodStore(s => s.entries);
  const setMood = useMoodStore(s => s.setEntries);
  const addEntry = useMoodStore(s => s.addEntry);
  const events = useCalendarStore(s => s.events);
  const gcalEvents = useCalendarStore(s => s.gcalEvents);
  const calTasks = useCalendarStore(s => s.tasks);
  const setEvents = useCalendarStore(s => s.setEvents);
  const setGcalEvents = useCalendarStore(s => s.setGcalEvents);
  const { subscriptions, update: updateSub, add: addSub } = useSubscriptions();
  const workShifts = useWorkStore(s => s.shifts);
  const workSettings = useWorkStore(s => s.settings);
  const setWorkShifts = useWorkStore(s => s.setShifts);
  const setWorkSettings = useWorkStore(s => s.setSettings);
  const [budgets, setBudgets]       = useState<MonthlyBudgets>({});
  const [weatherPanel, setWeatherPanel] = useState(false);
  const workPanel    = useUiActions(s => s.workPanelOpen);   // boolean w store → brak podwójnego otwarcia
  const setWorkPanel = useUiActions(s => s.setWorkPanelOpen);
  const [statDetail, setStatDetail] = useState<CustomTile | null>(null);
  const [detailPeriod, setDetailPeriod] = useState<'week' | 'month'>('month'); // tydzień/miesiąc toggle in the detail view
  // Time capsule ("List do przyszłego siebie")
  const capsuleLetters = useTimeCapsule(st => st.letters);
  const addCapsule = useTimeCapsule(st => st.add);
  const markCapsuleRead = useTimeCapsule(st => st.markRead);
  const [capsuleModal, setCapsuleModal] = useState(false);
  const [capsuleText, setCapsuleText] = useState('');
  const [capsuleMonths, setCapsuleMonths] = useState(6);
  const [foodView, setFoodView] = useState<'week' | 'day' | 'month'>('week'); // food widget: tygodnie/dni/miesiące
  const [foodMonthSel, setFoodMonthSel] = useState<string | null>(null);       // browsed month (null = bieżący)
  const [foodCat, setFoodCat] = useState<string | null>(null); // tapped food subcategory → products modal
  const [nonFoodVer, setNonFoodVer] = useState(0);             // bumps when the "nie jedzenie" list changes
  useEffect(() => { loadNonFood().then(() => setNonFoodVer(v => v + 1)).catch(() => {}); }, []);
  const markNotFood = useCallback((name: string) => { haptic.tap(); addNonFood(name).then(() => setNonFoodVer(v => v + 1)).catch(() => {}); }, []);
  const [confirmNotFood, setConfirmNotFood] = useState<string | null>(null);
  const [nonShopVer, setNonShopVer] = useState(0);             // bumps when the "to nie sklep" list changes
  useEffect(() => { loadNonShop().then(() => setNonShopVer(v => v + 1)).catch(() => {}); }, []);
  const markNotShop = useCallback((name: string) => { haptic.tap(); addNonShop(name).then(() => setNonShopVer(v => v + 1)).catch(() => {}); }, []);
  const [confirmNotShop, setConfirmNotShop] = useState<string | null>(null);
  const foodMeals    = useFoodStore(st => st.meals);           // calorie log (for the balance widget)
  const foodProducts = useFoodStore(st => st.products);        // for the "dishes created" achievement
  const foodGoalMode = useFoodStore(st => st.goalMode);
  const foodManualGoal = useFoodStore(st => st.manualGoal);
  const dishesCreated = useMemo(() => foodProducts.filter(isRecipeProduct).length, [foodProducts]);
  const [weightInput, setWeightInput] = useState('');
  const [subConfirms, setSubConfirms] = useState<PendingSubConfirm[]>([]);
  const bankPendingCount = useBankQueue(st => st.pending.reduce((n, p) => n + (p.auto ? 0 : 1), 0)); // manual review only
  const bankAutoCount = useBankQueue(st => st.pending.reduce((n, p) => n + (p.auto ? 1 : 0), 0));
  const [tagRules, setTagRules]     = useState<TagBudgetRule[]>([]);
  const [payers, setPayers]         = useState<string[]>(['Ja', 'Partnerka']);
  const [tagModal, setTagModal]     = useState<any>(null);  // open tag-limit's item list
  // (stan rozwinięcia wariantów przeniesiony do TopProductsSection — patrz memo poniżej)
  const [finPeriod, setFinPeriod]   = useState<'week' | 'month'>('week');
  const [workHoursChart, setWorkHoursChart] = useState(false);
  const [sleepDashRange, setSleepDashRange] = useState<7 | 30>(30);
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
  const updateCustomTile = useDashboardLayout(s => s.updateCustomTile);
  const removeCustomTile = useDashboardLayout(s => s.removeCustomTile);
  const [confirmRemoveTile, setConfirmRemoveTile] = useState<{ id: string; title: string } | null>(null);
  const resetLayout    = useDashboardLayout(s => s.reset);
  const editRequested  = useDashboardLayout(s => s.editRequested);
  const clearEditRequest = useDashboardLayout(s => s.clearEditRequest);
  const [editingDash, setEditingDash] = useState(false);
  const [notePickerOpen, setNotePickerOpen] = useState(false);
  const [pixelPickerOpen, setPixelPickerOpen] = useState(false);
  const [showHiddenPool, setShowHiddenPool] = useState(false);
  // Custom widgety STATYSTYK usunięte (user: „wywal system custom widgetów" — były
  // niedopracowane). Proste piny (notatka/pogoda) zostają. Filtrujemy 'stat' wszędzie.
  //
  // WYJĄTEK (2026-08-24, user: "dodaj mi pixel year widget z możliwością wybrania czego") —
  // renderer (`renderStatTile`'s `viz==='pixels'` gałąź, `YearPixels.tsx`) i cały silnik
  // metryk (`PIXEL_METRICS`/`dailyValue`/`pixelTiers` w statWidgets.ts) były KOMPLETNE i
  // działające, tylko martwe — nie było skąd stworzyć taki kafelek (usunięty razem z resztą
  // "niedopracowanego" systemu). User poprosił konkretnie o TEN JEDEN widok (rok w
  // pikselach + wybór metryki), nie o przywrócenie CAŁEGO systemu (liczby/wave/donut/
  // porównania zostają wywalone, zgodnie z pierwotną decyzją). Zamiast blankietowego
  // `type !== 'stat'`, filtr NIŻEJ przepuszcza WYŁĄCZNIE `type==='stat' && viz==='pixels'`
  // — nowy picker (`pixelPickerOpen` niżej) jest JEDYNYM miejscem tworzącym kafelki 'stat',
  // więc żaden inny wariant (number/wave/…) nie może już powstać.
  const isVisibleCustomTile = useCallback((t: CustomTile) => t.type !== 'stat' || t.viz === 'pixels', []);
  const orderedSections = useMemo(() => effectiveOrder(dashOrder, customTiles.filter(isVisibleCustomTile)), [dashOrder, customTiles, isVisibleCustomTile]);
  const hiddenSet = useMemo(() => new Set(dashHidden), [dashHidden]);
  // The editor list shows only VISIBLE sections (not hidden, not auto-managed alerts),
  // so drag/arrow indices are positions in THAT list. Both handlers reorder the visible
  // sequence and then write it back into the full order, filling only the visible slots —
  // hidden and auto sections stay exactly where they are. Doing the splice directly on
  // the full order was the "drops in the wrong place" bug: a visible index N is not the
  // same as full-order index N once anything hidden/auto sits between the rows.
  const reorderVisible = useCallback((id: string, target: number) => {
    const st = useDashboardLayout.getState();
    const cur = effectiveOrder(st.order, st.customTiles.filter(isVisibleCustomTile));
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
  }, [setSectionOrder, isVisibleCustomTile]);

  const handleMoveTo = useCallback((id: string, target: number) => reorderVisible(id, target), [reorderVisible]);
  const moveVisible = useCallback((id: string, dir: -1 | 1) => {
    const st = useDashboardLayout.getState();
    const cur = effectiveOrder(st.order, st.customTiles.filter(isVisibleCustomTile));
    const hidden = new Set(st.hidden);
    const vis = cur.filter(x => !hidden.has(x) && !isAutoSection(x));
    const from = vis.indexOf(id);
    if (from < 0) return;
    reorderVisible(id, from + dir);
  }, [reorderVisible, isVisibleCustomTile]);

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
      .map(cn => ({ cn, days: cn.mode === 'auto' ? autoDaysWithout(cn, expenses, foodMeals) : daysSince(cn) }))
      .sort((a, b) => b.days - a.days),
    [counters, expenses, foodMeals, dayKey],
  );

  // "Rekordy życiowe" widget — all-time bests from the data already loaded.
  const records = useMemo(() => buildRecords(healthDays, expenses, moodEntries), [healthDays, expenses, moodEntries]);
  // „Rekord pobity!" — porównaj bieżące rekordy z zapisanym najlepszym wynikiem; pierwszy
  // raz = baseline (bez fajerwerków). Idempotentne (baseline w AsyncStorage tylko rośnie/
  // maleje na korzyść) + dedup w sesji, więc nie spamuje.
  const [recordFx, setRecordFx] = useState(false);
  const celebratedRecordsRef = useRef<Set<string>>(new Set());
  useEffect(() => {
    if (records.length === 0) return;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem('records_best_v1');
        const prev: Record<string, number> = raw ? JSON.parse(raw) : {};
        const isFirst = raw == null;
        const next: Record<string, number> = { ...prev };
        const beaten: typeof records = [];
        for (const r of records) {
          const better = !isFirst && prev[r.key] != null &&
            (r.lowerIsBetter ? r.num < prev[r.key] - 1e-9 : r.num > prev[r.key] + 1e-9);
          if (better && !celebratedRecordsRef.current.has(r.key)) { beaten.push(r); celebratedRecordsRef.current.add(r.key); }
          next[r.key] = prev[r.key] == null ? r.num : (r.lowerIsBetter ? Math.min(prev[r.key], r.num) : Math.max(prev[r.key], r.num));
        }
        await AsyncStorage.setItem('records_best_v1', JSON.stringify(next));
        if (beaten.length) {
          haptic.success();
          toast.success(`Nowy rekord! ${beaten[0].label}: ${beaten[0].value}`);
          setRecordFx(true);
          setTimeout(() => setRecordFx(false), 2600);
        }
      } catch {}
    })();
  }, [records]);

  // "Ściana serii" widget — every active streak: habit streaks + "dni bez"/since counters.
  const streakWall = useMemo<StreakItem[]>(() => {
    const fromHabits = habits.map(h => ({ key: `h:${h.id}`, name: h.title, days: getStreak(h.id) }));
    const fromCounters = counters
      .filter(cn => cn.kind === 'since')
      .map(cn => ({ key: `c:${cn.id}`, name: cn.mode === 'auto' ? `bez ${cn.name}` : cn.name, days: cn.mode === 'auto' ? autoDaysWithout(cn, expenses, foodMeals) : daysSince(cn) }));
    return [...fromHabits, ...fromCounters];
  }, [habits, getStreak, counters, expenses, foodMeals, dayKey]);

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
  // Used to queue an interactive "Czy opłaciłeś tę subskrypcję?" modal — nagged up to
  // twice a day and could stack on top of the mood check-in modal. Replaced: a due
  // subscription's nextBillingDate now just advances SILENTLY (no expense added, no
  // question asked) so it doesn't get stuck; the user is informed ahead of time instead,
  // via the renewal heads-up notifications scheduled in useSubscriptions (7 days + 1 day
  // before). Bank-detected payments still work exactly as before (confirmSub below).
  useEffect(() => {
    if (checkedSubs.current || subscriptions.length === 0) return;
    checkedSubs.current = true;
    const todayS = ymd(new Date());
    const due = new Set<string>();
    for (const s of subscriptions) {
      if (!s.active || isDurationExpired(s) || s.nextBillingDate > todayS) continue;
      due.add(s.id);
      let next = s.nextBillingDate;
      do { next = advanceNextBillingDate(next, s.billingCycle); } while (next <= todayS);
      updateSub(s.id, { nextBillingDate: next }).catch(() => {});
    }
    // Backfill: subscriptions that existed before the renewal heads-up feature won't have
    // it scheduled until their next add/update — arm it once here too (idempotent, same
    // notification identifiers get overwritten). Due ones are skipped — updateSub above
    // already reschedules them against their newly-advanced date.
    import('@/services/notificationsService').then(({ notificationsService }) => {
      for (const s of subscriptions) {
        if (s.active && !isDurationExpired(s) && !due.has(s.id)) {
          notificationsService.scheduleRenewalHeadsUp(s).catch(() => {});
        }
      }
    }).catch(() => {});
  }, [subscriptions]);

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

  // TYLKO gotówka tworzy wpis (przychód gdy ktoś oddaje mnie, wydatek gdy ja oddaję).
  // Karta/przelew NIE tworzy nic — złapie powiadomienie z banku (bez podwójnego liczenia).
  const settleDebt = useCallback(async (d: Debt, method: PaymentMethod) => {
    haptic.success();
    try {
      const iOwe = (d.kind ?? 'theyOwe') === 'iOwe';
      if (method === 'cash') {
        await expensesService.add({
          type: iOwe ? 'expense' : 'income', amount: d.amount, currency: 'PLN', category: 'transfer' as any,
          tags: [], note: iOwe ? `Oddałem: ${d.person}` : `Zwrot: ${d.person}`, date: localISO(), paymentMethod: 'cash',
        });
        expensesService.getAll().then(setExpenses).catch(() => {});
      }
      await debtsService.update(d.id, { settled: true, settledMethod: method, settledDate: todayISO() });
      setDebts(prev => prev.map(x => x.id === d.id ? { ...x, settled: true } : x));
      toast.success(method === 'cash'
        ? (iOwe ? 'Rozliczono — dodano do wydatków' : 'Rozliczono — dodano do przychodów')
        : 'Rozliczono — kartę/przelew złapie bank');
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
    const read = async () => {
      // BMR + poziom aktywności → burn per dzień = spoczynek + ruch (jak w zakładce Jedzenie),
      // żeby cel na dashboardzie zgadzał się z zakładką (podłoga ruchu wg aktywności).
      let pbmr = 0, floorFrac = ACTIVITY_FACTOR.mod, lw = 0;
      try {
        const g = await getHealthGoals();
        setHealthGoals({ stepGoal: g.stepGoal || 10000, waterGoal: g.waterGoal || 8, weightGoal: g.weightGoal || 0 });
        floorFrac = ACTIVITY_FACTOR[g.activityLevel] ?? ACTIVITY_FACTOR.mod;
        const lwRaw = await AsyncStorage.getItem('health_last_weight');
        lw = lwRaw ? parseFloat(lwRaw) : 0;
        pbmr = bmrMifflin(lw, g.heightCm, g.ageYears, g.sex);
      } catch {}
      getHealthHistory(150, pbmr, lw, floorFrac).then(h => {
        const m: StatCtx['healthDays'] = {};
        for (const [d, v] of Object.entries(h)) m[d] = { steps: v.steps, sleepMinutes: v.sleepMinutes, weightKg: v.weight > 0 ? v.weight : null, burn: v.burn };
        setHealthDays(m);
      }).catch(() => {});
    };
    read();
    // Pull fresh steps/sleep from the watch. force=true (app ENTRY: cold start + resume)
    // bypasses the 10-min throttle so widgets show current data straight away. A plain
    // mid-session TAB FOCUS passes force=false — the throttle then skips the native read
    // if it ran within 10 min, so switching tabs doesn't re-hit Health Connect + rewrite
    // the per-day cache every time (that setHealthDays churn kept re-dirtying this frozen
    // screen, so returning to the dashboard had a bigger thaw to reconcile → the lag).
    // force=true (cold start/resume) backfills the FULL 30-day window the sleep-chart
    // card actually displays — a plain 7-day window (used on lighter focus-only syncs
    // below) left the other ~23 days permanently empty for anyone who never visited
    // Zdrowie's manual "Zsynchronizuj z zegarka" button (the only other 30-day sync).
    import('@/services/healthAutoSync').then(({ autoSyncHealth }) => autoSyncHealth(force ? 30 : 7, force)).then(n => { if (n > 0) read(); }).catch(() => {});
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

  // Achievements — AsyncStorage-backed signals the badge counters need (bank
  // corrections, stats visits, self-test/backup flags, auto-merchant graduation).
  // Reloaded on focus so e.g. accepting a bank correction elsewhere shows up here
  // without needing a full app restart.
  const [achFlags, setAchFlags] = useState({ bankCorrections: 0, statsVisits: 0, backupDone: false, selfTestClean: false, autoMerchantReached: false });
  useFocusEffect(useCallback(() => {
    (async () => {
      const [bc, sv, backup, clean, mem] = await Promise.all([
        AsyncStorage.getItem('ach_bank_corrections'),
        AsyncStorage.getItem('ach_stats_visits'),
        getLastBackup().catch(() => null),
        AsyncStorage.getItem('ach_selftest_clean'),
        loadMerchantMemory().catch(() => ({})),
      ]);
      setAchFlags({
        bankCorrections: parseInt(bc ?? '0', 10) || 0,
        statsVisits: parseInt(sv ?? '0', 10) || 0,
        backupDone: !!backup,
        selfTestClean: clean === 'true',
        autoMerchantReached: Object.values(mem).some(m => m.auto),
      });
    })().catch(() => {});
  }, []));

  // Achievements — evaluate against live data so a newly-earned badge fires a
  // toast + haptic the moment you land on the dashboard (the ADHD dopamine hit).
  const achStates = useMemo(() => evaluateAchievements(buildAchCtx({
    expenses, moodEntries, workEvents: allEvents, workSettings,
    habitBestStreak: habits.length ? Math.max(0, ...habits.map(h => getStreak(h.id))) : 0,
    healthDays, tasksDone: tasks.filter(t => t.status === 'done').length,
    budgetTotal: Object.values(budgets).reduce((s2, v) => s2 + (v ?? 0), 0),
    billTracked: subscriptions.some(sb => sb.active), cardBalancePeak: cardPeak,
    foodMeals, dishesCreated,
    loginStreak: usePetStore.getState().loginStreak,
    ...achFlags,
  })), [expenses, moodEntries, allEvents, workSettings, habits, getStreak, healthDays, tasks, budgets, subscriptions, cardPeak, foodMeals, dishesCreated, achFlags]);
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
      // Zmiana roku (2026-08-24, user: "w ustawieniach w personalizacji nie dałeś mi
      // możliwości zmiany roku xdd") — dawniej `year` był na sztywno bieżącym rokiem, bez
      // żadnego sposobu podejrzenia poprzednich lat. `t.year` (nowe, opcjonalne pole
      // CustomTile) trzyma wybór PER KAFELEK; brak = bieżący rok, więc istniejące kafelki
      // (bez tego pola) zachowują się dokładnie jak wcześniej. Strzałki NIŻEJ wołają
      // `updateCustomTile` — PIERWSZE realne użycie tej akcji w index.tsx (dotąd
      // `period`/`target`/itd. dawały się ustawić TYLKO przy tworzeniu kafelka, nie
      // edytować później) — celowo NIE osobny ekran ustawień, tylko strzałki wprost na
      // widgecie (dane i tak są per-dzień, `dailyValue()` nie zakłada "bieżącego roku").
      // Prawa strzałka zablokowana na bieżącym roku (nie ma sensu podglądać przyszłości).
      const currentYear = new Date().getFullYear();
      const year = t.year ?? currentYear;
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
            <View style={s.pxYearRow}>
              <TouchableOpacity onPress={() => { haptic.tap(); updateCustomTile(t.id, { year: year - 1 }); }} hitSlop={8}>
                <ChevronLeft size={13} color={colors.text.muted} />
              </TouchableOpacity>
              <Text style={s.statSub}>Rok {year}{tierHint ? ` · ${tierHint}` : ''}</Text>
              <TouchableOpacity onPress={() => { if (year >= currentYear) return; haptic.tap(); updateCustomTile(t.id, { year: year + 1 }); }} hitSlop={8} disabled={year >= currentYear}>
                <ChevronRight size={13} color={year >= currentYear ? colors.border.default : colors.text.muted} />
              </TouchableOpacity>
            </View>
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
      // The whole point of comparing two metrics: do they move TOGETHER across the same
      // periods? Pearson over matched non-zero pairs → a plain-language verdict, so a
      // "sen vs energia" tile says "zwykle idą w parze" instead of two mute bars.
      const cmpVerdict = compareVerdict(a.values, b.values, colors.text.muted);
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
          <Text style={s.chartCaption}>Średnie w tych samych {a.values.length} {period === 'month' ? 'miesiącach' : 'tygodniach'}</Text>
          {cmpVerdict && (
            <View style={[s.cmpVerdict, { borderColor: cmpVerdict.color + '40', backgroundColor: cmpVerdict.color + '12' }]}>
              <Link2 size={12} color={cmpVerdict.color} />
              <Text style={[s.cmpVerdictTxt, { color: cmpVerdict.color }]}>{cmpVerdict.text}</Text>
            </View>
          )}
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

  const moodStreak = useMemo(() => moodStreakFrom(moodEntries, today), [moodEntries, today]);

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
    if (finPeriod === 'week') {
      const cur = weekOverview[weekOverview.length - 1]?.totalSpend ?? 0;
      const prev = weekOverview[weekOverview.length - 2]?.totalSpend ?? 0;
      const priors = weekOverview.slice(0, -1).map(w => w.totalSpend).filter(v => v > 0);
      const avg = priors.length ? priors.reduce((a, b) => a + b, 0) / priors.length : 0;
      return { vsPrev: pctChange(cur, prev), vsAvg: pctChange(cur, avg) };
    }
    return monthSpendCompare(scopedExpenses);
  }, [finPeriod, weekOverview, scopedExpenses]);

  // Average spending on FOOD per day-of-week (groceries only — other expenses
  // filtered out, per design). Data-driven from all historical grocery entries.
  const weekdayAvg = useMemo(() => weekdaySpendPattern(scopedExpenses), [scopedExpenses]);

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
    const planset = new Set<string>();   // distinct FUTURE work days left this month
    for (const e of allEvents) {
      if (!isWork(e) || (e.date ?? '').slice(0, 7) !== ymCur) continue;
      const h = dur(e); const day = (e.date ?? '').slice(0, 10);
      if (day <= today) { workedH += h; if (h > 0) dayset.add(day); }
      else { plannedH += h; if (h > 0) planset.add(day); }
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
    // NADCHODZĄCE miesiące (grafik naprzód z kalendarza) — suma godzin, byś zweryfikował od
    // razu po dodaniu. Bierzemy 4 miesiące do przodu, pokazujemy tylko te z godzinami.
    const upcoming = Array.from({ length: 4 }, (_, k) => {
      const d = new Date(now.getFullYear(), now.getMonth() + 1 + k, 1);
      const ym = `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
      let h = 0; const dset = new Set<string>();
      for (const e of allEvents) {
        if (!isWork(e) || (e.date ?? '').slice(0, 7) !== ym) continue;
        const dd = dur(e); h += dd; if (dd > 0) dset.add((e.date ?? '').slice(0, 10));
      }
      return { ym, label: MONTH_SHORT[d.getMonth()], year: d.getFullYear(), hours: h, shifts: dset.size, earnings: Math.round(h * rate) };
    }).filter(m => m.hours > 0);
    const upcomingH = upcoming.reduce((a, m) => a + m.hours, 0);
    return {
      months, currentHours, rate,
      currentEarnings: Math.round(currentHours * rate),
      workedH, plannedH, workedEarnings: Math.round(workedH * rate),
      plannedDays: planset.size,
      projectedH, projectedEarnings: Math.round(projectedH * rate),
      daysWorked: dayset.size,
      avgPerDay: dayset.size > 0 ? workedH / dayset.size : 0,
      prevHours: months[4].hours, prevEarnings: months[4].earnings,
      avgHours, avgEarnings,
      yearHours, yearEarnings: Math.round(yearHours * rate),
      shiftCount, perShift: shiftCount > 0 ? Math.round((workedH * rate) / shiftCount) : 0,
      bestMonth, upcoming, upcomingH,
      // brak JAKICHKOLWIEK dopasowanych godzin pracy → pokaż stan pusty (jak oznaczać grafik)
      anyHours: workedH > 0 || plannedH > 0 || upcomingH > 0 || months.some(m => m.hours > 0),
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
  const petDayClaims = usePetStore(st => st.dayClaims);
  const dailyBoxReady = !petDayClaims[`dailybox:${todayISO()}`];   // free daily chest waiting?
  const petAffection = usePetStore(st => st.affection);
  const petAffectionDay = usePetStore(st => st.affectionDay);
  const petEnergy = usePetStore(st => st.energy);
  const petDefeated = usePetStore(st => st.defeatedBosses);
  const petBossHp = usePetStore(st => st.bossHp);
  const petHydrated = usePetStore(st => st._hydrated);
  const petLoginStreak = usePetStore(st => st.loginStreak);
  const registerLogin = usePetStore(st => st.registerLogin);
  const loginRan = useRef(false);
  // Login-streak coin bonus: once per day, after the wallet hydrates → toast the reward.
  useEffect(() => {
    if (!petHydrated || loginRan.current) return;
    loginRan.current = true;
    const g = registerLogin();
    if (g) { haptic.success(); toast.success(`Seria logowań: ${g.streak} ${g.streak === 1 ? 'dzień' : 'dni'} 🔥  +${g.coins} monet`); }
  }, [petHydrated, registerLogin]);
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
      trainingStreak: 0, // ta karta nie liczy questów treningowych (brak profileStore tutaj) — patrz pet.tsx dla realnej wartości
      boughtSweetToday: expenses.some(e => e.type !== 'income' && (e.date ?? '').slice(0, 10) === tISO && (e.receiptItems ?? []).some(it => !it.excluded && (it.tags ?? []).some(tg => tg === 'słodycze' || tg === 'przekąski'))),
      stepTarget: avgSteps > 0 ? Math.max(8000, Math.ceil(avgSteps * 1.1 / 500) * 500) : 0,
      sleepMinutes: healthDays[tISO]?.sleepMinutes ?? 0,
      moodDaysThisMonth: new Set(moodEntries.filter(e => (e.date ?? '').startsWith(month)).map(e => e.date)).size,
      stepsThisMonth: Object.entries(healthDays).filter(([d]) => d.startsWith(month)).reduce((m, [, v]) => m + (v.steps ?? 0), 0),
    }, { claimedMilestones: petClaimedQuests, dailyClaims: petDailyClaims, monthlyClaims: petMonthlyClaims, today: tISO }, petLevel).claimableCount;
  }, [healthDays, moodEntries, habitsDoneIds.length, habits, expenses, monthCards, petClaimedQuests, petDailyClaims, petMonthlyClaims, getStreak, petLevel]);
  // Evening pupil nudge — content matches state (free chest → rewards → misses you).
  // Rescheduled on every open so it never nags about something already handled.
  useEffect(() => {
    const affectionLow = petAffectionDay !== todayISO() || petAffection < 30;
    import('@/services/notificationsService')
      .then(({ notificationsService }) => notificationsService.refreshPetReminder({ dailyBoxReady, claimable: petClaimable, affectionLow }))
      .catch(() => {});
  }, [dailyBoxReady, petClaimable, petAffection, petAffectionDay]);
  // „Boss czeka" — gdy jest bijalny boss (odblokowany poziomem, nie pokonany, ma HP) + energia.
  useEffect(() => {
    const fightable = BOSSES.some(b => petLevel >= b.unlockLevel && !(petDefeated ?? []).includes(b.id) && (petBossHp?.[b.id] ?? b.hp) > 0);
    import('@/services/notificationsService')
      .then(({ notificationsService }) => notificationsService.refreshBossReminder({ fightable, energy: petEnergy }))
      .catch(() => {});
  }, [petLevel, petDefeated, petBossHp, petEnergy]);
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

  // krótki dzień tygodnia („pon.") — pełny + szeroki font LexendTera wyjeżdżał poza ekran
  const dateLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'long' })
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

  // Historyczna pogoda (past_days=60 z weatherService, cache 6h) — jedyna metryka w
  // insightLinks, której dashboard jeszcze nie trzyma w pamięci; pobierana raz, potem
  // scalana per-dzień poniżej. Brak zgody na lokalizację / offline → po prostu pusta mapa,
  // insightLinks działa dalej bez pogody (jak dotąd).
  const [weatherByDay, setWeatherByDay] = useState<Record<string, number>>({});
  useEffect(() => {
    weatherService.getWeather().then(days => {
      const map: Record<string, number> = {};
      for (const d of days) map[d.date] = d.tempAvg;
      setWeatherByDay(map);
    }).catch(() => {});
  }, []);

  // „Co na Ciebie wpływa" — powiązania (Pearson) między sen/energia/humor/słodycze/praca/kroki/
  // pogoda z ostatnich 30 dni. Buduje metryki per-dzień z danych, które dashboard już ma.
  const insightLinks = useMemo(() => {
    const wcol = workSettings.workColor;
    const wp = workSettings.workPrefix?.trim().toLowerCase();
    const hasWork = !!(wcol || wp);
    const workByDay: Record<string, number> = {};
    if (hasWork) {
      for (const e of allEvents) {
        if (!isWorkEvent(e, { workColor: wcol, workPrefix: wp })) continue;
        const d = (e.date ?? '').slice(0, 10); if (!d) continue;
        workByDay[d] = (workByDay[d] ?? 0) + shiftHours(e);
      }
    }
    const sweetsByDay: Record<string, number> = {};
    for (const e of expenses) {
      if (e.type === 'income' || !inScope(e, scope)) continue;
      const d = (e.date ?? '').slice(0, 10); if (!d) continue;
      for (const it of (e.receiptItems ?? [])) {
        if (!consumesInScope(it, scope)) continue;
        if ((it.tags ?? []).some(t => SWEETS_TAGS.includes(t))) sweetsByDay[d] = (sweetsByDay[d] ?? 0) + 1;
      }
    }
    const days: DailyMetrics[] = [];
    const now = new Date();
    for (let i = 0; i < 30; i++) {
      const dt = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = ymd(dt);
      const md = moodByDay[key] ?? [];
      const mood = md.length ? md.reduce((a, b) => a + b.mood, 0) / md.length : undefined;
      const enVals = md.map(e => e.energy).filter(v => v > 0);
      const energy = enVals.length ? enVals.reduce((a, b) => a + b, 0) / enVals.length : undefined;
      const hd = healthDays[key];
      days.push({
        sleep: hd?.sleepMinutes && hd.sleepMinutes > 0 ? hd.sleepMinutes : undefined,
        steps: hd?.steps && hd.steps > 0 ? hd.steps : undefined,
        mood, energy,
        sweets: sweetsByDay[key] ?? 0,                 // brak zakupu = 0 słodyczy (istotny punkt)
        work: hasWork ? (workByDay[key] ?? 0) : undefined,
        weather: weatherByDay[key],
      });
    }
    return strongestLinks(days);
  }, [expenses, moodByDay, healthDays, allEvents, workSettings, scope, weatherByDay]);

  // "Jedzenie — rozkład": this month's FOOD spend (food lines only) split by week-of-month,
  // by day-of-week, and by food subcategory (mięso/nabiał/…).
  const foodBreakdown = useMemo(() => {
    const now = new Date();
    const y = now.getFullYear(), mo = now.getMonth();
    const mk = `${y}-${pad(mo + 1)}`;
    const monthKeys: string[] = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(y, mo - i, 1); monthKeys.push(`${d.getFullYear()}-${pad(d.getMonth() + 1)}`); }
    type Src = { id: string; date: string };
    type Agg = { total: number; weeks: number[]; dow: number[]; subs: Record<string, number>; subItems: Record<string, Record<string, number>>; subSrc: Record<string, Record<string, Src[]>> };
    const perMonth: Record<string, Agg> = {};
    for (const k of monthKeys) perMonth[k] = { total: 0, weeks: [0, 0, 0, 0, 0], dow: [0, 0, 0, 0, 0, 0, 0], subs: {}, subItems: {}, subSrc: {} };
    for (const e of expenses) {
      if (e.type === 'income' || !inScope(e, scope)) continue;
      const ym = (e.date ?? '').slice(0, 7);
      const a = perMonth[ym];
      if (!a) continue;
      const amt = foodAmountOf(e);
      if (amt <= 0) continue;
      a.total += amt;
      const dayNum = parseInt((e.date ?? '').slice(8, 10), 10) || 1;
      a.weeks[Math.min(4, Math.floor((dayNum - 1) / 7))] += amt;
      const js = new Date((e.date ?? '').slice(0, 10) + 'T12:00:00').getDay();
      a.dow[(js + 6) % 7] += amt;
      const pushSrc = (sc: string, nm: string) => { const arr = ((a.subSrc[sc] ??= {})[nm] ??= []); if (!arr.some(x => x.id === e.id)) arr.push({ id: e.id, date: e.date ?? '' }); };
      const items = e.receiptItems ?? [];
      if (items.length > 0) {
        for (const it of items) {
          if (!isFoodItem(it)) continue;
          const sc = foodSubcat(it);
          a.subs[sc] = (a.subs[sc] ?? 0) + (it.price ?? 0);
          const nm = canonicalProductName(it.name ?? '', nameAliases) || (it.name ?? '?');
          (a.subItems[sc] ??= {})[nm] = (a.subItems[sc][nm] ?? 0) + (it.price ?? 0);
          pushSrc(sc, nm);
        }
      } else if (e.category === 'groceries') {
        a.subs.inne = (a.subs.inne ?? 0) + amt;
        const nm = e.storeName || 'Zakupy (bez pozycji)';
        (a.subItems.inne ??= {})[nm] = (a.subItems.inne[nm] ?? 0) + amt;
        pushSrc('inne', nm);
      }
    }
    // Precompute a display object per month (any month is selectable/drillable).
    const display: Record<string, { total: number; weeks: number[]; dow: number[]; subRows: [string, number][]; subItems: Agg['subItems']; subSrc: Agg['subSrc']; name: string }> = {};
    for (const k of monthKeys) {
      const a = perMonth[k];
      const [yy, mm] = k.split('-').map(Number);
      const wUsed = Math.ceil(new Date(yy, mm, 0).getDate() / 7);
      display[k] = {
        total: a.total,
        weeks: a.weeks.slice(0, wUsed),
        dow: a.dow,
        subRows: Object.entries(a.subs).filter(([, v]) => v > 0.5).sort((x, z) => z[1] - x[1]) as [string, number][],
        subItems: a.subItems, subSrc: a.subSrc,
        name: new Date(yy, mm - 1, 1).toLocaleDateString('pl-PL', { month: 'long', year: yy === y ? undefined : 'numeric' }),
      };
    }
    const months = monthKeys.map(k => ({ ym: k, label: MONTH_SHORT[parseInt(k.slice(5, 7), 10) - 1], total: perMonth[k].total }));
    const prevMk = monthKeys[4];
    return { months, mk, display, prevTotal: perMonth[prevMk]?.total ?? 0 };
  }, [expenses, scope, nameAliases, nonFoodVer]);

  // The month the food widget is currently showing (null = bieżący).
  const foodSelYm = foodMonthSel ?? foodBreakdown.mk;
  const foodSel = foodBreakdown.display[foodSelYm] ?? foodBreakdown.display[foodBreakdown.mk];

  // Bilans kalorii — spalone (zegarek, healthDays.burn) vs zjedzone (dziennik jedzenia).
  const calorieBalance = useMemo(() => {
    const p = (n: number) => String(n).padStart(2, '0');
    const now = new Date();
    const days: { key: string; label: string; eaten: number; burn: number; balance: number }[] = [];
    const dow = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const eaten = foodMeals.filter(m => m.date === key).reduce((s, m) => s + m.kcal, 0);
      const burn = healthDays[key]?.burn ?? 0;
      days.push({ key, label: dow[d.getDay()], eaten, burn, balance: burn - eaten });
    }
    const todayCell = days[days.length - 1];
    const logged = days.filter(x => x.eaten > 0);
    const cumDeficit = logged.reduce((s, x) => s + x.balance, 0);
    const target = targetIntake(todayCell.burn, foodGoalMode, foodManualGoal);
    return { days, today: todayCell, loggedCount: logged.length, cumDeficit, kg: cumDeficit / 7700, target, hasData: logged.length > 0 };
  }, [foodMeals, healthDays, foodGoalMode, foodManualGoal]);

  // "Kolekcja sklepów" — where you shop as a collection: distinct stores, favourite
  // (most visits), and the most recently discovered new one.
  const shopsCollection = useMemo(() => {
    const counts: Record<string, number> = {};
    const firstSeen: Record<string, string> = {};
    for (const e of expenses) {
      if (e.type === 'income' || isSelfTransfer(e)) continue;
      const s = e.storeName?.trim();
      if (!s || isUserNonShop(s)) continue;   // pomiń wykluczone „to nie sklep"
      counts[s] = (counts[s] ?? 0) + 1;
      const d = (e.date ?? '').slice(0, 10);
      if (d && (!firstSeen[s] || d < firstSeen[s])) firstSeen[s] = d;
    }
    const rows = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const newest = Object.entries(firstSeen).sort((a, b) => b[1].localeCompare(a[1]))[0];
    return { rows, total: rows.length, fav: rows[0] ?? null, newest: newest ? { name: newest[0], date: newest[1] } : null };
  }, [expenses, nonShopVer]);

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
      {recordFx && <View pointerEvents="none" style={StyleSheet.absoluteFill}><Confetti colors={['#FDE047', '#FFFFFF', accentColor, '#22D3EE']} /></View>}

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
                    <Smile size={18} color={todayEntry ? colors.text.primary : colors.text.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/counters' as any); }} style={s.hdrIcon} activeOpacity={0.8}>
                    <Hourglass size={17} color={colors.text.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/month-cards' as any); }} style={s.hdrIcon} activeOpacity={0.8}>
                    <Layers size={17} color={colors.text.muted} />
                  </TouchableOpacity>
                  <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/achievements' as any); }} style={s.hdrIcon} activeOpacity={0.8}>
                    <Trophy size={17} color={colors.text.muted} />
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
                  <Text style={[s.factText, { marginTop: spacing[1] }]}>
                    {(dueDebt.kind ?? 'theyOwe') === 'iOwe'
                      ? `Czy oddałeś ${dueDebt.person} ${dueDebt.amount.toFixed(2)} zł?`
                      : `Czy ${dueDebt.person} oddał Ci ${dueDebt.amount.toFixed(2)} zł?`}
                  </Text>
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

              nodes['pet'] = (() => {
                const claimTotal = petClaimable + (dailyBoxReady ? 1 : 0);
                const hasStreaks = streakWall.some(x => x.days > 0);
                return (
                  <View style={{ gap: spacing[2] }}>
                    {/* Kolumna serii DOKLEJONA do kafla pupila (2026-08-24, user: "zróbmy te
                        ilość seri jako łączny kafelek z pupilem po prostu po prawej stronie") —
                        dawniej osobna, przesuwalna sekcja `streak-wall` nad tym kaflem (patrz
                        screenshot usera). Bez aktywnych serii: stary, samodzielny kafel pupila
                        z własną ramką/chevronem (nie ma czego dokleić). */}
                    {hasStreaks ? (
                      <View style={[s.petCombined, { backgroundColor: colors.bg.card, borderColor: colors.border.default }]}>
                        <TouchableOpacity activeOpacity={0.85} onPress={() => { haptic.tap(); router.navigate('/pet' as any); }} style={s.petCombinedLeft}>
                          <PetTile name={petName} pet={petState} level={petLevel} claimable={claimTotal} bare />
                        </TouchableOpacity>
                        <StreakWallCard streaks={streakWall} />
                      </View>
                    ) : (
                      <TouchableOpacity activeOpacity={0.85} onPress={() => { haptic.tap(); router.navigate('/pet' as any); }}>
                        <PetTile name={petName} pet={petState} level={petLevel} claimable={claimTotal} />
                      </TouchableOpacity>
                    )}
                    {/* Seria logowań — PRZENIESIONA (2026-08-21) z pet-shop.tsx na główny pulpit,
                        obok kafla pupila (bonus jest przyznawany tutaj, przy wejściu na pulpit —
                        user: "serię logowan przenieśmy na główny pulpit"). */}
                    {petLoginStreak > 0 && (
                      <View style={s.loginStrip}>
                        <Flame size={14} color="#FB923C" />
                        <Text style={s.loginStripTxt}>Seria logowań: {petLoginStreak} {petLoginStreak === 1 ? 'dzień' : 'dni'}</Text>
                        <View style={{ flex: 1 }} />
                        <Text style={s.loginStripNext}>jutro +{loginBonusCoins(petLoginStreak + 1)}</Text>
                      </View>
                    )}
                  </View>
                );
              })();

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
                            pomodoroStartFor(task.id, task.title);
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
                      <TouchableOpacity key={cn.id} onPress={() => { haptic.tap(); router.push(`/counters/${cn.id}` as any); }} activeOpacity={0.7}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 1 }}>
                          <Text style={s.cdName} numberOfLines={1}>{cn.name}</Text>
                          <Text style={[s.cdDays, during && { color: '#2AC68F' }]}>{label}</Text>
                        </View>
                        <WalkProgress progress={during ? eventProgress(cn) : untilProgress(cn)} color={during ? '#2AC68F' : accentColor} mode={during ? 'drive' : 'walk'} emoji={cn.emoji} />
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            );

            // Sleep — total-minutes bars only, no phase breakdown: readHealthRange() (which
            // feeds `healthDays`) doesn't carry sleep-stage data, and it's unverified whether
            // Samsung Health even exports stages for this watch (see the "Diagnostyka faz
            // snu" probe in the Zdrowie tab). Reuses `healthDays`, already loaded below for
            // correlations/records — no new fetch for this card.
            const sleepDays30 = Array.from({ length: 30 }, (_, i) => {
              const d = new Date(); d.setDate(d.getDate() - (29 - i));
              const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
              return { date: key, sleepMinutes: healthDays[key]?.sleepMinutes ?? 0 };
            });
            const sleepDaysShown = sleepDashRange === 7 ? sleepDays30.slice(-7) : sleepDays30;
            const sleepMaxMin = Math.max(...sleepDays30.map(d => d.sleepMinutes), 1);
            const sleepNights = sleepDays30.filter(d => d.sleepMinutes > 0);
            const sleepAvgMin = sleepNights.length ? Math.round(sleepNights.reduce((sum, d) => sum + d.sleepMinutes, 0) / sleepNights.length) : 0;
            const SLEEP_DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];

            // Pusto (0 nocy w 30-dniowym oknie) renderuje TERAZ własną kartę zamiast znikać
            // całkiem — user zgłaszał puste dane 4× z rzędu, a milczące `&& null` znaczyło
            // że nie było nawet gdzie stuknąć "sprawdź dlaczego" (przycisk był schowany w
            // Zdrowiu). Diagnostyka to ten sam probeSleep()/sleepProbeVerdict() co tam,
            // patrz memory sleep_widget_investigation.md.
            nodes['sleep-chart'] = sleepNights.length > 0 ? (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Moon size={13} color={accentColor} />
                  <Text style={s.cardTitle}>Sen</Text>
                  <Text style={[s.cdDays, { marginLeft: 4 }]}>śr. {(sleepAvgMin / 60).toFixed(1).replace('.0', '')}h</Text>
                  <View style={{ flex: 1 }} />
                  <TouchableOpacity onPress={() => { haptic.tap(); setSleepDashRange(r => r === 7 ? 30 : 7); }} style={s.workToggle} activeOpacity={0.8}>
                    <Text style={[s.workToggleText, { color: accentColor }]}>{sleepDashRange === 7 ? 'Tydzień' : 'Miesiąc'}</Text>
                  </TouchableOpacity>
                </View>
                <View style={{ flexDirection: 'row', alignItems: 'flex-end', gap: sleepDashRange === 7 ? 4 : 1.5, height: 56, marginTop: spacing[3] }}>
                  {sleepDaysShown.map(d => {
                    const h = d.sleepMinutes > 0 ? Math.max(3, (d.sleepMinutes / sleepMaxMin) * 56) : 2;
                    return (
                      <View key={d.date} style={{ flex: 1, alignItems: 'center', justifyContent: 'flex-end', height: 56 }}>
                        <View style={{
                          width: '100%', height: h, borderRadius: 2, minHeight: 2,
                          backgroundColor: d.sleepMinutes === 0 ? colors.border.subtle : d.sleepMinutes >= 420 ? accentColor : colors.text.muted,
                          opacity: d.sleepMinutes === 0 ? 0.5 : 0.85,
                        }} />
                      </View>
                    );
                  })}
                </View>
                {sleepDashRange === 7 && (
                  <View style={{ flexDirection: 'row', gap: 4, marginTop: 4 }}>
                    {sleepDaysShown.map(d => (
                      <Text key={d.date} style={[s.cdDays, { flex: 1, textAlign: 'center', fontSize: 9, fontWeight: '600', color: colors.text.muted }]}>
                        {SLEEP_DOW[new Date(d.date + 'T00:00:00').getDay()]}
                      </Text>
                    ))}
                  </View>
                )}
                {/* Rzadkie dane (mniej niż tydzień realnych nocy w 30-dniowym oknie) —
                    zamiast milcząco pustego wykresu, jasny powód + akcja. Automatyczny sync
                    przy starcie apki dobija tylko do 30 dni wstecz OD TERAZ, więc nie ma jak
                    magicznie wypełnić starszej historii — jedyny sposób to ręczny "Zsynchronizuj
                    z zegarka" w Zdrowiu (force=true, pełne okno), patrz memory backlog_2026-08-07. */}
                {sleepNights.length < 7 && (
                  <TouchableOpacity onPress={() => { haptic.tap(); router.navigate('/health' as any); }} activeOpacity={0.7} style={{ marginTop: 6 }}>
                    <Text style={[s.cdDays, { fontSize: 10, color: colors.text.muted }]}>
                      Tylko {sleepNights.length} {sleepNights.length === 1 ? 'noc' : 'nocy'} z danymi — otwórz Zdrowie i „Zsynchronizuj z zegarka" po więcej historii
                    </Text>
                  </TouchableOpacity>
                )}
              </View>
            ) : (
              // Puste, ale nie gołe (2026-08-14, user: "nie ma danych na nim brakuje mi
              // wyglądowo") — ikona-bąbelek zamiast małego tekstowego linku, wypełniony
              // przycisk zamiast szarego chipa, żeby karta nie wyglądała jak coś zepsutego
              // pośród reszty dashboardu. Diagnostyka pod spodem BEZ ZMIAN (patrz
              // NEXT_STEPS.md „Diagnostyka faz snu" — czy dane w ogóle da się zdobyć z tego
              // zegarka, to osobne pytanie od tego jak wygląda pusty stan).
              <View style={[s.card, { backgroundColor: cardBgDark, alignItems: 'center', paddingVertical: spacing[5] }]}>
                <View style={[s.sleepEmptyIcon, { backgroundColor: accentColor + '18' }]}>
                  <Moon size={22} color={accentColor} />
                </View>
                <Text style={s.sleepEmptyTitle}>Brak danych o śnie</Text>
                <Text style={[s.factText, { textAlign: 'center', marginTop: 2 }]}>
                  Ostatnie 30 dni bez ani jednej nocy z zegarka.
                </Text>
                <TouchableOpacity
                  onPress={async () => {
                    haptic.tap();
                    const { probeSleep, sleepProbeVerdict } = await import('@/services/healthConnectService');
                    const p = await probeSleep(7);
                    const { lines, verdict } = sleepProbeVerdict(p);
                    Alert.alert('Diagnostyka faz snu', lines.join('\n\n') + '\n\n' + verdict);
                  }}
                  activeOpacity={0.85}
                  style={[s.sleepEmptyBtn, { backgroundColor: accentColor }]}
                >
                  <Search size={14} color={colors.bg.primary} />
                  <Text style={[s.sleepEmptyBtnText, { color: colors.bg.primary }]}>Sprawdź dlaczego</Text>
                </TouchableOpacity>
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
                    {dashSince.slice(1, 7).map(({ cn, days }) => {
                      const tc = streakTier(days).color;
                      return (
                      <View key={cn.id} style={[s.sinceTile, { backgroundColor: tc + '1A', borderWidth: 1, borderColor: tc + '3A' }]}>
                        <StreakFlame days={days} size={46} />
                        <Text style={s.sinceTileUnit}>{days === 1 ? 'dzień' : 'dni'}</Text>
                        <Text style={s.sinceTileName} numberOfLines={1}>{cn.mode === 'auto' ? `bez ${cn.name}` : cn.name}</Text>
                      </View>
                      );
                    })}
                  </View>
                )}
              </View>
            );

            nodes['personal-records'] = records.length > 0 && <PersonalRecordsCard records={records} cardBg={cardBgDark} />;
            nodes['trivia'] = <TriviaCard cardBg={cardBgDark} />;
            nodes['reflections'] = <ReflectionCard cardBg={cardBgDark} />;

            nodes['time-capsule'] = (() => {
              const now = Date.now();
              const opened = capsuleLetters.filter(l => l.unlockAt <= now && !l.read).sort((a, b) => a.unlockAt - b.unlockAt)[0];
              const sealed = capsuleLetters.filter(l => l.unlockAt > now).sort((a, b) => a.unlockAt - b.unlockAt);
              const fmtD = (ms: number) => new Date(ms).toLocaleDateString('pl-PL', { day: 'numeric', month: 'long', year: 'numeric' });
              return (
                <View style={[s.card, { backgroundColor: cardBgDark }]}>
                  <View style={s.cardHeader}>
                    <Mail size={13} color={accentColor} />
                    <Text style={s.cardTitle}>List do przyszłego siebie</Text>
                    <TouchableOpacity onPress={() => { haptic.tap(); setCapsuleText(''); setCapsuleMonths(6); setCapsuleModal(true); }} style={[s.capsuleAddBtn, { borderColor: accentColor + '55' }]}>
                      <Plus size={14} color={accentColor} />
                    </TouchableOpacity>
                  </View>
                  {opened ? (
                    <View style={[s.capsuleOpen, { borderColor: accentColor + '40' }]}>
                      <Text style={s.capsuleFrom}>Napisany {fmtD(opened.createdAt)} · dziś się otworzył</Text>
                      <Text style={s.capsuleText}>{opened.text}</Text>
                      <TouchableOpacity style={[s.capsuleReadBtn, { backgroundColor: accentColor }]} onPress={() => { haptic.success(); markCapsuleRead(opened.id); }}>
                        <Text style={s.capsuleReadTxt}>Przeczytane</Text>
                      </TouchableOpacity>
                    </View>
                  ) : sealed.length > 0 ? (
                    <Text style={s.statSub}>
                      {sealed.length} {sealed.length === 1 ? 'zapieczętowany list' : 'zapieczętowane listy'} · najbliższy otwiera się {fmtD(sealed[0].unlockAt)}
                    </Text>
                  ) : (
                    <Text style={s.statSub}>Napisz wiadomość do siebie w przyszłości — odblokuje się za wybrany czas. Stuknij ＋.</Text>
                  )}
                </View>
              );
            })();

            nodes['year-ago'] = yearAgo.has && <YearAgoSection s={s} cardBg={cardBgDark} accentColor={accentColor} yearAgo={yearAgo} />;

            nodes['food-breakdown'] = foodBreakdown.months.some(m => m.total > 0) && (() => {
              const fb = foodBreakdown;
              const sel = foodSel;
              const isCurrent = foodSelYm === fb.mk;
              const deltaPct = (isCurrent && fb.prevTotal > 5) ? Math.round(((sel.total - fb.prevTotal) / fb.prevTotal) * 100) : null;
              const isMonthView = foodView === 'month';
              const series = foodView === 'week' ? sel.weeks : foodView === 'day' ? sel.dow : fb.months.map(m => m.total);
              const seriesLabels = foodView === 'week' ? sel.weeks.map((_, i) => `T${i + 1}`)
                : foodView === 'day' ? ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So', 'Nd']
                : fb.months.map(m => m.label);
              const smax = Math.max(...series, 1);
              const submax = sel.subRows[0]?.[1] ?? 1;
              return (
                <View style={[s.card, { backgroundColor: cardBgDark }]}>
                  <View style={s.cardHeader}>
                    <Utensils size={13} color={accentColor} />
                    <Text style={s.cardTitle}>Jedzenie · {sel.name}</Text>
                    {!isCurrent && (
                      <TouchableOpacity onPress={() => { haptic.tap(); setFoodMonthSel(null); }} hitSlop={8} style={s.foodNowChip}>
                        <Text style={s.foodNowTxt}>bieżący</Text>
                      </TouchableOpacity>
                    )}
                    <Text style={s.foodTotal}>{Math.round(sel.total)} zł</Text>
                  </View>
                  {deltaPct != null && (
                    <Text style={s.statSub}>{deltaPct > 0 ? '+' : ''}{deltaPct}% vs miesiąc temu ({Math.round(fb.prevTotal)} zł)</Text>
                  )}
                  <View style={s.foodToggle}>
                    {([['week', 'Tygodnie'], ['day', 'Dni'], ['month', 'Miesiące']] as const).map(([v, lbl]) => (
                      <TouchableOpacity key={v} onPress={() => { haptic.tap(); setFoodView(v); }} activeOpacity={0.8}
                        style={[s.foodToggleBtn, foodView === v && { backgroundColor: accentColor + '22', borderColor: accentColor }]}>
                        <Text style={[s.foodToggleTxt, foodView === v && { color: accentColor, fontWeight: '800' }]}>{lbl}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                  {isMonthView && <Text style={[s.statSub, { marginBottom: 2 }]}>Stuknij miesiąc, by zobaczyć jego rozkład</Text>}
                  <View style={s.foodBars}>
                    {series.map((v, i) => {
                      const ym = isMonthView ? fb.months[i]?.ym : null;
                      const selectedBar = isMonthView && ym === foodSelYm;
                      const barColor = selectedBar ? accentColor : accentColor + (isMonthView ? '77' : 'CC');
                      const inner = (
                        <>
                          <Text style={s.foodBarVal} numberOfLines={1}>{v > 0 ? Math.round(v) : ''}</Text>
                          <View style={s.foodBarTrack}><View style={{ width: '100%', height: `${Math.max(v > 0 ? 5 : 0, (v / smax) * 100)}%`, borderRadius: 3, backgroundColor: barColor }} /></View>
                          <Text style={[s.foodBarLbl, selectedBar && { color: accentColor, fontWeight: '800' }]}>{seriesLabels[i]}</Text>
                        </>
                      );
                      return isMonthView && ym
                        ? <TouchableOpacity key={i} style={s.foodBarCol} activeOpacity={0.7} onPress={() => { haptic.tap(); setFoodMonthSel(ym === fb.mk ? null : ym); }}>{inner}</TouchableOpacity>
                        : <View key={i} style={s.foodBarCol}>{inner}</View>;
                    })}
                  </View>
                  {sel.subRows.length > 0 ? (
                    <>
                      <Text style={[s.statSub, { marginTop: spacing[3], marginBottom: spacing[1] }]}>Co składa się na jedzenie ({sel.name}) · stuknij, by sprawdzić produkty</Text>
                      {sel.subRows.map(([tag, amt]) => {
                        const meta = FOOD_SUBCAT_META[tag] ?? { label: tag, color: '#9CA3AF' };
                        return (
                          <TouchableOpacity key={tag} style={s.foodSubRow} activeOpacity={0.7} onPress={() => { haptic.tap(); setFoodCat(tag); }}>
                            <View style={[s.foodSubDot, { backgroundColor: meta.color }]} />
                            <Text style={s.foodSubName} numberOfLines={1}>{meta.label}</Text>
                            <View style={s.foodSubTrack}><View style={{ width: `${Math.max(4, (amt / submax) * 100)}%`, height: '100%', borderRadius: 3, backgroundColor: meta.color }} /></View>
                            <Text style={s.foodSubAmt}>{Math.round(amt)} zł</Text>
                            <ChevronRight size={13} color={colors.text.muted} />
                          </TouchableOpacity>
                        );
                      })}
                    </>
                  ) : (
                    <Text style={[s.statSub, { marginTop: spacing[3] }]}>Brak wyszczególnionych produktów w {sel.name}.</Text>
                  )}
                </View>
              );
            })();

            nodes['calorie-balance'] = calorieBalance.hasData &&
              <CalorieBalanceSection s={s} cardBg={cardBgDark} accentColor={accentColor} colors={colors} cb={calorieBalance} />;

            nodes['shops-collection'] = shopsCollection.total > 0 && (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Store size={13} color={accentColor} />
                  <Text style={s.cardTitle}>Kolekcja sklepów</Text>
                  <Text style={s.shopTotal}>{shopsCollection.total}</Text>
                </View>
                {shopsCollection.fav && (
                  <Text style={s.statSub}>
                    Ulubiony: <Text style={{ color: accentColor, fontWeight: '800' }}>{shopsCollection.fav[0]}</Text> · {shopsCollection.fav[1]}×
                    {shopsCollection.newest ? `   ·   ostatnio nowy: ${shopsCollection.newest.name}` : ''}
                  </Text>
                )}
                <View style={s.shopWrap}>
                  {shopsCollection.rows.slice(0, 12).map(([name, cnt]) => (
                    <TouchableOpacity key={name} style={s.shopChip} activeOpacity={0.7}
                      onLongPress={() => { haptic.tap(); setConfirmNotShop(name); }}>
                      <Text style={s.shopChipName} numberOfLines={1}>{name}</Text>
                      <View style={[s.shopChipCount, { backgroundColor: accentColor + '26' }]}><Text style={[s.shopChipCountTxt, { color: accentColor }]}>{cnt}</Text></View>
                    </TouchableOpacity>
                  ))}
                </View>
                <ConfirmDialog
                  visible={!!confirmNotShop}
                  title="To nie sklep?"
                  message={confirmNotShop ? `Usunąć „${confirmNotShop}" z kolekcji sklepów? (np. przelew, osoba)` : undefined}
                  confirmLabel="To nie sklep"
                  onCancel={() => setConfirmNotShop(null)}
                  onConfirm={() => { if (confirmNotShop) markNotShop(confirmNotShop); setConfirmNotShop(null); }}
                />
                <Text style={s.shopHint}>Przytrzymaj sklep, aby usunąć (to nie sklep)</Text>
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
                            // Odhaczenie/dobicie celu, które WŁAŚNIE dziś przedłuża serię, dostaje
                            // toast z nową liczbą — user (2026-08-12): "dodajmy TOAST do streaków
                            // na dashboardzie". `streak` powyżej to seria WŁĄCZNIE z wczoraj, gdy
                            // dziś jeszcze nie zrobione (patrz getStreak w useHabits) — stąd +1 daje
                            // dokładnie nową wartość bez ponownego (potencjalnie nieaktualnego z
                            // domknięcia) odpytania store'u. Osobne od rzadkiej celebracji progu w
                            // StreakWallCard (tam tylko przy przekroczeniu 7/14/30/60/100).
                            const willComplete = isCount ? (!done && count + 1 >= goal) : !done;
                            if (willComplete) {
                              haptic.success();
                              const newStreak = streak + 1;
                              toast.success(`🔥 ${h.title}: ${newStreak} ${newStreak === 1 ? 'dzień' : 'dni'}!`);
                            } else {
                              haptic.tap();
                            }
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

            nodes['sweets-vs-food'] = weekOverview.filter(w => w.food > 0 || w.sweets > 0).length >= 2 &&
              <SweetsVsFoodSection s={s} cardBg={cardBgDark} accentColor={accentColor} colors={colors} weekOverview={weekOverview} />;

            nodes['who-ate'] = personConsumption.totalSweets > 0 && payers.length >= 2 && (
              <WhoAteCard data={personConsumption} monthLabel={MONTH_SHORT[new Date().getMonth()]} />
            );

            nodes['fixed-variable'] = fvMonths.length > 0
              && (fvMonths[fvMonths.length - 1].fixed + fvMonths[fvMonths.length - 1].variable + fvMonths[fvMonths.length - 1].food) > 0
              && <FixedVariableSection s={s} cardBg={cardBgDark} accentColor={accentColor} colors={colors} fvMonths={fvMonths} fvFixedItems={fvFixedItems} />;

            nodes['spend-by-day'] = weekdayAvg.some(d => d.avg > 0) &&
              <SpendByDaySection s={s} cardBg={cardBgDark} accentColor={accentColor} colors={colors} weekdayAvg={weekdayAvg} />;

            nodes['work-hours'] = workMonthly && (workMonthly.currentHours > 0 || workMonthly.months.some(m => m.hours > 0)) && (() => {
              const wm = workMonthly;
              const hasRate = wm.rate > 0;
              return (
                <TouchableOpacity style={[s.card, { backgroundColor: cardBgDark }]} activeOpacity={0.9}
                  onPress={() => { haptic.tap(); setWorkPanel(true); }}>
                  <View style={s.cardHeader}>
                    <Briefcase size={13} color={WORK_ACCENT} />
                    <Text style={s.cardTitle}>Praca</Text>
                    <TouchableOpacity
                      onPress={() => { haptic.tap(); setWorkHoursChart(v => !v); }}
                      style={s.workToggle}
                      activeOpacity={0.8}
                    >
                      <Text style={[s.workToggleText, { color: WORK_ACCENT }]}>
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
                            <View style={{ flex: Math.max(wm.workedH, 0.001), backgroundColor: WORK_ACCENT }} />
                            <View style={{ flex: Math.max(wm.plannedH, 0.001), backgroundColor: WORK_ACCENT + '40' }} />
                          </View>
                          <Text style={s.workSplitText}>
                            <Text style={{ color: WORK_ACCENT, fontWeight: '700' }}>{wm.workedH.toFixed(0)} h do teraz</Text>
                            {`  ·  zaplanowane +${wm.plannedH.toFixed(0)} h`}
                          </Text>
                        </View>
                      )}

                      {wm.daysWorked > 0 && (
                        <Text style={s.workMeta}>
                          {wm.daysWorked} {wm.daysWorked === 1 ? 'dzień' : 'dni'} · śr. {wm.avgPerDay.toFixed(1)} h/dzień{hasRate ? ` · ${Math.round(wm.avgPerDay * wm.rate).toLocaleString('pl-PL')} zł/dzień` : ''}
                        </Text>
                      )}

                      {/* grafik naprzód — od razu widać sumę godzin przyszłych miesięcy */}
                      {wm.upcoming.length > 0 && (
                        <View style={s.workAheadRow}>
                          <CalendarClock size={12} color={WORK_ACCENT} />
                          <Text style={s.workAheadText} numberOfLines={1}>
                            Naprzód <Text style={{ color: WORK_ACCENT, fontWeight: '800' }}>{wm.upcomingH.toFixed(0)} h</Text>
                            {'  ·  ' + wm.upcoming.map(m => `${m.label} ${m.hours.toFixed(0)}h`).join(' · ')}
                          </Text>
                        </View>
                      )}
                    </>
                  ) : (
                    <>
                      <View style={s.waveValues}>
                        {wm.months.map((m, i) => (
                          <Text key={i} style={[s.waveValue, m.isCurrent && { color: WORK_ACCENT, fontWeight: '800' }]}>
                            {hasRate
                              ? (m.earnings > 0 ? (m.earnings >= 1000 ? `${(m.earnings / 1000).toFixed(1)}k` : String(m.earnings)) : '')
                              : (m.hours > 0 ? `${Math.round(m.hours)}h` : '')}
                          </Text>
                        ))}
                      </View>
                      <WaveChart data={wm.months.map(m => hasRate ? m.earnings : m.hours)} color={WORK_ACCENT} />
                      <View style={s.waveLabels}>
                        {wm.months.map((m, i) => (
                          <Text key={i} style={[s.waveLabel, m.isCurrent && { color: WORK_ACCENT, fontWeight: '700' }]}>
                            {m.label}
                          </Text>
                        ))}
                      </View>
                    </>
                  )}
                </TouchableOpacity>
              );
            })();

            nodes['top-products'] = topProducts.length > 0 &&
              <TopProductsSection s={s} cardBg={cardBgDark} accentColor={accentColor} topProducts={topProducts} />;

            nodes['fun-facts'] = (funFacts.length > 0 || weightFacts.length > 0) &&
              <FunFactsSection s={s} cardBg={cardBgDark} accentColor={accentColor} funFacts={funFacts} weightFacts={weightFacts} />;

            nodes['correlations'] = correlations.length > 0 &&
              <CorrelationsSection s={s} cardBg={cardBgDark} accentColor={accentColor} colors={colors} correlations={correlations} />;

            nodes['insights-web'] = insightLinks.length > 0 &&
              <CorrelationsInsightCard links={insightLinks} cardBg={cardBgDark} />;

            nodes['mood-cal'] = Object.keys(moodByDay).some(d => d.startsWith(`${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}`)) && (() => {
              const loggedToday = (moodByDay[todayStr()] ?? []).length > 0;
              return (
              <View style={[s.card, { backgroundColor: cardBgDark }]}>
                <View style={s.cardHeader}>
                  <Smile size={13} color={colors.text.muted} />
                  <Text style={s.cardTitle}>Nastrój — ten miesiąc</Text>
                  {loggedToday ? (
                    <View style={s.moodDoneChip}>
                      <Check size={11} color="#2AC68F" />
                      <Text style={s.moodDoneTxt}>zapisano dziś</Text>
                    </View>
                  ) : (
                    <TouchableOpacity style={s.moodTodoChip} activeOpacity={0.8}
                      onPress={() => { haptic.tap(); router.navigate({ pathname: '/(tabs)/mood', params: { openCheckIn: 'true' } } as any); }}>
                      <Plus size={11} color={colors.accent.blue} />
                      <Text style={s.moodTodoTxt}>zapisz nastrój</Text>
                    </TouchableOpacity>
                  )}
                </View>
                <MoodMiniCal moodByDay={moodByDay} />
              </View>
              );
            })();

            nodes['mood-wave'] = weekOverview.filter(w => w.avgMood !== null).length >= 3 &&
              <MoodWaveSection s={s} cardBg={cardBgDark} accentColor={accentColor} colors={colors} weekOverview={weekOverview} />;

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
              for (const t of customTiles) if (isVisibleCustomTile(t)) nodes[t.id] = renderCustomTile(t);

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
                          onRemove={(rid) => { haptic.tap(); setConfirmRemoveTile({ id: rid, title }); }}
                          onEdit={undefined}
                        />
                      );
                    })}
                    <ConfirmDialog
                      visible={!!confirmRemoveTile}
                      title="Usuń kafelek"
                      message={confirmRemoveTile ? `Na pewno usunąć „${confirmRemoveTile.title}"?` : undefined}
                      onCancel={() => setConfirmRemoveTile(null)}
                      onConfirm={() => { if (confirmRemoveTile) removeCustomTile(confirmRemoveTile.id); setConfirmRemoveTile(null); }}
                    />

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

                    <TouchableOpacity style={s.editAddBtn} onPress={() => { haptic.tap(); setNotePickerOpen(true); }} activeOpacity={0.85}>
                      <Plus size={15} color={accentColor} />
                      <Text style={[s.editAddText, { color: accentColor }]}>Dodaj kafelek z notatką</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.editAddBtn} onPress={() => { haptic.tap(); addCustomTile({ type: 'weather', title: 'Pogoda' }); }} activeOpacity={0.85}>
                      <CloudSun size={15} color={accentColor} />
                      <Text style={[s.editAddText, { color: accentColor }]}>Dodaj kafelek z pogodą</Text>
                    </TouchableOpacity>
                    <TouchableOpacity style={s.editAddBtn} onPress={() => { haptic.tap(); setPixelPickerOpen(true); }} activeOpacity={0.85}>
                      <Grid3x3 size={15} color={accentColor} />
                      <Text style={[s.editAddText, { color: accentColor }]}>Dodaj kafelek: Rok w pikselach</Text>
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
      {/* Dashboard = SZYBKI zapis → zawsze NOWY wpis (numerek „Humor N. raz dziś"), nie edycja
          dzisiejszego. Poprawianie pomyłek robisz w zakładce Humor (edytuj konkretny wpis). */}
      <MoodCheckInModal visible={modalVisible} onClose={closeCheckIn} existingEntry={null} />

      {/* Work panel */}
      <Modal visible={workPanel} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setWorkPanel(false)}>
        <View style={s.npOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setWorkPanel(false)} />
          <View style={[s.card, { backgroundColor: colors.bg.card }]}>
            <View style={s.cardHeader}>
              <Briefcase size={15} color={WORK_ACCENT} />
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
                  {/* ── NA ŻYWO: jesteś w pracy → zarobek na sekundę (tyka co sekundę) ── */}
                  {workEarnings.isWorking && (
                    <View style={s.wpLive}>
                      <View style={s.wpLiveTop}>
                        <View style={s.wpLiveDot} />
                        <Text style={s.wpLiveTag}>NA ŻYWO W PRACY{workEarnings.activeEventTitle ? ` · ${workEarnings.activeEventTitle}` : ''}</Text>
                      </View>
                      <Text style={s.wpLiveBig}>{workEarnings.totalEarned.toFixed(2)}<Text style={s.wpLiveUnit}> zł</Text></Text>
                      <Text style={s.wpLiveSub}>
                        +{(workEarnings.perSecond * 100).toFixed(2)} gr/s
                        {workEarnings.perSecond > 0 ? `  ·  ${Math.round(workEarnings.perSecond * 3600).toLocaleString('pl-PL')} zł/h` : ''}
                      </Text>
                    </View>
                  )}
                  {/* ── Stan pusty: prefiks/kolor ustawiony, ale ZERO dopasowanych zmian ── */}
                  {!wm.anyHours && (
                    <View style={s.wpEmpty}>
                      <Text style={s.wpEmptyTitle}>Brak godzin pracy w kalendarzu</Text>
                      <Text style={s.wpEmptyBody}>
                        Godziny liczą się z wydarzeń, których tytuł zaczyna się od „{workSettings.workPrefix || '[JD]'}"
                        i mają godzinę (np. „{workSettings.workPrefix || '[JD]'} 8-16"){workSettings.workColor ? ' lub mają kolor pracy' : ''}.
                        Dodaj grafik na przyszłe miesiące — pojawi się tu od razu (i w „Zaplanowane naprzód").
                      </Text>
                    </View>
                  )}
                  {/* ── Ten miesiąc: fakt = godziny z kalendarza [JD] ── */}
                  <View style={{ marginTop: spacing[2] }}>
                    <Text style={s.wpBig}>{wm.workedH.toFixed(0)}<Text style={s.wpUnit}> h</Text></Text>
                    <Text style={s.wpSub}>
                      przepracowane w tym miesiącu
                      {hasRate ? `  ·  ≈ ${wm.workedEarnings.toLocaleString('pl-PL')} zł do teraz` : ''}
                    </Text>
                  </View>

                  {/* ── WAŻNE NA GÓRZE: ile zostało do przepracowania ── */}
                  {(wm.plannedDays > 0 || wm.plannedH > 0) && (
                    <View style={s.wpLeftCard}>
                      <View style={s.wpLeftItem}>
                        <Text style={s.wpLeftVal}>{wm.plannedDays}</Text>
                        <Text style={s.wpLeftLbl}>dni zostało</Text>
                      </View>
                      <View style={s.wpLeftDivider} />
                      <View style={s.wpLeftItem}>
                        <Text style={s.wpLeftVal}>{wm.plannedH.toFixed(0)}<Text style={s.wpLeftUnit}> h</Text></Text>
                        <Text style={s.wpLeftLbl}>do przepracowania</Text>
                      </View>
                      {hasRate && (
                        <>
                          <View style={s.wpLeftDivider} />
                          <View style={s.wpLeftItem}>
                            <Text style={[s.wpLeftVal, { color: WORK_ACCENT }]}>{wm.projectedEarnings.toLocaleString('pl-PL')}</Text>
                            <Text style={s.wpLeftLbl}>zł prognoza mies.</Text>
                          </View>
                        </>
                      )}
                    </View>
                  )}

                  {/* ── ZAPLANOWANE NAPRZÓD: grafik przyszłych miesięcy (weryfikacja) ── */}
                  {wm.upcoming.length > 0 && (
                    <View style={s.wpAheadCard}>
                      <View style={s.wpAheadHead}>
                        <CalendarClock size={13} color={WORK_ACCENT} />
                        <Text style={s.wpAheadTitle}>Zaplanowane naprzód</Text>
                        <Text style={s.wpAheadTotal}>{wm.upcomingH.toFixed(0)} h</Text>
                      </View>
                      {wm.upcoming.map(m => (
                        <View key={m.ym} style={s.wpAheadRow}>
                          <Text style={s.wpAheadMonth}>{m.label} {m.year}</Text>
                          <Text style={s.wpAheadDays}>{m.shifts} {m.shifts === 1 ? 'dzień' : 'dni'}</Text>
                          <Text style={s.wpAheadH}>{m.hours.toFixed(0)} h{hasRate ? ` · ${m.earnings.toLocaleString('pl-PL')} zł` : ''}</Text>
                        </View>
                      ))}
                      <Text style={s.wpAheadHint}>Suma godzin z kalendarza na przyszłe miesiące — sprawdź czy grafik się zgadza.</Text>
                    </View>
                  )}

                  {/* ── Średnie z przeszłości ── */}
                  {wm.avgHours > 0 && (
                    <Text style={s.wpAvgLine}>
                      Średnio <Text style={s.wpAvgB}>{wm.avgHours.toFixed(0)} h</Text>/mies{hasRate ? <> · <Text style={s.wpAvgB}>{wm.avgEarnings.toLocaleString('pl-PL')} zł</Text></> : null} (poprz. miesiące)
                      {wm.projectedH > 0 ? <> · w tym mies. plan <Text style={s.wpAvgB}>{wm.projectedH.toFixed(0)} h</Text></> : null}
                    </Text>
                  )}

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
                            <Text style={[s.wmZl, { color: inAvg ? WORK_ACCENT : colors.text.muted }]}>{rate != null ? `${rate.toFixed(1)}` : '—'}</Text>
                          </View>
                        );
                      })}
                      {(() => {
                        const paychecks = expenses.filter(e => isPaycheck(e, workSettings.workPrefix));
                        const jdTotal = paychecks.reduce((sum, e) => sum + e.amount, 0);
                        return jdTotal > 0 ? (
                          <View style={s.wpTotalRow}>
                            <Text style={s.wpTotalLabel}>Łącznie{workSettings.workPrefix ? ` (${workSettings.workPrefix})` : ''} · {paychecks.length} wypł.</Text>
                            <Text style={[s.wpTotalVal, { color: WORK_ACCENT }]}>{Math.round(jdTotal).toLocaleString('pl-PL')} zł</Text>
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

                  {/* ── Rok / porównania: fakty łączne ── */}
                  <View style={s.wxChips}>
                    {wm.daysWorked > 0 && <View style={s.wxChip}><Text style={s.wxChipK}>Dni w pracy (mies.)</Text><Text style={s.wxChipV}>{wm.daysWorked}{wm.avgPerDay > 0 ? ` · ${wm.avgPerDay.toFixed(1)} h/dzień` : ''}</Text></View>}
                    {wm.avgHours > 0 && (() => {
                      const diff = Math.round(wm.projectedH - wm.avgHours);
                      const pct = Math.round((wm.projectedH / wm.avgHours - 1) * 100);
                      return <View style={s.wxChip}><Text style={s.wxChipK}>Ten mies. vs średnia</Text><Text style={[s.wxChipV, { color: diff >= 0 ? '#34D399' : '#F87171' }]}>{diff >= 0 ? '+' : ''}{diff} h ({pct >= 0 ? '+' : ''}{pct}%)</Text></View>;
                    })()}
                    {wm.bestMonth && wm.bestMonth.hours > 0 && <View style={s.wxChip}><Text style={s.wxChipK}>Najlepszy miesiąc</Text><Text style={s.wxChipV}>{wm.bestMonth.label} {wm.bestMonth.year} · {Math.round(wm.bestMonth.hours)} h{hasRate ? ` · ${wm.bestMonth.earnings.toLocaleString('pl-PL')} zł` : ''}</Text></View>}
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
                // Same unit → one shared scale (direct compare). Different units (sen h vs
                // energia /5) → scale EACH to its own max so both are visible and you compare
                // the SHAPE, not absolute height (the old shared scale = the "durne słupki").
                const sameUnit = aS.unit === bS.unit;
                const shared = Math.max(...aS.values, ...bS.values, 1);
                const aMax = sameUnit ? shared : Math.max(...aS.values, 1);
                const bMax = sameUnit ? shared : Math.max(...bS.values, 1);
                const cmpVerdict = compareVerdict(aS.values, bS.values, colors.text.muted);
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
                            <View style={{ width: 10, height: Math.max(2, (v / aMax) * HB), borderRadius: 3, backgroundColor: accentColor }} />
                            <View style={{ width: 10, height: Math.max(2, ((bS.values[i] ?? 0) / bMax) * HB), borderRadius: 3, backgroundColor: '#FBBF24' }} />
                          </View>
                          <Text style={s.tagHistLbl}>{aS.labels[i]}</Text>
                        </View>
                      ))}
                    </View>
                    {!sameUnit && <Text style={[s.statSub, { marginTop: 6 }]}>Słupki skalowane osobno (różne jednostki) — porównuj kształt, nie wysokość.</Text>}
                    {cmpVerdict && (
                      <View style={[s.cmpVerdict, { borderColor: cmpVerdict.color + '40', backgroundColor: cmpVerdict.color + '12' }]}>
                        <Link2 size={12} color={cmpVerdict.color} />
                        <Text style={[s.cmpVerdictTxt, { color: cmpVerdict.color }]}>{cmpVerdict.text}</Text>
                      </View>
                    )}
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

      {/* Time capsule — write a letter to your future self */}
      <Modal visible={capsuleModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setCapsuleModal(false)}>
        <View style={s.capsuleOverlay}>
          <View style={[s.card, { backgroundColor: colors.bg.card, margin: spacing[4] }]}>
            <View style={s.cardHeader}>
              <Mail size={14} color={colors.accent.blue} />
              <Text style={s.cardTitle}>List do przyszłego siebie</Text>
              <TouchableOpacity onPress={() => setCapsuleModal(false)} hitSlop={10} style={{ marginLeft: 'auto' }}><X size={18} color={colors.text.muted} /></TouchableOpacity>
            </View>
            <TextInput
              style={s.capsuleInput}
              value={capsuleText}
              onChangeText={setCapsuleText}
              placeholder="Napisz coś do siebie w przyszłości…"
              placeholderTextColor={colors.text.muted}
              multiline
            />
            <Text style={[s.statSub, { marginTop: spacing[2] }]}>Otwórz za:</Text>
            <View style={s.capsuleChips}>
              {[1, 3, 6, 12].map(m => {
                const on = capsuleMonths === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); setCapsuleMonths(m); }} style={[s.capsuleChip, on && { backgroundColor: colors.accent.blue + '22', borderColor: colors.accent.blue }]}>
                    <Text style={[s.capsuleChipTxt, on && { color: colors.accent.blue, fontWeight: '800' }]}>{m === 12 ? 'rok' : `${m} mies.`}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
            <View style={{ flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] }}>
              <TouchableOpacity style={s.capsuleCancel} onPress={() => setCapsuleModal(false)}><Text style={s.capsuleCancelTxt}>Anuluj</Text></TouchableOpacity>
              <TouchableOpacity
                style={[s.capsuleSeal, { backgroundColor: colors.accent.blue }, !capsuleText.trim() && { opacity: 0.4 }]}
                disabled={!capsuleText.trim()}
                onPress={() => {
                  const d = new Date(); d.setMonth(d.getMonth() + capsuleMonths);
                  addCapsule(capsuleText, d.getTime());
                  haptic.success(); toast.success('Zapieczętowano — do zobaczenia w przyszłości');
                  setCapsuleModal(false); setCapsuleText('');
                }}
              >
                <Text style={s.capsuleSealTxt}>Zapieczętuj</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>

      {/* Food subcategory → its products this month (check + fix categorisation) */}
      <Modal visible={!!foodCat} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setFoodCat(null)}>
        <TouchableOpacity style={s.npOverlay} activeOpacity={1} onPress={() => setFoodCat(null)}>
          <TouchableOpacity activeOpacity={1} style={[s.card, { backgroundColor: colors.bg.card }]} onPress={() => {}}>
            {foodCat && (() => {
              const meta = FOOD_SUBCAT_META[foodCat] ?? { label: foodCat, color: '#9CA3AF' };
              const items = Object.entries(foodSel.subItems[foodCat] ?? {}).sort((a, b) => b[1] - a[1]);
              return (
                <>
                  <View style={s.cardHeader}>
                    <View style={[s.foodSubDot, { backgroundColor: meta.color }]} />
                    <Text style={s.cardTitle}>{meta.label} · {foodSel.name}</Text>
                    <TouchableOpacity onPress={() => setFoodCat(null)} hitSlop={10} style={{ marginLeft: 'auto' }}><X size={18} color={colors.text.muted} /></TouchableOpacity>
                  </View>
                  <Text style={[s.statSub, { marginTop: 2 }]}>{items.length} {items.length === 1 ? 'pozycja' : 'pozycji'} · stuknij, by otworzyć paragon; <Text style={{ color: colors.accent.red }}>⦸</Text> = to nie jedzenie (wyłącz z liczenia).</Text>
                  <ScrollView style={{ maxHeight: 300, marginTop: spacing[2] }} showsVerticalScrollIndicator={false}>
                    {items.map(([name, amt]) => {
                      const srcs = (foodSel.subSrc[foodCat!]?.[name] ?? []).slice().sort((a, b) => b.date.localeCompare(a.date));
                      return (
                      <View key={name} style={s.foodItemRow}>
                        <TouchableOpacity style={s.foodItemTap} activeOpacity={0.7}
                          onPress={() => {
                            haptic.tap(); setFoodCat(null);
                            if (srcs.length) router.navigate(`/expenses/${srcs[0].id}` as any);
                            else router.navigate(`/products?q=${encodeURIComponent(name)}` as any);
                          }}>
                          <View style={{ flex: 1 }}>
                            <Text style={s.foodItemName} numberOfLines={1}>{name}</Text>
                            {srcs.length > 1 && <Text style={s.foodItemSub}>{srcs.length} paragony</Text>}
                          </View>
                          <Text style={s.foodItemAmt}>{amt.toFixed(2)} zł</Text>
                          <ChevronRight size={13} color={colors.text.muted} />
                        </TouchableOpacity>
                        <TouchableOpacity style={s.notFoodBtn} hitSlop={6}
                          onPress={() => { haptic.tap(); setConfirmNotFood(name); }}>
                          <Ban size={15} color={colors.accent.red} />
                        </TouchableOpacity>
                      </View>
                      );
                    })}
                    {items.length === 0 && <Text style={s.statSub}>Brak pozycji w tej kategorii (wykluczone lub bez pozycji).</Text>}
                  </ScrollView>
                  <TouchableOpacity
                    style={{ marginTop: spacing[3], flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: radius.lg, backgroundColor: accentColor }}
                    activeOpacity={0.9}
                    onPress={() => { haptic.tap(); setFoodCat(null); router.navigate('/products' as any); }}>
                    <ShoppingCart size={16} color={colors.bg.primary} strokeWidth={2.4} />
                    <Text style={{ fontSize: 14, fontWeight: '800', color: colors.bg.primary }}>Zarządzaj produktami</Text>
                  </TouchableOpacity>
                </>
              );
            })()}
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      <ConfirmDialog
        visible={!!confirmNotFood}
        title="To nie jedzenie?"
        message={confirmNotFood ? `„${confirmNotFood}" zniknie z liczenia jedzenia (wszędzie). Można cofnąć w paragonie.` : undefined}
        confirmLabel="Nie jedzenie"
        onCancel={() => setConfirmNotFood(null)}
        onConfirm={() => { if (confirmNotFood) markNotFood(confirmNotFood); setConfirmNotFood(null); }}
      />

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

      {/* "Rok w pikselach" — wybór METRYKI (2026-08-24, user: "dodaj mi pixel year widget z
          możliwością wybrania czego"). Ten sam wzorzec co picker notatki wyżej (te same style
          `np*`) — tylko lista PIXEL_METRICS zamiast notatek. Zawsze tworzy `viz:'pixels'`,
          patrz komentarz przy `isVisibleCustomTile` wyżej — to JEDYNE miejsce tworzące kafelki
          'stat', więc żaden inny wariant (number/wave/…) z dawnego, wywalonego systemu nie
          może już powstać. */}
      <Modal visible={pixelPickerOpen} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setPixelPickerOpen(false)}>
        <View style={s.npOverlay}>
          <View style={s.npCard}>
            <View style={s.npHeader}>
              <Text style={s.npTitle}>Rok w pikselach — wybierz co śledzić</Text>
              <TouchableOpacity onPress={() => setPixelPickerOpen(false)} hitSlop={8}>
                <X size={18} color={colors.text.muted} />
              </TouchableOpacity>
            </View>
            <ScrollView style={{ maxHeight: 360 }} showsVerticalScrollIndicator={false}>
              {[...PIXEL_METRICS].map(id => {
                const def = metricById(id);
                if (!def) return null;
                const Ic = metricIcon(def);
                return (
                  <TouchableOpacity
                    key={id}
                    style={s.npRow}
                    onPress={() => {
                      haptic.tap();
                      addCustomTile({ type: 'stat', viz: 'pixels', metric: id, title: def.label });
                      setPixelPickerOpen(false);
                    }}
                    activeOpacity={0.8}
                  >
                    <Ic size={14} color={accentColor} />
                    <Text style={s.npRowText} numberOfLines={1}>{def.label}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>
        </View>
      </Modal>

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

  scroll: { paddingHorizontal: spacing[4], gap: spacing[4], paddingTop: spacing[5] },

  // ── Minimal header (date + weather) ───────────────────────────────────────
  headerMin: { paddingTop: spacing[1], marginBottom: spacing[4] },
  headerMinRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  headerMinDate: { fontFamily: fonts.label, fontSize: 11, letterSpacing: 0.4, color: c.text.muted, textTransform: 'uppercase', flexShrink: 1, marginRight: spacing[2] },
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

  // ── Login streak strip (przeniesiona ze sklepu pod kafel pupila) ────────────
  loginStrip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[3], paddingVertical: spacing[2], borderRadius: radius.md, borderWidth: 1, borderColor: '#FB923C3A', backgroundColor: '#FB923C12' },
  loginStripTxt: { fontSize: 12, fontWeight: '800', color: c.text.primary },
  loginStripNext: { fontSize: 11, fontWeight: '800', color: '#FB923C' },

  // ── Kafel pupila + kolumna serii, sklejone w jedną ramkę (2026-08-24) ───────
  petCombined: { flexDirection: 'row', alignItems: 'stretch', gap: 10, borderRadius: 18, borderWidth: 1, padding: 12 },
  petCombinedLeft: { flex: 1, minWidth: 0, flexDirection: 'row', alignItems: 'center' },

  // ── Budget warning card ───────────────────────────────────────────────────
  budgetWarnCard: {
    backgroundColor: c.bg.card,
    borderRadius: radius.xl,
    borderWidth: 1, borderColor: c.border.card,
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
    backgroundColor: c.text.primary,
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
  habitsTitle: { fontFamily: fonts.label, fontSize: 11, color: c.text.primary, textTransform: 'uppercase', letterSpacing: 0.9 },
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
  workAheadRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[2], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  workAheadText: { flex: 1, fontSize: 11.5, color: c.text.secondary, fontWeight: '600' },

  card: {
    backgroundColor: c.bg.card,
    borderRadius: radius.xl,
    padding: spacing[4],
    borderWidth: 1,
    borderColor: c.border.card,
    gap: spacing[3],
  },
  cardHeader: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flexWrap: 'wrap' },
  // „Pro" hierarchia: etykiety sekcji STONOWANE (secondary), a DANE/liczby jasne (primary).
  cardTitle: { fontFamily: fonts.label, fontSize: 11, color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.9, flexShrink: 1 },

  // ── Pusty stan karty Sen (bąbelek-ikona + wypełniony CTA, nie goły tekst) ──────────
  sleepEmptyIcon: { width: 44, height: 44, borderRadius: 22, alignItems: 'center', justifyContent: 'center' },
  sleepEmptyTitle: { fontSize: 14, fontWeight: '800', color: c.text.primary, marginTop: spacing[3] },
  sleepEmptyBtn: { flexDirection: 'row', alignItems: 'center', gap: 6, borderRadius: radius.full, paddingHorizontal: spacing[4], paddingVertical: 9, marginTop: spacing[3] },
  sleepEmptyBtnText: { fontSize: 12.5, fontWeight: '800' },
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
  pxYearRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
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
  wxSection: { fontSize: 11, fontWeight: '800', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginTop: spacing[5], marginBottom: spacing[2] },
  detailToggle: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  detailToggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  detailToggleTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.muted },
  wxForecast: { flexDirection: 'row', justifyContent: 'space-between' },
  wxDay: { alignItems: 'center', flex: 1 },
  wxDayLbl: { fontSize: 11, color: c.text.secondary, fontWeight: '700' },
  wxHi: { fontSize: 12.5, color: c.text.primary, fontWeight: '800' },
  wxLo: { fontSize: 11, color: c.text.muted, fontWeight: '600' },
  // ── Praca (pilot „clean": oddech + jeden akcent = WORK_ACCENT) ──
  wpBig: { fontSize: 44, fontWeight: '900', color: c.text.primary, letterSpacing: -1.4, marginTop: spacing[2] },
  wpUnit: { fontSize: 19, fontWeight: '700', color: c.text.muted },
  wpSub: { fontSize: 13, color: c.text.secondary, marginTop: 4, lineHeight: 18 },
  wpLeftCard: { flexDirection: 'row', alignItems: 'center', marginTop: spacing[5], backgroundColor: c.fill.subtle, borderRadius: radius.xl, paddingVertical: spacing[4], paddingHorizontal: spacing[2], borderWidth: 1, borderColor: c.border.subtle },
  wpLeftItem: { flex: 1, alignItems: 'center', gap: 5 },
  wpLeftVal: { fontSize: 24, fontWeight: '800', color: c.text.primary, letterSpacing: -0.5 },
  wpLeftUnit: { fontSize: 13, fontWeight: '700', color: c.text.muted },
  wpLeftLbl: { fontSize: 10.5, fontWeight: '600', color: c.text.muted, textAlign: 'center', textTransform: 'uppercase', letterSpacing: 0.4 },
  wpLeftDivider: { width: 1, height: 40, backgroundColor: c.border.default },
  wpAvgLine: { fontSize: 12.5, color: c.text.secondary, marginTop: spacing[4], lineHeight: 18 },
  wpAvgB: { fontWeight: '800', color: c.text.primary },
  // „Zaplanowane naprzód" — grafik przyszłych miesięcy
  wpAheadCard: { marginTop: spacing[4], backgroundColor: WORK_ACCENT + '12', borderRadius: radius.xl, padding: spacing[3], borderWidth: 1, borderColor: WORK_ACCENT + '3A' },
  wpAheadHead: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 6 },
  wpAheadTitle: { fontSize: 11.5, fontWeight: '800', color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.5 },
  wpAheadTotal: { marginLeft: 'auto', fontSize: 15, fontWeight: '900', color: WORK_ACCENT, letterSpacing: -0.3 },
  wpAheadRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 6, borderTopWidth: 1, borderTopColor: c.border.subtle },
  wpAheadMonth: { flex: 1, fontSize: 13.5, fontWeight: '700', color: c.text.primary },
  wpAheadDays: { fontSize: 11.5, fontWeight: '600', color: c.text.muted, marginRight: spacing[3] },
  wpAheadH: { fontSize: 13, fontWeight: '800', color: c.text.primary, fontVariant: ['tabular-nums'] },
  wpAheadHint: { fontSize: 10.5, color: c.text.muted, marginTop: 6, lineHeight: 14 },
  wpLive: { marginTop: spacing[2], padding: spacing[3], borderRadius: radius.xl, backgroundColor: '#2AC68F14', borderWidth: 1, borderColor: '#2AC68F44' },
  wpLiveTop: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 4 },
  wpLiveDot: { width: 7, height: 7, borderRadius: 4, backgroundColor: '#2AC68F' },
  wpLiveTag: { flex: 1, fontSize: 10.5, fontWeight: '800', color: '#2AC68F', letterSpacing: 0.5, textTransform: 'uppercase' },
  wpLiveBig: { fontFamily: fonts.display, fontSize: 34, color: c.text.primary, letterSpacing: -0.5 },
  wpLiveUnit: { fontSize: 15, fontWeight: '700', color: c.text.muted },
  wpLiveSub: { fontSize: 12, fontWeight: '700', color: c.text.secondary, marginTop: 2, fontVariant: ['tabular-nums'] },
  wpEmpty: { marginTop: spacing[2], padding: spacing[3], borderRadius: radius.lg, backgroundColor: c.fill.subtle, borderWidth: 1, borderColor: c.border.subtle },
  wpEmptyTitle: { fontSize: 13, fontWeight: '800', color: c.text.primary, marginBottom: 4 },
  wpEmptyBody: { fontSize: 11.5, color: c.text.secondary, lineHeight: 16 },
  wpRateCard: { marginTop: spacing[5], backgroundColor: c.fill.subtle, borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.default },
  wpRateVal: { fontSize: 30, fontWeight: '900', color: c.text.primary, letterSpacing: -0.6 },
  wpRateUnit: { fontSize: 16, fontWeight: '700', color: c.text.muted },
  wpRateHint: { fontSize: 11.5, color: c.text.muted, marginTop: 4 },
  wpTotalRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[4], paddingTop: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle },
  wpTotalLabel: { fontSize: 12, fontWeight: '600', color: c.text.muted },
  wpTotalVal: { fontSize: 18, fontWeight: '900', letterSpacing: -0.4 },
  wmRow: { flexDirection: 'row', alignItems: 'center', paddingVertical: 8, gap: 8 },
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
  finVal: { fontFamily: fonts.display, fontSize: 20, color: c.text.primary, letterSpacing: -0.4 },
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
  // "nastrój zapisany dziś" marker
  moodDoneChip: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2AC68F1E', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 3 },
  moodDoneTxt: { fontSize: 10.5, fontWeight: '800', color: '#2AC68F' },
  moodTodoChip: { marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4, borderRadius: radius.full, borderWidth: 1, borderColor: c.accent.blue + '55', paddingHorizontal: 8, paddingVertical: 3 },
  moodTodoTxt: { fontSize: 10.5, fontWeight: '800', color: c.accent.blue },
  // "Rok temu tego dnia"
  yearAgoRow: { flexDirection: 'row', gap: spacing[2], marginTop: 2 },
  yearAgoStat: { flex: 1, alignItems: 'center', gap: 2, backgroundColor: c.bg.elevated, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle, paddingVertical: spacing[3] },
  yearAgoVal: { fontSize: 17, fontWeight: '900', letterSpacing: -0.5 },
  yearAgoKey: { fontSize: 10, color: c.text.muted, fontWeight: '600' },
  // two-metric compare verdict
  cmpVerdict: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[2], borderWidth: 1, borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 7 },
  cmpVerdictTxt: { flex: 1, fontSize: 11.5, fontWeight: '700' },
  // "Jedzenie — rozkład"
  foodTotal: { marginLeft: 'auto', fontSize: 16, fontWeight: '900', color: c.text.primary },
  foodNowChip: { marginLeft: spacing[2], paddingHorizontal: spacing[2], paddingVertical: 2, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  foodNowTxt: { fontSize: 10, fontWeight: '700', color: c.text.muted },
  foodToggle: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  foodToggleBtn: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  foodToggleTxt: { fontSize: 12, fontWeight: '700', color: c.text.muted },
  foodBars: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[2], marginTop: spacing[3], height: 78 },
  foodBarCol: { flex: 1, alignItems: 'center', gap: 3, justifyContent: 'flex-end' },
  foodBarVal: { fontSize: 8.5, fontWeight: '700', color: c.text.secondary },
  foodBarTrack: { width: '64%', height: 50, backgroundColor: c.border.subtle, borderRadius: 3, justifyContent: 'flex-end', overflow: 'hidden' },
  foodBarLbl: { fontSize: 9, fontWeight: '600', color: c.text.muted },
  foodSubRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 4 },
  foodSubDot: { width: 9, height: 9, borderRadius: 5 },
  foodSubName: { width: 92, fontSize: 12, fontWeight: '600', color: c.text.secondary },
  foodSubTrack: { flex: 1, height: 7, borderRadius: 4, backgroundColor: c.border.subtle, overflow: 'hidden' },
  foodSubAmt: { width: 50, textAlign: 'right', fontSize: 12, fontWeight: '800', color: c.text.primary },
  foodItemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle },
  foodItemTap: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: 9 },
  foodItemName: { fontSize: 13, fontWeight: '500', color: c.text.primary },
  foodItemSub: { fontSize: 10, color: c.text.muted, marginTop: 1 },
  foodItemAmt: { fontSize: 12.5, fontWeight: '800', color: c.text.secondary, fontVariant: ['tabular-nums'] },
  notFoodBtn: { paddingVertical: 8, paddingLeft: spacing[2] },
  // "Kolekcja sklepów"
  shopTotal: { marginLeft: 'auto', fontFamily: fonts.display, fontSize: 16, color: c.text.primary },
  shopWrap: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  shopHint: { fontSize: 10.5, color: c.text.muted, marginTop: spacing[2] },
  shopChip: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: c.bg.elevated, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.subtle, paddingLeft: spacing[3], paddingRight: 4, paddingVertical: 3, maxWidth: '100%' },
  shopChipName: { fontSize: 12, fontWeight: '600', color: c.text.secondary, maxWidth: 120 },
  shopChipCount: { minWidth: 20, height: 20, borderRadius: 10, alignItems: 'center', justifyContent: 'center', paddingHorizontal: 5 },
  shopChipCountTxt: { fontSize: 11, fontWeight: '800' },
  // "List do przyszłego siebie"
  capsuleAddBtn: { marginLeft: 'auto', width: 28, height: 28, borderRadius: 9, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  capsuleOpen: { marginTop: spacing[2], borderWidth: 1, borderRadius: radius.lg, padding: spacing[3], gap: spacing[2], backgroundColor: c.bg.elevated },
  capsuleFrom: { fontSize: 10.5, color: c.text.muted, fontWeight: '700' },
  capsuleText: { fontSize: 14, color: c.text.primary, lineHeight: 20, fontStyle: 'italic' },
  capsuleReadBtn: { alignSelf: 'flex-start', borderRadius: radius.md, paddingHorizontal: spacing[3], paddingVertical: 7 },
  capsuleReadTxt: { fontSize: 12, fontWeight: '800', color: c.bg.primary },
  capsuleOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.55)', justifyContent: 'center' },
  capsuleInput: { marginTop: spacing[2], minHeight: 90, maxHeight: 180, backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], paddingVertical: spacing[2], fontSize: 14, color: c.text.primary, textAlignVertical: 'top' },
  capsuleChips: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[1] },
  capsuleChip: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  capsuleChipTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.muted },
  capsuleCancel: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default },
  capsuleCancelTxt: { fontSize: 14, fontWeight: '700', color: c.text.secondary },
  capsuleSeal: { flex: 1.5, alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: radius.lg },
  capsuleSealTxt: { fontSize: 14, fontWeight: '800', color: c.bg.primary },
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

});
