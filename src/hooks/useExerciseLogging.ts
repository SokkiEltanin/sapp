import { useMemo } from 'react';
import { useShallow } from 'zustand/react/shallow';
import { useProfileStore } from '@/store/profileStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { usePetStore } from '@/store/petStore';
import {
  ageFrom, targetsFor, amountLoggedOn, exerciseStreakFrom, exerciseJustUnlocked, TrainingExercise,
} from '@/utils/personalQuests';
import { exerciseMetaById } from '@/utils/exerciseMeta';
import { haptic } from '@/utils/haptics';
import { toast } from '@/store/toastStore';

const todayISO = () => {
  const d = new Date();
  const p = (n: number) => String(n).padStart(2, '0');
  return `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}`;
};

export interface LogAmountOpts {
  exercise: string;                     // klucz logowania — `TrainingPlanItem.linkedExercise ?? name`, albo ex.id z EXERCISE_META
  linkedExercise?: TrainingExercise;     // ustawione ⇒ sprawdzany jest quest/nagroda pupila (patrz exerciseMeta.ts)
  label: string;
  unit: string;
  amount: number;
}

// Wyodrębnione z app/exercises.tsx (2026-10-14, przy budowie buildera planów treningowych,
// ARCHITECTURE.md §320) — JEDNO miejsce liczące "czy ten wpis odblokowuje quest/nagrodę" i
// zapisujące do `exercisesStore`, współdzielone przez ekran Ćwiczenia (zawsze `linkedExercise`
// = jedno z 6 kanonicznych) i nowy ekran "Dzisiejsza sesja" (pozycje planu, `linkedExercise`
// opcjonalne — patrz komentarz w trainingPlans.ts). Wcześniej ta logika żyła tylko w
// app/exercises.tsx; druga kopia w ekranie sesji mogłaby się z czasem rozjechać (np. zmiana
// warunku odblokowania w jednym miejscu, nie w drugim) — stąd wspólny hook, nie duplikat.
export function useExerciseLogging() {
  const { birthdate, gender, trainingLevel } = useProfileStore();
  const logs = useExercisesStore((st) => st.logs);
  const addLog = useExercisesStore((st) => st.addLog);
  const removeLog = useExercisesStore((st) => st.removeLog);
  const updateLog = useExercisesStore((st) => st.updateLog);
  const {
    markPushupsDone, markSquatsDone, markSitupsDone, markPlankDone, markStretchDone, markBikeDone,
  } = usePetStore(useShallow((st) => ({
    markPushupsDone: st.markPushupsDone, markSquatsDone: st.markSquatsDone, markSitupsDone: st.markSitupsDone,
    markPlankDone: st.markPlankDone, markStretchDone: st.markStretchDone, markBikeDone: st.markBikeDone,
  })));

  const today = todayISO();
  // §416 (2026-10-25) — ten sam fix co `usePetQuests.ts`: `targetsFor` już samo domyślnie
  // ląduje na poziom początkujący gdy `trainingLevel` jest `null`, więc ten gate po cichu
  // wyłączał cele/odhaczanie "zrobione"/quest pupila dla KAŻDEGO usera który nie odwiedził
  // jeszcze Ustawień — patrz obszerny komentarz w usePetQuests.ts.
  const targets = useMemo(
    () => targetsFor(trainingLevel, ageFrom(birthdate), gender),
    [trainingLevel, birthdate, gender],
  );
  const streak = useMemo(() => exerciseStreakFrom(logs, today), [logs, today]);

  const MARK_DONE: Record<TrainingExercise, () => void> = {
    pushups: markPushupsDone, squats: markSquatsDone, situps: markSitupsDone,
    plank: markPlankDone, stretch: markStretchDone, bike: markBikeDone,
  };

  const logAmount = (opts: LogAmountOpts) => {
    const before = amountLoggedOn(logs, opts.exercise, today);
    addLog(opts.exercise, opts.amount, today);
    haptic.success();
    if (opts.linkedExercise && targets) {
      const meta = exerciseMetaById(opts.linkedExercise);
      const target = meta ? meta.target(targets) : null;
      if (exerciseJustUnlocked(before, opts.amount, target)) {
        MARK_DONE[opts.linkedExercise]();
        toast.success(`${opts.label}: cel osiągnięty! Nagroda czeka w Pupil → Zadania`);
        return;
      }
    }
    toast.success(`Zapisano: ${opts.label} +${opts.amount} ${opts.unit}`);
  };

  // `addLog` eksportowane WPROST (obok `logAmount`) — 2026-10-15, historia/kalendarz
  // (app/exercises-history.tsx) musi móc dopisać wpis do PRZESZŁEGO dnia (backfill). Celowo
  // NIE przez `logAmount` — ta funkcja zawsze sprawdza próg nagrody względem DZISIEJSZEJ
  // sumy (`today`, nie parametr) — wołanie jej dla przeszłej daty niesłusznie mogłoby
  // odblokować DZISIEJSZY quest na podstawie starych danych. Backfill = czysty zapis danych,
  // bez sprawdzania nagród (te są z natury "zrobione DZIŚ", nie retroaktywne).
  return { logs, targets, streak, today, logAmount, removeLog, updateLog, addLog };
}
