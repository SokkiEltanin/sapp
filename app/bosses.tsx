import { useCallback, useEffect, useMemo } from 'react';
import { View, Text, StyleSheet, ScrollView, AppState } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useFocusEffect } from 'expo-router';
import { ChevronLeft, Zap, Lock, Check, Swords, Trophy } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import BossArt from '@/components/bosses/BossArt';
import PupilNavbar from '@/components/pet/PupilNavbar';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { BOSSES, bossBonuses, dailyAttempts, eventDailyAttempts, mysteryBossName, ENERGY_MAX } from '@/utils/bosses';
import { raidForWeek, raidHpFor } from '@/utils/raid';
import { madCandidate, madBossFor, MAD_UNLOCK_LEVEL } from '@/utils/madBosses';
import { currentEventBoss, eventPeriodKey, eventHpFor, eventBossFromKey, eventDaysLeft, menaceHpFor } from '@/utils/seasonalEvents';
import { raidIcon, eventIcon } from '@/utils/bossUiIcons';
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

// Odliczanie do kolejnego punktu energii kampanii (2026-08-18, patrz ENERGY_MAX/
// ENERGY_REGEN_HOURS w bosses.ts) — statyczne w chwili renderu (jak fmtMissionDuration w
// pet.tsx), nie żywy tiker; wystarczy bo user i tak wraca na ten ekran co jakiś czas
// (useFocusEffect już odświeża `reload()` przy każdym powrocie).
function fmtEnergyCountdown(regenAtIso: string): string {
  const ms = Math.max(0, new Date(regenAtIso).getTime() - Date.now());
  const totalMin = Math.ceil(ms / 60000);
  const h = Math.floor(totalMin / 60), m = totalMin % 60;
  return h > 0 ? `${h}h ${m}min` : `${m}min`;
}

