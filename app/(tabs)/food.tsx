import { useMemo, useState, useCallback } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flame, UtensilsCrossed, Trash2, Target, Plus, Minus, Droplets, Scale } from 'lucide-react-native';

import { useFoodStore, MEAL_TYPES, mealTypeLabel, targetIntake, GoalMode, MealEntry, MealType } from '@/store/foodStore';
import { dailyBurnFromHc, getHealthHistory } from '@/utils/healthHistory';
import { getHealthGoals } from '@/utils/healthGoals';
import { useWaterTracker } from '@/hooks/useWaterTracker';
import { spacing, radius, colors } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

const ACCENT = '#F59E0B';
const todayStr = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

const GOALS: { id: GoalMode; label: string }[] = [
  { id: 'cut',      label: 'Redukcja' },
  { id: 'maintain', label: 'Utrzymanie' },
  { id: 'bulk',     label: 'Masa' },
];

function mealSummary(m: MealEntry): string {
  const names = m.items.map(i => (i.qty > 1 ? `${i.name} ×${i.qty}` : i.name));
  if (names.length === 0) return mealTypeLabel(m.type);
  if (names.length <= 2) return names.join(', ');
  return `${names.slice(0, 2).join(', ')} +${names.length - 2}`;
}

export default function Food() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const insets = useSafeAreaInsets();

  const meals      = useFoodStore(st => st.meals);
  const goalMode   = useFoodStore(st => st.goalMode);
  const manualGoal = useFoodStore(st => st.manualGoal);
  const setGoal    = useFoodStore(st => st.setGoal);
  const removeMeal = useFoodStore(st => st.removeMeal);

  const [burn, setBurn] = useState(0);
  const today = todayStr();

  const todayMeals = useMemo(
    () => meals.filter(m => m.date === today).sort((a, b) => a.ts - b.ts),
    [meals, today],
  );
  const eaten = useMemo(() => todayMeals.reduce((sum, m) => sum + m.kcal, 0), [todayMeals]);

  // Burn comes from the watch cache the Zdrowie screen / autoSync write.
  useFocusEffect(useCallback(() => {
    let active = true;
    AsyncStorage.getItem(`health_${today}`).then(raw => {
      if (!active || !raw) return;
      try { setBurn(dailyBurnFromHc(JSON.parse(raw).hc)); } catch {}
    });
    return () => { active = false; };
  }, [today]));

  // ── Woda — single source = the "Woda" habit (shared with Zdrowie/Nawyki/pet) ──
  const water = useWaterTracker();

  // ── Waga — READ-ONLY here for now (edycja w Zdrowiu). Krok B przeniesie edycję i
  // usunie ją ze Zdrowia, żeby był JEDEN zapisujący (blob health_YYYY-MM-DD + goals).
  const [weightKg, setWeightKg]         = useState(0);   // today / last known
  const [weightGoal, setWeightGoal]     = useState(0);
  const [weightSeries, setWeightSeries] = useState<{ d: string; w: number }[]>([]);

  const loadBody = useCallback(async () => {
    const [hist, goals] = await Promise.all([getHealthHistory(30), getHealthGoals()]);
    setWeightGoal(goals.weightGoal);
    const series: { d: string; w: number }[] = [];
    for (const d of Object.keys(hist).sort()) { const w = hist[d].weight; if (w > 0) series.push({ d, w }); }
    let last = series.length ? series[series.length - 1].w : 0;
    if (!(last > 0)) { const s = await AsyncStorage.getItem('health_last_weight'); const v = s ? parseFloat(s) : 0; if (v > 0) last = v; }
    setWeightKg(last); setWeightSeries(series);
  }, []);
  useFocusEffect(useCallback(() => { loadBody(); }, [loadBody]));

  // simple ETA to weight goal from the logged trend over the window
  const weightEta = useMemo(() => {
    if (!(weightGoal > 0) || weightSeries.length < 2 || !(weightKg > 0)) return null;
    const first = weightSeries[0], last = weightSeries[weightSeries.length - 1];
    const days = (new Date(last.d).getTime() - new Date(first.d).getTime()) / 864e5;
    if (days < 3) return null;
    const perWeek = (last.w - first.w) / days * 7;                 // kg/week (signed)
    const remaining = weightKg - weightGoal;                       // >0 = need to lose
    if (Math.abs(perWeek) < 0.05) return null;
    if (Math.sign(perWeek) === Math.sign(remaining)) return null;  // trending away from goal
    const weeks = Math.abs(remaining / perWeek);
    if (weeks > 104) return null;
    const eta = new Date(Date.now() + weeks * 7 * 864e5);
    return `~${eta.toLocaleDateString('pl-PL', { month: 'short', year: 'numeric' })}`;
  }, [weightGoal, weightSeries, weightKg]);

  const target    = targetIntake(burn, goalMode, manualGoal);
  const remaining = target - eaten;
  const pct       = target > 0 ? Math.min(1, eaten / target) : 0;
  const ratio     = target > 0 ? eaten / target : 0;
  const ringColor = ratio > 1 ? colors.accent.red : ratio >= 0.85 ? colors.accent.amber : colors.accent.green;

  // ring geometry
  const R = 64, SW = 14, CIRC = 2 * Math.PI * R, SIZE = (R + SW) * 2;

  const byType = useMemo(() => {
    const map: Record<MealType, MealEntry[]> = { sniadanie: [], obiad: [], kolacja: [], przekaska: [] };
    for (const m of todayMeals) map[m.type].push(m);
    return map;
  }, [todayMeals]);

  return (
    <SafeAreaView style={s.container} edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingTop: insets.top + 50 }]}>

        {/* ── Kalorie: eaten vs target ring ─────────────────────────── */}
        <View style={[s.card, s.heroCard]}>
          <View style={s.ringWrap}>
            <Svg width={SIZE} height={SIZE}>
              <Circle cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={c.fill.subtle} strokeWidth={SW} fill="none" />
              <Circle
                cx={SIZE / 2} cy={SIZE / 2} r={R} stroke={ringColor} strokeWidth={SW} fill="none"
                strokeDasharray={CIRC} strokeDashoffset={CIRC * (1 - pct)} strokeLinecap="round"
                transform={`rotate(-90 ${SIZE / 2} ${SIZE / 2})`}
              />
            </Svg>
            <View style={s.ringCenter} pointerEvents="none">
              <Text style={s.ringEaten}>{eaten.toLocaleString('pl-PL')}</Text>
              <Text style={s.ringOf}>z {target.toLocaleString('pl-PL')} kcal</Text>
            </View>
          </View>

          <View style={s.heroStats}>
            <View style={s.heroStat}>
              <Text style={[s.heroStatVal, { color: remaining >= 0 ? colors.accent.green : colors.accent.red }]}>
                {remaining >= 0 ? remaining.toLocaleString('pl-PL') : `+${Math.abs(remaining).toLocaleString('pl-PL')}`}
              </Text>
              <Text style={s.heroStatLabel}>{remaining >= 0 ? 'zostało' : 'ponad cel'}</Text>
            </View>
            <View style={s.heroDivider} />
            <View style={s.heroStat}>
              <View style={s.heroBurnRow}><Flame size={13} color={ACCENT} /><Text style={s.heroStatVal}>{burn > 0 ? burn.toLocaleString('pl-PL') : '—'}</Text></View>
              <Text style={s.heroStatLabel}>spalone</Text>
            </View>
          </View>

          {burn === 0 && (
            <Text style={s.burnHint}>Brak spalania z zegarka — cel liczony od 2200 kcal. Wejdź w Zdrowie i odśwież, by wziąć realne spalanie.</Text>
          )}

          {/* Goal mode */}
          <View style={s.goalRow}>
            <Target size={14} color={c.text.muted} />
            {GOALS.map(g => {
              const on = goalMode === g.id;
              return (
                <TouchableOpacity key={g.id} onPress={() => { haptic.tap(); setGoal(g.id, manualGoal); }}
                  style={[s.goalChip, on && { backgroundColor: ACCENT + '22', borderColor: ACCENT + '77' }]}>
                  <Text style={[s.goalChipTxt, on && { color: ACCENT }]}>{g.label}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        {/* ── Woda + Waga (shared source with Zdrowie) ──────────────── */}
        <View style={s.trackRow}>
          <View style={[s.card, s.trackCard]}>
            <View style={s.trackHead}><Droplets size={15} color="#60A5FA" /><Text style={s.trackTitle}>Woda</Text></View>
            <Text style={s.trackVal}>{water.glasses}<Text style={s.trackUnit}> / {water.goal} szkl.</Text></Text>
            <View style={s.trackBtns}>
              <TouchableOpacity style={s.trackBtn} onPress={() => water.change(-1)} disabled={water.glasses <= 0}><Minus size={16} color={water.glasses <= 0 ? c.text.muted : c.text.primary} /></TouchableOpacity>
              <TouchableOpacity style={[s.trackBtn, { backgroundColor: '#60A5FA', borderColor: '#60A5FA' }]} onPress={() => water.change(1)}><Plus size={16} color="#fff" /></TouchableOpacity>
            </View>
          </View>

          <TouchableOpacity style={[s.card, s.trackCard]} activeOpacity={0.85} onPress={() => { haptic.tap(); router.navigate('/health' as any); }}>
            <View style={s.trackHead}><Scale size={15} color="#A78BFA" /><Text style={s.trackTitle}>Waga</Text></View>
            <Text style={s.trackVal}>{weightKg > 0 ? weightKg.toFixed(1) : '—'}<Text style={s.trackUnit}> kg</Text></Text>
            {weightGoal > 0
              ? <Text style={s.trackGoal} numberOfLines={1}>cel {weightGoal} kg{weightEta ? ` · ${weightEta}` : ''}</Text>
              : <Text style={s.trackGoal} numberOfLines={1}>edytuj w Zdrowiu</Text>}
          </TouchableOpacity>
        </View>

        {/* ── Today's meals ─────────────────────────────────────────── */}
        {todayMeals.length === 0 ? (
          <TouchableOpacity style={[s.card, s.empty]} activeOpacity={0.9} onPress={() => { haptic.tap(); router.push('/food/add' as any); }}>
            <UtensilsCrossed size={30} color={c.text.muted} />
            <Text style={s.emptyTitle}>Nic dziś nie zapisane</Text>
            <Text style={s.emptySub}>Stuknij, żeby dodać co zjadłeś — z bazy, ostatnich albo ręcznie.</Text>
            <View style={[s.emptyBtn, { backgroundColor: ACCENT }]}><Plus size={16} color="#1A1206" /><Text style={s.emptyBtnTxt}>Co zjadłem</Text></View>
          </TouchableOpacity>
        ) : (
          MEAL_TYPES.filter(mt => byType[mt.id].length > 0).map(mt => {
            const entries = byType[mt.id];
            const sub = entries.reduce((sum, m) => sum + m.kcal, 0);
            return (
              <View key={mt.id} style={[s.card, { gap: spacing[2] }]}>
                <View style={s.mealHeader}>
                  <Text style={s.mealTitle}>{mt.label}</Text>
                  <Text style={s.mealSub}>{sub.toLocaleString('pl-PL')} kcal</Text>
                </View>
                {entries.map(m => (
                  <View key={m.id} style={s.mealRow}>
                    <View style={{ flex: 1 }}>
                      <Text style={s.mealName} numberOfLines={1}>{mealSummary(m)}</Text>
                      {m.note ? <Text style={s.mealNote} numberOfLines={1}>{m.note}</Text> : null}
                    </View>
                    <Text style={s.mealKcal}>{m.kcal.toLocaleString('pl-PL')}</Text>
                    <TouchableOpacity hitSlop={8} onPress={() => { haptic.tap(); removeMeal(m.id); }}>
                      <Trash2 size={15} color={c.text.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })
        )}

        {todayMeals.length > 0 && (
          <TouchableOpacity style={[s.addMore, { borderColor: ACCENT + '55' }]} activeOpacity={0.85}
            onPress={() => { haptic.tap(); router.push('/food/add' as any); }}>
            <Plus size={16} color={ACCENT} /><Text style={[s.addMoreTxt, { color: ACCENT }]}>Dodaj kolejny posiłek</Text>
          </TouchableOpacity>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  scroll:    { padding: spacing[4], gap: spacing[3], paddingBottom: 180 },

  card: { backgroundColor: c.bg.card, borderRadius: radius.xl, padding: spacing[4], borderWidth: 1, borderColor: c.border.subtle },

  heroCard:   { alignItems: 'center', gap: spacing[3] },
  ringWrap:   { alignItems: 'center', justifyContent: 'center' },
  ringCenter: { position: 'absolute', alignItems: 'center' },
  ringEaten:  { fontSize: 34, fontWeight: '800', color: c.text.primary, letterSpacing: -1 },
  ringOf:     { fontSize: 12, fontWeight: '600', color: c.text.muted, marginTop: 1 },

  heroStats:   { flexDirection: 'row', alignItems: 'center', gap: spacing[4] },
  heroStat:    { alignItems: 'center', gap: 2, minWidth: 72 },
  heroBurnRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  heroStatVal: { fontSize: 20, fontWeight: '800', color: c.text.primary },
  heroStatLabel: { fontSize: 11, fontWeight: '600', color: c.text.muted, textTransform: 'uppercase', letterSpacing: 0.4 },
  heroDivider: { width: 1, height: 30, backgroundColor: c.border.subtle },

  burnHint: { fontSize: 11, color: c.text.muted, textAlign: 'center', lineHeight: 15 },

  goalRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 2 },
  goalChip:    { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  goalChipTxt: { fontSize: 12, fontWeight: '700', color: c.text.secondary },

  trackRow:   { flexDirection: 'row', gap: spacing[3] },
  trackCard:  { flex: 1, gap: spacing[2] },
  trackHead:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackTitle: { fontSize: 12.5, fontWeight: '800', color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  trackVal:   { fontSize: 26, fontWeight: '800', color: c.text.primary, letterSpacing: -0.5 },
  trackUnit:  { fontSize: 12, fontWeight: '600', color: c.text.muted },
  trackBtns:  { flexDirection: 'row', gap: spacing[2] },
  trackBtn:   { flex: 1, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  trackGoal:  { fontSize: 11.5, fontWeight: '700', color: c.text.muted, marginTop: 1 },

  empty:      { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[5] },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  emptySub:   { fontSize: 12.5, color: c.text.muted, textAlign: 'center', lineHeight: 17, paddingHorizontal: spacing[3] },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[4], paddingVertical: 10, borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnTxt: { fontSize: 13, fontWeight: '800', color: '#1A1206' },

  mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealTitle:  { fontSize: 14, fontWeight: '800', color: c.text.primary },
  mealSub:    { fontSize: 12, fontWeight: '700', color: c.text.secondary },
  mealRow:    { flexDirection: 'row', alignItems: 'center', gap: spacing[3], paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.border.subtle },
  mealName:   { fontSize: 13.5, fontWeight: '600', color: c.text.primary },
  mealNote:   { fontSize: 11, color: c.text.muted, marginTop: 1 },
  mealKcal:   { fontSize: 13, fontWeight: '800', color: c.text.secondary, fontVariant: ['tabular-nums'] },

  addMore:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: radius.xl, borderWidth: 1.5, borderStyle: 'dashed' },
  addMoreTxt: { fontSize: 13, fontWeight: '800' },
}));
