import { useMemo, useState, useCallback, useRef } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, TextInput, Modal, KeyboardAvoidingView, Platform } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { useFocusEffect, router } from 'expo-router';
import Svg, { Circle } from 'react-native-svg';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Flame, UtensilsCrossed, Trash2, Target, Plus, Minus, Droplets, Scale, Settings, Check, ChevronLeft, ChevronRight, Calendar as CalendarIcon, Pencil } from 'lucide-react-native';

import { useFoodStore, MEAL_TYPES, mealTypeLabel, targetIntake, GoalMode, MealEntry, MealType } from '@/store/foodStore';
import { getHealthHistory, saveTodayWeight } from '@/utils/healthHistory';
import { getHealthGoals, saveHealthGoals, bmrMifflin } from '@/utils/healthGoals';
import { useWaterTracker } from '@/hooks/useWaterTracker';
import DatePickerField from '@/components/ui/DatePickerField';
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

  const [burnByDay, setBurnByDay] = useState<Record<string, number>>({});  // date → kcal burned (watch)
  const [activeToday, setActiveToday] = useState(0);   // ruch (spalone w ruchu, z zegarka)
  const [watchBmr, setWatchBmr] = useState(0);         // BMR z zegarka (fallback)
  const [profile, setProfile] = useState<{ heightCm: number; ageYears: number; sex: 'm' | 'f' | '' }>({ heightCm: 0, ageYears: 0, sex: '' });
  const [profileModal, setProfileModal] = useState(false);
  const [pfH, setPfH] = useState(''); const [pfA, setPfA] = useState(''); const [pfSex, setPfSex] = useState<'m' | 'f' | ''>('');
  const today = todayStr();
  const [viewDate, setViewDate] = useState(today);   // browsed day (default today)
  const [dateModal, setDateModal] = useState(false);
  const isToday = viewDate === today;
  const shiftDay = (delta: number) => {
    const [y, m, d] = viewDate.split('-').map(Number);
    const nd = new Date(y, m - 1, d + delta);
    const key = `${nd.getFullYear()}-${String(nd.getMonth() + 1).padStart(2, '0')}-${String(nd.getDate()).padStart(2, '0')}`;
    if (key > today) return;   // no future
    haptic.tap(); setViewDate(key);
  };

  const dayMeals = useMemo(
    () => meals.filter(m => m.date === viewDate).sort((a, b) => a.ts - b.ts),
    [meals, viewDate],
  );
  const eaten = useMemo(() => dayMeals.reduce((sum, m) => sum + m.kcal, 0), [dayMeals]);
  const macrosToday = useMemo(() => {
    let protein = 0, carbs = 0, fat = 0;
    for (const m of dayMeals) for (const it of m.items) { protein += it.protein || 0; carbs += it.carbs || 0; fat += it.fat || 0; }
    return { protein: Math.round(protein), carbs: Math.round(carbs), fat: Math.round(fat), any: protein + carbs + fat > 0 };
  }, [dayMeals]);

  // ── Woda — single source = the "Woda" habit (shared with Zdrowie/Nawyki/pet) ──
  const water = useWaterTracker();

  // ── Waga — EDYTOWALNA tutaj (Krok B). Jedyny zapisujący = saveTodayWeight (blob
  // health_YYYY-MM-DD + health_last_weight); Zdrowie już nie zapisuje wagi.
  const [weightKg, setWeightKg]         = useState(0);   // today / last known
  const [weightGoal, setWeightGoal]     = useState(0);
  const [weightSeries, setWeightSeries] = useState<{ d: string; w: number }[]>([]);
  const weightRef   = useRef(0);
  const weightTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const [wModal, setWModal] = useState<null | 'set' | 'goal'>(null);
  const [wInput, setWInput] = useState('');
  const nudgeWeight = (delta: number) => {
    const base = weightRef.current > 0 ? weightRef.current : (weightKg > 0 ? weightKg : 0);
    if (base <= 0) { setWInput(''); setWModal('set'); return; }
    const next = Math.max(0, +(base + delta).toFixed(1));
    weightRef.current = next; setWeightKg(next); haptic.medium();
    if (weightTimer.current) clearTimeout(weightTimer.current);
    weightTimer.current = setTimeout(() => { saveTodayWeight(next).catch(() => {}); }, 400);
  };
  const commitWeightModal = () => {
    const v = parseFloat(wInput.replace(',', '.'));
    if (!(v > 0)) return;
    if (wModal === 'goal') { setWeightGoal(v); saveHealthGoals({ weightGoal: v }).catch(() => {}); }
    else { weightRef.current = v; setWeightKg(v); saveTodayWeight(v).catch(() => {}); }
    setWModal(null); setWInput('');
  };

  const loadBody = useCallback(async () => {
    const [hist, goals] = await Promise.all([getHealthHistory(30), getHealthGoals()]);
    setWeightGoal(goals.weightGoal);
    setProfile({ heightCm: goals.heightCm, ageYears: goals.ageYears, sex: goals.sex });
    const series: { d: string; w: number }[] = [];
    const bbd: Record<string, number> = {};
    for (const d of Object.keys(hist).sort()) { const w = hist[d].weight; if (w > 0) series.push({ d, w }); bbd[d] = hist[d].burn; }
    let last = series.length ? series[series.length - 1].w : 0;
    if (!(last > 0)) { const s = await AsyncStorage.getItem('health_last_weight'); const v = s ? parseFloat(s) : 0; if (v > 0) last = v; }
    weightRef.current = last; setWeightKg(last); setWeightSeries(series); setBurnByDay(bbd);
    // today's watch active + BMR (for the resting+movement breakdown)
    try {
      const raw = await AsyncStorage.getItem(`health_${today}`);
      const hc = raw ? JSON.parse(raw).hc : null;
      setActiveToday(Number(hc?.activeCalories) || 0);
      setWatchBmr(Number(hc?.bmr) || 0);
    } catch {}
  }, [today]);
  useFocusEffect(useCallback(() => {
    loadBody();
    // Pull fresh watch data (steps/sleep/calories) so burn shows even without opening
    // Zdrowie; throttled inside autoSyncHealth. Reload the cache if it wrote anything.
    import('@/services/healthAutoSync').then(({ autoSyncHealth }) => autoSyncHealth(30)).then(n => { if (n > 0) loadBody(); }).catch(() => {});
  }, [loadBody]));

  // Spalanie = spoczynek (BMR z profilu, inaczej z zegarka) + ruch (z zegarka).
  const burnModel = useMemo(() => {
    const bmr = bmrMifflin(weightKg, profile.heightCm, profile.ageYears, profile.sex) || watchBmr || 0;
    const active = activeToday;
    const total = bmr > 0 ? bmr + active : (burnByDay[today] ?? 0);
    return { bmr, active, total, fromProfile: bmrMifflin(weightKg, profile.heightCm, profile.ageYears, profile.sex) > 0 };
  }, [weightKg, profile, activeToday, watchBmr, burnByDay, today]);
  const burn = burnModel.total;
  const profileComplete = burnModel.fromProfile;

  const openProfile = () => { haptic.tap(); setPfH(profile.heightCm ? String(profile.heightCm) : ''); setPfA(profile.ageYears ? String(profile.ageYears) : ''); setPfSex(profile.sex); setProfileModal(true); };
  const saveProfile = () => {
    const h = parseInt(pfH, 10) || 0, a = parseInt(pfA, 10) || 0;
    setProfile({ heightCm: h, ageYears: a, sex: pfSex });
    saveHealthGoals({ heightCm: h, ageYears: a, sex: pfSex }).catch(() => {});
    setProfileModal(false);
  };

  // ── Bilans tygodnia: spalone (zegarek) vs zjedzone (dziennik) ──────────────
  const weekBalance = useMemo(() => {
    const p = (n: number) => String(n).padStart(2, '0');
    const dow = ['Nd', 'Pn', 'Wt', 'Śr', 'Cz', 'Pt', 'So'];
    const now = new Date();
    const days: { key: string; label: string; eaten: number; burn: number; balance: number }[] = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
      const key = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
      const eatenD = meals.filter(m => m.date === key).reduce((s, m) => s + m.kcal, 0);
      const burnD = key === today ? burn : (burnByDay[key] ?? 0);   // today uses the resting+movement model
      days.push({ key, label: dow[d.getDay()], eaten: eatenD, burn: burnD, balance: burnD - eatenD });
    }
    const logged = days.filter(x => x.eaten > 0);                 // only count days you actually logged food
    const cumDeficit = logged.reduce((s, x) => s + x.balance, 0);
    return { days, loggedCount: logged.length, cumDeficit, kg: cumDeficit / 7700 };
  }, [meals, burnByDay, burn, today]);

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

  const dayBurn   = isToday ? burn : (burnByDay[viewDate] ?? 0);   // watch burn for the browsed day
  const target    = targetIntake(dayBurn, goalMode, manualGoal);
  const remaining = target - eaten;
  const pct       = target > 0 ? Math.min(1, eaten / target) : 0;
  const ratio     = target > 0 ? eaten / target : 0;
  const ringColor = ratio > 1 ? colors.accent.red : ratio >= 0.85 ? colors.accent.amber : colors.accent.green;

  // ring geometry
  const R = 64, SW = 14, CIRC = 2 * Math.PI * R, SIZE = (R + SW) * 2;

  const byType = useMemo(() => {
    const map: Record<MealType, MealEntry[]> = { sniadanie: [], obiad: [], kolacja: [], przekaska: [] };
    for (const m of dayMeals) map[m.type].push(m);
    return map;
  }, [dayMeals]);

  const dateLabel = (() => {
    if (isToday) return 'Dziś';
    const [y, m, d] = viewDate.split('-').map(Number);
    const dd = new Date(y, m - 1, d);
    const yd = new Date(); yd.setDate(yd.getDate() - 1);
    const ydKey = `${yd.getFullYear()}-${String(yd.getMonth() + 1).padStart(2, '0')}-${String(yd.getDate()).padStart(2, '0')}`;
    if (viewDate === ydKey) return 'Wczoraj';
    return dd.toLocaleDateString('pl-PL', { weekday: 'short', day: 'numeric', month: 'short', year: y === new Date().getFullYear() ? undefined : 'numeric' });
  })();

  return (
    <SafeAreaView style={s.container} edges={[]}>
      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={[s.scroll, { paddingTop: insets.top + 50 }]}>

        {/* ── Date navigator ────────────────────────────────────────── */}
        <View style={s.dateNav}>
          <TouchableOpacity style={s.dateArrow} onPress={() => shiftDay(-1)}><ChevronLeft size={20} color={c.text.primary} /></TouchableOpacity>
          <TouchableOpacity style={s.dateLabelBtn} activeOpacity={0.7} onPress={() => { haptic.tap(); setDateModal(true); }}>
            <CalendarIcon size={14} color={c.text.muted} />
            <Text style={s.dateLabel}>{dateLabel}</Text>
          </TouchableOpacity>
          <TouchableOpacity style={[s.dateArrow, isToday && { opacity: 0.3 }]} disabled={isToday} onPress={() => shiftDay(1)}><ChevronRight size={20} color={c.text.primary} /></TouchableOpacity>
          {!isToday && <TouchableOpacity style={s.todayChip} onPress={() => { haptic.tap(); setViewDate(today); }}><Text style={s.todayChipTxt}>dziś</Text></TouchableOpacity>}
        </View>

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
              <View style={s.heroBurnRow}><Flame size={13} color={ACCENT} /><Text style={s.heroStatVal}>{dayBurn > 0 ? dayBurn.toLocaleString('pl-PL') : '—'}</Text></View>
              <Text style={s.heroStatLabel}>spalone</Text>
            </View>
          </View>

          {/* Zapotrzebowanie: resting (BMR) + movement — tap to set the body profile (today only) */}
          {isToday && (
          <TouchableOpacity style={s.needsRow} activeOpacity={0.7} onPress={openProfile}>
            {profileComplete ? (
              <Text style={s.needsTxt}>
                Spoczynek <Text style={s.needsB}>{burnModel.bmr}</Text> + ruch <Text style={s.needsB}>{burnModel.active}</Text> = <Text style={s.needsB}>{burnModel.total}</Text> spalone
              </Text>
            ) : (
              <Text style={[s.needsTxt, { color: ACCENT }]}>Ustaw profil (wzrost, wiek, płeć) → policzę Twoje zapotrzebowanie</Text>
            )}
            <Settings size={13} color={colors.text.muted} />
          </TouchableOpacity>
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

          {macrosToday.any && (
            <View style={s.macroLine}>
              <Text style={s.macroChip}>B <Text style={s.macroChipV}>{macrosToday.protein} g</Text></Text>
              <Text style={s.macroChip}>W <Text style={s.macroChipV}>{macrosToday.carbs} g</Text></Text>
              <Text style={s.macroChip}>T <Text style={s.macroChipV}>{macrosToday.fat} g</Text></Text>
            </View>
          )}
        </View>

        {/* ── Bilans tygodnia: spalone vs zjedzone (dziś) ────────────── */}
        {isToday && weekBalance.loggedCount > 0 && (
          <View style={[s.card, { gap: spacing[2] }]}>
            <View style={s.balRow}>
              <Text style={s.balTitle}>Bilans tygodnia</Text>
              <Text style={[s.balSummary, { color: weekBalance.cumDeficit >= 0 ? colors.accent.green : colors.accent.red }]}>
                {weekBalance.cumDeficit >= 0 ? '−' : '+'}{Math.abs(Math.round(weekBalance.cumDeficit)).toLocaleString('pl-PL')} kcal
              </Text>
            </View>
            <View style={s.balBars}>
              {weekBalance.days.map(d => {
                const has = d.eaten > 0;
                const mag = Math.min(1, Math.abs(d.balance) / 1500);
                const col = !has ? c.fill.subtle : d.balance >= 0 ? colors.accent.green : colors.accent.red;
                return (
                  <View key={d.key} style={s.balCol}>
                    <View style={s.balTrack}><View style={{ width: '100%', height: `${has ? Math.max(6, mag * 100) : 0}%`, backgroundColor: col, borderRadius: 3 }} /></View>
                    <Text style={s.balLbl}>{d.label}</Text>
                  </View>
                );
              })}
            </View>
            <Text style={s.balNote}>
              {weekBalance.cumDeficit >= 0
                ? `Deficyt przez ${weekBalance.loggedCount} ${weekBalance.loggedCount === 1 ? 'dzień' : 'dni'} ≈ −${Math.abs(weekBalance.kg).toFixed(2)} kg · zielony = deficyt`
                : `Nadwyżka przez ${weekBalance.loggedCount} ${weekBalance.loggedCount === 1 ? 'dzień' : 'dni'} ≈ +${Math.abs(weekBalance.kg).toFixed(2)} kg · czerwony = nadwyżka`}
            </Text>
          </View>
        )}

        {/* ── Woda + Waga (shared source with Zdrowie) — today only ──── */}
        {isToday && (
        <View style={s.trackRow}>
          <View style={[s.card, s.trackCard]}>
            <View style={s.trackHead}><Droplets size={15} color="#60A5FA" /><Text style={s.trackTitle}>Woda</Text></View>
            <Text style={s.trackVal}>{water.glasses}<Text style={s.trackUnit}> / {water.goal} szkl.</Text></Text>
            <View style={s.trackBtns}>
              <TouchableOpacity style={s.trackBtn} onPress={() => water.change(-1)} disabled={water.glasses <= 0}><Minus size={16} color={water.glasses <= 0 ? c.text.muted : c.text.primary} /></TouchableOpacity>
              <TouchableOpacity style={[s.trackBtn, { backgroundColor: '#60A5FA', borderColor: '#60A5FA' }]} onPress={() => water.change(1)}><Plus size={16} color="#fff" /></TouchableOpacity>
            </View>
          </View>

          <View style={[s.card, s.trackCard]}>
            <View style={s.trackHead}><Scale size={15} color="#A78BFA" /><Text style={s.trackTitle}>Waga</Text></View>
            <TouchableOpacity activeOpacity={0.7} onPress={() => { haptic.tap(); setWInput(weightKg > 0 ? weightKg.toFixed(1) : ''); setWModal('set'); }}>
              <Text style={s.trackVal}>{weightKg > 0 ? weightKg.toFixed(1) : '—'}<Text style={s.trackUnit}> kg</Text></Text>
            </TouchableOpacity>
            <View style={s.trackBtns}>
              <TouchableOpacity style={s.trackBtn} onPress={() => nudgeWeight(-0.1)}><Minus size={16} color={c.text.primary} /></TouchableOpacity>
              <TouchableOpacity style={s.trackBtn} onPress={() => nudgeWeight(0.1)}><Plus size={16} color={c.text.primary} /></TouchableOpacity>
            </View>
            <TouchableOpacity onPress={() => { haptic.tap(); setWInput(weightGoal > 0 ? String(weightGoal) : ''); setWModal('goal'); }}>
              <Text style={s.trackGoal} numberOfLines={1}>{weightGoal > 0 ? `cel ${weightGoal} kg${weightEta ? ` · ${weightEta}` : ''}` : 'ustaw cel wagi'}</Text>
            </TouchableOpacity>
          </View>
        </View>
        )}

        {/* ── Meals for the viewed day ──────────────────────────────── */}
        {dayMeals.length === 0 ? (
          <TouchableOpacity style={[s.card, s.empty]} activeOpacity={0.9} onPress={() => { haptic.tap(); router.push(`/food/add?date=${viewDate}` as any); }}>
            <UtensilsCrossed size={30} color={c.text.muted} />
            <Text style={s.emptyTitle}>{isToday ? 'Nic dziś nie zapisane' : 'Nic tego dnia nie zapisane'}</Text>
            <Text style={s.emptySub}>Stuknij, żeby dodać {isToday ? 'co zjadłeś' : 'posiłek do tego dnia'} — z bazy, ostatnich albo ręcznie.</Text>
            <View style={[s.emptyBtn, { backgroundColor: ACCENT }]}><Plus size={16} color="#1A1206" /><Text style={s.emptyBtnTxt}>{isToday ? 'Co zjadłem' : 'Dodaj posiłek'}</Text></View>
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
                    <TouchableOpacity style={s.mealTap} activeOpacity={0.7}
                      onPress={() => { haptic.tap(); router.push(`/food/add?date=${viewDate}&edit=${m.id}` as any); }}>
                      <View style={{ flex: 1 }}>
                        <Text style={s.mealName} numberOfLines={1}>{mealSummary(m)}</Text>
                        {m.note ? <Text style={s.mealNote} numberOfLines={1}>{m.note}</Text> : null}
                      </View>
                      <Text style={s.mealKcal}>{m.kcal.toLocaleString('pl-PL')}</Text>
                      <Pencil size={13} color={c.text.muted} />
                    </TouchableOpacity>
                    <TouchableOpacity hitSlop={8} style={{ paddingLeft: spacing[2] }} onPress={() => { haptic.tap(); removeMeal(m.id); }}>
                      <Trash2 size={15} color={c.text.muted} />
                    </TouchableOpacity>
                  </View>
                ))}
              </View>
            );
          })
        )}

        {dayMeals.length > 0 && (
          <TouchableOpacity style={[s.addMore, { borderColor: ACCENT + '55' }]} activeOpacity={0.85}
            onPress={() => { haptic.tap(); router.push(`/food/add?date=${viewDate}` as any); }}>
            <Plus size={16} color={ACCENT} /><Text style={[s.addMoreTxt, { color: ACCENT }]}>Dodaj kolejny posiłek</Text>
          </TouchableOpacity>
        )}
      </ScrollView>

      {/* Profil ciała → BMR (zapotrzebowanie spoczynkowe) */}
      <Modal visible={profileModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setProfileModal(false)}>
        <TouchableOpacity style={s.pfOverlay} activeOpacity={1} onPress={() => setProfileModal(false)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} style={[s.card, s.pfSheet]} onPress={() => {}}>
              <Text style={s.pfTitle}>Twój profil</Text>
              <Text style={s.pfSub}>Wzrost, wiek i płeć → policzę spalanie spoczynkowe (BMR). Waga bierze się z karty Waga / zegarka; ruch z zegarka.</Text>
              <View style={s.pfRow}>
                <Text style={s.pfLabel}>Wzrost</Text>
                <TextInput style={s.pfInput} value={pfH} onChangeText={setPfH} keyboardType="numeric" placeholder="np. 178" placeholderTextColor={c.text.muted} />
                <Text style={s.pfUnit}>cm</Text>
              </View>
              <View style={s.pfRow}>
                <Text style={s.pfLabel}>Wiek</Text>
                <TextInput style={s.pfInput} value={pfA} onChangeText={setPfA} keyboardType="numeric" placeholder="np. 30" placeholderTextColor={c.text.muted} />
                <Text style={s.pfUnit}>lat</Text>
              </View>
              <View style={s.pfRow}>
                <Text style={s.pfLabel}>Płeć</Text>
                {([['m', 'Mężczyzna'], ['f', 'Kobieta']] as const).map(([v, lbl]) => (
                  <TouchableOpacity key={v} onPress={() => { haptic.tap(); setPfSex(v); }}
                    style={[s.sexChip, pfSex === v && { backgroundColor: ACCENT + '22', borderColor: ACCENT + '88' }]}>
                    <Text style={[s.sexTxt, pfSex === v && { color: ACCENT }]}>{lbl}</Text>
                  </TouchableOpacity>
                ))}
              </View>
              {(() => {
                const h = parseInt(pfH, 10) || 0, a = parseInt(pfA, 10) || 0;
                const bmr = bmrMifflin(weightKg, h, a, pfSex);
                return bmr > 0
                  ? <Text style={s.pfBmr}>BMR ≈ {bmr} kcal/dzień (spoczynek, przy {weightKg.toFixed(1)} kg)</Text>
                  : <Text style={s.pfSub}>{weightKg > 0 ? 'Uzupełnij wzrost, wiek i płeć.' : 'Najpierw ustaw wagę (karta Waga / zegarek).'}</Text>;
              })()}
              <TouchableOpacity style={[s.sheetSave, { backgroundColor: (parseInt(pfH, 10) > 0 && parseInt(pfA, 10) > 0 && pfSex) ? ACCENT : c.fill.subtle }]}
                disabled={!(parseInt(pfH, 10) > 0 && parseInt(pfA, 10) > 0 && pfSex)} onPress={saveProfile}>
                <Check size={17} color={(parseInt(pfH, 10) > 0 && parseInt(pfA, 10) > 0 && pfSex) ? '#1A1206' : c.text.muted} />
                <Text style={[s.sheetSaveTxt, { color: (parseInt(pfH, 10) > 0 && parseInt(pfA, 10) > 0 && pfSex) ? '#1A1206' : c.text.muted }]}>Zapisz profil</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>

      {/* Skok do dowolnej daty */}
      <Modal visible={dateModal} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setDateModal(false)}>
        <TouchableOpacity style={s.pfOverlay} activeOpacity={1} onPress={() => setDateModal(false)}>
          <TouchableOpacity activeOpacity={1} style={[s.card, s.pfSheet]} onPress={() => {}}>
            <Text style={s.pfTitle}>Wybierz dzień</Text>
            <DatePickerField value={viewDate} onChange={(d) => { if (d && d <= today) setViewDate(d); }} placeholder="Data" />
            <TouchableOpacity style={[s.sheetSave, { backgroundColor: ACCENT }]} onPress={() => { haptic.tap(); setDateModal(false); }}>
              <Check size={17} color="#1A1206" /><Text style={[s.sheetSaveTxt, { color: '#1A1206' }]}>Pokaż</Text>
            </TouchableOpacity>
          </TouchableOpacity>
        </TouchableOpacity>
      </Modal>

      {/* Waga: wpisz dokładnie / ustaw cel */}
      <Modal visible={wModal !== null} transparent animationType="fade" statusBarTranslucent onRequestClose={() => setWModal(null)}>
        <TouchableOpacity style={s.pfOverlay} activeOpacity={1} onPress={() => setWModal(null)}>
          <KeyboardAvoidingView behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
            <TouchableOpacity activeOpacity={1} style={[s.card, s.pfSheet]} onPress={() => {}}>
              <Text style={s.pfTitle}>{wModal === 'goal' ? 'Cel wagi (kg)' : 'Waga dziś (kg)'}</Text>
              <TextInput style={s.wInput} value={wInput} onChangeText={setWInput} keyboardType="numeric" placeholder="np. 78.5" placeholderTextColor={c.text.muted} autoFocus />
              <TouchableOpacity style={[s.sheetSave, { backgroundColor: +wInput.replace(',', '.') > 0 ? ACCENT : c.fill.subtle }]}
                disabled={!(+wInput.replace(',', '.') > 0)} onPress={commitWeightModal}>
                <Check size={17} color={+wInput.replace(',', '.') > 0 ? '#1A1206' : c.text.muted} />
                <Text style={[s.sheetSaveTxt, { color: +wInput.replace(',', '.') > 0 ? '#1A1206' : c.text.muted }]}>Zapisz</Text>
              </TouchableOpacity>
            </TouchableOpacity>
          </KeyboardAvoidingView>
        </TouchableOpacity>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: typeof colors) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  scroll:    { padding: spacing[4], gap: spacing[3], paddingBottom: 180 },

  dateNav:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  dateArrow:    { width: 40, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  dateLabelBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 7, height: 40, borderRadius: radius.md, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.subtle },
  dateLabel:    { fontSize: 14, fontWeight: '800', color: c.text.primary },
  todayChip:    { paddingHorizontal: spacing[3], height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: ACCENT + '77', backgroundColor: ACCENT + '22', alignItems: 'center', justifyContent: 'center' },
  todayChipTxt: { fontSize: 12.5, fontWeight: '800', color: ACCENT },

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

  needsRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 2 },
  needsTxt: { fontSize: 12, color: c.text.secondary, textAlign: 'center' },
  needsB:   { fontWeight: '800', color: c.text.primary },

  pfOverlay:  { flex: 1, backgroundColor: 'rgba(0,0,0,0.6)', justifyContent: 'center', padding: spacing[4] },
  pfSheet:    { gap: spacing[3] },
  pfTitle:    { fontSize: 16, fontWeight: '800', color: c.text.primary },
  pfSub:      { fontSize: 12, color: c.text.muted, lineHeight: 16 },
  pfRow:      { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  pfLabel:    { fontSize: 13, fontWeight: '700', color: c.text.secondary, width: 64 },
  pfInput:    { width: 90, height: 44, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, textAlign: 'center', fontSize: 17, fontWeight: '700', color: c.text.primary },
  wInput:     { height: 48, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3], fontSize: 18, fontWeight: '700', color: c.text.primary, textAlign: 'center' },
  pfUnit:     { fontSize: 13, fontWeight: '600', color: c.text.muted },
  sexChip:    { flex: 1, alignItems: 'center', paddingVertical: 10, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  sexTxt:     { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  pfBmr:      { fontSize: 13, fontWeight: '800', color: '#F59E0B' },
  sheetSave:  { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, height: 48, borderRadius: radius.full, marginTop: 2 },
  sheetSaveTxt: { fontSize: 14, fontWeight: '800' },

  goalRow:     { flexDirection: 'row', alignItems: 'center', gap: spacing[2], marginTop: 2 },
  goalChip:    { paddingHorizontal: spacing[3], paddingVertical: 6, borderRadius: radius.full, borderWidth: 1, borderColor: c.border.default },
  goalChipTxt: { fontSize: 12, fontWeight: '700', color: c.text.secondary },

  macroLine:  { flexDirection: 'row', justifyContent: 'center', gap: spacing[3], marginTop: 2 },
  macroChip:  { fontSize: 12, fontWeight: '700', color: c.text.muted },
  macroChipV: { color: c.text.primary, fontWeight: '800' },

  trackRow:   { flexDirection: 'row', gap: spacing[3] },
  trackCard:  { flex: 1, gap: spacing[2] },
  trackHead:  { flexDirection: 'row', alignItems: 'center', gap: 6 },
  trackTitle: { fontSize: 12.5, fontWeight: '800', color: c.text.secondary, textTransform: 'uppercase', letterSpacing: 0.4 },
  trackVal:   { fontSize: 26, fontWeight: '800', color: c.text.primary, letterSpacing: -0.5 },
  trackUnit:  { fontSize: 12, fontWeight: '600', color: c.text.muted },
  trackBtns:  { flexDirection: 'row', gap: spacing[2] },
  trackBtn:   { flex: 1, height: 40, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center' },
  trackGoal:  { fontSize: 11.5, fontWeight: '700', color: c.text.muted, marginTop: 1 },

  balRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  balTitle:   { fontSize: 14, fontWeight: '800', color: c.text.primary },
  balSummary: { fontSize: 15, fontWeight: '800', fontVariant: ['tabular-nums'] },
  balBars:    { flexDirection: 'row', gap: spacing[2], height: 56, alignItems: 'flex-end', marginTop: 2 },
  balCol:     { flex: 1, alignItems: 'center', gap: 4 },
  balTrack:   { width: '100%', height: 44, borderRadius: 3, backgroundColor: c.fill.subtle, justifyContent: 'flex-end', overflow: 'hidden' },
  balLbl:     { fontSize: 10, fontWeight: '700', color: c.text.muted },
  balNote:    { fontSize: 11.5, color: c.text.muted },

  empty:      { alignItems: 'center', gap: spacing[2], paddingVertical: spacing[5] },
  emptyTitle: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  emptySub:   { fontSize: 12.5, color: c.text.muted, textAlign: 'center', lineHeight: 17, paddingHorizontal: spacing[3] },
  emptyBtn:   { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: spacing[4], paddingVertical: 10, borderRadius: radius.full, marginTop: spacing[2] },
  emptyBtnTxt: { fontSize: 13, fontWeight: '800', color: '#1A1206' },

  mealHeader: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  mealTitle:  { fontSize: 14, fontWeight: '800', color: c.text.primary },
  mealSub:    { fontSize: 12, fontWeight: '700', color: c.text.secondary },
  mealRow:    { flexDirection: 'row', alignItems: 'center', paddingVertical: 7, borderTopWidth: 1, borderTopColor: c.border.subtle },
  mealTap:    { flex: 1, flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  mealName:   { fontSize: 13.5, fontWeight: '600', color: c.text.primary },
  mealNote:   { fontSize: 11, color: c.text.muted, marginTop: 1 },
  mealKcal:   { fontSize: 13, fontWeight: '800', color: c.text.secondary, fontVariant: ['tabular-nums'] },

  addMore:    { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, paddingVertical: 13, borderRadius: radius.xl, borderWidth: 1.5, borderStyle: 'dashed' },
  addMoreTxt: { fontSize: 13, fontWeight: '800' },
}));
