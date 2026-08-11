import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing, Modal, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Lock, Swords, Zap, Shield, HeartPulse, Coins, PawPrint, Trophy } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import CatArt from '@/components/pet/CatArt';
import BossArt from '@/components/bosses/BossArt';
import Confetti from '@/components/achievements/Confetti';
import { usePetStore, levelFromXp, catMaxHp } from '@/store/petStore';
import { BOSSES, bossBonuses, computeDamage, simulateFight, MAX_FIGHT_ROUNDS, EquippedItem, BossLoot } from '@/utils/bosses';
import { raidForWeek, raidHpFor, raidCoins, raidXp } from '@/utils/raid';
import { currentEventBoss, eventPeriodKey, eventHpFor, eventCoins, eventXp } from '@/utils/seasonalEvents';
import { bossAttackFx } from '@/utils/bossAttackFx';
import { COMBAT_ITEMS } from '@/utils/combatItems';
import { lootIcon } from '@/utils/bossUiIcons';
import { monthlyWorkHours, monthlySweetsSpend, thisMonthVsAvg } from '@/utils/menaceStats';
import { weekKeyOf } from '@/utils/quests';
import { useExpensesStore } from '@/store/expensesStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useWorkStore } from '@/store/workStore';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const WEAK_COLOR: Record<string, string> = {
  steps: '#46B0DE', sweetless: '#F472B6', habits: '#2AC68F', mood: '#A78BFA', sleep: '#5B7BE3', water: '#38BDF8',
};

type Kind = 'campaign' | 'raid' | 'event';
type VictoryInfo = { kind: Kind; id: string; name: string; emoji: string; coins: number; xp: number; loot?: BossLoot };

