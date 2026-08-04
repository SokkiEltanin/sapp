import { Expense } from '@/types';
import { consumesInScope, StatsScope } from '@/store/statsScope';

// Czyste agregacje wydatków dla dashboardu — wyniesione z app/(tabs)/index.tsx (krok 1
// utwardzania: „najpierw logika, nie JSX"). Dzień = LOKALNY przez slice(0,10) — patrz
// reguła date_local_iso. (statsScope eksportuje CZYSTE predykaty; test mockuje AsyncStorage.)

// Tagi strony „śmieciowej" — słodycze + przekąski, łączone wszędzie w statystykach.
export const SWEETS_TAGS = ['słodycze', 'przekąski'];

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

// Suma wartości pozycji „słodycze/przekąski" (per-item price) w podanych dniach, w danym
// zakresie konsumpcji (Ja/Wszyscy). Liczy pozycje paragonu, nie całe wydatki.
export function sweetsTotal(expenses: Expense[], dates: string[], scope: StatsScope = 'all'): number {
  const set = onDays(dates);
  let total = 0;
  for (const e of expenses) {
    if (e.type && e.type !== 'expense') continue;
    if (!set.has(e.date.slice(0, 10))) continue;
    for (const it of (e.receiptItems ?? [])) {
      if (consumesInScope(it, scope) && (it.tags ?? []).some(t => SWEETS_TAGS.includes(t))) total += it.price;
    }
  }
  return total;
}
