import { useMemo } from 'react';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { useCalendarStore } from '@/store/calendarStore';
import { useExpensesStore } from '@/store/expensesStore';
import { useMoodStore } from '@/store/moodStore';
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
// ŚWIADOMIE MAŁY, startowy zestaw — WYŁĄCZNIE pola czytane przez lekki, czysty selektor Zustand
// (zero AsyncStorage, zero Health Connect sync). Zbadane przy projektowaniu, ale ŚWIADOMIE
// WYKLUCZONE z v1: kroki dzisiaj (`usePetHealthSync()` — kosztowny hook, AsyncStorage + sync),
// saldo (`accountBalance.ts`'s `balanceOffset` — AsyncStorage, nie Zustand), nastrój pupila
// (`computePetState()` — agreguje kroki+sen+nawyki+nastrój, kosztowne). Montowanie KTÓREGOKOLWIEK
// z nich OSOBNO PER INSTANCJA na płótnie (user może dodać wiele kafli tego samego pola) byłoby
// dokładnie tym błędem architektonicznym, którego ta sesja już dwa razy unikała (`useHabits()`
// double-fetch hazard, patrz komentarz w `useAllStreakItems.ts`/§356 w ARCHITECTURE.md). Jeśli
// user zgłosi potrzebę tych pól, wymagają OSOBNEGO, wspólnego cache'u (jeden fetch dla całego
// ekranu, nie per-instancja) — nie proste dopisanie do tej listy.
//
// Faza §401 (2026-10-19) — user zrzutem pickera: "nie mam wszystkich danych do wyboru jakie
// obsługuje aplikacja. Finanse, humor, wydatki nic zupełnie". Dołożone `useExpensesStore`/
// `useMoodStore` — OBA to PROSTE selektory Zustand (`persist` middleware hydratuje RAZ przy
// starcie appki, czytanie `.expenses`/`.entries` tu nie robi NOWEGO fetchu/syncu) — TEN SAM
// koszt co już bezpiecznie używane `usePetStore`/`useCalendarStore` wyżej, NIE ten sam problem
// co wykluczone wyżej `usePetHealthSync()`/`computePetState()` (które same W SOBIE wykonują
// kosztowną pracę przy montowaniu, nie tylko czytają gotowy stan). Scope świadomie UPROSZCZONY
// — sumuje WSZYSTKIE wydatki (nie tylko "moje", patrz `statsScope.ts`), żeby nie ciągnąć
// dodatkowego store'u/przełącznika do tego małego rejestru; jeśli user zgłosi potrzebę
// rozróżnienia, to osobna, mała zmiana (dodać `useStatsScope()` tutaj).
export function useDataFieldRegistry(): DataFieldValue[] {
  const petName = usePetStore(s => s.name);
  const petXp = usePetStore(s => s.xp);
  const tasks = useCalendarStore(s => s.tasks);
  const expenses = useExpensesStore(s => s.expenses);
  const moodEntries = useMoodStore(s => s.entries);

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

    return [
      { id: 'pet.name', label: 'Imię pupila', value: petName },
      { id: 'pet.level', label: 'Poziom pupila', value: String(levelFromXp(petXp).level) },
      { id: 'tasks.doneToday', label: 'Zadania ukończone dziś', value: String(doneToday) },
      { id: 'date.today', label: 'Dzisiejsza data', value: dateLabel },
      { id: 'finance.spendToday', label: 'Wydatki dziś', value: fmtStat(spendToday, 'zł') },
      { id: 'finance.spendMonth', label: 'Wydatki w tym miesiącu', value: fmtStat(spendMonth, 'zł') },
      { id: 'mood.today', label: 'Dzisiejszy nastrój', value: todayMood ? MOOD_LABELS[todayMood.mood] : 'Brak wpisu dziś' },
      { id: 'mood.weekAvg', label: 'Średni nastrój (7 dni)', value: moodWeekAvg != null ? moodWeekAvg.toFixed(1) : 'Brak danych' },
    ];
  }, [petName, petXp, tasks, expenses, moodEntries]);
}
