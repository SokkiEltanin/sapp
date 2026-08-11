import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Pencil, Check, Coins } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import CatArt from '@/components/pet/CatArt';
import CrateModal from '@/components/pet/CrateModal';
import BoxRevealModal from '@/components/pet/BoxRevealModal';
import PupilNavbar from '@/components/pet/PupilNavbar';
import { rollBox, DAILY_BOX, LootBox, BoxReward } from '@/utils/petBoxes';
import { SHOP_COLORS } from '@/utils/petShop';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { usePetStore, levelFromXp, growthStage } from '@/store/petStore';
import { useProfileStore } from '@/store/profileStore';
import { ageFrom, targetsFor } from '@/utils/personalQuests';
import { computePetState, petStatusLine, PetInput } from '@/utils/petState';
import { buildQuests, buildMissedDaily, sweetlessDaysFrom, QuestCtx, weekKeyOf } from '@/utils/quests';
import { paletteById } from '@/utils/catPalettes';
import { bossById } from '@/utils/bosses';
import { getBudgets } from '@/utils/budgets';
import { useHabits, habitsDoneOn } from '@/hooks/useHabits';
import { getWaterGlasses } from '@/utils/habits';
import { useMoodStore } from '@/store/moodStore';
import { useExpensesStore } from '@/store/expensesStore';
import { getHealthHistory } from '@/utils/healthHistory';
import { getHealthGoals } from '@/utils/healthGoals';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coins as CoinsIcon, Check as CheckIcon, Gift } from 'lucide-react-native';

const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = () => ymdOf(new Date());
const yesterdayISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymdOf(d); };
const STAGE_SIZE = { baby: 150, kid: 172, teen: 194, adult: 214 } as const;

