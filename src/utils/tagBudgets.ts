import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TagBudgetRule {
  id: string;
  tag: string;            // primary tag (kept for backward compat)
  tags?: string[];        // if set, the limit covers ALL of these tags combined
  limit: number;
  period: 'week' | 'month';
  person?: string;        // if set, the bar counts only what THIS person ate
  createdAt: string;
}

// The tags a rule covers (multi-tag rules combine spend across all of them).
export function ruleTags(rule: TagBudgetRule): string[] {
  return rule.tags && rule.tags.length > 0 ? rule.tags : [rule.tag];
}

// A short label like "#słodycze + #przekąski".
export function ruleLabel(rule: TagBudgetRule): string {
  const base = ruleTags(rule).map(t => `#${t}`).join(' + ');
  return rule.person ? `${base} · ${rule.person}` : base;
}

// How much of a receipt item's price counts toward a person's bar.
//  - no person (combined bar)            → full price
//  - item has eaters, includes person    → price split evenly among its eaters
//  - item has eaters, excludes person    → 0
//  - item has NO eaters (nobody marked)  → shared equally among everyone
export function attributedPrice(
  item: { price: number; eaters?: string[] },
  person: string | undefined,
  persons: string[],
): number {
  if (!person) return item.price;
  const eaters = item.eaters ?? [];
  if (eaters.length === 0) return item.price / Math.max(1, persons.length);
  return eaters.includes(person) ? item.price / eaters.length : 0;
}

const KEY = 'tag_budget_rules_v1';

export async function getTagBudgetRules(): Promise<TagBudgetRule[]> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : [];
  } catch {
    return [];
  }
}

export async function saveTagBudgetRules(rules: TagBudgetRule[]): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(rules));
}

export function computeTagSpend(
  expenses: { tags: string[]; amount: number; date: string; type?: string }[],
  tag: string,
  period: 'week' | 'month',
): number {
  const now = new Date();
  let start: Date;
  if (period === 'month') {
    start = new Date(now.getFullYear(), now.getMonth(), 1);
  } else {
    start = new Date(now);
    const day = now.getDay() === 0 ? 6 : now.getDay() - 1;
    start.setDate(now.getDate() - day);
    start.setHours(0, 0, 0, 0);
  }
  return expenses
    .filter(e => {
      if (e.type === 'income') return false;
      if (!e.tags.includes(tag)) return false;
      return new Date(e.date) >= start;
    })
    .reduce((sum, e) => sum + e.amount, 0);
}

export function getBudgetStatus(spent: number, limit: number): 'ok' | 'warning' | 'exceeded' {
  const ratio = spent / limit;
  if (ratio >= 1) return 'exceeded';
  if (ratio >= 0.8) return 'warning';
  return 'ok';
}

// Well-known food sub-tags from FOOD_TAG_MAP — suggested in the UI
export const SUGGESTED_TAGS = [
  'słodycze', 'mięso', 'nabiał', 'ryby', 'warzywa', 'owoce',
  'pieczywo', 'napoje', 'przekąski', 'chemia', 'higiena', 'dania gotowe',
];
