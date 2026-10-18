import { useEffect, useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, Maximize2, RotateCcw, Check } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';
import Stepper from '@/components/ui/Stepper';
import ColorSwatchPicker from '@/components/ui/ColorSwatchPicker';
import { useHabits } from '@/hooks/useHabits';
import { useCounters, autoDaysWithout, isOver, daysUntil, isDuringEvent, daysSince } from '@/store/countersStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useFoodStore } from '@/store/foodStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useMoodStore } from '@/store/moodStore';
import { useDayKey } from '@/hooks/useDayKey';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { getAllNotes, Note } from '@/utils/notesStorage';
import { useCalendarStore } from '@/store/calendarStore';
import { shiftClockRange } from '@/utils/workEvents';
import { exerciseStreakFrom } from '@/utils/personalQuests';
import { buildRecords } from '@/utils/personalRecords';
import { STREAK_TIERS, TIER_COLOR_PRESETS } from '@/utils/streakTiers';
import StreakWallCard, { StreakItem } from '@/components/dashboard/StreakWallCard';
import PersonalRecordsCard from '@/components/dashboard/PersonalRecordsCard';
import CountdownsCard from '@/components/dashboard/CountdownsCard';
import SinceCountersCard from '@/components/dashboard/SinceCountersCard';
import PinnedNotesCard from '@/components/dashboard/PinnedNotesCard';
import GCalCard from '@/components/dashboard/GCalCard';
import { useStreakTileStyleStore, StreakTileStyle, HabitCalendarStyle, FlameCorner, StreakLayoutPreset, DEFAULT_STREAK_TILE_STYLE } from '@/store/streakTileStyleStore';
import { useRecordsTileStyleStore, DEFAULT_RECORDS_TILE_STYLE, RecordsLayoutPreset } from '@/store/recordsTileStyleStore';
import { useCountdownsTileStyleStore, DEFAULT_COUNTDOWNS_TILE_STYLE } from '@/store/countdownsTileStyleStore';
import { CountdownLayoutPreset } from '@/store/countdownTileStyleDefaults';
import { useSinceCountersTileStyleStore, DEFAULT_SINCE_COUNTERS_TILE_STYLE, SinceCounterLayoutPreset } from '@/store/sinceCountersTileStyleStore';
import { usePinnedNotesTileStyleStore, DEFAULT_PINNED_NOTES_TILE_STYLE } from '@/store/pinnedNotesTileStyleStore';
import { NotesLayoutPreset } from '@/store/notesTileStyleDefaults';
import { useGCalTileStyleStore, DEFAULT_GCAL_TILE_STYLE } from '@/store/gcalTileStyleStore';

type CardKey = 'streaks' | 'records' | 'countdowns' | 'since' | 'notes' | 'gcal';
const CARD_TABS: { key: CardKey; label: string }[] = [
  { key: 'streaks', label: 'Twoje serie' },
  { key: 'records', label: 'Rekordy' },
  { key: 'countdowns', label: 'Odliczania' },
  { key: 'since', label: 'Liczniki' },
  { key: 'notes', label: 'Notatki' },
  { key: 'gcal', label: 'Kalendarz' },
];
const CARD_PREVIEW_TITLES: Record<CardKey, string> = {
  streaks: 'Twoje serie',
  records: 'Rekordy życiowe',
  countdowns: 'Odliczania',
  since: 'Liczniki',
  notes: 'Przypięte notatki',
  gcal: 'Google Kalendarz',
};
const RECORD_COLOR_PRESETS = ['#FBBF24', '#60A5FA', '#F472B6', '#34D399', '#F87171', '#C084FC'];

