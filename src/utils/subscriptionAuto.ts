import AsyncStorage from '@react-native-async-storage/async-storage';
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

  // 1) name + due (within +7 days grace). Amount is NOT required here — a foreign-card
  //    charge is in another currency (e.g. 22,14 EUR for a sub you stored in PLN), so a
  //    confident merchant-name match is the reliable signal.
  if (store) {
    for (const s of active) {
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

// Is a bank payment a CONFIDENT match for a subscription (same currency + close
// amount)? Then we advance it silently. Otherwise (e.g. a EUR charge for a PLN sub,
// where the amount floats with the exchange rate) we ask the user to confirm first.
export function isConfidentSubMatch(p: PaymentLite & { currency?: string }, sub: Subscription): boolean {
  const sameCur = (p.currency ?? 'PLN') === (sub.currency ?? 'PLN');
  const close = Math.abs(p.amount - sub.amount) <= Math.max(2, sub.amount * 0.15);
  return sameCur && close;
}

// ── Pending "is this your subscription?" confirmations (surfaced on the dashboard) ──
const CONFIRM_KEY = 'pending_sub_confirm';
export interface PendingSubConfirm {
  id: string; subId: string; subName: string; merchant: string;
  amount: number; currency: string; date: string; // YYYY-MM-DD
}

export async function loadSubConfirms(): Promise<PendingSubConfirm[]> {
  try { const raw = await AsyncStorage.getItem(CONFIRM_KEY); return raw ? JSON.parse(raw) : []; }
  catch { return []; }
}
export async function queueSubConfirm(c: Omit<PendingSubConfirm, 'id'>): Promise<void> {
  try {
    const list = await loadSubConfirms();
    // de-dupe: one ask per subscription per day
    if (list.some(x => x.subId === c.subId && x.date.slice(0, 10) === c.date.slice(0, 10))) return;
    list.push({ ...c, id: `${c.subId}:${Date.now()}` });
    await AsyncStorage.setItem(CONFIRM_KEY, JSON.stringify(list.slice(-10)));
  } catch {}
}
export async function removeSubConfirm(id: string): Promise<void> {
  try {
    const list = (await loadSubConfirms()).filter(x => x.id !== id);
    await AsyncStorage.setItem(CONFIRM_KEY, JSON.stringify(list));
  } catch {}
}
