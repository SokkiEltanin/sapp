import { useHabits } from '@/hooks/useHabits';
import { StreakItem } from '@/components/dashboard/StreakWallCard';
import { buildStreakItems } from '@/utils/buildStreakItems';
import { useStreakItemsFromHabits } from '@/hooks/useStreakItemsFromHabits';

// Re-eksport dla zgodności z istniejącymi importami (`buildStreakItems` żyje teraz w
// `@/utils/buildStreakItems.ts` — czysty plik bez importów RN/hooków, testowalny w jest/node,
// patrz komentarz tam — ten plik importuje `useHabits` → `notificationsService` →
// `expo-notifications`, więc samo zaimportowanie TEGO pliku w jest/node rzuca "Cannot use
// import statement outside a module").
export { buildStreakItems };

// Ta sama logika co `app/(tabs)/index.tsx`'s `streakWall` i `app/dashboard-tile-creator.tsx`'s
// `realStreaks` (habity + auto-liczniki "dni bez" + ćwiczenia → `StreakItem[]`), wyciągnięta
// jako OSOBNY hook dla systemu kopiowania komponentów (§340+, 2026-10-16) — kanwa na kolejnych
// ekranach (np. `food.tsx`, `exercises.tsx`) potrzebuje tej samej listy "do czego da się
// przypiąć kafel serii", a te ekrany NIE mają jeszcze żadnego z `useHabits()`/`useCounters()`/
// itd. zamontowanego, więc zero ryzyka duplikacji. ŚWIADOMIE NIE podpięte do `index.tsx`/
// kreatora — oba JUŻ wołają te hooki osobno dla innych memo na tym samym ekranie (records/
// countdowns/since/gcal); dodanie tego hooka TAM obok istniejących wywołań zamontowałoby
// `useHabits()` (własny AsyncStorage fetch) PO RAZ DRUGI w tym samym drzewie komponentów —
// podwójna, zbędna praca na najbardziej czułym na wydajność ekranie w appce (patrz CLAUDE.md
// o ANR). Czysty DRY tu nie jest wart tego kosztu — duplikacja tych ~8 linijek logiki zostaje
// w `index.tsx`/kreatorze.
//
// UWAGA przy wpinaniu `<ScreenCanvas>` (zawiera ten hook) na KOLEJNYM ekranie — sprawdź najpierw
// `grep -n "useHabits(" <plik>`. Jeśli TAK (jak `mood.tsx`/`habits.tsx`/`pet.tsx` dziś) — NIE
// używaj domyślnego `<ScreenCanvas>` (zamontowałby `useHabits()` drugi raz), użyj
// `ScreenCanvasBase` + `useStreakItemsFromHabits(habits, getStreak)` (patrz ten hook niżej) z
// WŁASNYMI, już-zamontowanymi `habits`/`getStreak` tamtego ekranu.
//
// `buildStreakItems()`/`useStreakItemsFromHabits()` (§368/§373, 2026-10-18) — `buildStreakItems`
// to czysta część WYDZIELONA z tego hooka (teraz w `@/utils/buildStreakItems.ts`),
// `useStreakItemsFromHabits` to dociąganie RESZTY źródeł (tanie Zustand-selektory) OBOK
// `habits`/`getStreak` — ten hook sam jest teraz tylko `useHabits()` + `useStreakItemsFromHabits()`.
export function useAllStreakItems(): StreakItem[] {
  const { habits, getStreak } = useHabits();
  return useStreakItemsFromHabits(habits, getStreak);
}
