import { useState, useEffect, useCallback, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { Footprints, Moon, Droplets, Plus, Minus, Activity, Timer, RefreshCw, Heart, MapPin, Flame, Dumbbell, Wind } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { getTodaySessions } from '@/utils/pomodoroHistory';

import ScreenHeader from '@/components/ui/ScreenHeader';
import PressableScale from '@/components/ui/PressableScale';
import GlassCard from '@/components/ui/GlassCard';
import { haptic } from '@/utils/haptics';
import { useMoodStore } from '@/store/moodStore';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { toast } from '@/store/toastStore';
import { MOOD_COLORS } from '@/types';
import { getHealthGoals } from '@/utils/healthGoals';
import { useColors } from '@/theme/useColors';
import { isHealthConnectAvailable, ensureHealthConnect, readHealthDay, readHealthRange, HealthDayPoint, openHealthConnect, probeHealthConnect } from '@/services/healthConnectService';
import { colors, spacing, radius, typography } from '@/theme';

// ─── Teal palette ─────────────────────────────────────────────────────────────

const T = {
  card:       '#041412',
  cardBorder: 'rgba(78,203,168,0.18)',
  accent:     '#4ECBA8',
  accentDim:  'rgba(78,203,168,0.12)',
  muted:      'rgba(78,203,168,0.45)',
};

const WEEK_DAYS = ['Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'Sb', 'Nd'];

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
  // Theme-reactive: shadow the module `colors`/`T` so the whole screen (incl. its
  // StyleSheet via makeStyles) flips with light/dark. Teal accent stays both ways.
  const colors = useColors();
  const T = useMemo(() => ({
    card: colors.bg.card,
    cardBorder: 'rgba(78,203,168,0.22)',
    accent: '#4ECBA8',
    accentDim: 'rgba(78,203,168,0.14)',
    muted: 'rgba(78,203,168,0.55)',
  }), [colors]);
  const styles = useMemo(() => makeStyles(colors, T), [colors, T]);
  const wm = useMemo(() => makeWm(colors, T), [colors, T]);

  const [stepGoal, setStepGoal]         = useState(10_000);
  const [waterGoal, setWaterGoal]       = useState(8);
  const [water, setWater]               = useState(0);
  const [steps, setSteps]               = useState(0);
  const [sleepH, setSleepH]             = useState(7);
  const [sleepM, setSleepM]             = useState(30);
  const [sleepQuality, setSleepQuality] = useState<SleepQuality | undefined>(undefined);
  const [weight, setWeight]             = useState(0);
  const [weightModal, setWeightModal]   = useState(false);
  const [weightInput, setWeightInput]   = useState('');
  const [loaded, setLoaded]             = useState(false);
  const [syncing, setSyncing]           = useState(false);
  const [hcExtra, setHcExtra]           = useState<Record<string, number | null>>({});
  const [weekSteps, setWeekSteps]       = useState<number[]>(Array(7).fill(0));
  const [weekSleep, setWeekSleep]       = useState<WeekSleep[]>(Array(7).fill({ h: 0, m: 0 }));
  const [weekWeight, setWeekWeight]     = useState<number[]>(Array(7).fill(0));
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
          setHcExtra({
            heartRateAvg: day.heartRateAvg, restingHeartRate: day.restingHeartRate, distanceKm: day.distanceKm,
            activeCalories: day.activeCalories, totalCalories: day.totalCalories, exerciseMinutes: day.exerciseMinutes,
            oxygenPct: day.oxygenPct, vo2max: day.vo2max,
            floors: day.floors, hrv: day.hrv, respiratoryRate: day.respiratoryRate, bodyFatPct: day.bodyFatPct, bmr: day.bmr,
            sleepDeepMin: day.sleepDeepMin, sleepRemMin: day.sleepRemMin,
          });
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

  useEffect(() => {
    const load = async () => {
      try {
        const goals = await getHealthGoals();
        setStepGoal(goals.stepGoal);
        setWaterGoal(goals.waterGoal);

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
      } catch {}
      setLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(todayKey(), JSON.stringify({ water, steps, sleepH, sleepM, sleepQuality, weight, hc: hcExtra })).catch(() => {});
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
        setHcExtra({
          heartRateAvg: d.heartRateAvg, restingHeartRate: d.restingHeartRate, distanceKm: d.distanceKm,
          activeCalories: d.activeCalories, totalCalories: d.totalCalories, exerciseMinutes: d.exerciseMinutes,
          oxygenPct: d.oxygenPct, vo2max: d.vo2max,
          floors: d.floors, hrv: d.hrv, respiratoryRate: d.respiratoryRate, bodyFatPct: d.bodyFatPct, bmr: d.bmr,
          sleepDeepMin: d.sleepDeepMin, sleepRemMin: d.sleepRemMin,
        });
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
    <SafeAreaView style={styles.container} edges={[]}>
      <ScreenHeader title="Zdrowie" subtitle="Dzisiaj" style={{ borderBottomColor: T.cardBorder }} />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Sync from the watch via Health Connect (Samsung Health → Health Connect) */}
        <PressableScale onPress={syncHealthConnect} onLongPress={async () => { const s = await probeHealthConnect(); toast.info(`Health Connect: ${s}`); }} disabled={syncing}>
          <View style={styles.syncBtn}>
            <RefreshCw size={14} color={T.accent} />
            <Text style={[styles.syncText, { color: T.accent }]}>
              {syncing ? 'Synchronizuję…' : 'Synchronizuj z zegarka (Health Connect)'}
            </Text>
          </View>
        </PressableScale>
        <PressableScale onPress={async () => { const ok = await openHealthConnect(); if (!ok) toast.error('Nie można otworzyć Health Connect'); }}>
          <Text style={styles.syncFallback}>Nie działa? Otwórz Health Connect i włącz dostęp dla „Sapp"</Text>
        </PressableScale>

        {/* Steps hero */}
        <GlassCard padding={spacing[4]} style={styles.tealCard}>
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
          </View>
          <Text style={[styles.heroNum, {
            color: steps >= stepGoal ? T.accent : colors.text.primary,
          }]}>
            {steps.toLocaleString()}
          </Text>
          <Text style={styles.heroSub}>
            cel {stepGoal.toLocaleString()} · {(steps * 0.00075).toFixed(1)} km · {Math.round(stepPct * 100)}%
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${stepPct * 100}%`,
              backgroundColor: steps >= stepGoal ? T.accent : T.muted,
            }]} />
          </View>
        </GlassCard>

        {/* Sleep card */}
        <GlassCard padding={spacing[4]} style={styles.tealCard}>
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
          </View>

          {/* Duration (read-only — from the watch) */}
          <View style={styles.sleepDurRow}>
            <View style={[styles.sleepDurCenter, { flex: 1 }]}>
              <Text style={styles.sleepDurNum}>
                {sleepH}<Text style={styles.sleepDurUnit}>h </Text>
                {pad(sleepM)}<Text style={styles.sleepDurUnit}>m</Text>
              </Text>
              <Text style={styles.sleepDurSub}>
                {sleepH < 6 ? 'za mało' : sleepH >= 7 && sleepH <= 9 ? 'optymalny' : sleepH > 9 ? 'dużo' : 'minimalny'}
              </Text>
            </View>
          </View>

          <View style={styles.microBar}>
            <View style={[styles.microFill, {
              width: `${sleepPct * 100}%`,
              backgroundColor: sleepQuality ? QUALITY_COLORS[sleepQuality] : colors.text.secondary,
            }]} />
          </View>

          {/* 7-day sleep chart */}
          <View style={[styles.cardRow, { marginTop: spacing[3] }]}>
            <Text style={[styles.cardLabel, { color: colors.text.muted }]}>TYDZIEŃ</Text>
          </View>
          <View style={styles.sleepChartRow}>
            {weekSleep.map((s, i) => {
              const totalH = s.h + s.m / 60;
              const barH = totalH > 0 ? Math.max(6, (totalH / maxSleep) * 56) : 3;
              const isToday = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
              const barColor = s.quality ? QUALITY_COLORS[s.quality] : (totalH > 0 ? colors.text.secondary : 'rgba(255,255,255,0.08)');
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

        {/* From the watch — extra Health Connect metrics (only those with data) */}
        {(() => {
          const cards = ([
            { k: 'heartRateAvg',     Icon: Heart,    label: 'Tętno śr.',    unit: 'bpm',  color: '#FF6B6B' },
            { k: 'restingHeartRate', Icon: Heart,    label: 'Spocz. tętno', unit: 'bpm',  color: '#FF8FA3' },
            { k: 'distanceKm',       Icon: MapPin,   label: 'Dystans',      unit: 'km',   color: '#46B0DE' },
            { k: 'activeCalories',   Icon: Flame,    label: 'Kalorie akt.', unit: 'kcal', color: '#FB923C' },
            { k: 'totalCalories',    Icon: Flame,    label: 'Kalorie',      unit: 'kcal', color: '#F87171' },
            { k: 'exerciseMinutes',  Icon: Dumbbell, label: 'Trening',      unit: 'min',  color: T.accent },
            { k: 'oxygenPct',        Icon: Wind,     label: 'SpO₂',         unit: '%',    color: '#60A5FA' },
            { k: 'vo2max',           Icon: Activity, label: 'VO₂max',       unit: '',     color: '#A78BFA' },
            { k: 'floors',           Icon: Activity, label: 'Piętra',       unit: '',     color: '#34D399' },
            { k: 'hrv',              Icon: Heart,    label: 'HRV',          unit: 'ms',   color: '#F472B6' },
            { k: 'respiratoryRate',  Icon: Wind,     label: 'Oddech',       unit: '/min', color: '#22D3EE' },
            { k: 'bodyFatPct',       Icon: Activity, label: 'Tk. tłuszcz.', unit: '%',    color: '#FBBF24' },
            { k: 'bmr',              Icon: Flame,    label: 'BMR',          unit: 'kcal', color: '#FB7185' },
            { k: 'sleepDeepMin',     Icon: Moon,     label: 'Sen głęboki',  unit: 'min',  color: '#818CF8' },
            { k: 'sleepRemMin',      Icon: Moon,     label: 'Sen REM',      unit: 'min',  color: '#A78BFA' },
          ] as const).filter(c => { const v = hcExtra[c.k]; return v != null && v !== 0; });
          if (cards.length === 0) return null;
          return (
            <GlassCard padding={spacing[4]}>
              <View style={styles.cardRow}><Activity size={13} color={colors.text.muted} /><Text style={styles.cardLabel}>Z ZEGARKA</Text></View>
              <View style={styles.hcGrid}>
                {cards.map(c => (
                  <View key={c.k} style={styles.hcTile}>
                    <c.Icon size={15} color={c.color} />
                    <Text style={styles.hcVal}>{hcExtra[c.k]}{c.unit ? <Text style={styles.hcUnit}> {c.unit}</Text> : null}</Text>
                    <Text style={styles.hcLabel}>{c.label}</Text>
                  </View>
                ))}
              </View>
            </GlassCard>
          );
        })()}

        {/* Weekly steps chart */}
        <GlassCard padding={spacing[4]} style={styles.tealCard}>
          <View style={styles.cardRow}>
            <Activity size={13} color={colors.text.muted} />
            <Text style={styles.cardLabel}>TEN TYDZIEŃ — KROKI</Text>
          </View>
          <View style={styles.chartRow}>
            {weekSteps.map((s, i) => {
              const barH = s > 0 ? Math.max(8, (s / maxBar) * 80) : 4;
              const isToday = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
              const goalMet = s >= stepGoal;
              return (
                <View key={i} style={styles.chartCol}>
                  <View style={styles.chartBarWrap}>
                    <View style={[styles.chartBar, {
                      height: barH,
                      backgroundColor: s === 0
                        ? 'rgba(255,255,255,0.07)'
                        : goalMet ? T.accent : T.muted,
                      width: isToday ? 14 : 9,
                      opacity: s === 0 ? 0.4 : 1,
                    }]} />
                  </View>
                  <Text style={[styles.chartDay, isToday && styles.chartDayToday]}>{WEEK_DAYS[i]}</Text>
                  {s > 0 && <Text style={styles.chartNum}>{(s / 1000).toFixed(1)}k</Text>}
                </View>
              );
            })}
          </View>
        </GlassCard>

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
                      return (
                        <View key={p.date} style={[styles.monthBar, {
                          height: h,
                          flex: stepsRange === 7 ? 0 : 1,
                          width: stepsRange === 7 ? 28 : undefined,
                          backgroundColor: p.steps === 0 ? colors.border.subtle : goalMet ? T.accent : T.muted,
                          opacity: p.steps === 0 ? 0.5 : (i === data.length - 1 ? 1 : 0.85),
                        }]} />
                      );
                    })}
                  </View>
                  {stepsRange === 7 && (
                    <View style={styles.weekDayRow}>
                      {data.map(p => (
                        <Text key={p.date} style={styles.weekDayLabel}>{DOW[new Date(p.date + 'T00:00:00').getDay()]}</Text>
                      ))}
                    </View>
                  )}
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
                      <Text style={styles.analysisVal}>{Math.floor(healthStats.avgSleep7 / 60)}h {pad(healthStats.avgSleep7 % 60)}m</Text>
                      <Text style={styles.analysisLabel}>śr. sen · 7 dni</Text>
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

        {/* Water */}
        <GlassCard padding={spacing[4]} style={styles.tealCard}>
          <View style={styles.cardRow}>
            <Droplets size={13} color={colors.text.muted} />
            <Text style={styles.cardLabel}>NAWODNIENIE</Text>
            <Text style={styles.waterCount}>{water}/{waterGoal} szklanek</Text>
          </View>
          <View style={styles.glassRow}>
            {Array.from({ length: waterGoal }, (_, i) => (
              <TouchableOpacity
                key={i}
                onPress={() => updateWater(i < water ? i : i + 1)}
                style={[styles.glass, i < water && styles.glassFilled]}
              >
                <Droplets
                  size={14}
                  color={i < water ? T.accent : colors.text.muted}
                  strokeWidth={i < water ? 2.5 : 1.5}
                />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${(water / waterGoal) * 100}%`,
              backgroundColor: water >= waterGoal ? T.accent : T.muted,
            }]} />
          </View>
          <View style={styles.waterCtrl}>
            <PressableScale onPress={() => updateWater(water - 1)} style={styles.ctrlBtn}>
              <Minus size={15} color={colors.text.secondary} />
            </PressableScale>
            <Text style={styles.waterNum}>
              {water} <Text style={styles.waterSub}>z {waterGoal}</Text>
            </Text>
            <PressableScale onPress={() => updateWater(water + 1)} style={styles.ctrlBtn}>
              <Plus size={15} color={colors.text.secondary} />
            </PressableScale>
          </View>

          {/* 7-day water chart */}
          <View style={[styles.cardRow, { marginTop: spacing[2] }]}>
            <Text style={[styles.cardLabel, { color: colors.text.muted }]}>TYDZIEŃ</Text>
          </View>
          <View style={styles.sleepChartRow}>
            {weekWater.map((w, i) => {
              const barH = w > 0 ? Math.max(5, Math.min(48, (w / waterGoal) * 48)) : 3;
              const isToday = i === (new Date().getDay() === 0 ? 6 : new Date().getDay() - 1);
              const goalMet = w >= waterGoal;
              return (
                <View key={i} style={styles.sleepChartCol}>
                  <View style={styles.sleepBarWrap}>
                    <View style={[styles.sleepBar, {
                      height: barH,
                      backgroundColor: w === 0 ? 'rgba(255,255,255,0.08)' : goalMet ? T.accent : T.muted,
                      opacity: w === 0 ? 0.35 : 1,
                      width: isToday ? 12 : 8,
                    }]} />
                  </View>
                  <Text style={[styles.chartDay, isToday && styles.chartDayToday]}>{WEEK_DAYS[i]}</Text>
                  {w > 0 && <Text style={styles.sleepBarLabel}>{w}</Text>}
                </View>
              );
            })}
          </View>
        </GlassCard>

        {/* Weight */}
        <GlassCard padding={spacing[4]} style={styles.tealCard}>
          <View style={styles.cardRow}>
            <Activity size={13} color={colors.text.muted} />
            <Text style={styles.cardLabel}>MASA CIAŁA</Text>
            {loggedWeights.length > 1 && (
              <View style={{ marginLeft: 'auto', flexDirection: 'row', alignItems: 'center', gap: 4 }}>
                <Text style={{ fontSize: 10, color: (maxW - minW) > 0.5 ? colors.accent.amber : colors.accent.green, fontWeight: '600' }}>
                  Δ {(maxW - minW).toFixed(1)} kg
                </Text>
              </View>
            )}
          </View>

          <View style={styles.weightRow}>
            <PressableScale onPress={() => { haptic.tap(); setWeight(w => Math.max(0, parseFloat((w - 1).toFixed(1)))); }} style={styles.weightBtn}>
              <Minus size={13} color={colors.text.muted} />
            </PressableScale>
            <PressableScale onPress={() => { haptic.tap(); setWeight(w => Math.max(0, parseFloat((w - 0.1).toFixed(1)))); }} style={styles.weightBtnSm}>
              <Text style={styles.weightBtnSmText}>-0.1</Text>
            </PressableScale>
            <TouchableOpacity
              style={styles.weightCenter}
              onPress={() => { setWeightInput(weight > 0 ? weight.toFixed(1) : ''); setWeightModal(true); }}
              activeOpacity={0.7}
            >
              <Text style={styles.weightNum}>
                {weight > 0 ? weight.toFixed(1) : '—'}
              </Text>
              <Text style={styles.weightUnit}>{weight > 0 ? 'kg · dotknij' : 'kg · ustaw'}</Text>
            </TouchableOpacity>
            <PressableScale onPress={() => { haptic.tap(); setWeight(w => parseFloat((w + 0.1).toFixed(1))); }} style={styles.weightBtnSm}>
              <Text style={styles.weightBtnSmText}>+0.1</Text>
            </PressableScale>
            <PressableScale onPress={() => { haptic.tap(); setWeight(w => parseFloat((w + 1).toFixed(1))); }} style={styles.weightBtn}>
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
                        backgroundColor: w > 0 ? T.accent : 'rgba(255,255,255,0.07)',
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
  hcGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], marginTop: spacing[2] },
  hcTile: {
    width: '31%', flexGrow: 1, gap: 3, paddingVertical: spacing[2], paddingHorizontal: spacing[2],
    borderRadius: radius.md, backgroundColor: 'rgba(255,255,255,0.04)', borderWidth: 1, borderColor: 'rgba(255,255,255,0.06)',
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

  progressTrack: { height: 8, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: '100%', borderRadius: radius.full },

  stepControls: { flexDirection: 'row', gap: spacing[1] },
  stepBtn: {
    width: 26, height: 26, borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },

  // Sleep
  sleepDurRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  sleepBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  sleepDurCenter: { flex: 1, alignItems: 'center', gap: 2 },
  sleepDurNum: { fontSize: 32, fontWeight: '900', color: c.text.primary, letterSpacing: -1 },
  sleepDurUnit: { fontSize: 13, fontWeight: '400', color: c.text.muted },
  sleepDurSub: { fontSize: 11, color: c.text.muted, fontWeight: '500' },

  minuteRow: { flexDirection: 'row', gap: spacing[2] },
  minutePill: {
    flex: 1, paddingVertical: 6, borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  minutePillActive: {
    backgroundColor: t.accentDim,
    borderColor: t.cardBorder,
  },
  minuteText: { fontSize: 12, color: c.text.muted, fontWeight: '500' },
  minuteTextActive: { color: t.accent, fontWeight: '700' },

  microBar: { height: 5, backgroundColor: 'rgba(255,255,255,0.06)', borderRadius: radius.full, overflow: 'hidden' },
  microFill: { height: '100%', borderRadius: radius.full },

  qualityBadge: {
    marginLeft: 'auto', paddingHorizontal: 8, paddingVertical: 3,
    borderRadius: radius.full, borderWidth: 1,
  },
  qualityBadgeText: { fontSize: 10, fontWeight: '700' },

  qualityRow: { flexDirection: 'row', gap: spacing[2] },
  qualityPill: {
    flex: 1, paddingVertical: 7, borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
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
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
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
  weekDayRow: { flexDirection: 'row', justifyContent: 'space-between', marginTop: 4, paddingHorizontal: 2 },
  weekDayLabel: { flex: 1, fontSize: 8, fontWeight: '600', color: c.text.muted, textAlign: 'center' },
  sleepInsight: { marginTop: spacing[3], paddingTop: spacing[2], borderTopWidth: 1, borderTopColor: c.border.subtle, gap: 2 },
  sleepInsightMain: { fontSize: 12, fontWeight: '700', color: c.text.primary },
  sleepInsightSub: { fontSize: 10.5, color: c.text.muted },
  monthChartRow: {
    flexDirection: 'row', alignItems: 'flex-end', justifyContent: 'space-between',
    height: 64, marginTop: spacing[3], gap: 1.5,
  },
  monthBar: { flex: 1, borderRadius: 2, minHeight: 2 },
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
  glassRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  glass: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center',
  },
  glassFilled: { backgroundColor: t.accentDim, borderColor: t.cardBorder },
  waterCtrl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[1] },
  ctrlBtn: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  waterNum: { fontSize: 26, fontWeight: '800', color: c.text.primary, letterSpacing: -0.5 },
  waterSub: { fontSize: 12, fontWeight: '400', color: c.text.muted },

  // Weight
  weightRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: spacing[2] },
  weightBtn: {
    width: 36, height: 36, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.08)',
    alignItems: 'center', justifyContent: 'center',
  },
  weightBtnSm: {
    paddingHorizontal: spacing[2], paddingVertical: 7,
    borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
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
  noteDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
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
