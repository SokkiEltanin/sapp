import { useEffect, useMemo, useRef, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, Animated, Easing, Modal, Pressable } from 'react-native';
import { Image } from 'expo-image';
import { LinearGradient } from 'expo-linear-gradient';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Lock, Swords, Zap, Shield, HeartPulse, Coins, PawPrint, Trophy, Compass } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ConfirmDialog from '@/components/ui/ConfirmDialog';
import CatArtStatic from '@/components/pet/CatArtStatic';
import RadialGlow from '@/components/ui/RadialGlow';
import GroundShadow from '@/components/ui/GroundShadow';
import { paletteById } from '@/utils/catPalettes';
import BossArt from '@/components/bosses/BossArt';
import { attackPng, fightArenaBg } from '@/utils/bossIcons';
import Confetti from '@/components/achievements/Confetti';
import { useShallow } from 'zustand/react/shallow';
import { usePetStore, levelFromXp, effectiveCatMaxHp, todayISO, BossFightDetail } from '@/store/petStore';
import { potionAtkBonus } from '@/utils/potions';
import { BOSSES, Boss, AttackKind, bossBonuses, simulateFight, MAX_FIGHT_ROUNDS, EquippedItem, BossLoot } from '@/utils/bosses';
import { raidForWeek, raidHpFor, raidCoins, raidXp, raidAsBoss, raidCounterHpFor, RAID_ENERGY_COST } from '@/utils/raid';
import { currentEventBoss, eventPeriodKey, eventHpFor, eventCoins, eventXp, eventAsBoss, eventDaysLeft, menaceHpFor, menaceSessionHpFor, menaceAsBoss, menaceCoins, menaceXp } from '@/utils/seasonalEvents';
import { minibossForQuest, minibossAsBoss, questFightCoins, questFightXp } from '@/utils/minibosses';
import { madCandidate, madBossFor, MAD_UNLOCK_LEVEL } from '@/utils/madBosses';
import { minibossForMission, missionRewardFor, fmtMissionDuration } from '@/utils/missions';
import { COMBAT_ITEMS, CombatItemId } from '@/utils/combatItems';
import { gearCombatBonuses, gearCoinsMult, gearAtkFlat } from '@/utils/gear';
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

// Portrety Pupil/Boss w arenie — powiększone (2026-08-30, user: "boss i pupil był większy
// bo są tacy malutcy tutaj"), było 104. Jedna stała (nie osobne magiczne liczby w JSX i w
// stylach niżej) — `tilePortrait.height`/`s.projectile`'s `top` w `makeS()` poniżej ZALEŻĄ
// od tej wartości (patrz komentarze tam), żeby zmiana rozmiaru w jednym miejscu nie
// rozjeżdżała reszty geometrii areny.
// 130→150 (2026-09-18) — wartość z Edytora układu walki (`app/battle-layout-lab.tsx`), user
// wytunował i wkleił eksport w rozmowie, patrz `CAT_PORTRAIT_SIZE`/offsety niżej.
const PORTRAIT_SIZE = 150;
// Kotek dostaje WIĘKSZY `size` niż boss przy tym samym `PORTRAIT_SIZE` (2026-09-03, user:
// "kotka powiększyć bo jest teraz mniejszy od wroga znacznie") — CatArt to SVG z viewBox
// 2000×2000, ale sam kotek zajmuje w nim wyraźnie mniej niż całą ramkę (sporo pustego
// marginesu wokół), podczas gdy PNG bossów (BossArt) są przycięte ciasno do sylwetki — więc
// przy IDENTYCZNYM `size` boss zawsze wygląda znacznie większy. Podbite o ~35%, nie 1:1 z
// PORTRAIT_SIZE, bo oba portrety dzielą tę samą wysokość kafelka (`tilePortrait`, patrz
// niżej) — zbyt duży skok zacząłby wychodzić poza scenę areny (ma `overflow:'hidden'`).
// 175→205 (2026-09-18) — jw., z Edytora układu walki.
const CAT_PORTRAIT_SIZE = 205;

// Wysokość wspólnej kolumny portretu — obie kolumny (Pupil/Boss) dzielą tę samą wysokość
// `tilePortrait`, żeby etykieta+HP pod spodem wyrównywały się w tym samym rzędzie mimo różnych
// rozmiarów portretów. WYDZIELONE do stałej (2026-09-18) — `projectile.top` niżej zależy od
// niej przez osobny wzór (środek portretu), trzymanie dwóch miejsc do ręcznej synchronizacji
// przy każdej zmianie PORTRAIT_SIZE/CAT_PORTRAIT_SIZE było kruche.
const TILE_PORTRAIT_HEIGHT = Math.max(PORTRAIT_SIZE, CAT_PORTRAIT_SIZE) + 18;

// Niezależne przesunięcia pupila/bossa/ich pasków HP (2026-09-18) — z Edytora układu walki
// (`app/battle-layout-lab.tsx`, patrz komentarz tam i w `battleLayoutDraftStore.ts`), user
// wytunował i wkleił eksport w rozmowie: { catSize:205, bossSize:150, catOffsetY:45,
// bossOffsetY:45, catHpOffsetY:10, bossHpOffsetY:10, wszystkie X:0, bg:gorskislas — już
// domyślne, bez zmian }. Zastępuje dawne `SPRITE_GROUND_SHIFT` (JEDNO, wspólne przesunięcie
// obu sprite'ów, 2026-09-11/12) — teraz każdy z 4 elementów ma WŁASNY, niezależny offset,
// dokładnie to czego brakowało wg komentarza w `battleLayoutDraftStore.ts`.
const CAT_OFFSET_X = 0, CAT_OFFSET_Y = 45;
const BOSS_OFFSET_X = 0, BOSS_OFFSET_Y = 45;
const CAT_HP_OFFSET_X = 0, CAT_HP_OFFSET_Y = 10;
const BOSS_HP_OFFSET_X = 0, BOSS_HP_OFFSET_Y = 10;

// Skala cienia pod łapkami — DOTĄD wspólny ułamek portretu (0.62/0.18) dla obu sprite'ów,
// user: "cienie nie pasują skali" (2026-09-20, patrz ARCHITECTURE.md §145/§147). Boss zostaje
// przy 0.62/0.18 (BossArt to PNG przycięty ciasno do sylwetki, ułamek pudełka ≈ ułamek
// faktycznej sylwetki). Kotek dostaje WYLICZONY, nie zmierzony wizualnie, ułamek: skoro
// CAT_PORTRAIT_SIZE (205) jest ~35% większe od PORTRAIT_SIZE (150) TYLKO po to, żeby
// skompensować pusty margines SVG i wyjść na TĘ SAMĄ apparentną wielkość co boss (patrz
// komentarz przy CAT_PORTRAIT_SIZE wyżej), to realna sylwetka kotka w jego (większym) pudełku
// zajmuje z grubsza taki sam ułamek co boss w SWOIM (mniejszym) pudełku — przeskalowany o
// odwrotność tego samego współczynnika: 0.62 × (150/205) ≈ 0.45, 0.18 × (150/205) ≈ 0.13.
// TO SZACUNEK, nie pomiar z Edytora (`battle-layout-lab.tsx`, który wciąż jest źródłem
// prawdy, gdyby user chciał dostroić wizualnie) — priorytet testu na urządzeniu: wysoki.
const CAT_SHADOW_SCALE_X = 0.45, CAT_SHADOW_SCALE_Y = 0.13;
const BOSS_SHADOW_SCALE_X = 0.62, BOSS_SHADOW_SCALE_Y = 0.18;
// Uśrednione przesunięcie Y obu sprite'ów, TYLKO dla `projectile.top` niżej (pocisk leci
// MIĘDZY nimi, potrzebuje jednego punktu odniesienia) — zastępuje dawne wspólne
// `SPRITE_GROUND_SHIFT`. Oba offsety akurat wyszły równe w tym eksporcie (45/45), średnia
// zostaje poprawna też gdyby user kiedyś wyeksportował różne wartości dla obu.
const SPRITE_OFFSET_Y_AVG = (CAT_OFFSET_Y + BOSS_OFFSET_Y) / 2;

