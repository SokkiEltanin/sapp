// Wybór/formatowanie zadań pod widget pulpitu Androida (2026-09-23, user: "bardzo lubiłem
// mieć na ekranie co muszę zrobić/kupić"). Czyste, zero RN/native — ten sam "testability
// boundary" wzorzec co streakTiers.ts/weekGrid.ts: `widgetSync.ts` (RN-owy, pisze plik +
// woła natywny most) i `TasksWidgetProvider.kt` (natywny, tylko RENDERUJE to co JS już
// policzył/posortował) obie konsumują WYNIK tej funkcji, licząc na te SAME zasady.
import { Task } from '@/types';
import { KIND_META, resolveKind } from './taskKind';
import { plPlural } from './plural';

export interface WidgetTaskRow {
  id: string;
  title: string;
  sub: string;    // "Zaległe" / "Dziś" / "Jutro" / "Za 3 dni" / "" (bez terminu)
  color: string;  // KIND_META[kind].color
  overdue: boolean;
}

function daysUntil(deadlineYMD: string, todayYMD: string): number {
  const t = new Date(todayYMD + 'T00:00:00');
  const d = new Date(deadlineYMD + 'T00:00:00');
  return Math.round((d.getTime() - t.getTime()) / 86_400_000);
}

function subLabel(task: Task, todayYMD: string): { sub: string; overdue: boolean } {
  const dYMD = task.deadline?.split('T')[0];
  if (!dYMD) return { sub: '', overdue: false };
  const d = daysUntil(dYMD, todayYMD);
  if (d < 0) return { sub: 'Zaległe', overdue: true };
  if (d === 0) return { sub: 'Dziś', overdue: false };
  if (d === 1) return { sub: 'Jutro', overdue: false };
  return { sub: `Za ${d} ${plPlural(d, 'dzień', 'dni', 'dni')}`, overdue: false };
}

// Sortowanie: zaległe → dziś → jutro → reszta wg terminu rosnąco → bez terminu na końcu —
// TA SAMA logika pilności co `sortTasks(..., 'deadline')` w tasks.tsx, ale spłaszczona do
// jednej listy (widget nie ma miejsca na nagłówki sekcji jak pełny ekran).
export function pickWidgetTasks(tasks: Task[], todayYMD: string, limit = 6): WidgetTaskRow[] {
  const pending = tasks.filter(t => t.status === 'pending');
  const sorted = [...pending].sort((a, b) => {
    const aD = a.deadline?.split('T')[0];
    const bD = b.deadline?.split('T')[0];
    if (!aD && !bD) return 0;
    if (!aD) return 1;
    if (!bD) return -1;
    return aD.localeCompare(bD);
  });
  return sorted.slice(0, limit).map(t => {
    const { sub, overdue } = subLabel(t, todayYMD);
    return { id: t.id, title: t.title, sub, color: KIND_META[resolveKind(t)].color, overdue };
  });
}
