import { useMemo } from 'react';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useMoodStore } from '@/store/moodStore';
import { useLiveStatsSnapshotStore } from '@/store/liveStatsSnapshotStore';
import { useExercisesStore } from '@/store/exercisesStore';
import { amountLoggedOn } from '@/utils/personalQuests';
import { isMine } from '@/store/statsScope';
import { MOOD_LABELS } from '@/types';
import { fmtStat } from '@/utils/dashboard/format';

export interface DataFieldValue {
  id: string;
  label: string;
  value: string;
}

// Rejestr pól danych do generycznego podpięcia na wolnym płótnie (Faza 27, 2026-10-17, §358) —
// user, po AskUserQuestion o zakres "pełnego edytora": "...potem podpisanie danych itp itd".
// Dotychczas "dane" na płótnie to 3 ZAHARDKODOWANE źródła (nawyk/licznik/notatka, każde z
// własnym hookiem `useAllXItems()`) — ten rejestr to PIERWSZY krok w stronę "dowolne pole z
// apki", zebrane w JEDNĄ listę `PickerOption`-kompatybilną (ScreenCanvas.tsx mapuje identycznie
// jak streakOptions/countdownOptions/notesOptions).
//
// ŚWIADOMIE MAŁY zestaw — WYŁĄCZNIE pola czytane przez lekki, czysty selektor Zustand (zero
// AsyncStorage, zero Health Connect sync TUTAJ). Montowanie kosztownego hooka OSOBNO PER
// INSTANCJA na płótnie (user może dodać wiele kafli tego samego pola) byłoby dokładnie tym
// błędem architektonicznym, którego ta sesja już dwa razy unikała (`useHabits()` double-fetch
// hazard, patrz komentarz w `useAllStreakItems.ts`/§356 w ARCHITECTURE.md).
//
// Faza §401 (2026-10-19) — user zrzutem pickera: "nie mam wszystkich danych do wyboru jakie
// obsługuje aplikacja. Finanse, humor, wydatki nic zupełnie". Dołożone `useExpensesStore`/
// `useMoodStore` — OBA to PROSTE selektory Zustand (`persist` middleware hydratuje RAZ przy
// starcie appki, czytanie `.expenses`/`.entries` tu nie robi NOWEGO fetchu/syncu) — TEN SAM
// koszt co już bezpiecznie używane `usePetStore`/`useCalendarStore` wyżej. Scope świadomie
// UPROSZCZONY — sumuje WSZYSTKIE wydatki (nie tylko "moje", patrz `statsScope.ts`), żeby nie
// ciągnąć dodatkowego store'u/przełącznika do tego małego rejestru; jeśli user zgłosi potrzebę
// rozróżnienia, to osobna, mała zmiana (dodać `useStatsScope()` tutaj).
//
// Faza §404 (2026-10-20) — user: "dlaczego do edytora nie dajesz wszystkich danych tylko
// część, jaki to problem huh?". Trzy pola odłożone w §358/§401 (kroki dzisiaj/saldo/nastrój
// pupila) źródłowo wymagają kosztownych hooków (`usePetHealthSync()` — Health Connect sync,
// `getBalanceOffset()` — surowy AsyncStorage, `computePetState()` — agreguje kroki+sen+nawyki+
// nastrój, w tym WŁASNY ciężki `useHabits()`) — realny powód wykluczenia z tego pliku, nie
// lenistwo. Fix: `liveStatsSnapshotStore.ts` — NOWY, mały, persystowany store, do którego
// ekrany JUŻ liczące te wartości (`app/pet.tsx`, `app/(tabs)/finances.tsx`) dopisują JEDNĄ
// linię zapisu (ten sam wzorzec co "Dashboard czyta snapshot `expenses`" z CLAUDE.md reguły
// #3/ARCHITECTURE.md §4). Ten rejestr czyta stąd zwykłym, tanim selektorem — zero nowych
// fetchy wywołanych przez sam fakt dodania kafla na płótnie, kosztem świeżości: wartość jest
// tak aktualna jak ostatnia wizyta na ekranie źródłowym (Pupil/Finanse), nie "na żywo" przy
// każdym otwarciu płótna. `*Synced` flagi w store'u odróżniają "jeszcze nie wiadomo" (user
// nigdy nie odwiedził ekranu źródłowego w tej instalacji) od realnego zera.
//
// Faza §408 (2026-10-20) — user: "jak dodam kafelek z treningu... jak będę niby podłączał
// to żeby liczyło dane np jako trening_pompki w innych miejscach typu... historii
// treningów?". Dołożone DYNAMICZNE pola per-ćwiczenie (`exercise:<nazwa>`) — jedno dla
// KAŻDEGO ćwiczenia jakie user kiedykolwiek zalogował, nie zahardkodowana lista. Ten sam
// rejestr jest teraz czytany też przez bindowalny `textShape` (patrz `ScreenCanvas.tsx`/
// `ShapeTile.tsx`), więc własno-zaprojektowany kafel tekstu może pokazywać "Pompki —
// dzisiaj" jako ŻYWĄ wartość, czytaną z TEGO SAMEGO `exercisesStore` co `/exercises-history`.
export function useDataFieldRegistry(): DataFieldValue[] {
  const petName = usePetStore(s => s.name);
  const petXp = usePetStore(s => s.xp);
  const tasks = useCalendarStore(s => s.tasks);
  const expenses = useExpensesStore(s => s.expenses);
  const moodEntries = useMoodStore(s => s.entries);
  const stepsToday = useLiveStatsSnapshotStore(s => s.stepsToday);
  const petSynced = useLiveStatsSnapshotStore(s => s.petSynced);
  const petMoodLabel = useLiveStatsSnapshotStore(s => s.petMoodLabel);
  const cardBalanceOffset = useLiveStatsSnapshotStore(s => s.cardBalanceOffset);
  const balanceSynced = useLiveStatsSnapshotStore(s => s.balanceSynced);
  const exerciseLogs = useExercisesStore(s => s.logs);

  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const doneToday = tasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(today)).length;
    const dateLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });

    // Finanse/wydatki (§401) — `type` nieustawione = 'expense' (backward-compat, patrz
    // komentarz przy `Expense.type` w types/index.ts), więc tylko `type === 'income'`
    // jest jawnie wykluczony, nie `type !== 'expense'`.
    const monthKey = today.slice(0, 7);
    const spendToday = expenses.filter(e => e.type !== 'income' && e.date.slice(0, 10) === today)
      .reduce((sum, e) => sum + e.amount, 0);
    const spendMonth = expenses.filter(e => e.type !== 'income' && e.date.slice(0, 7) === monthKey)
      .reduce((sum, e) => sum + e.amount, 0);

    // Humor (§401) — wpis dzisiejszy (jak `todayEntryOf` w moodStore.ts, ale ten rejestr nie
    // woła store'owych helperów bezpośrednio — zero nowej zależności za jedno porównanie daty)
    // + prosta średnia z ostatnich 7 dni (kalendarzowych, nie "7 wpisów" — dni bez wpisu po
    // prostu nie wchodzą do średniej, nie liczą się jako 0).
    const todayMood = moodEntries.filter(e => e.date === today).sort((a, b) => b.createdAt.localeCompare(a.createdAt))[0];
    const weekAgo = new Date(Date.now() - 6 * 86400000).toISOString().slice(0, 10);
    const recentMoods = moodEntries.filter(e => e.date >= weekAgo && e.date <= today).map(e => e.mood);
    const moodWeekAvg = recentMoods.length > 0 ? recentMoods.reduce((s, m) => s + m, 0) / recentMoods.length : null;

    // Saldo na karcie (§404) — TA SAMA formuła co `balance` w `app/(tabs)/finances.tsx`
    // ("Saldo NA KARCIE"): offset (ze snapshotu) + wszystkie moje przychody/wydatki NA
    // KARCIE (gotówka świadomie wykluczona, ten sam filtr `paymentMethod !== 'cash'`).
    // Self-transfery ZOSTAJĄ wliczone (realnie ruszają kartę) — tak samo jak tam.
    let allInc = 0, allExp = 0;
    for (const e of expenses) {
      if (!isMine(e) || e.paymentMethod === 'cash') continue;
      if (e.type === 'income') allInc += e.amount;
      else if (!e.type || e.type === 'expense') allExp += e.amount;
    }
    const balance = cardBalanceOffset + allInc - allExp;

    // Ćwiczenia, PER KONKRETNE ĆWICZENIE (§408, user: "jak będę niby podłączał [kafelek
    // treningu] żeby liczyło dane np jako trening_pompki... w historii treningów"). Rejestr
    // dotąd miał TYLKO zbiorczy streak "Ćwiczenia" (dowolne, nie konkretne) — DYNAMICZNIE
    // dokłada po jednym polu "dzisiaj" dla KAŻDEGO ćwiczenia, jakie user kiedykolwiek zalogował
    // (nie zahardkodowana lista — `exercise: string` w `ExerciseLogEntry` i tak jest wolnym
    // tekstem, "dowolne, własne nazwy też", patrz `personalQuests.ts`). `amountLoggedOn` to
    // już istniejąca, czysta funkcja (sumuje dzisiejsze wpisy danego ćwiczenia) — zero nowej
    // logiki, tylko zebranie unikalnych nazw + jedno wywołanie na nazwę. `useExercisesStore`
    // to PROSTY selektor Zustand (ten sam koszt co `useExpensesStore`/`useMoodStore` wyżej) —
    // źródło danych jest TO SAMO co karmi `/exercises-history` i zbiorczy streak "Ćwiczenia"
    // na dashboardzie, więc kafel podpięty tutaj automatycznie zgadza się z obiema stronami.
    const exerciseNames = Array.from(new Set(exerciseLogs.map(l => l.exercise))).sort((a, b) => a.localeCompare(b, 'pl'));
    const exerciseFields: DataFieldValue[] = exerciseNames.map(name => ({
      id: `exercise:${name}`,
      label: `${name} — dzisiaj`,
      value: String(amountLoggedOn(exerciseLogs, name, today)),
    }));

    return [
      { id: 'pet.name', label: 'Imię pupila', value: petName },
      { id: 'pet.level', label: 'Poziom pupila', value: String(levelFromXp(petXp).level) },
      { id: 'tasks.doneToday', label: 'Zadania ukończone dziś', value: String(doneToday) },
      { id: 'date.today', label: 'Dzisiejsza data', value: dateLabel },
      { id: 'finance.spendToday', label: 'Wydatki dziś', value: fmtStat(spendToday, 'zł') },
      { id: 'finance.spendMonth', label: 'Wydatki w tym miesiącu', value: fmtStat(spendMonth, 'zł') },
      { id: 'mood.today', label: 'Dzisiejszy nastrój', value: todayMood ? MOOD_LABELS[todayMood.mood] : 'Brak wpisu dziś' },
      { id: 'mood.weekAvg', label: 'Średni nastrój (7 dni)', value: moodWeekAvg != null ? moodWeekAvg.toFixed(1) : 'Brak danych' },
      { id: 'health.stepsToday', label: 'Kroki dzisiaj', value: petSynced ? stepsToday.toLocaleString('pl-PL') : 'Otwórz zakładkę Pupila' },
      { id: 'finance.balance', label: 'Saldo (karta)', value: balanceSynced ? fmtStat(balance, 'zł') : 'Otwórz zakładkę Finanse' },
      { id: 'pet.mood', label: 'Nastrój pupila', value: petSynced ? petMoodLabel : 'Otwórz zakładkę Pupila' },
      ...exerciseFields,
    ];
  }, [petName, petXp, tasks, expenses, moodEntries, stepsToday, petSynced, petMoodLabel, cardBalanceOffset, balanceSynced, exerciseLogs]);
}
