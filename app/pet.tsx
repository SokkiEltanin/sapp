import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Animated, Easing, Alert, Image, Modal } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { LinearGradient } from 'expo-linear-gradient';
import { router } from 'expo-router';
import { ChevronLeft, Pencil, Check, Coins, Heart, Zap, Lock, Gift, Swords, Compass, Hourglass, X } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CatArt from '@/components/pet/CatArt';
import CrateModal from '@/components/pet/CrateModal';
import BoxRevealModal from '@/components/pet/BoxRevealModal';
import PetCustomizeModal from '@/components/pet/PetCustomizeModal';
import GearPanel from '@/components/pet/GearPanel';
import PupilNavbar from '@/components/pet/PupilNavbar';
import { rollBox, DAILY_BOX, LootBox, BoxReward } from '@/utils/petBoxes';
import { SHOP_COLORS } from '@/utils/petShop';
import { useStreakFreezeStore } from '@/store/streakFreezeStore';
import { usePetStore, levelFromXp, growthStage, catMaxHp, combatItemSlotsFor } from '@/store/petStore';
import { bossBonuses, atkPower, atkMultiplier, dailyAttempts, BASE_ATK } from '@/utils/bosses';
import { COMBAT_ITEMS, CombatItemId, combatItemUpgradeCost } from '@/utils/combatItems';
import { gearCombatBonuses, gearFlatHp } from '@/utils/gear';
import { computePetState, petStatusLine, PetInput } from '@/utils/petState';
import { paletteById } from '@/utils/catPalettes';
import { useHabits } from '@/hooks/useHabits';
import { usePetHealthSync } from '@/hooks/usePetHealthSync';
import { useMoodStore } from '@/store/moodStore';
import { useExpensesStore } from '@/store/expensesStore';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';
import { missionMinutesFor, missionRewardFor, minibossForMission, MissionProfile, MISSION_PROFILE_ORDER, MISSION_PROFILE_LABEL } from '@/utils/missions';

const ITEM_IDS = Object.keys(COMBAT_ITEMS) as CombatItemId[];
const HP_UPGRADE_AMOUNT = 20;
const hpUpgradeCost = (currentBonus: number) => 40 + Math.floor(currentBonus / HP_UPGRADE_AMOUNT) * 15;
const ATK_UPGRADE_AMOUNT = 5;
const atkUpgradeCost = (currentBonus: number) => 40 + Math.floor(currentBonus / ATK_UPGRADE_AMOUNT) * 15;

