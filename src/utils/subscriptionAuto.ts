import { Subscription, BillingCycle } from '@/types';
import { ymd } from '@/utils/date';

// When a bank payment matches a due subscription, we advance its billing date
// automatically — so the app understands it's paid and stops asking "zapłaciłeś?".

export function advanceBillingDate(current: string, cycle: BillingCycle): string {
  const d = new Date(current + 'T00:00:00');
  switch (cycle) {
    case 'weekly':    d.setDate(d.getDate() + 7); break;
    case 'monthly':   d.setMonth(d.getMonth() + 1); break;
    case 'quarterly': d.setMonth(d.getMonth() + 3); break;
    case 'yearly':    d.setFullYear(d.getFullYear() + 1); break;
  }
  return ymd(d);
}

function norm(s: string): string {
  return (s || '').toLowerCase().replace(/[^a-z0-9ąćęłńóśżź]+/g, '');
}
function shiftISO(iso: string, days: number): string {
  const d = new Date(iso + 'T00:00:00');
  d.setDate(d.getDate() + days);
  return ymd(d);
}

export interface PaymentLite { store?: string; amount: number; dateISO: string }

// Find the active subscription a bank payment most likely settles. Primary: the
// merchant name matches AND the amount is close AND it's due (or overdue). Fallback
// (for processor-masked merchants like Nuvei/BLIK where the name is hidden): an
// exact amount that uniquely identifies one due subscription.
export function matchSubscriptionForPayment(p: PaymentLite, subs: Subscription[]): Subscription | null {
  const store = norm(p.store ?? '');
  const active = subs.filter(s => s.active);

  const amountClose = (s: Subscription, tol: number) => Math.abs(p.amount - s.amount) <= tol;
  const dueBy = (s: Subscription, days: number) => s.nextBillingDate <= shiftISO(p.dateISO, days);

  // 1) name + amount + due (within +7 days grace)
  if (store) {
    for (const s of active) {
      if (!amountClose(s, Math.max(2, s.amount * 0.15))) continue;
      if (!dueBy(s, 7)) continue;
      const nameNorm = norm(s.name);
      const tokens = s.name.toLowerCase().split(/\s+/).map(norm).filter(t => t.length >= 4);
      const hit = (nameNorm.length >= 4 && (store.includes(nameNorm) || nameNorm.includes(store)))
        || tokens.some(t => store.includes(t));
      if (hit) return s;
    }
  }

  // 2) fallback: exact amount uniquely identifies one due subscription (±3 days)
  const exactDue = active.filter(s => amountClose(s, 0.5) && dueBy(s, 3));
  if (exactDue.length === 1) return exactDue[0];

  return null;
}