export default function Pet() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  const { name, xp, coins, setName, careTick, claimDaily, claimDailyFor, claimQuest, claimMonthly, claimWeekly, claimedQuests, dailyClaims, dayClaims, weeklyClaims, monthlyClaims, catColor, catStripes, catEyeColor, catNoseColor, catWhiskers, catLegStripes, petCat, affection, affectionDay, pendingCrates, ownedItems, defeatedBosses, claimDailyBox, buyItem, grantStartup, addCoins, pushupsDay, squatsDay, markPushupsDone, markSquatsDone } = usePetStore();
  const { birthdate, gender, trainingLevel } = useProfileStore();
  const addFreezes = useStreakFreezeStore(st => st.addFreezes);
  const [boxReveal, setBoxReveal] = useState<{ box: LootBox; reward: BoxReward } | null>(null);
  // Skrzynka dnia PRZY KOCIE (nie tylko w sklepie — tam user o niej zapominał). Ta sama gacza.
  const dailyBoxReady = !dayClaims[`dailybox:${todayISO()}`];
  const onDailyBox = () => {
    haptic.tap();
    if (!dailyBoxReady || !claimDailyBox()) { haptic.error(); toast.info('Skrzynkę dnia już odebrałeś — wróć jutro'); return; }
    const reward = rollBox(DAILY_BOX, SHOP_COLORS, ownedItems);
    if (reward.type === 'color') buyItem(reward.colorId, 0);
    else if (reward.type === 'startup') grantStartup(reward.startupId);
    else if (reward.type === 'coins') addCoins(reward.coins);
    else if (reward.type === 'freeze') addFreezes(reward.count);
    haptic.success();
    setBoxReveal({ box: DAILY_BOX, reward });
  };
  const [celebrate, setCelebrate] = useState(0);
  const [crateOpen, setCrateOpen] = useState(false);
  const [trophiesOpen, setTrophiesOpen] = useState(false);
  // affection resets each day — show 0 on a fresh day even before the first tap
  const affToday = affectionDay === todayISO() ? affection : 0;
  const palette = useMemo(() => paletteById(catColor), [catColor]);
  const trophies = useMemo(
    () => (defeatedBosses ?? []).map(id => bossById(id)).filter((b): b is NonNullable<typeof b> => !!b)
      .map(b => ({ emoji: b.loot.emoji, boss: b.name, loot: b.loot.name, desc: b.loot.desc })),
    [defeatedBosses],
  );
  const { habits, todayDone, completions, getStreak } = useHabits();
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();

  const [health, setHealth] = useState<{ steps: number; sleep: number; bestStepDay: number; stepTarget: number; stepsThisMonth: number; stepsThisWeek: number; cyclingMinutesToday: number }>({ steps: 0, sleep: 0, bestStepDay: 0, stepTarget: 0, stepsThisMonth: 0, stepsThisWeek: 0, cyclingMinutesToday: 0 });
  const [stepGoal, setStepGoal] = useState(10000);
  const [waterGoal, setWaterGoal] = useState(8);
  const [budgets, setBudgets] = useState<Record<string, number>>({});
  const [waterToday, setWaterToday] = useState(0);
  // Yesterday's numbers, so rewards you earned but never opened the app to collect
  // can still be claimed today (see `missed` below).
  const [yData, setYData] = useState<{ steps: number; sleep: number; water: number } | null>(null);
  const [cardsCollected, setCardsCollected] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  // Reload on every focus (screens stay mounted here), so logging mood / walking /
  // ticking a habit and coming back shows a fresh, reactive pet — not a stale one.
  const readHealth = useCallback(() => {
    const t = todayISO();
    const month = t.slice(0, 7);
    getHealthHistory(200).then(h => {
      const steps = h[t]?.steps ?? 0;
      // TODAY's sleep only. This used to fall back to the previous day on record when
      // today hadn't synced yet, which silently credited LAST night-but-one's sleep to
      // today's quest (claimed 7h while today was really 6,5h). No data for today = the
      // quest simply isn't earned yet.
      const sleep = h[t]?.sleepMinutes ?? 0;
      const bestStepDay = Object.values(h).reduce((m, d) => Math.max(m, d.steps ?? 0), 0);
      const stepsThisMonth = Object.entries(h).filter(([d]) => d.startsWith(month)).reduce((m, [, v]) => m + (v.steps ?? 0), 0);
      const wk = weekKeyOf();
      const stepsThisWeek = Object.entries(h).filter(([d]) => d >= wk).reduce((m, [, v]) => m + (v.steps ?? 0), 0);
      const recent = Object.values(h).map(d => d.steps).filter(x => x > 0).slice(0, 14);
      const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      const stepTarget = avg > 0 ? Math.max(8000, Math.ceil(avg * 1.1 / 500) * 500) : 0;
      const cyclingMinutesToday = h[t]?.cyclingMinutes ?? 0;
      setHealth({ steps, sleep, bestStepDay, stepTarget, stepsThisMonth, stepsThisWeek, cyclingMinutesToday });
      // yesterday's health + water, for the missed-rewards catch-up (habits come from
      // the useHabits `completions` map, which already holds the last 30 days)
      const y = yesterdayISO();
      getWaterGlasses(y)
        .then(water => setYData({ steps: h[y]?.steps ?? 0, sleep: h[y]?.sleepMinutes ?? 0, water }))
        .catch(() => {});
    }).catch(() => {});
    getHealthGoals().then(g => { setStepGoal(g.stepGoal || 10000); setWaterGoal(g.waterGoal || 8); }).catch(() => {});
    getBudgets().then(b => setBudgets(b as Record<string, number>)).catch(() => {});
    getWaterGlasses(t).then(g => setWaterToday(g)).catch(() => {});
    AsyncStorage.getItem('skin_progress').then(raw => { if (raw) setCardsCollected(JSON.parse(raw).cards ?? 0); }).catch(() => {});
  }, []);
  const reload = useCallback(() => {
    readHealth(); // show cache immediately…
    // …and pull fresh steps/sleep from the watch (force = ignore the 10-min throttle so
    // the pet's needs reflect current data whenever you open it), re-read if anything changed.
    import('@/services/healthAutoSync')
      .then(({ autoSyncHealth }) => autoSyncHealth(7, true))
      .then(() => readHealth())   // ZAWSZE re-czytaj po syncu (też gdy dołączyliśmy do trwającego runu) → nagrody aktualne
      .catch(() => {});
  }, [readHealth]);
  useFocusEffect(reload);

  const habitBestStreak = useMemo(() => habits.length ? Math.max(0, ...habits.map(h => getStreak(h.id))) : 0, [habits, getStreak]);
  // Personalizacja (Ustawienia) → cele questów treningowych. Brak trainingLevel = questy
  // po prostu się nie pokazują (available: c => (c.pushupTarget ?? 0) > 0 w quests.ts),
  // więc nikogo nie zaskakują dopóki nie wypełni Personalizacji.
  const personalTargets = useMemo(
    () => trainingLevel ? targetsFor(trainingLevel, ageFrom(birthdate), gender) : null,
    [trainingLevel, birthdate, gender],
  );
  const questCtx: QuestCtx = useMemo(() => {
    const t = todayISO();
    const month = t.slice(0, 7);
    const boughtSweetToday = expenses.some(e => e.type !== 'income' && (e.date ?? '').slice(0, 10) === t
      && (e.receiptItems ?? []).some(it => !it.excluded && (it.tags ?? []).some(tg => tg === 'słodycze' || tg === 'przekąski')));
    const moodDaysThisMonth = new Set(moodEntries.filter(e => (e.date ?? '').startsWith(month)).map(e => e.date)).size;
    return {
      stepsToday: health.steps,
      moodLoggedToday: moodEntries.some(e => e.date === t),
      habitsDone: todayDone.length, habitsTotal: habits.length,
      sweetlessDays: sweetlessDaysFrom(expenses),
      bestStepDay: health.bestStepDay,
      habitBestStreak,
      cardsCollected,
      boughtSweetToday,
      stepTarget: health.stepTarget,
      waterToday, waterGoal,
      sleepMinutes: health.sleep,
      moodDaysThisMonth,
      stepsThisMonth: health.stepsThisMonth,
      moodDaysThisWeek: new Set(moodEntries.filter(e => (e.date ?? '') >= weekKeyOf()).map(e => e.date)).size,
      stepsThisWeek: health.stepsThisWeek,
      affectionFull: affToday >= 100,
      pushupTarget: personalTargets?.pushups,
      squatTarget: personalTargets?.squats,
      bikeTarget: personalTargets?.bikeMinutes,
      pushupsToday: pushupsDay === t,
      squatsToday: squatsDay === t,
      bikeMinutesToday: health.cyclingMinutesToday,
    };
  }, [health, moodEntries, todayDone.length, habits.length, expenses, habitBestStreak, cardsCollected, waterToday, waterGoal, affToday, personalTargets, pushupsDay, squatsDay]);
  const quests = useMemo(
    () => buildQuests(questCtx, { claimedMilestones: claimedQuests, dailyClaims, weeklyClaims, monthlyClaims, today: todayISO(), week: weekKeyOf() }),
    [questCtx, claimedQuests, dailyClaims, weeklyClaims, monthlyClaims],
  );

  // Rewards you actually earned YESTERDAY but never opened the app to collect. Built
  // from yesterday's stored numbers (not today's), so nothing is credited from the
  // wrong day. Only reconstructable quests appear — see RETRO_DAILY_IDS in quests.ts.
  const missed = useMemo(() => {
    if (!yData) return [];
    const y = yesterdayISO();
    const yCtx: QuestCtx = {
      stepsToday: yData.steps,
      moodLoggedToday: moodEntries.some(e => e.date === y),
      habitsDone: habitsDoneOn(habits, completions, y).length,
      habitsTotal: habits.length,
      sweetlessDays: 0, bestStepDay: 0, habitBestStreak: 0, cardsCollected: 0,
      waterToday: yData.water, waterGoal,
      sleepMinutes: yData.sleep,
    };
    return buildMissedDaily(yCtx, dayClaims, y);
  }, [yData, moodEntries, habits, completions, waterGoal, dayClaims]);

  const claimMissed = (q: { id: string; label: string; coins: number; xp: number }) => {
    if (claimDailyFor(q.id, yesterdayISO(), q.coins, q.xp)) {
      haptic.success();
      setCelebrate(v => v + 1);
      toast.success(`Odebrano z wczoraj: ${q.label} +${q.coins}🪙`);
    }
  };
  const claimAllMissed = () => {
    const y = yesterdayISO();
    let coins = 0;
    missed.forEach(q => { if (claimDailyFor(q.id, y, q.coins, q.xp)) coins += q.coins; });
    if (coins > 0) { haptic.success(); setCelebrate(v => v + 1); toast.success(`Odebrano zaległe nagrody +${coins}🪙`); }
  };

  // Tap-to-pet: fills today's affection bar; a full bar pays a one-a-day bonus and
  // the cat throws a little party.
  const handlePet = () => {
    const r = petCat(4);
    if (r.justFull) { haptic.success(); toast.success(`❤️ ${name} daje Ci skrzynkę sardynek!`); setCelebrate(c => c + 1); setCrateOpen(true); }
  };
  // Hold-to-cuddle: worth much more affection than a tap (przytulenie > szturchnięcie).
  const handleCuddle = () => {
    const r = petCat(14);
    if (r.justFull) { haptic.success(); toast.success(`❤️ ${name} daje Ci skrzynkę sardynek!`); setCelebrate(c => c + 1); setCrateOpen(true); }
  };

  const onClaimMonthly = (id: string, c2: number, x: number, label: string) => {
    if (claimMonthly(id, c2, x)) { haptic.success(); toast.success(`+${c2} 🪙 · ${label}`); setCelebrate(c => c + 1); }
  };
  const onClaimWeekly = (id: string, c2: number, x: number, label: string) => {
    if (claimWeekly(id, c2, x)) { haptic.success(); toast.success(`+${c2} 🪙 · ${label}`); setCelebrate(c => c + 1); }
  };

  const onClaimDaily = (id: string, c2: number, x: number, label: string) => {
    if (claimDaily(id, c2, x)) { haptic.success(); toast.success(`+${c2} 🪙 · ${label}`); setCelebrate(c => c + 1); }
  };
  const onClaimTier = (id: string, c2: number, x: number) => {
    claimQuest(id, c2, x); haptic.success(); toast.success(`+${c2} 🪙 · nagroda odebrana`); setCelebrate(c => c + 1);
  };

  // Over budget = any budgeted category exceeded its monthly limit → the pet gives a
  // gentle money nudge in its status line (it does NOT sadden the pet's core mood).
  const overBudget = useMemo(() => {
    const cats = Object.keys(budgets);
    if (!cats.length) return false;
    const mk = todayISO().slice(0, 7);
    const spend: Record<string, number> = {};
    for (const e of expenses) {
      if (e.type === 'income' || (e.date ?? '').slice(0, 7) !== mk) continue;
      spend[e.category] = (spend[e.category] ?? 0) + e.amount;
    }
    return cats.some(cat => (spend[cat] ?? 0) > (budgets[cat] || Infinity));
  }, [budgets, expenses]);

  const input: PetInput = useMemo(() => {
    const t = todayISO();
    const todayMoods = moodEntries.filter(e => e.date === t);
    const avgMood = todayMoods.length ? todayMoods.reduce((a, b) => a + b.mood, 0) / todayMoods.length : null;
    return {
      stepsToday: health.steps, stepGoal, sleepMinutes: health.sleep,
      habitsDone: todayDone.length, habitsTotal: habits.length,
      moodLoggedToday: todayMoods.length > 0, avgMoodToday: avgMood,
      hour: new Date().getHours(),
      overBudget,
    };
  }, [health, stepGoal, todayDone.length, habits.length, moodEntries, overBudget]);

  const pet = useMemo(() => computePetState(input), [input]);
  const lvl = levelFromXp(xp);
  const stage = growthStage(lvl.level);

  // one passive care-XP grant per day, scaled by wellbeing
  const ticked = useRef(false);
  useEffect(() => {
    if (ticked.current) return;
    if (health.steps > 0 || habits.length > 0 || moodEntries.length > 0) {
      ticked.current = true;
      careTick(Math.max(1, Math.round(pet.wellbeing / 12)));
    }
  }, [pet.wellbeing, health.steps, habits.length, moodEntries.length]);

  const saveName = () => { setName(draft); setEditing(false); haptic.success(); };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>Pupil</Text>
        <View style={s.coinPill}>
          <Coins size={13} color="#FBBF24" />
          <Text style={s.coinTxt}>{coins}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* name + mood — at the very top */}
        {editing ? (
          <View style={s.nameEdit}>
            <TextInput value={draft} onChangeText={setDraft} style={s.nameInput} autoFocus maxLength={16}
              placeholder="Imię" placeholderTextColor={c.text.muted} onSubmitEditing={saveName} />
            <TouchableOpacity onPress={saveName} style={s.nameSave}><Check size={18} color="#fff" /></TouchableOpacity>
          </View>
        ) : (
          <TouchableOpacity style={s.nameRow} onPress={() => { setDraft(name); setEditing(true); }} activeOpacity={0.7}>
            <Text style={s.name}>{name}</Text>
            <Pencil size={14} color={c.text.muted} />
          </TouchableOpacity>
        )}
        <View style={[s.moodChip, { backgroundColor: pet.color + '1E', borderColor: pet.color + '55' }]}>
          <Text style={[s.status, { color: pet.color }]}>{pet.label}</Text>
        </View>
        <Text style={s.tip}>{petStatusLine(pet)}</Text>

        {/* stage — no room backdrop any more; the cat IS the stage */}
        <View style={s.stage}>
          <CatArt expression={pet.expression} size={STAGE_SIZE[stage] + 90} palette={palette} stripes={catStripes}
            eyeColor={catEyeColor} noseColor={catNoseColor} whiskers={catWhiskers} legStripes={catLegStripes}
            onPress={handlePet} onLongPress={handleCuddle} celebrate={celebrate} affection={affToday} />
        </View>

        {/* Affection — fills as you pet (tap) the cat; full = daily bonus. */}
        <View style={s.affRow}>
          <Text style={s.affHeart}>{affToday >= 100 ? '❤️' : affToday > 0 ? '🩵' : '🤍'}</Text>
          <View style={s.affTrack}>
            <View style={[s.affFill, { width: `${affToday}%` }]} />
          </View>
          <Text style={s.affTxt}>{affToday >= 100 ? 'głaskany!' : 'głaskanie'}</Text>
        </View>

        {/* Skrzynka dnia — darmowa, TU przy kocie (w sklepie user o niej zapominał) */}
        <PressableScale onPress={onDailyBox} style={[s.dailyBox, !dailyBoxReady && s.dailyBoxDone]}>
          <Gift size={18} color={dailyBoxReady ? '#0B0E1A' : c.text.muted} />
          <Text style={[s.dailyBoxTxt, !dailyBoxReady && { color: c.text.muted }]}>
            {dailyBoxReady ? 'Odbierz skrzynkę dnia — za darmo' : 'Skrzynka odebrana — wróć jutro'}
          </Text>
          {dailyBoxReady && <View style={s.dailyBoxDot} />}
        </PressableScale>

        {pendingCrates > 0 && (
          <PressableScale onPress={() => { haptic.tap(); setCrateOpen(true); }} style={s.crateBtn}>
            <Text style={{ fontSize: 18 }}>🐟</Text>
            <Text style={s.crateBtnTxt}>Otwórz skrzynkę sardynek{pendingCrates > 1 ? ` · ${pendingCrates}` : ''}</Text>
          </PressableScale>
        )}

        {/* level */}
        <View style={s.levelCard}>
          <View style={s.levelTop}>
            <Text style={s.levelTxt}>Poziom {lvl.level}</Text>
            <Text style={s.levelSub}>{lvl.inLevel}/{lvl.needed} XP · {stage}</Text>
          </View>
          <View style={s.xpTrack}><View style={[s.xpFill, { width: `${Math.round(lvl.progress * 100)}%` }]} /></View>
        </View>

        {/* needs */}
        <Text style={s.section}>Potrzeby dziś</Text>
        <View style={s.needs}>
          {pet.needs.map(n => (
            <View key={n.key} style={s.needRow}>
              <Text style={s.needLabel}>{n.label}</Text>
              <View style={s.needTrack}>
                {!n.unknown && <View style={[s.needFill, { width: `${n.value}%`, backgroundColor: n.met ? '#2AC68F' : n.value >= 30 ? '#FBBF24' : '#F87171' }]} />}
              </View>
              <Text style={[s.needVal, n.unknown && { opacity: 0.5 }]}>{n.unknown ? '—' : `${n.value}%`}</Text>
            </View>
          ))}
        </View>

        {/* ── Missed yesterday: rewards earned but never collected ── */}
        {missed.length > 0 && (
          <>
            <View style={s.qHead}>
              <Text style={s.section}>Nieodebrane z wczoraj</Text>
              <PressableScale onPress={claimAllMissed}>
                <View style={s.claimBadge}><Gift size={11} color="#0B0E1A" /><Text style={s.claimBadgeTxt}>Odbierz wszystko</Text></View>
              </PressableScale>
            </View>
            <View style={[s.qCard, s.missedCard]}>
              {missed.map((q, i) => (
                <View key={q.id} style={[s.qRow, i > 0 && s.qRowBorder]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.qLabel} numberOfLines={1}>{q.label}</Text>
                    {q.note && <Text style={s.qNote}>{q.note}</Text>}
                  </View>
                  <View style={s.qReward}><CoinsIcon size={11} color="#FBBF24" /><Text style={s.qRewardTxt}>{q.coins}</Text></View>
                  <PressableScale onPress={() => claimMissed(q)}><View style={s.qClaim}><Text style={s.qClaimTxt}>Odbierz</Text></View></PressableScale>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Daily quests ── */}
        <View style={s.qHead}>
          <Text style={s.section}>Codzienne</Text>
          {quests.claimableCount > 0 && <View style={s.claimBadge}><Gift size={11} color="#0B0E1A" /><Text style={s.claimBadgeTxt}>{quests.claimableCount} do odbioru</Text></View>}
        </View>
        <View style={s.qCard}>
          {(() => {
            // Odebrane znikają z aktywnej listy i zwijają się w jedną stopkę.
            const active = quests.daily.filter(q => !q.claimed);
            const claimedN = quests.daily.length - active.length;
            return (
              <>
                {active.map((q, i) => (
                  <View key={q.id} style={[s.qRow, i > 0 && s.qRowBorder]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.qLabel} numberOfLines={1}>{q.label}</Text>
                      {q.note && <Text style={s.qNote}>{q.note}</Text>}
                    </View>
                    <View style={s.qReward}><CoinsIcon size={11} color="#FBBF24" /><Text style={s.qRewardTxt}>{q.coins}</Text></View>
                    {q.done
                      ? <PressableScale onPress={() => onClaimDaily(q.id, q.coins, q.xp, q.label)}><View style={s.qClaim}><Text style={s.qClaimTxt}>Odbierz</Text></View></PressableScale>
                      : <View style={s.qLocked}><Text style={s.qLockedTxt}>—</Text></View>}
                  </View>
                ))}
                {claimedN > 0 && (
                  <View style={[s.qClaimedFoot, active.length > 0 && s.qRowBorder]}>
                    <CheckIcon size={12} color="#2AC68F" />
                    <Text style={s.qClaimedTxt}>{claimedN} {claimedN === 1 ? 'odebrane' : 'odebrane'} dziś</Text>
                  </View>
                )}
              </>
            );
          })()}
        </View>

        {/* ── Bonus dailies (adaptive, higher reward) ── */}
        {quests.bonusDaily.length > 0 && (
          <>
            <Text style={s.section}>Bonusowe dziś</Text>
            <View style={s.qCard}>
              {(() => {
                const active = quests.bonusDaily.filter(q => !q.claimed);
                const claimedN = quests.bonusDaily.length - active.length;
                return (
                  <>
                    {active.map((q, i) => {
                      // Pompki/przysiady nie mają czujnika liczącego powtórzenia — stuknięcie
                      // "Zrobione" to jedyny sposób, żeby quest w ogóle mógł stać się `done`
                      // (patrz markPushupsDone/markSquatsDone w petStore, i komentarz w quests.ts).
                      const selfReport = q.id === 'b_pushups' ? markPushupsDone : q.id === 'b_squats' ? markSquatsDone : null;
                      return (
                        <View key={q.id} style={[s.qRow, i > 0 && s.qRowBorder]}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.qLabel} numberOfLines={1}>{q.label}</Text>
                            {q.note && <Text style={s.qNote}>{q.note}</Text>}
                          </View>
                          <View style={s.qReward}><CoinsIcon size={11} color="#FBBF24" /><Text style={s.qRewardTxt}>{q.coins}</Text></View>
                          {q.done
                            ? <PressableScale onPress={() => onClaimDaily(q.id, q.coins, q.xp, q.label)}><View style={s.qClaim}><Text style={s.qClaimTxt}>Odbierz</Text></View></PressableScale>
                            : selfReport
                              ? <PressableScale onPress={() => { haptic.tap(); selfReport(); }}><View style={s.qSelfReport}><Text style={s.qSelfReportTxt}>Zrobione</Text></View></PressableScale>
                              : <View style={s.qLocked}><Text style={s.qLockedTxt}>—</Text></View>}
                        </View>
                      );
                    })}
                    {claimedN > 0 && (
                      <View style={[s.qClaimedFoot, active.length > 0 && s.qRowBorder]}>
                        <CheckIcon size={12} color="#2AC68F" />
                        <Text style={s.qClaimedTxt}>{claimedN} odebrane dziś</Text>
                      </View>
                    )}
                  </>
                );
              })()}
            </View>
          </>
        )}

        {/* ── Weekly challenges ── */}
        {quests.weekly.length > 0 && (
          <>
            <Text style={s.section}>Tygodniowe</Text>
            <View style={{ width: '100%', gap: spacing[3] }}>
              {quests.weekly.map(w => (
                <View key={w.id} style={s.mCard}>
                  <View style={s.mTop}>
                    <Text style={s.mLabel}>{w.label}</Text>
                    {w.done && !w.claimed
                      ? <PressableScale onPress={() => onClaimWeekly(w.id, w.coins, w.xp, w.label)}>
                          <View style={s.mClaim}><CoinsIcon size={11} color="#0B0E1A" /><Text style={s.mClaimTxt}>Odbierz +{w.coins}</Text></View>
                        </PressableScale>
                      : w.claimed
                        ? <View style={[s.mTier, s.mTierClaimed]}><CheckIcon size={10} color="#2AC68F" /><Text style={[s.mTierTxt, { color: '#2AC68F' }]}>odebrane</Text></View>
                        : <Text style={s.mVal}>+{w.coins} 🪙</Text>}
                  </View>
                  <View style={s.moTrack}><View style={[s.moFill, { width: `${Math.round(w.progress * 100)}%`, backgroundColor: w.done ? '#2AC68F' : '#FBBF24' }]} /></View>
                  <Text style={s.moVal}>{w.value.toLocaleString('pl-PL')} / {w.target.toLocaleString('pl-PL')} {w.unit}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Monthly challenges ── */}
        {quests.monthly.length > 0 && (
          <>
            <Text style={s.section}>Miesięczne</Text>
            <View style={{ width: '100%', gap: spacing[3] }}>
              {quests.monthly.map(m => (
                <View key={m.id} style={s.mCard}>
                  <View style={s.mTop}>
                    <Text style={s.mLabel}>{m.label}</Text>
                    {m.done && !m.claimed
                      ? <PressableScale onPress={() => onClaimMonthly(m.id, m.coins, m.xp, m.label)}>
                          <View style={s.mClaim}><CoinsIcon size={11} color="#0B0E1A" /><Text style={s.mClaimTxt}>Odbierz +{m.coins}</Text></View>
                        </PressableScale>
                      : m.claimed
                        ? <View style={[s.mTier, s.mTierClaimed]}><CheckIcon size={10} color="#2AC68F" /><Text style={[s.mTierTxt, { color: '#2AC68F' }]}>odebrane</Text></View>
                        : <Text style={s.mVal}>+{m.coins} 🪙</Text>}
                  </View>
                  <View style={s.moTrack}><View style={[s.moFill, { width: `${Math.round(m.progress * 100)}%`, backgroundColor: m.done ? '#2AC68F' : '#FBBF24' }]} /></View>
                  <Text style={s.moVal}>{m.value.toLocaleString('pl-PL')} / {m.target.toLocaleString('pl-PL')} {m.unit}</Text>
                </View>
              ))}
            </View>
          </>
        )}

        {/* ── Milestone quests ── */}
        <Text style={s.section}>Cele</Text>
        <View style={{ width: '100%', gap: spacing[3] }}>
          {quests.milestones.map(m => (
            <View key={m.id} style={s.mCard}>
              <View style={s.mTop}>
                <Text style={s.mLabel}>{m.label}</Text>
                <Text style={s.mVal}>{m.value.toLocaleString('pl-PL')} {m.unit}{m.nextAt ? ` · do ${m.nextAt.toLocaleString('pl-PL')}` : ' · komplet'}</Text>
              </View>
              <View style={s.mTiers}>
                {m.tiers.map(t => (
                  t.reached && !t.claimed ? (
                    <PressableScale key={t.id} onPress={() => onClaimTier(t.id, t.coins, t.xp)}>
                      <View style={s.mClaim}><CoinsIcon size={11} color="#0B0E1A" /><Text style={s.mClaimTxt}>{t.at.toLocaleString('pl-PL')} → +{t.coins}</Text></View>
                    </PressableScale>
                  ) : (
                    <View key={t.id} style={[s.mTier, t.claimed && s.mTierClaimed]}>
                      {t.claimed && <CheckIcon size={10} color="#2AC68F" />}
                      <Text style={[s.mTierTxt, t.claimed && { color: '#2AC68F' }, !t.reached && { color: c.text.muted }]}>{t.at.toLocaleString('pl-PL')}</Text>
                      {!t.claimed && <Text style={s.mTierCoins}>+{t.coins}</Text>}
                    </View>
                  )
                ))}
              </View>
            </View>
          ))}
        </View>

        <View style={s.hintBox}>
          <Text style={s.hintTxt}>
            Monety zbierasz questami — za dbanie o SIEBIE. Wydaj je w sklepie 🛍️ na stroje i pokój dla {name}a, a energią z nawyków walcz z bossami ⚔️.
          </Text>
        </View>

        {/* ── Gablota trofeów (na dole, zwijana): loot z pokonanych bossów ── */}
        {trophies.length > 0 && (
          <View style={s.collapseCard}>
            <PressableScale onPress={() => { haptic.tap(); setTrophiesOpen(v => !v); }}>
              <View style={s.collapseHead}>
                <Text style={s.collapseTitle}>🏆 Gablota trofeów ({trophies.length})</Text>
                <Text style={s.collapseChev}>{trophiesOpen ? '▲' : '▼'}</Text>
              </View>
            </PressableScale>
            {trophiesOpen && (
              <>
                <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={{ gap: 10, paddingVertical: 2, marginTop: spacing[2] }}>
                  {trophies.map((t, i) => (
                    <View key={i} style={s.trophyItem}>
                      <View style={s.trophyPedestal}><Text style={{ fontSize: 26 }}>{t.emoji}</Text></View>
                      <Text style={s.trophyLoot} numberOfLines={1}>{t.loot}</Text>
                      <Text style={s.trophyBoss} numberOfLines={1}>{t.boss}</Text>
                    </View>
                  ))}
                </ScrollView>
                <Text style={s.addonHint}>Loot daje pasywne bonusy w walkach. Pokonuj bossów w zakładce ⚔.</Text>
              </>
            )}
          </View>
        )}
      </ScrollView>

      <CrateModal visible={crateOpen} onClose={() => setCrateOpen(false)} onOpened={() => setCelebrate(c => c + 1)} />
      <BoxRevealModal
        visible={!!boxReveal}
        reward={boxReveal?.reward ?? null}
        boxColor={boxReveal?.box.color ?? '#FBBF24'}
        boxEmoji={boxReveal?.box.emoji ?? '🎁'}
        onClose={() => setBoxReveal(null)}
      />

      <PupilNavbar current="pet" />
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 10, height: 30, borderWidth: 1, borderColor: '#FBBF2440', marginLeft: 6 },
  coinTxt: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: 110, alignItems: 'center' },

  stage: { alignItems: 'center', justifyContent: 'center', height: 300, marginTop: spacing[2], width: '100%' },
  room: { position: 'absolute', width: 290, height: 240, borderRadius: 28, top: 20, alignSelf: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  roomDecor: { position: 'absolute', fontSize: 22, opacity: 0.85 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing[2] },
  name: { fontSize: 24, fontWeight: '900', color: c.text.primary, letterSpacing: -0.5 },
  nameEdit: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[2] },
  nameInput: { fontSize: 20, fontWeight: '800', color: c.text.primary, borderBottomWidth: 2, borderBottomColor: c.accent.blue, minWidth: 140, textAlign: 'center', paddingVertical: 2 },
  nameSave: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.accent.green, alignItems: 'center', justifyContent: 'center' },
  moodChip: { marginTop: 6, paddingHorizontal: 12, paddingVertical: 4, borderRadius: radius.full, borderWidth: 1 },
  status: { fontSize: 14, fontWeight: '800' },
  tip: { fontSize: 12.5, color: c.text.muted, marginTop: 6, textAlign: 'center' },

  affRow: { flexDirection: 'row', alignItems: 'center', gap: 8, width: '100%', marginTop: spacing[3] },
  affHeart: { fontSize: 16 },
  affTrack: { flex: 1, height: 10, borderRadius: 5, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  affFill: { height: '100%', borderRadius: 5, backgroundColor: '#F472B6' },
  affTxt: { fontSize: 11, fontWeight: '700', color: c.text.muted, width: 68, textAlign: 'right' },
  crateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: spacing[2], paddingVertical: 11, borderRadius: radius.lg, backgroundColor: '#FBBF2418', borderWidth: 1, borderColor: '#FBBF2455' },
  crateBtnTxt: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },
  dailyBox: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: spacing[2], paddingVertical: 12, borderRadius: radius.lg, backgroundColor: '#FBBF24', borderWidth: 1, borderColor: '#FBBF24' },
  dailyBoxDone: { backgroundColor: c.bg.card, borderColor: c.border.default },
  dailyBoxTxt: { fontSize: 13, fontWeight: '900', color: '#0B0E1A', letterSpacing: 0.2 },
  dailyBoxDot: { width: 8, height: 8, borderRadius: 4, backgroundColor: '#E4342E' },

  levelCard: { width: '100%', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], marginTop: spacing[4] },
  levelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  levelTxt: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  levelSub: { fontSize: 11, fontWeight: '600', color: c.text.muted },
  xpTrack: { height: 10, borderRadius: 5, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 5, backgroundColor: '#A78BFA' },

  section: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[4], marginBottom: spacing[2] },

  // Room add-ons
  addonCard: { width: '100%', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], marginTop: spacing[4] },
  addonHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  coinPillAdd: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 3, borderWidth: 1, borderColor: '#FBBF2440' },
  coinPillTxt: { fontSize: 12, fontWeight: '800', color: '#FBBF24' },
  addonChip: { width: 92, alignItems: 'center', gap: 3, paddingVertical: 8, paddingHorizontal: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.elevated },
  addonName: { fontSize: 11, fontWeight: '700', color: c.text.secondary, textAlign: 'center' },
  addonState: { fontSize: 9.5, fontWeight: '700' },
  addonCost: { flexDirection: 'row', alignItems: 'center', gap: 3, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 7, paddingVertical: 2 },
  addonCostTxt: { fontSize: 10.5, fontWeight: '800', color: '#FBBF24' },
  addonHint: { fontSize: 10.5, color: c.text.muted, marginTop: 6 },

  // Collapsible cards (room add-ons + trophies)
  collapseCard: { width: '100%', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], marginTop: spacing[3] },
  collapseHead: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  collapseTitle: { flex: 1, fontSize: 12, fontWeight: '800', color: c.text.secondary, letterSpacing: 0.4, textTransform: 'uppercase' },
  collapseChev: { fontSize: 11, color: c.text.muted, fontWeight: '700' },

  // Trophy cabinet
  trophyItem: { width: 84, alignItems: 'center', gap: 3 },
  trophyPedestal: { width: 54, height: 54, borderRadius: 14, alignItems: 'center', justifyContent: 'center', backgroundColor: '#FBBF2418', borderWidth: 1, borderColor: '#FBBF2455' },
  trophyLoot: { fontSize: 11, fontWeight: '800', color: c.text.primary, textAlign: 'center' },
  trophyBoss: { fontSize: 9.5, fontWeight: '600', color: c.text.muted, textAlign: 'center' },
  needs: { width: '100%', gap: spacing[2] },
  needRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  needLabel: { width: 62, fontSize: 13, fontWeight: '700', color: c.text.secondary },
  needTrack: { flex: 1, height: 9, borderRadius: 5, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  needFill: { height: '100%', borderRadius: 5 },
  needVal: { width: 38, textAlign: 'right', fontSize: 11, fontWeight: '700', color: c.text.muted },

  hintBox: { width: '100%', marginTop: spacing[5], padding: spacing[3], borderRadius: radius.lg, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.subtle },
  hintTxt: { fontSize: 12, color: c.text.muted, lineHeight: 17, textAlign: 'center' },

  qHead: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[4], marginBottom: spacing[2] },
  claimBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF24', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  claimBadgeTxt: { fontSize: 10.5, fontWeight: '900', color: '#0B0E1A' },
  qCard: { width: '100%', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3] },
  missedCard: { borderColor: '#FBBF2466', backgroundColor: '#FBBF240D' },  // gold tint — these expire
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: spacing[3] },
  qRowBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  qLabel: { fontSize: 13.5, fontWeight: '700', color: c.text.primary },
  qNote: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  qReward: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  qRewardTxt: { fontSize: 12, fontWeight: '800', color: '#FBBF24' },
  qClaim: { backgroundColor: '#2AC68F', borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 10, shadowColor: '#2AC68F', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  qClaimTxt: { fontSize: 14, fontWeight: '900', color: '#07160F', letterSpacing: 0.2 },
  qDone: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2AC68F1A' },
  qClaimedFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing[2] },
  qClaimedTxt: { fontSize: 12, fontWeight: '700', color: c.text.muted, letterSpacing: 0.2 },
  qLocked: { width: 30, alignItems: 'center' },
  qLockedTxt: { fontSize: 14, color: c.text.muted, fontWeight: '800' },
  qSelfReport: { backgroundColor: c.bg.elevated, borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 9, borderWidth: 1, borderColor: c.border.default },
  qSelfReportTxt: { fontSize: 12.5, fontWeight: '800', color: c.text.secondary },

  mCard: { width: '100%', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3] },
  mTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[2] },
  mLabel: { fontSize: 13.5, fontWeight: '800', color: c.text.primary },
  mVal: { fontSize: 11, fontWeight: '600', color: c.text.muted, flexShrink: 1, textAlign: 'right', marginLeft: 8 },
  mTiers: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  mTier: { flexDirection: 'row', alignItems: 'center', gap: 3, borderWidth: 1, borderColor: c.border.default, borderRadius: radius.full, paddingHorizontal: 9, paddingVertical: 4 },
  mTierClaimed: { borderColor: '#2AC68F55', backgroundColor: '#2AC68F14' },
  mTierTxt: { fontSize: 11.5, fontWeight: '800', color: c.text.secondary },
  mTierCoins: { fontSize: 10.5, fontWeight: '700', color: '#FBBF24' },
  mClaim: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF24', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5 },
  mClaimTxt: { fontSize: 11.5, fontWeight: '900', color: '#0B0E1A' },
  moTrack: { height: 9, borderRadius: 5, backgroundColor: c.bg.elevated, overflow: 'hidden', marginTop: 2 },
  moFill: { height: '100%', borderRadius: 5 },
  moVal: { fontSize: 11, color: c.text.muted, fontWeight: '600', marginTop: 4 },
}));
