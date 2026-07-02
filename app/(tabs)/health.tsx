import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Pressable, KeyboardAvoidingView, Platform, RefreshControl } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Footprints, Moon, Droplets, Plus, Minus, Activity, Timer, RefreshCw, Heart, MapPin, Flame, Dumbbell, Wind, ChevronRight, X, Award } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodaySessions } from '@/utils/pomodoroHistory';

import ScreenHeader from '@/components/ui/ScreenHeader';
import { feedWaterHabit } from '@/utils/habits';
import PressableScale from '@/components/ui/PressableScale';
import GlassCard from '@/components/ui/GlassCard';
import { haptic } from '@/utils/haptics';
import { useMoodStore } from '@/store/moodStore';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { toast } from '@/store/toastStore';
import { MOOD_COLORS, Expense } from '@/types';
import { expensesService } from '@/services/expensesService';
import { foodKcalForDate, avgFoodKcal } from '@/utils/calories';
import { loadKcalMemory, KcalMemory } from '@/utils/productMemory';
import { getHealthGoals, saveHealthGoals } from '@/utils/healthGoals';
import { useColors } from '@/theme/useColors';
import { isHealthConnectAvailable, ensureHealthConnect, readHealthDay, readHealthRange, HealthDayPoint, openHealthConnect, probeHealthConnect } from '@/services/healthConnectService';
import { colors, spacing, radius, typography } from '@/theme';

// ─── Teal palette ─────────────────────────────────────────────────────────────

const T = {
  card:       '#0E0A18',
  cardBorder: 'rgba(139,92,246,0.18)',
  accent:     '#8B5CF6',
  accentDim:  'rgba(139,92,246,0.12)',
  muted:      'rgba(139,92,246,0.45)',
};

const WEEK_DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const GLASS_ML = 250; // one "szklanka" = 250 ml (for Health Connect hydration ⇄ glasses)

const DOW_LABELS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];
const DOW_FULL = ['poniedziałki', 'wtorki', 'środy', 'czwartki', 'piątki', 'soboty', 'niedziele'];
// Average a metric by weekday over a date series, returned Mon..Sun (ignores 0s).
function dowAverage<T extends { date: string }>(data: T[], sel: (p: T) => number): number[] {
  const sums = Array(7).fill(0), cnt = Array(7).fill(0);
  for (const p of data) {
    const v = sel(p);
    if (v > 0) { const d = new Date(p.date + 'T00:00:00').getDay(); sums[d] += v; cnt[d]++; }
  }
  return [1, 2, 3, 4, 5, 6, 0].map(d => (cnt[d] ? Math.round(sums[d] / cnt[d]) : 0));
}

type SleepQuality = 'poor' | 'fair' | 'good' | 'excellent';
const QUALITY_LABELS: Record<SleepQuality, string> = {
  poor: 'Słabo', fair: 'Ujdzie', good: 'Dobrze', excellent: 'Świetnie',
};
const QUALITY_COLORS: Record<SleepQuality, string> = {
  poor: colors.accent.red, fair: colors.accent.amber,
  good: colors.accent.green, excellent: colors.accent.purple,
};
const QUALITY_KEYS: SleepQuality[] = ['poor', 'fair', 'good', 'excellent'];

interface WeekSleep { h: number; m: number; quality?: SleepQuality }