// Kreator dashboardu — FAZA 1 (2026-10-15, ARCHITECTURE.md §327). User: "zrobisz mi prawdziwy
// kreator w ustawieniach ze wszystkim w aplikacji... ja będę sobie robił edytował kreował
// poprawiał... a potem wdrożę". Zamiast HTML-owych makiet w Artifact (szybkie do przeglądania,
// ale user musiał kopiować wybór z powrotem do czatu, a żadna makieta HTML nie renderuje się
// tak jak RN naprawdę) — ten ekran renderuje PRAWDZIWY `StreakWallCard` z PRAWDZIWYMI danymi
// (dokładnie to samo źródło co `streakWall` w app/(tabs)/index.tsx), więc podgląd tutaj = to,
// co realnie zobaczysz po "Wdróż", co do piksela.
//
// Faza 1 (§327) zrobiła "Twoje serie", Faza 2 (§328) dołożyła "Rekordy życiowe", Faza 3 (§329)
// dołożyła "Odliczania" — TEN SAM mechanizm (draft/live store + `styleOverride` prop), osobny
// store per karta (pola się różnią: gradient/pasek/płomień u serii, kolor akcentu/ikona-tło u
// rekordów, rozmiar/grubość pierścienia u odliczań — to NIE jest jeden uniwersalny schemat na
// siłę, tylko wspólny WZORZEC, bo "Odliczania" ma inny KSZTAŁT treści, lista+pierścień zamiast
// siatki kafelków). Faza 4 (§330) dołożyła przepinanie nawigacji per nawyk. Faza 5 (§331)
// dołożyła pozycję/warstwy (róg płomienia, czy jest na wierzchu tekstu, wyrównanie treści) —
// pierwsza prawdziwa realizacja "edycji graficznej" z pierwotnej prośby usera, nie tylko
// kolor/rozmiar. Pełna wizja z NEXT_STEPS.md (edycja KAŻDEGO panelu dashboardu) to kolejne
// fazy — rozszerzające ten sam wzorzec na kolejne karty, nie przepisujące go od nowa.
// Faza 11 (§337) dołożyła "Liczniki" (`SinceCountersCard`) — pierwsza NOWA karta od Fazy 3,
// własny kształt (lista wierszy: liczba+poświata+nazwa/meta), własne pola (rowRadius/
// numberScale/maxVisible/showGlow), zero aspectRatio/gradientMode skopiowanych z kafelków serii.
export default function DashboardTileCreator() {
  const c = useColors();
  const s = makeS(c);
  const [activeCard, setActiveCard] = useState<CardKey>('streaks');
  const [fullPreview, setFullPreview] = useState(false);

  // Streaks store (§327, Faza 1)
  const streaksDraft = useStreakTileStyleStore(st => st.draft);
  const setStreaksDraft = useStreakTileStyleStore(st => st.setDraft);
  const publishStreaks = useStreakTileStyleStore(st => st.publish);
  const discardStreaksDraft = useStreakTileStyleStore(st => st.discardDraft);
  const resetStreaksDefault = useStreakTileStyleStore(st => st.resetDraftToDefault);
  const setHabitCalendarOverride = useStreakTileStyleStore(st => st.setDraftHabitCalendar);
  const setTierColor = useStreakTileStyleStore(st => st.setDraftTierColor);
  const streaksLive = useStreakTileStyleStore(st => st.live);

  // Records store (§328, Faza 2) — ten sam mechanizm, druga karta.
  const recordsDraft = useRecordsTileStyleStore(st => st.draft);
  const setRecordsDraft = useRecordsTileStyleStore(st => st.setDraft);
  const publishRecords = useRecordsTileStyleStore(st => st.publish);
  const discardRecordsDraft = useRecordsTileStyleStore(st => st.discardDraft);
  const resetRecordsDefault = useRecordsTileStyleStore(st => st.resetDraftToDefault);
  const recordsLive = useRecordsTileStyleStore(st => st.live);

  // Countdowns store (§329, Faza 3) — trzecia karta, INNY kształt (lista+pierścień, nie
  // siatka kafelków) więc własne pola (ringSize/ringStrokeWidth/maxVisible), nie
  // aspectRatio/numberScale skopiowane z poprzednich dwóch.
  const countdownsDraft = useCountdownsTileStyleStore(st => st.draft);
  const setCountdownsDraft = useCountdownsTileStyleStore(st => st.setDraft);
  const publishCountdowns = useCountdownsTileStyleStore(st => st.publish);
  const discardCountdownsDraft = useCountdownsTileStyleStore(st => st.discardDraft);
  const resetCountdownsDefault = useCountdownsTileStyleStore(st => st.resetDraftToDefault);
  const countdownsLive = useCountdownsTileStyleStore(st => st.live);

  // Since-counters store (§337, Faza 11) — czwarta karta, kształt listy wierszy (bliski
  // "Odliczaniom"), własne pola (rowRadius/numberScale/maxVisible/showGlow).
  const sinceDraft = useSinceCountersTileStyleStore(st => st.draft);
  const setSinceDraft = useSinceCountersTileStyleStore(st => st.setDraft);
  const publishSince = useSinceCountersTileStyleStore(st => st.publish);
  const discardSinceDraft = useSinceCountersTileStyleStore(st => st.discardDraft);
  const resetSinceDefault = useSinceCountersTileStyleStore(st => st.resetDraftToDefault);
  const sinceLive = useSinceCountersTileStyleStore(st => st.live);

  // Pinned-notes store (§338, Faza 12) — piąta karta, drugi kompletnie nowy kształt treści
  // (tekst+tagi) od Fazy 3. Zero koloru/progu do nadpisania — tylko ile/co pokazać.
  const notesDraft = usePinnedNotesTileStyleStore(st => st.draft);
  const setNotesDraft = usePinnedNotesTileStyleStore(st => st.setDraft);
  const publishNotes = usePinnedNotesTileStyleStore(st => st.publish);
  const discardNotesDraft = usePinnedNotesTileStyleStore(st => st.discardDraft);
  const resetNotesDefault = usePinnedNotesTileStyleStore(st => st.resetDraftToDefault);
  const notesLive = usePinnedNotesTileStyleStore(st => st.live);

  // GCal store (§339, Faza 13) — szósta i ostatnia karta z pierwotnej listy kandydatów §327.
  // Trzeci kształt treści (lista eventów, dwie sekcje Dziś/Jutro) — bez koloru, pochodna
  // danych kalendarza per-event, ten sam powód co brak akcentu w §337.
  const gcalDraft = useGCalTileStyleStore(st => st.draft);
  const setGcalDraft = useGCalTileStyleStore(st => st.setDraft);
  const publishGcal = useGCalTileStyleStore(st => st.publish);
  const discardGcalDraft = useGCalTileStyleStore(st => st.discardDraft);
  const resetGcalDefault = useGCalTileStyleStore(st => st.resetDraftToDefault);
  const gcalLive = useGCalTileStyleStore(st => st.live);

  const DRAFTS: Record<CardKey, object> = { streaks: streaksDraft, records: recordsDraft, countdowns: countdownsDraft, since: sinceDraft, notes: notesDraft, gcal: gcalDraft };
  const LIVES: Record<CardKey, object> = { streaks: streaksLive, records: recordsLive, countdowns: countdownsLive, since: sinceLive, notes: notesLive, gcal: gcalLive };
  const DEFAULTS: Record<CardKey, object> = { streaks: DEFAULT_STREAK_TILE_STYLE, records: DEFAULT_RECORDS_TILE_STYLE, countdowns: DEFAULT_COUNTDOWNS_TILE_STYLE, since: DEFAULT_SINCE_COUNTERS_TILE_STYLE, notes: DEFAULT_PINNED_NOTES_TILE_STYLE, gcal: DEFAULT_GCAL_TILE_STYLE };
  const PUBLISH_FNS: Record<CardKey, () => void> = { streaks: publishStreaks, records: publishRecords, countdowns: publishCountdowns, since: publishSince, notes: publishNotes, gcal: publishGcal };
  const DISCARD_FNS: Record<CardKey, () => void> = { streaks: discardStreaksDraft, records: discardRecordsDraft, countdowns: discardCountdownsDraft, since: discardSinceDraft, notes: discardNotesDraft, gcal: discardGcalDraft };
  const RESET_FNS: Record<CardKey, () => void> = { streaks: resetStreaksDefault, records: resetRecordsDefault, countdowns: resetCountdownsDefault, since: resetSinceDefault, notes: resetNotesDefault, gcal: resetGcalDefault };
  const isDirty = JSON.stringify(DRAFTS[activeCard]) !== JSON.stringify(LIVES[activeCard]);
  const isDefault = JSON.stringify(DRAFTS[activeCard]) !== JSON.stringify(DEFAULTS[activeCard]);

  // Te same realne dane co dashboard — patrz `streakWall`/`records` w app/(tabs)/index.tsx.
  // Celowo NIE snapshot (CLAUDE.md §3 to dotyczy handlerów PISZĄCYCH `expenses` po paragonie —
  // tu tylko CZYTAMY do podglądu, więc żywy store jest w porządku, a nawet dokładniejszy).
  const { habits, getStreak } = useHabits();
  const counters = useCounters(st => st.counters);
  const expenses = useExpensesStore(st => st.expenses);
  const foodMeals = useFoodStore(st => st.meals);
  const foodProducts = useFoodStore(st => st.products);
  const exerciseLogs = useExercisesStore(st => st.logs);
  const moodEntries = useMoodStore(st => st.entries);
  const dayKey = useDayKey();
  const exerciseStreak = useMemo(() => exerciseStreakFrom(exerciseLogs, dayKey), [exerciseLogs, dayKey]);
  const realStreaks = useMemo<StreakItem[]>(() => {
    const fromHabits = habits.map(h => ({ key: `h:${h.id}`, name: h.title, days: getStreak(h.id), kind: h.kind }));
    const fromCounters = counters
      .filter(cn => cn.kind === 'since' && cn.mode === 'auto' && cn.onDashboard !== false)
      .map(cn => ({ key: `c:${cn.id}`, name: `bez ${cn.name}`, days: autoDaysWithout(cn, expenses, foodMeals, foodProducts) }));
    const exercise: StreakItem = { key: 'ex:exercises', name: 'Ćwiczenia', days: exerciseStreak };
    return [exercise, ...fromHabits, ...fromCounters];
  }, [habits, getStreak, counters, expenses, foodMeals, foodProducts, exerciseStreak]);
  // Kafelki nawyków (§330, "Cel po kliknięciu") — jedyne z `realStreaks`, dla których istnieje
  // realny wybór celu (patrz komentarz w streakTileStyleStore.ts).
  const habitStreaks = useMemo(() => realStreaks.filter(r => r.key.startsWith('h:')), [realStreaks]);
  // `healthDays` pominięte (pusty obiekt) — na prawdziwym dashboardzie ładowane asynchronicznie
  // z Health Connect (kroki/sen/waga, patrz index.tsx `reloadHealth`), za dużo do powielania w
  // samym podglądzie stylu. Rekordy oparte o wydatki/nastrój/jedzenie dalej liczą się z
  // prawdziwych danych — `{}` to zresztą DOKŁADNIE ten sam stan początkowy co na realnym
  // dashboardzie, zanim Health Connect odpowie (index.tsx `useState<StatCtx['healthDays']>({})`).
  const realRecords = useMemo(
    () => buildRecords({}, expenses, moodEntries, foodMeals, foodProducts),
    [expenses, moodEntries, foodMeals, foodProducts],
  );
  // Te same realne dane co `activeCountdowns` w app/(tabs)/index.tsx (kind='until',
  // onDashboard!==false, nieskończone/trwające, posortowane po dacie).
  const realCountdowns = useMemo(
    () => counters.filter(cn => cn.kind === 'until' && cn.onDashboard !== false && !isOver(cn) && (daysUntil(cn) >= 0 || isDuringEvent(cn))).sort((a, b) => a.date.localeCompare(b.date)),
    [counters, dayKey],
  );
  // Te same realne dane co `dashSince` w app/(tabs)/index.tsx (kind='since', mode!=='auto',
  // onDashboard!==false, posortowane po dniach malejąco).
  const realSince = useMemo(
    () => counters.filter(cn => cn.kind === 'since' && cn.mode !== 'auto' && cn.onDashboard !== false)
      .map(cn => ({ cn, days: daysSince(cn) }))
      .sort((a, b) => b.days - a.days),
    [counters, dayKey],
  );
  const { color: timeAccentColor } = useTimeAccent();
  // Notatki (§338) — jedyna karta z danymi async (AsyncStorage, nie Zustand) — ten sam loader
  // co `index.tsx` (`getAllNotes().then(ns => ns.filter(n => n.pinned))`), odświeżany raz przy
  // wejściu na ekran (kreator nie potrzebuje live-refresh na fokusie jak realny dashboard).
  const [realPinnedNotes, setRealPinnedNotes] = useState<Note[]>([]);
  useEffect(() => { getAllNotes().then(ns => setRealPinnedNotes(ns.filter(n => n.pinned))).catch(() => {}); }, []);

  // GCal (§339) — ta sama logika co `gcalToday`/`gcalTomorrow` w app/(tabs)/index.tsx (dziś =
  // nie zakończone, jutro = wszystko). `gcalEvents` czyta się LIVE z `useCalendarStore` (już w
  // pamięci po wejściu na dashboard, które woła `fetchEvents()` na mount — brak potrzeby
  // ponownego fetchu tutaj).
  const gcalEvents = useCalendarStore(st => st.gcalEvents);
  const tomorrowKey = useMemo(() => {
    const t = new Date(); t.setDate(t.getDate() + 1);
    return `${t.getFullYear()}-${String(t.getMonth() + 1).padStart(2, '0')}-${String(t.getDate()).padStart(2, '0')}`;
  }, [dayKey]);
  const realGcalToday = useMemo(() => {
    const nowMins = new Date().getHours() * 60 + new Date().getMinutes();
    const t2m = (hhmm: string) => { const [h, m] = hhmm.split(':').map(Number); return (h || 0) * 60 + (m || 0); };
    return gcalEvents
      .filter(e => e.date === dayKey)
      .filter(e => {
        const r = shiftClockRange(e);
        if (!r) return true;
        return t2m(r.end) >= nowMins;
      })
      .sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? ''));
  }, [gcalEvents, dayKey]);
  const realGcalTomorrow = useMemo(
    () => gcalEvents.filter(e => e.date === tomorrowKey).sort((a, b) => (a.startTime ?? '').localeCompare(b.startTime ?? '')),
    [gcalEvents, tomorrowKey],
  );

  const doPublish = () => { haptic.success(); PUBLISH_FNS[activeCard](); };
  const doDiscard = () => { haptic.tap(); DISCARD_FNS[activeCard](); };
  const doResetDefault = () => { haptic.tap(); RESET_FNS[activeCard](); };

  return (
    <SafeAreaView style={s.safe} edges={['top', 'bottom']}>
      <View style={s.header}>
        <TouchableOpacity onPress={() => { haptic.tap(); router.back(); }} style={s.closeBtn} hitSlop={10}>
          <X size={18} color={c.text.secondary} />
        </TouchableOpacity>
        <Text style={s.title}>Kreator kafelków</Text>
        <TouchableOpacity onPress={doPublish} style={[s.deployBtn, !isDirty && { opacity: 0.4 }]} hitSlop={10} disabled={!isDirty}>
          <Check size={15} color="#fff" />
          <Text style={s.deployTxt}>Wdróż</Text>
        </TouchableOpacity>
      </View>

      {/* ScrollView horyzontalny (§338) — 5 zakładek nie mieści się już wygodnie jako
          `flex:1` row (ciasne etykiety typu "Twoje serie"); kolejne karty tylko pogłębiłyby
          problem, więc przechodzę na przewijaną listę zamiast dalszego ściskania. */}
      <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.tabs}>
        {CARD_TABS.map(t => {
          const on = activeCard === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => { haptic.tap(); setActiveCard(t.key); }}
              style={[s.tabBtn, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
              <Text style={[s.tabTxt, on && { color: c.accent.blue }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </ScrollView>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.sectionLabel}>
          Podgląd — „{CARD_PREVIEW_TITLES[activeCard]}" (prawdziwe dane)
        </Text>
        <View style={s.previewWrap}>
          {activeCard === 'streaks'
            ? <StreakWallCard streaks={realStreaks} cardBg={c.bg.card} styleOverride={streaksDraft} />
            : activeCard === 'records'
            ? <PersonalRecordsCard records={realRecords} cardBg={c.bg.card} styleOverride={recordsDraft} />
            : activeCard === 'countdowns'
            ? <CountdownsCard countdowns={realCountdowns} cardBg={c.bg.card} accentColor={timeAccentColor} styleOverride={countdownsDraft} />
            : activeCard === 'since'
            ? <SinceCountersCard since={realSince} cardBg={c.bg.card} accentColor={timeAccentColor} styleOverride={sinceDraft} />
            : activeCard === 'notes'
            ? <PinnedNotesCard notes={realPinnedNotes} cardBg={c.bg.card} accentColor={timeAccentColor} styleOverride={notesDraft} />
            : <GCalCard today={realGcalToday} tomorrow={realGcalTomorrow} cardBg={c.bg.card} styleOverride={gcalDraft} />}
        </View>
        {activeCard === 'countdowns' && realCountdowns.length === 0 && (
          <Text style={s.hint}>Brak aktywnych odliczań na koncie — dodaj jedno w Licznikach, żeby zobaczyć realny podgląd.</Text>
        )}
        {activeCard === 'since' && realSince.length === 0 && (
          <Text style={s.hint}>Brak ręcznych liczników "ile dni temu" na koncie — dodaj jeden w Licznikach, żeby zobaczyć realny podgląd.</Text>
        )}
        {activeCard === 'notes' && realPinnedNotes.length === 0 && (
          <Text style={s.hint}>Brak przypiętych notatek na koncie — przypnij jedną w Notatkach, żeby zobaczyć realny podgląd.</Text>
        )}
        {activeCard === 'gcal' && realGcalToday.length === 0 && realGcalTomorrow.length === 0 && (
          <Text style={s.hint}>Brak eventów z Google Kalendarza na dziś/jutro — podłącz kalendarz w Ustawieniach, żeby zobaczyć realny podgląd.</Text>
        )}
        <TouchableOpacity onPress={() => { haptic.tap(); setFullPreview(true); }} style={s.fullBtn}>
          <Maximize2 size={14} color={c.text.secondary} />
          <Text style={s.fullBtnTxt}>Podgląd pełnoekranowy</Text>
        </TouchableOpacity>

        {/* Styl kafelka (§334) — "zmiana ZUPEŁNA kafelków", nie parametr istniejącego wyglądu.
            Rekordy/Liczniki/Notatki dalej mają swój ustalony, inny kształt treści bez wyboru —
            Odliczania dociągnięte w Fazie 24 (§355, user: "nie ma możliwości wyboru własnego
            kształtu od zera"), ten sam wzorzec co Twoje serie, inny zestaw wariantów (pierścień/
            pasek/kompaktowy/duża liczba zamiast klasyczny/pierścień/pasek/kompaktowy). */}
        {activeCard === 'streaks' && (
          <>
            <Text style={s.sectionLabel}>Styl kafelka</Text>
            <View style={s.segmented}>
              {([['classic', 'Klasyczny'], ['ring', 'Pierścień'], ['stripe', 'Pasek akcentu'], ['compact', 'Kompaktowy']] as [StreakLayoutPreset, string][]).map(([m, lbl]) => {
                const on = streaksDraft.layoutPreset === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); setStreaksDraft({ layoutPreset: m }); }}
                    style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                    <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
        {activeCard === 'countdowns' && (
          <>
            <Text style={s.sectionLabel}>Styl kafelka</Text>
            <View style={s.segmented}>
              {([['ring', 'Pierścień'], ['bar', 'Pasek'], ['compact', 'Kompaktowy'], ['hero', 'Duża liczba']] as [CountdownLayoutPreset, string][]).map(([m, lbl]) => {
                const on = countdownsDraft.layoutPreset === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); setCountdownsDraft({ layoutPreset: m }); }}
                    style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                    <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
        {/* Warianty kształtu Rekordów (§364) — CAŁOKARTowe (dotyczą układu hero+grid, nie
            per-pozycja jak Liczniki/Notatki). */}
        {activeCard === 'records' && (
          <>
            <Text style={s.sectionLabel}>Styl kafelka</Text>
            <View style={s.segmented}>
              {([['heroGrid', 'Hero + siatka'], ['grid', 'Siatka'], ['list', 'Lista']] as [RecordsLayoutPreset, string][]).map(([m, lbl]) => {
                const on = recordsDraft.layoutPreset === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); setRecordsDraft({ layoutPreset: m }); }}
                    style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                    <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
        {/* Warianty kształtu Notatek (§363) — treść unikalna (tytuł+treść+tagi). */}
        {activeCard === 'notes' && (
          <>
            <Text style={s.sectionLabel}>Styl kafelka</Text>
            <View style={s.segmented}>
              {([['row', 'Wiersz'], ['compact', 'Kompaktowy'], ['card', 'Karta']] as [NotesLayoutPreset, string][]).map(([m, lbl]) => {
                const on = notesDraft.layoutPreset === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); setNotesDraft({ layoutPreset: m }); }}
                    style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                    <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}
        {/* Warianty kształtu Liczników (§362) — treść unikalna (próg serii, nie data/postęp), */}
        {activeCard === 'since' && (
          <>
            <Text style={s.sectionLabel}>Styl kafelka</Text>
            <View style={s.segmented}>
              {([['row', 'Wiersz'], ['bar', 'Pasek progu'], ['compact', 'Kompaktowy'], ['minimal', 'Minimalny']] as [SinceCounterLayoutPreset, string][]).map(([m, lbl]) => {
                const on = sinceDraft.layoutPreset === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); setSinceDraft({ layoutPreset: m }); }}
                    style={[s.segBtn, { flex: 1, alignItems: 'center' }, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                    <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          </>
        )}

        <Text style={s.sectionLabel}>Kształt</Text>
        {activeCard === 'countdowns' ? (
          <View style={s.card}>
            <Stepper label="Zaokrąglenie rogów" value={countdownsDraft.cornerRadius} min={0} max={32} step={2}
              onChange={v => setCountdownsDraft({ cornerRadius: v })} />
            {countdownsDraft.layoutPreset === 'ring' && (
              <>
                <View style={s.divider} />
                <Stepper label="Rozmiar pierścienia" value={countdownsDraft.ringSize} min={40} max={88} step={4}
                  onChange={v => setCountdownsDraft({ ringSize: v })} />
                <View style={s.divider} />
                <Stepper label="Grubość pierścienia" value={countdownsDraft.ringStrokeWidth} min={2} max={12} step={1}
                  onChange={v => setCountdownsDraft({ ringStrokeWidth: v })} />
              </>
            )}
            {countdownsDraft.layoutPreset === 'hero' && (
              <>
                <View style={s.divider} />
                <Stepper label="Skala liczby" value={countdownsDraft.numberScale} min={0.7} max={1.8} step={0.1} decimals={1}
                  onChange={v => setCountdownsDraft({ numberScale: v })} />
              </>
            )}
            <View style={s.divider} />
            <Stepper label="Widocznych pozycji" value={countdownsDraft.maxVisible} min={1} max={6} step={1}
              onChange={v => setCountdownsDraft({ maxVisible: v })} />
          </View>
        ) : activeCard === 'since' ? (
          <View style={s.card}>
            {/* Zaokrąglenie/skala liczby mają sens TYLKO dla wariantów z własnym tłem wiersza/
                dużą liczbą (§362) — 'compact' nie ma tła, 'minimal' nie skaluje przez to pole
                (osobna, mniejsza DisplayText). */}
            {(sinceDraft.layoutPreset === 'row' || sinceDraft.layoutPreset === 'bar') && (
              <>
                <Stepper label="Zaokrąglenie wiersza" value={sinceDraft.rowRadius} min={0} max={28} step={2}
                  onChange={v => setSinceDraft({ rowRadius: v })} />
                <View style={s.divider} />
              </>
            )}
            {sinceDraft.layoutPreset === 'row' && (
              <>
                <Stepper label="Skala liczby" value={sinceDraft.numberScale} min={0.7} max={1.5} step={0.1} decimals={1}
                  onChange={v => setSinceDraft({ numberScale: v })} />
                <View style={s.divider} />
              </>
            )}
            <Stepper label="Widocznych pozycji" value={sinceDraft.maxVisible} min={1} max={10} step={1}
              onChange={v => setSinceDraft({ maxVisible: v })} />
          </View>
        ) : activeCard === 'notes' ? (
          <View style={s.card}>
            <Stepper label="Widocznych notatek" value={notesDraft.maxVisible} min={1} max={8} step={1}
              onChange={v => setNotesDraft({ maxVisible: v })} />
            <View style={s.divider} />
            <View style={s.row}>
              <Text style={s.rowLabel}>Podgląd treści</Text>
              <Switch value={notesDraft.showBody} onValueChange={v => { haptic.tap(); setNotesDraft({ showBody: v }); }}
                trackColor={{ false: c.border.default, true: c.accent.blue }} />
            </View>
            {/* Tagi (§363, fix §366) — wariant 'compact' (`NotesTile.tsx`) nigdy nie renderuje
                tagów — przełącznik tam był martwym no-opem. */}
            {notesDraft.layoutPreset !== 'compact' && (
              <>
                <View style={s.divider} />
                <View style={s.row}>
                  <Text style={s.rowLabel}>Tagi</Text>
                  <Switch value={notesDraft.showTags} onValueChange={v => { haptic.tap(); setNotesDraft({ showTags: v }); }}
                    trackColor={{ false: c.border.default, true: c.accent.blue }} />
                </View>
              </>
            )}
          </View>
        ) : activeCard === 'gcal' ? (
          <View style={s.card}>
            <Stepper label="Widocznych na sekcję" value={gcalDraft.maxVisible} min={1} max={10} step={1}
              onChange={v => setGcalDraft({ maxVisible: v })} />
            <View style={s.divider} />
            <View style={s.row}>
              <Text style={s.rowLabel}>Godzina</Text>
              <Switch value={gcalDraft.showTime} onValueChange={v => { haptic.tap(); setGcalDraft({ showTime: v }); }}
                trackColor={{ false: c.border.default, true: c.accent.blue }} />
            </View>
            <View style={s.divider} />
            <View style={s.row}>
              <Text style={s.rowLabel}>Kolorowa kropka</Text>
              <Switch value={gcalDraft.showDot} onValueChange={v => { haptic.tap(); setGcalDraft({ showDot: v }); }}
                trackColor={{ false: c.border.default, true: c.accent.blue }} />
            </View>
          </View>
        ) : (
          <View style={s.card}>
            <Stepper label="Zaokrąglenie rogów"
              value={activeCard === 'streaks' ? streaksDraft.cornerRadius : recordsDraft.cornerRadius} min={0} max={32} step={2}
              onChange={v => activeCard === 'streaks' ? setStreaksDraft({ cornerRadius: v }) : setRecordsDraft({ cornerRadius: v })} />
            {/* Proporcje kafelka (§364) — dotyczą TYLKO siatki kwadratów (`aspectRatio` na
                `s.tile`), 'list' u Rekordów renderuje wiersze bez tego pola. */}
            {!(activeCard === 'records' && recordsDraft.layoutPreset === 'list') && (
              <>
                <View style={s.divider} />
                <Stepper label="Proporcje kafelka"
                  value={activeCard === 'streaks' ? streaksDraft.aspectRatio : recordsDraft.aspectRatio} min={1.1} max={2.6} step={0.1} decimals={1}
                  onChange={v => activeCard === 'streaks' ? setStreaksDraft({ aspectRatio: v }) : setRecordsDraft({ aspectRatio: v })} />
              </>
            )}
            {/* Skala liczby nie ma odpowiednika w stylu "Pierścień" — RingCountdown rysuje
                liczbę dni sam, w swojej własnej skali (patrz §334). */}
            {!(activeCard === 'streaks' && streaksDraft.layoutPreset === 'ring') && (
              <>
                <View style={s.divider} />
                <Stepper label="Skala liczby"
                  value={activeCard === 'streaks' ? streaksDraft.numberScale : recordsDraft.numberScale} min={0.7} max={1.5} step={0.1} decimals={1}
                  onChange={v => activeCard === 'streaks' ? setStreaksDraft({ numberScale: v }) : setRecordsDraft({ numberScale: v })} />
              </>
            )}
            {activeCard === 'streaks' && (
              <>
                <View style={s.divider} />
                <Stepper label="Odstęp między kafelkami" value={streaksDraft.tileGap} min={0} max={20} step={2}
                  onChange={v => setStreaksDraft({ tileGap: v })} />
              </>
            )}
          </View>
        )}

        {activeCard === 'streaks' ? (
          <>
            {/* Tło i warstwy / Pozycja i warstwy dotyczą WYŁĄCZNIE klasycznego kafla —
                "Pierścień" (§334) i "Pasek akcentu" (§335) mają własne, stałe zasady
                gradientu/rogu płomienia, nie korzystają z tych pól (poza showFlame/
                contentAlign u paska — upraszczam i chowam całość razem z resztą, żeby nie
                mnożyć warunków pole-po-polu; wartości zostają zapamiętane na później). */}
            {streaksDraft.layoutPreset === 'classic' && (<>
            <Text style={s.sectionLabel}>Tło i warstwy</Text>
            <View style={s.card}>
              <View style={s.row}>
                <Text style={s.rowLabel}>Tło</Text>
                <View style={s.segmented}>
                  {([['gradient', 'Gradient'], ['flat', 'Płasko']] as [StreakTileStyle['gradientMode'], string][]).map(([m, lbl]) => {
                    const on = streaksDraft.gradientMode === m;
                    return (
                      <TouchableOpacity key={m} onPress={() => { haptic.tap(); setStreaksDraft({ gradientMode: m }); }}
                        style={[s.segBtn, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                        <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.rowLabel}>Pasek postępu</Text>
                <Switch value={streaksDraft.showProgressBar} onValueChange={v => { haptic.tap(); setStreaksDraft({ showProgressBar: v }); }}
                  trackColor={{ false: c.border.default, true: c.accent.blue }} />
              </View>
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.rowLabel}>Płomień w tle</Text>
                <Switch value={streaksDraft.showFlame} onValueChange={v => { haptic.tap(); setStreaksDraft({ showFlame: v }); }}
                  trackColor={{ false: c.border.default, true: c.accent.blue }} />
              </View>
            </View>

            <Text style={s.sectionLabel}>Pozycja i warstwy</Text>
            <View style={s.card}>
              <View style={[s.row, { alignItems: 'flex-start' }]}>
                <Text style={s.rowLabel}>Róg płomienia</Text>
                <View style={s.cornerGrid}>
                  {([['tl', '↖'], ['tr', '↗'], ['bl', '↙'], ['br', '↘']] as [FlameCorner, string][]).map(([m, sym]) => {
                    const on = streaksDraft.flameCorner === m;
                    return (
                      <TouchableOpacity key={m} onPress={() => { haptic.tap(); setStreaksDraft({ flameCorner: m }); }}
                        style={[s.cornerBtn, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                        <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{sym}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.rowLabel}>Płomień na wierzchu</Text>
                <Switch value={streaksDraft.flameOnTop} onValueChange={v => { haptic.tap(); setStreaksDraft({ flameOnTop: v }); }}
                  trackColor={{ false: c.border.default, true: c.accent.blue }} />
              </View>
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.rowLabel}>Wyrównanie treści</Text>
                <View style={s.segmented}>
                  {([['left', 'Do lewej'], ['center', 'Środek']] as [StreakTileStyle['contentAlign'], string][]).map(([m, lbl]) => {
                    const on = streaksDraft.contentAlign === m;
                    return (
                      <TouchableOpacity key={m} onPress={() => { haptic.tap(); setStreaksDraft({ contentAlign: m }); }}
                        style={[s.segBtn, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                        <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>
            </>)}

            {/* Paleta progów (§333) — kolor KAŻDEGO z 8 progów serii nadpisywalny osobno.
                Progi (minimalna liczba dni) NIE są tu edytowalne, tylko kolor — patrz komentarz
                w streakTileStyleStore.ts. */}
            <Text style={s.sectionLabel}>Paleta progów</Text>
            <View style={s.card}>
              {STREAK_TIERS.map((tier, i) => {
                const current = streaksDraft.tierColorOverrides?.[i] ?? tier.color;
                return (
                  <View key={tier.name}>
                    {i > 0 && <View style={s.divider} />}
                    <View style={{ paddingVertical: spacing[1] }}>
                      <Text style={s.rowLabel}>{tier.name} <Text style={{ color: c.text.muted, fontWeight: '400' }}>od {tier.min} dni</Text></Text>
                      <View style={{ marginTop: 6 }}>
                        <ColorSwatchPicker
                          presets={TIER_COLOR_PRESETS}
                          current={current}
                          onSelect={(hex) => setTierColor(i, hex)}
                          onReset={() => setTierColor(i, null)}
                        />
                      </View>
                    </View>
                  </View>
                );
              })}
            </View>

            {/* Przepinanie nawigacji (§330) — TYLKO dla kafelków nawyków: to jedyne miejsce,
                gdzie appka ma DWA sensowne, bezpieczne cele (kalendarz wody / kalendarz roku).
                Liczniki (c:) i ćwiczenia (ex:) mają jeden, stały cel — nie ma tu czego wybierać. */}
            {habitStreaks.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Cel po kliknięciu</Text>
                <View style={s.card}>
                  {habitStreaks.map((h, i) => {
                    const habitId = h.key.slice(2);
                    const current = streaksDraft.habitCalendarOverrides?.[habitId] ?? (h.kind === 'water' ? 'water' : 'year');
                    return (
                      <View key={h.key}>
                        {i > 0 && <View style={s.divider} />}
                        <View style={[s.row, { alignItems: 'flex-start' }]}>
                          <Text style={s.rowLabel} numberOfLines={1}>{h.name}</Text>
                          <View style={s.segmented}>
                            {([['water', 'Wody'], ['year', 'Roku']] as [HabitCalendarStyle, string][]).map(([m, lbl]) => {
                              const on = current === m;
                              return (
                                <TouchableOpacity key={m} onPress={() => { haptic.tap(); setHabitCalendarOverride(habitId, m); }}
                                  style={[s.segBtn, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
                                  <Text style={[s.segTxt, on && { color: c.accent.blue }]}>{lbl}</Text>
                                </TouchableOpacity>
                              );
                            })}
                          </View>
                        </View>
                      </View>
                    );
                  })}
                </View>
              </>
            )}
          </>
        ) : activeCard === 'records' ? (
          <>
            <Text style={s.sectionLabel}>Kolor i warstwy</Text>
            <View style={s.card}>
              <View style={{ paddingVertical: spacing[1] }}>
                <Text style={s.rowLabel}>Kolor akcentu</Text>
                <View style={{ marginTop: 6 }}>
                  <ColorSwatchPicker
                    presets={RECORD_COLOR_PRESETS}
                    current={recordsDraft.accentColor}
                    onSelect={(hex) => setRecordsDraft({ accentColor: hex })}
                  />
                </View>
              </View>
              {/* 'list' (§364) — wiersze mają własną, zawsze-widoczną małą ikonkę, nie
                  watermark w tle jak hero/grid — przełącznik tam nie ma zastosowania. */}
              {recordsDraft.layoutPreset !== 'list' && (
                <>
                  <View style={s.divider} />
                  <View style={s.row}>
                    <Text style={s.rowLabel}>Ikona w tle</Text>
                    <Switch value={recordsDraft.showBgIcon} onValueChange={v => { haptic.tap(); setRecordsDraft({ showBgIcon: v }); }}
                      trackColor={{ false: c.border.default, true: c.accent.blue }} />
                  </View>
                </>
              )}
            </View>
          </>
        ) : activeCard === 'since' ? (
          <>
            {/* "Liczniki" (§337) nie ma koloru akcentu (kolor wiersza pochodzi z progu serii,
                ten sam `streakColor()` co "Twoje serie" — zmiana tego TU wymagałaby tej samej
                izolacji co `tierColorOverrides`, nie robię teraz bez osobnej decyzji) — tylko
                poświata da się wyłączyć. Poświata (§362, fix §366) — WYŁĄCZNIE wariant 'row'
                (default) ją renderuje (`SinceCountersCard.tsx`'s `RadialGlow` żyje tylko w tej
                gałęzi) — przełącznik dla innych wariantów był martwym no-opem, więc sekcja
                pokazuje się TYLKO dla 'row'. */}
            {sinceDraft.layoutPreset === 'row' && (
              <>
                <Text style={s.sectionLabel}>Warstwy</Text>
                <View style={s.card}>
                  <View style={s.row}>
                    <Text style={s.rowLabel}>Poświata</Text>
                    <Switch value={sinceDraft.showGlow} onValueChange={v => { haptic.tap(); setSinceDraft({ showGlow: v }); }}
                      trackColor={{ false: c.border.default, true: c.accent.blue }} />
                  </View>
                </View>
              </>
            )}
          </>
        ) : null}

        <View style={s.actionsRow}>
          <TouchableOpacity onPress={doDiscard} style={s.ghostBtn} disabled={!isDirty}>
            <Text style={[s.ghostBtnTxt, !isDirty && { opacity: 0.4 }]}>Cofnij zmiany</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={doResetDefault} style={s.ghostBtn} disabled={!isDefault}>
            <RotateCcw size={13} color={c.text.secondary} style={{ opacity: isDefault ? 1 : 0.4 }} />
            <Text style={[s.ghostBtnTxt, !isDefault && { opacity: 0.4 }]}>Domyślne</Text>
          </TouchableOpacity>
        </View>
        <Text style={s.hint}>
          Zmiany widzisz tylko tutaj, dopóki nie klikniesz „Wdróż" — prawdziwy dashboard
          dalej wygląda jak dziś.
        </Text>
      </ScrollView>

      <Modal visible={fullPreview} animationType="slide" presentationStyle="fullScreen"
        statusBarTranslucent onRequestClose={() => setFullPreview(false)}>
        <SafeAreaView style={[s.fullSafe, { backgroundColor: c.bg.primary }]} edges={['top', 'bottom']}>
          <TouchableOpacity onPress={() => { haptic.tap(); setFullPreview(false); }} style={s.fullCloseBtn} hitSlop={10}>
            <X size={18} color={c.text.secondary} />
          </TouchableOpacity>
          <View style={s.fullBody}>
            {activeCard === 'streaks'
              ? <StreakWallCard streaks={realStreaks} cardBg={c.bg.card} styleOverride={streaksDraft} />
              : activeCard === 'records'
              ? <PersonalRecordsCard records={realRecords} cardBg={c.bg.card} styleOverride={recordsDraft} />
              : activeCard === 'countdowns'
              ? <CountdownsCard countdowns={realCountdowns} cardBg={c.bg.card} accentColor={timeAccentColor} styleOverride={countdownsDraft} />
              : activeCard === 'since'
              ? <SinceCountersCard since={realSince} cardBg={c.bg.card} accentColor={timeAccentColor} styleOverride={sinceDraft} />
              : activeCard === 'notes'
              ? <PinnedNotesCard notes={realPinnedNotes} cardBg={c.bg.card} accentColor={timeAccentColor} styleOverride={notesDraft} />
              : <GCalCard today={realGcalToday} tomorrow={realGcalTomorrow} cardBg={c.bg.card} styleOverride={gcalDraft} />}
          </View>
          <Text style={s.fullHint}>Cofnij (gest/przycisk) albo ✕, żeby wyjść</Text>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  safe: { flex: 1, backgroundColor: c.bg.primary },
  header: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between',
    paddingHorizontal: spacing[4], paddingVertical: spacing[3],
  },
  closeBtn: { width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center', backgroundColor: c.bg.elevated },
  title: { fontFamily: fonts.label, fontSize: 14, fontWeight: '800', color: c.text.primary },
  deployBtn: {
    flexDirection: 'row', alignItems: 'center', gap: 5, backgroundColor: c.accent.blue,
    borderRadius: radius.full, paddingHorizontal: 14, paddingVertical: 8,
  },
  deployTxt: { fontSize: 13, fontWeight: '800', color: '#fff' },

  tabs: { flexDirection: 'row', gap: 8, paddingHorizontal: spacing[4], paddingBottom: spacing[2] },
  tabBtn: { alignItems: 'center', paddingVertical: 8, paddingHorizontal: 14, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  tabTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },

  scroll: { paddingHorizontal: spacing[4], paddingBottom: spacing[6], gap: spacing[2] },
  sectionLabel: {
    fontFamily: fonts.label, fontSize: 11, fontWeight: '800', color: c.text.muted,
    textTransform: 'uppercase', letterSpacing: 0.8, marginTop: spacing[4], marginBottom: spacing[1],
  },
  previewWrap: { backgroundColor: c.bg.primary, borderRadius: radius.lg, padding: spacing[2] },
  fullBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6,
    marginTop: spacing[2], paddingVertical: 9, borderRadius: radius.md,
    borderWidth: 1, borderColor: c.border.default,
  },
  fullBtnTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },

  card: { backgroundColor: c.bg.card, borderRadius: radius.xl, borderWidth: 1, borderColor: c.border.card, padding: spacing[3] },
  row: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: spacing[2] },
  rowLabel: { fontSize: 13, fontWeight: '600', color: c.text.primary, flex: 1 },
  divider: { height: 1, backgroundColor: c.border.subtle },

  segmented: { flexDirection: 'row', gap: 6 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  segTxt: { fontSize: 12, fontWeight: '700', color: c.text.secondary },

  cornerGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, width: 76, justifyContent: 'flex-end' },
  cornerBtn: { width: 34, height: 34, alignItems: 'center', justifyContent: 'center', borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },

  actionsRow: { flexDirection: 'row', gap: spacing[2], marginTop: spacing[4] },
  ghostBtn: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 6, paddingVertical: 10, borderRadius: radius.md, backgroundColor: c.bg.elevated },
  ghostBtnTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },
  hint: { fontSize: 11, color: c.text.muted, textAlign: 'center', marginTop: spacing[3], lineHeight: 15 },

  fullSafe: { flex: 1 },
  fullCloseBtn: {
    width: 34, height: 34, borderRadius: 17, alignItems: 'center', justifyContent: 'center',
    backgroundColor: c.bg.elevated, marginLeft: spacing[4], marginTop: spacing[2],
  },
  fullBody: { flex: 1, justifyContent: 'center', paddingHorizontal: spacing[4] },
  fullHint: { fontSize: 11, color: c.text.muted, textAlign: 'center', marginBottom: spacing[3] },
}));
