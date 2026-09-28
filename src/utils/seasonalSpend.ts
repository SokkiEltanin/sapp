import { Expense } from '@/types';
import { isSelfTransfer } from '@/utils/statWidgets';

// "Sezonowy wzorzec wydatków rok do roku" (2026-09-28, user zaakceptował pomysł z drugiej
// rundy brainstormingu tej sesji): "po roku działania appki: W październiku zeszłego roku
// wydałeś najwięcej na X, uważaj" — czysto historyczna analiza z już zebranych `expenses`,
// zero nowego store'u, zero ręcznego wpisywania. Patrzy na TEN SAM miesiąc kalendarzowy rok
// wcześniej (nie "poprzedni miesiąc" jak §202 — to inny punkt odniesienia, sezonowy, nie
// miesiąc-do-miesiąca) i zwraca kategorię, na którą wtedy poszło najwięcej.

const MONTH_NAMES = [
  'Styczniu', 'Lutym', 'Marcu', 'Kwietniu', 'Maju', 'Czerwcu',
  'Lipcu', 'Sierpniu', 'Wrześniu', 'Październiku', 'Listopadzie', 'Grudniu',
];

export interface SeasonalSpendWarning {
  monthLabel: string;   // "Październiku 2025" (miejscownik — pasuje do "W ... wydałeś")
  category: string;     // ExpenseCategory id — etykieta/kolor przez getCategoryMeta()
  amount: number;
}

export function seasonalSpendWarning(expenses: Expense[], now: Date = new Date()): SeasonalSpendWarning | null {
  const lastYear = now.getFullYear() - 1;
  const monthIdx = now.getMonth(); // 0-11
  const prefix = `${lastYear}-${String(monthIdx + 1).padStart(2, '0')}`;

  const byCategory: Record<string, number> = {};
  for (const e of expenses) {
    if ((e.date ?? '').slice(0, 7) !== prefix) continue;
    if (e.type === 'income' || isSelfTransfer(e)) continue;
    byCategory[e.category] = (byCategory[e.category] ?? 0) + e.amount;
  }

  const entries = Object.entries(byCategory).sort((a, b) => b[1] - a[1]);
  if (!entries.length || entries[0][1] <= 0) return null;

  const [category, amount] = entries[0];
  return { monthLabel: `${MONTH_NAMES[monthIdx]} ${lastYear}`, category, amount };
}
