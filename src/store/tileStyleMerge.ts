// Wspólny `merge` dla WSZYSTKICH 6 draft/live store'ów kreatora dashboardu
// (streakTileStyleStore/recordsTileStyleStore/countdownsTileStyleStore/sinceCountersTileStyleStore/
// pinnedNotesTileStyleStore/gcalTileStyleStore) — naprawia realny, zgłoszony przez usera crash
// (2026-10-17, "Coś się wykrzaczyło... Cannot convert undefined value to object" przy wejściu na
// dashboard I w Kreatorze kafelków, oba w `tileStyle.tierColorOverrides[i]`/
// `tileStyle.habitCalendarOverrides[id]` bez osłony).
//
// PRZYCZYNA: żaden z tych store'ów nie miał WŁASNEGO `merge` w konfiguracji `persist` — domyślny
// merge zustand to `{ ...currentState, ...persistedState }`, PŁYTKI na poziomie całego stanu
// store'a. Skoro persystowany JSON MA klucz `live`/`draft` (zapisany na telefonie usera KIEDYŚ,
// zanim pole typu `tierColorOverrides`/`habitCalendarOverrides` istniało w interfejsie —
// `StreakTileStyle` zyskało je w Fazie 7/8 tej samej wielodniowej sesji, ale user otwierał
// dashboard WCZEŚNIEJ niż te fazy wylądowały), CAŁY obiekt `live`/`draft` z telefonu PODMIENIA
// świeży default z kodu, zamiast się z nim scalić pole-po-polu — nowe pole zostaje `undefined`
// NA STAŁE, mimo że `DEFAULT_*_STYLE` w aktualnym kodzie ma je ustawione. Identyczna pułapka
// czeka na KAŻDY z tych 6 store'ów przy KAŻDYM kolejnym nowym polu w przyszłości (każda faza
// kreatora dokłada pola) — stąd WSPÓLNY fix tu, nie tylko punktowa łatka dla serii.
export function mergeTileStyleState<S extends { live: object; draft: object }>(
  persistedState: unknown,
  currentState: S,
): S {
  const p = (persistedState ?? {}) as Partial<S>;
  return {
    ...currentState,
    ...p,
    live: { ...currentState.live, ...(p.live ?? {}) },
    draft: { ...currentState.draft, ...(p.draft ?? {}) },
  };
}
