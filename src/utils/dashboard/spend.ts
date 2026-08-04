import { Expense } from '@/types';

// Czyste agregacje wydatków dla dashboardu — wyniesione z app/(tabs)/index.tsx (krok 1
// utwardzania: „najpierw logika, nie JSX"). Bez zależności od store'ów → testowalne w node.
// Dzień = LOKALNY przez slice(0,10) — patrz reguła date_local_iso.

const onDays = (dates: string[]) => new Set(dates);

// Suma wydatków kategorii 'groceries' w podanych dniach.
export function groceryTotal(expenses: Expense[], dates: string[]): number {
  const set = onDays(dates);
  return expenses.filter(e => (!e.type || e.type === 'expense') && e.category === 'groceries' && set.has(e.date.slice(0, 10)))
    .reduce((s, e) => s + e.amount, 0);
}

// Suma WSZYSTKICH wydatków (nie-przychodów) w podanych dniach.
export function allSpend(expenses: Expense[], dates: string[]): number {
  const set = onDays(dates);
  return expenses.filter(e => (!e.type || e.type === 'expense') && set.has(e.date.slice(0, 10)))
    .reduce((s, e) => s + e.amount, 0);
}

// Suma przychodów w podanych dniach.
export function weekIncome(expenses: Expense[], dates: string[]): number {
  const set = onDays(dates);
  return expenses.filter(e => e.type === 'income' && set.has(e.date.slice(0, 10)))
    .reduce((s, e) => s + e.amount, 0);
}
