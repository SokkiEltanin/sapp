import AsyncStorage from '@react-native-async-storage/async-storage';

export interface TagBudgetRule {
  id: string;
  tag: string;
  limit: number;
  period: 'week' | 'month';
  createdAt: string;
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
