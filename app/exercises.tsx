import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router } from 'expo-router';
import { ChevronLeft, Check, Dumbbell, Flame, Activity, Timer, Sparkles, Bike, Settings as SettingsIcon } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import StreakFlame from '@/components/counters/StreakFlame';
import { useProfileStore } from '@/store/profileStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { ageFrom, targetsFor, TRAINING_EXERCISES, TrainingExercise, PersonalQuestTargets, amountLoggedOn, exerciseStreakFrom } from '@/utils/personalQuests';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

// Ekran "Ćwiczenia" w Zdrowiu (2026-10-14, faza 2 — patrz ARCHITECTURE.md §310) — user:
// "chciałem żeby z PUPILA USUNĄĆ ćwiczenia i zamiast tego dodać w zdrowiu zakładkę albo
// kafelek... zaznaczać ile czego się zrobiło ile czasu". Loguje do `exercisesStore`
// (elastyczny log — dowolna ilość, SUMUJE się w ciągu dnia, nie nadpisuje jak stary
// binarny self-report w petStore.ts). Ikony — TE SAME co `TRAINING_ICON` w
// pet-quests.tsx (ciągłość wizualna ze starym miejscem) — czysto orientacyjny placeholder,
// user obiecał wysłać prawdziwe grafiki stick-man na czacie, podmiana później bez zmiany
// struktury (tylko `icon` → `Image`).
//
// CELOWO NIE (jeszcze) w tej zmianie: podpięcie pod silnik nagród (monety/XP) ani usunięcie
// starej sekcji "Trening" z pet-quests.tsx — plan w NEXT_STEPS.md, kolejna zmiana dopiero
// gdy to tu udowodni się na urządzeniu. Oba systemy żyją więc chwilowo RÓWNOLEGLE (stary
// self-report w Pupilu dalej daje nagrody; ten log to na razie czysta historia + streak).
interface ExerciseMeta { id: TrainingExercise; label: string; unit: string; icon: typeof Dumbbell; target: (t: PersonalQuestTargets) => number }
const EXERCISES: ExerciseMeta[] = [
  { id: 'pushups', label: 'Pompki',       unit: 'powt.', icon: Dumbbell,  target: t => t.pushups },
  { id: 'squats',  label: 'Przysiady',    unit: 'powt.', icon: Flame,     target: t => t.squats },
  { id: 'situps',  label: 'Brzuszki',     unit: 'powt.', icon: Activity,  target: t => t.situps },
  { id: 'plank',   label: 'Deska',        unit: 's',     icon: Timer,     target: t => t.plankSeconds },
  { id: 'stretch', label: 'Rozciąganie',  unit: 'min',   icon: Sparkles,  target: t => t.stretchMinutes },
  { id: 'bike',    label: 'Rower',        unit: 'min',   icon: Bike,      target: t => t.bikeMinutes },
];

export default function ExercisesScreen() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { birthdate, gender, trainingLevel } = useProfileStore();
  const logs = useExercisesStore((st) => st.logs);
  const addLog = useExercisesStore((st) => st.addLog);
  const [inputs, setInputs] = useState<Record<string, string>>({});

  const today = todayISO();
  const targets = useMemo(
    () => (trainingLevel ? targetsFor(trainingLevel, ageFrom(birthdate), gender) : null),
    [trainingLevel, birthdate, gender],
  );
  const streak = useMemo(() => exerciseStreakFrom(logs, today), [logs, today]);

  const save = (ex: ExerciseMeta) => {
    const raw = inputs[ex.id];
    const amount = parseFloat((raw ?? '').replace(',', '.'));
    if (!raw || isNaN(amount) || amount <= 0) return;
    addLog(ex.id, amount);
    setInputs((prev) => ({ ...prev, [ex.id]: '' }));
    haptic.success();
    toast.success(`Zapisano: ${ex.label} +${amount} ${ex.unit}`);
  };

  const quickAdd = (ex: ExerciseMeta, amount: number) => {
    addLog(ex.id, amount);
    haptic.success();
    toast.success(`Zapisano: ${ex.label} +${amount} ${ex.unit}`);
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle}>Ćwiczenia</Text>
        <View style={s.streakPill}>
          <StreakFlame days={streak} size={28} />
        </View>
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

        {EXERCISES.map((ex) => {
          const Icon = ex.icon;
          const target = targets ? ex.target(targets) : null;
          const todayAmt = amountLoggedOn(logs, ex.id, today);
          const done = target != null && todayAmt >= target;
          return (
            <View key={ex.id} style={[s.card, done && s.cardDone]}>
              <View style={s.cardHead}>
                <View style={s.iconWrap}><Icon size={18} color="#FB923C" /></View>
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
            </View>
          );
        })}

        <View style={s.hintBox}>
          <Text style={s.hintTxt}>
            Seria liczy dowolny zalogowany dzień — nie musisz robić wszystkich ćwiczeń naraz.
            Monety/XP za trening na razie dalej czekają w Pupil → Zadania.
          </Text>
        </View>
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

  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], gap: spacing[2] },
  cardDone: { borderColor: '#2AC68F55', backgroundColor: '#2AC68F0D' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 10 },
  iconWrap: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: '#FB923C1F', alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  cardSub: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },
  quickBtn: { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: '#2AC68F', borderRadius: radius.full, paddingHorizontal: 10, paddingVertical: 7 },
  quickBtnTxt: { fontSize: 11.5, fontWeight: '800', color: '#07160F' },

  inputRow: { flexDirection: 'row', gap: spacing[2] },
  input: { flex: 1, backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5, color: c.text.primary },
  saveBtn: { backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: 16, justifyContent: 'center' },
  saveBtnTxt: { fontSize: 13, fontWeight: '800', color: c.text.secondary },

  hintBox: { padding: spacing[3], borderRadius: radius.lg, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.subtle },
  hintTxt: { fontSize: 11.5, color: c.text.muted, lineHeight: 16, textAlign: 'center' },
}));
