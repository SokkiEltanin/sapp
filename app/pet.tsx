import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput, TouchableOpacity } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Pencil, Check, Coins, ShoppingBag, Swords } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import CatArt from '@/components/pet/CatArt';
import { usePetStore, levelFromXp, growthStage } from '@/store/petStore';
import { computePetState, petStatusLine, PetInput } from '@/utils/petState';
import { buildQuests, sweetlessDaysFrom, QuestCtx } from '@/utils/quests';
import { equippedRoom } from '@/utils/petShop';
import { useHabits } from '@/hooks/useHabits';
import { useMoodStore } from '@/store/moodStore';
import { useExpensesStore } from '@/store/expensesStore';
import { getHealthHistory } from '@/utils/healthHistory';
import { getHealthGoals } from '@/utils/healthGoals';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { Coins as CoinsIcon, Check as CheckIcon, Gift } from 'lucide-react-native';

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};
const STAGE_SIZE = { baby: 150, kid: 172, teen: 194, adult: 214 } as const;

export default function Pet() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  const { name, xp, coins, setName, careTick, claimDaily, claimQuest, claimMonthly, claimedQuests, dailyClaims, monthlyClaims, equipped } = usePetStore();
  const worn = useMemo(() => ({ hat: equipped.hat, face: equipped.face, held: equipped.held }), [equipped]);
  const room = useMemo(() => equippedRoom(equipped), [equipped]);
  const { habits, todayDone, getStreak } = useHabits();
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();

  const [health, setHealth] = useState<{ steps: number; sleep: number; bestStepDay: number; stepTarget: number; stepsThisMonth: number }>({ steps: 0, sleep: 0, bestStepDay: 0, stepTarget: 0, stepsThisMonth: 0 });
  const [stepGoal, setStepGoal] = useState(10000);
  const [waterGoal, setWaterGoal] = useState(8);
  const [waterToday, setWaterToday] = useState(0);
  const [cardsCollected, setCardsCollected] = useState(0);
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(name);

  // Reload on every focus (screens stay mounted here), so logging mood / walking /
  // ticking a habit and coming back shows a fresh, reactive pet — not a stale one.
  const readHealth = useCallback(() => {
    const t = todayISO();
    const month = t.slice(0, 7);
    getHealthHistory(200).then(h => {
      const days = Object.keys(h).sort();
      const yest = days[days.length - 2];
      const steps = h[t]?.steps ?? 0;
      const sleep = (h[t]?.sleepMinutes ?? 0) || (yest ? h[yest]?.sleepMinutes ?? 0 : 0);
      const bestStepDay = Object.values(h).reduce((m, d) => Math.max(m, d.steps ?? 0), 0);
      const stepsThisMonth = Object.entries(h).filter(([d]) => d.startsWith(month)).reduce((m, [, v]) => m + (v.steps ?? 0), 0);
      const recent = Object.values(h).map(d => d.steps).filter(x => x > 0).slice(0, 14);
      const avg = recent.length ? recent.reduce((a, b) => a + b, 0) / recent.length : 0;
      const stepTarget = avg > 0 ? Math.max(8000, Math.ceil(avg * 1.1 / 500) * 500) : 0;
      setHealth({ steps, sleep, bestStepDay, stepTarget, stepsThisMonth });
    }).catch(() => {});
    getHealthGoals().then(g => { setStepGoal(g.stepGoal || 10000); setWaterGoal(g.waterGoal || 8); }).catch(() => {});
    AsyncStorage.getItem(`health_${t}`).then(raw => { try { setWaterToday(raw ? Number(JSON.parse(raw).water) || 0 : 0); } catch {} }).catch(() => {});
    AsyncStorage.getItem('skin_progress').then(raw => { if (raw) setCardsCollected(JSON.parse(raw).cards ?? 0); }).catch(() => {});
  }, []);
  const reload = useCallback(() => {
    readHealth(); // show cache immediately…
    // …and pull fresh steps/sleep from the watch, then re-read if anything changed.
    import('@/services/healthAutoSync')
      .then(({ autoSyncHealth }) => autoSyncHealth(3))
      .then(n => { if (n > 0) readHealth(); })
      .catch(() => {});
  }, [readHealth]);
  useFocusEffect(reload);

  const habitBestStreak = useMemo(() => habits.length ? Math.max(0, ...habits.map(h => getStreak(h.id))) : 0, [habits, getStreak]);
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
      moodDaysThisMonth,
      stepsThisMonth: health.stepsThisMonth,
    };
  }, [health, moodEntries, todayDone.length, habits.length, expenses, habitBestStreak, cardsCollected, waterToday, waterGoal]);
  const quests = useMemo(
    () => buildQuests(questCtx, { claimedMilestones: claimedQuests, dailyClaims, monthlyClaims, today: todayISO() }),
    [questCtx, claimedQuests, dailyClaims, monthlyClaims],
  );

  const onClaimMonthly = (id: string, c2: number, x: number, label: string) => {
    if (claimMonthly(id, c2, x)) { haptic.success(); toast.success(`+${c2} 🪙 · ${label}`); }
  };

  const onClaimDaily = (id: string, c2: number, x: number, label: string) => {
    if (claimDaily(id, c2, x)) { haptic.success(); toast.success(`+${c2} 🪙 · ${label}`); }
  };
  const onClaimTier = (id: string, c2: number, x: number) => {
    claimQuest(id, c2, x); haptic.success(); toast.success(`+${c2} 🪙 · nagroda odebrana`);
  };

  const input: PetInput = useMemo(() => {
    const t = todayISO();
    const todayMoods = moodEntries.filter(e => e.date === t);
    const avgMood = todayMoods.length ? todayMoods.reduce((a, b) => a + b.mood, 0) / todayMoods.length : null;
    return {
      stepsToday: health.steps, stepGoal, sleepMinutes: health.sleep,
      habitsDone: todayDone.length, habitsTotal: habits.length,
      moodLoggedToday: todayMoods.length > 0, avgMoodToday: avgMood,
      hour: new Date().getHours(),
    };
  }, [health, stepGoal, todayDone.length, habits.length, moodEntries]);

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
        <PressableScale onPress={() => router.push('/bosses' as any)} style={[s.shopBtn, { backgroundColor: '#38BDF818' }]}>
          <Swords size={17} color="#38BDF8" />
        </PressableScale>
        <PressableScale onPress={() => router.push('/pet-shop' as any)} style={s.shopBtn}>
          <ShoppingBag size={17} color="#A78BFA" />
        </PressableScale>
        <View style={s.coinPill}>
          <Coins size={13} color="#FBBF24" />
          <Text style={s.coinTxt}>{coins}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* stage (room backdrop if equipped) */}
        <View style={s.stage}>
          {room?.colors && (
            <LinearGradient colors={room.colors} start={{ x: 0, y: 0 }} end={{ x: 1, y: 1 }} style={s.room}>
              {room.decor?.map((d, i) => (
                <Text key={i} style={[s.roomDecor, i === 0 ? { top: 10, left: 14 } : { top: 16, right: 16 }]}>{d}</Text>
              ))}
            </LinearGradient>
          )}
          <CatArt expression={pet.expression} size={STAGE_SIZE[stage] + 30} />
        </View>

        {/* name + status */}
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
        <Text style={[s.status, { color: pet.color }]}>{pet.label}</Text>
        <Text style={s.tip}>{petStatusLine(pet)}</Text>

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

        {/* ── Daily quests ── */}
        <View style={s.qHead}>
          <Text style={s.section}>Codzienne</Text>
          {quests.claimableCount > 0 && <View style={s.claimBadge}><Gift size={11} color="#0B0E1A" /><Text style={s.claimBadgeTxt}>{quests.claimableCount} do odbioru</Text></View>}
        </View>
        <View style={s.qCard}>
          {quests.daily.map((q, i) => (
            <View key={q.id} style={[s.qRow, i > 0 && s.qRowBorder]}>
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={[s.qLabel, q.claimed && { color: c.text.muted }]} numberOfLines={1}>{q.label}</Text>
                {q.note && <Text style={s.qNote}>{q.note}</Text>}
              </View>
              <View style={s.qReward}><CoinsIcon size={11} color="#FBBF24" /><Text style={s.qRewardTxt}>{q.coins}</Text></View>
              {q.claimed
                ? <View style={s.qDone}><CheckIcon size={14} color="#2AC68F" /></View>
                : q.done
                  ? <PressableScale onPress={() => onClaimDaily(q.id, q.coins, q.xp, q.label)}><View style={s.qClaim}><Text style={s.qClaimTxt}>Odbierz</Text></View></PressableScale>
                  : <View style={s.qLocked}><Text style={s.qLockedTxt}>—</Text></View>}
            </View>
          ))}
        </View>

        {/* ── Bonus dailies (adaptive, higher reward) ── */}
        {quests.bonusDaily.length > 0 && (
          <>
            <Text style={s.section}>Bonusowe dziś</Text>
            <View style={s.qCard}>
              {quests.bonusDaily.map((q, i) => (
                <View key={q.id} style={[s.qRow, i > 0 && s.qRowBorder]}>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={[s.qLabel, q.claimed && { color: c.text.muted }]} numberOfLines={1}>{q.label}</Text>
                    {q.note && <Text style={s.qNote}>{q.note}</Text>}
                  </View>
                  <View style={s.qReward}><CoinsIcon size={11} color="#FBBF24" /><Text style={s.qRewardTxt}>{q.coins}</Text></View>
                  {q.claimed
                    ? <View style={s.qDone}><CheckIcon size={14} color="#2AC68F" /></View>
                    : q.done
                      ? <PressableScale onPress={() => onClaimDaily(q.id, q.coins, q.xp, q.label)}><View style={s.qClaim}><Text style={s.qClaimTxt}>Odbierz</Text></View></PressableScale>
                      : <View style={s.qLocked}><Text style={s.qLockedTxt}>—</Text></View>}
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
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = (c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  coinPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 10, height: 30, borderWidth: 1, borderColor: '#FBBF2440', marginLeft: 6 },
  coinTxt: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },
  shopBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: '#A78BFA18', marginLeft: 6 },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8], alignItems: 'center' },

  stage: { alignItems: 'center', justifyContent: 'center', height: 250, marginTop: spacing[2], width: '100%' },
  room: { position: 'absolute', width: 250, height: 200, borderRadius: 26, top: 20, alignSelf: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  roomDecor: { position: 'absolute', fontSize: 22, opacity: 0.85 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, marginTop: spacing[2] },
  name: { fontSize: 24, fontWeight: '900', color: c.text.primary, letterSpacing: -0.5 },
  nameEdit: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[2] },
  nameInput: { fontSize: 20, fontWeight: '800', color: c.text.primary, borderBottomWidth: 2, borderBottomColor: c.accent.blue, minWidth: 140, textAlign: 'center', paddingVertical: 2 },
  nameSave: { width: 34, height: 34, borderRadius: 17, backgroundColor: c.accent.green, alignItems: 'center', justifyContent: 'center' },
  status: { fontSize: 15, fontWeight: '800', marginTop: 4 },
  tip: { fontSize: 12.5, color: c.text.muted, marginTop: 2, textAlign: 'center' },

  levelCard: { width: '100%', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], marginTop: spacing[4] },
  levelTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 8 },
  levelTxt: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  levelSub: { fontSize: 11, fontWeight: '600', color: c.text.muted },
  xpTrack: { height: 10, borderRadius: 5, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  xpFill: { height: '100%', borderRadius: 5, backgroundColor: '#A78BFA' },

  section: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[4], marginBottom: spacing[2] },
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
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: spacing[3] },
  qRowBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  qLabel: { fontSize: 13.5, fontWeight: '700', color: c.text.primary },
  qNote: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  qReward: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  qRewardTxt: { fontSize: 12, fontWeight: '800', color: '#FBBF24' },
  qClaim: { backgroundColor: '#2AC68F', borderRadius: radius.full, paddingHorizontal: 12, paddingVertical: 6 },
  qClaimTxt: { fontSize: 12, fontWeight: '800', color: '#0B1E17' },
  qDone: { width: 30, height: 30, borderRadius: 15, alignItems: 'center', justifyContent: 'center', backgroundColor: '#2AC68F1A' },
  qLocked: { width: 30, alignItems: 'center' },
  qLockedTxt: { fontSize: 14, color: c.text.muted, fontWeight: '800' },

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
});
