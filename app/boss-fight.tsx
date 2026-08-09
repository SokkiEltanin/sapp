import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing, Modal, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Lock, Swords, Zap } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import CatArt from '@/components/pet/CatArt';
import BossArt from '@/components/bosses/BossArt';
import Confetti from '@/components/achievements/Confetti';
import { usePetStore, levelFromXp, catMaxHp } from '@/store/petStore';
import { BOSSES, Boss, bossBonuses, atkPower, simulateFight, FIGHT_ROUNDS, EquippedItem } from '@/utils/bosses';
import { bossAttackFx } from '@/utils/bossAttackFx';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const WEAK_COLOR: Record<string, string> = {
  steps: '#46B0DE', sweetless: '#F472B6', habits: '#2AC68F', mood: '#A78BFA', sleep: '#5B7BE3', water: '#38BDF8',
};

// Ekran WALKI (S&F-style, 2026-08-09 — patrz memory boss_design.md), wydzielony z listy
// (app/bosses.tsx). Zawsze walczy z SEKWENCYJNYM aktualnym bossem kampanii (ta sama
// `current` logika co na liście) — kampania jest ściśle liniowa, więc nie ma potrzeby
// dynamicznego [id]. Celowo BEZ PupilNavbar: to skupiony ekran starcia, nie kolejna
// zakładka boczna — wraca się z niego przyciskiem "cofnij", nie przełącza na inną.
export default function BossFight() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const {
    xp, energy, ownedItems, defeatedBosses, defeatBoss,
    catHp, catMaxHpBonus, atkStatBonus, damageCat, resetCatHp, spendEnergy,
    ownedCombatItems, equippedCombatItems,
  } = usePetStore();

  const [victory, setVictory] = useState<Boss | null>(null);
  const [fighting, setFighting] = useState(false);
  const [liveBossHp, setLiveBossHp] = useState<number | null>(null);
  const [attackPulse, setAttackPulse] = useState(0);
  const bonuses = useMemo(() => bossBonuses(ownedItems), [ownedItems]);
  const level = useMemo(() => levelFromXp(xp).level, [xp]);
  const equippedItems: EquippedItem[] = useMemo(
    () => equippedCombatItems.map(id => ({ id, level: ownedCombatItems[id] ?? 1 })),
    [equippedCombatItems, ownedCombatItems],
  );

  const current = BOSSES.find(b => !defeatedBosses.includes(b.id)) ?? null;
  const unlocked = current ? level >= current.unlockLevel : false;
  const catMax = catMaxHp(catMaxHpBonus);
  // Świeży start za każdym razem, że boss/kotek stoją na pełnym pasku, gdy ekran się
  // otwiera (karczma S&F — HP kampanii resetuje się co próbę, patrz memory).
  useEffect(() => { resetCatHp(); }, []);

  // Walka rund odgrywa się przez łańcuch setTimeout (patrz playRound niżej). Jeśli user
  // wyjdzie z ekranu W TRAKCIE animacji (np. cofnij tuż po "Atakuj!"), te timeouty same
  // się nie anulują — bez tej straży walka dokończyłaby się PO CICHU w tle (dalej mutując
  // coiny/pokonanych bossów w store) mimo że ekran już zniknął. `roundTimer` + `alive`
  // dają czysty stop: cofnięcie w trakcie walki po prostu PRZERYWA ją, nic więcej się
  // nie liczy do końca (runda w trakcie animacji się nie dogrywa).
  const alive = useRef(true);
  const roundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    alive.current = false;
    if (roundTimer.current) clearTimeout(roundTimer.current);
  }, []);

  const shake = useRef(new Animated.Value(0)).current;
  const dmgY = useRef(new Animated.Value(0)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const flash = useRef(new Animated.Value(0)).current;
  const [lastHit, setLastHit] = useState<{ dmg: number; crit: boolean; guarded: boolean; healed: number; catHealed: number } | null>(null);

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

  // cała walka (kilka rund, kontratak bossa na kotka) liczy się od razu w jednym
  // wywołaniu simulateFight, ale ODGRYWA SIĘ rundami — sekwencja setTimeout, żeby było
  // widać każdy cios, nie tylko wynik końcowy.
  const attack = () => {
    if (!current || !unlocked || fighting) return;
    if (energy <= 0) { haptic.error(); toast.info('Brak prób ataku na dziś — wróć jutro po nowe.'); return; }
    resetCatHp();
    const result = simulateFight(atkStatBonus, level, bonuses, current, catMax, FIGHT_ROUNDS, equippedItems);
    spendEnergy();
    setFighting(true);
    setLiveBossHp(current.hp);
    let i = 0;
    const playRound = () => {
      if (!alive.current) return;   // cofnięto z ekranu w trakcie animacji — walka się zatrzymuje, nic dalej się nie liczy
      const round = result.rounds[i];
      haptic.medium();
      setLastHit({ dmg: round.playerDmg, crit: round.playerCrit, guarded: result.guarded, healed: round.healed, catHealed: round.catHealed });
      playHitFx(round.playerCrit);
      setAttackPulse(n => n + 1);
      setLiveBossHp(round.bossHpAfter);
      if (round.counterDmg > 0) damageCat(round.counterDmg);
      i++;
      if (i < result.rounds.length) {
        roundTimer.current = setTimeout(playRound, 750);
      } else {
        roundTimer.current = setTimeout(() => {
          if (!alive.current) return;
          setFighting(false);
          setLiveBossHp(null);
          if (result.won) {
            defeatBoss(current.id, current.loot.id, current.coins, current.xp); haptic.success(); setVictory(current);
          } else if (result.catFainted) {
            haptic.error(); toast.error('Kotek padł! Spróbuj ponownie.');
          } else {
            haptic.warn(); toast.info('Boss przetrwał — spróbuj ponownie.');
          }
        }, 500);
      }
    };
    playRound();
  };

  const previewDmg = current ? Math.round(atkPower(atkStatBonus, level, bonuses)) : 0;
  const shakeX = shake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const popScale = pop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const flashOp = flash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] });
  const floatY = dmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -50] });
  const floatOp = dmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  // Custom attack burst per boss ("dodałem jako ATTACKBOSS" — assets/ikonybosów/
  // BOSSATTACK_*, patrz src/utils/bossAttackFx.ts). Punches in with `pop`, fades with
  // `flash` — same two values already driving the boss's own hit-react, so the burst
  // stays perfectly in sync with the shake/flash without a 3rd Animated.Value.
  const attackFx = current ? bossAttackFx(current.id) : undefined;
  const fxScale = pop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.35] });

  const closeVictory = () => { setVictory(null); router.back(); };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Walka</Text>
        <View style={s.energyPill}><Zap size={13} color="#38BDF8" /><Text style={s.energyTxt}>{energy}</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {!current ? (
          <View style={s.done}>
            <Swords size={30} color={c.text.muted} />
            <Text style={s.doneTxt}>Wszyscy bossowie pokonani! Kolejni wkrótce.</Text>
          </View>
        ) : !unlocked ? (
          <View style={s.lockBox}>
            <Lock size={16} color={c.text.muted} />
            <Text style={s.lockTxt}>Odblokujesz na poziomie {current.unlockLevel} (masz {level}). Rozwijaj pupila questami.</Text>
          </View>
        ) : (
          <View style={s.arena}>
            <View style={s.bossTop}>
              <View style={[s.aura, { backgroundColor: (WEAK_COLOR[current.weakness] ?? '#888') + '22', borderColor: (WEAK_COLOR[current.weakness] ?? '#888') + '55' }]} pointerEvents="none" />
              <Animated.View style={{ transform: [{ translateX: shakeX }, { scale: popScale }] }}>
                <BossArt id={current.id} emoji={current.emoji} size={96} />
              </Animated.View>
              <Animated.View pointerEvents="none" style={[s.hitFlash, { opacity: flashOp, backgroundColor: lastHit?.crit ? '#FDE047' : '#F87171' }]} />
              {attackFx && lastHit && (
                <Animated.View pointerEvents="none" style={[s.attackFx, { opacity: flashOp, transform: [{ scale: fxScale }, { rotate: '-10deg' }] }]}>
                  <Image source={attackFx} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
                </Animated.View>
              )}
              {lastHit && (
                <Animated.Text style={[s.dmgFloat, { opacity: floatOp, transform: [{ translateY: floatY }], color: lastHit.crit ? '#FDE047' : '#F87171' }]}>
                  -{lastHit.dmg}{lastHit.crit ? ' KRYT!' : ''}
                </Animated.Text>
              )}
            </View>
            <Text style={s.bossName}>{current.name}</Text>
            <Text style={s.bossTaunt}>„{current.taunt}"</Text>
            {lastHit?.guarded && <Text style={s.mechNote}>🛡️ Osłona: ten boss redukuje ciosy ×0.5</Text>}
            {!!lastHit?.healed && <Text style={s.mechNoteHeal}>🩹 Boss zregenerował +{lastHit.healed} (wrodzona regeneracja)</Text>}
            {!!lastHit?.catHealed && <Text style={s.mechNoteHeal}>💚 Uzdrowienie: kotek odzyskał +{lastHit.catHealed} HP</Text>}

            {/* HP bossa — pełne poza walką (resetuje się co próbę); w trakcie animacji
                rund pokazuje liveBossHp rundę-po-rundzie. */}
            <View style={s.hpTrack}><View style={[s.hpFill, { width: `${Math.round((liveBossHp ?? current.hp) / current.hp * 100)}%` }]} /></View>
            <Text style={s.hpTxt}>{liveBossHp ?? current.hp} / {current.hp} HP</Text>

            {/* HP kotka */}
            <View style={[s.hpTrack, { marginTop: 6 }]}>
              <View style={[s.hpFill, { width: `${Math.round(catHp / catMax * 100)}%`, backgroundColor: '#2AC68F' }]} />
            </View>
            <Text style={s.hpTxt}>🐱 {catHp} / {catMax} HP</Text>

            <View style={s.weakBox}>
              <Text style={s.previewTxt}>Twój cios: ~{previewDmg} obrażeń/rundę × {FIGHT_ROUNDS} rundy · prób dziś: {energy}</Text>
              {(current.guard || current.regenPct) && (
                <Text style={s.mechHint}>
                  {current.guard ? '🛡️ ten boss ma wrodzoną osłonę — Twoje ciosy ×0.5. ' : ''}
                  {current.regenPct ? '🩹 ten boss regeneruje się, gdy przeżyje rundę.' : ''}
                </Text>
              )}
            </View>
            <View style={s.fightRow}>
              <CatArt size={84} expression="content" attack={attackPulse} />
              <PressableScale onPress={attack} style={{ flex: 1 }}>
                <View style={[s.attackBtn, (energy <= 0 || fighting) && { opacity: 0.5 }]}>
                  <Swords size={18} color="#0B0E1A" />
                  <Text style={s.attackTxt}>{fighting ? 'Walka trwa…' : 'Atakuj!'}</Text>
                </View>
              </PressableScale>
            </View>
            <Text style={s.loot}>Nagroda: {current.loot.emoji} {current.loot.name} · {current.loot.desc} · +{current.coins} 🪙</Text>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!victory} transparent statusBarTranslucent animationType="fade" onRequestClose={closeVictory}>
        <Pressable style={s.vBackdrop} onPress={closeVictory}>
          <Confetti colors={['#FDE047', '#2AC68F', '#38BDF8', '#F472B6']} />
          {victory && (
            <View style={s.vCenter} pointerEvents="none">
              <Text style={s.vKicker}>POKONANY!</Text>
              <View style={{ opacity: 0.6 }}>
                <BossArt id={victory.id} emoji={victory.emoji} size={78} />
              </View>
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
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: 60, flexGrow: 1, justifyContent: 'center' },

  done: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  doneTxt: { fontSize: 13, color: c.text.muted, textAlign: 'center', maxWidth: 260 },

  arena: { alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[5] },
  bossTop: { height: 106, justifyContent: 'center', alignItems: 'center' },
  dmgFloat: { position: 'absolute', top: 0, fontSize: 22, fontWeight: '900' },
  bossName: { fontSize: 22, fontWeight: '900', color: c.text.primary, marginTop: 4 },
  bossTaunt: { fontSize: 13, color: c.text.muted, fontStyle: 'italic', marginTop: 2, marginBottom: spacing[3] },
  hpTrack: { width: '100%', height: 14, borderRadius: 7, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  hpFill: { height: '100%', borderRadius: 7, backgroundColor: '#EF4444' },
  hpTxt: { fontSize: 12, fontWeight: '700', color: c.text.secondary, marginTop: 4 },

  weakBox: { alignItems: 'center', marginTop: spacing[3], gap: 2 },
  previewTxt: { fontSize: 12, color: c.text.muted, textAlign: 'center' },
  fightRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: spacing[3], width: '100%' },
  attackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FBBF24', borderRadius: radius.lg, paddingVertical: 16 },
  attackTxt: { fontSize: 17, fontWeight: '900', color: '#0B0E1A' },
  loot: { fontSize: 11.5, color: c.text.muted, textAlign: 'center', marginTop: spacing[3] },
  lockBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[6], paddingHorizontal: spacing[3] },
  lockTxt: { flex: 1, fontSize: 12.5, color: c.text.muted, lineHeight: 17 },

  vBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,8,16,0.94)', paddingHorizontal: 32 },
  vCenter: { alignItems: 'center' },
  vKicker: { fontSize: 14, fontWeight: '900', letterSpacing: 3, color: '#FDE047', marginBottom: 10 },
  vName: { fontSize: 22, fontWeight: '900', color: '#fff', marginTop: 6 },
  vLoot: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, paddingVertical: spacing[3], paddingHorizontal: spacing[5], marginTop: spacing[4] },
  vLootEmoji: { fontSize: 34 },
  vLootName: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 4 },
  vLootDesc: { fontSize: 12, color: '#2AC68F', fontWeight: '700', marginTop: 1 },
  vReward: { fontSize: 14, fontWeight: '800', color: '#FDE047', marginTop: spacing[4] },
  vHint: { position: 'absolute', bottom: 48, color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: '600' },

  aura: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 1 },
  hitFlash: { position: 'absolute', width: 104, height: 104, borderRadius: 52 },
  attackFx: { position: 'absolute', width: 150, height: 150 },
  mechNote: { fontSize: 11.5, color: '#F4B740', fontWeight: '800', marginTop: 4, textAlign: 'center' },
  mechNoteHeal: { fontSize: 11.5, color: '#7DD3FC', fontWeight: '800', marginTop: 2, textAlign: 'center' },
  mechHint: { fontSize: 11, color: c.text.muted, textAlign: 'center', marginTop: 3, lineHeight: 15 },
}));
