import { useCallback, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing, Modal, Pressable } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Zap, Lock, Check, Swords } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import CatArt from '@/components/pet/CatArt';
import Confetti from '@/components/achievements/Confetti';
import { usePetStore, levelFromXp } from '@/store/petStore';
import {
  BOSSES, Boss, bossBonuses, energyFromData, weaknessMult, atkMultiplier, computeDamage, bossRemaining,
  bossGuarded, weaknessMet, WeaknessCtx,
} from '@/utils/bosses';
import { raidForWeek, raidHpFor, raidCoins, raidXp } from '@/utils/raid';
import { sweetlessDaysFrom, weekKeyOf } from '@/utils/quests';
import { useHabits } from '@/hooks/useHabits';
import { getCounts, getWaterGlasses } from '@/utils/habits';
import { getHealthGoals } from '@/utils/healthGoals';
import { useMoodStore } from '@/store/moodStore';
import { useExpensesStore } from '@/store/expensesStore';
import { getHealthHistory } from '@/utils/healthHistory';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const todayISO = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

// kolor aury bossa wg jego słabości (arty/klimat)
const WEAK_COLOR: Record<string, string> = {
  steps: '#46B0DE', sweetless: '#F472B6', habits: '#2AC68F', mood: '#A78BFA', sleep: '#5B7BE3', water: '#38BDF8',
};

