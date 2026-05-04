import { useState, useEffect } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, TextInput, Pressable, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { Footprints, Moon, Droplets, Plus, Minus, Activity, Timer } from 'lucide-react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';

import ScreenHeader from '@/components/ui/ScreenHeader';
import PressableScale from '@/components/ui/PressableScale';
import GlassCard from '@/components/ui/GlassCard';
import { useMoodStore } from '@/store/moodStore';
import { usePomodoroStore } from '@/store/pomodoroStore';
import { toast } from '@/store/toastStore';
import { MOOD_COLORS } from '@/types';
import { getHealthGoals } from '@/utils/healthGoals';
import { colors, spacing, radius, typography } from '@/theme';

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

export default function HealthScreen() {
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
  const [weekSteps, setWeekSteps]       = useState<number[]>(Array(7).fill(0));
  const [weekSleep, setWeekSleep]       = useState<WeekSleep[]>(Array(7).fill({ h: 0, m: 0 }));
  const [weekWeight, setWeekWeight]     = useState<number[]>(Array(7).fill(0));

  const { entries } = useMoodStore();
  const pomodoroStore = usePomodoroStore();
  const recentMood = entries.slice(0, 7).reverse();

  const maxBar = Math.max(...weekSteps, 1);
  const stepPct = Math.min(1, steps / stepGoal);
  const sleepSecs = sleepH * 3600 + sleepM * 60;
  const sleepPct = Math.min(1, sleepSecs / (9 * 3600));
  const maxSleep = Math.max(...weekSleep.map(s => s.h + s.m / 60), 1);
  const loggedWeights = weekWeight.filter(w => w > 0);
  const minW = loggedWeights.length ? Math.min(...loggedWeights) : 0;
  const maxW = loggedWeights.length ? Math.max(...loggedWeights) : 1;
  const weightRange = maxW - minW || 1;

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
        }

        const today = new Date();
        const todayIdx = today.getDay() === 0 ? 6 : today.getDay() - 1;
        const wSteps  = Array(7).fill(0);
        const wWeight = Array(7).fill(0);
        const wSleep: WeekSleep[] = Array(7).fill(null).map(() => ({ h: 0, m: 0 }));

        for (let i = 0; i <= todayIdx; i++) {
          const d = new Date(today);
          d.setDate(today.getDate() - (todayIdx - i));
          const dayRaw = await AsyncStorage.getItem(dateKey(d));
          if (dayRaw) {
            const parsed = JSON.parse(dayRaw);
            if (parsed.steps != null)  wSteps[i] = parsed.steps;
            if (parsed.weight != null) wWeight[i] = parsed.weight;
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
      } catch {}
      setLoaded(true);
    };
    load();
  }, []);

  useEffect(() => {
    if (!loaded) return;
    AsyncStorage.setItem(todayKey(), JSON.stringify({ water, steps, sleepH, sleepM, sleepQuality, weight })).catch(() => {});
    const todayIdx = new Date().getDay() === 0 ? 6 : new Date().getDay() - 1;
    setWeekSteps(prev => { const n = [...prev]; n[todayIdx] = steps; return n; });
    setWeekWeight(prev => { const n = [...prev]; n[todayIdx] = weight; return n; });
    setWeekSleep(prev => {
      const n = [...prev];
      n[todayIdx] = { h: sleepH, m: sleepM, quality: sleepQuality };
      return n;
    });
  }, [water, steps, sleepH, sleepM, sleepQuality, weight, loaded]);

  const updateWater = (v: number) => {
    const next = Math.max(0, Math.min(waterGoal, v));
    setWater(next);
    if (next === waterGoal) toast.success('Cel nawodnienia osiągnięty!');
  };

  const updateSteps = (delta: number) => setSteps(s => Math.max(0, s + delta));

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      <ScreenHeader title="Zdrowie" subtitle="Dzisiaj" />

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

        {/* Steps hero */}
        <GlassCard padding={spacing[4]} style={styles.card}>
          <View style={styles.cardRow}>
            <Footprints size={13} color={colors.text.muted} />
            <Text style={styles.cardLabel}>KROKI DZISIAJ</Text>
            <View style={{ flex: 1 }} />
            <View style={styles.stepControls}>
              <PressableScale onPress={() => updateSteps(-500)} style={styles.stepBtn}>
                <Minus size={12} color={colors.text.muted} />
              </PressableScale>
              <PressableScale onPress={() => updateSteps(500)} style={styles.stepBtn}>
                <Plus size={12} color={colors.text.muted} />
              </PressableScale>
            </View>
          </View>
          <Text style={[styles.heroNum, {
            color: steps >= stepGoal ? colors.accent.success : colors.text.primary,
          }]}>
            {steps.toLocaleString()}
          </Text>
          <Text style={styles.heroSub}>
            cel {stepGoal.toLocaleString()} · {(steps * 0.00075).toFixed(1)} km · {Math.round(stepPct * 100)}%
          </Text>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${stepPct * 100}%`,
              backgroundColor: steps >= stepGoal ? colors.accent.success : colors.text.primary,
            }]} />
          </View>
        </GlassCard>

        {/* Sleep card */}
        <GlassCard padding={spacing[4]} style={styles.card}>
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

          {/* Duration row */}
          <View style={styles.sleepDurRow}>
            <PressableScale onPress={() => setSleepH(h => Math.max(0, h - 1))} style={styles.sleepBtn}>
              <Minus size={13} color={colors.text.muted} />
            </PressableScale>
            <View style={styles.sleepDurCenter}>
              <Text style={styles.sleepDurNum}>
                {sleepH}<Text style={styles.sleepDurUnit}>h </Text>
                {pad(sleepM)}<Text style={styles.sleepDurUnit}>m</Text>
              </Text>
              <Text style={styles.sleepDurSub}>
                {sleepH < 6 ? 'za mało' : sleepH >= 7 && sleepH <= 9 ? 'optymalny' : sleepH > 9 ? 'dużo' : 'minimalny'}
              </Text>
            </View>
            <PressableScale onPress={() => setSleepH(h => Math.min(14, h + 1))} style={styles.sleepBtn}>
              <Plus size={13} color={colors.text.muted} />
            </PressableScale>
          </View>

          {/* Minutes fine-tune */}
          <View style={styles.minuteRow}>
            {[0, 15, 30, 45].map(m => (
              <PressableScale key={m} onPress={() => setSleepM(m)} style={[
                styles.minutePill,
                sleepM === m && styles.minutePillActive,
              ]}>
                <Text style={[styles.minuteText, sleepM === m && styles.minuteTextActive]}>
                  :{pad(m)}
                </Text>
              </PressableScale>
            ))}
          </View>

          <View style={styles.microBar}>
            <View style={[styles.microFill, {
              width: `${sleepPct * 100}%`,
              backgroundColor: sleepQuality ? QUALITY_COLORS[sleepQuality] : colors.text.secondary,
            }]} />
          </View>

          {/* Quality selector */}
          <View style={styles.qualityRow}>
            {QUALITY_KEYS.map(q => {
              const active = sleepQuality === q;
              const col = QUALITY_COLORS[q];
              return (
                <PressableScale key={q} onPress={() => setSleepQuality(active ? undefined : q)} style={[
                  styles.qualityPill,
                  active && { backgroundColor: col + '20', borderColor: col + '60' },
                ]}>
                  <Text style={[styles.qualityText, active && { color: col, fontWeight: '700' }]}>
                    {QUALITY_LABELS[q]}
                  </Text>
                </PressableScale>
              );
            })}
          </View>

          {/* 7-day sleep chart */}
          <View style={[styles.cardRow, { marginTop: spacing[3] }]}>
            <Text style={[styles.cardLabel, { color: 'rgba(255,255,255,0.25)' }]}>TYDZIEŃ</Text>
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
        </GlassCard>

        {/* Pomodoro */}
        <GlassCard padding={spacing[4]} style={styles.pomRow}>
          <View style={styles.pomLeft}>
            <Timer size={13} color={colors.text.muted} />
            <Text style={styles.cardLabel}>POMODORO DZISIAJ</Text>
          </View>
          <Text style={styles.pomNum}>
            {pomodoroStore.completedRounds}
            <Text style={styles.pomUnit}> sesji</Text>
          </Text>
          <PressableScale onPress={() => router.push('/pomodoro' as any)} style={styles.pomCta}>
            <Text style={styles.pomCtaText}>{pomodoroStore.isRunning ? 'Trwa...' : 'Start'}</Text>
          </PressableScale>
        </GlassCard>

        {/* Weekly steps chart */}
        <GlassCard padding={spacing[4]} style={styles.card}>
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
                        : goalMet ? colors.accent.success : colors.text.primary,
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

        {/* Water */}
        <GlassCard padding={spacing[4]} style={styles.card}>
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
                  color={i < water ? colors.accent.success : colors.text.muted}
                  strokeWidth={i < water ? 2.5 : 1.5}
                />
              </TouchableOpacity>
            ))}
          </View>
          <View style={styles.progressTrack}>
            <View style={[styles.progressFill, {
              width: `${(water / waterGoal) * 100}%`,
              backgroundColor: water >= waterGoal ? colors.accent.success : colors.text.primary,
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
        </GlassCard>

        {/* Weight */}
        <GlassCard padding={spacing[4]} style={styles.card}>
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
            <PressableScale onPress={() => setWeight(w => Math.max(0, parseFloat((w - 1).toFixed(1))))} style={styles.weightBtn}>
              <Minus size={13} color={colors.text.muted} />
            </PressableScale>
            <PressableScale onPress={() => setWeight(w => Math.max(0, parseFloat((w - 0.1).toFixed(1))))} style={styles.weightBtnSm}>
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
            <PressableScale onPress={() => setWeight(w => parseFloat((w + 0.1).toFixed(1)))} style={styles.weightBtnSm}>
              <Text style={styles.weightBtnSmText}>+0.1</Text>
            </PressableScale>
            <PressableScale onPress={() => setWeight(w => parseFloat((w + 1).toFixed(1)))} style={styles.weightBtn}>
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
                        backgroundColor: w > 0 ? colors.text.primary : 'rgba(255,255,255,0.07)',
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
          <GlassCard padding={spacing[4]} style={styles.card}>
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
        <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : 'height'} style={{ flex: 1 }}>
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

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg.primary },
  scroll: { padding: spacing[4], gap: spacing[3], paddingBottom: spacing[10] },

  card: { gap: spacing[3] },
  cardRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  cardLabel: { fontSize: 10, fontWeight: '600', color: colors.text.muted, letterSpacing: 1.2 },

  heroNum: { fontSize: 44, fontWeight: '900', letterSpacing: -2, lineHeight: 48 },
  heroSub: { ...typography.caption, color: colors.text.muted },

  progressTrack: { height: 3, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full, overflow: 'hidden' },
  progressFill: { height: 3, borderRadius: radius.full },

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
  sleepDurNum: { fontSize: 32, fontWeight: '900', color: colors.text.primary, letterSpacing: -1 },
  sleepDurUnit: { fontSize: 13, fontWeight: '400', color: colors.text.muted },
  sleepDurSub: { fontSize: 11, color: colors.text.muted, fontWeight: '500' },

  minuteRow: { flexDirection: 'row', gap: spacing[2] },
  minutePill: {
    flex: 1, paddingVertical: 6, borderRadius: radius.sm,
    backgroundColor: 'rgba(255,255,255,0.04)',
    borderWidth: 1, borderColor: 'rgba(255,255,255,0.07)',
    alignItems: 'center',
  },
  minutePillActive: {
    backgroundColor: 'rgba(255,255,255,0.12)',
    borderColor: 'rgba(255,255,255,0.2)',
  },
  minuteText: { fontSize: 12, color: colors.text.muted, fontWeight: '500' },
  minuteTextActive: { color: colors.text.primary, fontWeight: '700' },

  microBar: { height: 2, backgroundColor: 'rgba(255,255,255,0.07)', borderRadius: radius.full, overflow: 'hidden' },
  microFill: { height: 2, borderRadius: radius.full },

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
  qualityText: { fontSize: 10, color: colors.text.muted, fontWeight: '600' },

  sleepChartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[1] },
  sleepChartCol: { flex: 1, alignItems: 'center', gap: 3 },
  sleepBarWrap: { height: 60, justifyContent: 'flex-end', alignItems: 'center' },
  sleepBar: { borderRadius: 3, minHeight: 3 },
  sleepBarLabel: { fontSize: 8, color: colors.text.muted },

  // Pomodoro row
  pomRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  pomLeft: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], flex: 1 },
  pomNum: { fontSize: 22, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  pomUnit: { fontSize: 11, fontWeight: '400', color: colors.text.muted },
  pomCta: {
    paddingHorizontal: spacing[4], paddingVertical: 8,
    backgroundColor: 'rgba(255,255,255,0.06)',
    borderRadius: radius.sm, borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)',
  },
  pomCtaText: { fontSize: 12, fontWeight: '600', color: colors.text.secondary },

  chartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[1] },
  chartCol: { flex: 1, alignItems: 'center', gap: 4 },
  chartBarWrap: { height: 84, justifyContent: 'flex-end', alignItems: 'center' },
  chartBar: { borderRadius: 3, minHeight: 4 },
  chartDay: { ...typography.caption, color: colors.text.muted, fontSize: 9 },
  chartDayToday: { color: colors.text.primary, fontWeight: '700' },
  chartNum: { ...typography.caption, color: colors.text.muted, fontSize: 8 },

  waterCount: { ...typography.label, color: colors.text.secondary, fontWeight: '600', marginLeft: 'auto', fontSize: 10 },
  glassRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  glass: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.03)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.07)', alignItems: 'center', justifyContent: 'center',
  },
  glassFilled: { backgroundColor: colors.accent.success + '15', borderColor: colors.accent.success + '40' },
  waterCtrl: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[1] },
  ctrlBtn: {
    width: 42, height: 42, borderRadius: radius.md,
    backgroundColor: 'rgba(255,255,255,0.05)', borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.08)', alignItems: 'center', justifyContent: 'center',
  },
  waterNum: { fontSize: 26, fontWeight: '800', color: colors.text.primary, letterSpacing: -0.5 },
  waterSub: { fontSize: 12, fontWeight: '400', color: colors.text.muted },

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
  weightBtnSmText: { fontSize: 10, color: colors.text.muted, fontWeight: '600' },
  weightCenter: { flex: 1, alignItems: 'center', gap: 1 },
  weightNum: { fontSize: 36, fontWeight: '900', color: colors.text.primary, letterSpacing: -1 },
  weightUnit: { fontSize: 11, color: colors.text.muted, fontWeight: '500', marginTop: -2 },
  weightChartRow: { flexDirection: 'row', alignItems: 'flex-end', gap: spacing[1] },
  weightChartCol: { flex: 1, alignItems: 'center', gap: 3 },
  weightBarWrap: { height: 60, justifyContent: 'flex-end', alignItems: 'center' },
  weightBar: { borderRadius: 3, minHeight: 3 },
  weightBarLabel: { fontSize: 7, color: colors.text.muted },

  moodRow: { flexDirection: 'row', gap: spacing[3], alignItems: 'flex-end' },
  moodCol: { flex: 1, alignItems: 'center', gap: 4 },
  moodBar: { width: 10, borderRadius: 5, minHeight: 8 },
  moodNum: { ...typography.caption, fontWeight: '800', fontSize: 11 },
  moodDate: { ...typography.caption, color: colors.text.muted, fontSize: 9 },

  note: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: spacing[2], paddingVertical: spacing[2] },
  noteDot: { width: 4, height: 4, borderRadius: 2, backgroundColor: 'rgba(255,255,255,0.15)' },
  noteText: { ...typography.caption, color: colors.text.muted },
});

const wm = StyleSheet.create({
  overlay: {
    position: 'absolute', top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(0,0,0,0.65)',
  },
  sheet: {
    position: 'absolute', bottom: 0, left: 0, right: 0,
    backgroundColor: colors.bg.secondary,
    borderTopLeftRadius: 28, borderTopRightRadius: 28,
    padding: spacing[6], paddingBottom: spacing[10],
    borderWidth: 1, borderBottomWidth: 0, borderColor: colors.border.default,
    alignItems: 'center', gap: spacing[3],
  },
  title: { fontSize: 17, fontWeight: '800', color: colors.text.primary, alignSelf: 'flex-start' },
  input: {
    width: '100%', fontSize: 42, fontWeight: '900', color: colors.text.primary,
    textAlign: 'center', letterSpacing: -1,
    paddingVertical: spacing[3],
    borderBottomWidth: 2, borderBottomColor: colors.accent.purple + '60',
  },
  unit: { fontSize: 13, color: colors.text.muted, fontWeight: '600', alignSelf: 'flex-end', marginTop: -spacing[2] },
  saveBtn: {
    width: '100%', paddingVertical: spacing[4],
    backgroundColor: colors.accent.purple + '25',
    borderRadius: radius.lg, borderWidth: 1, borderColor: colors.accent.purple + '50',
    alignItems: 'center',
  },
  saveBtnText: { fontSize: 16, fontWeight: '700', color: colors.accent.purple },
});
