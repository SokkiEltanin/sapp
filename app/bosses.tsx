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
} from '@/utils/bosses';
import { sweetlessDaysFrom } from '@/utils/quests';
import { useHabits } from '@/hooks/useHabits';
import { getCounts } from '@/utils/habits';
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

export default function Bosses() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { xp, energy, ownedItems, defeatedBosses, bossHp, syncEnergy, attackBoss, defeatBoss } = usePetStore();
  const { habits, todayDone } = useHabits();
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();

  const [steps, setSteps] = useState(0);
  const [victory, setVictory] = useState<Boss | null>(null);
  const bonuses = useMemo(() => bossBonuses(ownedItems), [ownedItems]);
  const level = useMemo(() => levelFromXp(xp).level, [xp]);

  const t = todayISO();
  const moodLoggedToday = moodEntries.some(e => e.date === t);
  const boughtSweetToday = useMemo(() => expenses.some(e => e.type !== 'income' && (e.date ?? '').slice(0, 10) === t
    && (e.receiptItems ?? []).some(it => !it.excluded && (it.tags ?? []).some(tg => tg === 'słodycze' || tg === 'przekąski'))), [expenses]);
  const sweetlessDays = useMemo(() => sweetlessDaysFrom(expenses), [expenses]);
  const habitsRatio = habits.length ? todayDone.length / habits.length : 0;
  const wc = { stepsToday: steps, sweetlessDays, habitsRatio, moodLoggedToday };

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
  }, [todayDone.length, moodEntries, boughtSweetToday, bonuses.energyMult, syncEnergy, habits]);
  useFocusEffect(reload);

  // sequential campaign: current = first not-yet-defeated boss
  const current = BOSSES.find(b => !defeatedBosses.includes(b.id)) ?? null;
  const unlocked = current ? level >= current.unlockLevel : false;
  const remaining = current ? bossRemaining(current, bossHp) : 0;

  // attack animation
  const shake = useRef(new Animated.Value(0)).current;
  const dmgY = useRef(new Animated.Value(0)).current;
  const [lastHit, setLastHit] = useState<{ dmg: number; crit: boolean } | null>(null);

  const attack = () => {
    if (!current || !unlocked) return;
    if (energy <= 0) { haptic.error(); toast.info('Brak energii — zadbaj o siebie, by naładować cios'); return; }
    const { damage, crit } = computeDamage(energy, level, bonuses, current, wc);
    haptic.medium();
    setLastHit({ dmg: damage, crit });
    shake.setValue(0); dmgY.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(shake, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: -1, duration: 60, useNativeDriver: true }),
        Animated.timing(shake, { toValue: 0, duration: 60, useNativeDriver: true }),
      ]),
      Animated.timing(dmgY, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
    const res = attackBoss(current.id, current.hp, damage, bonuses.dodge);
    if (res.defeated) {
      setTimeout(() => { defeatBoss(current.id, current.loot.id, current.coins, current.xp); haptic.success(); setVictory(current); }, 320);
    }
  };

  const previewDmg = current ? Math.round(energy * atkMultiplier(level, bonuses) * weaknessMult(current, wc)) : 0;
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const floatY = dmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
  const floatOp = dmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Bossy</Text>
        <View style={s.energyPill}><Zap size={13} color="#38BDF8" /><Text style={s.energyTxt}>{energy}</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {!current ? (
          <View style={s.done}>
            <Swords size={30} color={c.text.muted} />
            <Text style={s.doneTxt}>Wszyscy bossowie pokonani! Kolejni wkrótce.</Text>
          </View>
        ) : (
          <View style={s.arena}>
            <View style={s.bossTop}>
              <Animated.Text style={[s.bossEmoji, { transform: [{ translateX: shakeX }] }]}>{current.emoji}</Animated.Text>
              {lastHit && (
                <Animated.Text style={[s.dmgFloat, { opacity: floatOp, transform: [{ translateY: floatY }], color: lastHit.crit ? '#FDE047' : '#F87171' }]}>
                  -{lastHit.dmg}{lastHit.crit ? ' KRYT!' : ''}
                </Animated.Text>
              )}
            </View>
            <Text style={s.bossName}>{current.name}</Text>
            <Text style={s.bossTaunt}>„{current.taunt}"</Text>

            {/* HP */}
            <View style={s.hpTrack}><View style={[s.hpFill, { width: `${Math.round(remaining / current.hp * 100)}%` }]} /></View>
            <Text style={s.hpTxt}>{remaining} / {current.hp} HP</Text>

            {unlocked ? (
              <>
                <View style={s.weakBox}>
                  <Text style={s.weakTxt}>Słaby na: <Text style={{ color: '#2AC68F', fontWeight: '800' }}>{current.weaknessLabel}</Text> · dziś ×{weaknessMult(current, wc).toFixed(2)}</Text>
                  <Text style={s.previewTxt}>Twój cios: ~{previewDmg} obrażeń (energia {energy})</Text>
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
}));
