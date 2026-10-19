import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Check, Dumbbell, Flame, Activity, Timer, Sparkles, Bike, Settings as SettingsIcon, ClipboardList, ChevronRight, ChevronDown, History, CalendarDays } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import StreakFlame from '@/components/counters/StreakFlame';
import ExerciseIcon from '@/components/health/ExerciseIcon';
import ExerciseLogHistory from '@/components/health/ExerciseLogHistory';
import { useProfileStore } from '@/store/profileStore';
import { useExerciseLogging } from '@/hooks/useExerciseLogging';
import { amountLoggedOn } from '@/utils/personalQuests';
import { EXERCISE_META } from '@/utils/exerciseMeta';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import ScreenCanvas from '@/components/canvas/ScreenCanvas';
import { useCanvasComponentsStore } from '@/store/canvasComponentsStore';

// Ikony per-ekran (lucide fallbacki, `EXERCISE_META` — exerciseMeta.ts — trzyma tylko label/
// jednostkę/cel, współdzielone z builderem planów i hookiem nagród).
const ICON_FOR: Record<string, typeof Dumbbell> = {
  pushups: Dumbbell, squats: Flame, situps: Activity, plank: Timer, stretch: Sparkles, bike: Bike,
};

// Ekran "Ćwiczenia" w Zdrowiu (2026-10-14, faza 2 — patrz ARCHITECTURE.md §310) — user:
// "chciałem żeby z PUPILA USUNĄĆ ćwiczenia i zamiast tego dodać w zdrowiu zakładkę albo
// kafelek... zaznaczać ile czego się zrobiło ile czasu". Loguje do `exercisesStore`
// (elastyczny log — dowolna ilość, SUMUJE się w ciągu dnia, nie nadpisuje jak stary
// binarny self-report w petStore.ts). Ikony — `ExerciseIcon` (prawdziwe grafiki usera gdy
// dostępne, patrz exerciseIcons.ts, inaczej lucide fallback z `ICON_FOR` wyżej).
//
// Podpięte pod silnik nagród (2026-10-14, faza 3 — ARCHITECTURE.md §312, wyodrębnione do
// `useExerciseLogging.ts` w §320 żeby współdzielić z nowym ekranem sesji planu): przekroczenie
// celu woła to samo `markXDone()` (petStore) co stary self-report w pet-quests.tsx — quest
// `b_pushups`/itd. (quests.ts) zaliczy się identycznie, Odbiór monet/XP wciąż żyje w
// Pupil → Zadania (ten silnik NIE jest tu duplikowany, tylko wyzwalany z nowego miejsca).
//
// §320 — builder planów treningowych (NEXT_STEPS.md): kafelek "Moje plany" niżej prowadzi do
// `/training-plans`, gdzie user buduje własne sesje (dowolne pozycje, nie tylko tych 6) i
// odpala je na osobnym ekranie "Dzisiejsza sesja" — ten ekran się NIE zmienia poza samym
// kafelkiem-wejściem, dalej jest szybkim, zawsze-dostępnym logiem tych 6 kanonicznych ćwiczeń.
export default function ExercisesScreen() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { trainingLevel } = useProfileStore();
  const { logs, targets, streak, today, logAmount: logAmountRaw, removeLog, updateLog } = useExerciseLogging();
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [historyFor, setHistoryFor] = useState<string | null>(null);
  // Tryb pełnoekranowy płótna (§381, Faza 2b) — ten sam wzorzec co health.tsx.
  const canvasFullScreen = useCanvasComponentsStore(st => st.fullScreenScreens['exercises'] ?? false);

  const logAmount = (ex: typeof EXERCISE_META[number], amount: number) => {
    logAmountRaw({ exercise: ex.id, linkedExercise: ex.id, label: ex.label, unit: ex.unit, amount });
  };

  const save = (ex: typeof EXERCISE_META[number]) => {
    const raw = inputs[ex.id];
    const amount = parseFloat((raw ?? '').replace(',', '.'));
    if (!raw || isNaN(amount) || amount <= 0) return;
    logAmount(ex, amount);
    setInputs((prev) => ({ ...prev, [ex.id]: '' }));
  };

  const quickAdd = (ex: typeof EXERCISE_META[number], amount: number) => logAmount(ex, amount);

  // Tryb pełnoekranowy płótna (§381, Faza 2b) — gdy włączony, reszta ekranu Ćwiczeń nie
  // montuje się wcale.
  if (canvasFullScreen) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
          <Text style={s.headerTitle}>Ćwiczenia</Text>
          <View style={s.backBtn} />
        </View>
        <ScreenCanvas screenKey="exercises" title="Twoje komponenty" />
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Ćwiczenia</Text>
        <PressableScale onPress={() => { haptic.tap(); router.push('/exercises-history' as any); }} style={s.streakPill}>
          <StreakFlame days={streak} size={28} />
        </PressableScale>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {!trainingLevel && (
          <PressableScale onPress={() => { haptic.tap(); router.push('/settings' as any); }} style={s.setupBanner}>
            <SettingsIcon size={16} color="#FB923C" />
            <Text style={s.setupBannerTxt}>
              Ustaw poziom treningowy w Ustawienia → Personalizacja, żeby zobaczyć spersonalizowane cele. Logowanie działa już teraz, bez celów.
            </Text>
          </PressableScale>
        )}

        {/* Historia/kalendarz (2026-10-15, ARCHITECTURE.md §324, user: "jak wchodzę nie widze
            postępu w sensie looku na całość np tego miesiąca... nie ma historii") — pierwsze
            co widać po wejściu, nie coś do odkrycia. */}
        <PressableScale onPress={() => { haptic.tap(); router.push('/exercises-history' as any); }} style={s.plansBanner}>
          <View style={s.plansBannerIcon}><CalendarDays size={18} color="#FB923C" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.plansBannerTitle}>Historia i postęp</Text>
            <Text style={s.plansBannerSub}>Kalendarz, ten miesiąc, popraw zaległy dzień</Text>
          </View>
          <ChevronRight size={18} color={c.text.muted} />
        </PressableScale>

        <PressableScale onPress={() => { haptic.tap(); router.push('/training-plans' as any); }} style={s.plansBanner}>
          <View style={s.plansBannerIcon}><ClipboardList size={18} color="#FB923C" /></View>
          <View style={{ flex: 1 }}>
            <Text style={s.plansBannerTitle}>Moje plany treningowe</Text>
            <Text style={s.plansBannerSub}>Zbuduj własną sesję i odhaczaj pozycje</Text>
          </View>
          <ChevronRight size={18} color={c.text.muted} />
        </PressableScale>

        {EXERCISE_META.map((ex) => {
          const target = targets ? ex.target(targets) : null;
          const todayAmt = amountLoggedOn(logs, ex.id, today);
          const done = target != null && todayAmt >= target;
          return (
            <View key={ex.id} style={[s.card, done && s.cardDone]}>
              <View style={s.cardHead}>
                <View style={s.iconWrap}><ExerciseIcon id={ex.id} fallback={ICON_FOR[ex.id]} size={18} color="#FB923C" /></View>
                <View style={{ flex: 1, minWidth: 0 }}>
                  <Text style={s.cardLabel}>{ex.label}</Text>
                  <Text style={s.cardSub}>
                    Dziś: {todayAmt}{target != null ? ` / ${target}` : ''} {ex.unit}{done ? ' ✓' : ''}
                  </Text>
                </View>
                {target != null && (
                  <PressableScale onPress={() => quickAdd(ex, target)} style={s.quickBtn}>
                    <Check size={14} color="#07160F" />
                    <Text style={s.quickBtnTxt}>Cel</Text>
                  </PressableScale>
                )}
                {todayAmt > 0 && (
                  <PressableScale
                    onPress={() => { haptic.tap(); setHistoryFor((prev) => (prev === ex.id ? null : ex.id)); }}
                    style={s.historyBtn}
                  >
                    {historyFor === ex.id ? <ChevronDown size={15} color={c.text.muted} /> : <History size={15} color={c.text.muted} />}
                  </PressableScale>
                )}
              </View>
              <View style={s.inputRow}>
                <TextInput
                  style={s.input}
                  keyboardType="numeric"
                  placeholder={`Wpisz ${ex.unit}…`}
                  placeholderTextColor={c.text.muted}
                  value={inputs[ex.id] ?? ''}
                  onChangeText={(v) => setInputs((prev) => ({ ...prev, [ex.id]: v }))}
                />
                <PressableScale onPress={() => save(ex)} style={s.saveBtn}>
                  <Text style={s.saveBtnTxt}>Zapisz</Text>
                </PressableScale>
              </View>
              {historyFor === ex.id && (
                <ExerciseLogHistory
                  entries={logs.filter((l) => l.exercise === ex.id && l.date === today)}
                  unit={ex.unit}
                  onUpdate={updateLog}
                  onDelete={removeLog}
                />
              )}
            </View>
          );
        })}

        <View style={s.hintBox}>
          <Text style={s.hintTxt}>
            Seria liczy dowolny zalogowany dzień — nie musisz robić wszystkich ćwiczeń naraz.
            Monety/XP za trening na razie dalej czekają w Pupil → Zadania.
          </Text>
        </View>

        {/* Wolne płótno — system kopiowania komponentów, Faza 18 (2026-10-17). Drugi ekran
            poza Jedzeniem; świadomie NIE Nawyki/Pupil (oba już montują `useHabits()` dla
            własnej treści — drugie wywołanie przez `useAllStreakItems()` zdublowałoby jego
            własny fetch z AsyncStorage, patrz komentarz w `useAllStreakItems.ts`). Ćwiczenia
            nie montują `useHabits()`, zero ryzyka duplikacji. */}
        <ScreenCanvas screenKey="exercises" title="Twoje komponenty" />
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  streakPill: { width: 40, alignItems: 'center' },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: 60, gap: spacing[3] },

  setupBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: '#FB923C14', borderRadius: radius.lg, borderWidth: 1, borderColor: '#FB923C44', padding: spacing[3] },
  setupBannerTxt: { flex: 1, fontSize: 12, color: c.text.secondary, lineHeight: 17 },

  plansBanner: { flexDirection: 'row', alignItems: 'center', gap: 10, backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3] },
  plansBannerIcon: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: '#FB923C1F', alignItems: 'center', justifyContent: 'center' },
  plansBannerTitle: { fontSize: 13.5, fontWeight: '800', color: c.text.primary },
  plansBannerSub: { fontSize: 11, color: c.text.muted, marginTop: 1 },

  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], gap: spacing[2] },
  cardDone: { borderColor: '#2AC68F55', backgroundColor: '#2AC68F0D' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: '#FB923C1F', alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  cardSub: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2AC68F', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 7 },
  quickBtnTxt: { fontSize: 11.5, fontWeight: '800', color: '#07160F' },
  historyBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },

  inputRow: { flexDirection: 'row', gap: spacing[2] },
  input: { flex: 1, backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5, color: c.text.primary },
  saveBtn: { backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: 16, justifyContent: 'center' },
  saveBtnTxt: { fontSize: 13, fontWeight: '800', color: c.text.secondary },

  hintBox: { padding: spacing[3], borderRadius: radius.lg, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.subtle },
  hintTxt: { fontSize: 11.5, color: c.text.muted, lineHeight: 16, textAlign: 'center' },
}));
