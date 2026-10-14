import { useCallback, useEffect, useMemo, useState } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { View, Text, StyleSheet, Pressable, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Zap, Swords, Trophy } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import BossArt from '@/components/bosses/BossArt';
import CampaignMap from '@/components/bosses/CampaignMap';
import PupilNavbar from '@/components/pet/PupilNavbar';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { BOSSES, bossBonuses, dailyAttempts, eventDailyAttempts, fmtEnergyCountdown } from '@/utils/bosses';
import { gearCombatBonuses, gearAtkFlat } from '@/utils/gear';
import { raidForWeek, raidHpFor, RAID_ENERGY_COST } from '@/utils/raid';
import { madCandidate, madBossFor, MAD_UNLOCK_LEVEL } from '@/utils/madBosses';
import { currentEventBoss, eventPeriodKey, eventHpFor, eventDaysLeft, menaceHpFor } from '@/utils/seasonalEvents';
import { monthlyWorkHours, monthlySweetsSpend, thisMonthVsAvg } from '@/utils/menaceStats';
import { weekKeyOf } from '@/utils/quests';
import { useExpensesStore } from '@/store/expensesStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useWorkStore } from '@/store/workStore';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// kolor aury bossa wg jego słabości (arty/klimat)
const WEAK_COLOR: Record<string, string> = {
  steps: '#46B0DE', sweetless: '#F472B6', habits: '#2AC68F', mood: '#A78BFA', sleep: '#5B7BE3', water: '#38BDF8',
};

// Czerwona pula (event+raid) NIE regeneruje się w czasie rzeczywistym jak kampania — to
// płaski, dzienny grant (`syncEventEnergy`, patrz petStore.ts), więc "kolejny punkt" realnie
// przychodzi o północy, nie po X godzinach jak `energyRegenAt`. Ten sam `fmtEnergyCountdown`
// format, tylko cel = najbliższa lokalna północ zamiast zapisanego timestampu regeneracji.
function nextLocalMidnightIso(): string {
  const d = new Date();
  d.setHours(24, 0, 0, 0);
  return d.toISOString();
}

