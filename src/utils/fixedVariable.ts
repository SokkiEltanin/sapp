import { Expense } from '@/types';
import { isSelfTransfer } from './statWidgets';
import { looksLikeBill } from './recurringBills';
import { getCategoryMeta } from './categories';

// Fixed = committed monthly costs you can't easily cut (rent, utilities, internet,
// insurance, subscriptions). Everything else you spend is variable/discretionary.
// Self-transfers (savings/Revolut) aren't spending at all → excluded.
export function isFixedExpense(e: Expense): boolean {
  if (e.type === 'income') return false;
  if (isSelfTransfer(e)) return false;
  if (e.category === 'housing' || e.category === 'subscriptions') return true;
  return looksLikeBill(`${e.note ?? ''} ${(e.tags ?? []).join(' ')}`);
}

export interface FVMonth {
  month: string;   // YYYY-MM
  fixed: number;
  variable: number; // discretionary, EXCLUDING food (kept separate so it's clear)
  food: number;     // groceries — broken out so "jedzenie vs zmienne vs stałe" is explicit
}

// Fixed vs variable vs food spend for the last `n` months (oldest → newest).
export function fixedVariableMonths(expenses: Expense[], n = 4, now = new Date()): FVMonth[] {
  const out: FVMonth[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let fixed = 0, variable = 0, food = 0;
    for (const e of expenses) {
      if (e.type === 'income') continue;
      if (isSelfTransfer(e)) continue;
      if ((e.date ?? '').slice(0, 7) !== key) continue;
      if (isFixedExpense(e)) fixed += e.amount;
      else if (e.category === 'groceries') food += e.amount;
      else variable += e.amount;
    }
    out.push({ month: key, fixed: Math.round(fixed), variable: Math.round(variable), food: Math.round(food) });
  }
  return out;
}

export interface FixedItem { label: string; amount: number; }

// The named fixed bills for a month (YYYY-MM), grouped by their note/store (else the
// category label) and summed — so the UI can say "Mieszkanie 1200 · Prąd 180 · PLAY 60".
export function fixedBreakdown(expenses: Expense[], month: string): FixedItem[] {
  const map: Record<string, number> = {};
  for (const e of expenses) {
    if (e.type === 'income' || isSelfTransfer(e)) continue;
    if ((e.date ?? '').slice(0, 7) !== month) continue;
    if (!isFixedExpense(e)) continue;
    const label = (e.note ?? '').trim() || (e.storeName ?? '').trim() || getCategoryMeta(e.category).label;
    map[label] = (map[label] ?? 0) + e.amount;
  }
  return Object.entries(map)
    .map(([label, amount]) => ({ label, amount: Math.round(amount) }))
    .sort((a, b) => b.amount - a.amount);
}
