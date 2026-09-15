import * as Notifications from 'expo-notifications';
import { Wrench, Wallet, Briefcase, CreditCard, CalendarDays } from 'lucide-react-native';
import { LucideIcon } from '@/types/settings';

// "Proste" typy powiadomień — czysty on/off, bez własnego edytora godziny (w
// odróżnieniu od Humoru/Porannego/Listy zadań/Nawyków, które mają dedykowane pola
// godziny w Ustawieniach → Powiadomienia). Wydzielone tu (2026-09-15, §101) z byłego
// `app/notifications.tsx` — ten ekran zniknął, jego lista typów żyje teraz jako
// wygenerowane pozycje w tej samej podstronie Ustawień, żeby nie było DWÓCH osobnych,
// nachodzących na siebie miejsc do zarządzania powiadomieniami (user: "POWIADOMIENIA W
// APCE są nie jasne w USTAWIENIACH").
export interface NotifType {
  flag: string;            // AsyncStorage key; absent or 'true' = on, 'false' = off
  label: string;
  desc: string;
  Icon: LucideIcon;
  color: string;
  ids?: string[];          // exact scheduled identifiers to cancel on toggle-off
  prefixes?: string[];     // identifier prefixes to cancel on toggle-off
}

export const SIMPLE_NOTIF_TYPES: NotifType[] = [
  { flag: 'notif_maintenance_enabled', label: 'Serwis / wymiana', desc: 'Zbliżający się serwis pojazdu lub przedmiotu', Icon: Wrench, color: '#F59E0B', ids: ['maintenance-due'] },
  { flag: 'notif_budget_enabled', label: 'Budżet / limity', desc: 'Zbliżanie się i przekroczenie limitów wydatków', Icon: Wallet, color: '#E43434', ids: ['budget-limit'] },
  { flag: 'notif_work_enabled', label: 'Zmiany w pracy', desc: 'Początek i koniec zmiany (+ ile zarobiono)', Icon: Briefcase, color: '#5B7BE3', prefixes: ['work-start-', 'work-end-'] },
  { flag: 'notif_subs_enabled', label: 'Subskrypcje', desc: 'Przypomnienie przed odnowieniem subskrypcji', Icon: CreditCard, color: '#A78BFA', prefixes: ['sub-'] },
  { flag: 'notif_weekly_enabled', label: 'Podsumowanie tyg.', desc: 'Niedziela 19:00 — wydatki, nastrój, sen, kroki', Icon: CalendarDays, color: '#46B0DE', ids: ['weekly-summary'] },
];

export async function cancelNotifType(t: NotifType): Promise<void> {
  for (const id of t.ids ?? []) await Notifications.cancelScheduledNotificationAsync(id).catch(() => {});
  if (t.prefixes?.length) {
    const all = await Notifications.getAllScheduledNotificationsAsync().catch(() => []);
    for (const n of all) {
      if (t.prefixes.some(p => n.identifier?.startsWith(p))) {
        await Notifications.cancelScheduledNotificationAsync(n.identifier).catch(() => {});
      }
    }
  }
}