const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = () => ymdOf(new Date());
const yesterdayISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymdOf(d); };
const STAGE_SIZE = { baby: 150, kid: 172, teen: 194, adult: 214 } as const;
function fmtMissionDuration(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  const h = Math.floor(total / 60), m = total % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

export default function Pet() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);

  const { name, xp, coins, careTick, catColor, catStripes, catEyeColor, catNoseColor, catWhiskers, catLegStripes, petCat, affection, affectionDay, pendingCrates, ownedItems, claimDailyBox, dayClaims, buyItem, grantStartup, grantGear, addCoins, onboarded,
    missionStartedAt, missionEndsAt, startMission, cancelMission,
    catMaxHpBonus, atkStatBonus, buyMaxHp, buyAtkStat,
    ownedCombatItems, equippedCombatItems, upgradeCombatItem, equipCombatItem, unequipCombatItem,
    equippedGear, ownedGear } = usePetStore();
  const addFreezes = useStreakFreezeStore(st => st.addFreezes);
  const lvl = levelFromXp(xp);
  // Misja (utils/missions.ts, 2026-08-15) — czas trwania to godziny, nie sekundy, więc tik co
  // 30s (nie co 1s jak TrainingSessionModal) wystarczy żeby licznik czuł się "żywy" bez
  // zbędnego re-renderu ekranu co sekundę. `missionTick` sam w sobie nieużywany — wymusza
  // tylko przeliczenie missionRemainingMs poniżej.
  const [missionTick, setMissionTick] = useState(0);
  useEffect(() => {
    if (!missionEndsAt) return;
    const iv = setInterval(() => setMissionTick(t => t + 1), 30000);
    return () => clearInterval(iv);
  }, [missionEndsAt]);
  const missionRemainingMs = missionEndsAt ? new Date(missionEndsAt).getTime() - Date.now() : 0;
  void missionTick;
  const missionReady = !!missionEndsAt && missionRemainingMs <= 0;
  // Pasek postępu (2026-08-15, user: "niech będzie pasek też ładowania przy timerze") —
  // elapsed/total od missionStartedAt do missionEndsAt, capowany 0..1 (nie powinno przekroczyć,
  // ale zegar urządzenia to nie gwarancja).
  const missionTotalMs = missionStartedAt && missionEndsAt
    ? new Date(missionEndsAt).getTime() - new Date(missionStartedAt).getTime() : 0;
  const missionProgress = missionTotalMs > 0
    ? Math.min(1, Math.max(0, 1 - missionRemainingMs / missionTotalMs)) : 0;
  // Kotek na pasku misji ma podskakiwać (2026-08-18, user: "miał tam podskakiwać jak w tych
  // paskach na dashboardzie") — zewnętrzna, prosta pętla bounce na WRAPPERZE (nie
  // wewnętrzny `animate` CatArt, ten jest budowany pod interakcje/idle na głównym portrecie,
  // nie pod ciągłe "chodzenie w miejscu" małej ikony) — start/stop przy wejściu/wyjściu z
  // trybu "w misji", żeby nie animować w tle gdy karta tego nie pokazuje.
  const missionBounce = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!missionEndsAt || missionReady) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(missionBounce, { toValue: 1, duration: 320, easing: Easing.out(Easing.quad), useNativeDriver: true }),
      Animated.timing(missionBounce, { toValue: 0, duration: 320, easing: Easing.in(Easing.quad), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [missionEndsAt, missionReady]);
  const missionBounceY = missionBounce.interpolate({ inputRange: [0, 1], outputRange: [0, -6] });
  // Lekkie wahadło "chodu" MAŁEGO kotka na pasku (2026-08-20, przeskalowane z dawnego dużego
  // kołysania — user chciał wtedy duży kafelek "gibający się jakby szedł", teraz to samo
  // wahadło (mniejsza amplituda, -4/4° zamiast -7/7°) na małym jeżdżącym po pasku kotku).
  const missionSway = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!missionEndsAt || missionReady) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(missionSway, { toValue: 1, duration: 480, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(missionSway, { toValue: -1, duration: 960, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      Animated.timing(missionSway, { toValue: 0, duration: 480, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [missionEndsAt, missionReady]);
  const missionSwayRotate = missionSway.interpolate({ inputRange: [-1, 1], outputRange: ['-4deg', '4deg'] });
  // Animacja WEJŚCIA na pasek (2026-08-20, user: "kotek jest podwojony chce tylko animacje jak
  // on wchodzi na pasek zmniejsza sie w trakcie wchodzenia i sobie tak idzie z paskiem" —
  // dawniej DWA kotki naraz: duży skurczony na scenie + mały na pasku, wyglądało jak duplikat.
  // Teraz JEDEN kotek: startuje duży (`outputRange` scale 3.2) i wysoko (translateY -90, tam
  // gdzie siedział normalny portret), potem kurczy się i opada DOKŁADNIE na pasek w jednej,
  // płynnej animacji. Odtwarza się przy KAŻDYM zamontowaniu ekranu w trakcie misji (nie tylko
  // raz przy starcie) — prościej niż śledzenie "czy user już to widział", i nieszkodliwe
  // (user i tak wraca na ten ekran raz na jakiś czas, nie w pętli).
  const missionEnter = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!missionEndsAt || missionReady) return;
    missionEnter.setValue(0);
    Animated.timing(missionEnter, { toValue: 1, duration: 550, easing: Easing.out(Easing.cubic), useNativeDriver: true }).start();
  }, [missionEndsAt, missionReady]);
  const missionEnterScale = missionEnter.interpolate({ inputRange: [0, 1], outputRange: [3.2, 1] });
  const missionEnterY = missionEnter.interpolate({ inputRange: [0, 1], outputRange: [-90, 0] });
  // Fala "ładowania" przesuwająca się po wypełnionej części paska (2026-08-20, user: "za nim
  // taka ładująca się fala") — jasny pasek skośnie przecinający wypełnienie, zapętlony,
  // przycięty przez `overflow:hidden` na `missionBarFillWrap` do aktualnej szerokości
  // wypełnienia (nie trzeba znać jej w px).
  const missionWave = useRef(new Animated.Value(0)).current;
  useEffect(() => {
    if (!missionEndsAt || missionReady) return;
    const loop = Animated.loop(Animated.timing(missionWave, { toValue: 1, duration: 1300, easing: Easing.linear, useNativeDriver: true }));
    loop.start();
    return () => loop.stop();
  }, [missionEndsAt, missionReady]);
  const missionWaveX = missionWave.interpolate({ inputRange: [0, 1], outputRange: [-70, 280] });
  const missionMb = missionStartedAt ? minibossForMission(missionStartedAt) : null;
  const onCancelMission = () => {
    haptic.tap();
    Alert.alert(
      'Wrócić z misji?',
      'Jeżeli chcesz anulować, NIE otrzymasz nagrody za misję.',
      [
        { text: 'Zostań w misji', style: 'cancel' },
        { text: 'Wróć natychmiast', style: 'destructive', onPress: () => { cancelMission(); haptic.tap(); toast.info('Misja anulowana — bez nagrody'); } },
      ],
    );
  };
  const [boxReveal, setBoxReveal] = useState<{ box: LootBox; reward: BoxReward } | null>(null);
  // Skrzynka dnia PRZY KOCIE (nie tylko w sklepie — tam user o niej zapominał). Ta sama gacza.
  const dailyBoxReady = !dayClaims[`dailybox:${todayISO()}`];
  const onDailyBox = () => {
    haptic.tap();
    if (!dailyBoxReady || !claimDailyBox()) { haptic.error(); toast.info('Skrzynkę dnia już odebrałeś — wróć jutro'); return; }
    const reward = rollBox(DAILY_BOX, SHOP_COLORS, ownedItems, lvl.level);
    if (reward.type === 'color') buyItem(reward.colorId, 0);
    else if (reward.type === 'startup') grantStartup(reward.startupId);
    else if (reward.type === 'coins') addCoins(reward.coins);
    else if (reward.type === 'freeze') addFreezes(reward.count);
    else if (reward.type === 'gear') grantGear(reward.itemId, reward.rarity);
    haptic.success();
    setBoxReveal({ box: DAILY_BOX, reward });
  };
  const [celebrate, setCelebrate] = useState(0);
  const [crateOpen, setCrateOpen] = useState(false);
  // affection resets each day — show 0 on a fresh day even before the first tap
  const affToday = affectionDay === todayISO() ? affection : 0;
  const palette = useMemo(() => paletteById(catColor), [catColor]);
  const { habits, todayDone } = useHabits();
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();
  const { health, stepGoal, budgets } = usePetHealthSync();
  const [customizeOpen, setCustomizeOpen] = useState(false);
  // Onboarding (2026-08-19) — pierwsze uruchomienie otwiera modal imienia+kosmetyki
  // wymuszony (bez X), żeby nazwać i ostylować pupila zamiast cichego defaultu "Blobek".
  useEffect(() => { if (!onboarded) setCustomizeOpen(true); }, [onboarded]);

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

  const onSendMission = (profile: MissionProfile) => { haptic.tap(); startMission(lvl.level, profile); };
  const onFightMission = () => { haptic.tap(); router.push('/boss-fight?kind=mission' as any); };
  const [missionModalOpen, setMissionModalOpen] = useState(false);

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

  // ── Siła bojowa + Ekwipunek bojowy (2026-08-19, scalone tu z pet-stats.tsx —
  // restrukturyzacja nawigacji, user: "statystyki były w zakładce z kotkiem i itemami").
  // Bonusy z lootu kampanii + gear (krok 8) — TE SAME wzory co w boss-fight.tsx, żeby
  // wyświetlana "Siła bojowa" nie kłamała o realnej mocy w walce.
  const bonuses = useMemo(() => {
    const loot = bossBonuses(ownedItems);
    const gear = gearCombatBonuses(equippedGear, ownedGear);
    return { atk: loot.atk + gear.atk, dodge: loot.dodge + gear.dodge, crit: loot.crit + gear.crit, energyMult: loot.energyMult + gear.energyMult };
  }, [ownedItems, equippedGear, ownedGear]);
  const power = atkPower(atkStatBonus, lvl.level, bonuses);
  const mult = atkMultiplier(lvl.level, bonuses);
  const maxHp = catMaxHp(catMaxHpBonus) + gearFlatHp(equippedGear, ownedGear);
  const attempts = dailyAttempts(bonuses.energyMult);
  const hpCost = hpUpgradeCost(catMaxHpBonus);
  const atkCost = atkUpgradeCost(atkStatBonus);
  const itemSlots = combatItemSlotsFor(lvl.level);
  const sortedItemIds = useMemo(
    () => [...ITEM_IDS].sort((a, b) => (ownedCombatItems[a] ? 0 : 1) - (ownedCombatItems[b] ? 0 : 1)),
    [ownedCombatItems],
  );
  const [pendingUpgrade, setPendingUpgrade] = useState<{ name: string; cost: number; onYes: () => void } | null>(null);
  const confirmUpgrade = (name: string, cost: number, onYes: () => void) => {
    setPendingUpgrade({ name, cost, onYes });
  };
  const onBuyMaxHp = () => {
    haptic.tap();
    if (coins < hpCost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${hpCost}`); return; }
    confirmUpgrade('Ulepszenie HP kotka', hpCost, () => {
      if (buyMaxHp(hpCost, HP_UPGRADE_AMOUNT)) { haptic.success(); toast.success(`Kupione: +${HP_UPGRADE_AMOUNT} max HP kotka`); }
    });
  };
  const onBuyAtk = () => {
    haptic.tap();
    if (coins < atkCost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${atkCost}`); return; }
    confirmUpgrade('Ulepszenie ATK', atkCost, () => {
      if (buyAtkStat(atkCost, ATK_UPGRADE_AMOUNT)) { haptic.success(); toast.success(`Kupione: +${ATK_UPGRADE_AMOUNT} ATK`); }
    });
  };
  const onToggleEquip = (id: CombatItemId) => {
    haptic.tap();
    if (equippedCombatItems.includes(id)) { unequipCombatItem(id); return; }
    if (!equipCombatItem(id)) { haptic.error(); toast.error(`Masz już ${itemSlots} założone itemy — zdejmij coś najpierw`); return; }
    haptic.success();
  };
  const onUpgradeItem = (id: CombatItemId, level: number, maxLevel: number) => {
    haptic.tap();
    if (level >= maxLevel) return;
    const cost = combatItemUpgradeCost(level);
    if (coins < cost) { haptic.error(); toast.error(`Za mało monet — potrzeba ${cost}`); return; }
    confirmUpgrade(COMBAT_ITEMS[id].name, cost, () => {
      if (upgradeCombatItem(id, cost, maxLevel)) { haptic.success(); toast.success(`${COMBAT_ITEMS[id].name} → poziom ${level + 1}`); }
    });
  };

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
        {/* Skrzynka dnia — kwadratowy przycisk w headerze, nie wiersz w liście questów
            (2026-08-18, user: "skrzynka daily powinna być jako square button przy
            overlayu bo ona ginie w tych taskach" — jako pełnoszerokościowy wiersz między
            questami faktycznie wyglądała jak kolejny task, łatwo przewinąć obok). Header
            jest NAD ScrollView (zawsze widoczny, nie trzeba scrollować) — widoczna TYLKO
            gdy jest coś do odebrania (dailyBoxReady); po odebraniu znika, żaden szary
            "nieaktywny" przycisk nie zaśmieca headera resztę dnia. */}
        {dailyBoxReady && (
          <PressableScale onPress={onDailyBox} style={s.dailyBoxIconBtn}>
            <Gift size={18} color="#0B0E1A" />
            <View style={s.dailyBoxDot} />
          </PressableScale>
        )}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Nagłówek: nazwa+samopoczucie (lewo) / lvl+głaskanie (prawo) — (2026-08-16 v2, user:
            "nazwa po lewej, samopoczucie pod nim, po prawej ta sama linijka pasek lvl oraz
            pasek pogłaskania, wywal przycisk pogłaskaj po co on" — przycisk zniknął, tap na
            kota (handlePet, niżej) zostaje jedynym sposobem głaskania, tak jak przed 2026-08-16). */}
        <View style={s.topHeader}>
          <View style={s.topLeft}>
            <TouchableOpacity style={s.nameRow} onPress={() => { haptic.tap(); setCustomizeOpen(true); }} activeOpacity={0.7}>
              <Text style={s.name}>{name}</Text>
              <Pencil size={14} color={c.text.muted} />
            </TouchableOpacity>
            <View style={[s.moodChip, { backgroundColor: pet.color + '1E', borderColor: pet.color + '55' }]}>
              <Text style={[s.status, { color: pet.color }]}>{pet.label}</Text>
            </View>
          </View>
          <View style={s.topRight}>
            {/* Pasek Lv POWIĘKSZONY (2026-08-20) — jedyny wskaźnik poziomu na ekranie odkąd
                osobna karta "Doświadczenie" w gridzie Siła bojowa zniknęła (zastąpiona kaflem
                misji, patrz niżej) — user: "tamten na górze level zostawiamy jako jedyny
                powiększamy trochę żeby było widać ile na ile XP jeszcze". */}
            <View style={s.lvlBarRow}>
              <Text style={s.lvlBarLabel}>Lv {lvl.level}</Text>
              <View style={s.lvlBarTrack}><View style={[s.lvlBarFill, { width: `${Math.round(lvl.progress * 100)}%`, backgroundColor: '#A78BFA' }]} /></View>
            </View>
            <Text style={s.lvlXpTxt}>{lvl.inLevel}/{lvl.needed} XP</Text>
            <View style={s.miniBarRow}>
              <Text style={s.affHeart}>{affToday >= 100 ? '❤️' : affToday > 0 ? '🩵' : '🤍'}</Text>
              <View style={s.miniBarTrack}><View style={[s.miniBarFill, { width: `${affToday}%`, backgroundColor: '#F472B6' }]} /></View>
            </View>
          </View>
        </View>
        <Text style={s.tip}>{petStatusLine(pet)}</Text>

        {/* stage — no room backdrop any more; the cat IS the stage. Ekwipunek (6 slotów,
            gear.ts) flankuje kotka 3 lewo/3 prawo (2026-08-20, `GearPanel` bierze kotka jako
            `children` żeby otoczyć go z obu stron — patrz NEXT_STEPS.md "SYSTEM EKWIPUNKU"
            krok 7 i wpis "Gear layout + konsolidacja UI misji"). Stały rozmiar 300px zawsze —
            dawny dynamiczny `minHeight` dla wielkiego kafelka podróży zniknął razem z nim
            (kotek W MISJI jest teraz MNIEJSZY, nie większy, mieści się bez problemu). */}
        <View style={s.stage}>
          <GearPanel>
            {/* Kotek W MISJI — JEDEN kotek, nie dwa (2026-08-20, user: "kotek jest podwojony" —
                dawniej duży skurczony portret NA scenie + osobny mały na pasku renderowały się
                RAZEM, wyglądało jak duplikat). Teraz tylko ten na pasku istnieje — "wchodzi"
                na niego jednorazową animacją `missionEnter` (duży i wysoko → mały i na pasku),
                potem jeździ wzdłuż wypełnienia z tym samym bounce/sway co dawniej. Nad paskiem
                nazwa miejsca (`missionMb.destination`, `minibossForMission` — DETERMINISTYCZNIE
                ten sam zwierzak/miejsce co dostanie do walki `boss-fight.tsx` po powrocie, patrz
                minibosses.ts) i odliczanie po przeciwnej stronie. */}
            {missionEndsAt && !missionReady ? (
              <View style={s.stageMissionWrap}>
                <View style={s.missionHeadRow}>
                  <Text style={s.missionDestTxt} numberOfLines={1}>{missionMb ? `${missionMb.emoji} ${missionMb.destination}` : 'W drodze…'}</Text>
                  <Text style={s.missionTimerTxt}>{fmtMissionDuration(missionRemainingMs / 60000)}</Text>
                </View>
                <View style={s.missionBarTrack}>
                  <View style={[s.missionBarFillWrap, { width: `${Math.round(missionProgress * 100)}%` }]}>
                    <LinearGradient colors={['#2AA9E0', '#38BDF8']} start={{ x: 0, y: 0 }} end={{ x: 1, y: 0 }} style={StyleSheet.absoluteFill} />
                    <Animated.View style={[s.missionBarWave, { transform: [{ translateX: missionWaveX }, { rotate: '18deg' }] }]} />
                  </View>
                  <View style={[s.missionBarCatWrap, { left: `${Math.round(missionProgress * 100)}%` }]}>
                    <Animated.View style={{ transform: [{ translateY: missionEnterY }, { scale: missionEnterScale }] }}>
                      <Animated.View style={{ transform: [{ translateY: missionBounceY }, { rotate: missionSwayRotate }] }}>
                        <CatArt size={22} animate={false} palette={palette} stripes={catStripes}
                          eyeColor={catEyeColor} noseColor={catNoseColor} whiskers={catWhiskers} legStripes={catLegStripes} />
                      </Animated.View>
                    </Animated.View>
                  </View>
                </View>
                <TouchableOpacity onPress={onCancelMission} hitSlop={8}>
                  <Text style={s.stageMissionCancel}>Wróć natychmiast</Text>
                </TouchableOpacity>
              </View>
            ) : (
              <CatArt expression={pet.expression} size={STAGE_SIZE[stage] + 90} palette={palette} stripes={catStripes}
                eyeColor={catEyeColor} noseColor={catNoseColor} whiskers={catWhiskers} legStripes={catLegStripes}
                onPress={handlePet} onLongPress={handleCuddle} celebrate={celebrate} affection={affToday} />
            )}
          </GearPanel>
        </View>

        {/* ── Misja (utils/missions.ts, 2026-08-15) — user: wysyłasz pupila na X minut/godzin
            (rośnie z levelem), po powrocie walka z większą nagrodą niż daily quest. UI misji
            skonsolidowane (2026-08-20) do JEDNEGO małego kafla w gridzie "Siła bojowa" niżej
            (zastępuje dawną kartę "Doświadczenie" — Lv/XP ma teraz TYLKO górny pasek nagłówka)
            + popup z wyborem profilu zamiast inline listy 3 wierszy. ── */}
        <MissionSendModal
          visible={missionModalOpen}
          onClose={() => setMissionModalOpen(false)}
          level={lvl.level}
          onSend={(profile) => { setMissionModalOpen(false); onSendMission(profile); }}
        />

        {pendingCrates > 0 && (
          <PressableScale onPress={() => { haptic.tap(); setCrateOpen(true); }} style={s.crateBtn}>
            <Text style={{ fontSize: 18 }}>🐟</Text>
            <Text style={s.crateBtnTxt}>Otwórz skrzynkę sardynek{pendingCrates > 1 ? ` · ${pendingCrates}` : ''}</Text>
          </PressableScale>
        )}

        {/* ── Siła bojowa (scalone z pet-stats.tsx, 2026-08-19) ── */}
        <Text style={s.section}>Siła bojowa</Text>
        <View style={s.statGrid}>
          <View style={[s.statCard, { borderColor: '#F8717144', backgroundColor: '#F8717112' }]}>
            <Swords size={18} color="#F87171" />
            <Text style={s.statVal}>{Math.round(power)}</Text>
            <Text style={s.statLabel}>Moc ataku</Text>
            <Text style={s.statSub}>({BASE_ATK}+{atkStatBonus}) × {mult.toFixed(2)}</Text>
            <TouchableOpacity onPress={onBuyAtk} style={[s.buyPill, { marginTop: 6 }]} activeOpacity={0.8}>
              <Swords size={10} color="#F87171" /><Text style={s.buyPillTxt}>+{ATK_UPGRADE_AMOUNT}</Text>
              <Coins size={10} color="#FBBF24" /><Text style={s.buyPillTxt}>{atkCost}</Text>
            </TouchableOpacity>
          </View>
          <View style={[s.statCard, { borderColor: '#2AC68F44', backgroundColor: '#2AC68F12' }]}>
            <Heart size={18} color="#2AC68F" />
            <Text style={s.statVal}>{maxHp}</Text>
            <Text style={s.statLabel}>Max HP kotka</Text>
            <Text style={s.statSub}>bazowe 100 + {catMaxHpBonus}{gearFlatHp(equippedGear, ownedGear) > 0 ? ` + ${Math.round(gearFlatHp(equippedGear, ownedGear))} (ekwipunek)` : ''}</Text>
            <TouchableOpacity onPress={onBuyMaxHp} style={[s.buyPill, { marginTop: 6 }]} activeOpacity={0.8}>
              <Heart size={10} color="#2AC68F" /><Text style={s.buyPillTxt}>+{HP_UPGRADE_AMOUNT}</Text>
              <Coins size={10} color="#FBBF24" /><Text style={s.buyPillTxt}>{hpCost}</Text>
            </TouchableOpacity>
          </View>
          <View style={[s.statCard, { borderColor: '#38BDF844', backgroundColor: '#38BDF812' }]}>
            <Zap size={18} color="#38BDF8" />
            <Text style={s.statVal}>{attempts}</Text>
            <Text style={s.statLabel}>Prób dziennie</Text>
            <Text style={s.statSub}>{bonuses.energyMult > 0 ? `+${Math.round(bonuses.energyMult * 100)}% z łupu` : 'baza 3'}</Text>
          </View>
          {/* Kafel misji (2026-08-20) — zastępuje dawną kartę "Doświadczenie" (XP/Lv ma teraz
              TYLKO powiększony pasek w nagłówku, patrz `topRight`/`miniBarRow` niżej). Trzy
              stany: brak misji → przycisk otwierający `MissionSendModal`; w drodze → ikona
              klepsydry + odliczanie (kotek na scenie ma już swój pasek, tu tylko skrót);
              gotowa → przycisk Walcz. */}
          <View style={[s.statCard, { borderColor: '#38BDF844', backgroundColor: '#38BDF812' }]}>
            {!missionEndsAt ? (
              <>
                <Compass size={18} color="#38BDF8" />
                <Text style={s.statLabel}>Misja</Text>
                <Text style={s.statSub}>Wyślij po nagrodę</Text>
                <TouchableOpacity onPress={() => { haptic.tap(); setMissionModalOpen(true); }} style={[s.buyPill, { marginTop: 6 }]} activeOpacity={0.8}>
                  <Compass size={10} color="#38BDF8" /><Text style={s.buyPillTxt}>Wyślij</Text>
                </TouchableOpacity>
              </>
            ) : missionReady ? (
              <>
                <Swords size={18} color="#2AC68F" />
                <Text style={s.statVal}>Gotowe!</Text>
                <Text style={s.statLabel}>Misja</Text>
                <TouchableOpacity onPress={onFightMission} style={[s.buyPill, { marginTop: 6, backgroundColor: '#2AC68F18', borderColor: '#2AC68F40' }]} activeOpacity={0.8}>
                  <Swords size={10} color="#2AC68F" /><Text style={[s.buyPillTxt, { color: '#2AC68F' }]}>Walcz</Text>
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Hourglass size={18} color="#38BDF8" />
                <Text style={s.statVal}>{fmtMissionDuration(missionRemainingMs / 60000)}</Text>
                <Text style={s.statLabel}>Misja w drodze</Text>
              </>
            )}
          </View>
        </View>
        {(bonuses.dodge > 0 || bonuses.crit > 0) && (
          <Text style={s.blurb}>Z łupu bossów: {bonuses.dodge > 0 ? `+${Math.round(bonuses.dodge * 100)}% unik ` : ''}{bonuses.crit > 0 ? `+${Math.round(bonuses.crit * 100)}% kryt` : ''}</Text>
        )}

        {/* ── Ekwipunek bojowy (scalone z pet-stats.tsx, 2026-08-19) ── */}
        <Text style={s.section}>Ekwipunek bojowy ({equippedCombatItems.length}/{itemSlots} założone)</Text>
        <Text style={s.blurb}>Losowany ze skrzynek z głaskania. Załóż do {itemSlots} naraz (rośnie z poziomem, max 6) — działają w każdej walce kampanii.</Text>
        <View style={{ gap: spacing[2], marginTop: spacing[2], width: '100%' }}>
          {sortedItemIds.map(id => {
            const def = COMBAT_ITEMS[id];
            const level = ownedCombatItems[id] ?? 0;
            const owned = level > 0;
            const equipped = equippedCombatItems.includes(id);
            const maxed = level >= def.maxLevel;
            const cost = combatItemUpgradeCost(level);
            return (
              <View key={id} style={[s.itemRow, !owned && s.itemRowLocked]}>
                <View style={[s.itemIcon, !owned && s.itemIconLocked]}>
                  {owned
                    ? <Image source={def.icons[Math.min(level, def.icons.length) - 1]} style={{ width: 30, height: 30 }} resizeMode="contain" />
                    : <Lock size={18} color={c.text.muted} />}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={s.cellName}>{owned ? def.name : '???'}</Text>
                  <Text style={s.cellState} numberOfLines={2}>{owned ? def.desc : 'Nieznaleziony — spróbuj skrzynki z głaskania'}</Text>
                  {owned && def.maxLevel > 1 && <Text style={s.itemLevel}>poziom {level}/{def.maxLevel}</Text>}
                </View>
                {owned && (
                  <View style={{ gap: 6, alignItems: 'flex-end' }}>
                    <TouchableOpacity onPress={() => onToggleEquip(id)} style={[s.equipPill, equipped && s.equipPillOn]} activeOpacity={0.8}>
                      {equipped && <Check size={11} color={c.bg.primary} />}
                      <Text style={[s.equipPillTxt, equipped && s.equipPillTxtOn]}>{equipped ? 'Założone' : 'Załóż'}</Text>
                    </TouchableOpacity>
                    {!maxed && (
                      <TouchableOpacity onPress={() => onUpgradeItem(id, level, def.maxLevel)} style={s.buyPill} activeOpacity={0.8}>
                        <Coins size={10} color="#FBBF24" /><Text style={s.buyPillTxt}>{cost}</Text>
                      </TouchableOpacity>
                    )}
                  </View>
                )}
              </View>
            );
          })}
        </View>

      </ScrollView>

      <ConfirmDialog
        visible={!!pendingUpgrade}
        title="Potwierdź ulepszenie"
        message={pendingUpgrade ? `${pendingUpgrade.name} — ${pendingUpgrade.cost} monet` : ''}
        confirmLabel="Ulepsz"
        cancelLabel="Anuluj"
        destructive={false}
        onConfirm={() => { pendingUpgrade?.onYes(); setPendingUpgrade(null); }}
        onCancel={() => setPendingUpgrade(null)}
      />

      <CrateModal visible={crateOpen} onClose={() => setCrateOpen(false)} onOpened={() => setCelebrate(c => c + 1)} />
      <BoxRevealModal
        visible={!!boxReveal}
        reward={boxReveal?.reward ?? null}
        boxColor={boxReveal?.box.color ?? '#FBBF24'}
        boxEmoji={boxReveal?.box.emoji ?? '🎁'}
        onClose={() => setBoxReveal(null)}
      />
      <PetCustomizeModal
        visible={customizeOpen}
        mode={onboarded ? 'edit' : 'onboarding'}
        onClose={() => setCustomizeOpen(false)}
      />
      <PupilNavbar current="pet" />
    </SafeAreaView>
  );
}

