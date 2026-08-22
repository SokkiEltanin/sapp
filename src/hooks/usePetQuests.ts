import { useMemo } from 'react';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { useProfileStore } from '@/store/profileStore';
import { usePetHealthSync } from '@/hooks/usePetHealthSync';
import { ageFrom, targetsFor, dailyExercisePool, trainingStreakFrom } from '@/utils/personalQuests';
import { buildQuests, buildMissedDaily, sweetlessDaysFrom, QuestCtx, weekKeyOf } from '@/utils/quests';
import { useHabits, habitsDoneOn } from '@/hooks/useHabits';
import { useMoodStore } from '@/store/moodStore';
import { useExpensesStore } from '@/store/expensesStore';

const ymdOf = (d: Date) => `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
const todayISO = () => ymdOf(new Date());
const yesterdayISO = () => { const d = new Date(); d.setDate(d.getDate() - 1); return ymdOf(d); };

// Wydzielone z app/pet-quests.tsx (2026-08-22) — TA SAMA logika questCtx/quests/missed
// potrzebna teraz w DWÓCH miejscach: pełnym ekranie Zadań I małym "ping" badge'u na
// `PupilNavbar` (user: "dodaj ping na zakladce questów ze coś jest tam do odebrania" —
// badge musi wiedzieć czy coś jest do odebrania niezależnie na którym z 4 ekranów Pupila
// user akurat jest, nie tylko na samym ekranie Zadań). Jeden hook zamiast kopiowania —
// ten sam wzorzec co `usePetHealthSync` (patrz komentarz tam o "lekko podwaja odczyt przy
// przełączaniu zakładek, ale to nic w porównaniu z ryzykiem rozjazdu dwóch kopii").
export function usePetQuests() {
  const {
    xp, claimedQuests, dailyClaims, dayClaims, weeklyClaims, monthlyClaims, affection, affectionDay,
    pushupsDay, squatsDay, situpsDay, plankDay, stretchDay, trainingDays,
  } = usePetStore();
  const { birthdate, gender, trainingLevel } = useProfileStore();
  const lvl = levelFromXp(xp);
  const { health, waterGoal, waterToday, yData, cardsCollected } = usePetHealthSync();
  const { habits, todayDone, completions, getStreak } = useHabits();
  const { entries: moodEntries } = useMoodStore();
  const { expenses } = useExpensesStore();

  const affToday = affectionDay === todayISO() ? affection : 0;

  const habitBestStreak = useMemo(() => habits.length ? Math.max(0, ...habits.map(h => getStreak(h.id))) : 0, [habits, getStreak]);
  const personalTargets = useMemo(
    () => trainingLevel ? targetsFor(trainingLevel, ageFrom(birthdate), gender) : null,
    [trainingLevel, birthdate, gender],
  );
  const todaysPool = useMemo(() => dailyExercisePool(todayISO()), []);
  const questCtx: QuestCtx = useMemo(() => {
    const t = todayISO();
    const month = t.slice(0, 7);
    const boughtSweetToday = expenses.some(e => e.type !== 'income' && (e.date ?? '').slice(0, 10) === t
      && (e.receiptItems ?? []).some(it => !it.excluded && (it.tags ?? []).some(tg => tg === 'słodycze' || tg === 'przekąski')));
    const moodDaysThisMonth = new Set(moodEntries.filter(e => (e.date ?? '').startsWith(month)).map(e => e.date)).size;
    return {
      stepsToday: health.steps,
      moodLoggedToday: moodEntries.some(e => e.date === t),
      habitsDone: todayDone.length, habitsTotal: habits.length,
      sweetlessDays: sweetlessDaysFrom(expenses),
      bestStepDay: health.bestStepDay,
      habitBestStreak,
      cardsCollected,
      boughtSweetToday,
      stepTarget: health.stepTarget,
      waterToday, waterGoal,
      sleepMinutes: health.sleep,
      moodDaysThisMonth,
      stepsThisMonth: health.stepsThisMonth,
      moodDaysThisWeek: new Set(moodEntries.filter(e => (e.date ?? '') >= weekKeyOf()).map(e => e.date)).size,
      stepsThisWeek: health.stepsThisWeek,
      affectionFull: affToday >= 100,
      trainingStreak: trainingStreakFrom(trainingDays, t),
      pushupTarget: personalTargets && todaysPool.includes('pushups') ? personalTargets.pushups : undefined,
      squatTarget: personalTargets && todaysPool.includes('squats') ? personalTargets.squats : undefined,
      situpTarget: personalTargets && todaysPool.includes('situps') ? personalTargets.situps : undefined,
      plankTarget: personalTargets && todaysPool.includes('plank') ? personalTargets.plankSeconds : undefined,
      stretchTarget: personalTargets && todaysPool.includes('stretch') ? personalTargets.stretchMinutes : undefined,
      bikeTarget: personalTargets && todaysPool.includes('bike') ? personalTargets.bikeMinutes : undefined,
      pushupsToday: pushupsDay === t,
      squatsToday: squatsDay === t,
      situpsToday: situpsDay === t,
      plankToday: plankDay === t,
      stretchToday: stretchDay === t,
      bikeMinutesToday: health.cyclingMinutesToday,
    };
  }, [health, moodEntries, todayDone.length, habits.length, expenses, habitBestStreak, cardsCollected, waterToday, waterGoal, affToday, trainingDays, personalTargets, todaysPool, pushupsDay, squatsDay, situpsDay, plankDay, stretchDay]);
  const quests = useMemo(
    () => buildQuests(questCtx, { claimedMilestones: claimedQuests, dailyClaims, weeklyClaims, monthlyClaims, today: todayISO(), week: weekKeyOf() }, lvl.level),
    [questCtx, claimedQuests, dailyClaims, weeklyClaims, monthlyClaims, lvl.level],
  );

  const missed = useMemo(() => {
    if (!yData) return [];
    const y = yesterdayISO();
    const yCtx: QuestCtx = {
      stepsToday: yData.steps,
      moodLoggedToday: moodEntries.some(e => e.date === y),
      habitsDone: habitsDoneOn(habits, completions, y).length,
      habitsTotal: habits.length,
      sweetlessDays: 0, bestStepDay: 0, habitBestStreak: 0, cardsCollected: 0, trainingStreak: 0,
      waterToday: yData.water, waterGoal,
      sleepMinutes: yData.sleep,
    };
    return buildMissedDaily(yCtx, dayClaims, y, lvl.level);
  }, [yData, moodEntries, habits, completions, waterGoal, dayClaims, lvl.level]);

  return { questCtx, quests, missed, lvl, personalTargets, todaysPool };
}