// Ekran-LISTA (S&F-style): kampania + raid + wydarzenie, WYŁĄCZNIE przegląd. Klik "WALCZ"
// na KAŻDYM z trzech nawiguje do app/boss-fight.tsx (kampania bez parametru, raid/wydarzenie
// przez ?kind=raid|event) — 2026-08-10, user: "przyjrzyj się teraz eventowym bossom żeby
// były tak samo jak te nasze, też wchodzę z nimi do walki". Wcześniej raid/wydarzenie były
// jednorazowym klikiem TU NA MIEJSCU (bez nawigacji, bez rundowej animacji) — ten podział
// zniknął, cała trójka dzieli teraz jedną arenę. Mini-karty tutaj zostają jako KOMPAKTOWY
// PODGLĄD (nazwa/HP/portret), nie miejsce walki.
export default function Bosses() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const {
    xp, energy, energyRegenAt, raidEnergy, eventEnergy, ownedItems, defeatedBosses, syncEnergyRegen, syncRaidEnergy, syncEventEnergy,
    raidWeek, raidHp, raidWon, raidEnsure, eventWon, defeatedMadBosses, atkStatBonus,
    menaceId, menaceHp, menaceEnsure,
  } = usePetStore();
  const { expenses } = useExpensesStore();
  const { events, gcalEvents } = useCalendarStore();
  const { settings: workSettings } = useWorkStore();

  const bonuses = useMemo(() => bossBonuses(ownedItems), [ownedItems]);
  const level = useMemo(() => levelFromXp(xp).level, [xp]);

  // Energia kampanii/MAD regeneruje się w czasie rzeczywistym (2026-08-18, patrz
  // ENERGY_MAX/ENERGY_REGEN_HOURS w bosses.ts) — `syncEnergyRegen()` dogania tyknięcia
  // które minęły offline, wołane tak samo jak stary flat sync przy każdym powrocie na ekran.
  // Raid/wydarzenie ZOSTAJĄ przy starym flat dziennym modelu (`dailyAttempts`/
  // `eventDailyAttempts`, skalowane energyMult z łupu) — ta zmiana dotyczy TYLKO energii
  // kampanii, nie ich.
  const reload = useCallback(() => {
    syncEnergyRegen();
    syncRaidEnergy(dailyAttempts(bonuses.energyMult), 0);
    syncEventEnergy(eventDailyAttempts(bonuses.energyMult), 0);
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
  }, [bonuses.energyMult, syncEnergyRegen, syncRaidEnergy, syncEventEnergy, level, raidEnsure, menaceEnsure, events, gcalEvents, workSettings, expenses]);
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

  // ── MAD (2026-08-15) — druga, silniejsza fala kampanii dla lvl 50+, TYLKO po pokonaniu
  // normalnej wersji danego bossa (madBosses.ts). Ten sam "aktualny cel po kolejności"
  // wzorzec co `current` wyżej.
  const madBase = madCandidate(defeatedBosses, defeatedMadBosses);
  const madBoss = madBase ? madBossFor(madBase, atkStatBonus, level, bonuses) : null;
  const madUnlocked = level >= MAD_UNLOCK_LEVEL && !!madBase;

  // ── raid tygodniowy ──
  const weekKey = weekKeyOf();
  const raid = raidForWeek(weekKey);
  const raidMaxHp = raidHpFor(level, weekKey);
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
  // raidRemaining wyżej — patrz menaceHpFor/menaceAsBoss tam.
  const eventMaxHp = eventHpFor(level);
  const menaceMaxHp = isMenace ? menaceHpFor(level) : 0;
  const menaceRemaining = isMenace ? (menaceId === eventBoss!.id ? menaceHp : menaceMaxHp) : 0;
  const eventDone = eventKey ? eventWon.includes(eventKey) : false;
  const eventUnlocked = level >= 2;
  // Odliczanie (2026-08-16, user: "żeby realnie móc go wygrać") — TYLKO sezonowe mają jeszcze
  // FLAT próbę dzienną/termin. Nemesis (2026-08-18) nie ma już końca ani limitu prób.
  const eventDaysLeftN = eventBoss && !isMenace ? eventDaysLeft(eventBoss, now) : 0;

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Bossy</Text>
        {/* Dwie NIEZALEŻNE pule energii w prawym górnym rogu, W KOLUMNIE (2026-08-19, user:
            "energia eventowych ma być czerwona i wspólna dla obu w prawym górnym, i pod nią
            energia zwykła niebieska pod kampanię") — czerwona (wydarzenia, `eventEnergy`,
            wspólna dla wszystkich sezonowych, nemesis jej nie zużywa) NA GÓRZE, niebieska
            (kampania/MAD, `energy`) POD NIĄ. Czerwona pokazywana dopiero od odblokowania
            eventów (level>=2, ten sam próg co `eventUnlocked` niżej) — przed tym nie ma czego
            pokazywać. */}
        <View style={s.energyPillCol}>
          {level >= 2 && (
            <View style={[s.energyPill, { backgroundColor: '#F8717118', borderColor: '#F8717140' }]}>
              <Zap size={13} color="#F87171" /><Text style={[s.energyTxt, { color: '#F87171' }]}>{eventEnergy}</Text>
            </View>
          )}
          <View style={s.energyPill}><Zap size={13} color="#38BDF8" /><Text style={s.energyTxt}>{energy}</Text></View>
        </View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {/* ── RAID + WYDARZENIE: kompaktowy podgląd, WALCZ nawiguje do boss-fight ── */}
        <View style={s.miniRow}>
          <View style={s.miniCard}>
            <View style={s.miniHead}>
              <View style={s.miniKickerRow}>
                <Text style={s.miniKicker}>RAID</Text>
                <Trophy size={9} color={c.text.muted} />
                <Text style={s.miniKicker}>{raidWon.length}</Text>
              </View>
              <View style={s.miniEnergyRow}>
                <Zap size={10} color="#38BDF8" />
                <Text style={s.miniEnergy}>{raidEnergy}</Text>
              </View>
            </View>
            <View style={s.miniBody}>
              <BossArt id={raid.id} emoji={raid.emoji} size={40} powered />
              <View style={{ flex: 1, minWidth: 0 }}>
                <Text style={s.miniName} numberOfLines={1}>{raid.name}</Text>
                <View style={s.miniHpTrack}><View style={[s.miniHpFill, { width: `${Math.round((raidDone ? 0 : raidRemaining) / raidMaxHp * 100)}%`, backgroundColor: WEAK_COLOR[raid.weakness] ?? '#888' }]} /></View>
              </View>
            </View>
            {raidDone ? (
              <Text style={s.miniDoneTxt}>Pokonany ✓ · nowy w pon.</Text>
            ) : raidUnlocked ? (
              <PressableScale onPress={() => { haptic.tap(); router.push('/boss-fight?kind=raid' as any); }}>
                <View style={[s.miniBtn, raidEnergy <= 0 && { opacity: 0.5 }]}>
                  <Text style={s.miniBtnTxt}>WALCZ</Text>
                </View>
              </PressableScale>
            ) : (
              <Text style={s.miniLockTxt}>Odblokuj: lvl 3</Text>
            )}
          </View>

          {eventBoss && eventKey && (
            <View style={s.miniCard}>
              <View style={s.miniHead}>
                <View style={s.miniKickerRow}>
                  <Text style={s.miniKicker} numberOfLines={1}>{isMenace ? 'NEMESIS' : 'WYDARZENIE'}</Text>
                  <Trophy size={9} color={c.text.muted} />
                  <Text style={s.miniKicker}>{eventWon.length}</Text>
                </View>
                {/* Nemesis (2026-08-18): nielimitowane próby — bez pigułki energii, to już nie
                    ma sensu jako "ile mi zostało dziś". Sezonowe zostają przy energii. */}
                {!isMenace && (
                  <View style={s.miniEnergyRow}>
                    <Zap size={10} color="#F87171" />
                    <Text style={[s.miniEnergy, { color: '#F87171' }]}>{eventEnergy}</Text>
                  </View>
                )}
              </View>
              <View style={s.miniBody}>
                <BossArt id={eventBoss.id} emoji={eventBoss.emoji} size={40} powered={isMenace} />
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.miniName} numberOfLines={1}>{eventBoss.name}</Text>
                  {isMenace ? (
                    // Trwały bank → pasek postępu (jak raid), nie statyczne "X HP" — user:
                    // "pasek zdrowia większy... żeby go długo klepać".
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
                <PressableScale onPress={() => { haptic.tap(); router.push('/boss-fight?kind=event' as any); }}>
                  <View style={[s.miniBtn, !isMenace && eventEnergy <= 0 && { opacity: 0.5 }]}>
                    <Text style={s.miniBtnTxt}>WALCZ</Text>
                  </View>
                </PressableScale>
              ) : (
                <Text style={s.miniLockTxt}>Odblokuj: lvl 2</Text>
              )}
            </View>
          )}
        </View>

        {/* ── KAMPANIA: aktualny boss jako karta-bohater z jednym przyciskiem WALCZ,
            który przenosi na osobny ekran walki (S&F). Reszta = zwykła lista. ── */}
        {!current ? (
          <View style={s.done}>
            <Swords size={30} color={c.text.muted} />
            <Text style={s.doneTxt}>Wszyscy bossowie pokonani! Kolejni wkrótce.</Text>
          </View>
        ) : (
          <View style={s.heroCard}>
            <View style={s.bossTop}>
              <BossArt id={current.id} emoji={current.emoji} size={82} />
            </View>
            <Text style={s.bossName}>{current.name}</Text>
            <Text style={s.bossTaunt}>„{current.taunt}"</Text>
            {/* Tylko HP + motyw — BEZ nagrody/mechanik przed walką (2026-08-10, user:
                "zbyt dużo opisu bossa"). Reszta szczegółów żyje na ekranie walki. */}
            <Text style={s.hpTxt}>{current.hp} HP · Motyw: <Text style={{ color: '#2AC68F', fontWeight: '800' }}>{current.weaknessLabel}</Text></Text>
            {/* Regeneracja w czasie (2026-08-18, patrz ENERGY_MAX/ENERGY_REGEN_HOURS w
                bosses.ts) — gdy bank niepełny, pokazuje ZA ILE realnie dotrze kolejny punkt,
                nie tylko "0 energii" bez kontekstu kiedy wróci. */}
            {energy < ENERGY_MAX && energyRegenAt && (
              <Text style={[s.hpTxt, { color: c.text.muted }]}>Kolejna energia za {fmtEnergyCountdown(energyRegenAt)}</Text>
            )}

            <PressableScale onPress={() => { haptic.tap(); router.push('/boss-fight' as any); }} style={{ width: '100%' }}>
              <View style={[s.attackBtn, energy <= 0 && { opacity: 0.5 }]}>
                <Swords size={18} color="#fff" />
                <Text style={s.attackTxt}>WALCZ!</Text>
              </View>
            </PressableScale>
          </View>
        )}

        {/* campaign list */}
        <Text style={s.section}>Kampania</Text>
        <View style={{ gap: spacing[2] }}>
          {BOSSES.map(b => {
            const def = defeatedBosses.includes(b.id);
            const isCur = current?.id === b.id;
            // 2026-08-17 — lock w liście to teraz czysto "jeszcze nie doszedłeś tu w
            // kolejności" (nie def, nie current), NIE poziom — patrz komentarz przy `current`
            // wyżej. Wciąż informacyjne (lista nie ma własnego przycisku walki, tylko hero
            // card current-bossa wyżej), ale już nie sugeruje nieistniejącego wymogu poziomu.
            const lock = !def && !isCur;
            return (
              <View key={b.id} style={[s.row, isCur && { borderColor: '#38BDF8' }]}>
                <View style={def && { opacity: 0.5 }}>
                  <BossArt id={b.id} emoji={b.emoji} size={32} mystery={lock} />
                </View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.rowName} numberOfLines={1}>{lock ? mysteryBossName(b.id) : b.name}</Text>
                  <Text style={s.rowSub}>{def ? `Pokonany · ${b.loot.name}` : lock ? 'Pokonaj poprzednich' : `${b.hp} HP · ${b.weaknessLabel}`}</Text>
                </View>
                {def ? <View style={s.rowBadge}><Check size={14} color="#2AC68F" /></View>
                  : lock ? <Lock size={15} color={c.text.muted} />
                    : isCur ? <View style={[s.rowBadge, { backgroundColor: '#38BDF822' }]}><Swords size={13} color="#38BDF8" /></View> : null}
              </View>
            );
          })}
        </View>

        {/* ── MAD (2026-08-15) — druga fala kampanii, lvl 50+, tylko po pokonaniu normalnej
            wersji danego bossa. Ten sam heroCard co kampania wyżej, art dostaje czerwoną
            aurę (`powered`, patrz BossArt) żeby czytać się jako "wzmocniony wariant". ── */}
        <Text style={s.section}>MAD bossy</Text>
        {!madBoss ? (
          <View style={s.done}>
            <Swords size={30} color={c.text.muted} />
            <Text style={s.doneTxt}>Pokonaj (kolejnego) bossa kampanii, żeby odblokować jego MAD wersję.</Text>
          </View>
        ) : (
          <View style={s.heroCard}>
            <View style={s.bossTop}>
              <BossArt id={madBoss.id} emoji={madBoss.emoji} size={82} powered />
            </View>
            <Text style={s.madKicker}>OSZALAŁY WARIANT</Text>
            <Text style={s.bossName}>{madBoss.name}</Text>
            <Text style={s.bossTaunt}>„{madBoss.taunt}"</Text>
            <Text style={s.hpTxt}>{madBoss.hp} HP · Motyw: <Text style={{ color: '#2AC68F', fontWeight: '800' }}>{madBoss.weaknessLabel}</Text></Text>

            {madUnlocked ? (
              <PressableScale onPress={() => { haptic.tap(); router.push('/boss-fight?kind=mad' as any); }} style={{ width: '100%' }}>
                <View style={[s.attackBtn, energy <= 0 && { opacity: 0.5 }]}>
                  <Swords size={18} color="#fff" />
                  <Text style={s.attackTxt}>WALCZ!</Text>
                </View>
              </PressableScale>
            ) : (
              <View style={s.lockBox}>
                <Lock size={16} color={c.text.muted} />
                <Text style={s.lockTxt}>Odblokujesz na poziomie {MAD_UNLOCK_LEVEL} (masz {level}).</Text>
              </View>
            )}
          </View>
        )}

        {raidWon.length > 0 && (
          <>
            <Text style={s.section}>Medale raidów ({raidWon.length})</Text>
            <View style={s.medalWall}>
              {raidWon.slice().reverse().map(wk => {
                const MedalIcon = raidIcon(raidForWeek(wk).id);
                return (
                  <View key={wk} style={s.medal}>
                    <MedalIcon size={22} color="#FBBF24" />
                    <Text style={s.medalWk} numberOfLines={1}>{wk}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
        {eventWon.length > 0 && (
          <>
            <Text style={s.section}>Medale wydarzeń ({eventWon.length})</Text>
            <View style={s.medalWall}>
              {eventWon.slice().reverse().map(key => {
                const MedalIcon = eventIcon(eventBossFromKey(key)?.id ?? '');
                return (
                  <View key={key} style={s.medal}>
                    <MedalIcon size={22} color="#FBBF24" />
                    <Text style={s.medalWk} numberOfLines={1}>{key}</Text>
                  </View>
                );
              })}
            </View>
          </>
        )}
      </ScrollView>

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
  energyPill: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#38BDF818', borderRadius: radius.full, paddingHorizontal: 10, height: 30, borderWidth: 1, borderColor: '#38BDF840' },
  energyTxt: { fontSize: 13, fontWeight: '800', color: '#38BDF8' },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: 110 },

  done: { alignItems: 'center', gap: spacing[3], paddingVertical: spacing[8] },
  doneTxt: { fontSize: 13, color: c.text.muted, textAlign: 'center', maxWidth: 260 },

  heroCard: { alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.default, padding: spacing[4] },
  bossTop: { height: 92, justifyContent: 'center', alignItems: 'center' },
  madKicker: { fontSize: 10.5, fontWeight: '900', color: '#DC2626', letterSpacing: 1.2, marginTop: 6 },
  bossName: { fontSize: 20, fontWeight: '900', color: c.text.primary, marginTop: 4 },
  bossTaunt: { fontSize: 12.5, color: c.text.muted, fontStyle: 'italic', marginTop: 2, marginBottom: spacing[2] },
  hpTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },

  attackBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#EF4444', borderRadius: radius.lg, paddingVertical: 16, marginTop: spacing[3], width: '100%' },
  attackTxt: { fontSize: 17, fontWeight: '900', color: '#fff' },
  lockBox: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: spacing[3], paddingHorizontal: spacing[3] },
  lockTxt: { flex: 1, fontSize: 12.5, color: c.text.muted, lineHeight: 17 },

  section: { fontSize: 11, fontWeight: '800', color: c.text.muted, letterSpacing: 0.6, textTransform: 'uppercase', marginTop: spacing[5], marginBottom: spacing[2] },
  row: { flexDirection: 'row', alignItems: 'center', gap: 12, backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3] },
  rowName: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  rowSub: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },
  rowBadge: { width: 28, height: 28, borderRadius: 14, backgroundColor: '#2AC68F1A', alignItems: 'center', justifyContent: 'center' },

  miniRow: { flexDirection: 'row', gap: spacing[2], marginBottom: spacing[3] },
  miniCard: { flex: 1, minWidth: 0, backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], gap: 6 },
  miniHead: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 6 },
  miniKickerRow: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 3, minWidth: 0 },
  miniKicker: { fontSize: 9.5, fontWeight: '800', letterSpacing: 0.8, color: c.text.muted },
  miniEnergyRow: { flexDirection: 'row', alignItems: 'center', gap: 3 },
  miniEnergy: { fontSize: 10.5, fontWeight: '800', color: '#38BDF8' },
  miniBody: { flexDirection: 'row', alignItems: 'center', gap: spacing[2] },
  miniName: { fontSize: 12.5, fontWeight: '800', color: c.text.primary },
  miniSub: { fontSize: 10, color: c.text.muted, marginTop: 2 },
  miniCountdown: { fontSize: 10, fontWeight: '800', marginTop: 2 },
  miniHpTrack: { width: '100%', height: 6, borderRadius: 3, backgroundColor: c.bg.elevated, overflow: 'hidden', marginTop: 4 },
  miniHpFill: { height: '100%', borderRadius: 3 },
  miniBtn: { alignItems: 'center', borderRadius: radius.md, paddingVertical: 8, backgroundColor: '#EF4444' },
  miniBtnTxt: { fontSize: 11.5, fontWeight: '800', color: '#fff' },
  miniDoneTxt: { fontSize: 10.5, fontWeight: '700', color: '#2AC68F', textAlign: 'center' },
  miniLockTxt: { fontSize: 10.5, color: c.text.muted, textAlign: 'center' },
  medalWall: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing[2] },
  medal: { width: 64, alignItems: 'center', backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, paddingVertical: spacing[2] },
  medalWk: { fontSize: 9, color: c.text.muted, marginTop: 2 },
}));
