import AsyncStorage from '@react-native-async-storage/async-storage';
import { Expense, Subscription } from '@/types';

// Recognisable recurring-bill types — matched against an expense's note + tags.
// Order = display priority. Exported (2026-08-31) so the Finanse filter (finances.tsx)
// can reuse the SAME recognition as the dashboard's bill-suggest — one definition of
// "co liczy się jako rachunek za prąd" instead of two that could drift apart.
export const BILL_TYPES: { match: string[]; name: string; tag: string }[] = [
  { match: ['czynsz', 'mieszkanie', 'administr', 'adm ', 'spółdziel', 'spoldziel', 'wspólnot', 'wspolnot'], name: 'Czynsz / mieszkanie', tag: 'czynsz' },
  { match: ['prąd', 'prad', 'pge', 'tauron', 'energa', 'enea', 'energia elektr'], name: 'Prąd', tag: 'prąd' },
  { match: ['internet'], name: 'Internet', tag: 'internet' },
  { match: ['gaz '], name: 'Gaz', tag: 'gaz' },
  { match: ['woda', 'ścieki', 'scieki', 'wod-kan'], name: 'Woda', tag: 'woda' },
  { match: ['ogrzewani', 'ciepł', 'cieplo'], name: 'Ogrzewanie', tag: 'ogrzewanie' },
  { match: ['ubezpiecz'], name: 'Ubezpieczenie', tag: 'ubezpieczenie' },
  { match: ['abonament', 'telefon'], name: 'Telefon / abonament', tag: 'telefon' },
];

// True when an expense's text reads like a fixed bill (rent/utilities/internet…).
export function looksLikeBill(text: string): boolean {
  const hay = text.toLowerCase();
  return BILL_TYPES.some(bt => bt.match.some(m => hay.includes(m)));
}

// Which BILL_TYPE (if any) an expense belongs to — checked against note + storeName +
// tags, so a receipt logged with storeName "PGE" (no note/tag at all) still matches
// "Prąd" (2026-08-31, user: "dodaj mi filtry po tagach np pge itp żeby wiedzieć ile
// płacę za prąd" — the Finanse filter needs this same match, not just the tag list).
export function billTagFor(e: { note?: string; storeName?: string; tags?: string[] }): { tag: string; name: string } | null {
  const hay = `${e.note ?? ''} ${e.storeName ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase();
  const t = BILL_TYPES.find(bt => bt.match.some(m => hay.includes(m)));
  return t ? { tag: t.tag, name: t.name } : null;
}

export interface BillCandidate {
  tag: string;
  name: string;
  avgAmount: number;
  months: number;     // distinct months it appeared in
  lastDate: string;   // YYYY-MM-DD
  dayOfMonth: number; // day to bill on (from the last occurrence)
}

// Spot bills the user logs by hand every month (rent, electricity, internet…) so
// the app can offer to turn them into a recurring bill with a "paid?" prompt.
// Needs >=2 distinct months to call something recurring; skips anything already
// covered by an active subscription with that tag.
export function detectRecurringBills(expenses: Expense[], subs: Subscription[]): BillCandidate[] {
  const byTag: Record<string, { amounts: number[]; months: Set<string>; lastDate: string }> = {};
  for (const e of expenses) {
    if (e.type === 'income') continue;
    const hay = `${e.note ?? ''} ${(e.tags ?? []).join(' ')}`.toLowerCase();
    const t = BILL_TYPES.find(bt => bt.match.some(m => hay.includes(m)));
    if (!t) continue;
    const date = (e.date ?? '').slice(0, 10);
    if (!date) continue;
    const g = (byTag[t.tag] ??= { amounts: [], months: new Set(), lastDate: '' });
    g.amounts.push(e.amount);
    g.months.add(date.slice(0, 7));
    if (date > g.lastDate) g.lastDate = date;
  }

  const out: BillCandidate[] = [];
  for (const t of BILL_TYPES) {
    const g = byTag[t.tag];
    if (!g || g.months.size < 2) continue;
    if (subs.some(s => s.active && ((s.tags ?? []).includes(t.tag) || s.name.toLowerCase().includes(t.tag)))) continue;
    const avg = Math.round(g.amounts.reduce((a, b) => a + b, 0) / g.amounts.length);
    out.push({
      tag: t.tag, name: t.name, avgAmount: avg, months: g.months.size,
      lastDate: g.lastDate, dayOfMonth: Math.min(28, Math.max(1, parseInt(g.lastDate.slice(8, 10), 10) || 10)),
    });
  }
  return out.sort((a, b) => b.months - a.months);
}

// The next occurrence of a day-of-month (this month if still ahead, else next).
export function nextBillingDate(dayOfMonth: number, now = new Date()): string {
  const d = new Date(now.getFullYear(), now.getMonth(), dayOfMonth);
  if (d.getTime() <= now.getTime()) d.setMonth(d.getMonth() + 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

// "Don't suggest this bill" is remembered per tag so the prompt doesn't nag forever.
const K_DISMISS = 'dismissed_bill_suggest';

export async function getDismissedBills(): Promise<string[]> {
  try { const raw = await AsyncStorage.getItem(K_DISMISS); return raw ? JSON.parse(raw) : []; } catch { return []; }
}

export async function dismissBill(tag: string): Promise<string[]> {
  const cur = await getDismissedBills();
  if (!cur.includes(tag)) cur.push(tag);
  try { await AsyncStorage.setItem(K_DISMISS, JSON.stringify(cur)); } catch {}
  return cur;
}
