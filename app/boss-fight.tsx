import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing, Modal, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Lock, Swords, Zap, Shield, HeartPulse, Coins, PawPrint } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import CatArt from '@/components/pet/CatArt';
import BossArt from '@/components/bosses/BossArt';
import Confetti from '@/components/achievements/Confetti';
import { usePetStore, levelFromXp, catMaxHp } from '@/store/petStore';
import { BOSSES, Boss, bossBonuses, atkPower, simulateFight, FIGHT_ROUNDS, EquippedItem } from '@/utils/bosses';
import { bossAttackFx } from '@/utils/bossAttackFx';
import { lootIcon } from '@/utils/bossUiIcons';
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
//
// REDESIGN 2026-08-09 (user: "dwa kafelki obok siebie... kotek uderza łapką... boss
// wyprowadza swój atak i kotkowi zadaje... popup wygrana/przegrana"). Dwie realne zmiany
// względem poprzedniej wersji: (1) układ dwóch symetrycznych kafelków Pupil/Boss zamiast
// jednej dużej karty bossa z kotem jako dodatkiem, (2) kontratak bossa dostał WŁASNĄ
// reakcję wizualną na kotku (trzęsienie/błysk/liczba obrażeń) — wcześniej pasek HP kotka
// po prostu cicho spadał. Runda dzieli się teraz na DWIE odgrywane fazy (cios gracza →
// pauza → kontratak bossa → pauza → kolejna runda), nie jeden jednoczesny tick.
export default function BossFight() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const {
    xp, energy, ownedItems, defeatedBosses, defeatBoss,
    catHp, catMaxHpBonus, atkStatBonus, damageCat, resetCatHp, spendEnergy,
    ownedCombatItems, equippedCombatItems,
  } = usePetStore();

  const [victory, setVictory] = useState<Boss | null>(null);
  const [defeat, setDefeat] = useState(false);
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
  const CurrentLootIcon = current ? lootIcon(current.loot) : Coins;
  useEffect(() => { resetCatHp(); }, []);

  // Walka rund odgrywa się przez łańcuch setTimeout (patrz playerBeat/counterBeat niżej).
  // Jeśli user wyjdzie z ekranu W TRAKCIE animacji, te timeouty same się nie anulują —
  // bez tej straży walka dokończyłaby się PO CICHU w tle. `roundTimer` + `alive` dają
  // czysty stop: cofnięcie w trakcie walki po prostu PRZERYWA ją.
  const alive = useRef(true);
  const roundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    alive.current = false;
    if (roundTimer.current) clearTimeout(roundTimer.current);
  }, []);

  // ── boss-side hit fx (Twój cios na bossie) ──
  const bShake = useRef(new Animated.Value(0)).current;
  const bDmgY = useRef(new Animated.Value(0)).current;
  const bPop = useRef(new Animated.Value(0)).current;
  const bFlash = useRef(new Animated.Value(0)).current;
  const [lastHit, setLastHit] = useState<{ dmg: number; crit: boolean; guarded: boolean; healed: number } | null>(null);
  const playBossHitFx = (crit: boolean) => {
    bShake.setValue(0); bDmgY.setValue(0); bPop.setValue(0); bFlash.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(bShake, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(bShake, { toValue: -1, duration: 50, useNativeDriver: true }),
        Animated.timing(bShake, { toValue: crit ? 1 : 0.5, duration: 50, useNativeDriver: true }),
        Animated.timing(bShake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(bPop, { toValue: 1, duration: 90, easing: Easing.out(Easing.quad), useNativeDriver: true }),
        Animated.spring(bPop, { toValue: 0, friction: 4, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(bFlash, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(bFlash, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
      Animated.timing(bDmgY, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  // ── cat-side hit fx (kontratak bossa) — lustrzane odbicie powyższego, wcześniej
  // NIE ISTNIAŁO: pasek HP kotka spadał bez żadnej widocznej reakcji. ──
  const kShake = useRef(new Animated.Value(0)).current;
  const kDmgY = useRef(new Animated.Value(0)).current;
  const kFlash = useRef(new Animated.Value(0)).current;
  const [catHit, setCatHit] = useState<{ dmg: number; healed: number } | null>(null);
  const playCatHitFx = () => {
    kShake.setValue(0); kDmgY.setValue(0); kFlash.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(kShake, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(kShake, { toValue: -1, duration: 50, useNativeDriver: true }),
        Animated.timing(kShake, { toValue: 0.5, duration: 50, useNativeDriver: true }),
        Animated.timing(kShake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(kFlash, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(kFlash, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
      Animated.timing(kDmgY, { toValue: 1, duration: 800, easing: Easing.out(Easing.quad), useNativeDriver: true }),
    ]).start();
  };

  // Pociski lecące między kafelkami (2026-08-10, user: "łapka leci od kota i uderza
  // wroga... od wroga lecą pociski na kotka, z góry"). 0→1 = leci; JSX niżej interpoluje
  // na translateX WZDŁUŻ całego wiersza kafelków (płaski tor, bez łuku — "z góry" =
  // widok pionowy, nie boczny). Rzut trwa PRZED wylądowaniem ciosu (patrz throwDuration
  // w playerBeat/counterBeat) — HP/shake/flash/liczba obrażeń odpalają się dopiero gdy
  // pocisk faktycznie dotrze na miejsce, nie w tej samej chwili co start rzutu.
  const pawTravel = useRef(new Animated.Value(0)).current;
  const boltTravel = useRef(new Animated.Value(0)).current;
  const [pawFlying, setPawFlying] = useState(false);
  const [boltFlying, setBoltFlying] = useState(false);
  const THROW_MS = 320;

  // Cała walka (kilka rund) liczy się od razu w jednym wywołaniu simulateFight, ale
  // ODGRYWA SIĘ dwoma fazami na rundę: Twój cios ląduje na bossie → krótka pauza →
  // kontratak bossa ląduje na kotku → pauza → kolejna runda.
  const attack = () => {
    if (!current || !unlocked || fighting) return;
    if (energy <= 0) { haptic.error(); toast.info('Brak prób ataku na dziś — wróć jutro po nowe.'); return; }
    resetCatHp();
    const result = simulateFight(atkStatBonus, level, bonuses, current, catMax, FIGHT_ROUNDS, equippedItems);
    spendEnergy();
    setFighting(true);
    setLiveBossHp(current.hp);
    setCatHit(null);
    let i = 0;

    const finish = () => {
      if (!alive.current) return;
      setFighting(false);
      setLiveBossHp(null);
      if (result.won) {
        defeatBoss(current.id, current.loot.id, current.coins, current.xp);
        haptic.success();
        setVictory(current);
      } else {
        haptic.error();
        setDefeat(true);
      }
    };

    const counterBeat = () => {
      if (!alive.current) return;
      const round = result.rounds[i];
      const advance = () => {
        i++;
        roundTimer.current = setTimeout(i < result.rounds.length ? playerBeat : finish, i < result.rounds.length ? 420 : 550);
      };
      if (round.counterDmg > 0) {
        setBoltFlying(true);
        boltTravel.setValue(0);
        Animated.timing(boltTravel, { toValue: 1, duration: THROW_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
        roundTimer.current = setTimeout(() => {
          if (!alive.current) return;
          setBoltFlying(false);
          haptic.medium();
          setCatHit({ dmg: round.counterDmg, healed: round.catHealed });
          playCatHitFx();
          damageCat(round.counterDmg);
          advance();
        }, THROW_MS);
      } else {
        if (round.catHealed > 0) setCatHit({ dmg: 0, healed: round.catHealed });
        advance();
      }
    };

    const playerBeat = () => {
      if (!alive.current) return;
      const round = result.rounds[i];
      setPawFlying(true);
      pawTravel.setValue(0);
      Animated.timing(pawTravel, { toValue: 1, duration: THROW_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
      roundTimer.current = setTimeout(() => {
        if (!alive.current) return;
        setPawFlying(false);
        haptic.medium();
        setLastHit({ dmg: round.playerDmg, crit: round.playerCrit, guarded: result.guarded, healed: round.healed });
        playBossHitFx(round.playerCrit);
        setAttackPulse(n => n + 1);
        setLiveBossHp(round.bossHpAfter);
        roundTimer.current = setTimeout(counterBeat, 480);
      }, THROW_MS);
    };

    playerBeat();
  };

  const previewDmg = current ? Math.round(atkPower(atkStatBonus, level, bonuses)) : 0;
  const bShakeX = bShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const bPopScale = bPop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const bFlashOp = bFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] });
  const bFloatY = bDmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const bFloatOp = bDmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const kShakeX = kShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const kFlashOp = kFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] });
  const kFloatY = kDmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const kFloatOp = kDmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  // Custom attack burst per boss (assets/ikonybosów/BOSSATTACK_*) na Twoim ciosie.
  const attackFx = current ? bossAttackFx(current.id) : undefined;
  const fxScale = bPop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.35] });
  // Tor lotu = procent szerokości s.vsRow, od środka lewego kafelka (Pupil) do środka
  // prawego (Boss) i z powrotem. Płasko (bez łuku) — patrz komentarz przy pawTravel wyżej.
  const pawX = pawTravel.interpolate({ inputRange: [0, 1], outputRange: ['16%', '84%'] });
  const pawOp = pawTravel.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] });
  const pawScale = pawTravel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.15, 0.8] });
  const boltX = boltTravel.interpolate({ inputRange: [0, 1], outputRange: ['84%', '16%'] });
  const boltOp = boltTravel.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] });
  const boltScale = boltTravel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.15, 0.8] });

  const closeVictory = () => { setVictory(null); router.back(); };
  const closeDefeat = () => { setDefeat(false); router.back(); };
  const VictoryLootIcon = victory ? lootIcon(victory.loot) : Coins;

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
            {/* dwa symetryczne kafelki — Pupil / Boss */}
            <View style={{ width: '100%', position: 'relative' }}>
            <View style={s.vsRow}>
              <View style={s.tile}>
                <Text style={s.tileLabel} numberOfLines={1}>Pupil</Text>
                <View style={s.tileHpTrack}><View style={[s.tileHpFill, { width: `${Math.round(catHp / catMax * 100)}%`, backgroundColor: '#2AC68F' }]} /></View>
                <Text style={s.tileHpTxt}>{catHp} / {catMax}</Text>
                <View style={s.tilePortrait}>
                  <Animated.View style={{ transform: [{ translateX: kShakeX }] }}>
                    <CatArt size={104} expression="content" attack={attackPulse} />
                  </Animated.View>
                  <Animated.View pointerEvents="none" style={[s.tileFlash, { opacity: kFlashOp, backgroundColor: '#F87171' }]} />
                  {catHit && !!catHit.dmg && (
                    <Animated.Text style={[s.dmgFloat, { opacity: kFloatOp, transform: [{ translateY: kFloatY }], color: '#F87171' }]}>-{catHit.dmg}</Animated.Text>
                  )}
                </View>
              </View>

              <View style={s.tile}>
                <Text style={[s.tileLabel, { color: WEAK_COLOR[current.weakness] ?? c.text.primary }]} numberOfLines={1}>{current.name}</Text>
                <View style={s.tileHpTrack}><View style={[s.tileHpFill, { width: `${Math.round((liveBossHp ?? current.hp) / current.hp * 100)}%` }]} /></View>
                <Text style={s.tileHpTxt}>{liveBossHp ?? current.hp} / {current.hp}</Text>
                <View style={s.tilePortrait}>
                  <View style={[s.aura, { backgroundColor: (WEAK_COLOR[current.weakness] ?? '#888') + '22', borderColor: (WEAK_COLOR[current.weakness] ?? '#888') + '55' }]} pointerEvents="none" />
                  <Animated.View style={{ transform: [{ translateX: bShakeX }, { scale: bPopScale }] }}>
                    <BossArt id={current.id} emoji={current.emoji} size={104} />
                  </Animated.View>
                  <Animated.View pointerEvents="none" style={[s.tileFlash, { opacity: bFlashOp, backgroundColor: lastHit?.crit ? '#FDE047' : '#F87171' }]} />
                  {attackFx && lastHit && (
                    <Animated.View pointerEvents="none" style={[s.attackFx, { opacity: bFlashOp, transform: [{ scale: fxScale }, { rotate: '-10deg' }] }]}>
                      <Image source={attackFx} resizeMode="contain" style={{ width: '100%', height: '100%' }} />
                    </Animated.View>
                  )}
                  {lastHit && (
                    <Animated.Text style={[s.dmgFloat, { opacity: bFloatOp, transform: [{ translateY: bFloatY }], color: lastHit.crit ? '#FDE047' : '#F87171' }]}>
                      -{lastHit.dmg}{lastHit.crit ? ' KRYT!' : ''}
                    </Animated.Text>
                  )}
                </View>
              </View>
            </View>

            {/* pociski między kafelkami — łapka kota (Twój cios) i "broń" bossa
                (kontratak), płaski tor wzdłuż wiersza, patrz komentarz przy pawTravel */}
            {pawFlying && (
              <Animated.View pointerEvents="none" style={[s.projectile, { left: pawX, opacity: pawOp, transform: [{ scale: pawScale }, { translateX: -14 }] }]}>
                <PawPrint size={28} color="#FBBF24" />
              </Animated.View>
            )}
            {boltFlying && (
              <Animated.View pointerEvents="none" style={[s.projectile, { left: boltX, opacity: boltOp, transform: [{ scale: boltScale }, { translateX: -14 }] }]}>
                {attackFx
                  ? <Image source={attackFx} resizeMode="contain" style={{ width: 32, height: 32 }} />
                  : <Swords size={26} color="#F87171" />}
              </Animated.View>
            )}
            </View>

            <Text style={s.bossTaunt}>„{current.taunt}"</Text>
            {lastHit?.guarded && <View style={s.mechRow}><Shield size={13} color="#F4B740" /><Text style={s.mechNote}>Osłona: ten boss redukuje ciosy ×0.5</Text></View>}
            {!!lastHit?.healed && <View style={s.mechRow}><HeartPulse size={13} color="#7DD3FC" /><Text style={s.mechNoteHeal}>Boss zregenerował +{lastHit.healed} (wrodzona regeneracja)</Text></View>}
            {!!catHit?.healed && <View style={s.mechRow}><HeartPulse size={13} color="#2AC68F" /><Text style={[s.mechNoteHeal, { color: '#2AC68F' }]}>Uzdrowienie: kotek odzyskał +{catHit.healed} HP</Text></View>}

            <View style={s.weakBox}>
              <Text style={s.previewTxt}>Twój cios: ~{previewDmg} obrażeń/rundę × {FIGHT_ROUNDS} rundy · prób dziś: {energy}</Text>
              {(current.guard || current.regenPct) && (
                <View style={s.mechRow}>
                  {current.guard && <><Shield size={11} color={c.text.muted} /><Text style={s.mechHint}>wrodzona osłona (ciosy ×0.5)</Text></>}
                  {current.regenPct && <><HeartPulse size={11} color={c.text.muted} /><Text style={s.mechHint}>regeneruje się, gdy przeżyje rundę</Text></>}
                </View>
              )}
            </View>

            <PressableScale onPress={attack} style={{ width: '100%' }}>
              <View style={[s.attackBtn, (energy <= 0 || fighting) && { opacity: 0.5 }]}>
                <Swords size={18} color="#0B0E1A" />
                <Text style={s.attackTxt}>{fighting ? 'Walka trwa…' : 'WALCZ!'}</Text>
              </View>
            </PressableScale>
            <View style={s.lootRow}>
              <CurrentLootIcon size={14} color="#2AC68F" />
              <Text style={s.loot}>{current.loot.name} · {current.loot.desc}</Text>
              <Coins size={12} color="#FBBF24" />
              <Text style={s.lootCoins}>{current.coins}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      <Modal visible={!!victory} transparent statusBarTranslucent animationType="fade" onRequestClose={closeVictory}>
        <Pressable style={s.vBackdrop} onPress={closeVictory}>
          <Confetti colors={['#FDE047', '#2AC68F', '#38BDF8', '#F472B6']} />
          {victory && (
            <View style={s.vCenter} pointerEvents="none">
              <Text style={s.vKicker}>WYGRANA!</Text>
              <View style={{ opacity: 0.6 }}>
                <BossArt id={victory.id} emoji={victory.emoji} size={78} />
              </View>
              <Text style={s.vName}>{victory.name} pokonany</Text>
              <View style={s.vLoot}>
                <VictoryLootIcon size={30} color="#2AC68F" />
                <Text style={s.vLootName}>{victory.loot.name}</Text>
                <Text style={s.vLootDesc}>{victory.loot.desc}</Text>
              </View>
              <View style={s.vRewardRow}>
                <Coins size={16} color="#FDE047" /><Text style={s.vReward}>{victory.coins} · +{victory.xp} XP</Text>
              </View>
            </View>
          )}
          <Text style={s.vHint}>Stuknij, aby zamknąć</Text>
        </Pressable>
      </Modal>

      <Modal visible={defeat} transparent statusBarTranslucent animationType="fade" onRequestClose={closeDefeat}>
        <Pressable style={s.vBackdrop} onPress={closeDefeat}>
          {current && (
            <View style={s.vCenter} pointerEvents="none">
              <Text style={[s.vKicker, { color: '#F87171' }]}>PRZEGRANA</Text>
              <View style={{ opacity: 0.5 }}>
                <BossArt id={current.id} emoji={current.emoji} size={78} />
              </View>
              <Text style={s.vName}>{current.name} przetrwał</Text>
              <Text style={s.vDefeatSub}>HP resetuje się — spróbuj ponownie, kiedy będziesz gotowy.</Text>
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

  arena: { alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4] },

  vsRow: { flexDirection: 'row', gap: spacing[3], width: '100%' },
  tile: { flex: 1, minWidth: 0, alignItems: 'center', backgroundColor: c.bg.elevated, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], gap: 6 },
  tileLabel: { fontSize: 12.5, fontWeight: '800', color: c.text.primary },
  tileHpTrack: { width: '100%', height: 8, borderRadius: 4, backgroundColor: c.bg.primary, overflow: 'hidden' },
  tileHpFill: { height: '100%', borderRadius: 4, backgroundColor: '#EF4444' },
  tileHpTxt: { fontSize: 10, fontWeight: '700', color: c.text.muted },
  tilePortrait: { height: 116, width: '100%', justifyContent: 'center', alignItems: 'center', marginTop: 2 },
  tileFlash: { position: 'absolute', width: 96, height: 96, borderRadius: 48 },

  dmgFloat: { position: 'absolute', top: 4, fontSize: 19, fontWeight: '900' },
  bossTaunt: { fontSize: 12.5, color: c.text.muted, fontStyle: 'italic', marginTop: spacing[3], textAlign: 'center' },

  mechRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, justifyContent: 'center', flexWrap: 'wrap' },
  mechNote: { fontSize: 11.5, color: '#F4B740', fontWeight: '800', textAlign: 'center' },
  mechNoteHeal: { fontSize: 11.5, color: '#7DD3FC', fontWeight: '800', textAlign: 'center' },
  mechHint: { fontSize: 11, color: c.text.muted, textAlign: 'center' },

  weakBox: { alignItems: 'center', marginTop: spacing[3], gap: 2 },
  previewTxt: { fontSize: 12, color: c.text.muted, textAlign: 'center' },
  attackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FBBF24', borderRadius: radius.lg, paddingVertical: 16, marginTop: spacing[4], width: '100%' },
  attackTxt: { fontSize: 17, fontWeight: '900', color: '#0B0E1A' },
  lootRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 5, marginTop: spacing[3], flexWrap: 'wrap' },
  loot: { fontSize: 11.5, color: c.text.muted, textAlign: 'center' },
  lootCoins: { fontSize: 11.5, color: '#FBBF24', fontWeight: '800' },
  lockBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[6], paddingHorizontal: spacing[3] },
  lockTxt: { flex: 1, fontSize: 12.5, color: c.text.muted, lineHeight: 17 },

  vBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,8,16,0.94)', paddingHorizontal: 32 },
  vCenter: { alignItems: 'center' },
  vKicker: { fontSize: 14, fontWeight: '900', letterSpacing: 3, color: '#FDE047', marginBottom: 10 },
  vName: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 6, textAlign: 'center' },
  vDefeatSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 10, textAlign: 'center', maxWidth: 260 },
  vLoot: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, paddingVertical: spacing[3], paddingHorizontal: spacing[5], marginTop: spacing[4] },
  vLootName: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 4 },
  vLootDesc: { fontSize: 12, color: '#2AC68F', fontWeight: '700', marginTop: 1 },
  vRewardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[4] },
  vReward: { fontSize: 14, fontWeight: '800', color: '#FDE047' },
  vHint: { position: 'absolute', bottom: 48, color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: '600' },

  aura: { position: 'absolute', width: 132, height: 132, borderRadius: 66, borderWidth: 1 },
  attackFx: { position: 'absolute', width: 150, height: 150 },
  projectile: { position: 'absolute', top: 96, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
}));