// Popup wyboru profilu misji (2026-08-20) — wyniesiony z inline `missionChooseCard` do
// osobnego Modala (user: "miał być malutki przycisk obok wyślij na misje otwierany popup z
// wyborem"), otwierany z kafla misji w gridzie Siła bojowa. Te same 3 wiersze
// (`MISSION_PROFILE_ORDER`) co dawniej, tylko w bottom-sheet zamiast inline karty.
function MissionSendModal({ visible, onClose, level, onSend }: {
  visible: boolean; onClose: () => void; level: number; onSend: (profile: MissionProfile) => void;
}) {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  if (!visible) return null;
  return (
    <Modal visible transparent animationType="fade" onRequestClose={onClose}>
      <View style={s.missionModalOverlay}>
        <View style={s.missionModalSheet}>
          <View style={s.missionModalHead}>
            <Text style={s.missionModalTitle}>Wyślij pupila na misję</Text>
            <TouchableOpacity onPress={onClose} hitSlop={10}><X size={20} color={c.text.primary} /></TouchableOpacity>
          </View>
          {MISSION_PROFILE_ORDER.map(profile => {
            const reward = missionRewardFor(level, profile);
            return (
              <View key={profile} style={s.missionModalRow}>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.missionTitle}>{MISSION_PROFILE_LABEL[profile]}</Text>
                  <Text style={s.missionSub} numberOfLines={1}>
                    ~{fmtMissionDuration(missionMinutesFor(level))} · +{reward.coins} 🪙 +{reward.xp} XP
                  </Text>
                </View>
                <PressableScale onPress={() => onSend(profile)}>
                  <View style={s.missionModalBtn}><Text style={s.missionModalBtnTxt}>Wyślij</Text></View>
                </PressableScale>
              </View>
            );
          })}
        </View>
      </View>
    </Modal>
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
  // Kotek W MISJI (2026-08-20) — JEDEN kotek jeżdżący po pasku (nie osobny duży portret NA
  // scenie + mały na pasku naraz, patrz `missionEnter` przy hookach wyżej w pliku).
  stageMissionWrap: { alignItems: 'center', gap: spacing[2], width: '84%' },
  stageMissionCancel: { fontSize: 11, fontWeight: '700', color: c.text.muted, textDecorationLine: 'underline', marginTop: 2 },
  room: { position: 'absolute', width: 290, height: 240, borderRadius: 28, top: 20, alignSelf: 'center', overflow: 'hidden', borderWidth: 1, borderColor: 'rgba(255,255,255,0.12)' },
  roomDecor: { position: 'absolute', fontSize: 22, opacity: 0.85 },
  // Nazwa/status skurczone (2026-08-16, user: "nazwę zbić, nad pupilem zajmuje w pizdu
  // miejsca") — mniejsza czcionka + ciaśniejsze marginesy nad kotem, żeby resztę (głaskanie,
  // questy) było widać bez przewijania od razu po wejściu.
  // Nagłówek dwukolumnowy (2026-08-16 v2, user: "nazwa po lewej, samopoczucie pod nim,
  // po prawej pasek lvl i pasek pogłaskania") — zastępuje osobne karty level/affection
  // z poprzedniej wersji, które schodziły niżej na ekranie.
  topHeader: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', width: '100%', marginTop: spacing[1] },
  topLeft: { alignItems: 'flex-start', gap: 4, flexShrink: 1 },
  topRight: { alignItems: 'flex-end', gap: 6, minWidth: 132 },
  // Pasek Lv POWIĘKSZONY (2026-08-20) — szerszy i grubszy niż `miniBarRow` (affection zostaje
  // małe), plus osobna linijka z liczbami XP pod spodem (user: "powiększamy trochę żeby było
  // widać ile na ile XP jeszcze" — jedyny wskaźnik poziomu odkąd karta "Doświadczenie"
  // zniknęła z grida Siła bojowa, patrz kafel misji tam).
  lvlBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 132 },
  lvlBarLabel: { fontSize: 11.5, fontWeight: '800', color: c.text.muted, width: 34 },
  lvlBarTrack: { flex: 1, height: 8, borderRadius: 4, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  lvlBarFill: { height: '100%', borderRadius: 4 },
  lvlXpTxt: { fontSize: 9.5, fontWeight: '700', color: c.text.muted, marginTop: -4 },
  miniBarRow: { flexDirection: 'row', alignItems: 'center', gap: 6, width: 108 },
  miniBarLabel: { fontSize: 10.5, fontWeight: '800', color: c.text.muted, width: 30 },
  miniBarTrack: { flex: 1, height: 6, borderRadius: 3, backgroundColor: c.bg.elevated, overflow: 'hidden' },
  miniBarFill: { height: '100%', borderRadius: 3 },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 2 },
  name: { fontSize: 16, fontWeight: '800', color: c.text.primary, letterSpacing: -0.3 },
  moodChip: { marginTop: 3, paddingHorizontal: 10, paddingVertical: 3, borderRadius: radius.full, borderWidth: 1 },
  status: { fontSize: 12, fontWeight: '800' },
  tip: { fontSize: 11.5, color: c.text.muted, marginTop: 3, textAlign: 'center' },

  affHeart: { fontSize: 14 },
  crateBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, width: '100%', marginTop: spacing[2], paddingVertical: 11, borderRadius: radius.lg, backgroundColor: '#FBBF2418', borderWidth: 1, borderColor: '#FBBF2455' },
  crateBtnTxt: { fontSize: 13, fontWeight: '800', color: '#FBBF24' },
  dailyBoxIconBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', borderRadius: radius.lg, backgroundColor: '#FBBF24', marginLeft: 6 },
  dailyBoxDot: { position: 'absolute', top: 4, right: 4, width: 8, height: 8, borderRadius: 4, backgroundColor: '#E4342E' },

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

  missionTitle: { fontSize: 13.5, fontWeight: '800', color: c.text.primary },
  missionSub: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },
  // Nazwa miejsca (lewo) / odliczanie (prawo) NAD paskiem (2026-08-20, user: "nad paskiem
  // nazwa a naprzeciwko timer ile zostało").
  missionHeadRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', width: '100%' },
  missionDestTxt: { fontSize: 12.5, fontWeight: '800', color: c.text.primary, flexShrink: 1, marginRight: spacing[2] },
  missionTimerTxt: { fontSize: 12, fontWeight: '700', color: c.text.muted },
  // Pasek GRUBSZY i SZERSZY niż dawny cienki 4px (2026-08-20, user: "ten pasek troszeczkę
  // tłuszczy i o wiele szerszy") — pełna szerokość dostępnej kolumny (`catCol` w GearPanel),
  // pigułka (borderRadius = połowa wysokości). `missionBarFillWrap` ma `overflow:'hidden'`
  // żeby fala (`missionBarWave`) i gradient nie wystawały poza aktualną szerokość wypełnienia
  // — `missionBarTrack` sam NIE przycina, bo kotek musi wystawać NAD/PONAD cienką krawędzią.
  missionBarTrack: { position: 'relative', width: '100%', height: 30, borderRadius: 15, backgroundColor: c.bg.elevated, borderWidth: 1, borderColor: c.border.default },
  missionBarFillWrap: { position: 'absolute', left: 0, top: 0, bottom: 0, borderRadius: 15, overflow: 'hidden' },
  missionBarWave: { position: 'absolute', top: -10, bottom: -10, width: 34, backgroundColor: 'rgba(255,255,255,0.32)' },
  missionBarCatWrap: { position: 'absolute', top: 3, marginLeft: -11 },

  // Popup wyboru profilu misji (2026-08-20) — zastępuje dawną inline `missionChooseCard`
  // (user: "kafelek misji jest jakby podwojony... miał być malutki przycisk... otwierany
  // popup z wyborem"). Ten sam bottom-sheet wzorzec co `GearSlotModal` w GearPanel.tsx.
  missionModalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.65)', alignItems: 'center', justifyContent: 'flex-end' },
  missionModalSheet: { width: '100%', maxWidth: 480, backgroundColor: c.bg.primary, borderTopLeftRadius: radius.xl, borderTopRightRadius: radius.xl, padding: spacing[4], gap: spacing[2] },
  missionModalHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: spacing[1] },
  missionModalTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary },
  missionModalRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2], paddingVertical: spacing[3], borderTopWidth: 1, borderTopColor: c.border.subtle },
  missionModalBtn: { backgroundColor: '#38BDF8', borderRadius: radius.full, paddingHorizontal: 16, paddingVertical: 10 },
  missionModalBtnTxt: { fontSize: 12.5, fontWeight: '800', color: '#0B0E1A' },

  // Siła bojowa + Ekwipunek bojowy (scalone z pet-stats.tsx, 2026-08-19).
  blurb: { fontSize: 11.5, color: c.text.secondary, lineHeight: 16, width: '100%' },
  statGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2], width: '100%' },
  statCard: { width: '48%', borderRadius: radius.lg, borderWidth: 1, padding: spacing[3], gap: 2 },
  statVal: { fontSize: 20, fontWeight: '800', color: c.text.primary, marginTop: 4 },
  statLabel: { fontSize: 11, color: c.text.secondary, fontWeight: '600' },
  statSub: { fontSize: 9.5, color: c.text.muted },
  cellName: { fontSize: 12, fontWeight: '700', color: c.text.primary },
  cellState: { fontSize: 10, color: c.text.muted },
  itemRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], padding: spacing[3], borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  itemRowLocked: { opacity: 0.55 },
  itemIcon: { width: 46, height: 46, borderRadius: 12, borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center', backgroundColor: c.fill.subtle },
  itemIconLocked: { backgroundColor: 'transparent' },
  itemLevel: { fontSize: 9.5, color: '#FBBF24', fontWeight: '700', marginTop: 2 },
  equipPill: { flexDirection: 'row', alignItems: 'center', gap: 3, borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 5, borderWidth: 1, borderColor: c.border.default },
  equipPillOn: { backgroundColor: '#2AC68F', borderColor: '#2AC68F' },
  equipPillTxt: { fontSize: 10.5, fontWeight: '700', color: c.text.secondary },
  equipPillTxtOn: { color: c.bg.primary },
  buyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#FBBF2418', borderRadius: radius.full, paddingHorizontal: 8, paddingVertical: 4, borderWidth: 1, borderColor: '#FBBF2440' },
  buyPillTxt: { fontSize: 10.5, fontWeight: '800', color: '#FBBF24' },
}));