// Ekran WALKI (S&F-style, 2026-08-09/10 — patrz memory boss_design.md), wydzielony z listy
// (app/bosses.tsx). Trzy TRYBY przez ?kind= (campaign domyślnie/raid/event) — user (2026-08-10):
// "przyjrzyj się teraz eventowym bossom żeby były tak samo jak te nasze, też wchodzę z nimi do
// walki" — wcześniej raid/wydarzenie były jednorazowym klikiem NA LIŚCIE (bosses.tsx), bez
// osobnego ekranu starcia. Teraz wszystkie trzy dzielą TĘ SAMĄ arenę/kafelki/pociski/trafienia.
// Mechanika ZOSTAJE inna (świadomie, patrz komentarz przy attackSimple): kampania to pełna
// 3-rundowa symulacja z kontratakiem (HP kotka faktycznie spada, można przegrać); raid/wydarzenie
// to WCIĄŻ pojedyncze uderzenie na próbę w trwały bank HP (bez kontrataku — nigdy nie było, nie
// wprowadzam nowej mechaniki porażki bez pytania), tylko teraz przez tę samą ładną animację
// zamiast miniaturki na liście.
export default function BossFight() {
  const { kind: kindParam } = useLocalSearchParams<{ kind?: string }>();
  const kind: Kind = kindParam === 'raid' ? 'raid' : kindParam === 'event' ? 'event' : 'campaign';

  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const {
    xp, energy, raidEnergy, eventEnergy, ownedItems, defeatedBosses, defeatBoss,
    catHp, catMaxHpBonus, atkStatBonus, damageCat, resetCatHp, spendEnergy,
    ownedCombatItems, equippedCombatItems,
    raidWeek, raidHp, raidWon, raidEnsure, raidAttack, raidClaim,
    eventHp, eventWon, eventAttack, eventClaim,
  } = usePetStore();
  const { expenses } = useExpensesStore();
  const { events, gcalEvents } = useCalendarStore();
  const { settings: workSettings } = useWorkStore();

  const [victory, setVictory] = useState<VictoryInfo | null>(null);
  // `fainted` odróżnia PRAWDZIWĄ porażkę (HP kotka spadło do 0) od skrajnie rzadkiego
  // wyczerpania bezpieczeństwa-sufitu rund bez zabicia bossa (patrz MAX_FIGHT_ROUNDS w
  // bosses.ts — walka teraz leci do faktycznego 0 HP jednej ze stron, nie sztywnych 3
  // rund). `result.won`/`result.catFainted` z simulateFight NIE są dopełnieniem siebie.
  const [defeat, setDefeat] = useState<{ fainted: boolean } | null>(null);
  const [fighting, setFighting] = useState(false);
  const [liveBossHp, setLiveBossHp] = useState<number | null>(null);
  const [attackPulse, setAttackPulse] = useState(0);
  const bonuses = useMemo(() => bossBonuses(ownedItems), [ownedItems]);
  const level = useMemo(() => levelFromXp(xp).level, [xp]);
  const equippedItems: EquippedItem[] = useMemo(
    () => equippedCombatItems.map(id => ({ id, level: ownedCombatItems[id] ?? 1 })),
    [equippedCombatItems, ownedCombatItems],
  );
  const catMax = catMaxHp(catMaxHpBonus);

  // ── kampania: sekwencyjna, zawsze pierwszy niepokonany ──
  const campaignBoss = BOSSES.find(b => !defeatedBosses.includes(b.id)) ?? null;

  // ── raid: zawsze istnieje (deterministyczny wybór z tygodnia) ──
  const weekKey = weekKeyOf();
  const raid = raidForWeek(weekKey);
  const raidMaxHp = raidHpFor(level, weekKey);
  const raidRemaining = raidWeek === weekKey ? raidHp : raidMaxHp;
  const raidDone = raidWon.includes(weekKey);
  useEffect(() => { if (kind === 'raid') raidEnsure(weekKey, raidMaxHp); }, [kind, weekKey, raidMaxHp]);

  // ── wydarzenie: może nie istnieć teraz (brak sezonu/nemesis) ──
  const now = new Date();
  const workByMonth = monthlyWorkHours([...events, ...gcalEvents], workSettings, now);
  const sweetsByMonth = monthlySweetsSpend(expenses, now);
  const workVsAvg = thisMonthVsAvg(workByMonth, now);
  const sweetsVsAvg = thisMonthVsAvg(sweetsByMonth, now);
  const menaceCtx = { workHoursThisMonth: workVsAvg.thisMonth, workHoursAvg: workVsAvg.avg, sweetsThisMonth: sweetsVsAvg.thisMonth, sweetsAvg: sweetsVsAvg.avg };
  const eventBoss = currentEventBoss(now, menaceCtx);
  const eventKey = eventBoss ? eventPeriodKey(eventBoss, now) : null;
  const eventMaxHp = eventHpFor(level);
  const eventRemaining = eventKey ? (eventHp[eventKey] ?? eventMaxHp) : 0;
  const eventDone = eventKey ? eventWon.includes(eventKey) : false;

  // ── jeden ujednolicony cel, niezależnie od trybu — cała reszta ekranu czyta TYLKO to ──
  type Target = { id: string; name: string; taunt: string; weakness: string; weaknessLabel: string; emoji: string; maxHp: number; energy: number; unlocked: boolean; unlockLevel: number; done: boolean };
  let target: Target | null = null;
  if (kind === 'campaign' && campaignBoss) {
    target = { id: campaignBoss.id, name: campaignBoss.name, taunt: campaignBoss.taunt, weakness: campaignBoss.weakness, weaknessLabel: campaignBoss.weaknessLabel, emoji: campaignBoss.emoji, maxHp: campaignBoss.hp, energy, unlocked: level >= campaignBoss.unlockLevel, unlockLevel: campaignBoss.unlockLevel, done: false };
  } else if (kind === 'raid') {
    target = { id: raid.id, name: raid.name, taunt: raid.taunt, weakness: raid.weakness, weaknessLabel: raid.weaknessLabel, emoji: raid.emoji, maxHp: raidMaxHp, energy: raidEnergy, unlocked: level >= 3, unlockLevel: 3, done: raidDone };
  } else if (kind === 'event' && eventBoss && eventKey) {
    target = { id: eventBoss.id, name: eventBoss.name, taunt: eventBoss.taunt, weakness: eventBoss.weakness, weaknessLabel: eventBoss.weaknessLabel, emoji: eventBoss.emoji, maxHp: eventMaxHp, energy: eventEnergy, unlocked: level >= 2, unlockLevel: 2, done: eventDone };
  }
  const targetRemaining = target ? (kind === 'raid' ? (raidDone ? 0 : raidRemaining) : kind === 'event' ? (eventDone ? 0 : eventRemaining) : (liveBossHp ?? target.maxHp)) : 0;
  const headerTitle = kind === 'raid' ? 'Raid' : kind === 'event' ? 'Wydarzenie' : 'Walka';

  useEffect(() => { if (kind === 'campaign') resetCatHp(); }, [kind]);

  // Walka rund odgrywa się przez łańcuch setTimeout (patrz playerBeat/counterBeat/attackSimple
  // niżej). Jeśli user wyjdzie z ekranu W TRAKCIE animacji, te timeouty same się nie anulują —
  // bez tej straży walka dokończyłaby się PO CICHU w tle. `roundTimer` + `alive` dają czysty
  // stop: cofnięcie w trakcie walki po prostu PRZERYWA ją.
  const alive = useRef(true);
  const roundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    alive.current = false;
    if (roundTimer.current) clearTimeout(roundTimer.current);
  }, []);

  // ── boss-side hit fx (Twój cios na bossie) — wspólne dla WSZYSTKICH trybów ──
  const bShake = useRef(new Animated.Value(0)).current;
  const bDmgY = useRef(new Animated.Value(0)).current;
  const bPop = useRef(new Animated.Value(0)).current;
  const bFlash = useRef(new Animated.Value(0)).current;
  const [lastHit, setLastHit] = useState<{ dmg: number; crit: boolean; guarded: boolean; healed: number; thornDmg: number } | null>(null);
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

  // ── cat-side hit fx (kontratak bossa) — TYLKO kampania, raid/wydarzenie nie mają kontrataku ──
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

  // Pociski lecące między kafelkami. 0→1 = leci; JSX niżej interpoluje na translateX wzdłuż
  // całego wiersza kafelków (płaski tor). Rzut trwa PRZED wylądowaniem ciosu — HP/shake/flash/
  // liczba obrażeń odpalają się dopiero gdy pocisk faktycznie dotrze na miejsce.
  const pawTravel = useRef(new Animated.Value(0)).current;
  const boltTravel = useRef(new Animated.Value(0)).current;
  const [pawFlying, setPawFlying] = useState(false);
  const [boltFlying, setBoltFlying] = useState(false);
  const THROW_MS = 320;

  // Kampania: cała walka (kilka rund) liczy się od razu w jednym wywołaniu simulateFight, ale
  // ODGRYWA SIĘ dwoma fazami na rundę: Twój cios ląduje na bossie → pauza → kontratak bossa
  // ląduje na kotku → pauza → kolejna runda.
  const attackCampaign = () => {
    if (!campaignBoss || !target || !target.unlocked || fighting) return;
    if (energy <= 0) { haptic.error(); toast.info('Brak prób ataku na dziś — wróć jutro po nowe.'); return; }
    resetCatHp();
    const result = simulateFight(atkStatBonus, level, bonuses, campaignBoss, catMax, MAX_FIGHT_ROUNDS, equippedItems);
    spendEnergy();
    setFighting(true);
    setLiveBossHp(campaignBoss.hp);
    setCatHit(null);
    let i = 0;

    const finish = () => {
      if (!alive.current) return;
      setFighting(false);
      setLiveBossHp(null);
      if (result.won) {
        defeatBoss(campaignBoss.id, campaignBoss.loot.id, campaignBoss.coins, campaignBoss.xp);
        haptic.success();
        setVictory({ kind: 'campaign', id: campaignBoss.id, name: campaignBoss.name, emoji: campaignBoss.emoji, coins: campaignBoss.coins, xp: campaignBoss.xp, loot: campaignBoss.loot });
      } else {
        haptic.error();
        setDefeat({ fainted: result.catFainted });
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
        setLastHit({ dmg: round.playerDmg, crit: round.playerCrit, guarded: result.guarded, healed: round.healed, thornDmg: round.thornDmg });
        playBossHitFx(round.playerCrit);
        setAttackPulse(n => n + 1);
        setLiveBossHp(round.bossHpAfter);
        roundTimer.current = setTimeout(counterBeat, 480);
      }, THROW_MS);
    };

    playerBeat();
  };

  // Raid/wydarzenie: WCIĄŻ jedno uderzenie na próbę w trwały bank HP (jak wcześniej na liście w
  // bosses.tsx) — świadomie BEZ kontrataku/paska HP kotka, ten mechanizm nigdy tam nie istniał i
  // nie wprowadzam nowej porażki-w-trakcie-walki bez pytania. Ta sama animacja rzutu łapką +
  // trafienia co kampania, tylko jedna faza zamiast rund, i można walić dalej od razu (nie trzeba
  // wracać na listę między próbami).
  const attackSimple = () => {
    if (!target || !target.unlocked || fighting || target.done) return;
    if (target.energy <= 0) { haptic.error(); toast.info('Brak prób ataku na dziś — wróć jutro po nowe.'); return; }
    const { damage, crit } = computeDamage(atkStatBonus, level, bonuses);
    setFighting(true);
    setPawFlying(true);
    pawTravel.setValue(0);
    Animated.timing(pawTravel, { toValue: 1, duration: THROW_MS, easing: Easing.out(Easing.quad), useNativeDriver: true }).start();
    roundTimer.current = setTimeout(() => {
      if (!alive.current) return;
      setPawFlying(false);
      haptic.medium();
      setLastHit({ dmg: damage, crit, guarded: false, healed: 0, thornDmg: 0 });
      playBossHitFx(crit);
      setAttackPulse(n => n + 1);
      setFighting(false);

      if (kind === 'raid') {
        const res = raidAttack(damage);
        setLiveBossHp(res.remaining);
        if (res.defeated) {
          roundTimer.current = setTimeout(() => {
            if (!alive.current) return;
            raidClaim(weekKey, raidCoins(level), raidXp(level));
            haptic.success();
            setVictory({ kind: 'raid', id: raid.id, name: raid.name, emoji: raid.emoji, coins: raidCoins(level), xp: raidXp(level) });
          }, 500);
        }
      } else if (kind === 'event' && eventBoss && eventKey) {
        const res = eventAttack(eventKey, eventMaxHp, damage);
        setLiveBossHp(res.remaining);
        if (res.defeated) {
          roundTimer.current = setTimeout(() => {
            if (!alive.current) return;
            eventClaim(eventKey, eventCoins(level), eventXp(level));
            haptic.success();
            setVictory({ kind: 'event', id: eventBoss.id, name: eventBoss.name, emoji: eventBoss.emoji, coins: eventCoins(level), xp: eventXp(level) });
          }, 500);
        }
      }
    }, THROW_MS);
  };

  const attack = kind === 'campaign' ? attackCampaign : attackSimple;

  const bShakeX = bShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const bPopScale = bPop.interpolate({ inputRange: [0, 1], outputRange: [1, 1.18] });
  const bFlashOp = bFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] });
  const bFloatY = bDmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const bFloatOp = bDmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const kShakeX = kShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const kFlashOp = kFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] });
  const kFloatY = kDmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const kFloatOp = kDmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  // Custom attack burst per boss (assets/ikonybosów/BOSSATTACK_*) na Twoim ciosie — tylko
  // kampania ma ustawione fx (bossAttackFx zwraca undefined dla raid/event id, wtedy fallback niżej).
  const attackFx = target ? bossAttackFx(target.id) : undefined;
  const fxScale = bPop.interpolate({ inputRange: [0, 1], outputRange: [0.7, 1.35] });
  const pawX = pawTravel.interpolate({ inputRange: [0, 1], outputRange: ['16%', '84%'] });
  const pawOp = pawTravel.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] });
  const pawScale = pawTravel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.15, 0.8] });
  const boltX = boltTravel.interpolate({ inputRange: [0, 1], outputRange: ['84%', '16%'] });
  const boltOp = boltTravel.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] });
  const boltScale = boltTravel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.15, 0.8] });

  const closeVictory = () => { setVictory(null); router.back(); };
  const closeDefeat = () => { setDefeat(null); router.back(); };
  const VictoryLootIcon = victory?.loot ? lootIcon(victory.loot) : Trophy;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>{headerTitle}</Text>
        <View style={s.energyPill}><Zap size={13} color="#38BDF8" /><Text style={s.energyTxt}>{target?.energy ?? 0}</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {!target ? (
          <View style={s.done}>
            <Swords size={30} color={c.text.muted} />
            <Text style={s.doneTxt}>{kind === 'campaign' ? 'Wszyscy bossowie pokonani! Kolejni wkrótce.' : 'Brak aktywnego wydarzenia teraz — wróć innym razem.'}</Text>
          </View>
        ) : !target.unlocked ? (
          <View style={s.lockBox}>
            <Lock size={16} color={c.text.muted} />
            <Text style={s.lockTxt}>Odblokujesz na poziomie {target.unlockLevel} (masz {level}). Rozwijaj pupila questami.</Text>
          </View>
        ) : (
          <View style={s.arena}>
            {/* dwa symetryczne kafelki — Pupil / Boss. Pupil ma pasek HP TYLKO w kampanii —
                raid/wydarzenie nie mają kontrataku, więc pasek zawsze pełny byłby mylący. */}
            <View style={{ width: '100%', position: 'relative' }}>
            <View style={s.vsRow}>
              <View style={s.tile}>
                <Text style={s.tileLabel} numberOfLines={1}>Pupil</Text>
                {kind === 'campaign' ? (
                  <>
                    <View style={s.tileHpTrack}><View style={[s.tileHpFill, { width: `${Math.round(catHp / catMax * 100)}%`, backgroundColor: '#2AC68F' }]} /></View>
                    <Text style={s.tileHpTxt}>{catHp} / {catMax}</Text>
                  </>
                ) : <View style={{ height: 18 }} />}
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
                <Text style={[s.tileLabel, { color: WEAK_COLOR[target.weakness] ?? c.text.primary }]} numberOfLines={1}>{target.name}</Text>
                <View style={s.tileHpTrack}><View style={[s.tileHpFill, { width: `${Math.round(targetRemaining / target.maxHp * 100)}%` }]} /></View>
                <Text style={s.tileHpTxt}>{targetRemaining} / {target.maxHp}</Text>
                <View style={s.tilePortrait}>
                  <Animated.View style={{ transform: [{ translateX: bShakeX }, { scale: bPopScale }] }}>
                    <BossArt id={target.id} emoji={target.emoji} size={104} />
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

            {/* pociski między kafelkami — łapka kota (Twój cios, wszystkie tryby) i "broń" bossa
                (kontratak, TYLKO kampania — boltFlying nigdy nie ustawia się w attackSimple) */}
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

            <Text style={s.bossTaunt}>„{target.taunt}"</Text>
            {/* Tylko HP + motyw (słabość) — BEZ nagrody i mechanik (osłona/regen) przed walką,
                user (2026-08-10): "zbyt dużo opisu bossa". Reaktywne linijki niżej (co się
                WŁAŚNIE stało w walce) zostają — to nie spoiler, to informacja zwrotna. */}
            <Text style={s.motywTxt}>Motyw: <Text style={{ color: WEAK_COLOR[target.weakness] ?? c.text.primary, fontWeight: '800' }}>{target.weaknessLabel}</Text></Text>
            {lastHit?.guarded && <View style={s.mechRow}><Shield size={13} color="#F4B740" /><Text style={s.mechNote}>Osłona: ten boss redukuje ciosy ×0.5</Text></View>}
            {!!lastHit?.healed && <View style={s.mechRow}><HeartPulse size={13} color="#7DD3FC" /><Text style={s.mechNoteHeal}>Boss zregenerował +{lastHit.healed} (wrodzona regeneracja)</Text></View>}
            {!!catHit?.healed && <View style={s.mechRow}><HeartPulse size={13} color="#2AC68F" /><Text style={[s.mechNoteHeal, { color: '#2AC68F' }]}>Uzdrowienie: kotek odzyskał +{catHit.healed} HP</Text></View>}
            {/* Item "Cierń" liczył się już wcześniej w silniku, ale bez własnego pola w
                FightRound UI nie miało jak pokazać że w ogóle coś zrobił — user (2026-08-11):
                "nie widzę żeby był aktywny jakoś podczas walki realnie". */}
            {!!lastHit?.thornDmg && (
              <View style={s.mechRow}>
                <Image source={COMBAT_ITEMS.thorn.icons[0]} style={{ width: 13, height: 13 }} resizeMode="contain" />
                <Text style={[s.mechNoteHeal, { color: '#4ADE80' }]}>Cierń: dodatkowe -{lastHit.thornDmg} bossowi</Text>
              </View>
            )}

            {target.done ? (
              <Text style={s.doneInlineTxt}>Pokonany ✓ · {kind === 'raid' ? 'nowy w poniedziałek' : 'wróć w kolejnym okresie'}</Text>
            ) : (
              <PressableScale onPress={attack} style={{ width: '100%' }}>
                <View style={[s.attackBtn, (target.energy <= 0 || fighting) && { opacity: 0.5 }]}>
                  <Swords size={18} color="#fff" />
                  <Text style={s.attackTxt}>{fighting ? 'Walka trwa…' : 'WALCZ!'}</Text>
                </View>
              </PressableScale>
            )}
          </View>
        )}
      </ScrollView>

      <Modal visible={!!victory} transparent statusBarTranslucent animationType="fade" onRequestClose={closeVictory}>
        <Pressable style={s.vBackdrop} onPress={closeVictory}>
          <Confetti colors={['#FDE047', '#2AC68F', '#38BDF8', '#F472B6']} />
          {victory && (
            <View style={s.vCenter} pointerEvents="none">
              <Text style={s.vKicker}>{victory.kind === 'raid' ? 'RAID POKONANY!' : victory.kind === 'event' ? 'WYDARZENIE POKONANE!' : 'WYGRANA!'}</Text>
              <View style={{ opacity: 0.6 }}>
                <BossArt id={victory.id} emoji={victory.emoji} size={78} />
              </View>
              <Text style={s.vName}>{victory.kind === 'campaign' ? `${victory.name} pokonany` : victory.name}</Text>
              <View style={s.vLoot}>
                <VictoryLootIcon size={30} color="#2AC68F" />
                {victory.loot ? (
                  <>
                    <Text style={s.vLootName}>{victory.loot.name}</Text>
                    <Text style={s.vLootDesc}>{victory.loot.desc}</Text>
                  </>
                ) : (
                  <Text style={s.vLootName}>{victory.kind === 'raid' ? 'Medal tygodnia' : 'Medal wydarzenia'}</Text>
                )}
              </View>
              <View style={s.vRewardRow}>
                <Coins size={16} color="#FDE047" /><Text style={s.vReward}>{victory.coins} · +{victory.xp} XP</Text>
              </View>
            </View>
          )}
          <Text style={s.vHint}>Stuknij, aby zamknąć</Text>
        </Pressable>
      </Modal>

      <Modal visible={!!defeat} transparent statusBarTranslucent animationType="fade" onRequestClose={closeDefeat}>
        <Pressable style={s.vBackdrop} onPress={closeDefeat}>
          {campaignBoss && defeat && (
            <View style={s.vCenter} pointerEvents="none">
              <Text style={[s.vKicker, { color: defeat.fainted ? '#F87171' : '#F4B740' }]}>{defeat.fainted ? 'PRZEGRANA' : 'BOSS PRZETRWAŁ'}</Text>
              <View style={{ opacity: 0.5 }}>
                <BossArt id={campaignBoss.id} emoji={campaignBoss.emoji} size={78} />
              </View>
              <Text style={s.vName}>{campaignBoss.name} przetrwał</Text>
              <Text style={s.vDefeatSub}>
                {defeat.fainted
                  ? 'Kotek zemdlał — HP resetuje się, spróbuj ponownie, kiedy będziesz gotowy.'
                  : 'Przeciwnik zbyt szybko się leczy/broni — wróć mocniejszy (staty, poziom, łup) i spróbuj znów.'}
              </Text>
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
  motywTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary, textAlign: 'center', marginTop: 4 },

  mechRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, justifyContent: 'center', flexWrap: 'wrap' },
  mechNote: { fontSize: 11.5, color: '#F4B740', fontWeight: '800', textAlign: 'center' },
  mechNoteHeal: { fontSize: 11.5, color: '#7DD3FC', fontWeight: '800', textAlign: 'center' },

  doneInlineTxt: { fontSize: 13, fontWeight: '800', color: '#2AC68F', textAlign: 'center', marginTop: spacing[4] },
  attackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF4444', borderRadius: radius.lg, paddingVertical: 16, marginTop: spacing[4], width: '100%' },
  attackTxt: { fontSize: 17, fontWeight: '900', color: '#fff' },
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

  attackFx: { position: 'absolute', width: 150, height: 150 },
  projectile: { position: 'absolute', top: 96, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
}));
