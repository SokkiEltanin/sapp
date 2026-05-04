import AsyncStorage from '@react-native-async-storage/async-storage';
import { ExpenseCategory } from '@/types';

export type MonthlyBudgets = Partial<Record<ExpenseCategory, number>>;

const KEY = 'monthly_budgets';

export async function getBudgets(): Promise<MonthlyBudgets> {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

export async function saveBudgets(budgets: MonthlyBudgets): Promise<void> {
  await AsyncStorage.setItem(KEY, JSON.stringify(budgets));
}
