import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing, Modal, Pressable, Image } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Lock, Swords, Zap, Shield, HeartPulse, Coins, PawPrint, HandFist, HandGrab, Sparkles, Sword, Trophy, Compass } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import CatArt from '@/components/pet/CatArt';
import { paletteById } from '@/utils/catPalettes';
import BossArt from '@/components/bosses/BossArt';
import Confetti from '@/components/achievements/Confetti';
import { usePetStore, levelFromXp, catMaxHp, todayISO, BossFightDetail } from '@/store/petStore';
import { BOSSES, Boss, AttackKind, bossBonuses, simulateFight, MAX_FIGHT_ROUNDS, EquippedItem, BossLoot } from '@/utils/bosses';
import { raidForWeek, raidHpFor, raidCoins, raidXp, raidAsBoss, raidSessionHpFor } from '@/utils/raid';
import { currentEventBoss, eventPeriodKey, eventHpFor, eventCoins, eventXp, eventAsBoss, eventDaysLeft } from '@/utils/seasonalEvents';
import { minibossForQuest, minibossAsBoss, questFightCoins, questFightXp } from '@/utils/minibosses';
import { madCandidate, madBossFor, MAD_UNLOCK_LEVEL } from '@/utils/madBosses';
import { minibossForMission, missionRewardFor } from '@/utils/missions';
import { COMBAT_ITEMS } from '@/utils/combatItems';
import { lootIcon } from '@/utils/bossUiIcons';
import { monthlyWorkHours, monthlySweetsSpend, thisMonthVsAvg } from '@/utils/menaceStats';
import { weekKeyOf, TRAINING_QUEST_IDS } from '@/utils/quests';
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

type Kind = 'campaign' | 'raid' | 'event' | 'quest' | 'mad' | 'mission';
type VictoryInfo = { kind: Kind; id: string; name: string; emoji: string; coins: number; xp: number; loot?: BossLoot };