// Zakładka Bossy — PRZEBUDOWA OD ZERA (2026-10-14, patrz obszerny komentarz w
// CampaignMap.tsx) — user: "zrob caloekranowa te mapę cała zakładka bossow niech bedzie
// miała mapę... te bosy evetowe muszą byc w kafelkach mniejsze jak w grach zeby po
// kliknięciu sie pokazywalo zeby nie zasłaniały mapy... wywalmy odznaki z tej zakładki".
// Trzy zmiany względem poprzedniej wersji:
// 1. Mapa (CampaignMap) jest teraz PEŁNOEKRANOWA — `{flex:1}` zamiast kafla w przewijanej
//    stronie, przełącznik Kampania/MAD i kompaktowe kafle raid/event PŁYWAJĄ nad nią
//    (`position:absolute`), nie zajmują własnego miejsca w layoucie.
// 2. Raid/wydarzenie — dawne zawsze-widoczne "mini-karty" (portret+pasek+WALCZ, blokujące
//    górę mapy) zastąpione MAŁYMI kafelkami-ikonami (sam portret + odznaka liczby medali +
//    kropka "gotowe"); tap otwiera wyśrodkowany popup z pełną treścią (dokładnie ta sama
//    informacja co dawna mini-karta, tylko na żądanie, nie zasłaniając mapy na stałe).
// 3. Sekcje "Medale raidów"/"Medale wydarzeń" (ściana ikon pod mapą) USUNIĘTE CAŁKOWICIE —
//    user: "sa bez sensu i zle wyglądają" — licznik medali ZOSTAJE jako mała odznaka na
//    kompaktowym kaflu (powyżej), reszta (sama ściana ikon) skasowana wraz z martwym
//    importem `raidIcon`/`eventIcon`/`eventBossFromKey` (używanymi WYŁĄCZNIE tam).
export default function Bosses() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  // useShallow (2026-09-20, audyt logika/optymalizacja runda 3) — goły `usePetStore()` bez
  // selektora subskrybował CAŁY store pupila (~50+ pól: gear, potki, dayClaims, customizacja
  // kotka...), re-renderując ten ekran na każdą zmianę gdziekolwiek, nie tylko te 20 pól
  // faktycznie użytych. Ten sam wzorzec już naprawiony w `pet.tsx`/`boss-fight.tsx`/
  // `pet-shop.tsx`/`usePetQuests.ts` — `bosses.tsx` (siostrzany ekran do `boss-fight.tsx`)
  // został przeoczony przy tamtych audytach.
  const {
    xp, energy, energyRegenAt, eventEnergy, ownedItems, defeatedBosses, syncEnergyRegen, syncEventEnergy,
    raidWeek, raidHp, raidMaxHp: raidMaxHpBanked, raidWon, raidEnsure, eventWon, defeatedMadBosses, atkStatBonus,
    menaceId, menaceHp, menaceMaxHp: menaceMaxHpBanked, menaceEnsure, equippedGear, ownedGear,
  } = usePetStore(useShallow((s) => ({
    xp: s.xp, energy: s.energy, energyRegenAt: s.energyRegenAt, eventEnergy: s.eventEnergy,
    ownedItems: s.ownedItems, defeatedBosses: s.defeatedBosses, syncEnergyRegen: s.syncEnergyRegen,
    syncEventEnergy: s.syncEventEnergy, raidWeek: s.raidWeek, raidHp: s.raidHp, raidMaxHp: s.raidMaxHp,
    raidWon: s.raidWon, raidEnsure: s.raidEnsure, eventWon: s.eventWon, defeatedMadBosses: s.defeatedMadBosses,
    atkStatBonus: s.atkStatBonus, menaceId: s.menaceId, menaceHp: s.menaceHp, menaceMaxHp: s.menaceMaxHp, menaceEnsure: s.menaceEnsure,
    equippedGear: s.equippedGear, ownedGear: s.ownedGear,
  })));
  // Selektor pojedynczego pola (2026-09-20, audyt logika/optymalizacja) — goły
  // `useExpensesStore()` subskrybował cały store (filters/isLoading/pendingSync...) na
  // ekranie, który już wcześniej w tej sesji dostał ten sam fix dla usePetStore.
  const expenses = useExpensesStore((st) => st.expenses);
  // Ten sam fix co `expenses` wyżej (2026-10-12, audyt optymalizacji runda 4) — ten plik
  // dostał już raz przejście po usePetStore/useExpensesStore (runda 3), ale przeoczyło te
  // dwa gołe wywołania obok: `calendarStore` trzyma też `tasks`/`selectedDate`/`isLoading`,
  // `workStore` też `shifts`/`isLoading` — ekran re-renderował się na KAŻDĄ ich zmianę.
  const { events, gcalEvents } = useCalendarStore(useShallow((s) => ({ events: s.events, gcalEvents: s.gcalEvents })));
  const workSettings = useWorkStore((s) => s.settings);

  // Krok 8 — gear dokłada się do bonusów z lootu (te same wzory co boss-fight.tsx/pet.tsx),
  // energyMult stąd zasila syncEventEnergy niżej.
  const bonuses = useMemo(() => {
    const loot = bossBonuses(ownedItems);
    const gear = gearCombatBonuses(equippedGear, ownedGear);
    return { atk: loot.atk + gear.atk, dodge: loot.dodge + gear.dodge, crit: loot.crit + gear.crit, energyMult: loot.energyMult + gear.energyMult };
  }, [ownedItems, equippedGear, ownedGear]);
  // "WSZĘDZIE gdzie liczy się realna moc ataku... musi wołać effectiveAtkStat, nie goły
  // atkStatBonus" (patrz ten sam komentarz w boss-fight.tsx) — używane niżej do eventHpFor,
  // żeby wyświetlany eventMaxHp zgadzał się z tym co realnie liczy walka.
  const effectiveAtkStat = useMemo(() => atkStatBonus + gearAtkFlat(equippedGear, ownedGear), [atkStatBonus, equippedGear, ownedGear]);
  const level = useMemo(() => levelFromXp(xp).level, [xp]);
  // Sufit banku (2026-08-19) — TA SAMA formuła co `syncEnergyRegen()` w petStore.ts, żeby
  // pigułka energii i realny cap nigdy nie pokazywały różnych liczb (user: "mam napisane 4
  // a maksymalnie ładuje mi się do 2").
  const campaignEnergyMax = dailyAttempts(bonuses.energyMult);
  // Sufit eventowej puli (2026-08-21, user: "widać w prawym górnym licznik... ile na ile mam
  // np 0/5") — TA SAMA formuła co `syncEventEnergy` w `reload()` niżej, jedna prawda dla
  // pigułki w headerze. PRZEBUDOWANE na `level` zamiast `bonuses.energyMult` (2026-09-12,
  // patrz obszerny komentarz przy `eventDailyAttempts` w bosses.ts) — pula teraz per poziom
  // pupila, nie inwestycja w łup.
  const eventEnergyMax = eventDailyAttempts(level);

  // Przełącznik Kampania/MAD (2026-08-21) — pływa nad mapą (patrz JSX), nie stoi w osobnym
  // wierszu layoutu. Domyślna zakładka zależy od postępu (2026-09-19, user: "jak pokonałem
  // wszystkie bossy kampanii to główna zakładka musi być wtedy madbossy") — z kampanią w
  // 100% skończoną (`current` niżej == null) domyślny widok to MAD. `null` = brak ręcznego
  // wyboru w tej sesji ekranu → domyślna zakładka liczona z postępu; po ręcznym kliknięciu
  // przełącznika override trzyma wybór usera.
  const [bossViewOverride, setBossViewOverride] = useState<'campaign' | 'mad' | null>(null);
  const [detail, setDetail] = useState<'raid' | 'event' | null>(null);

  // Energia kampanii/MAD regeneruje się w czasie rzeczywistym (2026-08-18, patrz
  // ENERGY_REGEN_HOURS w bosses.ts) — `syncEnergyRegen()` dogania tyknięcia
  // które minęły offline, wołane tak samo jak stary flat sync przy każdym powrocie na ekran.
  // Wydarzenie ZOSTAJE przy flat dziennym modelu (`eventDailyAttempts`, od 2026-09-12
  // skalowane POZIOMEM pupila zamiast energyMult z łupu — patrz komentarz w bosses.ts) — ta
  // zmiana dotyczy TYLKO energii kampanii. Raid (2026-08-22, patrz komentarz przy raidWeek w
  // petStore.ts) zużywa TĘ SAMĄ pulę co wydarzenie — bez własnego sync, jeden
  // `syncEventEnergy()` zasila oba.
  const reload = useCallback(() => {
    syncEnergyRegen();
    syncEventEnergy(eventDailyAttempts(level), 0, eventEnergyMax);
    raidEnsure(weekKeyOf(), raidHpFor(level, weekKeyOf()));
    // Nemesis (2026-08-18): trwały bank jak raid — ensure na KAŻDY reload (no-op jeśli id się
    // nie zmienił, patrz menaceEnsure w petStore.ts). Liczone TU niezależnie od `eventBoss`
    // render-owego niżej (ten sam duplikat co raid — czyste funkcje z bosses.ts, nie ma
    // problemu z nieaktualnym closure przy useCallback, patrz komentarz historyczny).
    const now = new Date();
    const workByMonth = monthlyWorkHours([...events, ...gcalEvents], workSettings, now);
    const sweetsByMonth = monthlySweetsSpend(expenses, now);
    const workVsAvg = thisMonthVsAvg(workByMonth, now);
    const sweetsVsAvg = thisMonthVsAvg(sweetsByMonth, now);
    const eb = currentEventBoss(now, {
      workHoursThisMonth: workVsAvg.thisMonth, workHoursAvg: workVsAvg.avg,
      sweetsThisMonth: sweetsVsAvg.thisMonth, sweetsAvg: sweetsVsAvg.avg,
    });
    if (eb && eb.kind === 'menace') menaceEnsure(eb.id, menaceHpFor(level));
  }, [syncEnergyRegen, syncEventEnergy, level, eventEnergyMax, raidEnsure, menaceEnsure, events, gcalEvents, workSettings, expenses]);
  useFocusEffect(reload);
  // useFocusEffect łapie tylko nawigację, nie powrót z tła (ekrany zostają zamontowane) —
  // ten sam fix co pet.tsx (2026-08-12/13, patrz memory focus_vs_appstate_refresh.md). Tu
  // szczególnie ważne: energia/raid-bank potrafiły zostać nieodświeżone po nocy.
  useEffect(() => {
    const sub = AppState.addEventListener('change', s => { if (s === 'active') reload(); });
    return () => sub.remove();
  }, [reload]);

  // sequential campaign: current = pierwszy niepokonany. HP resetuje się co próbę
  // (karczma S&F) — pasek nie ma sensu tutaj, tylko na ekranie walki. Odblokowanie = samo
  // pokonanie poprzedniego, NIE poziom (2026-08-17, user: "odblokowanie jest po pokonaniu
  // wcześniejszego" — dodatkowy próg poziomu blokował testowanie kolejnych bossów mimo że
  // kolejność i tak jest już wymuszona przez `current`, poziom nic ekstra nie chronił poza
  // spowolnieniem testów). `unlockLevel` na Boss zostaje w danych (referencyjny poziom pod
  // jaki wyważono hp/atak tego bossa), tylko przestał być bramką — stąd WALCZ! niżej jest
  // teraz bezwarunkowe, gdy tylko `current` istnieje.
  const current = BOSSES.find(b => !defeatedBosses.includes(b.id)) ?? null;
  // Patrz komentarz przy `bossViewOverride` wyżej — bez ręcznego override domyślnie "mad"
  // gdy kampania skończona (`!current`), inaczej "campaign".
  const bossView = bossViewOverride ?? (current ? 'campaign' : 'mad');
  // Nawigacja do walki kampanii — WYCIĄGNIĘTA do `useCallback` (2026-10-12, mapa kampanii)
  // specjalnie po to, żeby `CampaignMap`'s `memo()` miało sens: bez stabilnej referencji tu
  // inline `() => router.push(...)` tworzyłby nowe closure na KAŻDY render tego ekranu
  // (odliczanie energii re-renderuje go często), łamiąc porównanie propsów memo.
  const goFight = useCallback(() => router.push('/boss-fight' as any), []);
  // Mapa MAD (2026-10-13) — ten sam wzorzec co `goFight`/CampaignMap wyżej, osobny stabilny
  // callback żeby `CampaignMap`'s memo() łapało "nic się nie zmieniło" też w trybie MAD.
  const goFightMad = useCallback(() => router.push('/boss-fight?kind=mad' as any), []);

  // ── MAD (2026-08-15) — druga, silniejsza fala kampanii dla lvl 50+, TYLKO po pokonaniu
  // normalnej wersji danego bossa (madBosses.ts). Ten sam "aktualny cel po kolejności"
  // wzorzec co `current` wyżej.
  const madBase = madCandidate(defeatedBosses, defeatedMadBosses);
  const madBoss = madBase ? madBossFor(madBase) : null;
  const madUnlocked = level >= MAD_UNLOCK_LEVEL && !!madBase;
  // Mapa MAD (2026-10-13, user: "mad bosy to tez pokonane i mapa zmienia kolor na lekko
  // czerwony i te bosy pokonane sa do kliknięcia wtedy jako ich mad wersje") — reużywa
  // CAMPAIGNMAP z `variant="mad"` zamiast osobnego komponentu: MAD dzieli DOKŁADNIE tę samą
  // sekwencyjną "aktualny/pokonany/zablokowany po indeksie" logikę co kampania (patrz
  // komentarz przy `variant` w CampaignMap.tsx), tylko tablica bossów to MAD-owe warianty
  // (`madBossFor`, przeliczone hp/nagrody) zamiast gołych `BOSSES`. `useMemo` z pustymi
  // deps — `madBossFor` jest czystą funkcją nad STAŁĄ `BOSSES`, wynik nigdy się nie zmienia
  // między renderami tego ekranu, a CampaignMap jest `memo()`-owany więc stabilna referencja
  // tej tablicy ma znaczenie (patrz komentarz na dole CampaignMap.tsx).
  const madBosses = useMemo(() => BOSSES.map(b => madBossFor(b)), []);

  // ── raid tygodniowy ──
  const weekKey = weekKeyOf();
  const raid = raidForWeek(weekKey);
  // Zamrożone na start tygodnia (`raidMaxHpBanked`, patrz komentarz przy `raidMaxHp` w
  // petStore.ts) zamiast liczonego na żywo z aktualnego poziomu — level-up W TRAKCIE tygodnia
  // raidu nie ma już cofać paska/%. Fallback na żywe liczenie TYLKO zanim `raidEnsure` w ogóle
  // zbankowało ten tydzień (ten sam wzorzec co `raidRemaining` niżej).
  const raidMaxHp = raidWeek === weekKey ? raidMaxHpBanked : raidHpFor(level, weekKey);
  const raidRemaining = raidWeek === weekKey ? raidHp : raidMaxHp;
  const raidDone = raidWon.includes(weekKey);
  const raidUnlocked = level >= 3;

  // ── wydarzenie (sezonowe święto LUB „nemesis miesiąca"). Sezonowy zawsze wygrywa. ──
  const now = new Date();
  const workByMonth = monthlyWorkHours([...events, ...gcalEvents], workSettings, now);
  const sweetsByMonth = monthlySweetsSpend(expenses, now);
  const workVsAvg = thisMonthVsAvg(workByMonth, now);
  const sweetsVsAvg = thisMonthVsAvg(sweetsByMonth, now);
  const menaceCtx = {
    workHoursThisMonth: workVsAvg.thisMonth, workHoursAvg: workVsAvg.avg,
    sweetsThisMonth: sweetsVsAvg.thisMonth, sweetsAvg: sweetsVsAvg.avg,
  };
  const eventBoss = currentEventBoss(now, menaceCtx);
  const eventKey = eventBoss ? eventPeriodKey(eventBoss, now) : null;
  const isMenace = eventBoss?.kind === 'menace';
  // Sezonowe: HP resetuje się co próbę (jak kampania) — nie ma trwałego banku, patrz
  // eventAsBoss w seasonalEvents.ts. Nemesis (2026-08-18): TRWAŁY bank, lustrzane raidMaxHp/
  // raidRemaining wyżej — patrz menaceHpFor/menaceAsBoss tam. ZAMROŻONY na `menaceMaxHpBanked`
  // (2026-10-04, audyt walki, ten sam fix co raidMaxHp) — bez tego level-up W TRAKCIE klepania
  // tego nemesis cofał pasek/% tu identycznie jak w boss-fight.tsx przed fixem.
  const eventMaxHp = eventHpFor(effectiveAtkStat, level, bonuses);
  const menaceMaxHp = isMenace ? (menaceId === eventBoss!.id ? menaceMaxHpBanked : menaceHpFor(level)) : 0;
  const menaceRemaining = isMenace ? (menaceId === eventBoss!.id ? menaceHp : menaceMaxHp) : 0;
  const eventDone = eventKey ? eventWon.includes(eventKey) : false;
  const eventUnlocked = level >= 2;
  // Odliczanie (2026-08-16, user: "żeby realnie móc go wygrać") — TYLKO sezonowe mają jeszcze
  // FLAT próbę dzienną/termin. Nemesis (2026-08-18) nie ma już końca ani limitu prób.
  const eventDaysLeftN = eventBoss && !isMenace ? eventDaysLeft(eventBoss, now) : 0;

  const raidReady = !raidDone && raidUnlocked;
  const eventReady = !!eventBoss && !eventDone && eventUnlocked;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Bossy</Text>
        {/* Dwie NIEZALEŻNE pule energii w prawym górnym rogu, W KOLUMNIE (2026-08-19, user:
            "energia eventowych ma być czerwona i wspólna dla obu w prawym górnym, i pod nią
            energia zwykła niebieska pod kampanię"). Sufit dokłada się z TYCH SAMYCH formuł co
            reszta ekranu (`campaignEnergyMax`/`eventEnergyMax` wyżej) — jedna prawda, nie
            druga zgadywana liczba. Czerwona liczy do najbliższej lokalnej północy — to płaski
            dzienny grant, nie regenerujący się w czasie bank jak kampania. */}
        <View style={s.energyPillCol}>
          {level >= 2 && (
            <View style={s.energyRow}>
              {eventEnergy < eventEnergyMax && (
                <Text style={[s.energyCountdown, { color: '#F87171' }]} numberOfLines={1}>za {fmtEnergyCountdown(nextLocalMidnightIso())}</Text>
              )}
              <View style={[s.energyPill, { backgroundColor: '#F8717118', borderColor: '#F8717140' }]}>
                <Zap size={13} color="#F87171" /><Text style={[s.energyTxt, { color: '#F87171' }]}>{eventEnergy}/{eventEnergyMax}</Text>
              </View>
            </View>
          )}
          <View style={s.energyRow}>
            {energy < campaignEnergyMax && energyRegenAt && (
              <Text style={s.energyCountdown} numberOfLines={1}>za {fmtEnergyCountdown(energyRegenAt)}</Text>
            )}
            <View style={s.energyPill}><Zap size={13} color="#38BDF8" /><Text style={s.energyTxt}>{energy}/{campaignEnergyMax}</Text></View>
          </View>
        </View>
      </View>

      {/* ── Mapa, pełnoekranowa (`{flex:1}`) — przełącznik Kampania/MAD i kompaktowe kafle
          raid/wydarzenie pływają NAD nią jako position:absolute, nie zajmują osobnego
          miejsca w layoucie (user: "zrob caloekranowa te mapę... zeby nie zasłaniały
          mapy"). ── */}
      <View style={{ flex: 1 }}>
        {bossView === 'campaign' && (
          current ? (
            <CampaignMap
              bosses={BOSSES} currentId={current.id} onPressCurrent={goFight}
              energy={energy} energyMax={campaignEnergyMax} energyRegenAt={energyRegenAt}
            />
          ) : (
            <>
              <CampaignMap
                bosses={BOSSES} currentId={null} onPressCurrent={goFight}
                energy={energy} energyMax={campaignEnergyMax} energyRegenAt={energyRegenAt}
              />
              <View style={s.doneBanner} pointerEvents="none">
                <Swords size={14} color="#fff" />
                <Text style={s.doneBannerTxt}>Wszyscy bossowie pokonani! Kolejni wkrótce.</Text>
              </View>
            </>
          )
        )}

        {bossView === 'mad' && (
          madBoss ? (
            <CampaignMap
              bosses={madBosses} currentId={madBoss.id} onPressCurrent={goFightMad}
              energy={energy} energyMax={campaignEnergyMax} energyRegenAt={energyRegenAt}
              variant="mad" locked={!madUnlocked}
              lockMessage={`Odblokujesz na poziomie ${MAD_UNLOCK_LEVEL} (masz ${level}).`}
            />
          ) : (
            <View style={s.doneCenter}>
              <Swords size={30} color={c.text.muted} />
              <Text style={s.doneCenterTxt}>Pokonaj (kolejnego) bossa kampanii, żeby odblokować jego MAD wersję.</Text>
            </View>
          )
        )}

        {/* Przełącznik Kampania/MAD — pływa nad mapą. */}
        <View style={s.modeToggle}>
          <PressableScale onPress={() => { haptic.tap(); setBossViewOverride('campaign'); }} style={{ flex: 1 }}>
            <View style={[s.modeBtn, bossView === 'campaign' && s.modeBtnActive]}>
              <Text style={[s.modeBtnTxt, bossView === 'campaign' && s.modeBtnTxtActive]}>Kampania</Text>
            </View>
          </PressableScale>
          <PressableScale onPress={() => { haptic.tap(); setBossViewOverride('mad'); }} style={{ flex: 1 }}>
            <View style={[s.modeBtn, bossView === 'mad' && s.modeBtnActive]}>
              <Text style={[s.modeBtnTxt, bossView === 'mad' && s.modeBtnTxtActive]}>MAD bossy</Text>
            </View>
          </PressableScale>
        </View>

        {/* Raid + wydarzenie — kompaktowe kafle-ikony (user: "te bosy evetowe muszą byc w
            kafelkach mniejsze jak w grach zeby po kliknięciu sie pokazywalo zeby nie
            zasłaniały mapy"). Odznaka liczby medali w rogu, kropka "gotowe do walki" gdy
            odblokowane+nieukończone+jest energia. Tap → wyśrodkowany popup (`detail`) z
            pełną treścią, dokładnie tą samą co dawna zawsze-widoczna mini-karta. */}
        <View style={s.tileRow}>
          <PressableScale onPress={() => { haptic.tap(); setDetail('raid'); }} style={s.tile}>
            <BossArt id={raid.id} emoji={raid.emoji} size={34} powered />
            {raidWon.length > 0 && <View style={s.tileBadge}><Text style={s.tileBadgeTxt}>{raidWon.length}</Text></View>}
            {raidReady && eventEnergy >= RAID_ENERGY_COST && <View style={[s.tileReadyDot, { backgroundColor: '#F87171' }]} />}
          </PressableScale>
          {eventBoss && eventKey && (
            <PressableScale onPress={() => { haptic.tap(); setDetail('event'); }} style={s.tile}>
              <BossArt id={eventBoss.id} emoji={eventBoss.emoji} size={34} powered={isMenace} />
              {eventWon.length > 0 && <View style={s.tileBadge}><Text style={s.tileBadgeTxt}>{eventWon.length}</Text></View>}
              {eventReady && eventEnergy > 0 && <View style={[s.tileReadyDot, { backgroundColor: '#F87171' }]} />}
            </PressableScale>
          )}
        </View>
      </View>

      {/* Popup raid/wydarzenie — treść 1:1 ze starej zawsze-widocznej mini-karty, teraz na
          żądanie. */}
      {detail && (
        <View style={StyleSheet.absoluteFillObject} pointerEvents="box-none">
          <Pressable style={s.detailBackdrop} onPress={() => setDetail(null)} />
          {detail === 'raid' ? (
            <View style={s.detailCard}>
              <View style={s.miniHead}>
                <View style={s.miniKickerRow}>
                  <Text style={s.miniKicker}>RAID</Text>
                  <Trophy size={9} color={c.text.muted} />
                  <Text style={s.miniKicker}>{raidWon.length}</Text>
                </View>
                <View style={s.miniEnergyRow}>
                  <Zap size={10} color="#F87171" />
                  <Text style={[s.miniEnergy, { color: '#F87171' }]}>{eventEnergy}</Text>
                </View>
              </View>
              <View style={s.miniBody}>
                <BossArt id={raid.id} emoji={raid.emoji} size={48} powered />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.miniName} numberOfLines={1}>{raid.name}</Text>
                  <View style={s.miniHpTrack}><View style={[s.miniHpFill, { width: `${Math.round((raidDone ? 0 : raidRemaining) / raidMaxHp * 100)}%`, backgroundColor: WEAK_COLOR[raid.weakness] ?? '#888' }]} /></View>
                </View>
              </View>
              {raidDone ? (
                <Text style={s.miniDoneTxt}>Pokonany ✓ · nowy w pon.</Text>
              ) : raidUnlocked ? (
                <PressableScale onPress={() => { haptic.tap(); setDetail(null); router.push('/boss-fight?kind=raid' as any); }}>
                  {/* eventEnergy < RAID_ENERGY_COST (nie <= 0) — raid kosztuje 2, nie 1
                      (2026-08-25) — przycisk musi wyglądać na wyszarzony już przy 1 energii. */}
                  <View style={[s.miniBtn, eventEnergy < RAID_ENERGY_COST && { opacity: 0.5 }]}>
                    <Text style={s.miniBtnTxt}>WALCZ</Text>
                  </View>
                </PressableScale>
              ) : (
                <Text style={s.miniLockTxt}>Odblokuj: lvl 3</Text>
              )}
            </View>
          ) : (
            eventBoss && eventKey && (
              <View style={s.detailCard}>
                <View style={s.miniHead}>
                  <View style={s.miniKickerRow}>
                    <Text style={s.miniKicker} numberOfLines={1}>{isMenace ? 'NEMESIS' : 'WYDARZENIE'}</Text>
                    <Trophy size={9} color={c.text.muted} />
                    <Text style={s.miniKicker}>{eventWon.length}</Text>
                  </View>
                  {/* Nemesis dzieli prawdziwą `eventEnergy` z sezonowymi — pigułka pokazywana
                      zawsze, bez wyjątku dla menace. */}
                  <View style={s.miniEnergyRow}>
                    <Zap size={10} color="#F87171" />
                    <Text style={[s.miniEnergy, { color: '#F87171' }]}>{eventEnergy}</Text>
                  </View>
                </View>
                <View style={s.miniBody}>
                  <BossArt id={eventBoss.id} emoji={eventBoss.emoji} size={48} powered={isMenace} />
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.miniName} numberOfLines={1}>{eventBoss.name}</Text>
                    {isMenace ? (
                      // Trwały bank → pasek postępu (jak raid), nie statyczne "X HP".
                      <View style={s.miniHpTrack}><View style={[s.miniHpFill, { width: `${Math.round((eventDone ? 0 : menaceRemaining) / menaceMaxHp * 100)}%`, backgroundColor: WEAK_COLOR[eventBoss.weakness] ?? '#888' }]} /></View>
                    ) : (
                      <>
                        <Text style={s.miniSub} numberOfLines={1}>{eventMaxHp} HP · {eventBoss.weaknessLabel}</Text>
                        {!eventDone && (
                          <Text style={[s.miniCountdown, { color: eventDaysLeftN <= 1 ? '#F87171' : eventDaysLeftN <= 3 ? '#FBBF24' : c.text.muted }]} numberOfLines={1}>
                            {eventDaysLeftN <= 0 ? 'Kończy się dziś' : `Kończy się za ${eventDaysLeftN} ${eventDaysLeftN === 1 ? 'dzień' : 'dni'}`}
                          </Text>
                        )}
                      </>
                    )}
                  </View>
                </View>
                {eventDone ? (
                  <Text style={s.miniDoneTxt}>Pokonany ✓</Text>
                ) : eventUnlocked ? (
                  <PressableScale onPress={() => { haptic.tap(); setDetail(null); router.push('/boss-fight?kind=event' as any); }}>
                    <View style={[s.miniBtn, eventEnergy <= 0 && { opacity: 0.5 }]}>
                      <Text style={s.miniBtnTxt}>WALCZ</Text>
                    </View>
                  </PressableScale>
                ) : (
                  <Text style={s.miniLockTxt}>Odblokuj: lvl 2</Text>
                )}
              </View>
            )
          )}
        </View>
      )}

      <PupilNavbar current="bosses" />
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  energyPillCol: { flexDirection: 'column', alignItems: 'flex-end', gap: 4 },
  energyRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  energyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#38BDF818', borderRadius: radius.full, paddingHorizontal: 10, height: 30, borderWidth: 1, borderColor: '#38BDF840' },
  energyTxt: { fontSize: 13, fontWeight: '800', color: '#38BDF8' },
  energyCountdown: { fontSize: 9.5, fontWeight: '700', color: c.text.muted },

  // Pływające kontrolki NAD mapą (2026-10-14) — absolute w obrębie `{flex:1}` wrapperu mapy.
  modeToggle: {
    position: 'absolute', top: spacing[3], left: spacing[3], right: spacing[3],
    flexDirection: 'row', gap: spacing[1], backgroundColor: 'rgba(15,17,20,0.92)', borderRadius: radius.full,
    borderWidth: 1, borderColor: c.border.default, padding: 4,
  },
  modeBtn: { alignItems: 'center', justifyContent: 'center', paddingVertical: 9, borderRadius: radius.full, borderWidth: 1, borderColor: 'transparent' },
  modeBtnActive: { backgroundColor: '#38BDF81F', borderColor: '#38BDF855' },
  modeBtnTxt: { fontSize: 12.5, fontWeight: '800', color: c.text.muted },
  modeBtnTxtActive: { color: '#38BDF8' },

  doneBanner: {
    position: 'absolute', top: spacing[3] + 52, left: spacing[3], right: spacing[3],
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    backgroundColor: 'rgba(42,198,143,0.92)', borderRadius: radius.lg, paddingVertical: 10, paddingHorizontal: spacing[3],
  },
  doneBannerTxt: { fontSize: 12.5, fontWeight: '800', color: '#07160F', textAlign: 'center' },
  doneCenter: { flex: 1, alignItems: 'center', justifyContent: 'center', gap: spacing[3], paddingHorizontal: spacing[6] },
  doneCenterTxt: { fontSize: 13, color: c.text.muted, textAlign: 'center', maxWidth: 260 },

  tileRow: { position: 'absolute', right: spacing[3], bottom: spacing[3], gap: spacing[2] },
  tile: {
    width: 52, height: 52, borderRadius: radius.lg, backgroundColor: 'rgba(15,17,20,0.92)',
    borderWidth: 1, borderColor: c.border.default, alignItems: 'center', justifyContent: 'center',
  },
  tileBadge: {
    position: 'absolute', top: -5, left: -5, minWidth: 17, height: 17, borderRadius: 9, paddingHorizontal: 3,
    backgroundColor: '#FBBF24', alignItems: 'center', justifyContent: 'center',
  },
  tileBadgeTxt: { fontSize: 9.5, fontWeight: '900', color: '#0B0E1A' },
  tileReadyDot: { position: 'absolute', bottom: -3, right: -3, width: 12, height: 12, borderRadius: 6, borderWidth: 2, borderColor: '#0B0E1A' },

  detailBackdrop: { ...StyleSheet.absoluteFillObject, backgroundColor: 'rgba(0,0,0,0.5)' },
  detailCard: {
    position: 'absolute', left: spacing[4], right: spacing[4], top: '38%',
    backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default,
    padding: spacing[4], gap: 6,
    shadowColor: '#000', shadowOpacity: 0.5, shadowRadius: 16, shadowOffset: { width: 0, height: 8 }, elevation: 12,
  },
  miniHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  miniKickerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 0 },
  miniKicker: { fontSize: 10.5, fontWeight: '800', letterSpacing: 0.8, color: c.text.muted },
  miniEnergyRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  miniEnergy: { fontSize: 11.5, fontWeight: '800', color: '#38BDF8' },
  miniBody: { flexDirection: 'row', alignItems: 'center', gap: spacing[3], marginTop: 4 },
  miniName: { fontSize: 15, fontWeight: '800', color: c.text.primary },
  miniSub: { fontSize: 11.5, color: c.text.muted, marginTop: 2 },
  miniCountdown: { fontSize: 11, fontWeight: '800', marginTop: 2 },
  miniHpTrack: { width: '100%', height: 7, borderRadius: 4, backgroundColor: c.bg.elevated, overflow: 'hidden', marginTop: 5 },
  miniHpFill: { height: '100%', borderRadius: 4 },
  miniBtn: { alignItems: 'center', borderRadius: radius.md, paddingVertical: 12, backgroundColor: '#EF4444', marginTop: 4 },
  miniBtnTxt: { fontSize: 13.5, fontWeight: '800', color: '#fff' },
  miniDoneTxt: { fontSize: 12, fontWeight: '700', color: '#2AC68F', textAlign: 'center', marginTop: 4 },
  miniLockTxt: { fontSize: 12, color: c.text.muted, textAlign: 'center', marginTop: 4 },
}));