export default function Bosses() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { xp, energy, ownedItems, defeatedBosses, bossHp, syncEnergy, attackBoss, defeatBoss, healBoss, raidWeek, raidHp, raidWon, raidEnsure, raidAttack, raidClaim } = usePetStore();
  const { habits, todayDone } = useHabits();
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();

  const [steps, setSteps] = useState(0);
  const [sleepMin, setSleepMin] = useState(0);
  const [waterToday, setWaterToday] = useState(0);
  const [waterGoal, setWaterGoal] = useState(8);
  const [victory, setVictory] = useState<Boss | null>(null);
  const [raidVictory, setRaidVictory] = useState(false);
  const bonuses = useMemo(() => bossBonuses(ownedItems), [ownedItems]);
  const level = useMemo(() => levelFromXp(xp).level, [xp]);

  const t = todayISO();
  const moodLoggedToday = moodEntries.some(e => e.date === t);
  const boughtSweetToday = useMemo(() => expenses.some(e => e.type !== 'income' && (e.date ?? '').slice(0, 10) === t
    && (e.receiptItems ?? []).some(it => !it.excluded && (it.tags ?? []).some(tg => tg === 'słodycze' || tg === 'przekąski'))), [expenses]);
  const sweetlessDays = useMemo(() => sweetlessDaysFrom(expenses), [expenses]);
  const habitsRatio = habits.length ? todayDone.length / habits.length : 0;
  const waterRatio = waterGoal > 0 ? waterToday / waterGoal : 0;
  const wc: WeaknessCtx = { stepsToday: steps, sweetlessDays, habitsRatio, moodLoggedToday, boughtSweetToday, sleepMinutes: sleepMin, waterRatio };

  // Energy = self-care over a ROLLING window, NOT the calendar day. The old version
  // reset to ~0 every morning (today's habits/mood are empty right after midnight) even
  // though you were active yesterday — nonsense that nagged you at dawn. Now energy is
  // max(today, 70% of yesterday): yesterday's activity carries you into the morning and
  // today's takes over as it builds up. Steps already use a rolling ~24 h estimate.
  const reload = useCallback(() => {
    getHealthHistory(3).then(async h => {
      const today = new Date();
      const y = new Date(today); y.setDate(y.getDate() - 1);
      const yISO = `${y.getFullYear()}-${String(y.getMonth() + 1).padStart(2, '0')}-${String(y.getDate()).padStart(2, '0')}`;
      const stepsToday = h[todayISO()]?.steps ?? 0;
      const stepsYest  = h[yISO]?.steps ?? 0;
      const dayFrac = (today.getHours() * 60 + today.getMinutes()) / 1440;
      const st = Math.round(stepsToday + stepsYest * (1 - dayFrac));          // rolling ~24 h estimate
      setSteps(st);
      setSleepMin(h[todayISO()]?.sleepMinutes ?? 0);
      const todayE = energyFromData({ stepsToday: st, habitsDone: todayDone.length, moodLoggedToday: moodEntries.some(m => m.date === todayISO()), boughtSweetToday });
      // Yesterday's completed self-care as a floor (decayed), so a fresh morning ≠ 0.
      let yestE = 0;
      try {
        const yc = await getCounts(yISO);
        const yHabits = habits.filter(hb => (yc[hb.id] ?? 0) >= (hb.type === 'count' ? (hb.dailyGoal ?? 1) : 1)).length;
        yestE = energyFromData({ stepsToday: stepsYest, habitsDone: yHabits, moodLoggedToday: moodEntries.some(m => m.date === yISO), boughtSweetToday: false });
      } catch {}
      syncEnergy(Math.max(todayE, Math.round(yestE * 0.7)), bonuses.energyMult);
    }).catch(() => {});
    getWaterGlasses(todayISO()).then(setWaterToday).catch(() => {});
    getHealthGoals().then(g => setWaterGoal(g.waterGoal || 8)).catch(() => {});
    raidEnsure(weekKeyOf(), raidHpFor(level, weekKeyOf()));
  }, [todayDone.length, moodEntries, boughtSweetToday, bonuses.energyMult, syncEnergy, habits, level, raidEnsure]);
  useFocusEffect(reload);

  // sequential campaign: current = first not-yet-defeated boss
  const current = BOSSES.find(b => !defeatedBosses.includes(b.id)) ?? null;
  const unlocked = current ? level >= current.unlockLevel : false;
  const remaining = current ? bossRemaining(current, bossHp) : 0;

  // ── raid tygodniowy ──
  const weekKey = weekKeyOf();
  const raid = raidForWeek(weekKey);
  const raidMaxHp = raidHpFor(level, weekKey);
  const raidRemaining = raidWeek === weekKey ? raidHp : raidMaxHp;
  const raidDone = raidWon.includes(weekKey);
  const raidUnlocked = level >= 3;
  const raidWeakMult = weaknessMult({ weakness: raid.weakness } as Boss, wc);
  const raidPreviewDmg = Math.round(energy * atkMultiplier(level, bonuses) * raidWeakMult);

  // attack animation
  const shake = useRef(new Animated.Value(0)).current;
  const dmgY = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;    // scale-punch bossa przy trafieniu
  const flash = useRef(new Animated.Value(0)).current;  // błysk trafienia
  const [lastHit, setLastHit] = useState<{ dmg: number; crit: boolean; guarded: boolean; healed: number } | null>(null);
  const rShake = useRef(new Animated.Value(0)).current;
  const rDmgY = useRef(new Animated.Value(0)).current;
  const [raidHit, setRaidHit] = useState<{ dmg: number; crit: boolean } | null>(null);

  const playHitFx = (crit: boolean) => {
    shake.setValue(0); dmgY.setValue(0); pop.setValue(0); flash.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: crit ? 1 : 0.5, duration: 50, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(pop, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(pop, { toValue: 0, friction: 4, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(flash, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(flash, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
      Animated.timing(dmgY, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  const attack = () => {
    if (!current || !unlocked) return;
    if (energy <= 0) { haptic.error(); toast.info('Brak energii — zadbaj o siebie, by naładować cios'); return; }
    let { damage, crit } = computeDamage(energy, level, bonuses, current, wc);
    const guarded = bossGuarded(current, wc);
    if (guarded) damage = Math.round(damage * 0.5);   // OSŁONA — dziś nakarmiłeś bossa
    let healed = 0;
    if (current.regenPct && !weaknessMet(current, wc)) {   // REGENERACJA — zaniedbałeś jego słabość
      healed = Math.round(current.hp * current.regenPct);
      if (healed > 0) healBoss(current.id, healed, current.hp);
    }
    haptic.medium();
    setLastHit({ dmg: damage, crit, guarded, healed });
    playHitFx(crit);
    const res = attackBoss(current.id, current.hp, damage, bonuses.dodge);
    if (res.defeated) {
      setTimeout(() => { defeatBoss(current.id, current.loot.id, current.coins, current.xp); haptic.success(); setVictory(current); }, 320);
    }
  };

  const doRaid = () => {
    if (raidDone) { haptic.tap(); toast.info('Raid tego tygodnia pokonany! Nowy w poniedziałek.'); return; }
    if (!raidUnlocked) { haptic.error(); toast.info('Raid odblokujesz na poziomie 3'); return; }
    if (energy <= 0) { haptic.error(); toast.info('Brak energii — zadbaj o siebie, by naładować cios'); return; }
    const crit = Math.random() < bonuses.crit;
    const damage = Math.round(energy * atkMultiplier(level, bonuses) * raidWeakMult * (crit ? 2 : 1));
    haptic.medium();
    setRaidHit({ dmg: damage, crit });
    rShake.setValue(0); rDmgY.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(rShake, { toValue: 1, duration: 55, useNativeDriver: true }),
        Animated.timing(rShake, { toValue: -1, duration: 55, useNativeDriver: true }),
        Animated.timing(rShake, { toValue: 0, duration: 55, useNativeDriver: true }),
      ]),
      Animated.timing(rDmgY, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    const res = raidAttack(damage);
    if (res.defeated) {
      setTimeout(() => { raidClaim(weekKey, raidCoins(level), raidXp(level)); haptic.success(); setRaidVictory(true); }, 300);
    }
  };

  const previewDmg = current ? Math.round(energy * atkMultiplier(level, bonuses) * weaknessMult(current, wc)) : 0;
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const flashOp = flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] });
  const floatY = dmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
  const floatOp = dmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const rShakeX = rShake.interpolate({ inputRange: [-1, 1], outputRange: [-7, 7] });
  const rFloatY = rDmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -44] });
  const rFloatOp = rDmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Bossy</Text>
        <View style={s.energyPill}><Zap size={13} color="#38BDF8" /><Text style={s.energyTxt}>{energy}</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── RAID TYGODNIOWY ── */}
        <View style={s.raidCard}>
          <View style={s.raidHead}>
            <Text style={s.raidKicker}>RAID TYGODNIA</Text>
            <View style={s.raidMedals}><Text style={s.raidMedalsTxt}>🏆 {raidWon.length}</Text></View>
          </View>
          <View style={s.raidBody}>
            <View style={s.raidAvatarWrap}>
              <View style={[s.auraSmall, { backgroundColor: (WEAK_COLOR[raid.weakness] ?? '#888') + '22', borderColor: (WEAK_COLOR[raid.weakness] ?? '#888') + '55' }]} pointerEvents="none" />
              <Animated.Text style={[s.raidEmoji, { transform: [{ translateX: rShakeX }] }]}>{raid.emoji}</Animated.Text>
              {raidHit && (
                <Animated.Text style={[s.rDmgFloat, { opacity: rFloatOp, transform: [{ translateY: rFloatY }], color: raidHit.crit ? '#FDE047' : '#F87171' }]}>-{raidHit.dmg}{raidHit.crit ? ' KRYT!' : ''}</Animated.Text>
              )}
            </View>
            <View style={{ flex: 1, minWidth: 0 }}>
              <Text style={s.raidName} numberOfLines={1}>{raid.name}</Text>
              <Text style={s.raidTaunt} numberOfLines={1}>„{raid.taunt}"</Text>
              <View style={s.hpTrackSm}><View style={[s.hpFill, { width: `${Math.round((raidDone ? 0 : raidRemaining) / raidMaxHp * 100)}%` }]} /></View>
              <Text style={s.raidHpTxt}>{raidDone ? 'POKONANY ✓' : `${raidRemaining} / ${raidMaxHp} HP`} · słaby na {raid.weaknessLabel}</Text>
            </View>
          </View>
          {raidDone ? (
            <Text style={s.raidDoneTxt}>Medal zdobyty! Nowy raid w poniedziałek.</Text>
          ) : raidUnlocked ? (
            <PressableScale onPress={doRaid}>
              <View style={[s.raidBtn, energy <= 0 && { opacity: 0.5 }]}>
                <Swords size={16} color="#0B0E1A" /><Text style={s.raidBtnTxt}>Uderz w raid · ~{raidPreviewDmg}</Text>
              </View>
            </PressableScale>
          ) : (
            <Text style={s.raidLockTxt}>Raid odblokujesz na poziomie 3 (masz {level}).</Text>
          )}
          <Text style={s.raidReward}>Nagroda: {raid.trophyEmoji} medal tygodnia · +{raidCoins(level)} 🪙 · +{raidXp(level)} XP</Text>
        </View>

        {!current ? (
          <View style={s.done}>
            <Swords size={30} color={c.text.muted} />
            <Text style={s.doneTxt}>Wszyscy bossowie pokonani! Kolejni wkrótce.</Text>
          </View>
        ) : (
          <View style={s.arena}>
            <View style={s.bossTop}>
              <View style={[s.aura, { backgroundColor: (WEAK_COLOR[current.weakness] ?? '#888') + '22', borderColor: (WEAK_COLOR[current.weakness] ?? '#888') + '55' }]} pointerEvents="none" />
              <Animated.Text style={[s.bossEmoji, { transform: [{ translateX: shakeX }, { scale: popScale }] }]}>{current.emoji}</Animated.Text>
              <Animated.View pointerEvents="none" style={[s.hitFlash, { opacity: flashOp, backgroundColor: lastHit?.crit ? '#FDE047' : '#F87171' }]} />
              {lastHit && (
                <Animated.Text style={[s.dmgFloat, { opacity: floatOp, transform: [{ translateY: floatY }], color: lastHit.crit ? '#FDE047' : '#F87171' }]}>
                  -{lastHit.dmg}{lastHit.crit ? ' KRYT!' : ''}
                </Animated.Text>
              )}
            </View>
            <Text style={s.bossName}>{current.name}</Text>
            <Text style={s.bossTaunt}>„{current.taunt}"</Text>
            {lastHit?.guarded && <Text style={s.mechNote}>🛡️ Osłona: dziś nakarmiłeś bossa — cios ×0.5</Text>}
            {!!lastHit?.healed && <Text style={s.mechNoteHeal}>🩹 Boss zregenerował +{lastHit.healed} (zaniedbanie: {current.weaknessLabel})</Text>}

            {/* HP */}
            <View style={s.hpTrack}><View style={[s.hpFill, { width: `${Math.round(remaining / current.hp * 100)}%` }]} /></View>
            <Text style={s.hpTxt}>{remaining} / {current.hp} HP</Text>

            {unlocked ? (
              <>
                <View style={s.weakBox}>
                  <Text style={s.weakTxt}>Słaby na: <Text style={{ color: '#2AC68F', fontWeight: '800' }}>{current.weaknessLabel}</Text> · dziś ×{weaknessMult(current, wc).toFixed(2)}</Text>
                  <Text style={s.previewTxt}>Twój cios: ~{previewDmg} obrażeń (energia {energy})</Text>
                  {(current.guard || current.regenPct) && (
                    <Text style={s.mechHint}>
                      {current.guard === 'sweets' ? '🛡️ dziś bez słodyczy — inaczej cios ×0.5. ' : current.guard === 'poorSleep' ? '🛡️ wyśpij się (7h+) — inaczej cios ×0.5. ' : ''}
                      {current.regenPct ? '🩹 leczy się, gdy zaniedbasz jego słabość.' : ''}
                    </Text>
                  )}
                </View>
                <View style={s.fightRow}>
                  <CatArt size={80} expression="content" />
                  <PressableScale onPress={attack} style={{ flex: 1 }}>
                    <View style={[s.attackBtn, energy <= 0 && { opacity: 0.5 }]}>
                      <Swords size={18} color="#0B0E1A" />
                      <Text style={s.attackTxt}>Atakuj!</Text>
                    </View>
                  </PressableScale>
                </View>
                <Text style={s.loot}>Nagroda: {current.loot.emoji} {current.loot.name} · {current.loot.desc} · +{current.coins} 🪙</Text>
              </>
            ) : (
              <View style={s.lockBox}>
                <Lock size={16} color={c.text.muted} />
                <Text style={s.lockTxt}>Odblokujesz na poziomie {current.unlockLevel} (masz {level}). Rozwijaj pupila questami.</Text>
              </View>
            )}
          </View>
        )}

        {/* campaign list */}
        <Text style={s.section}>Kampania</Text>
        <View style={{ gap: spacing[2] }}>
          {BOSSES.map(b => {
            const def = defeatedBosses.includes(b.id);
            const isCur = current?.id === b.id;
            const lock = !def && level < b.unlockLevel;
            return (
              <View key={b.id} style={[s.row, isCur && { borderColor: '#38BDF8' }]}>
                <Text style={[s.rowEmoji, (def || lock) && { opacity: 0.5 }]}>{b.emoji}</Text>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rowName} numberOfLines={1}>{b.name}</Text>
                  <Text style={s.rowSub}>{def ? `Pokonany · ${b.loot.emoji} ${b.loot.name}` : lock ? `Poziom ${b.unlockLevel}` : `${b.hp} HP · słaby na ${b.weaknessLabel}`}</Text>
                </View>
                {def ? <View style={s.rowBadge}><Check size={14} color="#2AC68F" /></View>
                  : lock ? <Lock size={15} color={c.text.muted} />
                    : isCur ? <View style={[s.rowBadge, { backgroundColor: '#38BDF822' }]}><Swords size={13} color="#38BDF8" /></View> : null}
              </View>
            );
          })}
        </View>

        {/* trophies */}
        {ownedItems.some(i => i.startsWith('loot_')) && (
          <>
            <Text style={s.section}>Trofea</Text>
            <View style={s.trophies}>
              {BOSSES.filter(b => ownedItems.includes(b.loot.id)).map(b => (
                <View key={b.loot.id} style={s.trophy}>
                  <Text style={s.trophyEmoji}>{b.loot.emoji}</Text>
                  <Text style={s.trophyName} numberOfLines={1}>{b.loot.name}</Text>
                  <Text style={s.trophyBonus} numberOfLines={2}>{b.loot.desc}</Text>
                </View>
              ))}
            </View>
          </>
        )}
        {raidWon.length > 0 && (
          <>
            <Text style={s.section}>Medale raidów ({raidWon.length})</Text>
            <View style={s.medalWall}>
              {raidWon.slice().reverse().map(wk => (
                <View key={wk} style={s.medal}>
                  <Text style={s.medalEmoji}>{raidForWeek(wk).trophyEmoji}</Text>
                  <Text style={s.medalWk} numberOfLines={1}>{wk}</Text>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>

      {/* victory */}
      <Modal visible={!!victory} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setVictory(null)}>
        <Pressable style={s.vBackdrop} onPress={() => setVictory(null)}>
          <Confetti colors={['#FDE047', '#2AC68F', '#38BDF8', '#F472B6']} />
          {victory && (
            <View style={s.vCenter} pointerEvents="none">
              <Text style={s.vKicker}>POKONANY!</Text>
              <Text style={s.vBoss}>{victory.emoji}</Text>
              <Text style={s.vName}>{victory.name}</Text>
              <View style={s.vLoot}>
                <Text style={s.vLootEmoji}>{victory.loot.emoji}</Text>
                <Text style={s.vLootName}>{victory.loot.name}</Text>
                <Text style={s.vLootDesc}>{victory.loot.desc}</Text>
              </View>
              <Text style={s.vReward}>+{victory.coins} 🪙 · +{victory.xp} XP</Text>
            </View>
          )}
          <Text style={s.vHint}>Stuknij, aby zamknąć</Text>
        </Pressable>
      </Modal>

      {/* raid victory */}
      <Modal visible={raidVictory} transparent statusBarTranslucent animationType="fade" onRequestClose={() => setRaidVictory(false)}>
        <Pressable style={s.vBackdrop} onPress={() => setRaidVictory(false)}>
          <Confetti colors={['#FDE047', '#38BDF8', '#2AC68F', '#F472B6']} />
          <View style={s.vCenter} pointerEvents="none">
            <Text style={s.vKicker}>RAID POKONANY!</Text>
            <Text style={s.vBoss}>{raid.trophyEmoji}</Text>
            <Text style={s.vName}>{raid.name}</Text>
            <Text style={s.vReward}>Medal tygodnia · +{raidCoins(level)} 🪙 · +{raidXp(level)} XP</Text>
          </View>
          <Text style={s.vHint}>Stuknij, aby zamknąć</Text>
        </Pressable>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  energyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#38BDF818', borderRadius: radius.full, paddingHorizontal: 10, height: 30, borderWidth: 1, borderColor: '#38BDF840' },
  energyTxt: { fontSize: 13, fontWeight: '800', color: '#38BDF8' },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: spacing[8] },

  done: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  doneTxt: { fontSize: 13, color: c.text.muted, textAlign: 'center', maxWidth: 260 },

  arena: { alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4] },
  bossTop: { height: 92, justifyContent: 'center', alignItems: 'center' },
  bossEmoji: { fontSize: 74 },
  dmgFloat: { position: 'absolute', top: 0, fontSize: 20, fontWeight: '900' },
  bossName: { fontSize: 20, fontWeight: '900', color: c.text.primary, marginTop: 4 },
  bossTaunt: { fontSize: 12.5, color: c.text.muted, fontStyle: 'italic', marginTop: 2, marginBottom: spacing[3] },
  hpTrack: { width: '100%', height: 14, borderRadius: 7, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 7, backgroundColor: '#EF4444' },
  hpTxt: { fontSize: 12, fontWeight: '700', color: c.text.secondary, marginTop: 4 },

  weakBox: { alignItems: 'center', marginTop: spacing[3], gap: 2 },
  weakTxt: { fontSize: 12.5, color: c.text.secondary, fontWeight: '600' },
  previewTxt: { fontSize: 12, color: c.text.muted },
  fightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[3], width: '100%' },
  attackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FBBF24', borderRadius: radius.lg, paddingVertical: 16 },
  attackTxt: { fontSize: 17, fontWeight: '900', color: '#0B0E1A' },
  loot: { fontSize: 11.5, color: c.text.muted, textAlign: 'center', marginTop: spacing[3] },
  lockBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[3], paddingHorizontal: spacing[3] },
  lockTxt: { flex: 1, fontSize: 12.5, color: c.text.muted, lineHeight: 17 },

  section: { fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[5], marginBottom: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3] },
  rowEmoji: { fontSize: 30 },
  rowName: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  rowSub: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },
  rowBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2AC68F1A', alignItems: 'center', justifyContent: 'center' },

  trophies: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  trophy: { width: '48%', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], alignItems: 'center', flexGrow: 1 },
  trophyEmoji: { fontSize: 26 },
  trophyName: { fontSize: 12.5, fontWeight: '800', color: c.text.primary, marginTop: 4 },
  trophyBonus: { fontSize: 10.5, color: '#2AC68F', fontWeight: '700', textAlign: 'center', marginTop: 1 },

  vBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,8,16,0.94)', paddingHorizontal: 32 },
  vCenter: { alignItems: 'center' },
  vKicker: { fontSize: 14, fontWeight: '900', letterSpacing: 3, color: '#FDE047', marginBottom: 10 },
  vBoss: { fontSize: 72, opacity: 0.6 },
  vName: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 6 },
  vLoot: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, paddingVertical: spacing[3], paddingHorizontal: spacing[5], marginTop: spacing[4] },
  vLootEmoji: { fontSize: 34 },
  vLootName: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 4 },
  vLootDesc: { fontSize: 12, color: '#2AC68F', fontWeight: '700', marginTop: 1 },
  vReward: { fontSize: 14, fontWeight: '800', color: '#FDE047', marginTop: spacing[4] },
  vHint: { position: 'absolute', bottom: 48, color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: '600' },

  // aura / błysk / noty mechanik
  aura: { position: 'absolute', width: 116, height: 116, borderRadius: 58, borderWidth: 1 },
  hitFlash: { position: 'absolute', width: 90, height: 90, borderRadius: 45 },
  mechNote: { fontSize: 11.5, color: '#F4B740', fontWeight: '800', marginTop: 4, textAlign: 'center' },
  mechNoteHeal: { fontSize: 11.5, color: '#7DD3FC', fontWeight: '800', marginTop: 2, textAlign: 'center' },
  mechHint: { fontSize: 11, color: c.text.muted, textAlign: 'center', marginTop: 3, lineHeight: 15 },

  // raid tygodniowy
  raidCard: { backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: '#A78BFA55', padding: spacing[3], marginBottom: spacing[3], gap: spacing[2] },
  raidHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  raidKicker: { fontSize: 11, fontWeight: '900', letterSpacing: 1.2, color: '#A78BFA' },
  raidMedals: { backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 3, borderWidth: 1, borderColor: '#FBBF2440' },
  raidMedalsTxt: { fontSize: 12, fontWeight: '800', color: '#FBBF24' },
  raidBody: { flexDirection: 'row', alignItems: 'center', gap: spacing[3] },
  raidAvatarWrap: { width: 76, height: 76, alignItems: 'center', justifyContent: 'center' },
  auraSmall: { position: 'absolute', width: 72, height: 72, borderRadius: 36, borderWidth: 1 },
  raidEmoji: { fontSize: 46 },
  rDmgFloat: { position: 'absolute', top: -6, fontSize: 16, fontWeight: '900' },
  raidName: { fontSize: 15, fontWeight: '900', color: c.text.primary },
  raidTaunt: { fontSize: 11.5, color: c.text.muted, fontStyle: 'italic', marginTop: 1 },
  hpTrackSm: { width: '100%', height: 10, borderRadius: 5, backgroundColor: c.bg.elevated, overflow: 'hidden', marginTop: 6 },
  raidHpTxt: { fontSize: 11, fontWeight: '700', color: c.text.secondary, marginTop: 3 },
  raidBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#A78BFA', borderRadius: radius.lg, paddingVertical: 13 },
  raidBtnTxt: { fontSize: 14, fontWeight: '900', color: '#0B0E1A' },
  raidDoneTxt: { fontSize: 12, fontWeight: '800', color: '#2AC68F', textAlign: 'center' },
  raidLockTxt: { fontSize: 12, color: c.text.muted, textAlign: 'center' },
  raidReward: { fontSize: 11, color: c.text.muted, textAlign: 'center' },
  medalWall: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  medal: { width: 64, alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingVertical: spacing[2] },
  medalEmoji: { fontSize: 24 },
  medalWk: { fontSize: 9, color: c.text.muted, marginTop: 2 },
}));
