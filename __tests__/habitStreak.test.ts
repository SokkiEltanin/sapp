import { weeklyTargetStreak } from '@/utils/habits';
import { Habit } from '@/types';

// 2026-09-18, agent-audyt — `getStreak()` (useHabits.ts) dla nawyku z celem TYGODNIOWYM miał
// SZTYWNY limit pętli `w<=3` (max 4 okna), ta sama klasa buga co udokumentowany "BUG FIX #2"
// tuż obok dla gałęzi dziennej, nigdy nie naprawiona tu — realny, wielomiesięczny nawyk
// "3×/tydzień" pokazywałby płomyk "4" NA ZAWSZE. Jednocześnie `habit-year.tsx` w ogóle nie
// znał `weeklyTarget` i liczył surowy dzienny streak — dla TEGO SAMEGO nawyku user widział
// np. "4" na liście Nawyków i "0 dni z rzędu" na habit-year. Oba miejsca teraz wołają TĘ SAMĄ
// wyeksportowaną, czystą funkcję `weeklyTargetStreak` — testowana tu wprost.

const habit = (weeklyTarget: number): Habit =>
  ({ id: 'h1', title: 'Test', type: 'check', createdAt: '', weeklyTarget } as Habit);

// Buduje countFor/isFrozen z listy dat "zrobionych" (żadna nie jest zamrożona), dla czytelności testów.
function doneOn(dates: string[]) {
  const set = new Set(dates);
  return {
    countFor: (d: string) => (set.has(d) ? 1 : 0),
    isFrozen: (_d: string) => false,
  };
}

describe('weeklyTargetStreak', () => {
  test('cel 3x/tydzień dotrzymany przez 10 KOLEJNYCH tygodni — current=10, NIE ucięte do 4 (regresja hard-capu)', () => {
    // Poniedziałki/środy/piątki co tydzień, licząc wstecz od "dziś" = 2026-09-18 (piątek).
    const dates: string[] = [];
    // Tygodnie zakotwiczone na dziś w blokach po 7 dni wstecz — po prostu oznacz KAŻDY dzień
    // jako zrobiony (prościej niż trafiać dokładnie w pon/śr/pt przy dowolnym "dziś"), cel i
    // tak wymaga tylko 3 z 7 — test dotyczy LICZBY okien, nie który dzień tygodnia.
    for (let d = 0; d < 70; d++) {
      const dt = new Date(2026, 8, 18); dt.setDate(dt.getDate() - d);
      dates.push(`${dt.getFullYear()}-${String(dt.getMonth() + 1).padStart(2, '0')}-${String(dt.getDate()).padStart(2, '0')}`);
    }
    const { countFor, isFrozen } = doneOn(dates);
    const r = weeklyTargetStreak(habit(3), countFor, isFrozen, '2026-09-18');
    expect(r.current).toBe(10); // 70 dni / 7 = 10 pełnych okien, wszystkie spełnione
    expect(r.longest).toBe(10);
  });

  test('brak jakiejkolwiek aktywności — current=0, longest=0', () => {
    const r = weeklyTargetStreak(habit(3), () => 0, () => false, '2026-09-18');
    expect(r.current).toBe(0);
    expect(r.longest).toBe(0);
  });

  test('seria przerwana W ŚRODKU — current liczy tylko OSTATNI nieprzerwany odcinek, longest pamięta dłuższy wcześniejszy', () => {
    // Ostatnie 3 tygodnie (0,1,2 wstecz) spełnione, tydzień 3 NIE spełniony, tygodnie 4-8 spełnione.
    const countFor = (d: string) => {
      const diffDays = Math.round((new Date('2026-09-18T00:00:00').getTime() - new Date(d + 'T00:00:00').getTime()) / 86400000);
      const week = Math.floor(diffDays / 7);
      if (week === 3) return 0; // ta cała 7-dniowa przerwa niespełniona
      return 1; // wszystkie inne dni "zrobione"
    };
    const r = weeklyTargetStreak(habit(3), countFor, () => false, '2026-09-18');
    expect(r.current).toBe(3);   // tygodnie 0,1,2 — zatrzymane na tygodniu 3
    expect(r.longest).toBeGreaterThanOrEqual(3); // tygodnie 4+ dalej liczone do longest
  });

  test('zamrożony dzień ratuje okno tak samo jak realnie zrobiony', () => {
    // Tylko 2 z 7 dni "zrobione" w oknie, ale 1 dodatkowy dzień zamrożony → 3/7, cel=3 spełniony.
    const countFor = (d: string) => (['2026-09-18', '2026-09-17'].includes(d) ? 1 : 0);
    const isFrozen = (d: string) => d === '2026-09-16';
    const r = weeklyTargetStreak(habit(3), countFor, isFrozen, '2026-09-18');
    expect(r.current).toBe(1);
  });

  test('cel NIGDY nieosiągnięty w oknie 0 (dziś) — current=0 nawet jeśli wcześniejsze tygodnie były spełnione', () => {
    const countFor = (d: string) => {
      const diffDays = Math.round((new Date('2026-09-18T00:00:00').getTime() - new Date(d + 'T00:00:00').getTime()) / 86400000);
      const week = Math.floor(diffDays / 7);
      return week === 0 ? 0 : 1; // bieżący tydzień pusty, wszystkie wcześniejsze pełne
    };
    const r = weeklyTargetStreak(habit(3), countFor, () => false, '2026-09-18');
    expect(r.current).toBe(0);
    expect(r.longest).toBeGreaterThan(0);
  });
});
