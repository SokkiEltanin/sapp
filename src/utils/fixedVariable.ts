import { Expense } from '@/types';
import { isSelfTransfer } from './statWidgets';
import { looksLikeBill } from './recurringBills';

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
  variable: number;
}

// Fixed vs variable spend for the last `n` months (oldest → newest).
export function fixedVariableMonths(expenses: Expense[], n = 4, now = new Date()): FVMonth[] {
  const out: FVMonth[] = [];
  for (let i = n - 1; i >= 0; i--) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    const key = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
    let fixed = 0, variable = 0;
    for (const e of expenses) {
      if (e.type === 'income') continue;
      if (isSelfTransfer(e)) continue;
      if ((e.date ?? '').slice(0, 7) !== key) continue;
      if (isFixedExpense(e)) fixed += e.amount; else variable += e.amount;
    }
    out.push({ month: key, fixed: Math.round(fixed), variable: Math.round(variable) });
  }
  return out;
}
