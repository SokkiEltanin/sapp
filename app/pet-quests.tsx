import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Coins, Coins as CoinsIcon, Check as CheckIcon, Gift, Swords } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import TrainingSessionModal, { SelfReportExercise } from '@/components/pet/TrainingSessionModal';
import PupilNavbar from '@/components/pet/PupilNavbar';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { useProfileStore } from '@/store/profileStore';
import { usePetHealthSync } from '@/hooks/usePetHealthSync';
import { ageFrom, targetsFor, dailyExercisePool, trainingStreakFrom } from '@/utils/personalQuests';
import { buildQuests, buildMissedDaily, sweetlessDaysFrom, QuestCtx, weekKeyOf } from '@/utils/quests';
import { useHabits, habitsDoneOn } from '@/hooks/useHabits';
import { useMoodStore } from '@/store/moodStore';
import { useExpensesStore } from '@/store/expensesStore';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = () => ymdOf(new Date());
const yesterdayISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymdOf(d); };

// Wydzielone z app/pet.tsx (2026-08-19, restrukturyzacja nawigacji — user: "reszta zadań
// będzie w osobnej zakładce"). Cała logika questCtx/quests/missed to 1:1 kopia stamtąd —
// health/water/budget dane przez usePetHealthSync (współdzielony hook, patrz jego komentarz
// dlaczego nie ma jednego globalnego store'a dla tego).
export default function PetQuests() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const {
    xp, coins, claimDailyFor, claimQuest, claimMonthly, claimWeekly, claimedQuests,
    dailyClaims, dayClaims, weeklyClaims, monthlyClaims, affection, affectionDay,
    pushupsDay, squatsDay, situpsDay, plankDay, stretchDay, trainingDays,
    markPushupsDone, markSquatsDone, markSitupsDone, markPlankDone, markStretchDone,
  } = usePetStore();
  const { birthdate, gender, trainingLevel } = useProfileStore();
  const lvl = levelFromXp(xp);
  const { health, waterGoal, waterToday, yData, cardsCollected } = usePetHealthSync();
  const { habits, todayDone, completions, getStreak } = useHabits();
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();

  const affToday = affectionDay === todayISO() ? affection : 0;

  const habitBestStreak = useMemo(() => habits.length ? Math.max(0, ...habits.map(h => getStreak(h.id))) : 0, [habits, getStreak]);
  const personalTargets = useMemo(
    () => trainingLevel ? targetsFor(trainingLevel, ageFrom(birthdate), gender) : null,
    [trainingLevel, birthdate, gender],
  );
  const todaysPool = useMemo(() => dailyExercisePool(todayISO()), []);
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
      trainingStreak: trainingStreakFrom(trainingDays, t),
      pushupTarget: personalTargets && todaysPool.includes('pushups') ? personalTargets.pushups : undefined,
      squatTarget: personalTargets && todaysPool.includes('squats') ? personalTargets.squats : undefined,
      situpTarget: personalTargets && todaysPool.includes('situps') ? personalTargets.situps : undefined,
      plankTarget: personalTargets && todaysPool.includes('plank') ? personalTargets.plankSeconds : undefined,
      stretchTarget: personalTargets && todaysPool.includes('stretch') ? personalTargets.stretchMinutes : undefined,
      bikeTarget: personalTargets && todaysPool.includes('bike') ? personalTargets.bikeMinutes : undefined,
      pushupsToday: pushupsDay === t,
      squatsToday: squatsDay === t,
      situpsToday: situpsDay === t,
      plankToday: plankDay === t,
      stretchToday: stretchDay === t,
      bikeMinutesToday: health.cyclingMinutesToday,
    };
  }, [health, moodEntries, todayDone.length, habits.length, expenses, habitBestStreak, cardsCollected, waterToday, waterGoal, affToday, trainingDays, personalTargets, todaysPool, pushupsDay, squatsDay, situpsDay, plankDay, stretchDay]);
  const quests = useMemo(
    () => buildQuests(questCtx, { claimedMilestones: claimedQuests, dailyClaims, weeklyClaims, monthlyClaims, today: todayISO(), week: weekKeyOf() }, lvl.level),
    [questCtx, claimedQuests, dailyClaims, weeklyClaims, monthlyClaims, lvl.level],
  );

  const missed = useMemo(() => {
    if (!yData) return [];
    const y = yesterdayISO();
    const yCtx: QuestCtx = {
      stepsToday: yData.steps,
      moodLoggedToday: moodEntries.some(e => e.date === y),
      habitsDone: habitsDoneOn(habits, completions, y).length,
      habitsTotal: habits.length,
      sweetlessDays: 0, bestStepDay: 0, habitBestStreak: 0, cardsCollected: 0, trainingStreak: 0,
      waterToday: yData.water, waterGoal,
      sleepMinutes: yData.sleep,
    };
    return buildMissedDaily(yCtx, dayClaims, y, lvl.level);
  }, [yData, moodEntries, habits, completions, waterGoal, dayClaims, lvl.level]);

  const claimMissed = (q: { id: string; label: string; coins: number; xp: number }) => {
    if (claimDailyFor(q.id, yesterdayISO(), q.coins, q.xp)) {
      haptic.success();
      toast.success(`Odebrano z wczoraj: ${q.label} +${q.coins}🪙`);
    }
  };
  const claimAllMissed = () => {
    const y = yesterdayISO();
    let coins = 0;
    missed.forEach(q => { if (claimDailyFor(q.id, y, q.coins, q.xp)) coins += q.coins; });
    if (coins > 0) { haptic.success(); toast.success(`Odebrano zaległe nagrody +${coins}🪙`); }
  };
  const onClaimTier = (id: string, c2: number, x: number) => {
    claimQuest(id, c2, x); haptic.success(); toast.success(`+${c2} 🪙 · nagroda odebrana`);
  };
  const onClaimWeekly = (id: string, c2: number, x: number, label: string) => {
    if (claimWeekly(id, c2, x)) { haptic.success(); toast.success(`+${c2} 🪙 · ${label}`); }
  };
  const onClaimMonthly = (id: string, c2: number, x: number, label: string) => {
    if (claimMonthly(id, c2, x)) { haptic.success(); toast.success(`+${c2} 🪙 · ${label}`); }
  };
  const onFightQuest = (id: string, coins: number, xp: number, label: string) => {
    haptic.tap();
    router.push(`/boss-fight?kind=quest&questId=${id}&questLabel=${encodeURIComponent(label)}&questCoins=${coins}&questXp=${xp}` as any);
  };
  const [training, setTraining] = useState<{ exercise: SelfReportExercise; target: number; action: () => void } | null>(null);

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}>
          <ChevronLeft size={22} color={c.text.primary} />
        </PressableScale>
        <Text style={s.headerTitle}>Zadania</Text>
        <View style={s.coinPill}>
          <Coins size={13} color="#FBBF24" />
          <Text style={s.coinTxt}>{coins}</Text>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
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

        <View style={s.qHead}>
          <Text style={s.section}>Codzienne</Text>
          {quests.claimableCount > 0 && <View style={s.claimBadge}><Gift size={11} color="#0B0E1A" /><Text style={s.claimBadgeTxt}>{quests.claimableCount} do odbioru</Text></View>}
        </View>
        <View style={s.qCard}>
          {(() => {
            const active = quests.daily.filter(q => !q.claimed);
            const claimedN = quests.daily.length - active.length;
            return (
              <>
                {active.map((q, i) => (
                  <View key={q.id} style={[s.qRow, i > 0 && s.qRowBorder]}>
                    <View style={{ flex: 1, minWidth: 0 }}>
                      <Text style={s.qLabel} numberOfLines={1}>{q.label}</Text>
                      {q.note && <Text style={s.qNote}>{q.note}</Text>}
                      {!q.done && q.progress != null && (
                        <View style={s.qProgTrack}><View style={[s.qProgFill, { width: `${Math.round(q.progress * 100)}%` }]} /></View>
                      )}
                    </View>
                    {q.done && <View style={s.qReward}><CoinsIcon size={11} color="#FBBF24" /><Text style={s.qRewardTxt}>{q.coins}</Text></View>}
                    {q.done
                      ? <PressableScale onPress={() => onFightQuest(q.id, q.coins, q.xp, q.label)}><View style={s.qFight}><Swords size={11} color="#fff" /><Text style={s.qFightTxt}>Walcz</Text></View></PressableScale>
                      : <View style={[s.qFight, s.qFightOff]}><Swords size={11} color="#fff" /><Text style={s.qFightTxt}>Walcz</Text></View>}
                  </View>
                ))}
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

        {quests.bonusDaily.length > 0 && (
          <>
            <Text style={s.section}>Bonusowe dziś</Text>
            <View style={s.qCard}>
              {(() => {
                const active = quests.bonusDaily.filter(q => !q.claimed);
                const claimedN = quests.bonusDaily.length - active.length;
                const selfReport: Record<string, { exercise: SelfReportExercise; target: number; action: () => void }> = {
                  b_pushups: { exercise: 'pushups', target: questCtx.pushupTarget ?? 0, action: markPushupsDone },
                  b_squats:  { exercise: 'squats',  target: questCtx.squatTarget ?? 0,  action: markSquatsDone },
                  b_situps:  { exercise: 'situps',  target: questCtx.situpTarget ?? 0,  action: markSitupsDone },
                  b_plank:   { exercise: 'plank',   target: questCtx.plankTarget ?? 0,  action: markPlankDone },
                  b_stretch: { exercise: 'stretch', target: questCtx.stretchTarget ?? 0, action: markStretchDone },
                };
                return (
                  <>
                    {active.map((q, i) => {
                      const session = selfReport[q.id];
                      return (
                        <View key={q.id} style={[s.qRow, i > 0 && s.qRowBorder]}>
                          <View style={{ flex: 1, minWidth: 0 }}>
                            <Text style={s.qLabel} numberOfLines={1}>{q.label}</Text>
                            {q.note && <Text style={s.qNote}>{q.note}</Text>}
                            {!q.done && q.progress != null && (
                              <View style={s.qProgTrack}><View style={[s.qProgFill, { width: `${Math.round(q.progress * 100)}%` }]} /></View>
                            )}
                          </View>
                          {q.done && <View style={s.qReward}><CoinsIcon size={11} color="#FBBF24" /><Text style={s.qRewardTxt}>{q.coins}</Text></View>}
                          {q.done
                            ? <PressableScale onPress={() => onFightQuest(q.id, q.coins, q.xp, q.label)}><View style={s.qFight}><Swords size={11} color="#fff" /><Text style={s.qFightTxt}>Walcz</Text></View></PressableScale>
                            : session
                              ? <PressableScale onPress={() => { haptic.tap(); setTraining(session); }}><View style={s.qSelfReport}><Text style={s.qSelfReportTxt}>Rozpocznij</Text></View></PressableScale>
                              : <View style={[s.qFight, s.qFightOff]}><Swords size={11} color="#fff" /><Text style={s.qFightTxt}>Walcz</Text></View>}
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
            Monety zbierasz questami — za dbanie o siebie. Wydaj je w sklepie 🛍️, a energią z nawyków walcz z bossami ⚔️.
          </Text>
        </View>
      </ScrollView>

      <TrainingSessionModal
        visible={!!training}
        exercise={training?.exercise ?? 'pushups'}
        target={training?.target ?? 0}
        onClose={() => setTraining(null)}
        onComplete={() => { training?.action(); }}
      />

      <PupilNavbar current="quests" />
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

  section: { alignSelf: 'flex-start', fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[4], marginBottom: spacing[2] },

  hintBox: { width: '100%', marginTop: spacing[5], padding: spacing[3], borderRadius: radius.lg, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.subtle },
  hintTxt: { fontSize: 12, color: c.text.muted, lineHeight: 17, textAlign: 'center' },

  qHead: { width: '100%', flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginTop: spacing[4], marginBottom: spacing[2] },
  claimBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF24', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 2 },
  claimBadgeTxt: { fontSize: 10.5, fontWeight: '900', color: '#0B0E1A' },
  qCard: { width: '100%', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: spacing[3] },
  missedCard: { borderColor: '#FBBF2466', backgroundColor: '#FBBF240D' },
  qRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: spacing[3] },
  qRowBorder: { borderTopWidth: 1, borderTopColor: c.border.subtle },
  qLabel: { fontSize: 13.5, fontWeight: '700', color: c.text.primary },
  qNote: { fontSize: 11, color: c.text.muted, marginTop: 1 },
  qReward: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  qRewardTxt: { fontSize: 12, fontWeight: '800', color: '#FBBF24' },
  qClaim: { backgroundColor: '#2AC68F', borderRadius: radius.full, paddingHorizontal: 18, paddingVertical: 10, shadowColor: '#2AC68F', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  qClaimTxt: { fontSize: 14, fontWeight: '900', color: '#07160F', letterSpacing: 0.2 },
  qFight: { flexDirection: 'row', alignItems: 'center', gap: 6, backgroundColor: '#EF4444', borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10, shadowColor: '#EF4444', shadowOpacity: 0.4, shadowRadius: 8, shadowOffset: { width: 0, height: 2 }, elevation: 3 },
  qFightTxt: { fontSize: 13, fontWeight: '900', color: '#fff', letterSpacing: 0.2 },
  qFightOff: { opacity: 0.35, shadowOpacity: 0 },
  qClaimedFoot: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingVertical: spacing[2] },
  qClaimedTxt: { fontSize: 12, fontWeight: '700', color: c.text.muted, letterSpacing: 0.2 },
  qProgTrack: { height: 4, borderRadius: 2, backgroundColor: c.bg.elevated, overflow: 'hidden', marginTop: 4, maxWidth: 160 },
  qProgFill: { height: '100%', borderRadius: 2, backgroundColor: '#38BDF8' },
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
