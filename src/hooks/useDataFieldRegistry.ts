import { useMemo } from 'react';
import { usePetStore, levelFromXp } from '@/store/petStore';
import { useCalendarStore } from '@/store/calendarStore';

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
export function useDataFieldRegistry(): DataFieldValue[] {
  const petName = usePetStore(s => s.name);
  const petXp = usePetStore(s => s.xp);
  const tasks = useCalendarStore(s => s.tasks);

  return useMemo(() => {
    const today = new Date().toISOString().slice(0, 10);
    const doneToday = tasks.filter(t => t.status === 'done' && t.updatedAt?.startsWith(today)).length;
    const dateLabel = new Date().toLocaleDateString('pl-PL', { weekday: 'long', day: 'numeric', month: 'long' });
    return [
      { id: 'pet.name', label: 'Imię pupila', value: petName },
      { id: 'pet.level', label: 'Poziom pupila', value: String(levelFromXp(petXp).level) },
      { id: 'tasks.doneToday', label: 'Zadania ukończone dziś', value: String(doneToday) },
      { id: 'date.today', label: 'Dzisiejsza data', value: dateLabel },
    ];
  }, [petName, petXp, tasks]);
}
