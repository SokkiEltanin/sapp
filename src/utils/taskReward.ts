import { Task, EventPriority } from '@/types';

// Nagroda za ukończenie zadania (2026-09-30, user: ręczna "trudność" "trochę jest bez
// sensu" — wywalona, patrz `useTasks.ts`). Wydzielone do osobnego, czysto-funkcyjnego
// pliku BEZ importów serwisów/store'ów (Firebase itd.) — ten sam powód co inne pure-utile
// w repo (np. `taskKind.ts`): `useTasks.ts` ciągnie za sobą całe drzewo
// `calendarService`/`firebase.ts`, które w testach jednostkowych nie transformuje się
// (ESM z `expo/virtual/env.js`) — więc test importujący `taskReward` STĄD, nie z hooka,
// działa bez mockowania połowy appki.
//
// Dwa sygnały appka już zna, zero nowego wpisywania: PRIORYTET (`task.priority`, ustawiany
// raz przy tworzeniu) i FAKTYCZNE tempo/pilność wykonania (user: "im pilniejszy i szybciej
// wykonany tym więcej XP i coinów").
const PRIORITY_WEIGHT: Record<EventPriority, number> = { low: 1, normal: 2, high: 3 };

// Bonus za NIE odkładanie — ile dni minęło od dodania zadania do ukończenia. Ten sam dzień
// = pełny bonus, dalej maleje, zero (nie kara, tylko brak dodatku) po tygodniu leżenia.
function speedMult(createdAt: string, completedAt: Date): number {
  const created = new Date(createdAt).getTime();
  if (!created || isNaN(created)) return 1;
  const days = Math.max(0, Math.floor((completedAt.getTime() - created) / 86_400_000));
  if (days === 0) return 1.5;
  if (days === 1) return 1.25;
  if (days <= 3) return 1.1;
  return 1;
}

// Bonus za pilność — im bliżej terminu w momencie ukończenia (ale NIE po terminie), tym
// większy bonus; zadanie ukończone po terminie albo bez terminu = bez bonusu (bez kary).
function urgencyMult(deadline: string | undefined, completedAt: Date): number {
  if (!deadline) return 1;
  const due = new Date(deadline.split('T')[0] + 'T00:00:00');
  const at = new Date(completedAt); at.setHours(0, 0, 0, 0);
  const daysLeft = Math.round((due.getTime() - at.getTime()) / 86_400_000);
  if (daysLeft < 0) return 1;      // po terminie
  if (daysLeft === 0) return 1.5;  // na dziś
  if (daysLeft === 1) return 1.25; // na jutro
  return 1;
}

export function taskReward(
  task: Pick<Task, 'priority' | 'createdAt' | 'deadline'>,
  completedAt: Date = new Date(),
): { coins: number; xp: number } {
  const p = PRIORITY_WEIGHT[task.priority] ?? PRIORITY_WEIGHT.normal;
  const mult = speedMult(task.createdAt, completedAt) * urgencyMult(task.deadline, completedAt);
  const coins = Math.max(1, Math.round(p * mult));
  const xp = Math.max(1, Math.round((6 + p * 4) * mult));
  return { coins, xp };
}
