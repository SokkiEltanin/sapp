import { Debt, Subscription } from '@/types';
import { Note } from '@/utils/notesStorage';
import { CapsuleLetter } from '@/store/timeCapsuleStore';

// "Grupowanie powiadomień w jeden digest" (2026-09-28, user zaakceptował pomysł) — user
// zgłosił że kilka niezależnie zaplanowanych przypomnień (dług/subskrypcja/notatka/kapsuła)
// potrafi wylądować tego samego dnia jako kilka osobnych powiadomień z rzędu.
//
// ŚWIADOMIE WĘŻSZY, BEZPIECZNIEJSZY zakres niż "prawdziwe" scalanie w locie (2026-09-29,
// po analizie `notificationsService.ts`): dynamiczne przechwytywanie/łączenie już
// zaplanowanych powiadomień OS-owych wymagałoby przebudowy WSZYSTKICH ~15 schedule*/
// cancel* wywołań w tym pliku (każde ma własny identyfikator, własną logikę
// planowania/anulowania) — ryzyko subtelnego buga który CICHO GUBI powiadomienie
// (np. o długu) jest realne i gorsze niż obecny "spam". Zamiast tego: ta funkcja liczy
// NIEZALEŻNIE "co jest dziś zaplanowane" z już zebranych danych i daje material na JEDNO
// DODATKOWE poranne powiadomienie-podgląd (`scheduleTodayDigestReminder` w
// notificationsService.ts) — obok, nie zamiast, istniejących indywidualnych powiadomień.
// Pełne scalanie w locie zostaje jako osobny, nadal otwarty temat w NEXT_STEPS.md.
export interface TodayReminderItem {
  kind: 'debt' | 'subscription' | 'note' | 'capsule';
  label: string;
}

function pad(n: number): string { return String(n).padStart(2, '0'); }
function dayKey(d: Date): string { return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`; }

export function todayReminders(
  data: { debts: Debt[]; subscriptions: Subscription[]; notes: Note[]; capsules: CapsuleLetter[] },
  now: Date = new Date(),
): TodayReminderItem[] {
  const today = dayKey(now);
  const items: TodayReminderItem[] = [];

  for (const d of data.debts) {
    if (d.settled) continue;
    if (d.askDate !== today) continue;
    items.push({ kind: 'debt', label: `dług: ${d.person}` });
  }

  for (const s of data.subscriptions) {
    if (!s.active || s.reminderDaysBefore <= 0) continue;
    const fire = new Date(s.nextBillingDate + 'T00:00:00');
    fire.setDate(fire.getDate() - s.reminderDaysBefore);
    if (dayKey(fire) !== today) continue;
    items.push({ kind: 'subscription', label: `subskrypcja: ${s.name}` });
  }

  for (const n of data.notes) {
    if (!n.reminderAt) continue;
    if (n.reminderAt.slice(0, 10) !== today) continue;
    items.push({ kind: 'note', label: `notatka: ${n.title.trim() || 'bez tytułu'}` });
  }

  for (const c of data.capsules) {
    if (dayKey(new Date(c.unlockAt)) !== today) continue;
    items.push({ kind: 'capsule', label: 'kapsuła czasu' });
  }

  return items;
}
