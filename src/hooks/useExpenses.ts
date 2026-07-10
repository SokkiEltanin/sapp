import { useEffect, useMemo } from 'react';
import { useExpensesStore } from '@/store/expensesStore';
import { expensesService } from '@/services/expensesService';
import { Expense, ExpenseCategory } from '@/types';
import { CATEGORY_META } from '@/utils/categories';
import { startOfWeek, endOfWeek, subWeeks, parseISO, isWithinInterval, startOfMonth, endOfMonth } from 'date-fns';

export function useExpenses() {
  const { expenses, isLoading, error, setExpenses, setLoading, setError, addExpense, deleteExpense } =
    useExpensesStore();

  useEffect(() => { loadExpenses(); }, []);

  const loadExpenses = async () => {
    try {
      setLoading(true);
      const data = await expensesService.getAll();
      setExpenses(data);
    } catch (e: any) {
      setError(e.message);
    } finally {
      setLoading(false);
    }
  };

  const stats = useMemo(() => {
    const now = new Date();
    const thisWeekStart = startOfWeek(now, { weekStartsOn: 1 });
    const thisWeekEnd = endOfWeek(now, { weekStartsOn: 1 });
    const lastWeekStart = startOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const lastWeekEnd = endOfWeek(subWeeks(now, 1), { weekStartsOn: 1 });
    const monthStart = startOfMonth(now);
    const monthEnd = endOfMonth(now);

    const isExpense = (e: Expense) => !e.type || e.type === 'expense';
    const isIncome = (e: Expense) => e.type === 'income';

    const thisWeek = expenses
      .filter((e) => isExpense(e) && isWithinInterval(parseISO(e.date), { start: thisWeekStart, end: thisWeekEnd }))
      .reduce((s, e) => s + e.amount, 0);

    const lastWeek = expenses
      .filter((e) => isExpense(e) && isWithinInterval(parseISO(e.date), { start: lastWeekStart, end: lastWeekEnd }))
      .reduce((s, e) => s + e.amount, 0);

    const monthExpenses = expenses
      .filter((e) => isExpense(e) && isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }))
      .reduce((s, e) => s + e.amount, 0);

    const monthIncome = expenses
      .filter((e) => isIncome(e) && isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }))
      .reduce((s, e) => s + e.amount, 0);

    const allByCat = expenses
      .filter(isExpense)
      .reduce<Record<string, number>>((acc, e) => {
        acc[e.category] = (acc[e.category] ?? 0) + e.amount;
        return acc;
      }, {});
    const topCatKey = Object.entries(allByCat).sort((a, b) => b[1] - a[1])[0]?.[0] as ExpenseCategory | undefined;
    const topCategory = topCatKey ? (CATEGORY_META as any)[topCatKey]?.label : undefined;

    const monthCategorySpend = expenses
      .filter(e => isExpense(e) && isWithinInterval(parseISO(e.date), { start: monthStart, end: monthEnd }))
      .reduce<Record<string, number>>((acc, e) => {
        acc[e.category] = (acc[e.category] ?? 0) + e.amount;
        return acc;
      }, {});

    return { thisWeek, lastWeek, monthExpenses, monthIncome, topCategory, monthCategorySpend };
  }, [expenses]);

  const grouped = useMemo(() => {
    const map: Record<string, Expense[]> = {};
    for (const e of expenses) {
      const key = (e.date ?? '').split('T')[0] || 'brak-daty';
      if (!map[key]) map[key] = [];
      map[key].push(e);
    }
    return Object.entries(map).sort(([a], [b]) => b.localeCompare(a));
  }, [expenses]);

  const remove = async (id: string) => {
    deleteExpense(id);
    await expensesService.remove(id);
  };

  return { expenses, grouped, stats, isLoading, error, reload: loadExpenses, remove };
}
