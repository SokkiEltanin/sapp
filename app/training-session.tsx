import { useMemo, useState } from 'react';
import { View, Text, StyleSheet, ScrollView, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { router, useLocalSearchParams } from 'expo-router';
import { ChevronLeft, Check, Circle, Dumbbell, History, ChevronDown } from 'lucide-react-native';

import PressableScale from '@/components/ui/PressableScale';
import ExerciseIcon from '@/components/health/ExerciseIcon';
import ExerciseLogHistory from '@/components/health/ExerciseLogHistory';
import { useTrainingPlansStore } from '@/store/trainingPlansStore';
import { useExerciseLogging } from '@/hooks/useExerciseLogging';
import { planItemDoneToday, planItemLogKey } from '@/utils/trainingPlans';
import { amountLoggedOn } from '@/utils/personalQuests';
import { spacing, radius, typography } from '@/theme';
import { useColors } from '@/theme/useColors';
import { themedStyles } from '@/theme/themedStyles';
import { haptic } from '@/utils/haptics';

// "Dzisiejsza sesja" (2026-10-14, ARCHITECTURE.md §320) — odpalenie planu z buildera: tap na
// pozycję → inline pole z ilością wypełnione celem z planu (user: "tap otwiera pole z ilością
// do edycji"), edytowalne przed zapisem. Zapis idzie przez `useExerciseLogging` (ten sam hook
// co app/exercises.tsx) — jeśli pozycja ma `linkedExercise`, loguje się DOKŁADNIE jak ręczny
// wpis na ekranie Ćwiczenia (ten sam quest/nagroda pupila); bez `linkedExercise` loguje się
// pod własną nazwą, liczy się do serii, bez questu (patrz komentarz w trainingPlans.ts).
// "Zrobione" to NIE osobny stan sesji — czytane wprost z loga (`planItemDoneToday`), więc
// zgadza się zawsze, nawet po zamknięciu i ponownym otwarciu ekranu tego samego dnia.
export default function TrainingSessionScreen() {
  const c = useColors();
  const s = useMemo(() => makeS(c), [c]);
  const { planId } = useLocalSearchParams<{ planId?: string }>();
  const plan = useTrainingPlansStore((st) => st.plans.find((p) => p.id === planId));
  const { logs, today, logAmount, removeLog, updateLog } = useExerciseLogging();
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState('');
  const [historyFor, setHistoryFor] = useState<string | null>(null);

  if (!plan) {
    return (
      <SafeAreaView style={s.container} edges={['top']}>
        <View style={s.header}>
          <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
          <Text style={s.headerTitle}>Sesja</Text>
          <View style={{ width: 40 }} />
        </View>
        <View style={s.notFound}><Text style={s.notFoundTxt}>Nie znaleziono tego planu — mógł zostać usunięty.</Text></View>
      </SafeAreaView>
    );
  }

  const doneCount = plan.items.filter((it) => planItemDoneToday(logs, it, today)).length;
  const allDone = doneCount === plan.items.length && plan.items.length > 0;

  const openItem = (itemId: string, target: number) => {
    haptic.tap();
    setOpenId(itemId === openId ? null : itemId);
    setDraft(String(target));
  };

  const confirm = (itemId: string) => {
    const item = plan.items.find((it) => it.id === itemId);
    if (!item) return;
    const amount = parseFloat(draft.replace(',', '.'));
    if (!draft || isNaN(amount) || amount <= 0) return;
    logAmount({ exercise: planItemLogKey(item), linkedExercise: item.linkedExercise, label: item.name, unit: item.unit, amount });
    setOpenId(null);
  };

  return (
    <SafeAreaView style={s.container} edges={['top']}>
      <View style={s.header}>
        <PressableScale onPress={() => router.back()} style={s.backBtn}><ChevronLeft size={22} color={c.text.primary} /></PressableScale>
        <Text style={s.headerTitle} numberOfLines={1}>{plan.name}</Text>
        <View style={s.countPill}><Text style={s.countTxt}>{doneCount}/{plan.items.length}</Text></View>
      </View>

      <ScrollView contentContainerStyle={s.scroll} showsVerticalScrollIndicator={false}>
        {plan.items.map((it) => {
          const todayAmt = amountLoggedOn(logs, planItemLogKey(it), today);
          const done = planItemDoneToday(logs, it, today);
          const open = openId === it.id;
          return (
            <View key={it.id} style={[s.card, done && s.cardDone]}>
              <View style={s.cardHead}>
                <PressableScale onPress={() => openItem(it.id, it.targetAmount)} style={s.cardHeadMain}>
                  <View style={s.iconWrap}>
                    {it.linkedExercise
                      ? <ExerciseIcon id={it.linkedExercise} fallback={Dumbbell} size={18} color="#FB923C" />
                      : (done ? <Check size={18} color="#2AC68F" /> : <Circle size={18} color={c.text.muted} />)}
                  </View>
                  <View style={{ flex: 1, minWidth: 0 }}>
                    <Text style={s.cardLabel}>{it.name}</Text>
                    <Text style={s.cardSub}>
                      {todayAmt} / {it.targetAmount} {it.unit}{done ? ' ✓' : ''}
                    </Text>
                  </View>
                </PressableScale>
                {todayAmt > 0 && (
                  <PressableScale
                    onPress={() => { haptic.tap(); setHistoryFor((prev) => (prev === it.id ? null : it.id)); }}
                    style={s.historyBtn}
                  >
                    {historyFor === it.id ? <ChevronDown size={15} color={c.text.muted} /> : <History size={15} color={c.text.muted} />}
                  </PressableScale>
                )}
              </View>

              {open && (
                <View style={s.inputRow}>
                  <TextInput
                    style={s.input}
                    keyboardType="numeric"
                    autoFocus
                    value={draft}
                    onChangeText={setDraft}
                  />
                  <PressableScale onPress={() => confirm(it.id)} style={s.saveBtn}>
                    <Text style={s.saveBtnTxt}>Zapisz</Text>
                  </PressableScale>
                </View>
              )}

              {historyFor === it.id && (
                <ExerciseLogHistory
                  entries={logs.filter((l) => l.exercise === planItemLogKey(it) && l.date === today)}
                  unit={it.unit}
                  onUpdate={updateLog}
                  onDelete={removeLog}
                />
              )}
            </View>
          );
        })}

        {allDone && (
          <View style={s.doneBox}>
            <Text style={s.doneTxt}>Sesja zrobiona! Monety/XP za powiązane ćwiczenia czekają w Pupil → Zadania.</Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}

const makeS = themedStyles((c: any) => StyleSheet.create({
  container: { flex: 1, backgroundColor: c.bg.primary },
  header: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: spacing[3], paddingVertical: spacing[2] },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { flex: 1, textAlign: 'center', ...typography.h3, color: c.text.primary },
  countPill: { minWidth: 40, alignItems: 'center', paddingHorizontal: 8, paddingVertical: 4, borderRadius: radius.full, backgroundColor: c.bg.card, borderWidth: 1, borderColor: c.border.default },
  countTxt: { fontSize: 12, fontWeight: '800', color: c.text.secondary },
  scroll: { padding: spacing[4], paddingTop: spacing[2], paddingBottom: 60, gap: spacing[3] },

  notFound: { padding: spacing[5], alignItems: 'center' },
  notFoundTxt: { fontSize: 13, color: c.text.muted, textAlign: 'center' },

  card: { backgroundColor: c.bg.card, borderRadius: radius.lg, borderWidth: 1, borderColor: c.border.default, padding: spacing[3], gap: spacing[2] },
  cardDone: { borderColor: '#2AC68F55', backgroundColor: '#2AC68F0D' },
  cardHead: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  cardHeadMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10, minWidth: 0 },
  historyBtn: { width: 30, height: 30, alignItems: 'center', justifyContent: 'center' },
  iconWrap: { width: 34, height: 34, borderRadius: radius.md, backgroundColor: '#FB923C1F', alignItems: 'center', justifyContent: 'center' },
  cardLabel: { fontSize: 14, fontWeight: '800', color: c.text.primary },
  cardSub: { fontSize: 11.5, color: c.text.muted, marginTop: 1 },

  inputRow: { flexDirection: 'row', gap: spacing[2] },
  input: { flex: 1, backgroundColor: c.bg.elevated, borderRadius: radius.md, borderWidth: 1, borderColor: c.border.default, paddingHorizontal: 12, paddingVertical: 9, fontSize: 13.5, color: c.text.primary },
  saveBtn: { backgroundColor: '#2AC68F', borderRadius: radius.md, paddingHorizontal: 16, justifyContent: 'center' },
  saveBtnTxt: { fontSize: 13, fontWeight: '800', color: '#07160F' },

  doneBox: { padding: spacing[3], borderRadius: radius.lg, backgroundColor: '#2AC68F14', borderWidth: 1, borderColor: '#2AC68F44' },
  doneTxt: { fontSize: 12.5, color: c.text.secondary, lineHeight: 17, textAlign: 'center' },
}));