type Kind = 'campaign' | 'raid' | 'event' | 'quest' | 'mad' | 'mission';
type VictoryInfo = { kind: Kind; id: string; name: string; emoji: string; coins: number; xp: number; loot?: BossLoot; itemDropped?: CombatItemId; itemLeveledUp?: { id: CombatItemId; level: number }; isMenace?: boolean };

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
// — RAID (2026-08-17 → 2026-08-25, patrz pełna historia w raid.ts nad raidAsBoss): HP bossa
//   zostaje TRWAŁE przez cały tydzień (NIE resetuje się co próbę — CELOWO, żeby dało się
//   odrabiać po trochu). Każda próba to PRAWDZIWA, ciągła walka WOBEC REALNEJ, pozostałej puli
//   (`raidRemaining` jako `boss.hp` — nie żadna sesja-proxy), idąca aż ktoś padnie, dokładnie
//   jak kampania. `counterDamage()` (liczy % wprost od `boss.hp`, patrz COUNTER_PCT w
//   bosses.ts) dostaje ODDZIELNE źródło skali (`Boss.counterHp`, bezpiecznie mała wartość z
//   `raidCounterHpFor`) — inaczej realna, tysiące-hp pula zabiłaby kotka jednym kontratakiem.
//   `liveBossHp` podczas animacji to WPROST `round.bossHpAfter` (już na realnej skali, żadnego
//   przeliczania sesja→realna jak dawniej). Realny postęp (`raidRemaining` przed minus po)
//   dopisuje się do trwałej puli przez `raidAttack()` — ZAWSZE, niezależnie od wyniku (user:
//   "kotek walczy do końca... nawet jak przegra to HP bossa zostaje tyle ile po ostatnim
//   ciosie"). Raid MA TERAZ stan porażki (przegrana się pokazuje, feedback że kotek padł), ale
//   w odróżnieniu od kampanii przegrana NIE zeruje postępu — tylko kampania resetuje HP bossa
//   do pełna na przegranej, raid zostawia trwały ślad. 2 energii (eventEnergy) za próbę,
//   nie 1 — dłuższa, prawdziwa walka niż dawna krótka sesja.
export default function BossFight() {
  const { kind: kindParam, questId, questCoins, questXp, questLabel } = useLocalSearchParams<{
    kind?: string; questId?: string; questCoins?: string; questXp?: string; questLabel?: string;
  }>();
  const kind: Kind = kindParam === 'raid' ? 'raid' : kindParam === 'event' ? 'event' : kindParam === 'quest' ? 'quest' : kindParam === 'mad' ? 'mad' : kindParam === 'mission' ? 'mission' : 'campaign';

  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const insets = useSafeAreaInsets();
  // usePetStore selecting NAZWANE pola przez useShallow (2026-09-09, "dawaj dalej
  // optymalizacje") — petStore.ts to WSPÓLNY store dla całego systemu pupila (questy,
  // ekwipunek, customizacja, streaki...), a walka to NAJCZĘŚCIEJ mutujący go ekran (HP/coiny/
  // XP co rundę) — subskrypcja bez selektora (jak było) re-renderowała CAŁY ten ciężki,
  // animowany komponent na KAŻDĄ zmianę w petStore, nawet zupełnie niezwiązaną z walką (np.
  // tick questa gdzieś indziej w tle). Shallow-compare na wybranym podzbiorze pól ogranicza
  // re-render do faktycznie użytych tu wartości.
  const {
    xp, energy, eventEnergy, ownedItems, defeatedBosses, defeatBoss,
    defeatedMadBosses, defeatMadBoss, logFightAttempt,
    catHp, catMaxHpBonus, atkStatBonus, damageCat, resetCatHp, spendEnergy,
    ownedCombatItems, equippedCombatItems, equippedGear, ownedGear, activePotion,
    raidWeek, raidHp, raidMaxHp: raidMaxHpBanked, raidWon, raidEnsure, raidAttack, raidClaim,
    eventWon, spendEventEnergy, eventClaim,
    menaceId, menaceHp, menaceEnsure, menaceAttack, menaceClaim,
    dayClaims, claimQuestFight, markTrainingDay,
    missionStartedAt, missionEndsAt, missionProfile, claimMission, cancelMission,
    catColor, catStripes, catEyeColor, catNoseColor, catWhiskers, catLegStripes,
  } = usePetStore(useShallow((s) => ({
    xp: s.xp, energy: s.energy, eventEnergy: s.eventEnergy, ownedItems: s.ownedItems,
    defeatedBosses: s.defeatedBosses, defeatBoss: s.defeatBoss, defeatedMadBosses: s.defeatedMadBosses,
    defeatMadBoss: s.defeatMadBoss, logFightAttempt: s.logFightAttempt, catHp: s.catHp,
    catMaxHpBonus: s.catMaxHpBonus, atkStatBonus: s.atkStatBonus, damageCat: s.damageCat, resetCatHp: s.resetCatHp,
    spendEnergy: s.spendEnergy, ownedCombatItems: s.ownedCombatItems, equippedCombatItems: s.equippedCombatItems,
    equippedGear: s.equippedGear, ownedGear: s.ownedGear, activePotion: s.activePotion, raidWeek: s.raidWeek,
    raidHp: s.raidHp, raidMaxHp: s.raidMaxHp, raidWon: s.raidWon, raidEnsure: s.raidEnsure, raidAttack: s.raidAttack,
    raidClaim: s.raidClaim, eventWon: s.eventWon, spendEventEnergy: s.spendEventEnergy, eventClaim: s.eventClaim,
    menaceId: s.menaceId, menaceHp: s.menaceHp, menaceEnsure: s.menaceEnsure, menaceAttack: s.menaceAttack,
    menaceClaim: s.menaceClaim, dayClaims: s.dayClaims, claimQuestFight: s.claimQuestFight,
    markTrainingDay: s.markTrainingDay, missionStartedAt: s.missionStartedAt, missionEndsAt: s.missionEndsAt,
    missionProfile: s.missionProfile, claimMission: s.claimMission, cancelMission: s.cancelMission,
    catColor: s.catColor, catStripes: s.catStripes, catEyeColor: s.catEyeColor, catNoseColor: s.catNoseColor,
    catWhiskers: s.catWhiskers, catLegStripes: s.catLegStripes,
  })));
  // Selektor pojedynczego pola (2026-09-20, audyt logika/optymalizacja) — goły
  // `useExpensesStore()` na EKRANIE WALKI (hot path, częste re-rendery podczas animacji rund)
  // subskrybował cały store wydatków, choć tu używane jest tylko `expenses`.
  const expenses = useExpensesStore((st) => st.expenses);
  const { events, gcalEvents } = useCalendarStore();
  const { settings: workSettings } = useWorkStore();

  const [victory, setVictory] = useState<VictoryInfo | null>(null);
  // `fainted` odróżnia PRAWDZIWĄ porażkę (HP kotka spadło do 0) od skrajnie rzadkiego
  // wyczerpania bezpieczeństwa-sufitu rund bez zabicia bossa (patrz MAX_FIGHT_ROUNDS w
  // bosses.ts — walka teraz leci do faktycznego 0 HP jednej ze stron, nie sztywnych 3
  // rund). `result.won`/`result.catFainted` z simulateFight NIE są dopełnieniem siebie.
  const [defeat, setDefeat] = useState<{ fainted: boolean } | null>(null);
  // Potwierdzenie "Wróć natychmiast" z popupu misji-w-drodze niżej (2026-08-20) — ten sam
  // `ConfirmDialog` wzorzec co w `app/pet.tsx`, żeby anulowanie misji wyglądało identycznie
  // niezależnie skąd user je odpala.
  const [missionCancelConfirm, setMissionCancelConfirm] = useState(false);
  const [fighting, setFighting] = useState(false);
  const [liveBossHp, setLiveBossHp] = useState<number | null>(null);
  // Krok 8 (NEXT_STEPS.md "SYSTEM EKWIPUNKU") — gear dokłada się DO bonusów z lootu
  // kampanii, ten sam { atk, dodge, crit, energyMult } kształt (patrz gearCombatBonuses
  // w gear.ts, przebalansowane żeby jeden mityczny item nie przebijał całej kampanii).
  const bonuses = useMemo(() => {
    const loot = bossBonuses(ownedItems);
    const gear = gearCombatBonuses(equippedGear, ownedGear);
    // Potka Furii (2026-09-08, patrz potions.ts) stackuje się DOKŁADNIE jak loot/gear —
    // czysty addytywny dodatek do tego samego `bonuses.atk`, nie osobny mnożnik.
    return { atk: loot.atk + gear.atk + potionAtkBonus(activePotion), dodge: loot.dodge + gear.dodge, crit: loot.crit + gear.crit, energyMult: loot.energyMult + gear.energyMult };
  }, [ownedItems, equippedGear, ownedGear, activePotion]);
  // Obroża (atkFlat, 2026-09-22 — patrz obszerny komentarz nad GEAR_ITEMS w gear.ts) dokłada
  // się DO `atkStatBonus`, nie do `bonuses.atk` — siedzi PRZED mnożnikiem poziomu/lootu, jak
  // kupiony za monety stat, więc jej % wpływ na moc NIE gaśnie z poziomem jak reszta gearu.
  // WSZĘDZIE gdzie liczy się realna moc ataku (questBoss/missionBoss/raid/menace/walka
  // właściwa niżej) musi wołać `effectiveAtkStat`, nie goły `atkStatBonus` ze store'u.
  const effectiveAtkStat = useMemo(() => atkStatBonus + gearAtkFlat(equippedGear, ownedGear), [atkStatBonus, equippedGear, ownedGear]);
  const level = useMemo(() => levelFromXp(xp).level, [xp]);
  const equippedItems: EquippedItem[] = useMemo(
    () => equippedCombatItems.map(id => ({ id, level: ownedCombatItems[id] ?? 1 })),
    [equippedCombatItems, ownedCombatItems],
  );
  const catMax = effectiveCatMaxHp(catMaxHpBonus, equippedGear, ownedGear, activePotion);
  // Kolczyki (coinsPct) — JEDYNY stat gear który nie pasuje do Bonuses{atk,dodge,crit,
  // energyMult}, więc osobny mnożnik wołany tu, w jedynym miejscu gdzie liczy się finalna
  // wypłata za zwycięstwo (wspólne dla wszystkich 6 trybów walki, patrz finish() niżej).
  const coinsMult = useMemo(() => gearCoinsMult(equippedGear, ownedGear), [equippedGear, ownedGear]);
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
  // `liveRaidMaxHp` TYLKO do zasiania `raidEnsure` na start tygodnia (musi być aktualne, żeby
  // pierwsze zbankowanie tygodnia złapało prawdziwy poziom gracza) — do WYŚWIETLANIA i jako
  // `maxHp` celu walki niżej używamy zamrożonego `raidMaxHpBanked` (patrz komentarz przy
  // `raidMaxHp` w petStore.ts), żeby level-up W TRAKCIE tygodnia raidu nie cofał paska/%.
  const liveRaidMaxHp = raidHpFor(level, weekKey);
  const raidMaxHp = raidWeek === weekKey ? raidMaxHpBanked : liveRaidMaxHp;
  const raidRemaining = raidWeek === weekKey ? raidHp : raidMaxHp;
  const raidDone = raidWon.includes(weekKey);
  useEffect(() => { if (kind === 'raid') raidEnsure(weekKey, liveRaidMaxHp); }, [kind, weekKey, liveRaidMaxHp]);

  // ── wydarzenie: może nie istnieć teraz (brak sezonu/nemesis) ──
  const now = new Date();
  const workByMonth = monthlyWorkHours([...events, ...gcalEvents], workSettings, now);
  const sweetsByMonth = monthlySweetsSpend(expenses, now);
  const workVsAvg = thisMonthVsAvg(workByMonth, now);
  const sweetsVsAvg = thisMonthVsAvg(sweetsByMonth, now);
  const menaceCtx = { workHoursThisMonth: workVsAvg.thisMonth, workHoursAvg: workVsAvg.avg, sweetsThisMonth: sweetsVsAvg.thisMonth, sweetsAvg: sweetsVsAvg.avg };
  const eventBoss = currentEventBoss(now, menaceCtx);
  const eventKey = eventBoss ? eventPeriodKey(eventBoss, now) : null;
  const isMenace = eventBoss?.kind === 'menace';
  const eventMaxHp = eventHpFor(level);
  const eventDone = eventKey ? eventWon.includes(eventKey) : false;
  // Odliczanie (2026-08-16, user: "żeby realnie móc go wygrać") — TYLKO sezonowe mają jeszcze
  // timer/FLAT próbę dzienną. Nemesis (2026-08-18, user: "niech nie ma timera... nielimitowany
  // czas i próby podejścia") nie ma już końca ani limitu prób — patrz menaceMaxHp/menaceEnsure
  // niżej, ten sam trwały-bank wzorzec co raid.
  const eventDaysLeftN = eventBoss && !isMenace ? eventDaysLeft(eventBoss, now) : 0;

  // ── nemesis: TRWAŁY bank HP, lustrzane raidMaxHp/raidRemaining wyżej ──
  const menaceMaxHp = isMenace ? menaceHpFor(level) : 0;
  const menaceRemaining = isMenace ? (menaceId === eventBoss!.id ? menaceHp : menaceMaxHp) : 0;
  useEffect(() => {
    if (kind === 'event' && isMenace && eventBoss) menaceEnsure(eventBoss.id, menaceMaxHp);
  }, [kind, isMenace, eventBoss?.id, menaceMaxHp]);

  // ── quest-jako-walka (2026-08-14 v2) — zamiast zwykłego "Odbierz" na wykonanym queście,
  // pełna walka z minibossem przypisanym do TEGO questu na TEN dzień (patrz minibosses.ts).
  // Bez energii/limitu prób — quest już wykonany realnie, retry po przegranej jest darmowy.
  const today = todayISO();
  const questMb = kind === 'quest' && questId ? minibossForQuest(today, questId) : null;
  const questBoss = questMb ? minibossAsBoss(questMb, effectiveAtkStat, level, bonuses) : null;
  const questAlreadyClaimed = kind === 'quest' && questId ? !!dayClaims[`${questId}:${today}`] : false;

  // ── MAD (2026-08-15) — druga, silniejsza fala tych samych 22 bossów kampanii dla lvl 50+,
  // TYLKO po pokonaniu normalnej wersji (madBosses.ts). Jeden wspólny cel po kolejności
  // `order`, dokładnie jak campaignBoss wyżej — bez osobnego id w URL.
  const madBase = kind === 'mad' ? madCandidate(defeatedBosses, defeatedMadBosses) : null;
  const madBoss = madBase ? madBossFor(madBase) : null;

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
  // `missionMb` czytany ZAWSZE gdy misja aktywna (gotowa LUB w drodze) — potrzebny w obu
  // stanach: jako przeciwnik do walki (gotowa) i jako nazwa miejsca w popupie "w trakcie
  // podróży" (w drodze, 2026-08-20). `missionBoss` (realny cel do ataku) zostaje gated TYLKO
  // na `missionReady`, żeby nie dało się zaatakować przed czasem.
  const missionMb = missionStartedAt ? minibossForMission(missionStartedAt) : null;
  const missionBoss = missionReady && missionMb ? minibossAsBoss(missionMb, effectiveAtkStat, level, bonuses) : null;
  const missionReward = missionRewardFor(level, missionProfile ?? 'balanced');
  const missionRemainingMs = missionEndsAt ? new Date(missionEndsAt).getTime() - Date.now() : 0;
  const missionTotalMs = missionStartedAt && missionEndsAt
    ? new Date(missionEndsAt).getTime() - new Date(missionStartedAt).getTime() : 0;
  const missionProgress = missionTotalMs > 0
    ? Math.min(1, Math.max(0, 1 - missionRemainingMs / missionTotalMs)) : 0;

  // ── jeden ujednolicony cel, niezależnie od trybu — cała reszta ekranu czyta TYLKO to ──
  // `energyCost` (2026-08-28, user ze screenshotem: "mimo że mam energię nie mogę
  // zawalczyć" — miał 1⚡ na pigułce, ale Raid kosztuje RAID_ENERGY_COST=2, więc
  // `attack()` poprawnie blokował próbę (patrz `pool < cost` niżej), ale przycisk
  // WALCZ! wyglądał w pełni aktywny (tylko `energy <= 0` go wygaszało) i pigułka
  // energii pokazywała samo "1" bez żadnej wzmianki że potrzeba 2 — user nie miał
  // jak się domyślić DLACZEGO nic się nie dzieje po kliknięciu poza łatwym-do-
  // przegapienia toastem. Teraz część `Target`, jedno źródło prawdy dla pigułki,
  // przycisku I `attack()` (usuwa duplikat `kind === 'raid' ? RAID_ENERGY_COST : 1`
  // który tam był osobno).
  type Target = { id: string; name: string; taunt: string; weakness: string; weaknessLabel: string; emoji: string; maxHp: number; energy: number; energyCost: number; unlocked: boolean; unlockLevel: number; done: boolean; attackKind?: AttackKind };
  let target: Target | null = null;
  if (kind === 'campaign' && campaignBoss) {
    // Odblokowanie kampanii = samo pokonanie poprzedniego bossa, NIE poziom (2026-08-17,
    // patrz identyczny komentarz przy `current`/`unlocked` w app/bosses.tsx) — campaignBoss
    // tutaj jest już z definicji "pierwszy niepokonany", więc zawsze dostępny do walki.
    target = { id: campaignBoss.id, name: campaignBoss.name, taunt: campaignBoss.taunt, weakness: campaignBoss.weakness, weaknessLabel: campaignBoss.weaknessLabel, emoji: campaignBoss.emoji, maxHp: campaignBoss.hp, energy, energyCost: 1, unlocked: true, unlockLevel: campaignBoss.unlockLevel, done: false, attackKind: campaignBoss.attackKind };
  } else if (kind === 'raid') {
    target = { id: raid.id, name: raid.name, taunt: raid.taunt, weakness: raid.weakness, weaknessLabel: raid.weaknessLabel, emoji: raid.emoji, maxHp: raidMaxHp, energy: eventEnergy, energyCost: RAID_ENERGY_COST, unlocked: level >= 3, unlockLevel: 3, done: raidDone, attackKind: raid.attackKind };
  } else if (kind === 'event' && eventBoss && eventKey) {
    // Nemesis (2026-08-18): maxHp = TRWAŁA pula (menaceMaxHp, jak raid). Energia (2026-09-24,
    // user: "czemu tam niby jest infinity, przecież ma zużywać energię jak walczę" — dawna
    // stała atrapa "1" ZDJĘTA, nemesis dzieli TERAZ prawdziwą `eventEnergy` z raid/wydarzeniem,
    // patrz `pool` w attackRoundBased) — bez deadline'u (`eventDaysLeftN`=0 dla menace, to
    // ZOSTAJE), ale KAŻDA próba realnie kosztuje energię jak reszta trybów.
    target = { id: eventBoss.id, name: eventBoss.name, taunt: eventBoss.taunt, weakness: eventBoss.weakness, weaknessLabel: eventBoss.weaknessLabel, emoji: eventBoss.emoji, maxHp: isMenace ? menaceMaxHp : eventMaxHp, energy: eventEnergy, energyCost: 1, unlocked: level >= 2, unlockLevel: 2, done: eventDone, attackKind: eventBoss.attackKind };
  } else if (kind === 'quest' && questBoss) {
    target = { id: questBoss.id, name: questBoss.name, taunt: questBoss.taunt, weakness: questBoss.weakness, weaknessLabel: '', emoji: questBoss.emoji, maxHp: questBoss.hp, energy: 1, energyCost: 1, unlocked: true, unlockLevel: 0, done: questAlreadyClaimed, attackKind: questBoss.attackKind };
  } else if (kind === 'mad' && madBoss && madBase) {
    target = { id: madBoss.id, name: madBoss.name, taunt: madBoss.taunt, weakness: madBoss.weakness, weaknessLabel: madBoss.weaknessLabel, emoji: madBoss.emoji, maxHp: madBoss.hp, energy, energyCost: 1, unlocked: level >= MAD_UNLOCK_LEVEL, unlockLevel: MAD_UNLOCK_LEVEL, done: false, attackKind: madBoss.attackKind };
  } else if (kind === 'mission' && missionBoss) {
    target = { id: missionBoss.id, name: missionBoss.name, taunt: missionBoss.taunt, weakness: missionBoss.weakness, weaknessLabel: '', emoji: missionBoss.emoji, maxHp: missionBoss.hp, energy: 1, energyCost: 1, unlocked: true, unlockLevel: 0, done: false, attackKind: missionBoss.attackKind };
  }
  // Kampania/wydarzenie/quest/MAD/misja resetują HP do pełna co próbę (liveBossHp podczas
  // walki, inaczej pełne maxHp). Raid ma trwały bank (raidRemaining) — ale (2026-08-17)
  // PODCZAS animowanej sesji `liveBossHp` też go nadpisuje (przeliczony na prawdziwą skalę
  // w attackRoundBased, patrz komentarz tam), żeby pasek realnie ruszał się w trakcie walki,
  // nie tylko skokiem po jej końcu.
  const targetRemaining = target ? (
    kind === 'raid' ? (raidDone ? 0 : (liveBossHp ?? raidRemaining)) :
    kind === 'event' && isMenace ? (eventDone ? 0 : (liveBossHp ?? menaceRemaining)) :
    (liveBossHp ?? target.maxHp)
  ) : 0;
  const headerTitle = kind === 'raid' ? 'Raid' : kind === 'event' ? (isMenace ? 'Nemesis' : 'Wydarzenie') : kind === 'quest' ? (questLabel ?? 'Walka questowa') : kind === 'mad' ? 'MAD Boss' : kind === 'mission' ? 'Misja' : 'Walka';
  // Kolor pigułki energii MUSI zgadzać się z bosses.tsx (2026-09-24, user zrzutem: "energia
  // tam pokazuje się niebieska zamiast czerwonej") — tam raid/wydarzenie (`eventEnergy`) są
  // CZERWONE (#F87171), kampania/MAD (`energy`) BŁĘKITNE (#38BDF8); tu było na sztywno
  // niebieskie dla WSZYSTKICH trybów, więc raid/wydarzenie realnie miały zły kolor puli.
  // Nemesis dzieli TERAZ prawdziwą `eventEnergy` z resztą wydarzeń (patrz `target` wyżej) —
  // bez wyjątku `!isMenace`, kolor jak reszta puli event/raid.
  const energyColor = (kind === 'raid' || kind === 'event') ? '#F87171' : '#38BDF8';
  // Tło CAŁEGO ekranu (2026-09-14, user: "dodałem Ci całoekranowe lokacje GORSKILAS oraz
  // JUNGLA, one są na cały ekran... trzeba je ładnie zrobić") — per-miniboss dla quest/misja
  // (`fightArenaBg` sprawdza `MISSION_LOCATION_BG[target.id]` NAJPIERW), per-kind fallback dla
  // reszty trybów (`arenaBgFor`, domyślnie `DEFAULT_ARENA_BG` = GORSKILAS, dopóki user nie
  // dorysuje dedykowanych teł dla raid/event/MAD). Liczone nawet bez `target` (np. "wszyscy
  // bossowie pokonani") — ekran ma pełnoekranowe tło ZAWSZE, nie tylko w trakcie realnej walki.
  const bgSource = fightArenaBg(kind, target?.id);
  // Do modala przegranej — kampania/wydarzenie/quest/MAD/misja mogą przegrać (raid nie ma kontrataku).
  // Wspólny kształt {id,emoji,name} wystarczy modalowi, nie potrzeba pełnego Boss.
  // `raid` dołączony 2026-08-25 razem z realnym stanem porażki dla rajdu (patrz finish() i
  // komentarz na górze pliku) — bez tego wpisu modal przegranej otwierałby się PUSTY dla
  // rajdu (defeatTarget=null gasi całą wewnętrzną treść modala, patrz warunek renderu niżej).
  const defeatTarget = kind === 'campaign' ? campaignBoss : kind === 'raid' ? raid : kind === 'event' ? eventBoss : kind === 'quest' ? questBoss : kind === 'mad' ? madBoss : kind === 'mission' ? missionBoss : null;

  useEffect(() => { resetCatHp(); }, [kind]);

  // Walka rund odgrywa się przez łańcuch setTimeout (patrz playerBeat/counterBeat niżej).
  // Jeśli user wyjdzie z ekranu W TRAKCIE animacji, te timeouty same się nie anulują —
  // bez tej straży walka dokończyłaby się PO CICHU w tle. `roundTimer` + `alive` dają czysty
  // stop: cofnięcie w trakcie walki po prostu PRZERYWA ją.
  const alive = useRef(true);
  const roundTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  // "Pomiń walkę" (2026-08-20, user: "możesz dodać przycisk jak walka jakakoliwek pomiń
  // walke?") — wynik walki (win/loss, nagrody, zapis do store'u) jest już w 100% ROZSTRZYGNIĘTY
  // w momencie kliknięcia WALCZ! (`simulateFight`/`raidAttack`/`menaceAttack`/`spendEnergy`
  // wołane SYNCHRONICZNIE w `attackRoundBased`, PRZED odtworzeniem animacji) — cała pętla
  // `playerBeat`/`counterBeat` to czysto KOSMETYCZNE odtworzenie już gotowego `result`. Skip
  // więc bezpiecznie przerywa tylko `setTimeout`-owy łańcuch i skacze prosto do `finish()`,
  // bez wpływu na wynik. Ref zamiast bezpośredniego wołania `finish` z zewnątrz — `finish`
  // żyje w domknięciu `attackRoundBased`, ustawiane na nowo przy KAŻDYM ataku.
  const skipFightRef = useRef<(() => void) | null>(null);
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
  // `bFlash` (czerwone/żółte KÓŁKO flash na portrecie) USUNIĘTE (2026-08-30, user: "jak są
  // obrażenia te takie kółka czerwone je wypierdalamy niech ataki jak łapka pięść itp będą
  // miały po prostu z tyłu cień czerwony gradient i tyle będzie mniej do animowania i mniej
  // obiektów") — był to TRZECI równoległy Animated.Value tylko na potrzeby jednego flasha;
  // "hit" feedback teraz niesie WYŁĄCZNIE ikona ataku (łapka/pięść/pazur) ze statycznym
  // (nieanimowanym) `RadialGlow` za sobą, patrz JSX niżej. Shake + liczba obrażeń zostają.
  const bShake = useRef(new Animated.Value(0)).current;
  const bDmgY = useRef(new Animated.Value(0)).current;
  const [lastHit, setLastHit] = useState<{ dmg: number; crit: boolean; guarded: boolean; healed: number; thornDmg: number } | null>(null);
  const playBossHitFx = (crit: boolean) => {
    bShake.setValue(0); bDmgY.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(bShake, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(bShake, { toValue: -1, duration: 50, useNativeDriver: true }),
        Animated.timing(bShake, { toValue: crit ? 1 : 0.5, duration: 50, useNativeDriver: true }),
        Animated.timing(bShake, { toValue: 0, duration: 50, useNativeDriver: true }),
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
  const [catHit, setCatHit] = useState<{ dmg: number; healed: number } | null>(null);
  const playCatHitFx = () => {
    kShake.setValue(0); kDmgY.setValue(0);
    Animated.parallel([
      Animated.sequence([
        Animated.timing(kShake, { toValue: 1, duration: 50, useNativeDriver: true }),
        Animated.timing(kShake, { toValue: -1, duration: 50, useNativeDriver: true }),
        Animated.timing(kShake, { toValue: 0.5, duration: 50, useNativeDriver: true }),
        Animated.timing(kShake, { toValue: 0, duration: 50, useNativeDriver: true }),
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
    // Raid (2026-08-17 → 2026-08-25): PRAWDZIWA, ciągła walka wobec REALNEJ, pozostałej puli
    // tygodniowej (`raidRemaining` jako `boss.hp` wprost) — `counterHp` osobno, bezpiecznie
    // skalowane, żeby kontratak nie zabijał kotka od realnej, wielotysięcznej puli. Patrz pełny
    // komentarz na górze pliku i w raid.ts nad raidAsBoss.
    const raidCounterHp = kind === 'raid' ? raidCounterHpFor(effectiveAtkStat, level, bonuses) : 0;
    const raidRealStart = kind === 'raid' ? raidRemaining : 0;
    // Nemesis (2026-08-18): dawna sesja-wobec-trwałej-puli sztuczka co raid MIAŁ — patrz
    // komentarz przy menaceHpFor w seasonalEvents.ts (surowa menaceHpFor jest za duża dla
    // counterDamage%). Nemesis świadomie NIE dostał tego samego fixu co raid 2026-08-25 —
    // user zgłosił problem tylko dla raidu, ten sam wzorzec do powielenia gdyby zgłosił i tu.
    const menaceSessionHp = kind === 'event' && isMenace ? menaceSessionHpFor(effectiveAtkStat, level, bonuses) : 0;
    const menaceRealStart = kind === 'event' && isMenace ? menaceRemaining : 0;
    const roundBoss: Boss | null =
      kind === 'campaign' ? campaignBoss :
      kind === 'raid' ? raidAsBoss(raid, raidRealStart, raidCounterHp) :
      kind === 'event' && eventBoss && isMenace ? menaceAsBoss(eventBoss, menaceSessionHp) :
      kind === 'event' && eventBoss ? eventAsBoss(eventBoss, level) :
      kind === 'quest' ? questBoss :
      kind === 'mad' ? madBoss :
      kind === 'mission' ? missionBoss :
      null;
    if (!roundBoss) return;
    // Quest/misja: bez puli prób — quest już wykonany realnie / misja już odczekana realnie,
    // przegrana = darmowy retry. MAD dzieli pulę energii z kampanią (to jej rozszerzenie, nie
    // osobny tor jak raid/event). Raid dzieli pulę z event (2026-08-22, patrz komentarz przy
    // raidWeek w petStore.ts), ale kosztuje 2 zamiast 1 (2026-08-25, user: "zmieńmy licznik
    // czerwonej energii na 2 zamiast 1" — dłuższa, prawdziwa walka niż dawna krótka sesja).
    // Nemesis (2026-09-24, user: "ma zużywać energię jak walczę") — dzieli teraz pulę
    // sprawdzania z event/raid, jak wszystko poniżej. Bez deadline'u dalej (`eventDaysLeftN`),
    // ale próba ataku KOSZTUJE, tak jak reszta trybów.
    if (kind !== 'quest' && kind !== 'mission') {
      const pool = kind === 'campaign' || kind === 'mad' ? energy : eventEnergy;
      const cost = target?.energyCost ?? 1;
      if (pool < cost) {
        haptic.error();
        // Raid kosztuje więcej niż 1⚡ (RAID_ENERGY_COST) — jeśli user MA jakąś energię,
        // tylko za mało na TĘ konkretną walkę, "brak prób, wróć jutro" jest mylące (2026-08-28,
        // user ze screenshotem: "mimo że mam energię nie mogę zawalczyć" — miał 1⚡, raid
        // potrzebuje 2⚡, komunikat nie mówił dlaczego).
        toast.info(pool > 0 && cost > 1
          ? `Raid kosztuje ${cost}⚡, masz tylko ${pool} — wróć jutro po więcej.`
          : 'Brak prób ataku na dziś — wróć jutro po nowe.');
        return;
      }
    }
    resetCatHp();
    const result = simulateFight(effectiveAtkStat, level, bonuses, roundBoss, catMax, MAX_FIGHT_ROUNDS, equippedItems);
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
    // Raid: JEDNO wywołanie raidAttack (nie per rundę) — dopisuje REALNY postęp tej walki
    // (raidRealStart przed minus po, już na prawdziwej skali — roundBoss.hp = raidRealStart)
    // do trwałej puli tygodniowej, ZAWSZE (win/loss/wyczerpanie rund, patrz komentarz na
    // górze pliku), i zużywa RAID_ENERGY_COST eventEnergy (2026-08-22: wspólna pula z
    // wydarzeniami; 2026-08-25: 2 zamiast 1, patrz komentarz przy RAID_ENERGY_COST w raid.ts).
    let raidOutcome: { remaining: number; defeated: boolean } | null = null;
    let menaceOutcome: { remaining: number; defeated: boolean } | null = null;
    if (kind === 'campaign' || kind === 'mad') spendEnergy();
    else if (kind === 'event' && isMenace) { menaceOutcome = menaceAttack(menaceSessionHp - result.bossHpLeft); spendEventEnergy(); }
    else if (kind === 'event') spendEventEnergy();
    else if (kind === 'raid') raidOutcome = raidAttack(raidRealStart - result.bossHpLeft);
    fightingRef.current = true;
    setFighting(true);
    setLiveBossHp(kind === 'raid' ? raidRealStart : kind === 'event' && isMenace ? menaceRealStart : roundBoss.hp);
    setCatHit(null);
    let i = 0;

    const finish = () => {
      fightingRef.current = false;
      skipFightRef.current = null;
      if (!alive.current) return;
      setFighting(false);
      setLiveBossHp(null);
      // Raid MA TERAZ stan porażki (2026-08-25, user: "kotek walczy do końca... nawet jak
      // przegra to HP bossa zostaje tyle ile po ostatnim ciosie") — w odróżnieniu od kampanii,
      // przegrana NIE zeruje postępu: `raidAttack()` wyżej już zbankował REALNE obrażenia
      // niezależnie od wyniku, więc pasek rajdu zostaje tam gdzie walka go zostawiła.
      if (kind === 'raid') {
        if (raidOutcome?.defeated) {
          haptic.success();
          const coinsWon = Math.round(raidCoins(level) * coinsMult);
          raidClaim(weekKey, coinsWon, raidXp(level), raid.name, level, fightDetail);
          setVictory({ kind: 'raid', id: raid.id, name: raid.name, emoji: raid.emoji, coins: coinsWon, xp: raidXp(level) });
        } else if (result.catFainted) {
          haptic.error();
          setDefeat({ fainted: true });
          logFightAttempt('raid', raid.id, raid.name, level, fightDetail);
        } else {
          // Wyczerpanie sufitu rund bez rozstrzygnięcia (rzadkie, patrz MAX_FIGHT_ROUNDS) —
          // bez nagrody i bez ekranu przegranej, ale próba i tak realnie się odbyła.
          logFightAttempt('raid', raid.id, raid.name, level, fightDetail);
        }
        return;
      }
      // Nemesis: LUSTRZANE raid wyżej — bez stanu porażki, liczy się TYLKO czy prawdziwa,
      // trwała pula spadła do zera (menaceOutcome.defeated), nie wynik tej jednej sesji.
      if (kind === 'event' && isMenace) {
        if (menaceOutcome?.defeated && eventBoss && eventKey) {
          haptic.success();
          const coinsWon = Math.round(menaceCoins(level) * coinsMult);
          const claimResult = menaceClaim(eventKey, coinsWon, menaceXp(level), eventBoss.name, level, fightDetail);
          setVictory({ kind: 'event', id: eventBoss.id, name: eventBoss.name, emoji: eventBoss.emoji, coins: coinsWon, xp: menaceXp(level),
            itemDropped: claimResult?.itemDropped ?? undefined, itemLeveledUp: claimResult?.itemLeveledUp ?? undefined, isMenace: true });
        } else if (eventBoss && eventKey) {
          logFightAttempt('event', eventKey, eventBoss.name, level, fightDetail);
        }
        return;
      }
      if (result.won) {
        haptic.success();
        if (kind === 'campaign' && campaignBoss) {
          const coinsWon = Math.round(campaignBoss.coins * coinsMult);
          defeatBoss(campaignBoss.id, campaignBoss.loot.id, coinsWon, campaignBoss.xp, campaignBoss.name, level, fightDetail);
          setVictory({ kind: 'campaign', id: campaignBoss.id, name: campaignBoss.name, emoji: campaignBoss.emoji, coins: coinsWon, xp: campaignBoss.xp, loot: campaignBoss.loot });
        } else if (kind === 'event' && eventBoss && eventKey) {
          const coinsWon = Math.round(eventCoins(level) * coinsMult);
          eventClaim(eventKey, coinsWon, eventXp(level), eventBoss.name, level, fightDetail);
          setVictory({ kind: 'event', id: eventBoss.id, name: eventBoss.name, emoji: eventBoss.emoji, coins: coinsWon, xp: eventXp(level) });
        } else if (kind === 'quest' && questBoss && questId) {
          const coinsWon = Math.round(questFightCoins(Number(questCoins) || 0) * coinsMult);
          const xpWon = questFightXp(Number(questXp) || 0);
          if (claimQuestFight(questId, coinsWon, xpWon, questBoss.name, level, fightDetail)) {
            if (TRAINING_QUEST_IDS.includes(questId)) markTrainingDay();
          }
          setVictory({ kind: 'quest', id: questBoss.id, name: questBoss.name, emoji: questBoss.emoji, coins: coinsWon, xp: xpWon });
        } else if (kind === 'mad' && madBoss && madBase) {
          const coinsWon = Math.round(madBoss.coins * coinsMult);
          defeatMadBoss(madBase.id, coinsWon, madBoss.xp, madBoss.name, level, fightDetail);
          setVictory({ kind: 'mad', id: madBoss.id, name: madBoss.name, emoji: madBoss.emoji, coins: coinsWon, xp: madBoss.xp });
        } else if (kind === 'mission' && missionBoss) {
          const coinsWon = Math.round(missionReward.coins * coinsMult);
          claimMission(coinsWon, missionReward.xp, missionBoss.name, level, fightDetail);
          setVictory({ kind: 'mission', id: missionBoss.id, name: missionBoss.name, emoji: missionBoss.emoji, coins: coinsWon, xp: missionReward.xp });
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
        // Raid (2026-08-25): `roundBoss.hp` to TERAZ wprost realna, pozostała pula
        // (`raidAsBoss(raid, raidRealStart, ...)` wyżej) — `round.bossHpAfter` jest więc już
        // na realnej skali, żadnego przeliczania. Nemesis NADAL liczy wobec małej, bezpiecznie
        // skalowanej sesji (nie dostał tego samego fixu co raid, patrz komentarz przy
        // menaceSessionHp wyżej) — przelicz TYLKO jej postęp na prawdziwą skalę tygodniową.
        const menaceRealHp = kind === 'event' && isMenace ? Math.max(0, menaceRealStart - (menaceSessionHp - round.bossHpAfter)) : null;
        setLiveBossHp(menaceRealHp ?? round.bossHpAfter);
        // BUG FIX (2026-08-19, user: "kotek atakuje 2 raz jakby czasami nawet jak przeciwnik
        // ma zero HP") — dotyczy TYLKO nemesis: jej sesja ZAWSZE animuje się w pełnej długości
        // (result.rounds liczone wobec małego, bezpiecznie skalowanego celu sesji), ale
        // PRAWDZIWA pula (menaceRealStart) mogła mieć MNIEJ HP niż cała sesja — jeśli tak,
        // przeliczona wyżej realna skala dochodzi do 0 w środku sesji, a animacja mimo to
        // grałaby dalej fikcyjne ciosy w już martwego bossa bez tego skoku do finish(). Raid
        // NIE potrzebuje już tego hacku — jego `bossHp` w simulateFight JEST realną pulą,
        // więc pętla tam (`if (bossHp <= 0) break`) sama kończy walkę we właściwym miejscu.
        const realDead = menaceRealHp === 0;
        roundTimer.current = setTimeout(realDead ? finish : counterBeat, realDead ? 550 : 480);
      }, THROW_MS);
    };

    skipFightRef.current = () => {
      if (roundTimer.current) { clearTimeout(roundTimer.current); roundTimer.current = null; }
      setPawFlying(false);
      setBoltFlying(false);
      setCatHit(null);
      setLastHit(null);
      finish();
    };
    playerBeat();
  };

  const skipFight = () => { haptic.tap(); skipFightRef.current?.(); };

  // Raid dołączył do attackRoundBased 2026-08-17 (patrz komentarz na górze pliku) — jedna
  // wspólna funkcja obsługuje teraz wszystkie 6 trybów.
  const attack = attackRoundBased;

  const bShakeX = bShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const bFloatY = bDmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const bFloatOp = bDmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const kShakeX = kShake.interpolate({ inputRange: [-1, 1], outputRange: [-8, 8] });
  const kFloatY = kDmgY.interpolate({ inputRange: [0, 1], outputRange: [0, -46] });
  const kFloatOp = kDmgY.interpolate({ inputRange: [0, 0.15, 0.8, 1], outputRange: [0, 1, 1, 0] });
  const pawX = pawTravel.interpolate({ inputRange: [0, 1], outputRange: ['16%', '84%'] });
  const pawOp = pawTravel.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] });
  const pawScale = pawTravel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.15, 0.8] });
  const boltX = boltTravel.interpolate({ inputRange: [0, 1], outputRange: ['84%', '16%'] });
  const boltOp = boltTravel.interpolate({ inputRange: [0, 0.08, 0.85, 1], outputRange: [0, 1, 1, 0] });
  const boltScale = boltTravel.interpolate({ inputRange: [0, 0.5, 1], outputRange: [0.8, 1.15, 0.8] });
  // Unikatowy kontratak per typ bossa (2026-08-17) — patrz komentarz przy render'ze pocisku
  // niżej. Brak attackKind (większość rosteru) = ta sama pięść co dotąd. 2026-08-26 (user:
  // "ta pięść jest zdecydowanie za często... nie rób własnej ikony, masz gotowe PNG") —
  // prawdziwy narysowany PNG (`attackPng`, bossIcons.ts) zamiast generycznej kolorowanej
  // ikony lucide.
  const counterPng = attackPng(target?.attackKind);

  const closeVictory = () => { setVictory(null); router.back(); };
  const closeDefeat = () => { setDefeat(null); router.back(); };
  const VictoryLootIcon = victory?.loot ? lootIcon(victory.loot) : Trophy; // fallback nieużywany w JSX (renderowane tylko gdy loot istnieje), zostaje żeby zadowolić typy LucideIcon

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      {/* Tło CAŁEGO ekranu (2026-09-14) — Image + Image (expo-image) absolutnie wypełniające
          cały SafeAreaView, POD headerem/scrollem/dokowanym paskiem, nie tylko pod areną
          portretów jak dawniej (`arenaScene`/`ImageBackground`, teraz zwykły `View`, patrz
          niżej). Scrim (ten sam 3-stopniowy czarny gradient co dawna winieta areny, teraz na
          całym ekranie) + jednolita jasnoszara "mgiełka" (identyczny przepis co tło lokacji
          misji w pet.tsx, żeby te same lokacje wyglądały spójnie w OBU miejscach, gdzie się
          pojawiają — w drodze i w walce). */}
      <Image source={bgSource} style={StyleSheet.absoluteFillObject} contentFit="cover" pointerEvents="none" />
      <LinearGradient
        pointerEvents="none"
        colors={['rgba(0,0,0,0.5)', 'rgba(0,0,0,0.08)', 'rgba(0,0,0,0.55)'] as [string, string, string]}
        locations={[0, 0.45, 1]}
        style={StyleSheet.absoluteFillObject}
      />
      <View pointerEvents="none" style={[StyleSheet.absoluteFillObject, { backgroundColor: 'rgba(160,165,175,0.16)' }]} />

      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color="#fff" /></PressableScale>
        <Text style={s.headerTitle} numberOfLines={1}>{headerTitle}</Text>
        {/* Prawy spacer balansujący `backBtn` (40px), żeby tytuł został wyśrodkowany — pigułka
            energii PRZENIESIONA niżej, obok pływającego przycisku WALCZ (2026-09-14, user:
            "przycisk walki od teraz będzie lewitował na dole jak navbar jakby obok niego
            dane" — dane = koszt/stan energii, żyją teraz RAZEM z akcją którą opisują, zamiast
            osobno w headerze, daleko nad przewijaną treścią). */}
        <View style={{ width: 40 }} />
      </View>

      {/* `style={{flex:1}}` (2026-09-14) — bez tego ScrollView NIE wypełnia dostępnej
          wysokości ekranu (rozmiar dopasowuje do treści, nie do rodzica), więc
          `flexGrow:1`+`justifyContent` na `contentContainerStyle` (`s.scroll`) nie miało
          się w czym wycentrować/zakotwiczyć — dokładnie stąd zrzut usera z pustą przestrzenią
          pod kartą walki zamiast realnego "zakotwiczenia" niżej. */}
      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* Pupil w trakcie podróży (2026-08-20) — renderowany jako MINI POPUP niżej
            (`missionAwayOverlay`/`missionAwayCard`), nie jako pełnoekranowy tekst w treści
            ekranu (user: "zamiast full screen powiadomień jak pupil jest w misji zrób mini
            popup window"). Tu w scrollu zostaje tylko PUSTA scena za popupem — dotyczy
            KAŻDEGO trybu walki (kampania/raid/event/quest/mad/misja), bo dopóki misja trwa,
            nic nie da się zaatakować (`target` i tak jest `null` dla kind==='mission', a dla
            reszty trybów blokuje `missionAway` w `attack()` poniżej). */}
        {missionAway ? (
          <View style={s.done} />
        ) : !target ? (
          <View style={s.done}>
            <Swords size={30} color="rgba(255,255,255,0.85)" />
            <Text style={s.doneTxt}>
              {kind === 'campaign' ? 'Wszyscy bossowie pokonani! Kolejni wkrótce.'
                : kind === 'mad' ? 'Brak dostępnego MAD celu — pokonaj (kolejnego) bossa kampanii, żeby odblokować jego MAD wersję.'
                : kind === 'mission' ? 'Brak aktywnej misji — wyślij pupila z ekranu Pupil.'
                : 'Brak aktywnego wydarzenia teraz — wróć innym razem.'}
            </Text>
          </View>
        ) : !target.unlocked ? (
          <View style={s.lockBox}>
            <Lock size={16} color="rgba(255,255,255,0.85)" />
            <Text style={s.lockTxt}>Odblokujesz na poziomie {target.unlockLevel} (masz {level}). Rozwijaj pupila questami.</Text>
          </View>
        ) : (
          <View style={s.arena}>
            {/* dwa symetryczne kafelki — Pupil / Boss. Pupil ma pasek HP w kampanii I wydarzeniu
                (obie mają realny kontratak) — TYLKO raid go nie ma, pasek zawsze pełny byłby mylący.
                Scena walki (2026-09-02, user dostarczył `LOKACJA_KAMPANIA.png`; PEŁNOEKRANOWA
                od 2026-09-14, patrz `bgSource`/scrim/mgiełka renderowane raz na całym ekranie
                wyżej) — samo pole portretów/HP nie ma już WŁASNEGO obrazka/scrimu (usunięty
                `ImageBackground`+lokalny gradient, dawny `arenaScene` to teraz zwykły
                pozycjonujący `View`, BEZ zmian w geometrii wewnątrz — `projectile.top` i cała
                reszta nadal liczą się względem TEGO SAMEGO `position:'relative'` kontenera,
                tylko już nie niesie własnego tła). Etykieta+pasek HP kotka/bossa ZOSTAJĄ z
                text-shadow jak dotąd (user: "paski zdrowia pod nimi cienie zostają"). */}
            <View style={s.arenaScene}>
            <View style={s.vsRow}>
              <View style={s.tile}>
                {/* Portret NAD nazwą/paskiem HP (2026-09-03, user: "w bossach w walkach
                    zdrowie musi byc pod spodem") — dawniej etykieta+HP siedziały nad
                    portretem; teraz portret jest pierwszym elementem kafelka (patrz
                    `s.projectile.top`, przeliczony wprost z tej nowej kolejności zamiast z
                    wysokości linijek tekstu nad nim — deterministyczne, nie zgadywane). */}
                <View style={s.tilePortrait}>
                  {/* Wewnętrzny box DOKŁADNIE rozmiaru kotka (nie całej, wyższej
                      `tilePortrait`, patrz komentarz przy `CAT_PORTRAIT_SIZE`) — żeby cień
                      (GroundShadow, `bottom:0` względem SWOJEGO rodzica) siadał pod
                      faktycznymi łapkami kotka, a nie pod pustym marginesem wspólnego,
                      wyższego kafelka. */}
                  <View style={s.spriteBoxCat}>
                    {/* Halo za sprite'em (2026-09-06, "high-end fight scene" — patrz komentarz
                        przy winiecie wyżej) — miękka poświata w kolorze futra kotka, żeby
                        sylwetka odcinała się od TŁA NIEZALEŻNIE od tego, jak jasna/zgiełkliwa
                        jest akurat grafika areny za nim. `GroundShadow` (cień pod łapkami)
                        zostaje bez zmian, to DODATKOWA, osobna poświata za całym sprite'em. */}
                    <RadialGlow size={CAT_PORTRAIT_SIZE * 1.5} color={palette.coat} opacity={0.22} />
                    <GroundShadow width={CAT_PORTRAIT_SIZE * CAT_SHADOW_SCALE_X} height={CAT_PORTRAIT_SIZE * CAT_SHADOW_SCALE_Y} opacity={0.5} />
                    <Animated.View style={{ transform: [{ translateX: kShakeX }] }}>
                      {/* CatArtStatic (2026-09-26, user: "zapisać wersję svg bez animacji i po
                          prostu zmieniać mu kolor adekwatnie jak mu zmieniam") — cofnięcie
                          §"animate=false" (2026-08-30): TEN prop tylko gasił idle-pętle, ale
                          CatArt.tsx nadal alokował 8 Animated.Value + kilka useState/useEffect
                          (w tym atak/swat) przy KAŻDYM mouncie/renderze, niezależnie od
                          `animate`. `CatArtStatic` to osobny komponent — zero Animated.Value,
                          zero useState/useEffect, czysta funkcja koloru/wyglądu (paleta/pręgi/
                          oczy/nosek/wąsy) renderująca WYŁĄCZNIE spoczynkową pozę. Bez ataku/
                          swata na trafienie — fight ma już osobny sygnał (latająca łapa +
                          flash bossa, `pawTravel`/`playBossHitFx` niżej), kotek nie musi tego
                          dublować. Dawny `attackPulse` (licznik tylko po to, żeby przekazać
                          `attack` do CatArt) USUNIĘTY — nic już go nie czyta. */}
                      <CatArtStatic size={CAT_PORTRAIT_SIZE} expression="content" palette={palette} stripes={catStripes}
                        eyeColor={catEyeColor} noseColor={catNoseColor} whiskers={catWhiskers} legStripes={catLegStripes} />
                    </Animated.View>
                    {/* Pazury (2026-08-17, user: "jak są pazury to nie mają lecieć tylko
                        pojawiać się na pupila") — atak w zwarciu, nie rzut: zamiast
                        podróżującego pocisku (boltFlying niżej, suppressed dla claw), burst
                        ikony wprost NA portrecie kotka, wyzwalany tym samym `boltTravel` co
                        lot pocisku dla pozostałych typów. `RadialGlow` statyczny (bez własnego
                        Animated.Value — dziedziczy opacity/scale z tego samego wrappera co
                        ikona, patrz komentarz przy usunięciu `tileFlash` wyżej) zastępuje
                        dawne czerwone kółko-flash jako "hit" feedback. */}
                    {boltFlying && target?.attackKind === 'claw' && (
                      <Animated.View pointerEvents="none" style={[s.clawFx, { opacity: boltOp, transform: [{ scale: boltScale }, { rotate: '12deg' }] }]}>
                        <RadialGlow size={130} color="#F87171" opacity={0.55} />
                        <Image source={counterPng} style={{ width: 90, height: 90 }} contentFit="contain" />
                      </Animated.View>
                    )}
                    {catHit && !!catHit.dmg && (
                      <Animated.Text style={[s.dmgFloat, { opacity: kFloatOp, transform: [{ translateY: kFloatY }], color: '#F87171' }]}>-{catHit.dmg}</Animated.Text>
                    )}
                  </View>
                </View>
                <Text style={s.tileLabel} numberOfLines={1}>Pupil</Text>
                {/* Wszystkie 3 tryby mają teraz realny kontratak (2026-08-12) — pasek HP kotka
                    pokazuje się zawsze, nie tylko w kampanii/wydarzeniu. */}
                <View style={s.tileHpBlockCat}>
                  <View style={s.tileHpTrack}><View style={[s.tileHpFill, { width: `${Math.round(catHp / catMax * 100)}%`, backgroundColor: '#2AC68F' }]} /></View>
                  <Text style={s.tileHpTxt}>{catHp} / {catMax}</Text>
                </View>
              </View>

              <View style={s.tile}>
                <View style={s.tilePortrait}>
                  <View style={s.spriteBoxBoss}>
                    {/* Halo za bossem — ten sam zabieg co przy kotku wyżej, kolorem "słabości"
                        bossa (`WEAK_COLOR`, już używanym przy etykiecie/motywie), więc poświata
                        nie jest przypadkowa — czyta się jak sygnatura elementu bossa. */}
                    <RadialGlow size={PORTRAIT_SIZE * 1.6} color={WEAK_COLOR[target.weakness] ?? '#F87171'} opacity={0.25} />
                    <GroundShadow width={PORTRAIT_SIZE * BOSS_SHADOW_SCALE_X} height={PORTRAIT_SIZE * BOSS_SHADOW_SCALE_Y} opacity={0.5} />
                    {/* Tylko shake na samym sprite'cie bossa (2026-08-14, user: "u nas trochę
                        chaos" — porównanie do S&F: łapka leci, uderza, wróg się trzęsie, dmg
                        się pokazuje, nic więcej). Per-bossowy burst-image (bomby/ogień/…) USUNIĘTY
                        permanentnie (2026-08-18, user: "te bomby... pojawiały się tylko na sobie
                        samym, robiły scaling up i znikały, zadając dmg na odległość dziwnie xd,
                        wywalmy je wgle" — statyczny obrazek scale+fade czytał się jako płaski
                        "scan i zniknięcie", nie realny cios; działające wzorce to WYŁĄCZNIE
                        podróżujący pocisk (łapka/magia) i burst-na-celu (pazury), oba już tu są).
                        Zostaje shake+liczba obrażeń — ten sam, spójny język co raid/event/
                        quest/mad/misja miały od zawsze (one nigdy nie dostały attackFx).
                        Czerwone kółko-flash (`tileFlash`) USUNIĘTE (2026-08-30, patrz komentarz
                        przy `bFlash`/`playBossHitFx` wyżej) — "hit" niesie teraz ikona ataku ze
                        statycznym `RadialGlow` za sobą, nie osobny animowany obiekt na portrecie. */}
                    <Animated.View style={{ transform: [{ translateX: bShakeX }] }}>
                      <BossArt id={target.id} emoji={target.emoji} size={PORTRAIT_SIZE} powered={kind === 'raid' || kind === 'mad' || (kind === 'event' && isMenace)} />
                    </Animated.View>
                    {lastHit && (
                      <Animated.Text style={[s.dmgFloat, { opacity: bFloatOp, transform: [{ translateY: bFloatY }], color: lastHit.crit ? '#FDE047' : '#F87171' }]}>
                        -{lastHit.dmg}{lastHit.crit ? ' KRYT!' : ''}
                      </Animated.Text>
                    )}
                  </View>
                </View>
                <Text style={[s.tileLabel, { color: WEAK_COLOR[target.weakness] ?? '#fff' }]} numberOfLines={1}>{target.name}</Text>
                <View style={s.tileHpBlockBoss}>
                  <View style={s.tileHpTrack}><View style={[s.tileHpFill, { width: `${Math.round(targetRemaining / target.maxHp * 100)}%` }]} /></View>
                  <Text style={s.tileHpTxt}>{targetRemaining} / {target.maxHp}</Text>
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
                    tym samym ekranie (patrz `palette` wyżej), więc łapka wygląda jak NAPRAWDĘ jego.
                    `RadialGlow` statyczny za ikoną (2026-08-30, patrz komentarz przy usunięciu
                    `tileFlash`) — dziedziczy opacity/scale animowanego wrappera, zero nowego
                    Animated.Value. */}
                <RadialGlow size={46} color="#F87171" opacity={0.5} />
                <PawPrint size={30} color={palette.coat} fill={palette.coat} />
              </Animated.View>
            )}
            {/* Kontratak bossa — user (2026-08-12): poprzednio leciał tu ten sam per-bossowy
                burst (fire/bomb/magicspell/…) co przy Twoim trafieniu, i wyglądało to jak
                rakieta/bomba lecąca w kotka, nie jak cios — dlatego uniwersalna pięść (per-bossowy
                burst przy Twoim ciosie USUNIĘTY permanentnie 2026-08-18). 2026-08-17 (user: "bossy miały unikatowe ataki —
                drapieżniki drapnięcie pazurami, magowie kulę magiczną, miecze slash mieczem, ci
                którzy nie mają to pięść") — dalej PROSTY kształt (jedna ikona lecąca po prostej),
                tylko dobrana po `target.attackKind` zamiast zawsze tej samej pięści; brak
                attackKind = ta sama pięść co dawniej, więc zachowanie dla większości bossów bez
                zmian. Pazury WYJĄTKOWO nie lecą tędy wcale (2026-08-17) — patrz `s.clawFx` burst
                na portrecie kotka wyżej, ten sam trigger (`boltFlying`/`boltOp`/`boltScale`),
                inne miejsce renderu. */}
            {boltFlying && target?.attackKind !== 'claw' && (
              <Animated.View pointerEvents="none" style={[s.projectile, { left: boltX, opacity: boltOp, transform: [{ scale: boltScale }, { translateX: -14 }] }]}>
                <RadialGlow size={46} color="#F87171" opacity={0.5} />
                <Image source={counterPng} style={{ width: 28, height: 28 }} contentFit="contain" />
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
              <Text style={s.motywTxt}>Motyw: <Text style={{ color: WEAK_COLOR[target.weakness] ?? '#fff', fontWeight: '800' }}>{target.weaknessLabel}</Text></Text>
            )}
            {/* Odliczanie (2026-08-16) — TYLKO sezonowe mają jeszcze FLAT próbę dzienną i termin.
                Nemesis (2026-08-18) nie ma już końca ani limitu prób — pasek HP wyżej (trwały
                bank) mówi wprost ile jeszcze zostało do zrobienia, bez sztucznego dedline'u. */}
            {kind === 'event' && !isMenace && !eventDone && (
              <Text style={[s.motywTxt, { color: eventDaysLeftN <= 1 ? '#F87171' : eventDaysLeftN <= 3 ? '#FBBF24' : 'rgba(255,255,255,0.85)', fontWeight: '800' }]}>
                {eventDaysLeftN <= 0 ? 'Kończy się dziś' : `Kończy się za ${eventDaysLeftN} ${eventDaysLeftN === 1 ? 'dzień' : 'dni'}`}
              </Text>
            )}
            {/* Reaktywne linijki mechaniki (co WŁAŚNIE się stało w tej rundzie) — zostają w
                scrollu pod "Motywem" (informacyjne, nie akcja). Przycisk WALCZ!/"Pomiń
                walkę"/ostrzeżenie o energii PRZENIESIONE do dokowanego paska na dole ekranu
                (2026-09-14, user: "przycisk walki od teraz będzie lewitował na dole jak
                navbar" — patrz `s.floatingBar` po zamknięciu ScrollView niżej), więc te
                linijki już nic pod sobą nie przesuwają — floating bar ma stałą pozycję
                niezależnie od tego ile ich jest widocznych. */}
            {lastHit?.guarded && <View style={s.mechRow}><Shield size={13} color="#F4B740" /><Text style={s.mechNote}>Osłona: ten boss redukuje ciosy ×0.5</Text></View>}
            {!!lastHit?.healed && <View style={s.mechRow}><HeartPulse size={13} color="#7DD3FC" /><Text style={s.mechNoteHeal}>Boss zregenerował +{lastHit.healed} (wrodzona regeneracja)</Text></View>}
            {!!catHit?.healed && <View style={s.mechRow}><HeartPulse size={13} color="#2AC68F" /><Text style={[s.mechNoteHeal, { color: '#2AC68F' }]}>Uzdrowienie: kotek odzyskał +{catHit.healed} HP</Text></View>}
            {/* Item "Cierń" liczył się już wcześniej w silniku, ale bez własnego pola w
                FightRound UI nie miało jak pokazać że w ogóle coś zrobił — user (2026-08-11):
                "nie widzę żeby był aktywny jakoś podczas walki realnie". */}
            {!!lastHit?.thornDmg && (
              <View style={s.mechRow}>
                <Image source={COMBAT_ITEMS.thorn.icons[0]} style={{ width: 13, height: 13 }} contentFit="contain" />
                <Text style={[s.mechNoteHeal, { color: '#4ADE80' }]}>Cierń: dodatkowe -{lastHit.thornDmg} bossowi</Text>
              </View>
            )}
          </View>
        )}
      </ScrollView>

      {/* Dokowany pasek akcji (2026-09-14, user: "przycisk walki od teraz będzie lewitował na
          dole jak navbar jakby obok niego dane") — ten sam wizualny język co TabBar.tsx (pill
          zawsze widoczny NAD contentem, bottom scrim żeby treść płynnie chowała się pod spód,
          `pointerEvents="box-none"` żeby przezroczyste marginesy przepuszczały dotyk do sceny
          za nimi). Renderowany TYLKO gdy jest realny cel do zaatakowania (target && unlocked,
          nie w trakcie podróży/brak-celu/zablokowane — tam nie ma czego robić). "Dane obok
          przycisku" = pigułka energii (koszt/stan puli), PRZENIESIONA tu z headera — żyje teraz
          razem z akcją którą opisuje, zamiast osobno nad przewijaną treścią; quest/misja nadal
          jej nie mają (brak puli energii, patrz komentarz przy dawnym `energyPill` w headerze),
          więc przycisk zajmuje wtedy całą szerokość paska. */}
      {!missionAway && target && target.unlocked && (
        <View style={[s.floatingBar, { paddingBottom: (insets.bottom || 0) + spacing[3] }]} pointerEvents="box-none">
          <LinearGradient
            pointerEvents="none"
            colors={['transparent', 'rgba(0,0,0,0.55)', 'rgba(0,0,0,0.8)']}
            locations={[0, 0.4, 1]}
            style={[s.floatingBarScrim, { height: (insets.bottom || 0) + 180 }]}
          />
          {target.done ? (
            <View style={s.floatingBarDone}>
              <Text style={s.doneInlineTxt}>Pokonany ✓ · {kind === 'raid' ? 'nowy w poniedziałek' : kind === 'quest' ? 'nagroda odebrana dziś' : kind === 'event' && isMenace ? 'nemesis rozwiązany' : 'wróć w kolejnym okresie'}</Text>
            </View>
          ) : (
            <>
              <View style={s.floatingBarRow}>
                {/* Pigułka energii — ta sama logika/format co dawny header (2026-09-07, "5/2...
                    jakby się przeładowywała" — SAM stan puli, nie ułamek), tylko teraz obok
                    przycisku zamiast osobno nad scrollem. Quest/misja bez puli → pomijana.
                    Nemesis (2026-09-24, user: "ma zużywać energię jak walczę") dzieli TERAZ
                    prawdziwą `eventEnergy` z raid/wydarzeniem (dawna atrapa "1" zdjęta, patrz
                    komentarz przy `target` konstrukcji wyżej) — jeden, wspólny render, bez
                    specjalnego przypadku dla menace. */}
                {kind !== 'quest' && kind !== 'mission' && (
                  <View style={[s.energyPill, { backgroundColor: energyColor + '18', borderColor: energyColor + '40' }]}>
                    <Zap size={13} color={energyColor} /><Text style={[s.energyTxt, { color: energyColor }]}>{target.energy}</Text>
                  </View>
                )}
                <PressableScale onPress={attack} disabled={target.energy < target.energyCost || fighting} style={{ flex: 1 }}>
                  <View style={[s.attackBtn, (target.energy < target.energyCost || fighting) && { opacity: 0.5 }]}>
                    <Swords size={18} color="#fff" />
                    <Text style={s.attackTxt}>{fighting ? 'Walka trwa…' : 'WALCZ!'}</Text>
                  </View>
                </PressableScale>
              </View>
              {/* Raid kosztuje >1⚡ — jeśli masz za mało (ale nie zero), powiedz wprost ILE
                  potrzeba, zamiast wygaszonego przycisku bez wyjaśnienia (2026-08-28, user
                  ze screenshotem: "mimo że mam energię nie mogę zawalczyć"). */}
              {target.energy > 0 && target.energy < target.energyCost && (
                <Text style={s.energyShortTxt}>Potrzeba {target.energyCost}⚡, masz {target.energy}</Text>
              )}
              {/* "Pomiń walkę" (2026-08-20) — wynik jest już rozstrzygnięty w momencie WALCZ!,
                  ten przycisk tylko przerywa kosmetyczną animację i skacze do finish(). */}
              {fighting && (
                <PressableScale onPress={skipFight} style={{ marginTop: spacing[2], alignSelf: 'center' }}>
                  <Text style={s.skipFightTxt}>Pomiń walkę</Text>
                </PressableScale>
              )}
            </>
          )}
        </View>
      )}

      <Modal visible={!!victory} transparent statusBarTranslucent animationType="fade" onRequestClose={closeVictory}>
        <Pressable style={s.vBackdrop} onPress={closeVictory}>
          <Confetti colors={['#FDE047', '#2AC68F', '#38BDF8', '#F472B6']} />
          {victory && (
            <View style={s.vCenter} pointerEvents="none">
              <Text style={s.vKicker}>{victory.kind === 'raid' ? 'RAID POKONANY!' : victory.kind === 'event' ? (victory.isMenace ? 'NEMESIS POKONANY!' : 'WYDARZENIE POKONANE!') : victory.kind === 'quest' ? 'QUEST WYGRANY!' : victory.kind === 'mad' ? 'MAD BOSS POKONANY!' : victory.kind === 'mission' ? 'MISJA UKOŃCZONA!' : 'WYGRANA!'}</Text>
              <View style={{ opacity: 0.6 }}>
                <BossArt id={victory.id} emoji={victory.emoji} size={78} powered={victory.kind === 'raid' || victory.kind === 'mad' || victory.isMenace} />
              </View>
              <Text style={s.vName}>{victory.kind === 'campaign' ? `${victory.name} pokonany` : victory.name}</Text>
              {/* Box z ikoną+nazwą TYLKO dla prawdziwego itemu ze statem (kampania) — 2026-08-18,
                  user: "z bossów nagrody wypierdzielaj trofea, cały czas pisze że coś dostałem
                  xd". Raid/event/quest/mad/misja nie dają realnego przedmiotu, tylko flavor
                  placeholder ("Medal tygodnia" itd.) — pokazywanie GO w tym samym pudełku co
                  prawdziwy item, przy KAŻDEJ z tych bardzo częstych walk (misje/questy lecą
                  wielokrotnie dziennie, patrz log), czytało się jak pusty "zdobyłeś trofeum"
                  spam. Coins/XP niżej i tak pokazują realną nagrodę — box zbędny bez lootu.
                  itemDropped (nemesis) ma WŁASNY, osobny napis niżej, zostaje. */}
              {victory.loot && (
                <View style={s.vLoot}>
                  <VictoryLootIcon size={30} color="#2AC68F" />
                  <Text style={s.vLootName}>{victory.loot.name}</Text>
                  <Text style={s.vLootDesc}>{victory.loot.desc}</Text>
                </View>
              )}
              <View style={s.vRewardRow}>
                <Coins size={16} color="#FDE047" /><Text style={s.vReward}>{victory.coins} · +{victory.xp} XP</Text>
              </View>
              {victory.itemDropped && (
                <Text style={s.vItemDrop}>🎁 Nowa umiejętność: {COMBAT_ITEMS[victory.itemDropped].name}!</Text>
              )}
              {victory.itemLeveledUp && (
                <Text style={s.vItemDrop}>⬆️ {COMBAT_ITEMS[victory.itemLeveledUp.id].name} +1 poziom (Lv{victory.itemLeveledUp.level})!</Text>
              )}
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
                <BossArt id={defeatTarget.id} emoji={defeatTarget.emoji} size={78} powered={kind === 'raid' || kind === 'mad' || (kind === 'event' && isMenace)} />
              </View>
              <Text style={s.vName}>{defeatTarget.name} przetrwał</Text>
              <Text style={s.vDefeatSub}>
                {defeat.fainted
                  ? (kind === 'raid'
                    // Raid NIE resetuje HP na przegranej (2026-08-25, user: "nawet jak
                    // przegra to HP bossa zostaje tyle ile po ostatnim ciosie") — inny
                    // komunikat niż reszta trybów, żeby nie sugerować fałszywie reset.
                    ? 'Kotek zemdlał — ale zadane obrażenia zostają, pasek rajdu nie wraca do pełna. Spróbuj ponownie, kiedy będziesz gotowy.'
                    : 'Kotek zemdlał — HP resetuje się, spróbuj ponownie, kiedy będziesz gotowy.')
                  : 'Przeciwnik zbyt szybko się leczy/broni — wróć mocniejszy (staty, poziom, łup) i spróbuj znów.'}
              </Text>
            </View>
          )}
          <Text style={s.vHint}>Stuknij, aby zamknąć</Text>
        </Pressable>
      </Modal>

      {/* Mini popup "pupil w trakcie podróży" (2026-08-20, user: "zamiast full screen
          powiadomień jak pupil jest w misji to zrób mini popup window pupil w trakcie
          podróży pasek ładowania na nim i czerwony przycisk powróc natychmiast") — zastępuje
          dawny pełnoekranowy tekstowy blok (`s.done`/`s.lockBox`) który pokazywał się gdy
          user próbował walczyć w KTÓRYMKOLWIEK trybie podczas gdy pupil jest w drodze. Ten
          sam pasek/nazwa-miejsca co na scenie w `app/pet.tsx` (uproszczony, bez animacji
          wejścia/fali — to króciutki popup, nie hero element ekranu). */}
      <Modal visible={missionAway} transparent statusBarTranslucent animationType="fade" onRequestClose={() => router.back()}>
        <View style={s.missionAwayOverlay}>
          <View style={s.missionAwayCard}>
            <Compass size={26} color="#38BDF8" />
            <Text style={s.missionAwayTitle}>Pupil w trakcie podróży</Text>
            {missionMb && <Text style={s.missionAwayDest}>{missionMb.destination}</Text>}
            <View style={s.missionAwayBarTrack}>
              <View style={[s.missionAwayBarFill, { width: `${Math.round(missionProgress * 100)}%` }]} />
            </View>
            <Text style={s.missionAwayTimer}>Wraca za {fmtMissionDuration(missionRemainingMs / 60000)}</Text>
            <View style={s.missionAwayBtnRow}>
              <PressableScale onPress={() => router.back()} style={{ flex: 1 }}>
                <View style={s.missionAwayBackBtn}><Text style={s.missionAwayBackTxt}>Wróć do ekranu</Text></View>
              </PressableScale>
              <PressableScale onPress={() => { haptic.tap(); setMissionCancelConfirm(true); }} style={{ flex: 1 }}>
                <View style={s.missionAwayCancelBtn}><Text style={s.missionAwayCancelTxt}>Wróć natychmiast</Text></View>
              </PressableScale>
            </View>
          </View>
        </View>
      </Modal>

      <ConfirmDialog
        visible={missionCancelConfirm}
        title="Wrócić z misji?"
        message="Jeżeli chcesz anulować, NIE otrzymasz nagrody za misję."
        confirmLabel="Wróć natychmiast"
        cancelLabel="Zostań w misji"
        destructive
        onConfirm={() => { setMissionCancelConfirm(false); cancelMission(); haptic.tap(); toast.info('Misja anulowana — bez nagrody'); router.back(); }}
        onCancel={() => setMissionCancelConfirm(false)}
      />
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  // Stały biały + text-shadow (2026-09-14) zamiast `c.text.primary` — ekran ma teraz
  // pełnoekranowe zdjęcie za sobą zamiast płaskiego tła motywu, więc kolor tekstu musi być
  // NIEZALEŻNY od jasnego/ciemnego motywu (ten sam powód co `tileLabel` niżej, już dawno
  // hardkodowany z tego samego względu).
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: '#fff', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  energyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#38BDF818', borderRadius: radius.full, paddingHorizontal: 10, height: 30, borderWidth: 1, borderColor: '#38BDF840' },
  energyTxt: { fontSize: 13, fontWeight: '800', color: '#38BDF8' },
  // paddingBottom 170 — rezerwa pod dokowany pasek WALCZ na dole (`s.floatingBar`, absolutnie
  // pozycjonowany POZA ScrollView), żeby ostatnia linijka feedbacku nie chowała się na stałe
  // pod nim; treść i tak da się doscrollować dalej, to tylko wygodny domyślny odstęp.
  // `justifyContent:'flex-end'` (2026-09-14, user ze zrzutem pełnoekranowej areny: "muszą być
  // niżej żeby wyglądali jakby byli [tam]") — było `'center'`, ale tła lokacji (GORSKILAS/
  // JUNGLA/LODOWA) mają wyraźną "ziemię"/ścieżkę TYLKO w dolnej ~40% kadru (niebo/góry/korony
  // drzew nad tym) — wycentrowana karta zostawiała kotka/bossa unoszących się w środku nieba.
  // Zakotwiczenie do DOŁU dostępnej przestrzeni scrolla (tuż nad `floatingBar`) stawia portrety
  // w dolnej części ekranu niezależnie od konkretnej kompozycji obrazka — ten sam efekt
  // "stania na ziemi" na każdym z nich, nie tylko na tym jednym, który akurat teraz testujemy.
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: 170, flexGrow: 1, justifyContent: 'flex-end' },

  done: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  doneTxt: { fontSize: 13, color: '#fff', opacity: 0.85, textAlign: 'center', maxWidth: 260, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

  // Powiększone portrety (2026-08-30, patrz `PORTRAIT_SIZE` u góry pliku) — padding areny/
  // odstęp wierszy/padding kafelka lekko ścieśnione (16→12 / 12→8 / 12→8), żeby oddać
  // portretowi więcej miejsca bez rozsadzania szerokości ekranu. (`tilePortrait.height` ma
  // teraz własny, nowszy komentarz niżej — 2026-09-03 dodał drugi, większy rozmiar dla kotka.)
  // BEZ własnego tła/ramki (2026-09-14) — cała karta stoi teraz na pełnoekranowym tle lokacji
  // (`bgSource`, renderowane raz na poziomie SafeAreaView), nie na płaskim `c.bg.card` jak
  // dawniej. Padding zostaje — geometria wewnątrz (kafelki/portret/pocisk) nietknięta.
  arena: { alignItems: 'center', padding: spacing[3] },

  // Scena portretów/HP (2026-09-02) — czysto POZYCJONUJĄCY kontener (`position:'relative'` pod
  // `projectile`'y absolutnie pozycjonowane względem niego), odseparowany od reszty `arena`
  // (motyw/mechaniki), której wysokość zmienia się wraz z liczbą widocznych linijek feedbacku.
  // Przestał nieść WŁASNY obrazek/scrim 2026-09-14 (dawny `ImageBackground` → zwykły `View`,
  // tło już jest pełnoekranowe za całym ekranem) — BEZ własnego paddingu, geometria wewnątrz
  // (kafelki/portret/pocisk) zostaje DOKŁADNIE taka jak przed zmianą (patrz `projectile.top`).
  arenaScene: { width: '100%', position: 'relative' },

  vsRow: { flexDirection: 'row', gap: spacing[2], width: '100%' },
  // Kafelki straciły własne tło/ramkę (2026-09-02, user: "wypierdolić ramki że bosy stoją na
  // tym") — bossy/kotek stoją bezpośrednio na `arenaScene` powyżej. Kolejność dzieci w JSX
  // (2026-09-03, user: "zdrowie musi byc pod spodem") — portret jest teraz PIERWSZY, etykieta+
  // pasek HP DRUGIE — patrz `projectile.top` niżej, przeliczony z tej nowej kolejności.
  tile: { flex: 1, minWidth: 0, alignItems: 'center', padding: spacing[2], gap: 6 },
  tileLabel: { fontSize: 12.5, fontWeight: '800', color: '#fff', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  tileHpTrack: { width: '100%', height: 8, borderRadius: 4, backgroundColor: 'rgba(0,0,0,0.55)', overflow: 'hidden' },
  tileHpFill: { height: '100%', borderRadius: 4, backgroundColor: '#EF4444' },
  tileHpTxt: { fontSize: 10, fontWeight: '700', color: '#fff', textShadowColor: 'rgba(0,0,0,0.85)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  // Wysokość liczona z WIĘKSZEGO z dwóch portretów (kotek > boss, patrz `CAT_PORTRAIT_SIZE`)
  // — obie kolumny (Pupil/Boss) dzielą tę samą wysokość `tilePortrait`, żeby etykieta+HP pod
  // spodem wyrównywały się w tym samym rzędzie mimo różnych rozmiarów portretów.
  tilePortrait: { height: TILE_PORTRAIT_HEIGHT, width: '100%', justifyContent: 'center', alignItems: 'center' },
  // Box DOKŁADNIE rozmiaru danego sprite'a (nie całej `tilePortrait`) — patrz komentarz przy
  // użyciu w JSX: `GroundShadow` wewnątrz siada `bottom:0` względem TEGO boxa, więc cień
  // trafia pod faktyczne łapki sprite'a, nie pod pusty margines wspólnego, wyższego kafelka.
  // Transform = NIEZALEŻNY offset per element (2026-09-18, z Edytora układu walki) zamiast
  // dawnego wspólnego `SPRITE_GROUND_SHIFT`, patrz stałe `CAT_OFFSET_*`/`BOSS_OFFSET_*` u góry.
  spriteBoxCat: { width: CAT_PORTRAIT_SIZE, height: CAT_PORTRAIT_SIZE, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: CAT_OFFSET_X }, { translateY: CAT_OFFSET_Y }] },
  spriteBoxBoss: { width: PORTRAIT_SIZE, height: PORTRAIT_SIZE, alignItems: 'center', justifyContent: 'center', transform: [{ translateX: BOSS_OFFSET_X }, { translateY: BOSS_OFFSET_Y }] },
  // Bloki paska HP (2026-09-18) — WYDZIELONE z gołych `tileHpTrack`/`tileHpTxt` jako
  // bezpośrednich dzieci `tile`, żeby dało się im dać WŁASNY transform-offset (Edytor układu
  // walki, `catHpOffset*`/`bossHpOffset*`). `gap:6` = ten sam odstęp co dawniej dawał `tile.gap`
  // między tymi dwoma elementami — wizualnie zero różnicy przy offsecie {0,0}.
  tileHpBlockCat: { width: '100%', alignItems: 'center', gap: 6, transform: [{ translateX: CAT_HP_OFFSET_X }, { translateY: CAT_HP_OFFSET_Y }] },
  tileHpBlockBoss: { width: '100%', alignItems: 'center', gap: 6, transform: [{ translateX: BOSS_HP_OFFSET_X }, { translateY: BOSS_HP_OFFSET_Y }] },

  dmgFloat: { position: 'absolute', top: 4, fontSize: 19, fontWeight: '900' },
  // Stałe jasne kolory + text-shadow (2026-09-14, zamiast `c.text.muted`/`c.text.secondary`) —
  // ten sam powód co `headerTitle`/`doneTxt` wyżej: tekst teraz siedzi wprost na zdjęciu
  // lokacji, nie na płaskiej karcie motywu.
  bossTaunt: { fontSize: 12.5, color: 'rgba(255,255,255,0.85)', fontStyle: 'italic', marginTop: spacing[3], textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },
  motywTxt: { fontSize: 12.5, fontWeight: '700', color: '#fff', textAlign: 'center', marginTop: 4, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

  mechRow: { flexDirection: 'row', alignItems: 'center', gap: 5, marginTop: 4, justifyContent: 'center', flexWrap: 'wrap' },
  mechNote: { fontSize: 11.5, color: '#F4B740', fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  mechNoteHeal: { fontSize: 11.5, color: '#7DD3FC', fontWeight: '800', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },

  doneInlineTxt: { fontSize: 13, fontWeight: '800', color: '#2AC68F', textAlign: 'center', textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 3 },
  attackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF4444', borderRadius: radius.lg, paddingVertical: 16, width: '100%' },
  attackTxt: { fontSize: 17, fontWeight: '900', color: '#fff' },
  energyShortTxt: { fontSize: 12, fontWeight: '700', color: '#F87171', textAlign: 'center', marginTop: spacing[2] },
  skipFightTxt: { fontSize: 12, fontWeight: '700', color: 'rgba(255,255,255,0.75)', textAlign: 'center', textDecorationLine: 'underline' },
  lockBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[6], paddingHorizontal: spacing[3] },
  lockTxt: { flex: 1, fontSize: 12.5, color: 'rgba(255,255,255,0.85)', lineHeight: 17, textShadowColor: 'rgba(0,0,0,0.6)', textShadowOffset: { width: 0, height: 1 }, textShadowRadius: 4 },

  // Dokowany pasek akcji (2026-09-14, user: "przycisk walki od teraz będzie lewitował na
  // dole jak navbar") — ten sam wzorzec co TabBar.tsx: `position:absolute` nad resztą treści,
  // `pointerEvents:'box-none'` żeby przezroczyste marginesy przepuszczały dotyk do sceny za
  // nimi (tu akurat nieużywane bo pasek jest wąski, ale zachowuje spójność z tamtym wzorcem),
  // bottom scrim żeby content płynnie "znikał" pod spodem zamiast twardo się urywać.
  floatingBar: { position: 'absolute', left: 0, right: 0, bottom: 0, paddingHorizontal: spacing[4], paddingTop: spacing[3] },
  floatingBarScrim: { position: 'absolute', left: 0, right: 0, bottom: 0 },
  floatingBarRow: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  floatingBarDone: { alignItems: 'center', justifyContent: 'center', paddingVertical: spacing[2] },

  // Mini popup "pupil w trakcie podróży" (2026-08-20) — ta sama karta-na-przyciemnionym-tle
  // stylistyka co `ConfirmDialog` (mały wyśrodkowany box, nie pełny ekran).
  missionAwayOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.72)', alignItems: 'center', justifyContent: 'center', paddingHorizontal: spacing[5] },
  missionAwayCard: { width: '100%', maxWidth: 360, backgroundColor: c.bg.secondary, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4], gap: spacing[2], alignItems: 'center' },
  missionAwayTitle: { fontSize: 16, fontWeight: '800', color: c.text.primary, marginTop: 2 },
  missionAwayDest: { fontSize: 13, fontWeight: '700', color: c.text.secondary, marginTop: -4 },
  missionAwayBarTrack: { width: '100%', height: 10, borderRadius: 5, backgroundColor: c.bg.elevated, overflow: 'hidden', marginTop: spacing[2] },
  missionAwayBarFill: { height: '100%', borderRadius: 5, backgroundColor: '#38BDF8' },
  missionAwayTimer: { fontSize: 12, fontWeight: '700', color: c.text.muted, marginTop: -2 },
  missionAwayBtnRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[2], width: '100%' },
  missionAwayBackBtn: { alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, backgroundColor: c.bg.card },
  missionAwayBackTxt: { fontSize: 13, fontWeight: '700', color: c.text.secondary },
  missionAwayCancelBtn: { alignItems: 'center', justifyContent: 'center', height: 46, borderRadius: radius.lg, backgroundColor: '#EF4444' },
  missionAwayCancelTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },

  vBackdrop: { flex: 1, alignItems: 'center', justifyContent: 'center', backgroundColor: 'rgba(8,8,16,0.94)', paddingHorizontal: 32 },
  vCenter: { alignItems: 'center' },
  vKicker: { fontSize: 14, fontWeight: '900', letterSpacing: 3, color: '#FDE047', marginBottom: 10 },
  vName: { fontSize: 20, fontWeight: '900', color: '#fff', marginTop: 6, textAlign: 'center' },
  vDefeatSub: { fontSize: 13, color: 'rgba(255,255,255,0.6)', marginTop: 10, textAlign: 'center', maxWidth: 260 },
  vLoot: { alignItems: 'center', backgroundColor: 'rgba(255,255,255,0.1)', borderRadius: radius.lg, paddingVertical: spacing[3], paddingHorizontal: spacing[5], marginTop: spacing[4] },
  vLootName: { fontSize: 15, fontWeight: '800', color: '#fff', marginTop: 4 },
  vLootDesc: { fontSize: 12, color: '#2AC68F', fontWeight: '700', marginTop: 1 },
  vItemDrop: { fontSize: 13, fontWeight: '800', color: '#FDE047', marginTop: spacing[2] },
  vRewardRow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: spacing[4] },
  vReward: { fontSize: 14, fontWeight: '800', color: '#FDE047' },
  vHint: { position: 'absolute', bottom: 48, color: 'rgba(255,255,255,0.5)', fontSize: 12.5, fontWeight: '600' },

  clawFx: { position: 'absolute', width: 150, height: 150, alignItems: 'center', justifyContent: 'center' },
  // top = środek portretu w pionie: `tile.padding-top + tilePortrait.height/2 - połowa ikony
  // pocisku (28px/2=14) + przesunięcie sprite'ów w dół`. Policzone z NAZWANYCH stałych
  // (2026-09-18), nie ręcznie przeliczony magiczny numerek jak dawniej (`91 +
  // SPRITE_GROUND_SHIFT`, historia w komentarzu wcześniejszej wersji) — ten wzór był już raz
  // pominięty przy zmianie PORTRAIT_SIZE w TEJ SAMEJ zmianie (patrz `TILE_PORTRAIT_HEIGHT` u
  // góry pliku), więc teraz obie zależności czytają jedną definicję zamiast dwóch kopii do
  // ręcznej synchronizacji.
  projectile: { position: 'absolute', top: spacing[2] + TILE_PORTRAIT_HEIGHT / 2 - 14 + SPRITE_OFFSET_Y_AVG, width: 28, height: 28, alignItems: 'center', justifyContent: 'center' },
}));