function pad(n: number) { return String(n).padStart(2, '0'); }
function dateKey(d: Date) {
  return `health_${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}
function todayKey() { return dateKey(new Date()); }

// Sleep is read-only from the watch, so its "quality" is derived from duration
// rather than tapped in by hand.
function qualityFromMinutes(min: number): SleepQuality | undefined {
  if (min <= 0) return undefined;
  const h = min / 60;
  if (h < 5) return 'poor';
  if (h < 6.5) return 'fair';
  if (h < 7) return 'good';
  if (h <= 9) return 'excellent';
  return 'good'; // oversleeping
}
function ymd(d: Date) { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export default function HealthScreen() {
  const insets = useSafeAreaInsets();
  // Theme-reactive: shadow the module `colors`/`T` so the whole screen (incl. its
  // StyleSheet via makeStyles) flips with light/dark. Teal accent stays both ways.
  const colors = useColors();
  const T = useMemo(() => ({
    card: colors.bg.card,
    cardBorder: 'rgba(139,92,246,0.22)',
    accent: '#8B5CF6',
    accentDim: 'rgba(139,92,246,0.14)',
    muted: 'rgba(139,92,246,0.55)',
  }), [colors]);
  const styles = useMemo(() => makeStyles(colors, T), [colors, T]);
  const wm = useMemo(() => makeWm(colors, T), [colors, T]);

  const [stepGoal, setStepGoal]         = useState(10_000);
  const [waterGoal, setWaterGoal]       = useState(8);
  const [weightGoal, setWeightGoal]     = useState(0); // target weight kg, 0 = unset
  const [goalModal, setGoalModal]       = useState(false);
  const [goalInput, setGoalInput]       = useState('');
  const [water, setWater]               = useState(0);
  const [steps, setSteps]               = useState(0);
  const [sleepH, setSleepH]             = useState(0);
  const [sleepM, setSleepM]             = useState(0);
  const [sleepQuality, setSleepQuality] = useState<SleepQuality | undefined>(undefined);
  const [weight, setWeight]             = useState(0);
  const [lastWeight, setLastWeight]     = useState(0); // most recent logged weight (any day) — seed for nudging
  const [weightModal, setWeightModal]   = useState(false);
  const [weightInput, setWeightInput]   = useState('');
  const [loaded, setLoaded]             = useState(false);
  const [syncing, setSyncing]           = useState(false);
  const [hcExtra, setHcExtra]           = useState<Record<string, number | null>>({});
  const [weekSteps, setWeekSteps]       = useState<number[]>(Array(7).fill(0));
  const [weekSleep, setWeekSleep]       = useState<WeekSleep[]>(Array(7).fill({ h: 0, m: 0 }));
  const [weekWeight, setWeekWeight]     = useState<number[]>(Array(7).fill(0));
  const [weekBurn, setWeekBurn]         = useState<number[]>(Array(7).fill(0)); // kcal burned per day (from cache)
  const [weekFat, setWeekFat]           = useState<number[]>(Array(7).fill(0)); // body fat % per day (from cache)
  const [weekWater, setWeekWater]       = useState<number[]>(Array(7).fill(0));
  const [monthData, setMonthData]       = useState<HealthDayPoint[]>([]); // 30-day from watch
  const [fromWatch, setFromWatch]       = useState(false);                // HC delivered data

  const { entries } = useMoodStore();
  const pomodoroIsRunning = usePomodoroStore(s => s.isRunning);
  const [todayPomCount, setTodayPomCount] = useState(0);
  const recentMood = entries.slice(0, 7).reverse();

  useFocusEffect(useCallback(() => {
    getTodaySessions().then(s => setTodayPomCount(s.length)).catch(() => {});
  }, []));

  // Derive the Mon–Sun week charts from a 30-day watch range and pull today's
  // headline numbers. Steps/sleep are read-only from the watch; weight only
  // fills when empty so a manual override is never clobbered.
  const applyHealthRange = useCallback((range: HealthDayPoint[]) => {
    if (!range.length) return;
    setMonthData(range);
    setFromWatch(true);
    const byDate = new Map(range.map(p => [p.date, p]));
    const today = new Date();
    const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
    const monday = new Date(today); monday.setDate(today.getDate() - todayIdx);
    const wSteps = Array(7).fill(0);
    const wSleep: WeekSleep[] = Array(7).fill(null).map(() => ({ h: 0, m: 0 }));
    for (let i = 0; i < 7; i++) {
      const d = new Date(monday); d.setDate(monday.getDate() + i);
      const p = byDate.get(ymd(d));
      if (p) {
        wSteps[i] = p.steps;
        wSleep[i] = { h: Math.floor(p.sleepMinutes / 60), m: p.sleepMinutes % 60, quality: qualityFromMinutes(p.sleepMinutes) };
      }
    }
    setWeekSteps(wSteps);
    setWeekSleep(wSleep);
    const todayPt = byDate.get(ymd(today));
    if (todayPt) {
      if (todayPt.steps > 0) setSteps(todayPt.steps);
      if (todayPt.sleepMinutes > 0) { setSleepH(Math.floor(todayPt.sleepMinutes / 60)); setSleepM(todayPt.sleepMinutes % 60); setSleepQuality(qualityFromMinutes(todayPt.sleepMinutes)); }
      if (todayPt.weightKg != null) setWeight(w => w || todayPt.weightKg!);
    }
  }, []);

  // Auto-pull from the watch on focus — silent (no permission prompt; that's the
  // Synchronizuj button's job). Does nothing gracefully when HC is unavailable.
  useFocusEffect(useCallback(() => {
    let active = true;
    (async () => {
      if (Platform.OS !== 'android' || !isHealthConnectAvailable()) return;
      try {
        const [day, range] = await Promise.all([readHealthDay(new Date()), readHealthRange(30)]);
        if (!active) return;
        if (range && range.some(p => p.steps > 0 || p.sleepMinutes > 0)) applyHealthRange(range);
        if (day) {
          if (day.steps > 0) setSteps(day.steps);
          if (day.sleepMinutes > 0) { setSleepH(Math.floor(day.sleepMinutes / 60)); setSleepM(day.sleepMinutes % 60); setSleepQuality(qualityFromMinutes(day.sleepMinutes)); }
          if (day.weightKg != null) setWeight(w => w || day.weightKg!);
          if (day.hydrationMl != null && day.hydrationMl > 0) {
            const ds = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;
            feedWaterHabit(Math.round(day.hydrationMl / GLASS_ML), ds).catch(() => {});
          }
          setHcExtra(prev => ({
            ...prev, // keep manually-entered body composition the watch doesn't report
            heartRateAvg: day.heartRateAvg, restingHeartRate: day.restingHeartRate, distanceKm: day.distanceKm,
            activeCalories: day.activeCalories, totalCalories: day.totalCalories, exerciseMinutes: day.exerciseMinutes,
            oxygenPct: day.oxygenPct, vo2max: day.vo2max,
            floors: day.floors, hrv: day.hrv, respiratoryRate: day.respiratoryRate,
            bodyFatPct: day.bodyFatPct ?? prev.bodyFatPct, bmr: day.bmr ?? prev.bmr,
            leanMassKg: day.leanMassKg ?? prev.leanMassKg, bodyWaterKg: day.bodyWaterKg ?? prev.bodyWaterKg,
            sleepDeepMin: day.sleepDeepMin, sleepRemMin: day.sleepRemMin, sleepLightMin: day.sleepLightMin,
            hydrationMl: day.hydrationMl,
          }));
          setFromWatch(true);
        }
      } catch {}
    })();
    return () => { active = false; };
  }, [applyHealthRange]));

  const maxBar = Math.max(...weekSteps, 1);
  const stepPct = Math.min(1, steps / stepGoal);
  const sleepSecs = sleepH * 3600 + sleepM * 60;
  const sleepPct = Math.min(1, sleepSecs / (9 * 3600));
  const maxSleep = Math.max(...weekSleep.map(s => s.h + s.m / 60), 1);
  const loggedWeights = weekWeight.filter(w => w > 0);
  const minW = loggedWeights.length ? Math.min(...loggedWeights) : 0;
  const maxW = loggedWeights.length ? Math.max(...loggedWeights) : 1;
  const weightRange = maxW - minW || 1;

  // ── Deeper analysis over the 30-day watch range ─────────────────────────────
  const healthStats = useMemo(() => {
    const md = monthData;
    if (md.length === 0) return null;
    const avg = (arr: number[]) => (arr.length ? Math.round(arr.reduce((a, b) => a + b, 0) / arr.length) : 0);
    const stepDays = md.filter(p => p.steps > 0);
    const last7  = md.slice(-7);
    const prev7  = md.slice(-14, -7);
    const avgSteps7    = avg(last7.filter(p => p.steps > 0).map(p => p.steps));
    const avgStepsPrev = avg(prev7.filter(p => p.steps > 0).map(p => p.steps));
    const avgSteps30   = avg(stepDays.map(p => p.steps));
    const avgSleep7    = avg(last7.filter(p => p.sleepMinutes > 0).map(p => p.sleepMinutes));
    const avgSleep30   = avg(md.filter(p => p.sleepMinutes > 0).map(p => p.sleepMinutes));
    const goalHit = stepDays.length ? Math.round(stepDays.filter(p => p.steps >= stepGoal).length / stepDays.length * 100) : 0;
    const best = md.reduce((m, p) => (p.steps > m.steps ? p : m), md[0]);
    const trendPct = avgStepsPrev ? Math.round((avgSteps7 - avgStepsPrev) / avgStepsPrev * 100) : 0;
    const maxMonth = Math.max(...md.map(p => p.steps), 1);
    // Sleep, the deeper view: nights against the personal 30-day average + extremes.
    const sleepNights = md.filter(p => p.sleepMinutes > 0);
    const sleepBest  = sleepNights.reduce((m, p) => (p.sleepMinutes > m.sleepMinutes ? p : m), sleepNights[0] ?? md[0]);
    const sleepWorst = sleepNights.reduce((m, p) => (p.sleepMinutes < m.sleepMinutes ? p : m), sleepNights[0] ?? md[0]);
    const sleepConsistency = (() => {
      if (sleepNights.length < 3) return 0;
      const mean = avgSleep30;
      const variance = sleepNights.reduce((s, p) => s + (p.sleepMinutes - mean) ** 2, 0) / sleepNights.length;
      return Math.round(Math.sqrt(variance)); // stddev in minutes
    })();
    return { avgSteps7, avgSteps30, avgSleep7, avgSleep30, goalHit, best, trendPct, maxMonth, sleepBest, sleepWorst, sleepConsistency };
  }, [monthData, stepGoal]);

  const [stepsRange, setStepsRange] = useState<7 | 30>(30);
  const [detail, setDetail] = useState<null | 'steps' | 'sleep' | 'body'>(null);
  const [energyOpen, setEnergyOpen] = useState(false); // calorie card is collapsed by default (de-emphasised)
  const [bodyEdit, setBodyEdit] = useState(false); // manual body-composition entry open in the body sheet
  // Manually set a body-composition field; '' / invalid clears it. Persisted via the
  // today-cache save effect, and preserved across watch syncs (sync uses ?? prev).
  const setBodyField = (key: string, raw: string) => {
    const v = parseFloat(raw.replace(',', '.'));
    setHcExtra(prev => ({ ...prev, [key]: !raw.trim() || isNaN(v) || v <= 0 ? null : v }));
  };
  const [expenses, setExpenses] = useState<Expense[]>([]); // for the energy-balance estimate
  const [kcalMem, setKcalMem] = useState<KcalMemory>({});
  useFocusEffect(useCallback(() => {
    expensesService.getAll().then(setExpenses).catch(() => {});
    loadKcalMemory().then(setKcalMem).catch(() => {});
  }, []));

  // ── Energy balance (estimate) ───────────────────────────────────────────────
  // OUT = the watch's burn (total, or BMR + active). IN = estimated food energy
  // bought (from receipts) — a 7-day average smooths the buy≠eat noise.
  const energy = useMemo(() => {
    const bmr = (hcExtra.bmr as number) || 0;
    const active = (hcExtra.activeCalories as number) || 0;
    const totalC = (hcExtra.totalCalories as number) || 0;
    // A full-day burn is ~1500–3500 kcal. Samsung Health often shares only the
    // EXERCISE calories (a few hundred) as "total" — using that as the whole day's
    // burn produces a nonsense balance, so only trust totalC when it's plausible.
    const burned = totalC >= 1200 ? totalC : (bmr > 0 ? bmr + active : 0);
    const intakeAvg = avgFoodKcal(expenses, 7, kcalMem);
    // This week's weight change (first → last logged) to sanity-check the balance.
    let first = 0, last = 0;
    for (const w of weekWeight) { if (w > 0) { if (first === 0) first = w; last = w; } }
    const weightDelta = (first > 0 && last > 0 && first !== last) ? +(last - first).toFixed(1) : null;
    // 7-day burn (cache) vs estimated food intake per day.
    const td = new Date();
    const tIdx = td.getDay() === 0 ? 6 : td.getDay() - 1;
    const week = weekBurn.map((burn, i) => {
      const d = new Date(td.getFullYear(), td.getMonth(), td.getDate() - (tIdx - i));
      const ds = `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
      const intake = i <= tIdx ? foodKcalForDate(expenses, ds, kcalMem) : 0;
      return { burn, intake, balance: burn - intake };
    });
    // TDEE ≈ average daily burn over logged days → maintenance + a cut target.
    const burnDays = weekBurn.filter(b => b > 0);
    const avgBurn = burnDays.length ? Math.round(burnDays.reduce((a, b) => a + b, 0) / burnDays.length) : burned;
    const maintain = avgBurn;
    const cut = maintain > 1200 ? maintain - 500 : 0; // ~0.5 kg/tydz. deficyt
    return { burned, intakeAvg, balance: burned - intakeAvg, weightDelta, week, maintain, cut };
  }, [hcExtra, expenses, weekWeight, weekBurn, kcalMem]);

  useEffect(() => {
    const load = async () => {
      try {
        const goals = await getHealthGoals();
        setStepGoal(goals.stepGoal);
        setWaterGoal(goals.waterGoal);
        setWeightGoal(goals.weightGoal);

        const raw = await AsyncStorage.getItem(todayKey());
        if (raw) {
          const d = JSON.parse(raw);
          if (d.water != null)        setWater(d.water);
          if (d.steps != null)        setSteps(d.steps);
          if (d.sleepH != null)       setSleepH(d.sleepH);
          if (d.sleepM != null)       setSleepM(d.sleepM);
          if (d.sleepQuality != null) setSleepQuality(d.sleepQuality);
          if (d.weight != null)       setWeight(d.weight);
          if (d.hc) setHcExtra(d.hc);
        }

        const today = new Date();
        const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
        const wSteps  = Array(7).fill(0);
        const wWeight = Array(7).fill(0);
        const wWater  = Array(7).fill(0);
        const wBurn   = Array(7).fill(0);
        const wFat    = Array(7).fill(0);
        const wSleep: WeekSleep[] = Array(7).fill(null).map(() => ({ h: 0, m: 0 }));

        for (let i = 0; i <= todayIdx; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - (todayIdx - i));
          const dayRaw = await AsyncStorage.getItem(dateKey(d));
          if (dayRaw) {
            const parsed = JSON.parse(dayRaw);
            if (parsed.steps != null)  wSteps[i] = parsed.steps;
            if (parsed.weight != null) wWeight[i] = parsed.weight;
            if (parsed.water != null)  wWater[i]  = parsed.water;
            if (parsed.hc) {
              const hc = parsed.hc;
              wBurn[i] = (hc.totalCalories > 0 ? hc.totalCalories : ((hc.bmr || 0) + (hc.activeCalories || 0)));
              if (hc.bodyFatPct > 0) wFat[i] = hc.bodyFatPct;
            }
            wSleep[i] = {
              h: parsed.sleepH ?? 0,
              m: parsed.sleepM ?? 0,
              quality: parsed.sleepQuality,
            };
          }
        }
        setWeekSteps(wSteps);
        setWeekSleep(wSleep);
        setWeekWeight(wWeight);
        setWeekWater(wWater);
        setWeekBurn(wBurn);
        setWeekFat(wFat);

        // Most recent logged weight (survives gaps >7 days) — seed for nudging.
        const storedLast = await AsyncStorage.getItem('health_last_weight');
        let last = storedLast ? parseFloat(storedLast) : 0;
        if (!(last > 0)) { for (let i = wWeight.length - 1; i >= 0; i--) if (wWeight[i] > 0) { last = wWeight[i]; break; } }
        if (last > 0) setLastWeight(last);
      } catch {}
      setLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(todayKey(), JSON.stringify({ water, steps, sleepH, sleepM, sleepQuality, weight, hc: hcExtra })).catch(() => {});
    if (weight > 0) AsyncStorage.setItem('health_last_weight', String(weight)).catch(() => {});
    const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    setWeekSteps(prev => { const n = [...prev]; n[todayIdx] = steps; return n; });
    setWeekWeight(prev => { const n = [...prev]; n[todayIdx] = weight; return n; });
    setWeekWater(prev => { const n = [...prev]; n[todayIdx] = water; return n; });
    setWeekSleep(prev => {
      const n = [...prev];
      n[todayIdx] = { h: sleepH, m: sleepM, quality: sleepQuality };
      return n;
    });
  }, [water, steps, sleepH, sleepM, sleepQuality, weight, hcExtra, loaded]);

  const updateWater = (v: number) => {
    const next = Math.max(0, Math.min(waterGoal, v));
    setWater(next);
    if (next === waterGoal) { haptic.success(); toast.success('Cel nawodnienia osiągnięty!'); }
    else haptic.tap();
  };

  // Nudge weight. When today isn't logged yet, start from the last known weight
  // (you don't weigh daily) instead of from 0.
  const bumpWeight = (delta: number) => {
    haptic.tap();
    setWeight(w => { const base = w > 0 ? w : lastWeight; return Math.max(0, +(base + delta).toFixed(1)); });
  };


  const syncHealthConnect = async () => {
    if (Platform.OS !== 'android') { toast.info('Health Connect tylko na Androidzie'); return; }
    if (!isHealthConnectAvailable()) { toast.error('Niedostępne w tej wersji — zbuduj nowy APK'); return; }
    setSyncing(true);
    try {
      const res = await ensureHealthConnect();
      if (!res.ok) {
        haptic.error();
        if (res.reason === 'denied') {
          // Open Health Connect so the user grants "Sapp" access by hand, then
          // comes back and taps Synchronizuj again (no crashy in-app request).
          toast.info('Włącz dostęp dla „Sapp", potem wróć i kliknij Synchronizuj');
          await openHealthConnect();
          return;
        }
        const msg = res.reason === 'unavailable' ? 'Health Connect niedostępny na tym telefonie'
          : res.reason === 'update' ? 'Zaktualizuj Health Connect w sklepie'
          : res.reason === 'no-module' ? 'Niedostępne w tej wersji — zbuduj nowy APK'
          : 'Nie udało się połączyć z Health Connect';
        toast.error(msg);
        return;
      }
      const [d, range] = await Promise.all([readHealthDay(new Date()), readHealthRange(30)]);
      if (range && range.some(p => p.steps > 0 || p.sleepMinutes > 0)) applyHealthRange(range);
      if (d) {
        if (d.steps > 0) setSteps(d.steps);
        if (d.sleepMinutes > 0) { setSleepH(Math.floor(d.sleepMinutes / 60)); setSleepM(d.sleepMinutes % 60); setSleepQuality(qualityFromMinutes(d.sleepMinutes)); }
        if (d.weightKg != null) setWeight(d.weightKg); // manual sync: take the watch's weight
        if (d.hydrationMl != null && d.hydrationMl > 0) {
          const ds = `${new Date().getFullYear()}-${pad(new Date().getMonth() + 1)}-${pad(new Date().getDate())}`;
          feedWaterHabit(Math.round(d.hydrationMl / GLASS_ML), ds).catch(() => {});
        }
        setHcExtra(prev => ({
          ...prev, // keep manually-entered body composition the watch doesn't report
          heartRateAvg: d.heartRateAvg, restingHeartRate: d.restingHeartRate, distanceKm: d.distanceKm,
          activeCalories: d.activeCalories, totalCalories: d.totalCalories, exerciseMinutes: d.exerciseMinutes,
          oxygenPct: d.oxygenPct, vo2max: d.vo2max,
          floors: d.floors, hrv: d.hrv, respiratoryRate: d.respiratoryRate,
          bodyFatPct: d.bodyFatPct ?? prev.bodyFatPct, bmr: d.bmr ?? prev.bmr,
          leanMassKg: d.leanMassKg ?? prev.leanMassKg, bodyWaterKg: d.bodyWaterKg ?? prev.bodyWaterKg,
          sleepDeepMin: d.sleepDeepMin, sleepRemMin: d.sleepRemMin, sleepLightMin: d.sleepLightMin,
          hydrationMl: d.hydrationMl,
        }));
        setFromWatch(true);
        haptic.success();
        toast.success('Zsynchronizowano z zegarka');
      } else {
        toast.info('Brak danych w Health Connect');
      }
    } catch { haptic.error(); toast.error('Błąd synchronizacji'); }
    finally { setSyncing(false); }
  };

  return (
    <SafeAreaView style={[styles.container, { paddingTop: insets.top + 50 }]} edges={[]}>
      <ScreenHeader title="Zdrowie" subtitle="Dzisiaj" style={{ borderBottomColor: T.cardBorder }}
        rightSlot={
          <PressableScale onPress={syncHealthConnect} onLongPress={async () => { const s = await probeHealthConnect(); toast.info(`Health Connect: ${s}`); }} disabled={syncing}
            style={[styles.syncIconBtn, { borderColor: T.accent + '55', opacity: syncing ? 0.5 : 1 }]}>
            <RefreshCw size={17} color={T.accent} />
          </PressableScale>
        }
      />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}
        refreshControl={<RefreshControl refreshing={syncing} onRefresh={syncHealthConnect} tintColor={T.accent} colors={[T.accent]} />}>

        <PressableScale onPress={async () => { const ok = await openHealthConnect(); if (!ok) toast.error('Nie można otworzyć Health Connect'); }}>
          <Text style={styles.syncFallback}>Pociągnij w dół, by zsynchronizować z zegarka · nie działa? Otwórz Health Connect</Text>
        </PressableScale>

        {/* Today at a glance */}
        <View style={styles.summaryRow}>
          <View style={styles.summaryTile}>
            <Footprints size={15} color={T.accent} />
            <Text style={styles.summaryVal}>{steps >= 1000 ? `${(steps / 1000).toFixed(1)}k` : steps}</Text>
            <Text style={styles.summaryLabel}>kroki</Text>
          </View>
          <View style={styles.summaryTile}>
            <Moon size={15} color="#A78BFA" />
            <Text style={styles.summaryVal}>{sleepH === 0 && sleepM === 0 ? '—' : `${sleepH}:${pad(sleepM)}`}</Text>
            <Text style={styles.summaryLabel}>sen</Text>
          </View>
          <View style={styles.summaryTile}>
            <Heart size={15} color="#FF6B6B" />
            <Text style={styles.summaryVal}>{(hcExtra.heartRateAvg as number) > 0 ? hcExtra.heartRateAvg : '—'}</Text>
            <Text style={styles.summaryLabel}>tętno</Text>
          </View>
          <View style={styles.summaryTile}>
            <Flame size={15} color="#FB923C" />
            <Text style={styles.summaryVal}>{(hcExtra.activeCalories as number) > 0 ? hcExtra.activeCalories : '—'}</Text>
            <Text style={styles.summaryLabel}>kcal</Text>
          </View>
          <View style={styles.summaryTile}>
            <Activity size={15} color="#34D399" />
            <Text style={styles.summaryVal}>{(weight > 0 ? weight : lastWeight) > 0 ? (weight > 0 ? weight : lastWeight).toFixed(1) : '—'}</Text>
            <Text style={styles.summaryLabel}>waga</Text>
          </View>
        </View>

        {/* Steps hero */}
        <GlassCard padding={spacing[4]} style={styles.tealCard}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { haptic.tap(); setDetail('steps'); }}>
            <View style={styles.cardRow}>
              <Footprints size={13} color={colors.text.muted} />
              <Text style={styles.cardLabel}>KROKI DZISIAJ</Text>
              <View style={{ flex: 1 }} />
              {fromWatch && (
                <View style={styles.watchChip}>
                  <Activity size={9} color={T.accent} />
                  <Text style={styles.watchChipText}>z zegarka</Text>
                </View>
              )}
              <ChevronRight size={15} color={colors.text.muted} style={{ marginLeft: 4 }} />
            </View>
            <Text style={[styles.heroNum, {
              color: steps >= stepGoal ? T.accent : colors.text.primary,
            }]}>
              {steps.toLocaleString()}
            </Text>
            <Text style={styles.heroSub}>
              cel {stepGoal.toLocaleString()} · {(steps * 0.00075).toFixed(1)} km · {Math.round(stepPct * 100)}% · szczegóły
            </Text>
            <View style={styles.progressTrack}>
              <View style={[styles.progressFill, {
                width: `${stepPct * 100}%`,
                backgroundColor: steps >= stepGoal ? T.accent : T.muted,
              }]} />
            </View>
          </TouchableOpacity>
        </GlassCard>

        {/* Sleep card */}
        <GlassCard padding={spacing[4]} style={styles.tealCard}>
          <TouchableOpacity activeOpacity={0.7} onPress={() => { haptic.tap(); setDetail('sleep'); }}>
            <View style={styles.cardRow}>
              <Moon size={13} color={colors.text.muted} />
              <Text style={styles.cardLabel}>SEN</Text>
              {sleepQuality && (
                <View style={[styles.qualityBadge, { backgroundColor: QUALITY_COLORS[sleepQuality] + '22', borderColor: QUALITY_COLORS[sleepQuality] + '50' }]}>
                  <Text style={[styles.qualityBadgeText, { color: QUALITY_COLORS[sleepQuality] }]}>
                    {QUALITY_LABELS[sleepQuality]}
                  </Text>
                </View>
              )}
              <View style={{ flex: 1 }} />
              <ChevronRight size={15} color={colors.text.muted} />
            </View>

            {/* Duration — from the watch, or entered by hand in the detail sheet */}
            <View style={styles.sleepDurRow}>
              <View style={[styles.sleepDurCenter, { flex: 1 }]}>
                {sleepH === 0 && sleepM === 0 ? (
                  <>
                    <Text style={[styles.sleepDurNum, { color: colors.text.muted }]}>—</Text>
                    <Text style={styles.sleepDurSub}>brak danych · dotknij, by wpisać</Text>
                  </>
                ) : (
                  <>
                    <Text style={styles.sleepDurNum}>
                      {sleepH}<Text style={styles.sleepDurUnit}>h </Text>
                      {pad(sleepM)}<Text style={styles.sleepDurUnit}>m</Text>
                    </Text>
                    <Text style={styles.sleepDurSub}>
                      {sleepH < 6 ? 'za mało' : sleepH >= 7 && sleepH <= 9 ? 'optymalny' : sleepH > 9 ? 'dużo' : 'minimalny'} · szczegóły
                    </Text>
                  </>
                )}
              </View>
            </View>
          </TouchableOpacity>

          {!(sleepH === 0 && sleepM === 0) && (
            <View style={styles.microBar}>
              <View style={[styles.microFill, {
                width: `${sleepPct * 100}%`,
                backgroundColor: sleepQuality ? QUALITY_COLORS[sleepQuality] : colors.text.secondary,
              }]} />
            </View>
          )}

          {/* Sleep stages (deep / REM / light) — when the watch reports them */}
          {(() => {
            const deep = (hcExtra.sleepDeepMin as number) || 0;
            const rem = (hcExtra.sleepRemMin as number) || 0;
            const light = (hcExtra.sleepLightMin as number) || 0;
            const tot = deep + rem + light;
            if (tot <= 0) return null;
            const seg = (m: number) => `${Math.round((m / tot) * 100)}%` as any;
            return (
              <View style={{ marginTop: spacing[3], gap: 6 }}>
                <View style={styles.stageBar}>
                  <View style={{ width: seg(deep), backgroundColor: '#6366F1' }} />
                  <View style={{ width: seg(rem), backgroundColor: '#A78BFA' }} />
                  <View style={{ width: seg(light), backgroundColor: '#5EC8D8' }} />
                </View>
                <View style={styles.stageLegend}>
                  <View style={styles.stageItem}><View style={[styles.stageDot, { backgroundColor: '#6366F1' }]} /><Text style={styles.stageText}>Głęboki {Math.round(deep)}m</Text></View>
                  <View style={styles.stageItem}><View style={[styles.stageDot, { backgroundColor: '#A78BFA' }]} /><Text style={styles.stageText}>REM {Math.round(rem)}m</Text></View>
                  <View style={styles.stageItem}><View style={[styles.stageDot, { backgroundColor: '#5EC8D8' }]} /><Text style={styles.stageText}>Lekki {Math.round(light)}m</Text></View>
                </View>
              </View>
            );
          })()}

          {/* 7-day sleep chart */}
          <View style={[styles.cardRow, { marginTop: spacing[3] }]}>
            <Text style={[styles.cardLabel, { color: colors.text.muted }]}>TYDZIEŃ</Text>
          </View>
          <View style={styles.sleepChartRow}>
            {weekSleep.map((s, i) => {
              const totalH = s.h + s.m / 60;
              const barH = totalH > 0 ? Math.max(6, (totalH / maxSleep) * 56) : 3;
              const isToday = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
              const barColor = s.quality ? QUALITY_COLORS[s.quality] : (totalH > 0 ? colors.text.secondary : colors.fill.strong);
              return (
                <View key={i} style={styles.sleepChartCol}>
                  <View style={styles.sleepBarWrap}>
                    <View style={[styles.sleepBar, {
                      height: barH,
                      backgroundColor: barColor,
                      opacity: totalH === 0 ? 0.3 : 1,
                      width: isToday ? 12 : 8,
                    }]} />
                  </View>
                  <Text style={[styles.chartDay, isToday && styles.chartDayToday]}>{WEEK_DAYS[i]}</Text>
                  {totalH > 0 && (
                    <Text style={styles.sleepBarLabel}>{totalH.toFixed(1)}</Text>
                  )}
                </View>
              );
            })}
          </View>

          {/* Sleep vs your other nights (30-day) */}
          {healthStats && healthStats.avgSleep30 > 0 && (() => {
            const avgH = healthStats.avgSleep30 / 60;
            const tIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
            const todayH = (weekSleep[tIdx]?.h ?? 0) + (weekSleep[tIdx]?.m ?? 0) / 60;
            const diff = todayH > 0 ? +(todayH - avgH).toFixed(1) : null;
            return (
              <View style={styles.sleepInsight}>
                <Text style={styles.sleepInsightMain}>
                  Śr. {avgH.toFixed(1).replace('.0', '')} h/noc · 30 dni
                  {diff != null && <Text style={{ color: diff >= 0 ? T.accent : colors.accent.red, fontWeight: '800' }}>{`   dziś ${diff >= 0 ? '+' : ''}${diff} h vs średnia`}</Text>}
                </Text>
                <Text style={styles.sleepInsightSub}>
                  Najlepiej {(healthStats.sleepBest.sleepMinutes / 60).toFixed(1)} h · najgorzej {(healthStats.sleepWorst.sleepMinutes / 60).toFixed(1)} h · wahania ±{healthStats.sleepConsistency} min
                </Text>
              </View>
            );
          })()}
        </GlassCard>

        {/* From the watch — grouped by theme (only metrics with data) */}
        {([
          { title: 'SERCE I REGENERACJA', Icon: Heart, keys: [
            { k: 'heartRateAvg',     Icon: Heart,    label: 'Tętno śr.', unit: 'bpm',  color: '#FF6B6B' },
            { k: 'restingHeartRate', Icon: Heart,    label: 'Spocz.',    unit: 'bpm',  color: '#FF8FA3' },
            { k: 'hrv',              Icon: Activity,  label: 'HRV',       unit: 'ms',   color: '#F472B6' },
            { k: 'oxygenPct',        Icon: Wind,     label: 'SpO₂',      unit: '%',    color: '#60A5FA' },
            { k: 'respiratoryRate',  Icon: Wind,     label: 'Oddech',    unit: '/min', color: '#22D3EE' },
            { k: 'vo2max',           Icon: Activity,  label: 'VO₂max',    unit: '',     color: '#A78BFA' },
          ] },
          { title: 'AKTYWNOŚĆ', Icon: Activity, keys: [
            { k: 'distanceKm',      Icon: MapPin,   label: 'Dystans', unit: 'km',   color: '#46B0DE' },
            { k: 'floors',          Icon: Activity, label: 'Piętra',  unit: '',     color: '#34D399' },
            { k: 'exerciseMinutes', Icon: Dumbbell, label: 'Trening', unit: 'min',  color: T.accent },
            { k: 'activeCalories',  Icon: Flame,    label: 'Kalorie akt.', unit: 'kcal', color: '#FB923C' },
            { k: 'totalCalories',   Icon: Flame,    label: 'Kalorie', unit: 'kcal', color: '#F87171' },
          ] },
        ] as const).map(group => {
          const items = group.keys.filter(c => { const v = hcExtra[c.k]; return v != null && v !== 0; });
          if (items.length === 0) return null;
          return (
            <GlassCard key={group.title} padding={spacing[4]}>
              <View style={styles.cardRow}><group.Icon size={13} color={colors.text.muted} /><Text style={styles.cardLabel}>{group.title}</Text></View>
              <View style={styles.hcGrid}>
                {items.map(c => (
                  <View key={c.k} style={styles.hcTile}>
                    <c.Icon size={15} color={c.color} />
                    <Text style={styles.hcVal}>{hcExtra[c.k]}{c.unit ? <Text style={styles.hcUnit}> {c.unit}</Text> : null}</Text>
                    <Text style={styles.hcLabel}>{c.label}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          );
        })}

        {/* 30-day steps + analysis (from the watch) */}
        {healthStats && monthData.length > 0 && (
          <GlassCard padding={spacing[4]} style={styles.tealCard}>
            <View style={styles.cardRow}>
              <Activity size={13} color={colors.text.muted} />
              <Text style={styles.cardLabel}>KROKI</Text>
              <View style={{ flex: 1 }} />
              <View style={styles.rangeToggle}>
                {([7, 30] as const).map(r => (
                  <TouchableOpacity key={r} onPress={() => { haptic.tap(); setStepsRange(r); }} style={[styles.rangeBtn, stepsRange === r && styles.rangeBtnOn]}>
                    <Text style={[styles.rangeBtnText, stepsRange === r && styles.rangeBtnTextOn]}>{r === 7 ? 'Tydzień' : 'Miesiąc'}</Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>
            {(() => {
              const data = stepsRange === 7 ? monthData.slice(-7) : monthData;
              const maxC = Math.max(...data.map(p => p.steps), 1);
              const avgWin = stepsRange === 7 ? healthStats.avgSteps7 : healthStats.avgSteps30;
              const DOW = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb'];
              return (
                <>
                  <View style={styles.monthChartRow}>
                    {data.map((p, i) => {
                      const h = p.steps > 0 ? Math.max(3, (p.steps / maxC) * 60) : 2;
                      const goalMet = p.steps >= stepGoal;
                      const isLast = i === data.length - 1;
                      return (
                        <View key={p.date} style={styles.stepCol}>
                          {stepsRange === 7 && (
                            <Text style={[styles.stepValLabel, p.steps === 0 && { opacity: 0 }, goalMet && { color: T.accent, fontWeight: '800' }]}>
                              {p.steps >= 1000 ? `${(p.steps / 1000).toFixed(1)}k` : p.steps}
                            </Text>
                          )}
                          <View style={styles.stepBarWrap}>
                            <View style={{
                              width: stepsRange === 7 ? '72%' : '100%',
                              height: h, borderRadius: 2, minHeight: 2,
                              backgroundColor: p.steps === 0 ? colors.border.subtle : goalMet ? T.accent : T.muted,
                              opacity: p.steps === 0 ? 0.5 : (isLast ? 1 : 0.85),
                            }} />
                          </View>
                          {stepsRange === 7 && (
                            <Text style={styles.weekDayLabel}>{DOW[new Date(p.date + 'T00:00:00').getDay()]}</Text>
                          )}
                        </View>
                      );
                    })}
                  </View>
                  <View style={styles.analysisGrid}>
                    <View style={styles.analysisTile}>
                      <Text style={styles.analysisVal}>{avgWin.toLocaleString()}</Text>
                      <Text style={styles.analysisLabel}>śr. kroki · {stepsRange} dni</Text>
                    </View>
                    <View style={styles.analysisTile}>
                      <Text style={styles.analysisVal}>{healthStats.goalHit}%</Text>
                      <Text style={styles.analysisLabel}>dni z celem (30d)</Text>
                    </View>
                    <View style={styles.analysisTile}>
                      <Text style={styles.analysisVal}>{(avgWin * 0.00075).toFixed(1)} km</Text>
                      <Text style={styles.analysisLabel}>śr. dystans · {stepsRange} dni</Text>
                    </View>
                    <View style={styles.analysisTile}>
                      <Text style={[styles.analysisVal, { color: healthStats.trendPct > 0 ? T.accent : healthStats.trendPct < 0 ? colors.accent.red : colors.text.primary }]}>
                        {healthStats.trendPct > 0 ? '+' : ''}{healthStats.trendPct}%
                      </Text>
                      <Text style={styles.analysisLabel}>vs poprz. tydzień</Text>
                    </View>
                  </View>
                  {healthStats.best.steps > 0 && (
                    <Text style={styles.analysisNote}>
                      Rekord 30 dni: {healthStats.best.steps.toLocaleString()} kroków · {new Date(healthStats.best.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}
                    </Text>
                  )}
                </>
              );
            })()}
          </GlassCard>
        )}

        {/* Water moved into the Habits system — the "Woda" count habit (fed by
            Health Connect hydration). Manage it on the Nawyki screen. */}

        {/* Weight */}
        <GlassCard padding={spacing[4]} style={styles.tealCard}>
          <View style={styles.cardRow}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => { haptic.tap(); setDetail('body'); }} style={{ flexDirection: 'row', alignItems: 'center', gap: spacing[2] }}>
              <Activity size={13} color={colors.text.muted} />
              <Text style={styles.cardLabel}>CIAŁO</Text>
              <ChevronRight size={13} color={colors.text.muted} />
            </TouchableOpacity>
            <View style={{ flex: 1 }} />
            {loggedWeights.length > 1 && (
              <Text style={{ fontSize: 10, color: (maxW - minW) > 0.5 ? colors.accent.amber : colors.accent.green, fontWeight: '600', marginRight: spacing[2] }}>
                Δ {(maxW - minW).toFixed(1)} kg
              </Text>
            )}
            <TouchableOpacity
              onPress={() => { haptic.tap(); setGoalInput(weightGoal > 0 ? String(weightGoal) : ''); setGoalModal(true); }}
              style={styles.goalChip}
            >
              <Text style={styles.goalChipText}>{weightGoal > 0 ? `cel ${weightGoal} kg` : 'ustaw cel'}</Text>
            </TouchableOpacity>
          </View>

          {/* Weight-goal progress + ETA from the weekly trend */}
          {weightGoal > 0 && (weight > 0 || lastWeight > 0) && (() => {
            const cur = weight > 0 ? weight : lastWeight;
            const remaining = +(cur - weightGoal).toFixed(1);
            const done = Math.abs(remaining) < 0.1;
            // weekly rate from this week's logged weights
            let first = 0, last = 0;
            for (const w of weekWeight) { if (w > 0) { if (first === 0) first = w; last = w; } }
            const rate = (first > 0 && last > 0) ? +(last - first).toFixed(2) : 0;
            const towardGoal = (remaining > 0 && rate < 0) || (remaining < 0 && rate > 0);
            const weeksEta = towardGoal && Math.abs(rate) > 0.05 ? Math.ceil(Math.abs(remaining) / Math.abs(rate)) : null;
            return (
              <View style={styles.goalProg}>
                <Text style={[styles.goalProgText, done && { color: T.accent }]}>
                  {done ? 'Cel osiągnięty! 🎯' : `${Math.abs(remaining)} kg ${remaining > 0 ? 'do celu' : 'poniżej celu'} (${cur.toFixed(1)} → ${weightGoal})`}
                  {weeksEta != null ? `  ·  ~${weeksEta} tyg. w tym tempie` : ''}
                </Text>
              </View>
            );
          })()}

          {/* Body composition from the watch BIA (when present) — the trend, not a
              single reading, is what's reliable (measure consistently, fasted). */}
          {((hcExtra.bodyFatPct as number) > 0 || (hcExtra.leanMassKg as number) > 0 || (hcExtra.bodyWaterKg as number) > 0 || (hcExtra.bmr as number) > 0) && (
            <View style={styles.bodyCompRow}>
              {(hcExtra.bodyFatPct as number) > 0 && (
                <View style={styles.bodyCompTile}><Text style={styles.bodyCompVal}>{hcExtra.bodyFatPct}%</Text><Text style={styles.bodyCompLabel}>tk. tłuszczowa</Text></View>
              )}
              {(hcExtra.leanMassKg as number) > 0 && (
                <View style={styles.bodyCompTile}><Text style={styles.bodyCompVal}>{hcExtra.leanMassKg} kg</Text><Text style={styles.bodyCompLabel}>masa mięśniowa</Text></View>
              )}
              {(hcExtra.bodyWaterKg as number) > 0 && (
                <View style={styles.bodyCompTile}><Text style={styles.bodyCompVal}>{hcExtra.bodyWaterKg} kg</Text><Text style={styles.bodyCompLabel}>woda w ciele</Text></View>
              )}
              {(hcExtra.bmr as number) > 0 && (
                <View style={styles.bodyCompTile}><Text style={styles.bodyCompVal}>{hcExtra.bmr}</Text><Text style={styles.bodyCompLabel}>BMR kcal/dzień</Text></View>
              )}
            </View>
          )}

          {(() => {
            let first = 0, last = 0;
            for (const f of weekFat) { if (f > 0) { if (first === 0) first = f; last = f; } }
            if (first === 0 || last === 0 || first === last) return null;
            const d = +(last - first).toFixed(1);
            return (
              <Text style={styles.fatTrend}>
                Tkanka tłuszczowa: <Text style={{ color: d <= 0 ? T.accent : colors.accent.amber, fontWeight: '800' }}>{d > 0 ? '+' : ''}{d}%</Text> w tym tygodniu
              </Text>
            );
          })()}

          <View style={styles.weightRow}>
            <PressableScale onPress={() => bumpWeight(-1)} style={styles.weightBtn}>
              <Minus size={13} color={colors.text.muted} />
            </PressableScale>
            <PressableScale onPress={() => bumpWeight(-0.1)} style={styles.weightBtnSm}>
              <Text style={styles.weightBtnSmText}>-0.1</Text>
            </PressableScale>
            <TouchableOpacity
              style={styles.weightCenter}
              onPress={() => { setWeightInput((weight > 0 ? weight : lastWeight) > 0 ? (weight > 0 ? weight : lastWeight).toFixed(1) : ''); setWeightModal(true); }}
              activeOpacity={0.7}
            >
              <Text style={[styles.weightNum, weight === 0 && lastWeight > 0 && { opacity: 0.45 }]}>
                {weight > 0 ? weight.toFixed(1) : lastWeight > 0 ? lastWeight.toFixed(1) : '—'}
              </Text>
              <Text style={styles.weightUnit}>
                {weight > 0 ? 'kg · dotknij' : lastWeight > 0 ? 'kg · ostatnia — zmień +/−' : 'kg · ustaw'}
              </Text>
            </TouchableOpacity>
            <PressableScale onPress={() => bumpWeight(0.1)} style={styles.weightBtnSm}>
              <Text style={styles.weightBtnSmText}>+0.1</Text>
            </PressableScale>
            <PressableScale onPress={() => bumpWeight(1)} style={styles.weightBtn}>
              <Plus size={13} color={colors.text.muted} />
            </PressableScale>
          </View>

          {/* 7-day weight sparkline */}
          {loggedWeights.length > 0 && (
            <View style={styles.weightChartRow}>
              {weekWeight.map((w, i) => {
                const h = w > 0 ? Math.max(8, ((w - minW) / weightRange) * 48 + 8) : 3;
                const isToday = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
                return (
                  <View key={i} style={styles.weightChartCol}>
                    <View style={styles.weightBarWrap}>
                      <View style={[styles.weightBar, {
                        height: h,
                        backgroundColor: w > 0 ? T.accent : colors.fill.medium,
                        width: isToday ? 12 : 8,
                        opacity: w === 0 ? 0.3 : 1,
                      }]} />
                    </View>
                    <Text style={[styles.chartDay, isToday && styles.chartDayToday]}>{WEEK_DAYS[i]}</Text>
                    {w > 0 && <Text style={styles.weightBarLabel}>{w.toFixed(1)}</Text>}
                  </View>
                );
              })}
            </View>
          )}
        </GlassCard>

        {/* Energy balance (estimate) */}
        {(energy.burned > 0 || energy.intakeAvg > 0) && (
          <GlassCard padding={spacing[4]} style={styles.tealCard}>
            <TouchableOpacity activeOpacity={0.7} onPress={() => { haptic.tap(); setEnergyOpen(o => !o); }} style={styles.cardRow}>
              <Flame size={13} color={colors.text.muted} />
              <Text style={[styles.cardLabel, { flexShrink: 1 }]} numberOfLines={1}>BILANS ENERGII</Text>
              <View style={{ flex: 1, minWidth: spacing[2] }} />
              {!energyOpen && energy.burned > 0 && energy.intakeAvg > 0 && (
                <Text style={{ fontSize: 12, fontWeight: '800', color: energy.balance >= 0 ? T.accent : colors.accent.red, marginRight: spacing[2] }} numberOfLines={1}>
                  {energy.balance >= 0 ? 'deficyt ' : 'nadwyżka '}{Math.abs(energy.balance).toLocaleString('pl-PL')}
                </Text>
              )}
              <Text style={styles.energyTag} numberOfLines={1}>szacunek</Text>
              <ChevronRight size={13} color={colors.text.muted} style={[{ marginLeft: 4 }, energyOpen && { transform: [{ rotate: '90deg' }] }]} />
            </TouchableOpacity>

            {energyOpen && (<>
            <View style={styles.energyRow}>
              <View style={styles.energyTile}>
                <Text style={styles.energyVal}>{energy.burned > 0 ? energy.burned.toLocaleString('pl-PL') : '—'}</Text>
                <Text style={styles.energyLabel}>spalono dziś</Text>
              </View>
              <View style={styles.energyOp}><Text style={styles.energyOpText}>−</Text></View>
              <View style={styles.energyTile}>
                <Text style={styles.energyVal}>{energy.intakeAvg > 0 ? energy.intakeAvg.toLocaleString('pl-PL') : '—'}</Text>
                <Text style={styles.energyLabel}>jedzenie śr./dzień</Text>
              </View>
            </View>

            {energy.burned > 0 && energy.intakeAvg > 0 && (
              <View style={[styles.energyBalance, { borderColor: energy.balance >= 0 ? T.cardBorder : colors.accent.red + '40' }]}>
                <Text style={[styles.energyBalanceVal, { color: energy.balance >= 0 ? T.accent : colors.accent.red }]}>
                  {energy.balance >= 0 ? '−' : '+'}{Math.abs(energy.balance).toLocaleString('pl-PL')} kcal
                </Text>
                <Text style={styles.energyBalanceLabel}>
                  {energy.balance >= 0 ? 'deficyt — sprzyja spadkowi wagi' : 'nadwyżka — sprzyja przyrostowi'}
                </Text>
              </View>
            )}

            {energy.maintain > 0 && (
              <View style={styles.energyTargetRow}>
                <View style={styles.energyTarget}>
                  <Text style={styles.energyTargetVal}>~{energy.maintain.toLocaleString('pl-PL')}</Text>
                  <Text style={styles.energyTargetLabel}>utrzymanie /dzień</Text>
                </View>
                {energy.cut > 0 && (
                  <View style={styles.energyTarget}>
                    <Text style={[styles.energyTargetVal, { color: T.accent }]}>~{energy.cut.toLocaleString('pl-PL')}</Text>
                    <Text style={styles.energyTargetLabel}>cel na spadek (≈0,5 kg/tydz.)</Text>
                  </View>
                )}
              </View>
            )}

            {energy.weightDelta != null && (
              <Text style={styles.energyWeight}>
                Waga w tym tyg.: <Text style={{ color: energy.weightDelta <= 0 ? T.accent : colors.accent.red, fontWeight: '800' }}>{energy.weightDelta > 0 ? '+' : ''}{energy.weightDelta} kg</Text>
                {energy.burned > 0 && energy.intakeAvg > 0
                  ? ((energy.balance >= 0) === (energy.weightDelta <= 0) ? '  ·  zgodne z bilansem' : '  ·  rozjazd z bilansem — popraw szacunek')
                  : ''}
              </Text>
            )}

            {(() => {
              const tIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
              const days = energy.week.map(d => (d.burn > 0 && d.intake > 0) ? d.balance : null);
              if (!days.some(b => b != null)) return null;
              const maxAbs = Math.max(...days.map(b => (b == null ? 0 : Math.abs(b))), 1);
              return (
                <>
                  <Text style={styles.detailSectionLabel}>BILANS · 7 DNI</Text>
                  <View style={styles.energyWeekRow}>
                    {days.map((b, i) => (
                      <View key={i} style={styles.energyWeekCol}>
                        <View style={styles.energyWeekBarWrap}>
                          <View style={[styles.energyWeekBar, {
                            height: b == null ? 2 : Math.max(3, (Math.abs(b) / maxAbs) * 40),
                            backgroundColor: b == null ? colors.fill.medium : b >= 0 ? T.accent : colors.accent.red,
                            opacity: b == null ? 0.4 : 1,
                          }]} />
                        </View>
                        <Text style={[styles.energyWeekLabel, i === tIdx && { color: T.accent, fontWeight: '700' }]}>{WEEK_DAYS[i]}</Text>
                      </View>
                    ))}
                  </View>
                </>
              );
            })()}

            <Text style={styles.energyNote}>
              {energy.burned === 0 ? 'Brak spalania z zegarka. W Samsung Health → Ustawienia → Health Connect włącz udostępnianie „Spalone kalorie" (aktywne + całkowite), potem odśwież tutaj.'
                : energy.intakeAvg === 0 ? 'Brak danych o jedzeniu — skanuj paragony, by oszacować.'
                : 'Spalanie z zegarka · jedzenie szacowane z paragonów (nie liczy dokładnych posiłków).'}
            </Text>
            </>)}
          </GlassCard>
        )}

        {/* Mood trend */}
        {recentMood.length > 0 && (
          <GlassCard padding={spacing[4]} style={styles.tealCard}>
            <View style={styles.cardRow}>
              <Activity size={13} color={colors.text.muted} />
              <Text style={styles.cardLabel}>NASTRÓJ — 7 DNI</Text>
            </View>
            <View style={styles.moodRow}>
              {recentMood.map((entry) => {
                const mc = MOOD_COLORS[entry.mood];
                return (
                  <View key={entry.id} style={styles.moodCol}>
                    <View style={[styles.moodBar, { height: entry.mood * 10 + 8, backgroundColor: mc }]} />
                    <Text style={[styles.moodNum, { color: mc }]}>{entry.mood}</Text>
                    <Text style={styles.moodDate}>{entry.date.slice(8)}</Text>
                  </View>
                );
              })}
            </View>
          </GlassCard>
        )}

        <View style={styles.note}>
          <View style={styles.noteDot} />
          <Text style={styles.noteText}>Health Connect — integracja wkrótce</Text>
        </View>

      </ScrollView>
      {/* Weight input modal */}
      <Modal visible={weightModal} transparent animationType="fade" onRequestClose={() => setWeightModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={wm.overlay} onPress={() => setWeightModal(false)} />
          <View style={wm.sheet}>
            <Text style={wm.title}>Masa ciała</Text>
            <TextInput
              style={wm.input}
              value={weightInput}
              onChangeText={setWeightInput}
              keyboardType="decimal-pad"
              placeholder="np. 75.5"
              placeholderTextColor={colors.text.muted}
              autoFocus
              selectTextOnFocus
            />
            <Text style={wm.unit}>kg</Text>
            <TouchableOpacity
              style={wm.saveBtn}
              onPress={() => {
                const v = parseFloat(weightInput.replace(',', '.'));
                if (!isNaN(v) && v > 0 && v < 400) {
                  setWeight(parseFloat(v.toFixed(1)));
                }
                setWeightModal(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={wm.saveBtnText}>Zapisz</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Weight-goal modal */}
      <Modal visible={goalModal} transparent animationType="fade" onRequestClose={() => setGoalModal(false)}>
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined} style={{ flex: 1 }}>
          <Pressable style={wm.overlay} onPress={() => setGoalModal(false)} />
          <View style={wm.sheet}>
            <Text style={wm.title}>Cel wagi</Text>
            <TextInput
              style={wm.input}
              value={goalInput}
              onChangeText={setGoalInput}
              keyboardType="decimal-pad"
              placeholder="np. 72"
              placeholderTextColor={colors.text.muted}
              autoFocus
              selectTextOnFocus
            />
            <Text style={wm.unit}>kg{weightGoal > 0 ? ' · puste pole usuwa cel' : ''}</Text>
            <TouchableOpacity
              style={wm.saveBtn}
              onPress={() => {
                const v = parseFloat(goalInput.replace(',', '.'));
                const goal = (!isNaN(v) && v > 0 && v < 400) ? parseFloat(v.toFixed(1)) : 0;
                setWeightGoal(goal);
                saveHealthGoals({ weightGoal: goal }).catch(() => {});
                setGoalModal(false);
              }}
              activeOpacity={0.8}
            >
              <Text style={wm.saveBtnText}>Zapisz</Text>
            </TouchableOpacity>
          </View>
        </KeyboardAvoidingView>
      </Modal>

      {/* Detail stats — tap the steps hero or the sleep card */}
      <Modal visible={detail !== null} transparent animationType="slide" onRequestClose={() => setDetail(null)}>
        <View style={styles.detailOverlay}>
          <Pressable style={StyleSheet.absoluteFill} onPress={() => setDetail(null)} />
          <View style={styles.detailSheet}>
            <View style={styles.detailHeader}>
              {detail === 'steps' ? <Footprints size={16} color={T.accent} /> : detail === 'sleep' ? <Moon size={16} color={T.accent} /> : <Activity size={16} color={T.accent} />}
              <Text style={styles.detailTitle}>{detail === 'steps' ? 'Kroki' : detail === 'sleep' ? 'Sen' : 'Ciało'} — szczegóły</Text>
              <View style={{ flex: 1 }} />
              <TouchableOpacity onPress={() => setDetail(null)} hitSlop={10}><X size={18} color={colors.text.muted} /></TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false}>
              {detail === 'steps' && healthStats && (() => {
                const activeDays = monthData.filter(p => p.steps > 0).length;
                const totalKm = Math.round(monthData.reduce((s, p) => s + p.steps, 0) * 0.00075);
                const dowAvg = dowAverage(monthData, p => p.steps);
                const bestDow = dowAvg.indexOf(Math.max(...dowAvg));
                const maxDow = Math.max(...dowAvg, 1);
                const tiles = [
                  { v: steps.toLocaleString(), l: 'dziś' },
                  { v: healthStats.avgSteps7.toLocaleString(), l: 'śr. 7 dni' },
                  { v: healthStats.avgSteps30.toLocaleString(), l: 'śr. 30 dni' },
                  { v: `${healthStats.goalHit}%`, l: 'dni z celem' },
                  { v: `${healthStats.trendPct >= 0 ? '+' : ''}${healthStats.trendPct}%`, l: 'vs poprz. tydz.' },
                  { v: `${(steps * 0.00075).toFixed(1)} km`, l: 'dziś dystans' },
                  { v: `${activeDays}`, l: 'aktywne dni (30d)' },
                  { v: `${totalKm} km`, l: 'suma 30 dni' },
                ];
                return (
                  <>
                    <View style={styles.detailGrid}>
                      {tiles.map((t2, i) => (
                        <View key={i} style={styles.detailTile}><Text style={styles.detailTileVal}>{t2.v}</Text><Text style={styles.detailTileLabel}>{t2.l}</Text></View>
                      ))}
                    </View>
                    {healthStats.best.steps > 0 && (
                      <View style={styles.detailRecord}>
                        <Award size={14} color={T.accent} />
                        <Text style={styles.detailRecordText}>Rekord 30 dni: {healthStats.best.steps.toLocaleString()} kroków · {new Date(healthStats.best.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}</Text>
                      </View>
                    )}
                    <Text style={styles.detailSectionLabel}>ŚREDNIO WG DNIA TYGODNIA</Text>
                    <View style={styles.detailDowRow}>
                      {dowAvg.map((v, i) => (
                        <View key={i} style={styles.detailDowCol}>
                          <Text style={[styles.detailDowVal, i === bestDow && { color: T.accent, fontWeight: '800' }]}>{v > 0 ? (v >= 1000 ? `${(v / 1000).toFixed(1)}k` : Math.round(v)) : ''}</Text>
                          <View style={styles.detailDowBarWrap}>
                            <View style={[styles.detailDowBar, { height: v > 0 ? Math.max(3, (v / maxDow) * 52) : 2, backgroundColor: i === bestDow ? T.accent : T.muted, opacity: v === 0 ? 0.4 : 1 }]} />
                          </View>
                          <Text style={styles.detailDowLabel}>{DOW_LABELS[i]}</Text>
                        </View>
                      ))}
                    </View>
                    {dowAvg[bestDow] > 0 && (
                      <Text style={styles.detailInsight}>Najwięcej chodzisz w: {DOW_FULL[bestDow]} (śr. {dowAvg[bestDow].toLocaleString()} kroków).</Text>
                    )}
                    <Text style={styles.detailSectionLabel}>OSTATNIE 30 DNI</Text>
                    <View style={styles.detailBars}>
                      {monthData.map(p => {
                        const h = p.steps > 0 ? Math.max(3, (p.steps / healthStats.maxMonth) * 70) : 2;
                        return <View key={p.date} style={[styles.detailBar, { height: h, backgroundColor: p.steps >= stepGoal ? T.accent : T.muted, opacity: p.steps === 0 ? 0.4 : 1 }]} />;
                      })}
                    </View>
                  </>
                );
              })()}

              {detail === 'sleep' && (
                <View style={{ marginBottom: spacing[2] }}>
                  <Text style={styles.detailSectionLabel}>WPISZ RĘCZNIE (gdy zegarek nie podał)</Text>
                  <View style={styles.sleepStepRow}>
                    <View style={styles.sleepStepper}>
                      <TouchableOpacity onPress={() => { haptic.tap(); setSleepH(h => Math.max(0, h - 1)); }} style={styles.slStepBtn}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
                      <Text style={styles.stepVal}>{sleepH}<Text style={styles.stepUnit}>h</Text></Text>
                      <TouchableOpacity onPress={() => { haptic.tap(); setSleepH(h => Math.min(16, h + 1)); }} style={styles.slStepBtn}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
                    </View>
                    <View style={styles.sleepStepper}>
                      <TouchableOpacity onPress={() => { haptic.tap(); setSleepM(m => (m + 45) % 60); }} style={styles.slStepBtn}><Text style={styles.stepBtnText}>−</Text></TouchableOpacity>
                      <Text style={styles.stepVal}>{pad(sleepM)}<Text style={styles.stepUnit}>m</Text></Text>
                      <TouchableOpacity onPress={() => { haptic.tap(); setSleepM(m => (m + 15) % 60); }} style={styles.slStepBtn}><Text style={styles.stepBtnText}>+</Text></TouchableOpacity>
                    </View>
                  </View>
                  <View style={styles.qualityPickRow}>
                    {QUALITY_KEYS.map(q => (
                      <TouchableOpacity key={q} onPress={() => { haptic.tap(); setSleepQuality(q); }} style={[styles.qualityPick, sleepQuality === q && { backgroundColor: QUALITY_COLORS[q] + '22', borderColor: QUALITY_COLORS[q] }]}>
                        <Text style={[styles.qualityPickText, sleepQuality === q && { color: QUALITY_COLORS[q] }]}>{QUALITY_LABELS[q]}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                </View>
              )}

              {detail === 'sleep' && healthStats && (() => {
                const hm = (m: number) => `${Math.floor(m / 60)}h ${pad(m % 60)}m`;
                const maxSleepMin = Math.max(...monthData.map(p => p.sleepMinutes), 1);
                const deep = (hcExtra.sleepDeepMin as number) || 0;
                const rem = (hcExtra.sleepRemMin as number) || 0;
                const light = (hcExtra.sleepLightMin as number) || 0;
                const nights = monthData.filter(p => p.sleepMinutes > 0);
                const pct7h = nights.length ? Math.round(nights.filter(p => p.sleepMinutes >= 420).length / nights.length * 100) : 0;
                const last7n = monthData.slice(-7).filter(p => p.sleepMinutes > 0);
                const debtMin = last7n.reduce((s, p) => s + Math.max(0, 420 - p.sleepMinutes), 0);
                const dowAvg = dowAverage(monthData, p => p.sleepMinutes);
                const worstDow = (() => { let wi = -1, wv = Infinity; dowAvg.forEach((v, i) => { if (v > 0 && v < wv) { wv = v; wi = i; } }); return wi; })();
                const maxDow = Math.max(...dowAvg, 1);
                const tiles = [
                  { v: `${sleepH}h ${pad(sleepM)}m`, l: 'dziś' },
                  { v: hm(healthStats.avgSleep7), l: 'śr. 7 dni' },
                  { v: hm(healthStats.avgSleep30), l: 'śr. 30 dni' },
                  { v: `±${healthStats.sleepConsistency}m`, l: 'regularność' },
                  { v: `${pct7h}%`, l: 'nocy 7h+' },
                  { v: `${(debtMin / 60).toFixed(1)}h`, l: 'dług snu (7d)' },
                ];
                return (
                  <>
                    <View style={styles.detailGrid}>
                      {tiles.map((t2, i) => (
                        <View key={i} style={styles.detailTile}><Text style={styles.detailTileVal}>{t2.v}</Text><Text style={styles.detailTileLabel}>{t2.l}</Text></View>
                      ))}
                    </View>
                    {(deep > 0 || rem > 0 || light > 0) && (
                      <>
                        <Text style={styles.detailSectionLabel}>FAZY (DZIŚ)</Text>
                        <View style={styles.detailGrid}>
                          <View style={styles.detailTile}><Text style={[styles.detailTileVal, { color: '#6366F1' }]}>{Math.round(deep)}m</Text><Text style={styles.detailTileLabel}>głęboki</Text></View>
                          <View style={styles.detailTile}><Text style={[styles.detailTileVal, { color: '#A78BFA' }]}>{Math.round(rem)}m</Text><Text style={styles.detailTileLabel}>REM</Text></View>
                          <View style={styles.detailTile}><Text style={[styles.detailTileVal, { color: '#5EC8D8' }]}>{Math.round(light)}m</Text><Text style={styles.detailTileLabel}>lekki</Text></View>
                        </View>
                      </>
                    )}
                    {healthStats.sleepBest && healthStats.sleepBest.sleepMinutes > 0 && (
                      <View style={styles.detailRecord}>
                        <Award size={14} color={T.accent} />
                        <Text style={styles.detailRecordText}>Najlepsza: {hm(healthStats.sleepBest.sleepMinutes)} · {new Date(healthStats.sleepBest.date).toLocaleDateString('pl-PL', { day: 'numeric', month: 'short' })}   ·   Najkrótsza: {hm(healthStats.sleepWorst.sleepMinutes)}</Text>
                      </View>
                    )}
                    <Text style={styles.detailSectionLabel}>ŚREDNIO WG DNIA TYGODNIA</Text>
                    <View style={styles.detailDowRow}>
                      {dowAvg.map((v, i) => (
                        <View key={i} style={styles.detailDowCol}>
                          <Text style={[styles.detailDowVal, v >= 420 && { color: T.accent, fontWeight: '800' }]}>{v > 0 ? `${(v / 60).toFixed(1).replace('.0', '')}h` : ''}</Text>
                          <View style={styles.detailDowBarWrap}>
                            <View style={[styles.detailDowBar, { height: v > 0 ? Math.max(3, (v / maxDow) * 52) : 2, backgroundColor: v >= 420 ? T.accent : T.muted, opacity: v === 0 ? 0.4 : 1 }]} />
                          </View>
                          <Text style={styles.detailDowLabel}>{DOW_LABELS[i]}</Text>
                        </View>
                      ))}
                    </View>
                    {worstDow >= 0 && dowAvg[worstDow] > 0 && (
                      <Text style={styles.detailInsight}>Najmniej śpisz w: {DOW_FULL[worstDow]} (śr. {hm(dowAvg[worstDow])}).</Text>
                    )}
                    <Text style={styles.detailSectionLabel}>OSTATNIE 30 DNI</Text>
                    <View style={styles.detailBars}>
                      {monthData.map(p => {
                        const h = p.sleepMinutes > 0 ? Math.max(3, (p.sleepMinutes / maxSleepMin) * 70) : 2;
                        return <View key={p.date} style={[styles.detailBar, { height: h, backgroundColor: p.sleepMinutes >= 420 ? T.accent : T.muted, opacity: p.sleepMinutes === 0 ? 0.4 : 1 }]} />;
                      })}
                    </View>
                  </>
                );
              })()}

              {detail === 'body' && (() => {
                const cur = weight > 0 ? weight : lastWeight;
                const fats = weekFat.filter(f => f > 0);
                const fatDelta = (fats.length >= 2 && fats[0] !== fats[fats.length - 1]) ? +(fats[fats.length - 1] - fats[0]).toFixed(1) : null;
                const ws = weekWeight.filter(w => w > 0);
                const maxW2 = ws.length ? Math.max(...ws) : 1;
                const minW2 = ws.length ? Math.min(...ws) : 0;
                const rangeW = maxW2 - minW2 || 1;
                const tiles = [
                  { v: cur > 0 ? `${cur.toFixed(1)} kg` : '—', l: 'waga' },
                  ...(weightGoal > 0 ? [{ v: `${weightGoal} kg`, l: 'cel' }] : []),
                  ...((hcExtra.bodyFatPct as number) > 0 ? [{ v: `${hcExtra.bodyFatPct}%`, l: 'tk. tłuszczowa' }] : []),
                  ...((hcExtra.leanMassKg as number) > 0 ? [{ v: `${hcExtra.leanMassKg} kg`, l: 'mięśnie' }] : []),
                  ...((hcExtra.bodyWaterKg as number) > 0 ? [{ v: `${hcExtra.bodyWaterKg} kg`, l: 'woda' }] : []),
                  ...((hcExtra.bmr as number) > 0 ? [{ v: `${hcExtra.bmr}`, l: 'BMR' }] : []),
                ];
                return (
                  <>
                    <View style={styles.detailGrid}>
                      {tiles.map((t2, i) => (
                        <View key={i} style={styles.detailTile}><Text style={styles.detailTileVal}>{t2.v}</Text><Text style={styles.detailTileLabel}>{t2.l}</Text></View>
                      ))}
                    </View>

                    <TouchableOpacity onPress={() => { haptic.tap(); setBodyEdit(e => !e); }} style={styles.bodyEditToggle}>
                      <Text style={styles.bodyEditToggleText}>{bodyEdit ? 'Ukryj ręczny wpis' : 'Wpisz ręcznie (gdy zegarek nie podał)'}</Text>
                    </TouchableOpacity>
                    {bodyEdit && (
                      <View style={styles.bodyEditRow}>
                        {[
                          { k: 'bodyFatPct', l: 'Tłuszcz %' },
                          { k: 'leanMassKg', l: 'Mięśnie kg' },
                          { k: 'bodyWaterKg', l: 'Woda kg' },
                        ].map(f => (
                          <View key={f.k} style={styles.bodyEditField}>
                            <Text style={styles.bodyEditLabel}>{f.l}</Text>
                            <TextInput
                              key={`${f.k}-${bodyEdit}`}
                              defaultValue={(hcExtra[f.k] as number) > 0 ? String(hcExtra[f.k]) : ''}
                              onChangeText={t => setBodyField(f.k, t)}
                              keyboardType="decimal-pad"
                              placeholder="—"
                              placeholderTextColor={T.muted}
                              style={styles.bodyEditInput}
                            />
                          </View>
                        ))}
                      </View>
                    )}
                    {fatDelta != null && (
                      <View style={styles.detailRecord}>
                        <Award size={14} color={T.accent} />
                        <Text style={styles.detailRecordText}>Tkanka tłuszczowa: {fatDelta > 0 ? '+' : ''}{fatDelta}% w tym tygodniu</Text>
                      </View>
                    )}
                    {ws.length >= 1 && (
                      <>
                        <Text style={styles.detailSectionLabel}>WAGA · 7 DNI</Text>
                        <View style={styles.detailDowRow}>
                          {weekWeight.map((w, i) => (
                            <View key={i} style={styles.detailDowCol}>
                              <Text style={styles.detailDowVal}>{w > 0 ? w.toFixed(1) : ''}</Text>
                              <View style={styles.detailDowBarWrap}>
                                <View style={[styles.detailDowBar, { height: w > 0 ? 6 + ((w - minW2) / rangeW) * 44 : 2, backgroundColor: w > 0 ? T.accent : colors.fill.medium, opacity: w > 0 ? 1 : 0.4 }]} />
                              </View>
                              <Text style={styles.detailDowLabel}>{WEEK_DAYS[i]}</Text>
                            </View>
                          ))}
                        </View>
                      </>
                    )}
                    <Text style={styles.detailInsight}>Wartości z BIA zegarka są wiarygodne w trendzie — mierz konsekwentnie (rano, na czczo).</Text>
                  </>
                );
              })()}
              <View style={{ height: 24 }} />
            </ScrollView>
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const makeStyles = (c: any, t: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: 180 },
  syncBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2],
    paddingVertical: spacing[3], borderRadius: radius.lg,
    backgroundColor: t.accent + '14', borderWidth: 1, borderColor: t.accent + '33',
  },
  syncText: { fontSize: 13, fontWeight: '700' },
  syncIconBtn: { width: 38, height: 38, borderRadius: 19, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  hcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  hcTile: {
    width: '31%', flexGrow: 1, gap: 3, paddingVertical: spacing[2], paddingHorizontal: spacing[2],
    borderRadius: radius.md, backgroundColor: c.fill.subtle, borderWidth: 1, borderColor: c.border.card,
  },
  hcVal: { fontSize: 17, fontWeight: '800', color: c.text.primary },
  hcUnit: { fontSize: 10, fontWeight: '600', color: c.text.muted },
  hcLabel: { fontSize: 10, color: c.text.muted },
  syncFallback: { fontSize: 11, color: c.text.muted, textAlign: 'center', textDecorationLine: 'underline', marginTop: -spacing[1] },

  card: { gap: spacing[3] },
  tealCard: { gap: spacing[3], backgroundColor: t.card, borderColor: t.cardBorder },
  tealPomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], backgroundColor: t.card, borderColor: t.cardBorder },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardLabel: { fontSize: 10, fontWeight: '600', color: t.muted, letterSpacing: 1.2 },

  heroNum: { fontSize: 44, fontWeight: '900', letterSpacing: -2, lineHeight: 48 },
  heroSub: { ...typography.caption, color: c.text.muted },

  progressTrack: { height: 8, backgroundColor: c.fill.medium, borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full },

  stepControls: { flexDirection: 'row', gap: spacing[1] },
  stepBtn: {
    width: 26, height: 26, borderRadius: radius.sm,
    backgroundColor: c.fill.medium,
    borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },

  // Sleep
  sleepDurRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  sleepBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: c.fill.medium,
    borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  sleepDurCenter: { flex: 1, alignItems: 'center', gap: 2 },
  sleepDurNum: { fontSize: 32, fontWeight: '900', color: c.text.primary, letterSpacing: -1 },
  sleepDurUnit: { fontSize: 13, fontWeight: '400', color: c.text.muted },
  sleepDurSub: { fontSize: 11, color: c.text.muted, fontWeight: '500' },
  sleepStepRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[2] },
  sleepStepper: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: c.fill.subtle, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.subtle, paddingHorizontal: spacing[2], paddingVertical: 6 },
  slStepBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fill.medium },
  stepBtnText: { fontSize: 20, fontWeight: '800', color: c.text.primary, lineHeight: 22 },
  stepVal: { fontSize: 18, fontWeight: '800', color: c.text.primary },
  stepUnit: { fontSize: 12, fontWeight: '500', color: c.text.muted },
  qualityPickRow: { flexDirection: 'row', gap: spacing[1] },
  qualityPick: { flex: 1, alignItems: 'center', paddingVertical: 7, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.subtle, backgroundColor: c.fill.subtle },
  qualityPickText: { fontSize: 11, fontWeight: '700', color: c.text.secondary },
  bodyEditToggle: { alignSelf: 'flex-start', marginTop: spacing[2] },
  bodyEditToggleText: { fontSize: 11.5, fontWeight: '700', color: '#8B5CF6' },
  bodyEditRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2] },
  bodyEditField: { flex: 1 },
  bodyEditLabel: { fontSize: 10, fontWeight: '600', color: c.text.muted, marginBottom: 3 },
  bodyEditInput: { backgroundColor: c.fill.subtle, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.subtle, paddingHorizontal: spacing[2], paddingVertical: 9, fontSize: 15, fontWeight: '700', color: c.text.primary, textAlign: 'center' },

  minuteRow: { flexDirection: 'row', gap: spacing[2] },
  minutePill: {
    flex: 1, paddingVertical: 6, borderRadius: radius.sm,
    backgroundColor: c.fill.subtle,
    borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center',
  },
  minutePillActive: {
    backgroundColor: t.accentDim,
    borderColor: t.cardBorder,
  },
  minuteText: { fontSize: 12, color: c.text.muted, fontWeight: '500' },
  minuteTextActive: { color: t.accent, fontWeight: '700' },

  microBar: { height: 5, backgroundColor: c.fill.medium, borderRadius: radius.full, overflow: 'hidden' },
  microFill: { height: '100%', borderRadius: radius.full },
  stageBar: { flexDirection: 'row', height: 12, borderRadius: radius.full, overflow: 'hidden', backgroundColor: c.border.subtle },
  stageLegend: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[3] },
  stageItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  stageDot: { width: 8, height: 8, borderRadius: 4 },
  stageText: { fontSize: 11, fontWeight: '600', color: c.text.secondary },
  summaryRow: { flexDirection: 'row', gap: spacing[2] },
  summaryTile: { flex: 1, alignItems: 'center', gap: 3, paddingVertical: spacing[3], backgroundColor: t.card, borderRadius: radius.lg, borderWidth: 1, borderColor: t.cardBorder },
  summaryVal: { fontSize: 17, fontWeight: '900', color: c.text.primary, letterSpacing: -0.5 },
  summaryLabel: { fontSize: 9.5, fontWeight: '600', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4 },

  qualityBadge: {
    marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
  },
  qualityBadgeText: { fontSize: 10, fontWeight: '700' },

  qualityRow: { flexDirection: 'row', gap: spacing[2] },
  qualityPill: {
    flex: 1, paddingVertical: 7, borderRadius: radius.sm,
    backgroundColor: c.fill.subtle,
    borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center',
  },
  qualityText: { fontSize: 10, color: c.text.muted, fontWeight: '600' },

  sleepChartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[1] },
  sleepChartCol: { flex: 1, alignItems: 'center', gap: 3 },
  sleepBarWrap: { height: 60, justifyContent: 'flex-end', alignItems: 'center' },
  sleepBar: { borderRadius: 3, minHeight: 3 },
  sleepBarLabel: { fontSize: 8, color: c.text.muted },

  // Pomodoro row (base — overridden by tealPomRow inline)
  pomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  pomLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 },
  pomNum: { fontSize: 22, fontWeight: '800', color: c.text.primary, letterSpacing: -0.5 },
  pomUnit: { fontSize: 11, fontWeight: '400', color: c.text.muted },
  pomCta: {
    paddingHorizontal: spacing[4], paddingVertical: 8,
    backgroundColor: c.fill.medium,
    borderRadius: radius.sm, borderWidth: 1,
    borderColor: c.border.default,
  },
  pomCtaText: { fontSize: 12, fontWeight: '600', color: c.text.secondary },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[1] },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartBarWrap: { height: 84, justifyContent: 'flex-end', alignItems: 'center' },
  chartBar: { borderRadius: 3, minHeight: 4 },
  chartDay: { ...typography.caption, color: c.text.muted, fontSize: 9 },
  chartDayToday: { color: c.text.primary, fontWeight: '700' },
  chartNum: { ...typography.caption, color: c.text.muted, fontSize: 8 },

  // "from the watch" chip + 30-day analysis
  watchChip: {
    flexDirection: 'row', alignItems: 'center', gap: 3,
    paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full,
    backgroundColor: t.accentDim, borderWidth: 1, borderColor: t.cardBorder,
  },
  watchChipText: { fontSize: 8.5, fontWeight: '700', color: t.accent, letterSpacing: 0.3 },
  trendText: { fontSize: 10, fontWeight: '800' },
  rangeToggle: { flexDirection: 'row', gap: 2, backgroundColor: t.accentDim, borderRadius: radius.full, padding: 2 },
  rangeBtn: { paddingHorizontal: spacing[2], paddingVertical: 3, borderRadius: radius.full },
  rangeBtnOn: { backgroundColor: t.accent + '30' },
  rangeBtnText: { fontSize: 9.5, fontWeight: '700', color: c.text.muted },
  rangeBtnTextOn: { color: t.accent },
  weekDayLabel: { fontSize: 8, fontWeight: '600', color: c.text.muted, textAlign: 'center', marginTop: 4 },
  stepCol: { flex: 1, alignItems: 'center' },
  stepValLabel: { fontSize: 8, fontWeight: '600', color: c.text.muted, marginBottom: 2 },
  stepBarWrap: { width: '100%', height: 60, justifyContent: 'flex-end', alignItems: 'center' },
  sleepInsight: { marginTop: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle, gap: 2 },
  sleepInsightMain: { fontSize: 12, fontWeight: '700', color: c.text.primary },
  sleepInsightSub: { fontSize: 10.5, color: c.text.muted },
  monthChartRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    marginTop: spacing[3], gap: 1.5,
  },
  analysisGrid: { flexDirection: 'row', flexWrap: 'wrap', marginTop: spacing[3] },
  analysisTile: { width: '50%', paddingVertical: spacing[2], gap: 1 },
  analysisVal: { fontSize: 20, fontWeight: '900', color: c.text.primary, letterSpacing: -0.5 },
  analysisLabel: { fontSize: 10, fontWeight: '600', color: c.text.muted },
  analysisNote: {
    fontSize: 11, color: c.text.secondary, fontStyle: 'italic',
    marginTop: spacing[1], paddingTop: spacing[2],
    borderTopWidth: 1, borderTopColor: c.border.subtle,
  },

  waterCount: { ...typography.label, color: c.text.secondary, fontWeight: '600', marginLeft: 'auto', fontSize: 10 },
  watchTag: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: t.accentDim, paddingHorizontal: 7, paddingVertical: 3, borderRadius: radius.full },
  watchTagText: { fontSize: 9, fontWeight: '800', color: t.accent, letterSpacing: 0.3 },
  waterHeadRow: { flexDirection: 'row', alignItems: 'baseline', gap: spacing[2], marginTop: spacing[2], marginBottom: spacing[2] },
  waterGaugeWrap: { alignItems: 'center', gap: spacing[2], marginTop: spacing[3], marginBottom: spacing[1] },
  waterLiters: { fontSize: 30, fontWeight: '800', color: c.text.primary, letterSpacing: -0.8 },
  waterLitersUnit: { fontSize: 14, fontWeight: '700', color: c.text.muted, letterSpacing: 0 },
  waterGoalText: { fontSize: 11.5, fontWeight: '600', color: c.text.muted },
  waterHint: { fontSize: 10, color: c.text.muted, marginTop: spacing[2], fontStyle: 'italic' },
  quickAddRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  quickAddBtn: {
    flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5,
    paddingVertical: 10, borderRadius: radius.md,
    backgroundColor: t.accentDim, borderWidth: 1, borderColor: t.cardBorder,
  },
  quickAddText: { fontSize: 12, fontWeight: '700', color: t.accent, letterSpacing: 0.2 },

  // Detail stats modal
  detailOverlay: { flex: 1, justifyContent: 'flex-end', backgroundColor: 'rgba(0,0,0,0.6)' },
  detailSheet: {
    backgroundColor: c.bg.card, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl,
    paddingHorizontal: spacing[4], paddingTop: spacing[4], paddingBottom: spacing[2],
    maxHeight: '82%', borderTopWidth: 1, borderColor: t.cardBorder,
  },
  detailHeader: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: spacing[2] },
  detailTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary, letterSpacing: 0.2 },
  detailGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  detailTile: {
    flexBasis: '30%', flexGrow: 1, minWidth: 92,
    backgroundColor: c.fill.subtle, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.subtle,
    paddingVertical: spacing[3], paddingHorizontal: spacing[2], alignItems: 'center', gap: 3,
  },
  detailTileVal: { fontSize: 17, fontWeight: '800', color: c.text.primary, letterSpacing: -0.3 },
  detailTileLabel: { fontSize: 9.5, color: c.text.muted, letterSpacing: 0.2 },
  detailRecord: {
    flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[3],
    paddingHorizontal: spacing[3], paddingVertical: spacing[3],
    backgroundColor: t.accentDim, borderRadius: radius.md, borderWidth: 1, borderColor: t.cardBorder,
  },
  detailRecordText: { flex: 1, fontSize: 11, fontWeight: '600', color: c.text.secondary, lineHeight: 15 },
  detailSectionLabel: { fontSize: 10, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, marginTop: spacing[4], marginBottom: spacing[1] },
  detailBars: { flexDirection: 'row', alignItems: 'flex-end', gap: 1.5, height: 74, marginTop: spacing[1] },
  detailBar: { flex: 1, borderRadius: 2, minHeight: 2 },
  detailDowRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: spacing[1] },
  detailDowCol: { flex: 1, alignItems: 'center', gap: 3 },
  detailDowBarWrap: { width: '100%', height: 52, justifyContent: 'flex-end', alignItems: 'center' },
  detailDowBar: { width: '66%', borderRadius: 3, minHeight: 2 },
  detailDowLabel: { fontSize: 8.5, color: c.text.muted, fontWeight: '600' },
  detailDowVal: { fontSize: 8, color: c.text.secondary, fontWeight: '700', marginBottom: 1 },
  detailInsight: { fontSize: 11.5, fontWeight: '600', color: c.text.secondary, marginTop: spacing[2], lineHeight: 16 },
  glassRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  glass: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: c.fill.subtle, borderWidth: 1,
    borderColor: c.border.default, alignItems: 'center', justifyContent: 'center',
  },
  glassFilled: { backgroundColor: t.accentDim, borderColor: t.cardBorder },
  waterCtrl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[1] },
  ctrlBtn: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: c.fill.medium, borderWidth: 1,
    borderColor: c.border.default, alignItems: 'center', justifyContent: 'center',
  },
  waterNum: { fontSize: 26, fontWeight: '800', color: c.text.primary, letterSpacing: -0.5 },
  waterSub: { fontSize: 12, fontWeight: '400', color: c.text.muted },

  // Weight
  energyTag: { fontSize: 9, fontWeight: '700', color: c.text.muted, letterSpacing: 0.4, fontStyle: 'italic' },
  energyRow: { flexDirection: 'row', alignItems: 'center', marginTop: spacing[3] },
  energyTile: { flex: 1, alignItems: 'center', gap: 2 },
  energyVal: { fontSize: 22, fontWeight: '800', color: c.text.primary, letterSpacing: -0.5 },
  energyLabel: { fontSize: 10, color: c.text.muted, textAlign: 'center' },
  energyOp: { paddingHorizontal: spacing[2] },
  energyOpText: { fontSize: 20, fontWeight: '700', color: c.text.muted },
  energyBalance: { alignItems: 'center', gap: 2, marginTop: spacing[3], paddingVertical: spacing[3], borderRadius: radius.lg, borderWidth: 1, backgroundColor: t.accentDim },
  energyBalanceVal: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  energyBalanceLabel: { fontSize: 11, fontWeight: '600', color: c.text.secondary },
  energyTargetRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[3] },
  energyTarget: { flex: 1, alignItems: 'center', gap: 2, paddingVertical: spacing[2], backgroundColor: c.fill.subtle, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.subtle },
  energyTargetVal: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  energyTargetLabel: { fontSize: 9, color: c.text.muted, textAlign: 'center' },
  energyWeight: { fontSize: 11.5, fontWeight: '600', color: c.text.secondary, marginTop: spacing[3], textAlign: 'center' },
  energyWeekRow: { flexDirection: 'row', alignItems: 'flex-end', gap: 3, marginTop: spacing[1] },
  energyWeekCol: { flex: 1, alignItems: 'center', gap: 3 },
  energyWeekBarWrap: { width: '100%', height: 42, justifyContent: 'flex-end', alignItems: 'center' },
  energyWeekBar: { width: '62%', borderRadius: 3, minHeight: 2 },
  energyWeekLabel: { fontSize: 8.5, color: c.text.muted, fontWeight: '600' },
  energyNote: { fontSize: 10, color: c.text.muted, marginTop: spacing[2], fontStyle: 'italic', lineHeight: 14 },
  goalChip: { paddingHorizontal: spacing[2] + 2, paddingVertical: 5, borderRadius: radius.full, backgroundColor: t.accentDim, borderWidth: 1, borderColor: t.cardBorder },
  goalChipText: { fontSize: 10, fontWeight: '700', color: t.accent, letterSpacing: 0.2 },
  goalProg: { marginTop: spacing[3] },
  goalProgText: { fontSize: 12, fontWeight: '600', color: c.text.secondary, textAlign: 'center' },
  fatTrend: { fontSize: 11.5, fontWeight: '600', color: c.text.secondary, textAlign: 'center', marginTop: spacing[2] },
  bodyCompRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[3] },
  bodyCompTile: { flexBasis: '47%', flexGrow: 1, gap: 2, paddingVertical: spacing[2], paddingHorizontal: spacing[3], backgroundColor: c.border.subtle, borderRadius: radius.md },
  bodyCompVal: { fontSize: 18, fontWeight: '800', color: c.text.primary },
  bodyCompLabel: { fontSize: 10, color: c.text.muted },
  weightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  weightBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: c.fill.medium,
    borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center', justifyContent: 'center',
  },
  weightBtnSm: {
    paddingHorizontal: spacing[2], paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: c.fill.subtle,
    borderWidth: 1, borderColor: c.border.default,
    alignItems: 'center',
  },
  weightBtnSmText: { fontSize: 10, color: c.text.muted, fontWeight: '600' },
  weightCenter: { flex: 1, alignItems: 'center', gap: 1 },
  weightNum: { fontSize: 36, fontWeight: '900', color: c.text.primary, letterSpacing: -1 },
  weightUnit: { fontSize: 11, color: c.text.muted, fontWeight: '500', marginTop: -2 },
  weightChartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[1] },
  weightChartCol: { flex: 1, alignItems: 'center', gap: 3 },
  weightBarWrap: { height: 60, justifyContent: 'flex-end', alignItems: 'center' },
  weightBar: { borderRadius: 3, minHeight: 3 },
  weightBarLabel: { fontSize: 7, color: c.text.muted },

  moodRow: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-end' },
  moodCol: { flex: 1, alignItems: 'center', gap: 4 },
  moodBar: { width: 10, borderRadius: 5, minHeight: 8 },
  moodNum: { ...typography.caption, fontWeight: '800', fontSize: 11 },
  moodDate: { ...typography.caption, color: c.text.muted, fontSize: 9 },

  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  noteDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: c.text.muted },
  noteText: { ...typography.caption, color: c.text.muted },
});

const makeWm = (c: any, t: any) => StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: c.bg.secondary,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing[6], paddingBottom: spacing[10],
    borderWidth: 1, borderBottomWidth: 0, borderColor: c.border.default,
    alignItems: 'center', gap: spacing[3],
  },
  title: { fontSize: 17, fontWeight: '800', color: c.text.primary, alignSelf: 'flex-start' },
  input: {
    width: '100%', fontSize: 42, fontWeight: '900', color: c.text.primary,
    textAlign: 'center', letterSpacing: -1,
    paddingVertical: spacing[3],
    borderBottomWidth: 2, borderBottomColor: t.accent + '60',
  },
  unit: { fontSize: 13, color: c.text.muted, fontWeight: '600', alignSelf: 'flex-end', marginTop: -spacing[2] },
  saveBtn: {
    width: '100%', paddingVertical: spacing[4],
    backgroundColor: t.accentDim,
    borderRadius: radius.lg, borderWidth: 1, borderColor: t.cardBorder,
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: t.accent },
});