// Ekran WALKI (S&F-style, 2026-08-09/10 — patrz memory boss_design.md), wydzielony z listy
// (app/bosses.tsx). Sześć TRYBÓW przez ?kind= (campaign domyślnie/raid/event/quest/mad/
// mission). Wszystkie dzielą TĘ SAMĄ arenę/kafelki/pociski/trafienia i TĘ SAMĄ pełną
// round-based symulację (simulateFight, realny kontratak, HP kotka faktycznie spada) przez
// jedną wspólną `attackRoundBased()` — jedyna różnica to SKĄD biorą Boss-kształtny cel i co
// się dzieje po walce (energia zużyta, nagroda, czy jest stan porażki).
// — KAMPANIA i WYDARZENIE (2026-08-12): HP bossa resetuje się do pełna co próbę. Kampania ma
//   3 próby/dzień (dailyAttempts), wydarzenie WŁASNĄ, słabiej skalującą pulę
//   (`eventDailyAttempts` w bosses.ts) — HP/DMG wydarzenia PRZEBALANSOWANE pod ten model,
//   patrz eventHpFor w seasonalEvents.ts.
// — RAID (2026-08-17, user: "miała być zwykła walka tylko taka która nie restartuje jego HP
//   jak z tym drugim [event]... ale tamta jest jakaś za łatwa" — poprzednio RAID był jedynym
//   trybem BEZ pełnej animacji, jedna prosta wymiana na próbę, `attackSimple()`, USUNIĘTA):
//   HP bossa zostaje TRWAŁE przez cały tydzień (NIE resetuje się co próbę — to CELOWO
//   zachowane, żeby dało się odrabiać po trochu, w przeciwieństwie do eventu). Ale każda próba
//   to teraz PEŁNA rundowa walka jak kampania — wobec MAŁEJ "sesji" (`raidSessionHpFor` w
//   raid.ts, ten sam bezpieczny wzorzec co questBossHpFor/madBossHpFor: `atkPower × mała
//   stała`), NIE wobec surowej `raidHpFor` (za duża, `counterDamage()` liczony od aktualnego
//   hp bossa zabiłby kotka jednym kontratakiem). Realny postęp sesji (`raidAsBoss` hp przed
//   minus po) dopisuje się do PRAWDZIWEJ, trwałej puli osobnym wywołaniem `raidAttack()` —
//   `targetRemaining`/pasek HP w arenie ZAWSZE pokazuje PRAWDZIWĄ skalę tygodniową, `liveBossHp`
//   podczas animacji jest przeliczany z sesyjnej skali na prawdziwą (patrz w attackRoundBased).
//   Wciąż BEZ stanu porażki — user o to nie prosił, raid dalej nie da się "przegrać"
//   (finish() dla raid ignoruje result.won/catFainted, liczy się tylko realny postęp puli).
export default function BossFight() {
  const { kind: kindParam, questId, questCoins, questXp, questLabel } = useLocalSearchParams<{
    kind?: string; questId?: string; questCoins?: string; questXp?: string; questLabel?: string;
  }>();
  const kind: Kind = kindParam === 'raid' ? 'raid' : kindParam === 'event' ? 'event' : kindParam === 'quest' ? 'quest' : kindParam === 'mad' ? 'mad' : kindParam === 'mission' ? 'mission' : 'campaign';

  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const {
    xp, energy, raidEnergy, eventEnergy, ownedItems, defeatedBosses, defeatBoss,
    defeatedMadBosses, defeatMadBoss, logFightAttempt,
    catHp, catMaxHpBonus, atkStatBonus, damageCat, resetCatHp, spendEnergy,
    ownedCombatItems, equippedCombatItems,
    raidWeek, raidHp, raidWon, raidEnsure, raidAttack, raidClaim,
    eventWon, spendEventEnergy, eventClaim,
    dayClaims, claimQuestFight, markTrainingDay,
    missionStartedAt, missionEndsAt, missionProfile, claimMission,
    catColor, catStripes, catEyeColor, catNoseColor, catWhiskers, catLegStripes,
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
  // Kotek na ekranie walki musi wyglądać tak samo jak u Pupila (2026-08-15, user: "kolor
  // pupila musi się zgadzać z kolorem w walce") — CatArt tu w ogóle nie dostawał
  // palette/stripes/eyeColor/noseColor/whiskers/legStripes, więc zawsze renderował domyślny
  // wygląd niezależnie od customizacji. Ten sam wzorzec co pet.tsx (paletteById(catColor)).
  const palette = useMemo(() => paletteById(catColor), [catColor]);

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
  const eventDone = eventKey ? eventWon.includes(eventKey) : false;
  // Odliczanie (2026-08-16, user: "żeby realnie móc go wygrać") — 1 próba/dzień, więc "ile
  // dni zostało" mówi wprost ile jeszcze podejść zanim boss zniknie.
  const eventDaysLeftN = eventBoss ? eventDaysLeft(eventBoss, now) : 0;

  // ── quest-jako-walka (2026-08-14 v2) — zamiast zwykłego "Odbierz" na wykonanym queście,
  // pełna walka z minibossem przypisanym do TEGO questu na TEN dzień (patrz minibosses.ts).
  // Bez energii/limitu prób — quest już wykonany realnie, retry po przegranej jest darmowy.
  const today = todayISO();
  const questMb = kind === 'quest' && questId ? minibossForQuest(today, questId) : null;
  const questBoss = questMb ? minibossAsBoss(questMb, atkStatBonus, level, bonuses) : null;
  const questAlreadyClaimed = kind === 'quest' && questId ? !!dayClaims[`${questId}:${today}`] : false;

  // ── MAD (2026-08-15) — druga, silniejsza fala tych samych 22 bossów kampanii dla lvl 50+,
  // TYLKO po pokonaniu normalnej wersji (madBosses.ts). Jeden wspólny cel po kolejności
  // `order`, dokładnie jak campaignBoss wyżej — bez osobnego id w URL.
  const madBase = kind === 'mad' ? madCandidate(defeatedBosses, defeatedMadBosses) : null;
  const madBoss = madBase ? madBossFor(madBase, atkStatBonus, level, bonuses) : null;

  // ── Misja (utils/missions.ts, 2026-08-15) — jeden globalny slot w store (petStore.
  // missionStartedAt/missionEndsAt), bez id w URL: gotowość i tożsamość miniboss'a (seedowany
  // dokładnym czasem wysłania) czytane wprost ze store'u, nie z parametrów — nawigacja tu z
  // niegotową misją (np. cofnięcie ekranu) nie da się "oszukać" wcześniejszą walką.
  const missionReady = kind === 'mission' && !!missionStartedAt && !!missionEndsAt && Date.now() >= new Date(missionEndsAt).getTime();
  // Pupil fizycznie gdzieś poszedł (2026-08-18, user: "wtedy nie może walczyć w innych z
  // bossem zanim nie wróci a zamiast niego jest napis w trakcie misji") — dopóki misja trwa,
  // BLOKUJE wszystkie POZOSTAŁE tory walki (kampania/raid/event/quest/mad), nie tylko samą
  // misję. `kind==='mission'` to jedyny wyjątek — to WŁAŚNIE ekran na powrót z misji.
  const missionAway = !!missionEndsAt && Date.now() < new Date(missionEndsAt).getTime();
  const missionMb = missionReady && missionStartedAt ? minibossForMission(missionStartedAt) : null;
  const missionBoss = missionMb ? minibossAsBoss(missionMb, atkStatBonus, level, bonuses) : null;
  const missionReward = missionRewardFor(level, missionProfile ?? 'balanced');

  // ── jeden ujednolicony cel, niezależnie od trybu — cała reszta ekranu czyta TYLKO to ──
  type Target = { id: string; name: string; taunt: string; weakness: string; weaknessLabel: string; emoji: string; maxHp: number; energy: number; unlocked: boolean; unlockLevel: number; done: boolean; attackKind?: AttackKind };
  let target: Target | null = null;
  if (kind === 'campaign' && campaignBoss) {
    // Odblokowanie kampanii = samo pokonanie poprzedniego bossa, NIE poziom (2026-08-17,
    // patrz identyczny komentarz przy `current`/`unlocked` w app/bosses.tsx) — campaignBoss
    // tutaj jest już z definicji "pierwszy niepokonany", więc zawsze dostępny do walki.
    target = { id: campaignBoss.id, name: campaignBoss.name, taunt: campaignBoss.taunt, weakness: campaignBoss.weakness, weaknessLabel: campaignBoss.weaknessLabel, emoji: campaignBoss.emoji, maxHp: campaignBoss.hp, energy, unlocked: true, unlockLevel: campaignBoss.unlockLevel, done: false, attackKind: campaignBoss.attackKind };
  } else if (kind === 'raid') {
    target = { id: raid.id, name: raid.name, taunt: raid.taunt, weakness: raid.weakness, weaknessLabel: raid.weaknessLabel, emoji: raid.emoji, maxHp: raidMaxHp, energy: raidEnergy, unlocked: level >= 3, unlockLevel: 3, done: raidDone, attackKind: raid.attackKind };
  } else if (kind === 'event' && eventBoss && eventKey) {
    target = { id: eventBoss.id, name: eventBoss.name, taunt: eventBoss.taunt, weakness: eventBoss.weakness, weaknessLabel: eventBoss.weaknessLabel, emoji: eventBoss.emoji, maxHp: eventMaxHp, energy: eventEnergy, unlocked: level >= 2, unlockLevel: 2, done: eventDone, attackKind: eventBoss.attackKind };
  } else if (kind === 'quest' && questBoss) {
    target = { id: questBoss.id, name: questBoss.name, taunt: questBoss.taunt, weakness: questBoss.weakness, weaknessLabel: '', emoji: questBoss.emoji, maxHp: questBoss.hp, energy: 1, unlocked: true, unlockLevel: 0, done: questAlreadyClaimed, attackKind: questBoss.attackKind };
  } else if (kind === 'mad' && madBoss && madBase) {
    target = { id: madBoss.id, name: madBoss.name, taunt: madBoss.taunt, weakness: madBoss.weakness, weaknessLabel: madBoss.weaknessLabel, emoji: madBoss.emoji, maxHp: madBoss.hp, energy, unlocked: level >= MAD_UNLOCK_LEVEL, unlockLevel: MAD_UNLOCK_LEVEL, done: false, attackKind: madBoss.attackKind };
  } else if (kind === 'mission' && missionBoss) {
    target = { id: missionBoss.id, name: missionBoss.name, taunt: missionBoss.taunt, weakness: missionBoss.weakness, weaknessLabel: '', emoji: missionBoss.emoji, maxHp: missionBoss.hp, energy: 1, unlocked: true, unlockLevel: 0, done: false, attackKind: missionBoss.attackKind };
  }
  // Kampania/wydarzenie/quest/MAD/misja resetują HP do pełna co próbę (liveBossHp podczas
  // walki, inaczej pełne maxHp). Raid ma trwały bank (raidRemaining) — ale (2026-08-17)
  // PODCZAS animowanej sesji `liveBossHp` też go nadpisuje (przeliczony na prawdziwą skalę
  // w attackRoundBased, patrz komentarz tam), żeby pasek realnie ruszał się w trakcie walki,
  // nie tylko skokiem po jej końcu.
  const targetRemaining = target ? (kind === 'raid' ? (raidDone ? 0 : (liveBossHp ?? raidRemaining)) : (liveBossHp ?? target.maxHp)) : 0;
  const headerTitle = kind === 'raid' ? 'Raid' : kind === 'event' ? 'Wydarzenie' : kind === 'quest' ? (questLabel ?? 'Walka questowa') : kind === 'mad' ? 'MAD Boss' : kind === 'mission' ? 'Misja' : 'Walka';
  // Do modala przegranej — kampania/wydarzenie/quest/MAD/misja mogą przegrać (raid nie ma kontrataku).
  // Wspólny kształt {id,emoji,name} wystarczy modalowi, nie potrzeba pełnego Boss.
  const defeatTarget = kind === 'campaign' ? campaignBoss : kind === 'event' ? eventBoss : kind === 'quest' ? questBoss : kind === 'mad' ? madBoss : kind === 'mission' ? missionBoss : null;

  useEffect(() => { resetCatHp(); }, [kind]);

  // Walka rund odgrywa się przez łańcuch setTimeout (patrz playerBeat/counterBeat niżej).
  // Jeśli user wyjdzie z ekranu W TRAKCIE animacji, te timeouty same się nie anulują —
  // bez tej straży walka dokończyłaby się PO CICHU w tle. `roundTimer` + `alive` dają czysty
  // stop: cofnięcie w trakcie walki po prostu PRZERYWA ją.
  const alive = useRef(true);
  const roundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => () => {
    alive.current = false;
    if (roundTimer.current) clearTimeout(roundTimer.current);
  }, []);
  // Straż przed podwójnym wejściem (2026-08-17, user: "zdarza się że walka [dziwnie się
  // zachowuje]... kotek nie schodzi do zera HP... czasami walka przerywa zanim jedna ze
  // stron zejdzie do zera") — `attackRoundBased()` gate'ował się dotąd TYLKO stanem
  // `fighting`, czytanym z domknięcia POPRZEDNIEGO renderu. Przycisk WALCZ! wizualnie gasł
  // (`opacity` przy `fighting`), ale `PressableScale` nie dostawał `disabled` — szybkie
  // podwójne stuknięcie (zanim React zdąży przerenderować z `fighting=true`) realnie
  // odpalało DWA niezależne łańcuchy setTimeout naraz, każdy ze swoim `result`/`i`, oba
  // manipulujące tym samym, współdzielonym `catHp`/`liveBossHp` — stąd pozorne "pomijanie"
  // rund, HP kotka nie lądujące dokładnie na 0, i jedna z walk "kończąca się" (drugi,
  // niewidoczny łańcuch dogrywał się w tle). `fightingRef` to synchroniczna, odporna na
  // timing renderu straż — ustawiana/sprawdzana w TEJ SAMEJ, jednej funkcji, więc żadne
  // dwa wywołania nie mogą przejść guardu naraz niezależnie od tego kiedy React
  // przerenderuje `fighting`. `disabled` na przycisku (niżej) to druga warstwa (UX — sam
  // Pressable przestaje w ogóle odpalać onPress), ale to `fightingRef` faktycznie
  // uniemożliwia race.
  const fightingRef = useRef(false);

  // ── boss-side hit fx (Twój cios na bossie) — wspólne dla WSZYSTKICH trybów ──
  const bShake = useRef(new Animated.Value(0)).current;
  const bDmgY = useRef(new Animated.Value(0)).current;
  const bFlash = useRef(new Animated.Value(0)).current;
  const [lastHit, setLastHit] = useState<{ dmg: number; crit: boolean; guarded: boolean; healed: number; thornDmg: number } | null>(null);
  const playBossHitFx = (crit: boolean) => {
    bShake.setValue(0); bDmgY.setValue(0); bFlash.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(bShake, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(bShake, { toValue: -1, duration: 50, useNativeDriver: true }),
        Animated.timing(bShake, { toValue: crit ? 1 : 0.5, duration: 50, useNativeDriver: true }),
        Animated.timing(bShake, { toValue: 0, duration: 50, useNativeDriver: true }),
      ]),
      Animated.sequence([
        Animated.timing(bFlash, { toValue: 1, duration: 60, useNativeDriver: true }),
        Animated.timing(bFlash, { toValue: 0, duration: 260, useNativeDriver: true }),
      ]),
      // Skrócone z 800→600ms (2026-08-14, patrz komentarz przy shake wyżej) — przy 480ms
      // odstępie do następnej rundy liczba dawniej jeszcze dogasała, gdy leciał już kolejny
      // cios; teraz gaśnie z zapasem PRZED kolejnym uderzeniem, mniej nachodzących na siebie
      // animacji na raz.
      Animated.timing(bDmgY, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),
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
      Animated.timing(kDmgY, { toValue: 1, duration: 600, easing: Easing.out(Easing.quad), useNativeDriver: true }),   // skrócone, patrz komentarz przy bDmgY
    ]).start();
  };

  // Pociski lecące między kafelkami. 0→1 = leci; JSX niżej interpoluje na `left` (% szerokości
  // wiersza kafelków) wzdłuż całego wiersza (płaski tor). Rzut trwa PRZED wylądowaniem ciosu —
  // HP/shake/flash/liczba obrażeń odpalają się dopiero gdy pocisk faktycznie dotrze na miejsce.
  // WAŻNE: obie animacje niżej MUSZĄ mieć `useNativeDriver: false` — sterują stylem `left`
  // (właściwość layoutu), a native driver obsługuje TYLKO `opacity`/`transform`. Z `true` cios
  // wizualnie "utyka" w pozycji startowej (opacity/scale nadal się animują natywnie, ale `left`
  // się nie rusza) — user zgłosił dokładnie to (2026-08-12): cios bossa "pojawia się na nim i
  // znika w miejscu zamiast lecieć". NIE włączać `true` z powrotem "dla wydajności".
  const pawTravel = useRef(new Animated.Value(0)).current;
  const boltTravel = useRef(new Animated.Value(0)).current;
  const [pawFlying, setPawFlying] = useState(false);
  const [boltFlying, setBoltFlying] = useState(false);
  const THROW_MS = 320;

  // Kampania i wydarzenie: cała walka (kilka rund) liczy się od razu w jednym wywołaniu
  // simulateFight, ale ODGRYWA SIĘ dwoma fazami na rundę: Twój cios ląduje na bossie → pauza →
  // kontratak bossa ląduje na kotku → pauza → kolejna runda. Współdzielone między oboma trybami
  // (2026-08-12, patrz komentarz na górze pliku) — jedyna różnica to SKĄD biorą Boss-kształtny
  // cel (roundBoss) i co się dzieje po wygranej.
  const attackRoundBased = () => {
    if (!target || !target.unlocked || fighting || fightingRef.current) return;
    if (kind !== 'mission' && missionAway) { haptic.error(); toast.info('Pupil jest w trakcie misji — wróć jak dotrze.'); return; }
    // Raid (2026-08-17): sesja rundowa wobec MAŁEGO, bezpiecznie skalowanego celu
    // (raidSessionHpFor — ten sam wzorzec co questBossHpFor/madBossHpFor), NIE wobec surowej
    // trwałej puli tygodniowej — patrz pełny komentarz na górze pliku i w raid.ts.
    const raidSessionHp = kind === 'raid' ? raidSessionHpFor(atkStatBonus, level, bonuses) : 0;
    const raidRealStart = kind === 'raid' ? raidRemaining : 0;
    const roundBoss: Boss | null =
      kind === 'campaign' ? campaignBoss :
      kind === 'raid' ? raidAsBoss(raid, raidSessionHp) :
      kind === 'event' && eventBoss ? eventAsBoss(eventBoss, level) :
      kind === 'quest' ? questBoss :
      kind === 'mad' ? madBoss :
      kind === 'mission' ? missionBoss :
      null;
    if (!roundBoss) return;
    // Quest/misja: bez puli prób — quest już wykonany realnie / misja już odczekana realnie,
    // przegrana = darmowy retry. MAD dzieli pulę energii z kampanią (to jej rozszerzenie, nie
    // osobny tor jak raid/event).
    if (kind !== 'quest' && kind !== 'mission') {
      const pool = kind === 'campaign' || kind === 'mad' ? energy : kind === 'raid' ? raidEnergy : eventEnergy;
      if (pool <= 0) { haptic.error(); toast.info('Brak prób ataku na dziś — wróć jutro po nowe.'); return; }
    }
    resetCatHp();
    const result = simulateFight(atkStatBonus, level, bonuses, roundBoss, catMax, MAX_FIGHT_ROUNDS, equippedItems);
    // Przebieg TEJ próby do bossLog (2026-08-17, user: "nie zapisujesz... dokładnie walk z
    // ilością HP w czasie i dmg zadanego" — patrz BossFightDetail w petStore.ts). Budowane RAZ
    // tutaj (z surowego result.rounds, PRZED odtworzeniem animacji), używane niżej w finish()
    // niezależnie od wyniku — wygrana, przegrana, i (raid) sesja bez domknięcia tygodniowej puli
    // wszystkie dostają wpis, żeby eksport pokazywał KOMPLETNY obraz prób, nie tylko sukcesy.
    const fightDetail: BossFightDetail = {
      won: result.won,
      catFainted: result.catFainted,
      bossMaxHp: roundBoss.hp,
      catMaxHpAtFight: catMax,
      rounds: result.rounds.map(r => ({ p: r.playerDmg, c: r.counterDmg, bhp: r.bossHpAfter, chp: r.catHpAfter })),
    };
    // Raid: JEDNO wywołanie raidAttack (nie per rundę) — dopisuje realny postęp tej sesji
    // (sesyjne hp przed minus po) do prawdziwej, trwałej puli tygodniowej i zużywa DOKŁADNIE
    // 1 raidEnergy (1 próba = 1 atak, tak jak reszta trybów), niezależnie od liczby rund w
    // środku sesji.
    let raidOutcome: { remaining: number; defeated: boolean } | null = null;
    if (kind === 'campaign' || kind === 'mad') spendEnergy();
    else if (kind === 'event') spendEventEnergy();
    else if (kind === 'raid') raidOutcome = raidAttack(raidSessionHp - result.bossHpLeft);
    fightingRef.current = true;
    setFighting(true);
    setLiveBossHp(kind === 'raid' ? raidRealStart : roundBoss.hp);
    setCatHit(null);
    let i = 0;

    const finish = () => {
      fightingRef.current = false;
      if (!alive.current) return;
      setFighting(false);
      setLiveBossHp(null);
      // Raid dalej BEZ stanu porażki (user o to nie prosił) — liczy się TYLKO czy prawdziwy,
      // trwały bank spadł do zera (raidOutcome.defeated), NIE wynik tej jednej małej sesji
      // (result.won dotyczy sesyjnej puli, nie prawdziwego tygodniowego bossa).
      if (kind === 'raid') {
        if (raidOutcome?.defeated) {
          haptic.success();
          raidClaim(weekKey, raidCoins(level), raidXp(level), raid.name, level, fightDetail);
          setVictory({ kind: 'raid', id: raid.id, name: raid.name, emoji: raid.emoji, coins: raidCoins(level), xp: raidXp(level) });
        } else {
          // Sesja nie domknęła tygodniowej puli — bez nagrody, ale próba i tak realnie się
          // odbyła (patrz komentarz przy fightDetail), więc dostaje wpis do historii.
          logFightAttempt('raid', raid.id, raid.name, level, fightDetail);
        }
        return;
      }
      if (result.won) {
        haptic.success();
        if (kind === 'campaign' && campaignBoss) {
          defeatBoss(campaignBoss.id, campaignBoss.loot.id, campaignBoss.coins, campaignBoss.xp, campaignBoss.name, level, fightDetail);
          setVictory({ kind: 'campaign', id: campaignBoss.id, name: campaignBoss.name, emoji: campaignBoss.emoji, coins: campaignBoss.coins, xp: campaignBoss.xp, loot: campaignBoss.loot });
        } else if (kind === 'event' && eventBoss && eventKey) {
          eventClaim(eventKey, eventCoins(level), eventXp(level), eventBoss.name, level, fightDetail);
          setVictory({ kind: 'event', id: eventBoss.id, name: eventBoss.name, emoji: eventBoss.emoji, coins: eventCoins(level), xp: eventXp(level) });
        } else if (kind === 'quest' && questBoss && questId) {
          const coinsWon = questFightCoins(Number(questCoins) || 0);
          const xpWon = questFightXp(Number(questXp) || 0);
          if (claimQuestFight(questId, coinsWon, xpWon, questBoss.name, level, fightDetail)) {
            if (TRAINING_QUEST_IDS.includes(questId)) markTrainingDay();
          }
          setVictory({ kind: 'quest', id: questBoss.id, name: questBoss.name, emoji: questBoss.emoji, coins: coinsWon, xp: xpWon });
        } else if (kind === 'mad' && madBoss && madBase) {
          defeatMadBoss(madBase.id, madBoss.coins, madBoss.xp, madBoss.name, level, fightDetail);
          setVictory({ kind: 'mad', id: madBoss.id, name: madBoss.name, emoji: madBoss.emoji, coins: madBoss.coins, xp: madBoss.xp });
        } else if (kind === 'mission' && missionBoss) {
          claimMission(missionReward.coins, missionReward.xp, missionBoss.name, level, fightDetail);
          setVictory({ kind: 'mission', id: missionBoss.id, name: missionBoss.name, emoji: missionBoss.emoji, coins: missionReward.coins, xp: missionReward.xp });
        }
      } else {
        haptic.error();
        setDefeat({ fainted: result.catFainted });
        // id/name TU muszą się zgadzać z tym co wpisują odpowiednie akcje-nagrody wyżej przy
        // wygranej (NIE zawsze target.id/target.name — event loguje pod eventKey, mission pod
        // stałym 'mission', mad pod id BAZOWEGO bossa, nie wariantu), inaczej ta sama walka
        // wyglądałaby w bossLog jak dwa różne przeciwniki zależnie od wyniku.
        if (kind === 'campaign' && campaignBoss) logFightAttempt('campaign', campaignBoss.id, campaignBoss.name, level, fightDetail);
        else if (kind === 'event' && eventBoss && eventKey) logFightAttempt('event', eventKey, eventBoss.name, level, fightDetail);
        else if (kind === 'quest' && questBoss && questId) logFightAttempt('quest', questId, questBoss.name, level, fightDetail);
        else if (kind === 'mad' && madBoss && madBase) logFightAttempt('mad', madBase.id, madBoss.name, level, fightDetail);
        else if (kind === 'mission' && missionBoss) logFightAttempt('mission', 'mission', missionBoss.name, level, fightDetail);
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
        Animated.timing(boltTravel, { toValue: 1, duration: THROW_MS, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
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
      Animated.timing(pawTravel, { toValue: 1, duration: THROW_MS, easing: Easing.out(Easing.quad), useNativeDriver: false }).start();
      roundTimer.current = setTimeout(() => {
        if (!alive.current) return;
        setPawFlying(false);
        haptic.medium();
        setLastHit({ dmg: round.playerDmg, crit: round.playerCrit, guarded: result.guarded, healed: round.healed, thornDmg: round.thornDmg });
        playBossHitFx(round.playerCrit);
        setAttackPulse(n => n + 1);
        // Raid: przelicz sesyjny postęp (mała, bezpiecznie skalowana pula) na PRAWDZIWĄ skalę
        // tygodniową — arena zawsze pokazuje prawdziwy pasek, nie sesyjny (patrz targetRemaining).
        setLiveBossHp(kind === 'raid' ? Math.max(0, raidRealStart - (raidSessionHp - round.bossHpAfter)) : round.bossHpAfter);
        roundTimer.current = setTimeout(counterBeat, 480);
      }, THROW_MS);
    };

    playerBeat();
  };

  // Raid dołączył do attackRoundBased 2026-08-17 (patrz komentarz na górze pliku) — jedna
  // wspólna funkcja obsługuje teraz wszystkie 6 trybów.
  const attack = attackRoundBased;

  const bShakeX = bShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const bFlashOp = bFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.8] });
  const bFloatY = bDmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const bFloatOp = bDmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const kShakeX = kShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const kFlashOp = kFlash.interpolate({ inputRange: [0, 1], outputRange: [0, 0.7] });
  const kFloatY = kDmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const kFloatOp = kDmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const pawX = pawTravel.interpolate({ inputRange: [0, 1], outputRange: ['16%', '84%'] });
  const pawOp = pawTravel.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] });
  const pawScale = pawTravel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.15, 0.8] });
  const boltX = boltTravel.interpolate({ inputRange: [0, 1], outputRange: ['84%', '16%'] });
  const boltOp = boltTravel.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] });
  const boltScale = boltTravel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.15, 0.8] });
  // Unikatowy kontratak per typ bossa (2026-08-17) — patrz komentarz przy render'ze pocisku
  // niżej. Brak attackKind (większość rosteru) = ta sama czerwona pięść co dotąd.
  const COUNTER_ICON: Record<AttackKind, typeof HandFist> = { claw: HandGrab, magic: Sparkles, sword: Sword };
  const COUNTER_COLOR: Record<AttackKind, string> = { claw: '#F87171', magic: '#A78BFA', sword: '#94A3B8' };
  const CounterIcon = target?.attackKind ? COUNTER_ICON[target.attackKind] : HandFist;
  const counterColor = target?.attackKind ? COUNTER_COLOR[target.attackKind] : '#F87171';

  const closeVictory = () => { setVictory(null); router.back(); };
  const closeDefeat = () => { setDefeat(null); router.back(); };
  const VictoryLootIcon = victory?.loot ? lootIcon(victory.loot) : Trophy;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle} numberOfLines={1}>{headerTitle}</Text>
        {/* Quest/misja-walki nie mają puli prób (patrz komentarz przy questAlreadyClaimed) —
            pigułka energii nie miałaby tu sensu, więc zajmuje miejsce pusty spacer
            (żeby tytuł został wyśrodkowany tak jak w pozostałych trybach). */}
        {kind === 'quest' || kind === 'mission'
          ? <View style={{ width: 40 }} />
          : <View style={s.energyPill}><Zap size={13} color="#38BDF8" /><Text style={s.energyTxt}>{target?.energy ?? 0}</Text></View>}
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {!target ? (
          <View style={s.done}>
            <Swords size={30} color={c.text.muted} />
            <Text style={s.doneTxt}>
              {kind === 'campaign' ? 'Wszyscy bossowie pokonani! Kolejni wkrótce.'
                : kind === 'mad' ? 'Brak dostępnego MAD celu — pokonaj (kolejnego) bossa kampanii, żeby odblokować jego MAD wersję.'
                : kind === 'mission' ? (missionStartedAt ? 'Misja jeszcze trwa — wróć jak pupil wróci.' : 'Brak aktywnej misji — wyślij pupila z ekranu Pupil.')
                : 'Brak aktywnego wydarzenia teraz — wróć innym razem.'}
            </Text>
          </View>
        ) : kind !== 'mission' && missionAway ? (
          <View style={s.lockBox}>
            <Compass size={16} color={c.text.muted} />
            <Text style={s.lockTxt}>Pupil jest w trakcie misji — wróć jak dotrze, wtedy znowu będzie mógł walczyć.</Text>
          </View>
        ) : !target.unlocked ? (
          <View style={s.lockBox}>
            <Lock size={16} color={c.text.muted} />
            <Text style={s.lockTxt}>Odblokujesz na poziomie {target.unlockLevel} (masz {level}). Rozwijaj pupila questami.</Text>
          </View>
        ) : (
          <View style={s.arena}>
            {/* dwa symetryczne kafelki — Pupil / Boss. Pupil ma pasek HP w kampanii I wydarzeniu
                (obie mają realny kontratak) — TYLKO raid go nie ma, pasek zawsze pełny byłby mylący. */}
            <View style={{ width: '100%', position: 'relative' }}>
            <View style={s.vsRow}>
              <View style={s.tile}>
                <Text style={s.tileLabel} numberOfLines={1}>Pupil</Text>
                {/* Wszystkie 3 tryby mają teraz realny kontratak (2026-08-12) — pasek HP kotka
                    pokazuje się zawsze, nie tylko w kampanii/wydarzeniu. */}
                <View style={s.tileHpTrack}><View style={[s.tileHpFill, { width: `${Math.round(catHp / catMax * 100)}%`, backgroundColor: '#2AC68F' }]} /></View>
                <Text style={s.tileHpTxt}>{catHp} / {catMax}</Text>
                <View style={s.tilePortrait}>
                  <Animated.View style={{ transform: [{ translateX: kShakeX }] }}>
                    <CatArt size={104} expression="content" attack={attackPulse} palette={palette} stripes={catStripes}
                      eyeColor={catEyeColor} noseColor={catNoseColor} whiskers={catWhiskers} legStripes={catLegStripes} />
                  </Animated.View>
                  <Animated.View pointerEvents="none" style={[s.tileFlash, { opacity: kFlashOp, backgroundColor: '#F87171' }]} />
                  {/* Pazury (2026-08-17, user: "jak są pazury to nie mają lecieć tylko
                      pojawiać się na pupila") — atak w zwarciu, nie rzut: zamiast
                      podróżującego pocisku (boltFlying niżej, suppressed dla claw), burst
                      ikony wprost NA portrecie kotka, wyzwalany tym samym `boltTravel` co
                      lot pocisku dla pozostałych typów. */}
                  {boltFlying && target?.attackKind === 'claw' && (
                    <Animated.View pointerEvents="none" style={[s.clawFx, { opacity: boltOp, transform: [{ scale: boltScale }, { rotate: '12deg' }] }]}>
                      <HandGrab size={90} color={counterColor} />
                    </Animated.View>
                  )}
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
                  {/* Tylko shake na samym sprite'cie bossa (2026-08-14, user: "u nas trochę
                      chaos" — porównanie do S&F: łapka leci, uderza, wróg się trzęsie, dmg
                      się pokazuje, nic więcej). Per-bossowy burst-image (bomby/ogień/…) USUNIĘTY
                      permanentnie (2026-08-18, user: "te bomby... pojawiały się tylko na sobie
                      samym, robiły scaling up i znikały, zadając dmg na odległość dziwnie xd,
                      wywalmy je wgle" — statyczny obrazek scale+fade czytał się jako płaski
                      "scan i zniknięcie", nie realny cios; działające wzorce to WYŁĄCZNIE
                      podróżujący pocisk (łapka/magia) i burst-na-celu (pazury), oba już tu są).
                      Zostaje tylko flash+shake+liczba obrażeń — ten sam, spójny język co
                      raid/event/quest/mad/misja miały od zawsze (one nigdy nie dostały
                      attackFx). */}
                  <Animated.View style={{ transform: [{ translateX: bShakeX }] }}>
                    <BossArt id={target.id} emoji={target.emoji} size={104} powered={kind === 'raid' || kind === 'mad'} />
                  </Animated.View>
                  <Animated.View pointerEvents="none" style={[s.tileFlash, { opacity: bFlashOp, backgroundColor: lastHit?.crit ? '#FDE047' : '#F87171' }]} />
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
                {/* Był stroke-only bursztynowy #FBBF24 — nierozpoznawalne jako "łapka" w ruchu,
                    user: "nie używa swojej łapki tylko czegoś żółtego nie wiem co to" (2026-08-12).
                    Solidne wypełnienie (fill), żeby czytało się jednoznacznie jako łapka nawet przy
                    28px i szybkim locie. Kolor = `palette.coat` (2026-08-16, user: "kotek w walkach
                    niech rzuca swoją łapką zależną od koloru") — ta sama paleta co portret kota na
                    tym samym ekranie (patrz `palette` wyżej), więc łapka wygląda jak NAPRAWDĘ jego. */}
                <PawPrint size={30} color={palette.coat} fill={palette.coat} />
              </Animated.View>
            )}
            {/* Kontratak bossa — user (2026-08-12): poprzednio leciał tu ten sam per-bossowy
                burst (fire/bomb/magicspell/…) co przy Twoim trafieniu, i wyglądało to jak
                rakieta/bomba lecąca w kotka, nie jak cios — dlatego uniwersalna pięść (per-bossowy
                burst przy Twoim ciosie USUNIĘTY permanentnie 2026-08-18, patrz komentarz przy
                `tileFlash` bossa wyżej). 2026-08-17 (user: "bossy miały unikatowe ataki —
                drapieżniki drapnięcie pazurami, magowie kulę magiczną, miecze slash mieczem, ci
                którzy nie mają to pięść") — dalej PROSTY kształt (jedna ikona lecąca po prostej),
                tylko dobrana po `target.attackKind` zamiast zawsze tej samej pięści; brak
                attackKind = ta sama pięść co dawniej, więc zachowanie dla większości bossów bez
                zmian. Pazury WYJĄTKOWO nie lecą tędy wcale (2026-08-17) — patrz `s.clawFx` burst
                na portrecie kotka wyżej, ten sam trigger (`boltFlying`/`boltOp`/`boltScale`),
                inne miejsce renderu. */}
            {boltFlying && target?.attackKind !== 'claw' && (
              <Animated.View pointerEvents="none" style={[s.projectile, { left: boltX, opacity: boltOp, transform: [{ scale: boltScale }, { translateX: -14 }] }]}>
                <CounterIcon size={28} color={counterColor} fill={counterColor} />
              </Animated.View>
            )}
            </View>

            <Text style={s.bossTaunt}>„{target.taunt}"</Text>
            {/* Tylko HP + motyw (słabość) — BEZ nagrody i mechanik (osłona/regen) przed walką,
                user (2026-08-10): "zbyt dużo opisu bossa". Reaktywne linijki niżej (co się
                WŁAŚNIE stało w walce) zostają — to nie spoiler, to informacja zwrotna. */}
            {/* Quest/misja-minibossy nie mają "motywu"/słabości (placeholder w minibosses.ts) —
                pokazywanie pustej etykiety byłoby myląco puste, więc linijka schowana. */}
            {kind !== 'quest' && kind !== 'mission' && (
              <Text style={s.motywTxt}>Motyw: <Text style={{ color: WEAK_COLOR[target.weakness] ?? c.text.primary, fontWeight: '800' }}>{target.weaknessLabel}</Text></Text>
            )}
            {/* Odliczanie (2026-08-16) — event ma FLAT 1 próbę/dzień, więc "ile dni zostało"
                mówi wprost ile jeszcze podejść zanim boss zniknie na dobre. */}
            {kind === 'event' && !eventDone && (
              <Text style={[s.motywTxt, { color: eventDaysLeftN <= 1 ? '#F87171' : eventDaysLeftN <= 3 ? '#FBBF24' : c.text.muted, fontWeight: '800' }]}>
                {eventDaysLeftN <= 0 ? 'Kończy się dziś' : `Kończy się za ${eventDaysLeftN} ${eventDaysLeftN === 1 ? 'dzień' : 'dni'}`}
              </Text>
            )}
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
              <Text style={s.doneInlineTxt}>Pokonany ✓ · {kind === 'raid' ? 'nowy w poniedziałek' : kind === 'quest' ? 'nagroda odebrana dziś' : 'wróć w kolejnym okresie'}</Text>
            ) : (
              <PressableScale onPress={attack} disabled={target.energy <= 0 || fighting} style={{ width: '100%' }}>
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
              <Text style={s.vKicker}>{victory.kind === 'raid' ? 'RAID POKONANY!' : victory.kind === 'event' ? 'WYDARZENIE POKONANE!' : victory.kind === 'quest' ? 'QUEST WYGRANY!' : victory.kind === 'mad' ? 'MAD BOSS POKONANY!' : victory.kind === 'mission' ? 'MISJA UKOŃCZONA!' : 'WYGRANA!'}</Text>
              <View style={{ opacity: 0.6 }}>
                <BossArt id={victory.id} emoji={victory.emoji} size={78} powered={victory.kind === 'raid' || victory.kind === 'mad'} />
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
                  <Text style={s.vLootName}>{victory.kind === 'raid' ? 'Medal tygodnia' : victory.kind === 'quest' ? 'Nagroda questu' : victory.kind === 'mad' ? 'Nagroda MAD' : victory.kind === 'mission' ? 'Nagroda z misji' : 'Medal wydarzenia'}</Text>
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
          {defeatTarget && defeat && (
            <View style={s.vCenter} pointerEvents="none">
              <Text style={[s.vKicker, { color: defeat.fainted ? '#F87171' : '#F4B740' }]}>{defeat.fainted ? 'PRZEGRANA' : 'BOSS PRZETRWAŁ'}</Text>
              <View style={{ opacity: 0.5 }}>
                <BossArt id={defeatTarget.id} emoji={defeatTarget.emoji} size={78} powered={kind === 'raid' || kind === 'mad'} />
              </View>
              <Text style={s.vName}>{defeatTarget.name} przetrwał</Text>
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

  clawFx: { position: 'absolute', width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  projectile: { position: 'absolute', top: 96, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
}));
