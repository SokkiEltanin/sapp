import { Expense } from '@/types';

export interface DetectedFixedCost {
  name: string;
  amount: number;       // median amount
  category: string;
  lastDate: string;
  occurrences: number;  // how many months appeared in
  confidence: 'low' | 'medium' | 'high';
  monthlyTotal: number; // normalized monthly cost
}

function normalizeName(s: string): string {
  return s.trim().toLowerCase()
    .replace(/\d{1,2}[./]\d{1,2}([./]\d{2,4})?/g, '') // strip dates
    .replace(/\s+/g, ' ')
    .trim();
}

function median(arr: number[]): number {
  const sorted = [...arr].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

export function detectFixedCosts(expenses: Expense[]): DetectedFixedCost[] {
  // Only look at expense-type, non-groceries entries with a note or storeName
  const candidates = expenses.filter(e => {
    if (e.type && e.type !== 'expense') return false;
    if (e.category === 'groceries') return false;
    const name = e.storeName || e.note || '';
    return name.trim().length >= 2;
  });

  // Group: key = normalizedName + category
  const groups: Record<string, {
    name: string;
    category: string;
    months: Set<string>;
    amounts: number[];
    lastDate: string;
  }> = {};

  for (const e of candidates) {
    const rawName = e.storeName || e.note || '';
    const key = `${normalizeName(rawName)}::${e.category}`;
    if (!groups[key]) {
      groups[key] = { name: rawName, category: e.category, months: new Set(), amounts: [], lastDate: e.date };
    }
    const month = e.date.slice(0, 7); // YYYY-MM
    groups[key].months.add(month);
    groups[key].amounts.push(e.amount);
    if (e.date > groups[key].lastDate) groups[key].lastDate = e.date;
  }

  const results: DetectedFixedCost[] = [];

  for (const g of Object.values(groups)) {
    const occurrences = g.months.size;
    if (occurrences < 2) continue;

    const med = median(g.amounts);
    // Check variance — skip if amounts differ too wildly (>30% spread relative to median)
    const maxDiff = Math.max(...g.amounts.map(a => Math.abs(a - med)));
    if (maxDiff / med > 0.3) continue;

    const confidence: DetectedFixedCost['confidence'] =
      occurrences >= 4 ? 'high' : occurrences >= 3 ? 'medium' : 'low';

    results.push({
      name: g.name,
      amount: med,
      category: g.category,
      lastDate: g.lastDate,
      occurrences,
      confidence,
      monthlyTotal: med, // already monthly since we group by name+category
    });
  }

  return results.sort((a, b) => b.amount - a.amount);
}
