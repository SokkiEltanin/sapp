import { ymd } from '@/utils/date';
import { Subscription, BillingCycle } from '@/types';

// Logika dat subskrypcji/rachunków — wyniesione z app/(tabs)/index.tsx (krok 1). Czyste
// (typy + kanoniczne ymd) → testowalne w node.

// Czy subskrypcja o skończonym czasie już wygasła (startDate + durationMonths <= dziś).
export function isDurationExpired(sub: Subscription): boolean {
  if (!sub.durationMonths || sub.durationMonths === 0 || !sub.startDate) return false;
  const end = new Date(sub.startDate + 'T00:00:00');
  end.setMonth(end.getMonth() + sub.durationMonths);
  const today = new Date(); today.setHours(0, 0, 0, 0);
  return end <= today;
}

// Następna data rozliczenia po `current` dla danego cyklu (lokalne YYYY-MM-DD).
export function advanceNextBillingDate(current: string, cycle: BillingCycle): string {
  const d = new Date(current + 'T00:00:00');
  switch (cycle) {
    case 'weekly':    d.setDate(d.getDate() + 7); break;
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
  }
  return ymd(d);
}
