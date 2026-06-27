import { Expense, ReceiptItem } from '@/types';
import { countsForConsumption } from '@/store/statsScope';

// Rough kcal per 100 g by food sub-tag (most specific) then category. These are
// ESTIMATES for a trend signal (energy balance), not a clinical counter.
const TAG_KCAL: Record<string, number> = {
  'słodycze': 450, 'czekolada': 540, 'ciastka': 470, 'lody': 200, 'przekąski': 500, 'chipsy': 530,
  'pieczywo': 265, 'makaron': 350, 'ryż': 350, 'kasza': 340, 'płatki': 370, 'mąka': 360,
  'ser': 350, 'nabiał': 120, 'jogurt': 70, 'jaja': 145, 'masło': 720, 'olej': 880, 'tłuszcze': 800,
  'mięso': 220, 'wędliny': 250, 'ryby': 160, 'drób': 170,
  'owoce': 55, 'warzywa': 35, 'orzechy': 600,
  'napoje': 40, 'soki': 45, 'alkohol': 250, 'piwo': 45,
  'fast food': 300, 'gotowe': 180,
};
const CAT_KCAL: Record<string, number> = { groceries: 140 }; // generic food fallback

export function kcalPer100g(it: { tags?: string[]; category?: string }): number {
  for (const t of it.tags ?? []) { const v = TAG_KCAL[t.toLowerCase()]; if (v != null) return v; }
  return CAT_KCAL[it.category ?? ''] ?? 0; // 0 = not recognised as food → excluded
}

// kcal for one receipt item: grams (explicit weight, else ~150 g/szt guess) × density.
export function estimateItemKcal(it: ReceiptItem): number {
  if (!countsForConsumption(it)) return 0;
  const per100 = kcalPer100g(it);
  if (per100 <= 0) return 0;
  let grams = (it.weightKg ?? 0) * 1000;
  if (grams <= 0) grams = 150 * (it.quantity > 0 ? it.quantity : 1);
  return Math.round((grams / 100) * per100);
}

export function expenseFoodKcal(e: Expense): number {
  if (e.type === 'income') return 0;
  const items = e.receiptItems ?? [];
  if (items.length === 0) return 0; // plain expenses (no breakdown) → can't estimate
  return items.reduce((s, it) => s + estimateItemKcal(it), 0);
}

// Estimated food energy bought on a given day (YYYY-MM-DD). A proxy for intake.
export function foodKcalForDate(expenses: Expense[], dateStr: string): number {
  return expenses
    .filter(e => e.type !== 'income' && e.date.slice(0, 10) === dateStr)
    .reduce((s, e) => s + expenseFoodKcal(e), 0);
}

// Average estimated daily food energy over the last N days (smooths buy≠eat noise).
export function avgFoodKcal(expenses: Expense[], days: number): number {
  const now = new Date();
  let total = 0;
  for (let i = 0; i < days; i++) {
    const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - i);
    const ds = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    total += foodKcalForDate(expenses, ds);
  }
  return Math.round(total / days);
}
