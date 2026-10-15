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
import { useCounters, autoDaysWithout } from '@/store/countersStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useFoodStore } from '@/store/foodStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { useDayKey } from '@/hooks/useDayKey';
import { exerciseStreakFrom } from '@/utils/personalQuests';
import StreakWallCard, { StreakItem } from '@/components/dashboard/StreakWallCard';
import { useStreakTileStyleStore, StreakTileStyle, DEFAULT_STREAK_TILE_STYLE } from '@/store/streakTileStyleStore';

// Kreator dashboardu — FAZA 1 (2026-10-15, ARCHITECTURE.md §327). User: "zrobisz mi prawdziwy
// kreator w ustawieniach ze wszystkim w aplikacji... ja będę sobie robił edytował kreował
// poprawiał... a potem wdrożę". Zamiast HTML-owych makiet w Artifact (szybkie do przeglądania,
// ale user musiał kopiować wybór z powrotem do czatu, a żadna makieta HTML nie renderuje się
// tak jak RN naprawdę) — ten ekran renderuje PRAWDZIWY `StreakWallCard` z PRAWDZIWYMI danymi
// (dokładnie to samo źródło co `streakWall` w app/(tabs)/index.tsx), więc podgląd tutaj = to,
// co realnie zobaczysz po "Wdróż", co do piksela.
//
// Zakres Fazy 1 ŚWIADOMIE wąski — tylko "Twoje serie" (jeden, samodzielny komponent), nie cały
// dashboard. Pełna wizja z NEXT_STEPS.md (edycja KAŻDEGO panelu, przepinanie nawigacji kafelek→
// ekran, warstwy/justowanie) to Faza 2/3 — rozszerzające TEN SAM mechanizm (draft/live store +
// `styleOverride` prop) na kolejne karty, nie przepisujące go od nowa.
export default function DashboardTileCreator() {
  const c = useColors();
  const s = makeS(c);
  const draft = useStreakTileStyleStore(st => st.draft);
  const setDraft = useStreakTileStyleStore(st => st.setDraft);
  const publish = useStreakTileStyleStore(st => st.publish);
  const discardDraft = useStreakTileStyleStore(st => st.discardDraft);
  const resetDraftToDefault = useStreakTileStyleStore(st => st.resetDraftToDefault);
  const live = useStreakTileStyleStore(st => st.live);
  const [fullPreview, setFullPreview] = useState(false);

  const isDirty = JSON.stringify(draft) !== JSON.stringify(live);
  const isDefault = JSON.stringify(draft) !== JSON.stringify(DEFAULT_STREAK_TILE_STYLE);

  // Te same realne dane co dashboard — patrz `streakWall` w app/(tabs)/index.tsx:627. Celowo
  // NIE snapshot (CLAUDE.md §3 to dotyczy handlerów PISZĄCYCH `expenses` po paragonie — tu
  // tylko CZYTAMY do podglądu, więc żywy store jest w porządku, a nawet dokładniejszy).
  const { habits, getStreak } = useHabits();
  const counters = useCounters(st => st.counters);
  const expenses = useExpensesStore(st => st.expenses);
  const foodMeals = useFoodStore(st => st.meals);
  const foodProducts = useFoodStore(st => st.products);
  const exerciseLogs = useExercisesStore(st => st.logs);
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

  const doPublish = () => {
    haptic.success();
    publish();
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

      <ScrollView contentContainerStyle={s.scroll}>
        <Text style={s.sectionLabel}>Podgląd — „Twoje serie" (prawdziwe dane)</Text>
        <View style={s.previewWrap}>
          <StreakWallCard streaks={realStreaks} cardBg={c.bg.card} styleOverride={draft} />
        </View>
        <TouchableOpacity onPress={() => { haptic.tap(); setFullPreview(true); }} style={s.fullBtn}>
          <Maximize2 size={14} color={c.text.secondary} />
          <Text style={s.fullBtnTxt}>Podgląd pełnoekranowy</Text>
        </TouchableOpacity>

        <Text style={s.sectionLabel}>Kształt</Text>
        <View style={s.card}>
          <Stepper label="Zaokrąglenie rogów" value={draft.cornerRadius} min={0} max={32} step={2}
            onChange={v => setDraft({ cornerRadius: v })} c={c} s={s} />
          <View style={s.divider} />
          <Stepper label="Proporcje kafelka" value={draft.aspectRatio} min={1.1} max={2.6} step={0.1} decimals={1}
            onChange={v => setDraft({ aspectRatio: v })} c={c} s={s} />
          <View style={s.divider} />
          <Stepper label="Skala liczby" value={draft.numberScale} min={0.7} max={1.5} step={0.1} decimals={1}
            onChange={v => setDraft({ numberScale: v })} c={c} s={s} />
        </View>

        <Text style={s.sectionLabel}>Tło i warstwy</Text>
        <View style={s.card}>
          <View style={s.row}>
            <Text style={s.rowLabel}>Tło</Text>
            <View style={s.segmented}>
              {([['gradient', 'Gradient'], ['flat', 'Płasko']] as [StreakTileStyle['gradientMode'], string][]).map(([m, lbl]) => {
                const on = draft.gradientMode === m;
                return (
                  <TouchableOpacity key={m} onPress={() => { haptic.tap(); setDraft({ gradientMode: m }); }}
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
            <Switch value={draft.showProgressBar} onValueChange={v => { haptic.tap(); setDraft({ showProgressBar: v }); }}
              trackColor={{ false: c.border.default, true: c.accent.blue }} />
          </View>
          <View style={s.divider} />
          <View style={s.row}>
            <Text style={s.rowLabel}>Płomień w tle</Text>
            <Switch value={draft.showFlame} onValueChange={v => { haptic.tap(); setDraft({ showFlame: v }); }}
              trackColor={{ false: c.border.default, true: c.accent.blue }} />
          </View>
        </View>

        <View style={s.actionsRow}>
          <TouchableOpacity onPress={() => { haptic.tap(); discardDraft(); }} style={s.ghostBtn} disabled={!isDirty}>
            <Text style={[s.ghostBtnTxt, !isDirty && { opacity: 0.4 }]}>Cofnij zmiany</Text>
          </TouchableOpacity>
          <TouchableOpacity onPress={() => { haptic.tap(); resetDraftToDefault(); }} style={s.ghostBtn} disabled={!isDefault}>
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
            <StreakWallCard streaks={realStreaks} cardBg={c.bg.card} styleOverride={draft} />
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
