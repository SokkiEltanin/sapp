import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TouchableOpacity, Modal, Switch } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { X, Minus, Plus, Maximize2, RotateCcw, Check } from 'lucide-react-native';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { spacing, radius, fonts } from '@/theme';
import { haptic } from '@/utils/haptics';
import { useHabits } from '@/hooks/useHabits';
import { useCounters, autoDaysWithout, isOver, daysUntil, isDuringEvent } from '@/store/countersStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useFoodStore } from '@/store/foodStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useMoodStore } from '@/store/moodStore';
import { useDayKey } from '@/hooks/useDayKey';
import { useTimeAccent } from '@/hooks/useTimeAccent';
import { exerciseStreakFrom } from '@/utils/personalQuests';
import { buildRecords } from '@/utils/personalRecords';
import StreakWallCard, { StreakItem } from '@/components/dashboard/StreakWallCard';
import PersonalRecordsCard from '@/components/dashboard/PersonalRecordsCard';
import CountdownsCard from '@/components/dashboard/CountdownsCard';
import { useStreakTileStyleStore, StreakTileStyle, HabitCalendarStyle, DEFAULT_STREAK_TILE_STYLE } from '@/store/streakTileStyleStore';
import { useRecordsTileStyleStore, DEFAULT_RECORDS_TILE_STYLE } from '@/store/recordsTileStyleStore';
import { useCountdownsTileStyleStore, DEFAULT_COUNTDOWNS_TILE_STYLE } from '@/store/countdownsTileStyleStore';

type CardKey = 'streaks' | 'records' | 'countdowns';
const CARD_TABS: { key: CardKey; label: string }[] = [
  { key: 'streaks', label: 'Twoje serie' },
  { key: 'records', label: 'Rekordy' },
  { key: 'countdowns', label: 'Odliczania' },
];
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
// siatki kafelków). Pełna wizja z NEXT_STEPS.md (edycja KAŻDEGO panelu, przepinanie nawigacji
// kafelek→ekran, warstwy/justowanie) to kolejne fazy — rozszerzające ten sam wzorzec na kolejne
// karty, nie przepisujące go od nowa.
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

  const isDirty = activeCard === 'streaks'
    ? JSON.stringify(streaksDraft) !== JSON.stringify(streaksLive)
    : activeCard === 'records'
    ? JSON.stringify(recordsDraft) !== JSON.stringify(recordsLive)
    : JSON.stringify(countdownsDraft) !== JSON.stringify(countdownsLive);
  const isDefault = activeCard === 'streaks'
    ? JSON.stringify(streaksDraft) !== JSON.stringify(DEFAULT_STREAK_TILE_STYLE)
    : activeCard === 'records'
    ? JSON.stringify(recordsDraft) !== JSON.stringify(DEFAULT_RECORDS_TILE_STYLE)
    : JSON.stringify(countdownsDraft) !== JSON.stringify(DEFAULT_COUNTDOWNS_TILE_STYLE);

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
  const { color: timeAccentColor } = useTimeAccent();

  const doPublish = () => {
    haptic.success();
    if (activeCard === 'streaks') publishStreaks();
    else if (activeCard === 'records') publishRecords();
    else publishCountdowns();
  };
  const doDiscard = () => {
    haptic.tap();
    if (activeCard === 'streaks') discardStreaksDraft();
    else if (activeCard === 'records') discardRecordsDraft();
    else discardCountdownsDraft();
  };
  const doResetDefault = () => {
    haptic.tap();
    if (activeCard === 'streaks') resetStreaksDefault();
    else if (activeCard === 'records') resetRecordsDefault();
    else resetCountdownsDefault();
  };

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

      <View style={s.tabs}>
        {CARD_TABS.map(t => {
          const on = activeCard === t.key;
          return (
            <TouchableOpacity key={t.key} onPress={() => { haptic.tap(); setActiveCard(t.key); }}
              style={[s.tabBtn, on && { backgroundColor: c.accent.blue + '22', borderColor: c.accent.blue }]}>
              <Text style={[s.tabTxt, on && { color: c.accent.blue }]}>{t.label}</Text>
            </TouchableOpacity>
          );
        })}
      </View>

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.sectionLabel}>
          Podgląd — „{activeCard === 'streaks' ? 'Twoje serie' : activeCard === 'records' ? 'Rekordy życiowe' : 'Odliczania'}" (prawdziwe dane)
        </Text>
        <View style={s.previewWrap}>
          {activeCard === 'streaks'
            ? <StreakWallCard streaks={realStreaks} cardBg={c.bg.card} styleOverride={streaksDraft} />
            : activeCard === 'records'
            ? <PersonalRecordsCard records={realRecords} cardBg={c.bg.card} styleOverride={recordsDraft} />
            : <CountdownsCard countdowns={realCountdowns} cardBg={c.bg.card} accentColor={timeAccentColor} styleOverride={countdownsDraft} />}
        </View>
        {activeCard === 'countdowns' && realCountdowns.length === 0 && (
          <Text style={s.hint}>Brak aktywnych odliczań na koncie — dodaj jedno w Licznikach, żeby zobaczyć realny podgląd.</Text>
        )}
        <TouchableOpacity onPress={() => { haptic.tap(); setFullPreview(true); }} style={s.fullBtn}>
          <Maximize2 size={14} color={c.text.secondary} />
          <Text style={s.fullBtnTxt}>Podgląd pełnoekranowy</Text>
        </TouchableOpacity>

        <Text style={s.sectionLabel}>Kształt</Text>
        {activeCard === 'countdowns' ? (
          <View style={s.card}>
            <Stepper label="Zaokrąglenie rogów" value={countdownsDraft.cornerRadius} min={0} max={32} step={2}
              onChange={v => setCountdownsDraft({ cornerRadius: v })} c={c} s={s} />
            <View style={s.divider} />
            <Stepper label="Rozmiar pierścienia" value={countdownsDraft.ringSize} min={40} max={88} step={4}
              onChange={v => setCountdownsDraft({ ringSize: v })} c={c} s={s} />
            <View style={s.divider} />
            <Stepper label="Grubość pierścienia" value={countdownsDraft.ringStrokeWidth} min={2} max={12} step={1}
              onChange={v => setCountdownsDraft({ ringStrokeWidth: v })} c={c} s={s} />
            <View style={s.divider} />
            <Stepper label="Widocznych pozycji" value={countdownsDraft.maxVisible} min={1} max={6} step={1}
              onChange={v => setCountdownsDraft({ maxVisible: v })} c={c} s={s} />
          </View>
        ) : (
          <View style={s.card}>
            <Stepper label="Zaokrąglenie rogów"
              value={activeCard === 'streaks' ? streaksDraft.cornerRadius : recordsDraft.cornerRadius} min={0} max={32} step={2}
              onChange={v => activeCard === 'streaks' ? setStreaksDraft({ cornerRadius: v }) : setRecordsDraft({ cornerRadius: v })} c={c} s={s} />
            <View style={s.divider} />
            <Stepper label="Proporcje kafelka"
              value={activeCard === 'streaks' ? streaksDraft.aspectRatio : recordsDraft.aspectRatio} min={1.1} max={2.6} step={0.1} decimals={1}
              onChange={v => activeCard === 'streaks' ? setStreaksDraft({ aspectRatio: v }) : setRecordsDraft({ aspectRatio: v })} c={c} s={s} />
            <View style={s.divider} />
            <Stepper label="Skala liczby"
              value={activeCard === 'streaks' ? streaksDraft.numberScale : recordsDraft.numberScale} min={0.7} max={1.5} step={0.1} decimals={1}
              onChange={v => activeCard === 'streaks' ? setStreaksDraft({ numberScale: v }) : setRecordsDraft({ numberScale: v })} c={c} s={s} />
          </View>
        )}

        {activeCard === 'streaks' ? (
          <>
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

            {/* Przepinanie nawigacji (§330) — TYLKO dla kafelków nawyków: to jedyne miejsce,
                gdzie appka ma DWA sensowne, bezpieczne cele (kalendarz wody / kalendarz roku).
                Liczniki (c:) i ćwiczenia (ex:) mają jeden, stały cel — nie ma tu czego wybierać. */}
            {habitStreaks.length > 0 && (
              <>
                <Text style={s.sectionLabel}>Cel po kliknięciu</Text>
                <View style={s.card}>
                  {habitStreaks.map((h, i) => {
                    const habitId = h.key.slice(2);
                    const current = streaksDraft.habitCalendarOverrides[habitId] ?? (h.kind === 'water' ? 'water' : 'year');
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
              <View style={[s.row, { alignItems: 'flex-start' }]}>
                <Text style={s.rowLabel}>Kolor akcentu</Text>
                <View style={s.swatchRow}>
                  {RECORD_COLOR_PRESETS.map(hex => {
                    const on = recordsDraft.accentColor === hex;
                    return (
                      <TouchableOpacity key={hex} onPress={() => { haptic.tap(); setRecordsDraft({ accentColor: hex }); }}
                        style={[s.swatch, { backgroundColor: hex }, on && s.swatchOn]} />
                    );
                  })}
                </View>
              </View>
              <View style={s.divider} />
              <View style={s.row}>
                <Text style={s.rowLabel}>Ikona w tle</Text>
                <Switch value={recordsDraft.showBgIcon} onValueChange={v => { haptic.tap(); setRecordsDraft({ showBgIcon: v }); }}
                  trackColor={{ false: c.border.default, true: c.accent.blue }} />
              </View>
            </View>
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
              : <CountdownsCard countdowns={realCountdowns} cardBg={c.bg.card} accentColor={timeAccentColor} styleOverride={countdownsDraft} />}
          </View>
          <Text style={s.fullHint}>Cofnij (gest/przycisk) albo ✕, żeby wyjść</Text>
        </SafeAreaView>
      </Modal>
    </SafeAreaView>
  );
}

function Stepper({ label, value, min, max, step, decimals = 0, onChange, c, s }: {
  label: string; value: number; min: number; max: number; step: number; decimals?: number;
  onChange: (v: number) => void; c: any; s: any;
}) {
  const dec = (delta: number) => {
    haptic.tap();
    const next = Math.min(max, Math.max(min, Math.round((value + delta) * 100) / 100));
    onChange(next);
  };
  return (
    <View style={s.row}>
      <Text style={s.rowLabel}>{label}</Text>
      <View style={s.stepperRow}>
        <TouchableOpacity onPress={() => dec(-step)} style={s.stepBtn} disabled={value <= min}>
          <Minus size={14} color={value <= min ? c.text.muted : c.text.primary} />
        </TouchableOpacity>
        <Text style={s.stepVal}>{value.toFixed(decimals)}</Text>
        <TouchableOpacity onPress={() => dec(step)} style={s.stepBtn} disabled={value >= max}>
          <Plus size={14} color={value >= max ? c.text.muted : c.text.primary} />
        </TouchableOpacity>
      </View>
    </View>
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
  tabBtn: { flex: 1, alignItems: 'center', paddingVertical: 8, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  tabTxt: { fontSize: 12.5, fontWeight: '700', color: c.text.secondary },

  swatchRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8, flex: 1, justifyContent: 'flex-end' },
  swatch: { width: 26, height: 26, borderRadius: 13, borderWidth: 2, borderColor: 'transparent' },
  swatchOn: { borderColor: c.text.primary },

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

  stepperRow: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  stepBtn: { width: 28, height: 28, borderRadius: 14, backgroundColor: c.bg.elevated, alignItems: 'center', justifyContent: 'center' },
  stepVal: { fontSize: 13, fontWeight: '800', color: c.text.primary, minWidth: 34, textAlign: 'center', fontVariant: ['tabular-nums'] },

  segmented: { flexDirection: 'row', gap: 6 },
  segBtn: { paddingHorizontal: 10, paddingVertical: 6, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default },
  segTxt: { fontSize: 12, fontWeight: '700', color: c.text.secondary },

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
